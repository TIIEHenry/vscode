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
	formatOverviewModelSummary,
	formatOverviewProviderSummary,
	formatOverviewRegistryUnavailable,
} from '../../browser/engineOverviewSection.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('EngineOverviewSection', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const models: UniverseAgentModelEntry[] = [
		{ id: 'a', type: 'chat', enabled: true, level: 1, provider: 'openai', modelId: 'gpt' },
		{ id: 'b', type: 'chat', enabled: true, level: 1, provider: 'openai', modelId: 'o1' },
		{ id: 'c', type: 'chat', enabled: false, level: 1, provider: 'anthropic', modelId: 'sonnet' },
	];

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
			listModels: async () => ({ models }),
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		const section = store.add(instantiationService.createInstance(EngineOverviewSection, parent));
		section.setSectionActive(true);
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		const text = section.getDomNode().textContent ?? '';
		assert.ok(text.includes('3 个模型'), text);
		assert.ok(text.includes('来自模型注册表的 2 个 provider（不代表已配凭据）'), text);
		parent.remove();
	});
});
