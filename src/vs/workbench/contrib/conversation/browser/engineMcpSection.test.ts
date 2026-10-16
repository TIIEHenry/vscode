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
	UniverseAgentListMcpServersResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { EngineMcpSection } from './engineMcpSection.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineMcpSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listMcpServers after dispose does not paint MCP definition rows', async () => {
		let releaseList: ((value: UniverseAgentListMcpServersResult) => void) | undefined;
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			mcp: { support: 'SUPPORTED' as const },
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
			listMcpServers: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = instantiationService.createInstance(EngineMcpSection, parent);
		section.setSectionActive(true);
		section.layout(640, 160);
		await timeout(0);

		section.dispose();
		releaseList?.({
			servers: [{
				id: 'late-after-dispose-mcp',
				name: 'late-after-dispose-mcp',
				transport: 'stdio',
				origin: 'global',
				enabled: true,
			}],
		});
		await timeout(0);

		assert.strictEqual(section.getListEntryCount(), 0);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-catalog-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes('late-after-dispose-mcp'));
	});

	test('group header renders group item count in .engine-catalog-group-count (S9)', async () => {
		const capabilities = {
			...createEmptyTestCapabilitySnapshot(),
			mcp: { support: 'SUPPORTED' as const },
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
			listMcpServers: async () => ({
				servers: [
					{ id: 'mcp-1', name: 'mcp-1', transport: 'stdio', origin: 'global', enabled: true },
					{ id: 'mcp-2', name: 'mcp-2', transport: 'stdio', origin: 'global', enabled: true },
				],
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineMcpSection, parent));
		section.setSectionActive(true);
		section.layout(640, 160);
		await timeout(0);
		section.layout(640, 160);

		const counts = Array.from(parent.querySelectorAll('.engine-catalog-group-count')).map(el => el.textContent?.trim());
		assert.ok(counts.includes('2'), `expected count 2 in group counts, got: ${counts.join(', ')}`);
	});
});
