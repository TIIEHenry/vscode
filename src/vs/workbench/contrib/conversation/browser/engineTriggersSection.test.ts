/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type {
	UniverseAgentDeleteTriggerResult,
	UniverseAgentFireTriggerResult,
	UniverseAgentListTriggersResult,
	UniverseAgentTrigger,
	UniverseAgentUpsertTriggerResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
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

	test('late trigger actions after pairing hold do not paint success', async () => {
		let pairingPending = false;
		let releaseFire: ((value: UniverseAgentFireTriggerResult) => void) | undefined;
		let releaseDelete: ((value: UniverseAgentDeleteTriggerResult) => void) | undefined;
		let releaseUpsert: ((value: UniverseAgentUpsertTriggerResult) => void) | undefined;
		const connectionChanged = new Emitter<void>();
		const trigger: UniverseAgentTrigger = {
			triggerId: 'nightly', name: 'Nightly build', type: 'cron', promptTemplate: 'run checks', enabled: true,
			pauseReason: '', target: { kind: 'self' }, intervalMs: 0, cronExpression: '0 0 * * *', runAtEpochMs: 0,
		};
		const capabilities = createTestCapabilitySnapshot({
			listTriggers: { support: 'SUPPORTED' }, fireTrigger: { support: 'SUPPORTED' },
			deleteTrigger: { support: 'SUPPORTED' }, upsertTrigger: { support: 'SUPPORTED' },
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: connectionChanged.event,
			getCapabilitySnapshot: () => capabilities,
			getConnectionSnapshot: () => ({
				transport: 'ok', pairingPending, channelAlive: true, sharedFsRootSent: false, capabilities,
				conversationEntryCapability: { ...createUnknownConversationEntryCapability(), listTriggers: 'SUPPORTED' },
			}),
			listTriggers: async () => ({ triggers: [trigger] }),
			fireTrigger: () => new Promise<UniverseAgentFireTriggerResult>(resolve => { releaseFire = resolve; }),
			deleteTrigger: () => new Promise<UniverseAgentDeleteTriggerResult>(resolve => { releaseDelete = resolve; }),
			upsertTrigger: () => new Promise<UniverseAgentUpsertTriggerResult>(resolve => { releaseUpsert = resolve; }),
		});
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		instantiationService.stub(IDialogService, { input: async () => ({ confirmed: true, values: ['New trigger', 'cron', '', '', '', ''] }) } as unknown as IDialogService);
		const section = store.add(instantiationService.createInstance(EngineTriggersSection, parent));
		section.setSectionActive(true);
		await timeout(0);
		parent.querySelector('.engine-triggers-row')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
		const internals = section as unknown as { handleFire(): Promise<void>; handleDelete(): Promise<void>; handleUpsert(mode: 'add' | 'edit'): Promise<void> };
		const enterPairing = async (): Promise<void> => { pairingPending = true; connectionChanged.fire(); await timeout(0); };
		const leavePairing = async (): Promise<void> => { pairingPending = false; connectionChanged.fire(); await timeout(0); };

		const firePromise = internals.handleFire();
		await enterPairing(); releaseFire?.({ status: 'fired', eventId: 'late', reason: '' }); await firePromise;
		assert.strictEqual(parent.querySelector('.engine-triggers-fire-status')?.textContent, '');
		await leavePairing();
		const deletePromise = internals.handleDelete();
		await enterPairing(); releaseDelete?.({}); await deletePromise;
		assert.strictEqual(parent.querySelector('.engine-triggers-delete-status')?.textContent, '');
		await leavePairing();
		const upsertPromise = internals.handleUpsert('add');
		await timeout(0); await enterPairing(); releaseUpsert?.({ trigger }); await upsertPromise;
		assert.strictEqual(parent.querySelector('.engine-triggers-upsert-status')?.textContent, '');
	});
});
