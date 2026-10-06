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
	UniverseAgentListToolsResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { EngineToolsSection } from './engineToolsSection.js';
import { createConversationConnectionTestStub, createTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineToolsSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listTools after dispose does not paint tool rows', async () => {
		let releaseList: ((value: UniverseAgentListToolsResult) => void) | undefined;
		const capabilities = createTestCapabilitySnapshot({
			tools: { support: 'SUPPORTED' },
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
				profiles: [{ id: 'demo', name: 'Demo Agent', source: 'user' as const }],
			}),
			listTools: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = instantiationService.createInstance(EngineToolsSection, parent);
		section.setSectionActive(true);
		section.layout(640, 160);
		await timeout(0);

		section.dispose();
		releaseList?.({
			tools: [{ name: 'late-after-dispose-bash', description: 'shell tool', category: 'shell' }],
		});
		await timeout(0);

		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-catalog-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('late-after-dispose-bash'));
	});
});
