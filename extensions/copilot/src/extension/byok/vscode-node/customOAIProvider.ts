/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Config, ConfigKey, IConfigurationService } from '../../../platform/configuration/common/configurationService';
import { EndpointEditToolName, ModelSupportedEndpoint } from '../../../platform/endpoint/common/endpointProvider';
import { IVSCodeExtensionContext } from '../../../platform/extContext/common/extensionContext';
import { ILogService } from '../../../platform/log/common/logService';
import { IFetcherService } from '../../../platform/networking/common/fetcherService';
import { IExperimentationService } from '../../../platform/telemetry/common/nullExperimentationService';
import { IStringDictionary } from '../../../util/vs/base/common/collections';
import { IInstantiationService } from '../../../util/vs/platform/instantiation/common/instantiation';
import { resolveModelInfo } from '../common/byokProvider';
import { OpenAIEndpoint } from '../node/openAIEndpoint';
import { AbstractOpenAICompatibleLMProvider, LanguageModelChatConfiguration, OpenAICompatibleLanguageModelChatInformation } from './abstractLanguageModelChatProvider';
import { byokKnownModelToAPIInfoWithEffort } from './byokModelInfo';
import { IBYOKStorageService } from './byokStorageService';

export function resolveCustomOAIUrl(modelId: string, url: string): string {
	// The fully resolved url was already passed in
	if (hasExplicitApiPath(url)) {
		return url;
	}

	// Remove the trailing slash
	if (url.endsWith('/')) {
		url = url.slice(0, -1);
	}

	// Default to chat completions for base URLs
	const defaultApiPath = '/chat/completions';

	// Check if URL already contains any version pattern like /v1, /v2, etc
	const versionPattern = /\/v\d+$/;
	if (versionPattern.test(url)) {
		return `${url}${defaultApiPath}`;
	}

	// For standard OpenAI-compatible endpoints, just append the standard path
	return `${url}/v1${defaultApiPath}`;
}

export function hasExplicitApiPath(url: string): boolean {
	return url.includes('/responses') || url.includes('/chat/completions');
}

/** Stable, user-visible names for legacy API-key buckets. Never include the secret itself. */
export function customOAIProviderGroupName(providerGroupName: string, bucketIndex: number): string {
	return bucketIndex === 0 ? providerGroupName : `${providerGroupName} (${bucketIndex + 1})`;
}

export interface CustomOAIModelProviderConfig extends LanguageModelChatConfiguration {
	url?: string;
	models?: CustomOAIModelConfig[];
}

interface _CustomOAIModelConfig {
	name: string;
	url: string;
	/** Optional when {@link contextWindow} is set; then derived as `contextWindow - maxOutputTokens`. */
	maxInputTokens?: number;
	maxOutputTokens: number;
	/** The model's full context window (input + output) in tokens, e.g. 1000000 for a 1M model. */
	contextWindow?: number;
	toolCalling: boolean;
	vision: boolean;
	thinking?: boolean;
	streaming?: boolean;
	editTools?: EndpointEditToolName[];
	requestHeaders?: Record<string, string>;
	zeroDataRetentionEnabled?: boolean;
	supportsReasoningEffort?: string[];
	reasoningEffortFormat?: 'chat-completions' | 'responses' | 'messages';
}

export interface CustomOAIModelConfig extends _CustomOAIModelConfig {
	id: string;
}

export abstract class AbstractCustomOAIBYOKModelProvider extends AbstractOpenAICompatibleLMProvider<CustomOAIModelProviderConfig> {

	constructor(
		id: string,
		name: string,
		byokStorageService: IBYOKStorageService,
		@ILogService logService: ILogService,
		@IFetcherService fetcherService: IFetcherService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService,
		@IExperimentationService expService: IExperimentationService,
		@IVSCodeExtensionContext private readonly _extensionContext: IVSCodeExtensionContext
	) {
		super(id, name, undefined, byokStorageService, fetcherService, logService, instantiationService, configurationService, expService);
	}

	protected async migrateConfig(configKey: Config<IStringDictionary<_CustomOAIModelConfig>>, providerName: string, providerGroupName: string): Promise<void> {
		// Check if migration has already been completed
		const migrationKey = `copilot-byok-migration-${providerName}-${configKey}`;
		const migrationCompleted = this._extensionContext.globalState.get<boolean>(migrationKey, false);
		if (migrationCompleted) {
			return;
		}

		const customOAIModelConfigsByApiKey: Map<string, Array<CustomOAIModelConfig & { requiresAPIKey?: boolean }>> = new Map();
		const customOAIModelProviderConfig = this._configurationService.getConfig<IStringDictionary<_CustomOAIModelConfig>>(configKey);
		for (const [modelId, modelConfig] of Object.entries(customOAIModelProviderConfig)) {
			const apiKey = await this._byokStorageService.getAPIKey(providerName, modelId) ?? '';
			const customOAIModelConfigs = customOAIModelConfigsByApiKey.get(apiKey) ?? [];
			customOAIModelConfigs.push({ ...modelConfig, id: modelId, requiresAPIKey: undefined });
			customOAIModelConfigsByApiKey.set(apiKey, customOAIModelConfigs);
		}
		if (customOAIModelConfigsByApiKey.size > 0) {
			let migrationSucceeded = true;
			let bucketIndex = 0;
			for (const [apiKey, customOAIModelConfigs] of customOAIModelConfigsByApiKey.entries()) {
				// The configuration service keys groups by (vendor, name). Keep the first
				// bucket's historical name and give later API-key buckets stable suffixes;
				// never expose the key itself in user-visible configuration.
				const targetGroupName = customOAIProviderGroupName(providerGroupName, bucketIndex);
				bucketIndex++;
				try {
					await this.configureDefaultGroupIfExists(targetGroupName, { models: customOAIModelConfigs, apiKey: apiKey || undefined });
				} catch (error) {
					if (this.isExistingGroupError(error, targetGroupName)) {
						this._logService.info(`BYOK: a ${targetGroupName} language model group already exists, so this legacy bucket was not migrated`);
						continue;
					}
					migrationSucceeded = false;
					this._logService.error(error instanceof Error ? error : String(error), `BYOK: could not migrate legacy ${providerName} models into ${targetGroupName}`);
				}
			}
			if (migrationSucceeded) {
				// Mark migration as completed instead of deleting the config.
				await this._extensionContext.globalState.update(migrationKey, true);
			}
		}
	}

	private isExistingGroupError(error: unknown, groupName: string): boolean {
		return error instanceof Error && error.message.includes(`Language model group with name ${groupName} already exists for vendor ${this._id}`);
	}

	protected override async configureDefaultGroupWithApiKeyOnly(): Promise<string | undefined> {
		// No-op: Custom OAI models are configured separately via migration
		return;
	}

	protected override async getAllModels(silent: boolean, apiKey: string | undefined, configuration: CustomOAIModelProviderConfig | undefined): Promise<OpenAICompatibleLanguageModelChatInformation<CustomOAIModelProviderConfig>[]> {
		if (configuration?.url) {
			return super.getAllModels(silent, apiKey, configuration);
		}
		const models: OpenAICompatibleLanguageModelChatInformation<CustomOAIModelProviderConfig>[] = [];
		if (Array.isArray(configuration?.models)) {
			for (const modelConfig of configuration.models) {
				models.push({
					...byokKnownModelToAPIInfoWithEffort(this._name, modelConfig.id, modelConfig),
					url: modelConfig.url
				});
			}
		}
		return models;
	}

	protected override async createOpenAIEndPoint(model: OpenAICompatibleLanguageModelChatInformation<CustomOAIModelProviderConfig>): Promise<OpenAIEndpoint> {
		const url = this.resolveUrl(model.id, model.url);
		const modelConfiguration = model.configuration?.models?.find(m => m.id === model.id);
		const modelCapabilities = {
			maxInputTokens: model.maxInputTokens,
			maxOutputTokens: model.maxOutputTokens,
			contextWindow: modelConfiguration?.contextWindow,
			toolCalling: !!model.capabilities?.toolCalling || false,
			vision: !!model.capabilities?.imageInput || false,
			name: model.name,
			url,
			thinking: modelConfiguration?.thinking ?? false,
			streaming: modelConfiguration?.streaming,
			requestHeaders: modelConfiguration?.requestHeaders,
			zeroDataRetentionEnabled: modelConfiguration?.zeroDataRetentionEnabled,
			supportsReasoningEffort: modelConfiguration?.supportsReasoningEffort,
			reasoningEffortFormat: modelConfiguration?.reasoningEffortFormat
		};
		const modelInfo = resolveModelInfo(model.id, this._name, undefined, modelCapabilities);
		if (modelCapabilities?.url?.includes('/responses')) {
			modelInfo.supported_endpoints = [
				ModelSupportedEndpoint.ChatCompletions,
				ModelSupportedEndpoint.Responses
			];
		}
		return this._instantiationService.createInstance(OpenAIEndpoint, modelInfo, model.configuration?.apiKey ?? '', url);
	}

	protected getModelsBaseUrl(configuration: CustomOAIModelProviderConfig | undefined): string | undefined {
		return configuration?.url;
	}

	protected abstract resolveUrl(modelId: string, url: string): string;
}

export class CustomOAIBYOKModelProvider extends AbstractCustomOAIBYOKModelProvider {

	public static readonly providerName = 'CustomOAI';
	public static readonly providerId = this.providerName.toLowerCase();

	constructor(
		_byokStorageService: IBYOKStorageService,
		@ILogService logService: ILogService,
		@IFetcherService fetcherService: IFetcherService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IConfigurationService configurationService: IConfigurationService,
		@IExperimentationService expService: IExperimentationService,
		@IVSCodeExtensionContext extensionContext: IVSCodeExtensionContext
	) {
		super(CustomOAIBYOKModelProvider.providerId, CustomOAIBYOKModelProvider.providerName, _byokStorageService, logService, fetcherService, instantiationService, configurationService, expService, extensionContext);
		void this.migrateExistingConfigs().catch(error => {
			this._logService.error(error instanceof Error ? error : String(error), 'BYOK: could not finish migrating legacy CustomOAI models');
		});
	}

	// TODO: Remove this after 6 months
	private async migrateExistingConfigs(): Promise<void> {
		await this.migrateConfig(ConfigKey.Deprecated.CustomOAIModels, CustomOAIBYOKModelProvider.providerName, CustomOAIBYOKModelProvider.providerName);
	}

	protected resolveUrl(modelId: string, url: string): string {
		return resolveCustomOAIUrl(modelId, url);
	}
}
