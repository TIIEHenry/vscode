/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as vscode from 'vscode';
import { ConfigKey, ConfigTarget, IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { IChatModelInformation } from '../../../platform/endpoint/common/endpointProvider';
import { IVSCodeExtensionContext } from '../../../platform/extContext/common/extensionContext';
import { ILogService } from '../../../platform/log/common/logService';
import { IFetcherService } from '../../../platform/networking/common/fetcherService';
import { IExperimentationService } from '../../../platform/telemetry/common/nullExperimentationService';
import { ErrorUtils } from '../../../util/common/errors';
import { generateUuid } from '../../../util/vs/base/common/uuid';
import { IInstantiationService } from '../../../util/vs/platform/instantiation/common/instantiation';
import { resolveModelInfo } from '../common/byokProvider';
import { OpenAIEndpoint } from '../node/openAIEndpoint';
import { AbstractOpenAICompatibleLMProvider, LanguageModelChatConfiguration, OpenAICompatibleLanguageModelChatInformation } from './abstractLanguageModelChatProvider';
import { byokKnownModelsToAPIInfoWithEffort } from './byokModelInfo';
import { IBYOKStorageService } from './byokStorageService';

interface OllamaModelInfoAPIResponse {
	template: string;
	capabilities: string[];
	details: { family: string };
	remote_model?: string;
	model_info?: {
		'general.basename': string;
		'general.architecture': string;
		[other: string]: any;
	};
}

interface OllamaVersionResponse {
	version: string;
}

// Minimum supported Ollama version - versions below this may have compatibility issues
const MINIMUM_OLLAMA_VERSION = '0.6.4';

export interface OllamaConfig extends LanguageModelChatConfiguration {
	url: string;
}

const endpointCleanupKey = 'copilot-byok-migration-Ollama-endpoint-cleanup-v1';
const endpointTargets = [
	[ConfigTarget.WorkspaceFolder, 'workspaceFolderValue'],
	[ConfigTarget.Workspace, 'workspaceValue'],
	[ConfigTarget.Global, 'globalValue'],
] as const;

interface EndpointCleanupCheckpoint {
	schemaVersion: 1;
	provider: 'ollama';
	group: 'Ollama';
	id: string;
	sourceURI: string;
	target: ConfigTarget;
	url: string;
}

export class OllamaLMProvider extends AbstractOpenAICompatibleLMProvider<OllamaConfig> {

	public static readonly providerName = 'Ollama';
	public static readonly providerId = this.providerName.toLowerCase();

	private _modelCache = new Map<string, IChatModelInformation>();

	constructor(
		byokStorageService: IBYOKStorageService,
		@IFetcherService fetcherService: IFetcherService,
		@IConfigurationService configurationService: IConfigurationService,
		@ILogService logService: ILogService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IExperimentationService expService: IExperimentationService,
		@IVSCodeExtensionContext private readonly _extensionContext: IVSCodeExtensionContext
	) {
		super(
			OllamaLMProvider.providerId,
			OllamaLMProvider.providerName,
			undefined,
			byokStorageService,
			fetcherService,
			logService,
			instantiationService,
			configurationService,
			expService
		);

		void this.migrateConfig().catch(error => {
			this._logService.error(error instanceof Error ? error : String(error), 'BYOK: could not finish migrating the legacy Ollama endpoint');
		});
	}

	private async migrateConfig(): Promise<void> {
		const stored = this._extensionContext.globalState.get<unknown>(endpointCleanupKey);
		if (stored !== undefined) {
			const checkpoint = this.readCleanupCheckpoint(stored);
			if (checkpoint) {
				await this.cleanupMigratedEndpoint(checkpoint);
			} else {
				this._logService.info('BYOK: unrecognized Ollama cleanup checkpoint; legacy settings are kept');
			}
			return;
		}
		const inspected = this._configurationService.inspectConfig(ConfigKey.Deprecated.OllamaEndpoint);
		for (const [target, property] of endpointTargets) {
			const url = inspected?.[property];
			if (url === undefined) {
				continue;
			}
			const sourceURI = this.getEndpointSourceURI(target);
			if (typeof url !== 'string' || !url.trim() || !sourceURI) {
				this._logService.info('BYOK: the legacy Ollama endpoint source cannot be identified; settings are kept');
				return;
			}
			await this.configureDefaultGroupIfExists(this._name, { url });
			// Only a successful command proves this instance imported the source. A
			// duplicate-name error cannot claim a group that the user configured.
			const checkpoint: EndpointCleanupCheckpoint = {
				schemaVersion: 1, provider: 'ollama', group: 'Ollama', id: generateUuid(), sourceURI, target, url,
			};
			if (this._extensionContext.globalState.get<unknown>(endpointCleanupKey) !== undefined) {
				this._logService.info('BYOK: another Ollama cleanup checkpoint appeared; legacy settings are kept');
				return;
			}
			await this._extensionContext.globalState.update(endpointCleanupKey, checkpoint);
			await this.cleanupMigratedEndpoint(checkpoint);
			return;
		}
	}

	private getEndpointSourceURI(target: ConfigTarget): string | undefined {
		if (target === ConfigTarget.Global) {
			return 'profile-local';
		}
		if (target === ConfigTarget.Workspace && vscode.workspace.workspaceFile) {
			return vscode.workspace.workspaceFile.toString();
		}
		const folders = vscode.workspace.workspaceFolders;
		return folders?.length === 1 ? folders[0].uri.toString() : undefined;
	}

	private readCleanupCheckpoint(value: unknown): EndpointCleanupCheckpoint | undefined {
		if (!value || typeof value !== 'object') {
			return;
		}
		const record = value as Record<string, unknown>;
		if (record.schemaVersion !== 1 || record.provider !== 'ollama' || record.group !== 'Ollama'
			|| typeof record.id !== 'string' || !record.id.trim()
			|| typeof record.sourceURI !== 'string' || !record.sourceURI.trim()
			|| typeof record.url !== 'string' || !record.url.trim()
			|| !endpointTargets.some(([target]) => target === record.target)) {
			return;
		}
		// Memento.get may return its internal object. Never modify that reference.
		return {
			schemaVersion: 1, provider: 'ollama', group: 'Ollama', id: record.id,
			sourceURI: record.sourceURI, target: record.target as ConfigTarget, url: record.url,
		};
	}

	private ownsCleanupCheckpoint(checkpoint: EndpointCleanupCheckpoint): boolean {
		const current = this.readCleanupCheckpoint(this._extensionContext.globalState.get<unknown>(endpointCleanupKey));
		return !!current && (Object.keys(checkpoint) as (keyof EndpointCleanupCheckpoint)[])
			.every(key => current[key] === checkpoint[key]);
	}

	private async cleanupMigratedEndpoint(checkpoint: EndpointCleanupCheckpoint): Promise<void> {
		if (!this.ownsCleanupCheckpoint(checkpoint) || this.getEndpointSourceURI(checkpoint.target) !== checkpoint.sourceURI) {
			return;
		}
		const property = endpointTargets.find(([target]) => target === checkpoint.target)![1];
		const current = this._configurationService.inspectConfig(ConfigKey.Deprecated.OllamaEndpoint)?.[property];
		if (current !== undefined && current !== checkpoint.url) {
			return;
		}
		if (current !== undefined) {
			// This scoped recheck is not CAS: config.update can still race another
			// writer after the RPC is issued. Keep that API boundary explicit.
			await this._configurationService.setConfig(ConfigKey.Deprecated.OllamaEndpoint, undefined, checkpoint.target);
		}
		if (this.getEndpointSourceURI(checkpoint.target) === checkpoint.sourceURI
			&& this._configurationService.inspectConfig(ConfigKey.Deprecated.OllamaEndpoint)?.[property] === undefined
			&& this.ownsCleanupCheckpoint(checkpoint)) {
			await this._extensionContext.globalState.update(endpointCleanupKey, undefined);
		}
	}

	protected override async getAllModels(silent: boolean, apiKey: string | undefined, config: OllamaConfig | undefined): Promise<OpenAICompatibleLanguageModelChatInformation<OllamaConfig>[]> {
		if (!config) {
			return [];
		}

		const ollamaBaseUrl = config.url;

		try {
			// Check Ollama server version before proceeding with model operations
			await this._checkOllamaVersion(ollamaBaseUrl);

			const response = await this._fetcherService.fetch(`${ollamaBaseUrl}/api/tags`, { method: 'GET', callSite: 'ollama-tags' });
			const models = (await response.json()).models;
			this._knownModels = {};
			for (const model of models) {
				let modelInfo = this._modelCache.get(`${ollamaBaseUrl}/${model.model}`);
				if (!modelInfo) {
					try {
						modelInfo = await this._getOllamaModelInfo(ollamaBaseUrl, model.model);
					} catch (e) {
						const error = ErrorUtils.fromUnknown(e);
						this._logService.error(error, 'ollamaProvider: failed to fetch Ollama model info');
						this._logService.debug(`[ollamaProvider] Failed model info fetch for model=${model.model}`);
						continue; // Skip this model but continue processing others
					}
					this._modelCache.set(`${ollamaBaseUrl}/${model.model}`, modelInfo);
				}
				this._knownModels[modelInfo.id] = {
					maxInputTokens: modelInfo.capabilities.limits?.max_prompt_tokens ?? 4096,
					maxOutputTokens: modelInfo.capabilities.limits?.max_output_tokens ?? 4096,
					name: modelInfo.name,
					toolCalling: !!modelInfo.capabilities.supports.tool_calls,
					vision: !!modelInfo.capabilities.supports.vision
				};
			}

			return byokKnownModelsToAPIInfoWithEffort(this._name, this._knownModels).map(model => ({
				...model,
				url: ollamaBaseUrl
			}));

		} catch (e) {
			// Check if this is our version check error and preserve it
			if (e instanceof Error && e.message.includes('Ollama server version')) {
				throw e;
			}
			throw new Error('Failed to fetch models from Ollama. Please ensure Ollama is running. If ollama is on another host, please configure the `"github.copilot.chat.byok.ollamaEndpoint"` setting.');
		}
	}

	protected override getModelsBaseUrl(configuration: OllamaConfig | undefined): string {
		return configuration?.url ?? 'http://localhost:11434';
	}

	protected override async createOpenAIEndPoint(model: OpenAICompatibleLanguageModelChatInformation<OllamaConfig>): Promise<OpenAIEndpoint> {
		const modelInfo = this.getModelInfo(model.id, model.url);
		const url = `${model.url}/v1/chat/completions`;
		return this._instantiationService.createInstance(OpenAIEndpoint, modelInfo, model.configuration?.apiKey ?? '', url);
	}

	private async _getOllamaModelInfo(ollamaBaseUrl: string, modelId: string): Promise<IChatModelInformation> {
		const modelInfo = await this._fetchOllamaModelInformation(ollamaBaseUrl, modelId);
		const contextWindow = modelInfo?.model_info?.[`${modelInfo.model_info['general.architecture']}.context_length`] ?? 32768;
		const outputTokens = contextWindow < 4096 ? Math.floor(contextWindow / 2) : 4096;
		const modelCapabilities = {
			name: modelInfo?.model_info?.['general.basename'] ?? modelInfo.remote_model ?? modelId,
			maxOutputTokens: outputTokens,
			maxInputTokens: contextWindow - outputTokens,
			vision: modelInfo.capabilities.includes('vision'),
			toolCalling: modelInfo.capabilities.includes('tools')
		};

		return resolveModelInfo(modelId, this._name, this._knownModels, modelCapabilities);
	}

	/**
	 * Compare version strings to check if current version meets minimum requirements
	 * @param currentVersion Current Ollama server version
	 * @returns true if version is supported, false otherwise
	 */
	private _isVersionSupported(currentVersion: string): boolean {
		if (currentVersion === '0.0.0') {
			// allow all dev versions through
			return true;
		}

		// Simple version comparison: split by dots and compare numerically
		const currentParts = currentVersion.split('.').map(n => parseInt(n, 10));
		const minimumParts = MINIMUM_OLLAMA_VERSION.split('.').map(n => parseInt(n, 10));

		for (let i = 0; i < Math.max(currentParts.length, minimumParts.length); i++) {
			const current = currentParts[i] || 0;
			const minimum = minimumParts[i] || 0;

			if (current > minimum) {
				return true;
			}
			if (current < minimum) {
				return false;
			}
		}

		return true; // versions are equal
	}

	private async _fetchOllamaModelInformation(ollamaBaseUrl: string, modelId: string): Promise<OllamaModelInfoAPIResponse> {
		const response = await this._fetcherService.fetch(`${ollamaBaseUrl}/api/show`, {
			method: 'POST',
			callSite: 'ollama-show',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ model: modelId })
		});
		return response.json() as unknown as OllamaModelInfoAPIResponse;
	}
	/**
	 * Check if the connected Ollama server version meets the minimum requirements
	 * @throws Error if version is below minimum or version check fails
	 */
	private async _checkOllamaVersion(ollamaBaseUrl: string): Promise<void> {
		try {
			const response = await this._fetcherService.fetch(`${ollamaBaseUrl}/api/version`, { method: 'GET', callSite: 'ollama-version' });
			const versionInfo = await response.json() as OllamaVersionResponse;

			if (!this._isVersionSupported(versionInfo.version)) {
				throw new Error(
					`Ollama server version ${versionInfo.version} is not supported. ` +
					`Please upgrade to version ${MINIMUM_OLLAMA_VERSION} or higher. ` +
					`Visit https://ollama.ai for upgrade instructions.`
				);
			}
		} catch (e) {
			if (e instanceof Error && e.message.includes('Ollama server version')) {
				// Re-throw our custom version error
				throw e;
			}
			// If version endpoint fails
			throw new Error(
				`Unable to verify Ollama server version. Please ensure you have Ollama version ${MINIMUM_OLLAMA_VERSION} or higher installed. ` +
				`If you're running an older version, please upgrade from https://ollama.ai`
			);
		}
	}
}
