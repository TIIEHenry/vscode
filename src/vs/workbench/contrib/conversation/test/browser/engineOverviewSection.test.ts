/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentModelEntry } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	EngineOverviewSection,
	formatOverviewCapabilitySupportLabel,
	formatOverviewModelFailedCopy,
	formatOverviewModelSummary,
	formatOverviewModelUnknownCopy,
	formatOverviewModelUnsupportedCopy,
	formatOverviewProviderSummary,
	formatOverviewRegistryUnavailable,
} from '../../browser/engineOverviewSection.js';
import { formatCapabilitySupportLabel } from '../../browser/engineSectionChrome.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

function overviewRowValue(root: HTMLElement, label: string): HTMLElement | null {
	for (const row of root.querySelectorAll('.engine-overview-row')) {
		if (row.querySelector('.engine-overview-label')?.textContent === label) {
			return row.querySelector('.engine-overview-value') as HTMLElement | null;
		}
	}
	return null;
}

function assertProviderRowOmitted(text: string, root: HTMLElement): void {
	assert.strictEqual(overviewRowValue(root, 'Provider'), null, text);
	assert.ok(!text.includes('Unavailable — this client has no provider API yet.'), text);
	assert.ok(!text.includes('openai'), text);
	assert.ok(!text.includes('anthropic'), text);
}

type OverviewModelsSupport = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

function flushOverview(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

suite('EngineOverviewSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const models: UniverseAgentModelEntry[] = [
		{ id: 'a', type: 'chat', enabled: true, level: 1, provider: 'openai', modelId: 'gpt' },
		{ id: 'b', type: 'chat', enabled: true, level: 1, provider: 'openai', modelId: 'o1' },
		{ id: 'c', type: 'chat', enabled: false, level: 1, provider: 'anthropic', modelId: 'sonnet' },
	];

	test('model summary formatters cover three capability states', () => {
		assert.strictEqual(formatOverviewModelUnsupportedCopy(), 'Unavailable — this client has no model profile API yet.');
		assert.strictEqual(formatOverviewModelUnknownCopy(), '正在确认引擎能力…');
		assert.strictEqual(formatOverviewModelSummary(3), '3 models');
		assert.strictEqual(formatOverviewModelSummary(0), 'No models in the registry.');
		assert.strictEqual(formatOverviewModelFailedCopy('timeout'), '读取失败 — timeout');
	});

	test('UNSUPPORTED models capability keeps HEAD unavailable copy with reason title', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				sessionToken: 'tok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: { ...capabilities, models: { support: 'UNSUPPORTED', reason: 'no registry RPC' } },
			}),
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes('Unavailable — this client has no model profile API yet.'), text);
		assertProviderRowOmitted(text, section.getDomNode());
		const modelValue = overviewRowValue(section.getDomNode(), 'Model');
		assert.strictEqual(modelValue?.title, 'no registry RPC');
		parent.remove();
	});

	test('UNKNOWN models capability shows confirming copy', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				sessionToken: 'tok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: { ...capabilities, models: { support: 'UNKNOWN' } },
			}),
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes('正在确认引擎能力…'), text);
		assertProviderRowOmitted(text, section.getDomNode());
		parent.remove();
	});

	test('SUPPORTED models capability lists registry count once', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		let listModelsCalls = 0;
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				sessionToken: 'tok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: { ...capabilities, models: { support: 'SUPPORTED' } },
			}),
			listModels: async () => {
				listModelsCalls++;
				return { models };
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		section.setSectionActive(false);
		section.setSectionActive(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const text = section.getDomNode().textContent ?? '';
		assert.strictEqual(listModelsCalls, 1);
		assert.ok(text.includes('3 models'), text);
		assertProviderRowOmitted(text, section.getDomNode());
		parent.remove();
	});

	test('registry summaries count models and distinct providers', () => {
		assert.strictEqual(formatOverviewModelSummary(models), '3 个模型');
		assert.strictEqual(formatOverviewProviderSummary(models), '来自模型注册表的 2 个 provider（不代表已配凭据）');
		assert.strictEqual(formatOverviewRegistryUnavailable('UNSUPPORTED'), 'Unavailable — engine has no model registry.');
		assert.strictEqual(formatOverviewRegistryUnavailable('UNKNOWN'), 'Unknown — model registry capability not advertised.');
	});

	test('SUPPORTED models capability lists registry counts', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				sessionToken: 'tok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: { ...capabilities, models: { support: 'SUPPORTED' } },
			}),
			listModels: async () => {
				throw new Error('transport reset');
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes('读取失败 — transport reset'), text);
		parent.remove();
	});

	test('capability SUPPORTED without list evidence is not Supported', () => {
		assert.strictEqual(formatOverviewCapabilitySupportLabel('skills', 'SUPPORTED'), formatCapabilitySupportLabel('UNKNOWN'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('agentProfiles', 'SUPPORTED'), formatCapabilitySupportLabel('UNKNOWN'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('tools', 'SUPPORTED'), formatCapabilitySupportLabel('UNKNOWN'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('mcp', 'SUPPORTED'), formatCapabilitySupportLabel('UNKNOWN'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('plugins', 'SUPPORTED'), formatCapabilitySupportLabel('UNKNOWN'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('skills', 'SUPPORTED', true), formatCapabilitySupportLabel('SUPPORTED'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('skills', 'UNSUPPORTED'), formatCapabilitySupportLabel('UNSUPPORTED'));
	});

	test('Rules/Hooks capability SUPPORTED folds to Unsupported without list API', () => {
		assert.strictEqual(formatOverviewCapabilitySupportLabel('globalRules', 'SUPPORTED'), formatCapabilitySupportLabel('UNSUPPORTED'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('projectRules', 'SUPPORTED'), formatCapabilitySupportLabel('UNSUPPORTED'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('hooksMetadata', 'SUPPORTED'), formatCapabilitySupportLabel('UNSUPPORTED'));
		assert.strictEqual(formatOverviewCapabilitySupportLabel('globalRules', 'UNKNOWN'), formatCapabilitySupportLabel('UNKNOWN'));
	});

	test('Overview does not paint Supported from capability-only SUPPORTED', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				sessionToken: 'tok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: {
					...capabilities,
					skills: { support: 'SUPPORTED' },
					agentProfiles: { support: 'SUPPORTED' },
					tools: { support: 'SUPPORTED' },
					mcp: { support: 'SUPPORTED' },
					plugins: { support: 'SUPPORTED' },
					globalRules: { support: 'SUPPORTED' },
					projectRules: { support: 'SUPPORTED' },
					hooksMetadata: { support: 'SUPPORTED' },
				},
			}),
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const supports = [...section.getDomNode().querySelectorAll('.engine-overview-capability-support')].map(el => el.textContent);
		assert.ok(supports.length > 0);
		assert.ok(!supports.includes(formatCapabilitySupportLabel('SUPPORTED')), supports.join(','));
		assert.ok(supports.includes(formatCapabilitySupportLabel('UNSUPPORTED')), supports.join(','));
		parent.remove();
	});

	test('SUPPORTED listModels failure shows read failure copy', async () => {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				sessionToken: 'tok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: { ...capabilities, models: { support: 'SUPPORTED' } },
			}),
			listModels: async () => {
				throw new Error('transport reset');
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes('读取失败 — transport reset'), text);
		parent.remove();
	});

	function createMutableOverviewConnection(options: {
		modelsSupport: OverviewModelsSupport;
		listModels?: () => Promise<{ models: UniverseAgentModelEntry[] }>;
	}): IUniverseAgentConnection & {
		setModelsSupport(support: OverviewModelsSupport): void;
		setListModels(impl: () => Promise<{ models: UniverseAgentModelEntry[] }>): void;
		fireConnection(): void;
	} {
		const capabilities = createEmptyTestCapabilitySnapshot();
		const modelsCapability: { support: OverviewModelsSupport } = { support: options.modelsSupport };
		let listModelsImpl = options.listModels;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			sessionToken: 'tok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: { ...capabilities, models: modelsCapability },
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listModels: async () => {
				if (!listModelsImpl) {
					return { models: [] };
				}
				return listModelsImpl();
			},
		});
		return Object.assign(connection, {
			setModelsSupport(support: OverviewModelsSupport) {
				modelsCapability.support = support;
				onDidChangeConnection.fire(snapshot());
			},
			setListModels(impl: () => Promise<{ models: UniverseAgentModelEntry[] }>) {
				listModelsImpl = impl;
			},
			fireConnection() {
				onDidChangeConnection.fire(snapshot());
			},
		});
	}

	test('successful listModels then capability UNKNOWN keeps last model count', async () => {
		let listModelsCalls = 0;
		const connection = createMutableOverviewConnection({
			modelsSupport: 'SUPPORTED',
			listModels: async () => {
				listModelsCalls++;
				return { models };
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await flushOverview();

		const summary = formatOverviewModelSummary(models.length);
		let modelValue = overviewRowValue(section.getDomNode(), 'Model');
		assert.strictEqual(modelValue?.textContent, summary);
		assert.strictEqual(listModelsCalls, 1);

		connection.setModelsSupport('UNKNOWN');
		await flushOverview();

		modelValue = overviewRowValue(section.getDomNode(), 'Model');
		const text = section.getDomNode().textContent ?? '';
		assert.strictEqual(modelValue?.textContent, summary);
		assert.ok(text.includes(summary), text);
		assert.notStrictEqual(modelValue?.textContent, formatOverviewModelUnknownCopy());
		assert.ok(modelValue?.textContent !== formatOverviewModelUnknownCopy());
		assert.ok(!(modelValue?.textContent ?? '').includes(formatOverviewModelUnknownCopy()));
		assert.strictEqual(modelValue?.title, formatOverviewModelUnknownCopy());
		assert.strictEqual(listModelsCalls, 1);
		parent.remove();
	});

	test('successful listModels then listModels throw keeps last model count and failed honesty', async () => {
		let listModelsCalls = 0;
		const connection = createMutableOverviewConnection({
			modelsSupport: 'SUPPORTED',
			listModels: async () => {
				listModelsCalls++;
				return { models };
			},
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await flushOverview();

		const summary = formatOverviewModelSummary(models.length);
		assert.strictEqual(overviewRowValue(section.getDomNode(), 'Model')?.textContent, summary);
		assert.strictEqual(listModelsCalls, 1);

		connection.setListModels(async () => {
			listModelsCalls++;
			throw new Error('transport reset');
		});
		connection.fireConnection();
		await flushOverview();

		const modelValue = overviewRowValue(section.getDomNode(), 'Model');
		const failed = formatOverviewModelFailedCopy('transport reset');
		const text = section.getDomNode().textContent ?? '';
		assert.strictEqual(modelValue?.textContent, summary);
		assert.ok(text.includes(summary), text);
		assert.notStrictEqual(modelValue?.textContent, failed);
		assert.ok(!(modelValue?.textContent ?? '').includes(failed));
		assert.strictEqual(modelValue?.title, failed);
		assert.ok(!text.includes('No models in the registry.'), text);
		assert.strictEqual(listModelsCalls, 2);
		parent.remove();
	});
});
