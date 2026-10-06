/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentListHookPointsResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { EngineHooksSection } from './engineHooksSection.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineHooksSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listHookPoints after dispose does not paint hook rows', async () => {
		let releaseList: ((value: UniverseAgentListHookPointsResult) => void) | undefined;
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			hooksMetadata: { support: 'SUPPORTED' as const },
		};
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
			listHookPoints: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = instantiationService.createInstance(EngineHooksSection, parent);
		section.setSectionActive(true);
		await timeout(0);

		section.dispose();
		releaseList?.({
			points: [{ id: 'late', family: 'session', methodName: 'after_dispose', installedCount: 1 }],
			catalogRevision: 'r-late',
		});
		await timeout(0);

		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-hooks-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('after_dispose'));
	});
});
