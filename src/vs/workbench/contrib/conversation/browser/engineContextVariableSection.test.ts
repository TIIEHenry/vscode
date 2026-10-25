/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentContextVariableListResult, UniverseAgentContextVariableReadResult } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { formatEngineContextVariableListLabel } from './engineContextVariableList.js';
import { EngineContextVariableSection } from './engineContextVariableSection.js';
import { createUnknownConversationEntryCapability } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineContextVariableSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listContextVariable after dispose does not paint context variable rows', async () => {
		let releaseList: ((value: UniverseAgentContextVariableListResult) => void) | undefined;
		const lateEntry = {
			name: 'late-after-dispose',
			scope: 'VARIABLE_GLOBAL' as const,
			updatedBy: '',
			updatedAt: 0,
			contentPreview: '',
		};
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities: createEmptyTestCapabilitySnapshot(),
				conversationEntryCapability: {
					...createUnknownConversationEntryCapability(),
					listContextVariable: 'SUPPORTED',
				},
			}),
			listContextVariable: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineContextVariableSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		section.dispose();
		releaseList?.({ current: [lateEntry], inherited: [] });
		await timeout(0);

		assert.strictEqual(section.getItemCount(), undefined);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-context-variable-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(formatEngineContextVariableListLabel('current', lateEntry)));
	});

	test('late context read after pairing hold does not paint success', async () => {
		let pairingPending = false;
		let releaseRead: ((value: UniverseAgentContextVariableReadResult) => void) | undefined;
		const connectionChanged = new Emitter<void>();
		const entry = { name: 'mode', scope: 'VARIABLE_GLOBAL' as const, updatedBy: '', updatedAt: 0, contentPreview: 'live' };
		const capabilities = createEmptyTestCapabilitySnapshot();
		capabilities.readContextVariable = { support: 'SUPPORTED' };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: connectionChanged.event,
			getCapabilitySnapshot: () => capabilities,
			getConnectionSnapshot: () => ({
				transport: 'ok', pairingPending, channelAlive: true, sharedFsRootSent: false, capabilities,
				conversationEntryCapability: { ...createUnknownConversationEntryCapability(), listContextVariable: 'SUPPORTED' },
			}),
			listContextVariable: async () => ({ current: [entry], inherited: [] }),
			readContextVariable: () => new Promise<UniverseAgentContextVariableReadResult>(resolve => { releaseRead = resolve; }),
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineContextVariableSection, parent));
		section.setSectionActive(true);
		await timeout(0);
		parent.querySelector('.engine-context-variable-row')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const readPromise = (section as unknown as { handleRead(): Promise<void> }).handleRead();
		pairingPending = true;
		connectionChanged.fire();
		await timeout(0);
		releaseRead?.({ entry: { name: 'mode', content: 'late', scope: 'VARIABLE_GLOBAL', updatedBy: '', updatedAt: 0 } });
		await readPromise;
		assert.strictEqual(parent.querySelector('.engine-context-variable-read-status')?.textContent, '');
	});
});
