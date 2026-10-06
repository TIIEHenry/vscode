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
	UniverseAgentGetMcpServerStatusesResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { EngineMcpRuntimePanel } from './engineMcpRuntimePanel.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineMcpRuntimePanel (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late getMcpServerStatuses after dispose does not paint runtime rows', async () => {
		let releaseStatuses: ((value: UniverseAgentGetMcpServerStatusesResult) => void) | undefined;
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			mcpRuntime: { support: 'SUPPORTED' as const },
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
			getMcpServerStatuses: () => new Promise(resolve => {
				releaseStatuses = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const panel = instantiationService.createInstance(EngineMcpRuntimePanel, parent);
		panel.layout(640, 240);
		await timeout(0);

		panel.dispose();
		releaseStatuses?.({
			statuses: [{ serverId: 'late-runtime-server', status: 'connected' }],
			checkedAt: Date.now(),
		});
		await timeout(0);

		assert.strictEqual(panel.getListEntryCount(), 0);
		assert.strictEqual(panel.getDomNode().querySelectorAll('.engine-catalog-row').length, 0);
		assert.ok(!(panel.getDomNode().textContent ?? '').includes('late-runtime-server'));
	});
});
