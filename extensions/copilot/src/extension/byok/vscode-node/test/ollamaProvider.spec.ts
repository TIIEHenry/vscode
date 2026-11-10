/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { ConfigKey, ConfigTarget } from '../../../../platform/configuration/common/configurationService';
import { OllamaConfig, OllamaLMProvider } from '../ollamaProvider';

class RejectingMigrationOllamaProvider extends OllamaLMProvider {
	protected override async configureDefaultGroupIfExists(_name: string, _configuration: { readonly url: string }): Promise<void> {
		throw new Error('migration unavailable');
	}
}

describe('OllamaLMProvider', () => {
	it('returns successful models when one /api/show lookup fails', async () => {
		const ollamaBaseUrl = 'http://localhost:11434';
		const tagsModels = [{ model: 'good-model-a' }, { model: 'bad-model' }, { model: 'good-model-b' }];
		const showCalls: string[] = [];

		const fetch = vi.fn(async (url: string, options: { body?: string }) => {
			if (url === `${ollamaBaseUrl}/api/version`) {
				return { json: async () => ({ version: '0.6.4' }) };
			}
			if (url === `${ollamaBaseUrl}/api/tags`) {
				return { json: async () => ({ models: tagsModels }) };
			}
			if (url === `${ollamaBaseUrl}/api/show`) {
				const modelId = JSON.parse(options.body ?? '{}').model as string;
				showCalls.push(modelId);
				if (modelId === 'bad-model') {
					throw new Error('simulated /api/show failure');
				}
				return {
					json: async () => ({
						template: '',
						capabilities: [],
						details: { family: 'llama' },
						remote_model: modelId,
						model_info: {
							'general.basename': modelId,
							'general.architecture': 'llama',
							'llama.context_length': 8192,
						},
					})
				};
			}
			throw new Error(`Unexpected URL in test: ${url}`);
		});

		const logService = {
			_serviceBrand: undefined,
			trace: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			show: vi.fn(),
			createSubLogger: vi.fn(),
			withExtraTarget: vi.fn(),
		};
		logService.createSubLogger.mockReturnValue(logService);
		logService.withExtraTarget.mockReturnValue(logService);

		const provider = new OllamaLMProvider(
			{
				getAPIKey: vi.fn().mockResolvedValue(undefined),
				storeAPIKey: vi.fn().mockResolvedValue(undefined),
				deleteAPIKey: vi.fn().mockResolvedValue(undefined),
				getStoredModelConfigs: vi.fn().mockResolvedValue({}),
				saveModelConfig: vi.fn().mockResolvedValue(undefined),
				removeModelConfig: vi.fn().mockResolvedValue(undefined),
			} as any,
			{ fetch } as any,
			{
				isConfigured: vi.fn().mockReturnValue(false),
				inspectConfig: vi.fn(),
				getConfig: vi.fn(),
				setConfig: vi.fn(),
			} as any,
			logService as any,
			{
				createInstance: vi.fn().mockReturnValue({}),
			} as any,
			{} as any,
			{ globalState: { get: vi.fn(), update: vi.fn() } } as any,
		);

		const tokenSource = new vscode.CancellationTokenSource();
		const models = await provider.provideLanguageModelChatInformation(
			{
				silent: false,
				configuration: { url: ollamaBaseUrl },
			},
			tokenSource.token
		);

		expect(showCalls).toEqual(['good-model-a', 'bad-model', 'good-model-b']);
		expect(models.map(model => model.id)).toEqual(['good-model-a', 'good-model-b']);
	});

	it('logs legacy endpoint migration failures instead of leaking an unhandled rejection', async () => {
		const logService = {
			_serviceBrand: undefined,
			trace: vi.fn(),
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
			show: vi.fn(),
			createSubLogger: vi.fn(),
			withExtraTarget: vi.fn(),
		};
		logService.createSubLogger.mockReturnValue(logService);
		logService.withExtraTarget.mockReturnValue(logService);

		new RejectingMigrationOllamaProvider(
			{ getAPIKey: vi.fn().mockResolvedValue(undefined) } as any,
			{ fetch: vi.fn() } as any,
			{
				isConfigured: vi.fn().mockReturnValue(true),
				getConfig: vi.fn().mockReturnValue('http://localhost:11434'),
				inspectConfig: vi.fn().mockReturnValue({ globalValue: 'http://localhost:11434' }),
				setConfig: vi.fn(),
			} as any,
			logService as any,
			{ createInstance: vi.fn().mockReturnValue({}) } as any,
			{} as any,
			{ globalState: { get: vi.fn(), update: vi.fn() } } as any,
		);
		await new Promise(resolve => setTimeout(resolve, 0));

		expect(logService.error).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining('legacy Ollama endpoint'));
	});
});

describe('Ollama legacy endpoint cleanup recovery', () => {
	const cleanupKey = 'copilot-byok-migration-Ollama-endpoint-cleanup-v1';
	const originalURL = 'http://localhost:11434';
	let previousWorkspace: unknown;

	function setWorkspace(file: string | undefined, folders: string[] = []): void {
		(vscode as { workspace: unknown }).workspace = {
			workspaceFile: file ? vscode.Uri.parse(file) : undefined,
			workspaceFolders: folders.map((uri, index) => ({ uri: vscode.Uri.parse(uri), name: `folder-${index}`, index })),
		};
	}

	beforeEach(() => {
		previousWorkspace = (vscode as { workspace?: unknown }).workspace;
		setWorkspace(undefined);
	});

	afterEach(() => {
		(vscode as { workspace: unknown }).workspace = previousWorkspace;
	});

	function checkpoint(overrides: Record<string, unknown> = {}) {
		return Object.freeze({
			schemaVersion: 1, provider: 'ollama', group: 'Ollama', id: 'original-claim',
			sourceURI: 'profile-local', target: ConfigTarget.Global, url: originalURL,
			...overrides,
		});
	}

	function fixture(target = ConfigTarget.Global) {
		const values: Partial<Record<ConfigTarget, string>> = { [target]: originalURL };
		const stored = new Map<string, unknown>();
		const globalState = {
			get: vi.fn((key: string) => stored.get(key)),
			update: vi.fn(async (key: string, value: unknown) => {
				if (value === undefined) {
					stored.delete(key);
				} else {
					stored.set(key, Object.freeze({ ...value as object }));
				}
			}),
			setKeysForSync: vi.fn(),
		};
		const configurationService = {
			inspectConfig: vi.fn(() => ({
				globalValue: values[ConfigTarget.Global],
				workspaceValue: values[ConfigTarget.Workspace],
				workspaceFolderValue: values[ConfigTarget.WorkspaceFolder],
			})),
			setConfig: vi.fn(async (_key: unknown, _value: undefined, sourceTarget: ConfigTarget) => {
				delete values[sourceTarget];
			}),
		};
		const logService = { error: vi.fn(), info: vi.fn() };
		const result = { group: undefined as OllamaConfig | undefined };
		const migrateGroup = vi.fn(async (_name: string, configuration: OllamaConfig) => {
			if (result.group) {
				throw new Error('Language model group with name Ollama already exists for vendor ollama');
			}
			result.group = { ...configuration };
		});
		class MigrationProvider extends OllamaLMProvider {
			protected override async configureDefaultGroupIfExists(name: string, configuration: OllamaConfig): Promise<void> {
				await migrateGroup(name, configuration);
			}
		}
		async function activate(): Promise<void> {
			new MigrationProvider(
				{ getAPIKey: vi.fn().mockResolvedValue(undefined) } as any,
				{} as any,
				configurationService as any,
				logService as any,
				{ createInstance: vi.fn().mockReturnValue({}) } as any,
				{} as any,
				{ globalState } as any,
			);
			await new Promise(resolve => setTimeout(resolve, 0));
		}
		return { values, stored, globalState, configurationService, logService, result, migrateGroup, activate };
	}

	it('retries cleanup after one failure without recreating or overwriting the migrated group', async () => {
		const test = fixture();
		const failure = new Error('settings temporarily unavailable');
		test.configurationService.setConfig.mockRejectedValueOnce(failure);
		await test.activate();

		expect(test.values[ConfigTarget.Global]).toBe(originalURL);
		expect(test.stored.get(cleanupKey)).toMatchObject(checkpoint({ id: expect.any(String) }));
		expect(test.logService.error).toHaveBeenCalledWith(failure, expect.stringContaining('legacy Ollama endpoint'));
		test.result.group!.url = 'http://user-edited-group:11434';
		await test.activate();

		expect(test.migrateGroup).toHaveBeenCalledTimes(1);
		expect(test.result.group?.url).toBe('http://user-edited-group:11434');
		expect(test.configurationService.setConfig).toHaveBeenCalledTimes(2);
		expect(test.configurationService.setConfig).toHaveBeenLastCalledWith(ConfigKey.Deprecated.OllamaEndpoint, undefined, ConfigTarget.Global);
		expect(test.values[ConfigTarget.Global]).toBeUndefined();
		expect(test.stored.has(cleanupKey)).toBe(false);
		expect(test.globalState.setKeysForSync).not.toHaveBeenCalled();
	});

	it.each([ConfigTarget.Workspace, ConfigTarget.WorkspaceFolder])('clears only the migrated %s scope and preserves a different global endpoint', async target => {
		setWorkspace('file:///workspace-a.code-workspace', ['file:///folder-a']);
		const test = fixture(target);
		test.values[ConfigTarget.Global] = 'http://unmigrated-global:11434';
		await test.activate();

		expect(test.migrateGroup).toHaveBeenCalledWith('Ollama', { url: originalURL });
		expect(test.configurationService.setConfig).toHaveBeenCalledWith(ConfigKey.Deprecated.OllamaEndpoint, undefined, target);
		expect(test.values[target]).toBeUndefined();
		expect(test.values[ConfigTarget.Global]).toBe('http://unmigrated-global:11434');
	});

	it('does not consume a workspace A checkpoint in workspace B with the same URL', async () => {
		const test = fixture(ConfigTarget.Workspace);
		const original = checkpoint({ target: ConfigTarget.Workspace, sourceURI: 'file:///workspace-a.code-workspace' });
		test.stored.set(cleanupKey, original);
		setWorkspace('file:///workspace-b.code-workspace');
		await test.activate();

		expect(test.migrateGroup).not.toHaveBeenCalled();
		expect(test.configurationService.setConfig).not.toHaveBeenCalled();
		expect(test.globalState.update).not.toHaveBeenCalled();
		expect(test.stored.get(cleanupKey)).toBe(original);
		expect(test.values[ConfigTarget.Workspace]).toBe(originalURL);
	});

	it('keeps an ambiguous workspace-folder source in a multi-root window', async () => {
		setWorkspace('file:///multi.code-workspace', ['file:///folder-a', 'file:///folder-b']);
		const test = fixture(ConfigTarget.WorkspaceFolder);
		await test.activate();

		expect(test.migrateGroup).not.toHaveBeenCalled();
		expect(test.configurationService.setConfig).not.toHaveBeenCalled();
		expect(test.values[ConfigTarget.WorkspaceFolder]).toBe(originalURL);
		expect(test.logService.info).toHaveBeenCalledWith(expect.stringContaining('source cannot be identified'));
	});

	it.each(['url', 'workspace'] as const)('rechecks the %s after persisting the checkpoint', async change => {
		setWorkspace('file:///workspace-a.code-workspace');
		const test = fixture(ConfigTarget.Workspace);
		test.globalState.update.mockImplementationOnce(async (key, value) => {
			test.stored.set(key, Object.freeze({ ...value as object }));
			if (change === 'url') {
				test.values[ConfigTarget.Workspace] = 'http://new-user-endpoint:11434';
			} else {
				setWorkspace('file:///workspace-b.code-workspace');
			}
		});
		await test.activate();

		expect(test.migrateGroup).toHaveBeenCalledTimes(1);
		expect(test.configurationService.setConfig).not.toHaveBeenCalled();
		expect(test.stored.get(cleanupKey)).toMatchObject({ sourceURI: 'file:///workspace-a.code-workspace', url: originalURL });
		expect(test.values[ConfigTarget.Workspace]).toBe(change === 'url' ? 'http://new-user-endpoint:11434' : originalURL);
	});

	it('keeps a conflicting user group and legacy source when no successful import was recorded', async () => {
		const test = fixture();
		test.result.group = { url: 'http://user-group:11434' };
		await test.activate();

		expect(test.result.group.url).toBe('http://user-group:11434');
		expect(test.configurationService.setConfig).not.toHaveBeenCalled();
		expect(test.globalState.update).not.toHaveBeenCalled();
		expect(test.values[ConfigTarget.Global]).toBe(originalURL);
		expect(test.logService.error).toHaveBeenCalledWith(expect.any(Error), expect.stringContaining('legacy Ollama endpoint'));
	});

	it.each([
		{ schemaVersion: 2 }, { provider: 'other' }, { group: 'Other' }, { id: '' },
		{ target: 'unknown' }, { sourceURI: '' }, { url: '' },
	])('preserves an unrecognized checkpoint %j', async invalid => {
		const test = fixture();
		const original = checkpoint(invalid);
		test.stored.set(cleanupKey, original);
		await test.activate();

		expect(test.migrateGroup).not.toHaveBeenCalled();
		expect(test.configurationService.setConfig).not.toHaveBeenCalled();
		expect(test.globalState.update).not.toHaveBeenCalled();
		expect(test.stored.get(cleanupKey)).toBe(original);
	});

	it('keeps the source when persisting the successful-import checkpoint fails', async () => {
		const test = fixture();
		const failure = new Error('checkpoint storage unavailable');
		test.globalState.update.mockRejectedValueOnce(failure);
		await test.activate();

		expect(test.result.group).toEqual({ url: originalURL });
		expect(test.values[ConfigTarget.Global]).toBe(originalURL);
		expect(test.configurationService.setConfig).not.toHaveBeenCalled();
		expect(test.stored.has(cleanupKey)).toBe(false);
		expect(test.logService.error).toHaveBeenCalledWith(failure, expect.stringContaining('legacy Ollama endpoint'));
	});

	it('retries removing the checkpoint after cleanup succeeded without recreating the group', async () => {
		const test = fixture();
		const original = checkpoint();
		test.stored.set(cleanupKey, original);
		test.globalState.update.mockRejectedValueOnce(new Error('checkpoint cleanup unavailable'));
		await test.activate();
		expect(test.values[ConfigTarget.Global]).toBeUndefined();
		expect(test.stored.get(cleanupKey)).toBe(original);
		await test.activate();

		expect(test.migrateGroup).not.toHaveBeenCalled();
		expect(test.configurationService.setConfig).toHaveBeenCalledTimes(1);
		expect(test.stored.has(cleanupKey)).toBe(false);
	});

	it('does not delete a different claim that appeared while scoped cleanup was pending', async () => {
		const test = fixture();
		test.stored.set(cleanupKey, checkpoint());
		const replacement = checkpoint({ id: 'another-claim' });
		test.configurationService.setConfig.mockImplementationOnce(async (_key, _value, target) => {
			delete test.values[target];
			test.stored.set(cleanupKey, replacement);
		});
		await test.activate();

		expect(test.stored.get(cleanupKey)).toBe(replacement);
		expect(test.globalState.update).not.toHaveBeenCalled();
	});

	it('keeps a changed raw source instead of treating a trimmed URL as the migrated value', async () => {
		const test = fixture();
		const original = checkpoint();
		test.stored.set(cleanupKey, original);
		test.values[ConfigTarget.Global] = `${originalURL} `;
		await test.activate();

		expect(test.configurationService.setConfig).not.toHaveBeenCalled();
		expect(test.globalState.update).not.toHaveBeenCalled();
		expect(test.values[ConfigTarget.Global]).toBe(`${originalURL} `);
	});
});
