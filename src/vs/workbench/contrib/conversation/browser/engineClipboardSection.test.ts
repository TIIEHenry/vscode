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
	UniverseAgentConnectionSnapshot,
	UniverseAgentClearClipboardResult,
	UniverseAgentListClipboardResult,
	UniverseAgentReadClipboardResult,
	UniverseAgentWriteClipboardResult,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { formatEngineClipboardListLabel, formatEngineClipboardWriteLabel } from './engineClipboardList.js';
import { EngineClipboardSection } from './engineClipboardSection.js';
import { createUnknownConversationEntryCapability } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot, createTestCapabilitySnapshot } from '../test/common/conversationConnectionTestStub.js';

suite('EngineClipboardSection (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('late listClipboard after dispose does not paint clipboard rows', async () => {
		let releaseList: ((value: UniverseAgentListClipboardResult) => void) | undefined;
		const lateEntry = {
			clipId: 'late-after-dispose',
			label: 'Late Session Row',
			type: 'CLIPBOARD_TEXT' as const,
			createdBy: '',
			createdAt: 0,
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
					listClipboard: 'SUPPORTED',
				},
			}),
			listClipboard: () => new Promise(resolve => {
				releaseList = resolve;
			}),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		const section = store.add(instantiationService.createInstance(EngineClipboardSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		section.dispose();
		releaseList?.({ entries: [lateEntry] });
		await timeout(0);

		assert.strictEqual(section.getItemCount(), undefined);
		assert.strictEqual(section.getDomNode().querySelectorAll('.engine-clipboard-row').length, 0);
		assert.ok(!(section.getDomNode().textContent ?? '').includes(formatEngineClipboardListLabel(lateEntry)));
	});

	test('late clipboard actions after pairing hold do not paint success', async () => {
		let pairingPending = false;
		let releaseRead: ((value: UniverseAgentReadClipboardResult) => void) | undefined;
		let releaseClear: ((value: UniverseAgentClearClipboardResult) => void) | undefined;
		let releaseWrite: ((value: UniverseAgentWriteClipboardResult) => void) | undefined;
		const connectionChanged = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const entry = { clipId: 'clip-1', label: 'Clip', type: 'CLIPBOARD_TEXT' as const, createdBy: '', createdAt: 0 };
		const capabilities = createTestCapabilitySnapshot({
			readClipboard: { support: 'SUPPORTED' },
			clearClipboard: { support: 'SUPPORTED' },
			writeClipboard: { support: 'SUPPORTED' },
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: connectionChanged.event,
			getCapabilitySnapshot: () => capabilities,
			getConnectionSnapshot: () => ({
				transport: 'ok', pairingPending, channelAlive: true, sharedFsRootSent: false,
				capabilities,
				conversationEntryCapability: { ...createUnknownConversationEntryCapability(), listClipboard: 'SUPPORTED' },
			}),
			listClipboard: async () => ({ entries: [entry] }),
			readClipboard: () => new Promise(resolve => { releaseRead = resolve; }),
			clearClipboard: () => new Promise(resolve => { releaseClear = resolve; }),
			writeClipboard: () => new Promise(resolve => { releaseWrite = resolve; }),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		instantiationService.stub(IDialogService, { input: async () => ({ confirmed: true, values: ['label', 'content'] }) } as unknown as IDialogService);
		const section = store.add(instantiationService.createInstance(EngineClipboardSection, parent));
		section.setSectionActive(true);
		await timeout(0);
		parent.querySelector('.engine-clipboard-row')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

		const sectionInternals = section as unknown as {
			handleRead(): Promise<void>;
			handleClear(): Promise<void>;
			handleWrite(): Promise<void>;
		};
		const enterPairing = async (): Promise<void> => {
			pairingPending = true;
			connectionChanged.fire(connection.getConnectionSnapshot());
			await timeout(0);
		};
		const leavePairing = async (): Promise<void> => {
			pairingPending = false;
			connectionChanged.fire(connection.getConnectionSnapshot());
			await timeout(0);
		};

		const readPromise = sectionInternals.handleRead();
		await enterPairing();
		releaseRead?.({ entry: { ...entry, content: 'late' } });
		await readPromise;
		assert.strictEqual(parent.querySelector('.engine-clipboard-read-status')?.textContent, '');
		await leavePairing();

		const clearPromise = sectionInternals.handleClear();
		await enterPairing();
		releaseClear?.({ removedCount: 1 });
		await clearPromise;
		assert.strictEqual(parent.querySelector('.engine-clipboard-clear-status')?.textContent, '');
		await leavePairing();

		const writePromise = sectionInternals.handleWrite();
		await timeout(0);
		await enterPairing();
		releaseWrite?.({ clipId: 'late-write' });
		await writePromise;
		assert.strictEqual(parent.querySelector('.engine-clipboard-write-status')?.textContent, '');
	});

	test('late clipboard write after disconnect does not paint success', async () => {
		let connected = true;
		let releaseWrite: ((value: UniverseAgentWriteClipboardResult) => void) | undefined;
		const connectionChanged = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const capabilities = createTestCapabilitySnapshot({
			writeClipboard: { support: 'SUPPORTED' },
		});
		const entry = { clipId: 'clip-1', label: 'Clip', type: 'CLIPBOARD_TEXT' as const, createdBy: '', createdAt: 0 };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => connected,
			getConnectionPhase: () => connected ? ({ kind: 'connected', path: 'loopback' }) : ({ kind: 'disconnected' }),
			onDidChangeConnection: connectionChanged.event,
			getCapabilitySnapshot: () => capabilities,
			getConnectionSnapshot: () => ({
				transport: connected ? 'ok' : 'idle', pairingPending: false, channelAlive: connected, sharedFsRootSent: false,
				capabilities, conversationEntryCapability: { ...createUnknownConversationEntryCapability(), listClipboard: 'SUPPORTED' },
			}),
			listClipboard: async () => ({ entries: [entry] }),
			writeClipboard: () => new Promise(resolve => { releaseWrite = resolve; }),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		instantiationService.stub(IDialogService, { input: async () => ({ confirmed: true, values: ['label', 'content'] }) } as unknown as IDialogService);
		const section = store.add(instantiationService.createInstance(EngineClipboardSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		const writePromise = (section as unknown as { handleWrite(): Promise<void> }).handleWrite();
		await timeout(0);
		connected = false;
		connectionChanged.fire(connection.getConnectionSnapshot());
		await timeout(0);
		releaseWrite?.({ clipId: 'late-write' });
		await writePromise;
		assert.strictEqual(parent.querySelector('.engine-clipboard-write-status')?.textContent, '');
	});

	test('late clipboard write error after list failure does not paint error', async () => {
		let listFailed = false;
		let rejectWrite: ((reason?: unknown) => void) | undefined;
		const connectionChanged = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const capabilities = createTestCapabilitySnapshot({
			writeClipboard: { support: 'SUPPORTED' },
		});
		const entry = { clipId: 'clip-1', label: 'Clip', type: 'CLIPBOARD_TEXT' as const, createdBy: '', createdAt: 0 };
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			onDidChangeConnection: connectionChanged.event,
			getCapabilitySnapshot: () => capabilities,
			getConnectionSnapshot: () => ({
				transport: 'ok', pairingPending: false, channelAlive: true, sharedFsRootSent: false,
				capabilities, conversationEntryCapability: { ...createUnknownConversationEntryCapability(), listClipboard: 'SUPPORTED' },
			}),
			listClipboard: async () => {
				if (listFailed) {
					throw new Error('list failed');
				}
				return { entries: [entry] };
			},
			writeClipboard: () => new Promise((_resolve, reject) => { rejectWrite = reject; }),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		instantiationService.stub(IDialogService, { input: async () => ({ confirmed: true, values: ['label', 'content'] }) } as unknown as IDialogService);
		const section = store.add(instantiationService.createInstance(EngineClipboardSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		const writePromise = (section as unknown as { handleWrite(): Promise<void> }).handleWrite();
		await timeout(0);
		listFailed = true;
		connectionChanged.fire(connection.getConnectionSnapshot());
		await timeout(0);
		rejectWrite?.(new Error('late write failure'));
		await writePromise;
		assert.strictEqual(parent.querySelector('.engine-clipboard-write-status')?.textContent, '');
	});

	test('live clipboard write keeps success after its own refresh', async () => {
		const capabilities = createTestCapabilitySnapshot({
			writeClipboard: { support: 'SUPPORTED' },
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getCapabilitySnapshot: () => capabilities,
			getConnectionSnapshot: () => ({
				transport: 'ok', pairingPending: false, channelAlive: true, sharedFsRootSent: false,
				capabilities, conversationEntryCapability: { ...createUnknownConversationEntryCapability(), listClipboard: 'SUPPORTED' },
			}),
			listClipboard: async () => ({ entries: [] }),
			writeClipboard: async () => ({ clipId: 'live-write' }),
		});

		const parent = document.createElement('div');
		document.body.appendChild(parent);
		store.add({ dispose: () => parent.remove() });
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection as IUniverseAgentConnection);
		instantiationService.stub(IDialogService, { input: async () => ({ confirmed: true, values: ['label', 'content'] }) } as unknown as IDialogService);
		const section = store.add(instantiationService.createInstance(EngineClipboardSection, parent));
		section.setSectionActive(true);
		await timeout(0);

		await (section as unknown as { handleWrite(): Promise<void> }).handleWrite();
		assert.strictEqual(parent.querySelector('.engine-clipboard-write-status')?.textContent, formatEngineClipboardWriteLabel('live-write'));
	});
});
