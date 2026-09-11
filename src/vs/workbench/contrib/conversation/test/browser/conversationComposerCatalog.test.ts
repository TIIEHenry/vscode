/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { conversationLensDockCatalogProbing, conversationLensDockEngineNotConnected, conversationLensDockNoAgent, conversationLensDockNoModel } from '../../browser/conversationLensDockStrings.js';
import { COMPOSER_AGENT_OPTIONS, composerAgentSelectOptions, composerModelIds, composerModelSelectOptions, composerToolNames } from '../../browser/conversationComposerCatalog.js';
import { loadConnectedComposerCatalogs, refreshComposerCatalogs, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import { updateGateRow, updateSendEnabled, type IConversationLensComposerChromeHost } from '../../browser/conversationLensComposerChrome.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
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

	test('refreshComposerCatalogs keeps last-good synchronously before connected load settles', async () => {
		let releaseSecondLoad: (() => void) | undefined;
		const secondLoadHeld = new Promise<void>(resolve => {
			releaseSecondLoad = resolve;
		});
		let listAgentProfilesCalls = 0;
		let listModelsCalls = 0;
		let listToolsCalls = 0;
		const { host, agentOptions, modelOptions } = createLoadCatalogHost({
			listAgentProfiles: async () => {
				listAgentProfilesCalls++;
				if (listAgentProfilesCalls === 1) {
					return { profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] };
				}
				await secondLoadHeld;
				throw new Error('listAgentProfiles hung then exploded');
			},
			listModels: async () => {
				listModelsCalls++;
				if (listModelsCalls === 1) {
					return { models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] };
				}
				await secondLoadHeld;
				throw new Error('listModels hung then exploded');
			},
			listTools: async () => {
				listToolsCalls++;
				if (listToolsCalls === 1) {
					return { tools: [{ name: 'bash' }] };
				}
				await secondLoadHeld;
				throw new Error('listTools hung then exploded');
			},
		});

		await loadConnectedComposerCatalogs(host, host.composerCatalogGeneration);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);

		refreshComposerCatalogs(host);

		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogModelIds], ['', 'gpt-test']);
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.ok(!agentOptions.every(option => option.text === conversationLensDockNoAgent));
		assert.ok(!modelOptions.every(option => option.text === conversationLensDockNoModel));

		releaseSecondLoad!();
		await loadConnectedComposerCatalogs(host, host.composerCatalogGeneration);
	});

	test('refreshComposerCatalogs first connected pull without last-good still pre-clears', async () => {
		let releaseFirstLoad: (() => void) | undefined;
		const firstLoadHeld = new Promise<void>(resolve => {
			releaseFirstLoad = resolve;
		});
		const { host, agentOptions, modelOptions } = createLoadCatalogHost({
			listAgentProfiles: async () => {
				await firstLoadHeld;
				return { profiles: [{ id: 'coder', name: 'Coder', source: 'user' }] };
			},
			listModels: async () => {
				await firstLoadHeld;
				return { models: [{ id: '1', type: 'chat', enabled: true, level: 1, provider: 'p', modelId: 'gpt-test' }] };
			},
			listTools: async () => {
				await firstLoadHeld;
				return { tools: [{ name: 'bash' }] };
			},
		});

		refreshComposerCatalogs(host);

		assert.deepStrictEqual(agentOptions, [{ text: conversationLensDockNoAgent }]);
		assert.deepStrictEqual(modelOptions, [{ text: conversationLensDockNoModel }]);
		assert.deepStrictEqual([...host.catalogToolNames], []);
		assert.deepStrictEqual([...host.catalogModelIds], ['']);
		assert.ok(!agentOptions.some(option => option.text === 'Coder'));
		assert.ok(!modelOptions.some(option => option.text === 'gpt-test'));

		releaseFirstLoad!();
		await loadConnectedComposerCatalogs(host, host.composerCatalogGeneration);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
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

	test('refreshComposerCatalogs pairing-hold keeps leftover catalogs then true disconnect clears', async () => {
		let connected = true;
		let pairingPending = false;
		let listAgentProfilesCalls = 0;
		let listModelsCalls = 0;
		let listToolsCalls = 0;
		const snapshot = () => ({
			transport: connected ? 'ok' as const : 'idle' as const,
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
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
		}, 'SUPPORTED', {
			isEngineConnected: () => connected && !pairingPending,
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
		});

		await loadConnectedComposerCatalogs(host, host.composerCatalogGeneration);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.strictEqual(host.stubService.isEngineConnected(), true);
		const listsAfterLoad = { listAgentProfilesCalls, listModelsCalls, listToolsCalls };

		pairingPending = true;
		assert.strictEqual(host.stubService.isEngineConnected(), false);
		assert.strictEqual(host.uaConnection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);

		refreshComposerCatalogs(host);

		assert.strictEqual(listAgentProfilesCalls, listsAfterLoad.listAgentProfilesCalls);
		assert.strictEqual(listModelsCalls, listsAfterLoad.listModelsCalls);
		assert.strictEqual(listToolsCalls, listsAfterLoad.listToolsCalls);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogModelIds], ['', 'gpt-test']);
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.ok(!agentOptions.every(option => option.text === conversationLensDockNoAgent));
		assert.ok(!modelOptions.every(option => option.text === conversationLensDockNoModel));

		pairingPending = false;
		connected = false;
		refreshComposerCatalogs(host);

		assert.strictEqual(listAgentProfilesCalls, listsAfterLoad.listAgentProfilesCalls);
		assert.strictEqual(listModelsCalls, listsAfterLoad.listModelsCalls);
		assert.strictEqual(listToolsCalls, listsAfterLoad.listToolsCalls);
		assert.deepStrictEqual(agentOptions, COMPOSER_AGENT_OPTIONS.map(text => ({ text })));
		assert.deepStrictEqual(modelOptions, [{ text: conversationLensDockNoModel }]);
		assert.deepStrictEqual([...host.catalogToolNames], []);
		assert.deepStrictEqual([...host.catalogModelIds], ['']);
		assert.strictEqual(host.modelSelectedIndex, 0);
	});

	test('leftover-looks-live pairing-hold keeps leftover catalogs and skips list unaries', async () => {
		let pairingPending = false;
		let listAgentProfilesCalls = 0;
		let listModelsCalls = 0;
		let listToolsCalls = 0;
		const snapshot = () => ({
			transport: 'ok' as const,
			pairingPending,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const { host, agentOptions, modelOptions, gateRow, gateLabel, sendButton } = createLoadCatalogHost({
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
		}, 'SUPPORTED', {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
		});

		await loadConnectedComposerCatalogs(host, host.composerCatalogGeneration);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.strictEqual(host.stubService.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(host.uaConnection), false);
		const listsAfterLoad = { listAgentProfilesCalls, listModelsCalls, listToolsCalls };

		pairingPending = true;
		assert.strictEqual(host.stubService.isEngineConnected(), true);
		assert.strictEqual(host.uaConnection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(host.uaConnection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(host.uaConnection), true);

		refreshComposerCatalogs(host);

		assert.strictEqual(listAgentProfilesCalls, listsAfterLoad.listAgentProfilesCalls, 'leftover-looks-live must not extra listAgentProfiles');
		assert.strictEqual(listModelsCalls, listsAfterLoad.listModelsCalls, 'leftover-looks-live must not extra listModels');
		assert.strictEqual(listToolsCalls, listsAfterLoad.listToolsCalls, 'leftover-looks-live must not extra listTools');
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogModelIds], ['', 'gpt-test']);
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.ok(!agentOptions.every(option => option.text === conversationLensDockNoAgent));
		assert.ok(!modelOptions.every(option => option.text === conversationLensDockNoModel));
		assert.strictEqual(gateRow.hidden, false, 'leftover-looks-live gate stays disconnected');
		assert.strictEqual(gateLabel.textContent, conversationLensDockEngineNotConnected);
		assert.strictEqual(sendButton.enabled, false, 'Send stays pairing-hold-first');

		pairingPending = false;
		assert.strictEqual(isConversationPairingHold(host.uaConnection), false);
		refreshComposerCatalogs(host);
		for (let i = 0; i < 4; i++) {
			await Promise.resolve();
		}

		assert.ok(listAgentProfilesCalls > listsAfterLoad.listAgentProfilesCalls, 'connected leftover must still refresh');
		assert.ok(listModelsCalls > listsAfterLoad.listModelsCalls);
		assert.ok(listToolsCalls > listsAfterLoad.listToolsCalls);
		assert.ok(agentOptions.some(option => option.text === 'Coder'));
		assert.ok(modelOptions.some(option => option.text === 'gpt-test'));
		assert.deepStrictEqual([...host.catalogToolNames], ['bash']);
		assert.strictEqual(gateRow.hidden, true);
		assert.strictEqual(sendButton.enabled, true);
	});

	test('leftover-looks-live first-pull pairing without leftover stays empty and skips lists', () => {
		let listCalls = 0;
		const { host, agentOptions, modelOptions, gateRow, gateLabel, sendButton } = createLoadCatalogHost({
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
		}, 'SUPPORTED', {
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending: true,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: createEmptyTestCapabilitySnapshot(),
			}),
		});

		assert.strictEqual(host.stubService.isEngineConnected(), true);
		assert.strictEqual(isConversationPairingHold(host.uaConnection), true);
		refreshComposerCatalogs(host);

		assert.strictEqual(listCalls, 0);
		assert.deepStrictEqual(agentOptions, COMPOSER_AGENT_OPTIONS.map(text => ({ text })));
		assert.deepStrictEqual(modelOptions, [{ text: conversationLensDockNoModel }]);
		assert.deepStrictEqual([...host.catalogToolNames], []);
		assert.deepStrictEqual([...host.catalogModelIds], ['']);
		assert.ok(!agentOptions.some(option => option.text === 'Coder'));
		assert.ok(!modelOptions.some(option => option.text === 'gpt-test'));
		assert.strictEqual(gateRow.hidden, false);
		assert.strictEqual(gateLabel.textContent, conversationLensDockEngineNotConnected);
		assert.strictEqual(sendButton.enabled, false);
	});

	test('refreshComposerCatalogs pairing-hold without last-good still resets empty', () => {
		let pairingPending = true;
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
		}, 'SUPPORTED', {
			isEngineConnected: () => !pairingPending,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: createEmptyTestCapabilitySnapshot(),
			}),
		});

		refreshComposerCatalogs(host);

		assert.strictEqual(listCalls, 0);
		assert.deepStrictEqual(agentOptions, COMPOSER_AGENT_OPTIONS.map(text => ({ text })));
		assert.deepStrictEqual(modelOptions, [{ text: conversationLensDockNoModel }]);
		assert.deepStrictEqual([...host.catalogToolNames], []);
		assert.deepStrictEqual([...host.catalogModelIds], ['']);
		assert.ok(!agentOptions.some(option => option.text === 'Coder'));
		assert.ok(!modelOptions.some(option => option.text === 'gpt-test'));
	});
});

function createLoadCatalogHost(
	hooks: Pick<IUniverseAgentConnection, 'listAgentProfiles' | 'listModels' | 'listTools'>,
	support: 'SUPPORTED' | 'UNKNOWN' | (() => 'SUPPORTED' | 'UNKNOWN') = 'SUPPORTED',
	engine?: {
		isEngineConnected?: () => boolean;
		getConnectionPhase?: IUniverseAgentConnection['getConnectionPhase'];
		getConnectionSnapshot?: IUniverseAgentConnection['getConnectionSnapshot'];
	},
): {
	host: IConversationLensComposerHost;
	agentOptions: { text: string }[];
	modelOptions: { text: string }[];
	gateRow: { hidden: boolean };
	gateLabel: { textContent: string };
	sendButton: { enabled: boolean };
} {
	const capabilities = createEmptyTestCapabilitySnapshot();
	const agentOptions: { text: string }[] = [{ text: conversationLensDockNoAgent }];
	const modelOptions: { text: string }[] = [{ text: conversationLensDockNoModel }];
	const gateRow = {
		hidden: true,
		setAttribute() { },
		removeAttribute() { },
	};
	const gateLabel = { textContent: '' };
	const sendButton = { enabled: true };
	const host = {
		composerCatalogGeneration: 1,
		catalogToolNames: [] as string[],
		catalogModelIds: [''] as string[],
		modelSelectedIndex: 0,
		composerPolicy: 'compose' as const,
		postFailureVisible: false,
		dockTextarea: { value: 'draft' },
		sendButton,
		gateRow,
		gateLabel,
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
		stubService: { isEngineConnected: engine?.isEngineConnected ?? (() => true) },
		updateSendEnabled() {
			updateSendEnabled(this as unknown as IConversationLensComposerChromeHost);
		},
		updateGateRow() {
			updateGateRow(this as unknown as IConversationLensComposerChromeHost);
		},
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
			...(engine?.getConnectionPhase ? { getConnectionPhase: engine.getConnectionPhase } : {}),
			...(engine?.getConnectionSnapshot ? { getConnectionSnapshot: engine.getConnectionSnapshot } : {}),
		}),
	} as unknown as IConversationLensComposerHost;
	return { host, agentOptions, modelOptions, gateRow, gateLabel, sendButton };
}
