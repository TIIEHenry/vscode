/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentConnectionSnapshot,
	UniverseAgentListAgentProfilesResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { EngineAgentsSection } from './engineAgentsSection.js';
import { createConversationConnectionTestStub, createTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineAgentsSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listAgentProfiles after dispose does not paint profile rows', async () => {
		let releaseList: ((value: UniverseAgentListAgentProfilesResult) => void) | undefined;
		const capabilities = createTestCapabilitySnapshot({
			agentProfiles: { support: 'SUPPORTED' },
		});
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities,
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
			listAgentProfiles: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = instantiationService.createInstance(EngineAgentsSection, parent);
		section.setSectionActive(true);
		section.layout(640, 480);
		await timeout(0);

		section.dispose();
		releaseList?.({
			profiles: [{
				id: 'late-after-dispose',
				name: 'Late After Dispose Agent',
				source: 'user',
				summary: '',
				enabled: true,
			}],
		});
		await timeout(0);

		assert.strictEqual(section.getListEntryCount(), 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('Late After Dispose Agent'));
	});

	test('group header renders group item count in .engine-catalog-group-count (S9)', async () => {
		const capabilities = createTestCapabilitySnapshot({
			agentProfiles: { support: 'SUPPORTED' },
		});
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities,
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			getCapabilitySnapshot: () => capabilities,
			onDidChangeConnection: onDidChangeConnection.event,
			listAgentProfiles: async () => ({
				profiles: [
					{ id: 'agent-1', name: 'Agent 1', source: 'user', summary: '', enabled: true },
					{ id: 'agent-2', name: 'Agent 2', source: 'user', summary: '', enabled: true },
				],
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineAgentsSection, parent));
		section.setSectionActive(true);
		section.layout(640, 480);
		await timeout(0);

		const counts = Array.from(parent.querySelectorAll('.engine-catalog-group-count')).map(el => el.textContent?.trim());
		assert.ok(counts.includes('2'), `expected count 2 in group counts, got: ${counts.join(', ')}`);
	});
});
