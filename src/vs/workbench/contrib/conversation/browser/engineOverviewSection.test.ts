/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentModelEntry } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { EngineOverviewSection, formatOverviewModelSummary } from './engineOverviewSection.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineOverviewSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const models: UniverseAgentModelEntry[] = [
		{ id: 'a', type: 'chat', enabled: true, level: 1, provider: 'openai', modelId: 'gpt' },
		{ id: 'b', type: 'chat', enabled: true, level: 1, provider: 'openai', modelId: 'o1' },
		{ id: 'c', type: 'chat', enabled: false, level: 1, provider: 'anthropic', modelId: 'sonnet' },
	];

	test('late listModels after dispose does not paint model summary', async () => {
		let releaseList: ((value: { models: UniverseAgentModelEntry[] }) => void) | undefined;
		const capabilities = createEmptyTestCapabilitySnapshot();
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: { ...capabilities, models: { support: 'SUPPORTED' } },
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			listModels: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = instantiationService.createInstance(EngineOverviewSection, parent);
		section.setSectionActive(true);
		await timeout(0);

		section.dispose();
		releaseList?.({ models });
		await timeout(0);

		const summary = formatOverviewModelSummary(models.length);
		const text = section.getDomNode().textContent ?? '';
		assert.ok(!text.includes(summary), text);
	});
});
