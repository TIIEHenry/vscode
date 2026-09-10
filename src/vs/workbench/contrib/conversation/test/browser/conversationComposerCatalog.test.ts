/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { conversationLensDockCatalogProbing, conversationLensDockNoAgent, conversationLensDockNoModel } from '../../browser/conversationLensDockStrings.js';
import { COMPOSER_AGENT_OPTIONS, composerAgentSelectOptions, composerModelIds, composerModelSelectOptions, composerToolNames } from '../../browser/conversationComposerCatalog.js';
import { loadConnectedComposerCatalogs, refreshComposerCatalogs, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('conversationComposerCatalog', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('disconnected Agent options are No agent only', () => {
		assert.deepStrictEqual([...COMPOSER_AGENT_OPTIONS], [conversationLensDockNoAgent]);
		assert.ok(!COMPOSER_AGENT_OPTIONS.some(text => text === 'Stub agent'));
	});

	test('agent options stay honest-empty then use profile names', () => {
		const options = composerAgentSelectOptions([
			{ id: 'coder', name: 'Coder', source: 'user' },
			{ id: 'empty-name', name: '  ', source: 'project' },
		]);
		assert.deepStrictEqual(options, [
			{ text: conversationLensDockNoAgent },
			{ text: 'Coder' },
			{ text: 'empty-name' },
		]);
	});

	test('model options are display-only labels from engine registry', () => {
		const models = [
			{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' },
			{ id: 'fallback', type: 'chat', enabled: false, level: 1, provider: 'p', modelId: '' },
		] as const;
		const options = composerModelSelectOptions(models);
		assert.deepStrictEqual(options, [
			{ text: conversationLensDockNoModel },
			{ text: 'gpt-test' },
			{ text: 'fallback' },
		]);
		assert.deepStrictEqual(composerModelIds(models), ['', 'gpt-test', 'fallback']);
	});

	test('tool names drop blanks', () => {
		assert.deepStrictEqual(composerToolNames([
			{ name: 'bash' },
			{ name: '  ' },
			{ name: 'read' },
		]), ['bash', 'read']);
	});

	test('loadConnectedComposerCatalogs keeps No agent / No model / empty tools when three hooks reject', async () => {
		const { host, agentOptions, modelOptions } = createLoadCatalogHost({
			listAgentProfiles: async () => {
				throw new Error('listAgentProfiles exploded');
			},
			listModels: async () => {
				throw new Error('listModels exploded');
			},
			listTools: async () => {
				throw new Error('listTools exploded');
			},
		});

		await loadConnectedComposerCatalogs(host, 1);

		assert.deepStrictEqual(agentOptions, [{ text: conversationLensDockNoAgent }]);
		assert.deepStrictEqual(modelOptions, [{ text: conversationLensDockNoModel }]);
		assert.deepStrictEqual([...host.catalogToolNames], []);
		assert.deepStrictEqual([...host.catalogModelIds], ['']);
		assert.strictEqual(host.modelSelectedIndex, 0);
		assert.ok(!agentOptions.some(option => option.text === 'Coder'));
		assert.ok(!modelOptions.some(option => option.text === 'gpt-test'));
	});

	test('agent catalog is display labels only and does not invoke SwitchAgent', async () => {
		const switchCalls: unknown[] = [];
		const { host, agentOptions } = createLoadCatalogHost({
			listAgentProfiles: async () => ({ profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] }),
			listModels: async () => ({ models: [] }),
			listTools: async () => ({ tools: [] }),
		});
		(host.uaConnection as { switchAgent?: unknown }).switchAgent = async () => {
			switchCalls.push('switchAgent');
		};
		await loadConnectedComposerCatalogs(host, 1);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.deepStrictEqual(switchCalls, []);
		assert.strictEqual(host.getSessionConfig('s1').agentIndex, 0);
	});

	test('loadConnectedComposerCatalogs success then SUPPORTED throw keeps last-good catalogs', async () => {
		let listAgentProfilesCalls = 0;
		let listModelsCalls = 0;
		let listToolsCalls = 0;
		const { host, agentOptions, modelOptions } = createLoadCatalogHost({
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				if (listAgentProfilesCalls === 1) {
					return { profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] };
				}
				throw new Error('listAgentProfiles retry exploded');
			},
			listModels: async () => {
				listModelsCalls++;
				if (listModelsCalls === 1) {
					return { models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] };
				}
				throw new Error('listModels retry exploded');
			},
			listTools: async () => {
				listToolsCalls++;
				if (listToolsCalls === 1) {
					return { tools: [{ name: 'bash' }] };
				}
				throw new Error('listTools retry exploded');
			},
		});

		await loadConnectedComposerCatalogs(host, 1);

		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogModelIds], ['', 'gpt-test']);
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		host.modelSelectedIndex = 1;

		await loadConnectedComposerCatalogs(host, 1);

		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogModelIds], ['', 'gpt-test']);
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.ok(!agentOptions.every(option => option.text === conversationLensDockNoAgent));
		assert.ok(!modelOptions.every(option => option.text === conversationLensDockNoModel));
	});

	test('refreshComposerCatalogs pre-clear does not win when SUPPORTED list throws after live catalog', async () => {
		let listAgentProfilesCalls = 0;
		let listModelsCalls = 0;
		let listToolsCalls = 0;
		const { host, agentOptions, modelOptions } = createLoadCatalogHost({
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				if (listAgentProfilesCalls === 1) {
					return { profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] };
				}
				throw new Error('listAgentProfiles retry exploded');
			},
			listModels: async () => {
				listModelsCalls++;
				if (listModelsCalls === 1) {
					return { models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] };
				}
				throw new Error('listModels retry exploded');
			},
			listTools: async () => {
				listToolsCalls++;
				if (listToolsCalls === 1) {
					return { tools: [{ name: 'bash' }] };
				}
				throw new Error('listTools retry exploded');
			},
		});

		await loadConnectedComposerCatalogs(host, host.composerCatalogGeneration);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);

		refreshComposerCatalogs(host);
		await loadConnectedComposerCatalogs(host, host.composerCatalogGeneration);

		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogModelIds], ['', 'gpt-test']);
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.ok(!agentOptions.every(option => option.text === conversationLensDockNoAgent));
		assert.ok(!modelOptions.every(option => option.text === conversationLensDockNoModel));
	});

	test('loadConnectedComposerCatalogs UNKNOWN without last-good paints probing not empty-fail', async () => {
		let listCalls = 0;
		const { host, agentOptions, modelOptions } = createLoadCatalogHost({
			listAgentProfiles: async () => {
				listCalls++;
				return { profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] };
			},
			listModels: async () => {
				listCalls++;
				return { models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] };
			},
			listTools: async () => {
				listCalls++;
				return { tools: [{ name: 'bash' }] };
			},
		}, 'UNKNOWN');

		await loadConnectedComposerCatalogs(host, 1);

		assert.strictEqual(listCalls, 0);
		assert.deepStrictEqual(agentOptions, [{ text: conversationLensDockCatalogProbing }]);
		assert.deepStrictEqual(modelOptions, [{ text: conversationLensDockCatalogProbing }]);
		assert.deepStrictEqual([...host.catalogToolNames], []);
		assert.ok(!agentOptions.some(option => option.text === conversationLensDockNoAgent));
		assert.ok(!modelOptions.some(option => option.text === conversationLensDockNoModel));
	});

	test('loadConnectedComposerCatalogs UNKNOWN keeps last successful catalogs', async () => {
		let listAgentProfilesCalls = 0;
		let listModelsCalls = 0;
		let listToolsCalls = 0;
		let support: 'SUPPORTED' | 'UNKNOWN' = 'SUPPORTED';
		const { host, agentOptions, modelOptions } = createLoadCatalogHost({
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				return { profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] };
			},
			listModels: async () => {
				listModelsCalls++;
				return { models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] };
			},
			listTools: async () => {
				listToolsCalls++;
				return { tools: [{ name: 'bash' }] };
			},
		}, () => support);
		await loadConnectedComposerCatalogs(host, 1);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);

		support = 'UNKNOWN';
		host.agentSelectBox.setOptions([{ text: conversationLensDockNoAgent }], 0);
		host.modelSelectBox.setOptions([{ text: conversationLensDockNoModel }], 0);
		host.modelSelectedIndex = 0;
		host.catalogModelIds = [''];
		host.catalogToolNames = [];

		await loadConnectedComposerCatalogs(host, 1);

		assert.strictEqual(listAgentProfilesCalls, 1);
		assert.strictEqual(listModelsCalls, 1);
		assert.strictEqual(listToolsCalls, 1);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogModelIds], ['', 'gpt-test']);
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.ok(!agentOptions.some(option => option.text === conversationLensDockCatalogProbing));
		assert.ok(agentOptions.some(option => option.text === conversationLensDockNoAgent));
	});
});

function createLoadCatalogHost(
	hooks: Pick<IUniverseAgentConnection, 'listAgentProfiles' | 'listModels' | 'listTools'>,
	support: 'SUPPORTED' | 'UNKNOWN' | (() => 'SUPPORTED' | 'UNKNOWN') = 'SUPPORTED',
): {
	host: IConversationLensComposerHost;
	agentOptions: { text: string }[];
	modelOptions: { text: string }[];
} {
	const capabilities = createEmptyTestCapabilitySnapshot();
	const agentOptions: { text: string }[] = [{ text: conversationLensDockNoAgent }];
	const modelOptions: { text: string }[] = [{ text: conversationLensDockNoModel }];
	const host = {
		composerCatalogGeneration: 1,
		catalogToolNames: [] as string[],
		catalogModelIds: [''] as string[],
		modelSelectedIndex: 0,
		agentSelectBox: {
			setOptions(options: { text: string }[]) {
				agentOptions.splice(0, agentOptions.length, ...options);
			},
		},
		modelSelectBox: {
			setOptions(options: { text: string }[]) {
				modelOptions.splice(0, modelOptions.length, ...options);
			},
		},
		getBoundSessionId: () => 's1',
		getSessionConfig: () => ({ agentIndex: 0 }),
		stubService: { isEngineConnected: () => true },
		updateSendEnabled() { },
		updateGateRow() { },
		uaConnection: createConversationConnectionTestStub({
			getCapabilitySnapshot: () => {
				const resolved = typeof support === 'function' ? support() : support;
				return {
					...capabilities,
					agentProfiles: { support: resolved },
					tools: { support: resolved },
					models: { support: resolved },
				};
			},
			listAgentProfiles: hooks.listAgentProfiles,
			listModels: hooks.listModels,
			listTools: hooks.listTools,
		}),
	} as unknown as IConversationLensComposerHost;
	return { host, agentOptions, modelOptions };
}
