/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentListTriggersResult, UniverseAgentTrigger } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { formatEngineTriggerListLabel } from './engineTriggerList.js';
import { EngineTriggersSection } from './engineTriggersSection.js';
import { createUnknownConversationEntryCapability } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot, createTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineTriggersSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listTriggers after dispose does not paint trigger rows', async () => {
		let releaseList: ((value: UniverseAgentListTriggersResult) => void) | undefined;
		const lateTrigger: UniverseAgentTrigger = {
			triggerId: 'late-after-dispose',
			name: 'Late Session Trigger',
			type: 'cron',
			promptTemplate: '',
			enabled: true,
			pauseReason: '',
			target: { kind: 'self' },
			intervalMs: 0,
			cronExpression: '',
			runAtEpochMs: 0,
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
					listTriggers: 'SUPPORTED',
				},
			}),
			listTriggers: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineTriggersSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		section.dispose();
		releaseList?.({ triggers: [lateTrigger] });
		await timeout(0);

		assert.strictEqual(section.getItemCount(), undefined);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-triggers-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(formatEngineTriggerListLabel(lateTrigger)));
	});

	test('set enabled is one stateful action for the selected trigger', async () => {
		const trigger: UniverseAgentTrigger = {
			triggerId: 'nightly',
			name: 'Nightly build',
			type: 'cron',
			promptTemplate: 'run checks',
			enabled: true,
			pauseReason: '',
			target: { kind: 'self' },
			intervalMs: 0,
			cronExpression: '0 0 * * *',
			runAtEpochMs: 0,
		};
		const capabilities = createTestCapabilitySnapshot({
			listTriggers: { support: 'SUPPORTED' },
			setTriggerEnabled: { support: 'SUPPORTED' },
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({
				transport: 'ok',
				pairingPending: false,
				channelAlive: true,
				sharedFsRootSent: false,
				capabilities,
				conversationEntryCapability: {
					...createUnknownConversationEntryCapability(),
					listTriggers: 'SUPPORTED',
				},
			}),
			getCapabilitySnapshot: () => capabilities,
			listTriggers: async () => ({ triggers: [trigger] }),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineTriggersSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		const row = parent.querySelector('.engine-triggers-row');
		assert.ok(row);
		row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const actions = parent.querySelectorAll('.engine-triggers-actions .monaco-button');
		assert.strictEqual(actions.length, 5, 'add, edit, fire, toggle, and delete actions');
		assert.ok([...actions].some(button => button.getAttribute('aria-label') === 'Disable'), 'enabled trigger exposes only the Disable action');
		assert.strictEqual([...actions].filter(button => ['Enable', 'Disable'].includes(button.getAttribute('aria-label') ?? '')).length, 1);
	});
});
