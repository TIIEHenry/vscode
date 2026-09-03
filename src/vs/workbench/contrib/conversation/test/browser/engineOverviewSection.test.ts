/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { UniverseAgentModelEntry } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	EngineOverviewSection,
	formatOverviewModelFailedCopy,
	formatOverviewModelSummary,
	formatOverviewModelUnknownCopy,
	formatOverviewModelUnsupportedCopy,
} from '../../browser/engineOverviewSection.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

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
		assert.ok(text.includes('Unavailable — this client has no provider API yet.'), text);
		assert.ok(!/\d/.test(text.split('Provider')[1]?.split('Model')[0] ?? ''), text);
		assert.ok(!text.includes('openai'), text);
		assert.ok(!text.includes('anthropic'), text);
		const modelValue = section.getDomNode().querySelector('.engine-overview-row:nth-child(5) .engine-overview-value') as HTMLElement | null;
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
		assert.ok(text.includes('Unavailable — this client has no provider API yet.'), text);
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
		assert.ok(text.includes('Unavailable — this client has no provider API yet.'), text);
		assert.ok(!text.includes('openai'), text);
		assert.ok(!text.includes('anthropic'), text);
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
});
