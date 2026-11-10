/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConfigKey } from '../../../../platform/configuration/common/configurationService';
import type { IStringDictionary } from '../../../../util/vs/base/common/collections';
import { describe, expect, it, vi } from 'vitest';
import type { LanguageModelChatConfiguration } from '../abstractLanguageModelChatProvider';
import { AbstractCustomOAIBYOKModelProvider, customOAIProviderGroupName } from '../customOAIProvider';

class TestCustomOAIProvider extends AbstractCustomOAIBYOKModelProvider {
	readonly migrations: { name: string; configuration: LanguageModelChatConfiguration }[] = [];
	private readonly existingGroups = new Set<string>();
	failGroup: string | undefined;

	constructor(storage: any, configurationService: any, extensionContext: any, logService: any) {
		super('test-custom-oai', 'CustomOAI', storage, logService, {} as any, { createInstance: () => ({}) } as any, configurationService, {} as any, extensionContext);
	}

	async migrateLegacy(config: IStringDictionary<unknown>): Promise<void> {
		await this.migrateConfig(config as any, 'CustomOAI', 'CustomOAI');
	}

	protected override async configureDefaultGroupIfExists(name: string, configuration: LanguageModelChatConfiguration): Promise<void> {
		this.migrations.push({ name, configuration });
		if (name === this.failGroup) {
			throw new Error('temporary migration failure');
		}
		if (this.existingGroups.has(name)) {
			throw new Error(`Language model group with name ${name} already exists for vendor ${this._id}`);
		}
		this.existingGroups.add(name);
	}

	protected override resolveUrl(_modelId: string, url: string): string {
		return url;
	}
}

function createProvider(modelKeys: Record<string, string>) {
	let migrated = false;
	const globalState = {
		get: vi.fn(() => migrated),
		update: vi.fn(async () => { migrated = true; }),
	};
	const provider = new TestCustomOAIProvider(
		{
			getAPIKey: vi.fn(async (_provider: string, modelId: string) => modelKeys[modelId]),
			storeAPIKey: vi.fn(),
			deleteAPIKey: vi.fn(),
			getStoredModelConfigs: vi.fn(),
			saveModelConfig: vi.fn(),
			removeModelConfig: vi.fn(),
			isLegacyApiKeyMigrated: vi.fn(() => false),
			markLegacyApiKeyMigrated: vi.fn(),
		},
		{ getConfig: vi.fn(() => ({
			modelA: { name: 'A', url: 'https://a.example', maxOutputTokens: 1, toolCalling: false, vision: false },
			modelB: { name: 'B', url: 'https://b.example', maxOutputTokens: 1, toolCalling: false, vision: false },
		})) },
		{ globalState },
		{ error: vi.fn(), info: vi.fn() },
	);
	return { provider, globalState };
}

describe('Custom OAI legacy migration', () => {
	it('keeps the first group name and adds stable non-secret suffixes', () => {
		expect([0, 1, 2].map(index => customOAIProviderGroupName('CustomOAI', index))).toEqual([
			'CustomOAI',
			'CustomOAI (2)',
			'CustomOAI (3)',
		]);
		expect(customOAIProviderGroupName('CustomOAI', 1)).not.toContain('api-key');
	});

	it('continues buckets after a transient failure and completes after retrying only the missing bucket', async () => {
		const { provider, globalState } = createProvider({ modelA: 'key-a', modelB: 'key-b' });
		provider.failGroup = 'CustomOAI (2)';
		const config = ConfigKey.Deprecated.CustomOAIModels as unknown as IStringDictionary<unknown>;

		await provider.migrateLegacy(config);
		expect(provider.migrations.map(({ name }) => name)).toEqual(['CustomOAI', 'CustomOAI (2)']);
		expect(globalState.update).not.toHaveBeenCalled();

		provider.failGroup = undefined;
		await provider.migrateLegacy(config);
		expect(provider.migrations.map(({ name }) => name)).toEqual(['CustomOAI', 'CustomOAI (2)', 'CustomOAI', 'CustomOAI (2)']);
		expect(globalState.update).toHaveBeenCalledTimes(1);
	});
});
