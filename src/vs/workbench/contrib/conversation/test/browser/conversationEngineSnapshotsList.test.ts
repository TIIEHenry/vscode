/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfirmation, IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentDeleteSnapshotRequest, UniverseAgentListSnapshotsRequest, UniverseAgentRestoreSnapshotRequest, UniverseAgentSessionSnapshotInfo } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	canDeleteEngineSnapshot,
	canRequestEngineSnapshots,
	canRestoreEngineSnapshot,
	ConversationEngineSnapshotsList,
	conversationLensSnapshotsButtonClass,
	conversationLensSnapshotsDeleteClass,
	conversationLensSnapshotsOverlayClass,
	conversationLensSnapshotsRestoreClass,
	conversationLensSnapshotsRowClass,
	formatEngineSnapshotCreatedAt,
	formatEngineSnapshotFailedCopy,
} from '../../browser/conversationEngineSnapshotsList.js';
import {
	conversationLensSessionBarSnapshots,
	conversationLensSessionBarSnapshotsDelete,
	conversationLensSessionBarSnapshotsEmpty,
	conversationLensSessionBarSnapshotsRestore,
	conversationLensSessionBarSnapshotsUnavailableDisconnected,
	conversationLensSessionBarSnapshotsUnavailableNoHook,
	conversationLensSessionBarSnapshotsUnavailableNoSession,
} from '../../browser/conversationLensSessionBarStrings.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('ConversationEngineSnapshotsList', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('gate refuses send when disconnected, no hook, or empty sessionId', () => {
		assert.strictEqual(canRequestEngineSnapshots(false, true, 'sess-1'), false);
		assert.strictEqual(canRequestEngineSnapshots(true, false, 'sess-1'), false);
		assert.strictEqual(canRequestEngineSnapshots(true, true, ''), false);
		assert.strictEqual(canRequestEngineSnapshots(true, true, undefined), false);
		assert.strictEqual(canRequestEngineSnapshots(true, true, 'sess-1'), true);
	});

	test('restore gate refuses empty snapshotId, disconnected, no hook, or empty session', () => {
		assert.strictEqual(canRestoreEngineSnapshot(false, true, 'snap-1', 'sess-1'), false);
		assert.strictEqual(canRestoreEngineSnapshot(true, false, 'snap-1', 'sess-1'), false);
		assert.strictEqual(canRestoreEngineSnapshot(true, true, '', 'sess-1'), false);
		assert.strictEqual(canRestoreEngineSnapshot(true, true, '   ', 'sess-1'), false);
		assert.strictEqual(canRestoreEngineSnapshot(true, true, undefined, 'sess-1'), false);
		assert.strictEqual(canRestoreEngineSnapshot(true, true, 'snap-1', ''), false);
		assert.strictEqual(canRestoreEngineSnapshot(true, true, 'snap-1', undefined), false);
		assert.strictEqual(canRestoreEngineSnapshot(true, true, 'snap-1', 'sess-1'), true);
	});

	test('delete gate refuses empty snapshotId, disconnected, no hook, or empty session', () => {
		assert.strictEqual(canDeleteEngineSnapshot(false, true, 'snap-1', 'sess-1'), false);
		assert.strictEqual(canDeleteEngineSnapshot(true, false, 'snap-1', 'sess-1'), false);
		assert.strictEqual(canDeleteEngineSnapshot(true, true, '', 'sess-1'), false);
		assert.strictEqual(canDeleteEngineSnapshot(true, true, '   ', 'sess-1'), false);
		assert.strictEqual(canDeleteEngineSnapshot(true, true, undefined, 'sess-1'), false);
		assert.strictEqual(canDeleteEngineSnapshot(true, true, 'snap-1', ''), false);
		assert.strictEqual(canDeleteEngineSnapshot(true, true, 'snap-1', undefined), false);
		assert.strictEqual(canDeleteEngineSnapshot(true, true, 'snap-1', 'sess-1'), true);
	});

	test('created_at formatter keeps ISO and missing as honest dash', () => {
		assert.strictEqual(formatEngineSnapshotCreatedAt(undefined), '—');
		assert.strictEqual(formatEngineSnapshotCreatedAt(1_700_000_000), '2023-11-14T22:13:20.000Z');
		assert.strictEqual(formatEngineSnapshotCreatedAt(1_700_000_000_000), '2023-11-14T22:13:20.000Z');
	});

	function createRosterStub(overrides: Partial<IConversationRosterService> = {}): IConversationRosterService {
		return {
			getActiveSessionId: () => 'sess-1',
			onDidChangeActiveSession: Event.None,
			onDidChangeSession: Event.None,
			onDidChangeEngineConnection: Event.None,
			isEngineConnected: () => false,
			...overrides,
		} as IConversationRosterService;
	}

	function mountList(
		connection: IUniverseAgentConnection,
		roster: IConversationRosterService = createRosterStub(),
		options: { confirmResult?: boolean } = {},
	): { list: ConversationEngineSnapshotsList; buttonParent: HTMLElement; overlayParent: HTMLElement; confirmCalls: IConfirmation[] } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const confirmCalls: IConfirmation[] = [];
		instantiationService.stub(IDialogService, {
			confirm: async (confirmation: IConfirmation) => {
				confirmCalls.push(confirmation);
				return { confirmed: options.confirmResult ?? false };
			},
		} as IDialogService);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(IConversationRosterService, roster);
		const buttonParent = document.createElement('div');
		const overlayParent = document.createElement('div');
		document.body.appendChild(buttonParent);
		document.body.appendChild(overlayParent);
		store.add({ dispose: () => { buttonParent.remove(); overlayParent.remove(); } });
		const list = store.add(instantiationService.createInstance(ConversationEngineSnapshotsList, buttonParent, overlayParent));
		return { list, buttonParent, overlayParent, confirmCalls };
	}

	function snapshotRow(overlay: HTMLElement, id: string): HTMLElement | null {
		return overlay.querySelector(`.${conversationLensSnapshotsRowClass}[data-snapshot-id="${id}"]`);
	}

	function restoreButton(row: HTMLElement | null): HTMLButtonElement | null {
		return row?.querySelector(`.${conversationLensSnapshotsRestoreClass} .monaco-button`) as HTMLButtonElement | null;
	}

	function deleteButton(row: HTMLElement | null): HTMLElement | undefined {
		return row?.querySelector(`.${conversationLensSnapshotsDeleteClass} .monaco-button`) as HTMLElement | undefined;
	}

	test('SessionBar control is Snapshots, not History, and overlay starts closed', () => {
		const { list, buttonParent, overlayParent } = mountList(createConversationConnectionTestStub());
		const button = buttonParent.querySelector(`.${conversationLensSnapshotsButtonClass} .monaco-button`) as HTMLElement | null;
		assert.ok(button);
		assert.ok(button.textContent?.includes(conversationLensSessionBarSnapshots));
		assert.ok(!button.textContent?.includes('History'));
		assert.strictEqual(list.isOpen(), false);
		assert.ok(overlayParent.querySelector(`.${conversationLensSnapshotsOverlayClass}`)?.hasAttribute('hidden'));
		assert.strictEqual(overlayParent.querySelector('.conversation-lens-trajectory'), null);
	});

	test('disconnected open does not send and shows unavailable', async () => {
		const calls: UniverseAgentListSnapshotsRequest[] = [];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			listSnapshots: async request => {
				calls.push(request);
				return {
					snapshots: [{ id: 'fixture', sessionId: 'sess-1', title: 'fixture', createdAt: 1, turnCount: 9 }],
				};
			},
		}));
		list.show();
		await Promise.resolve();
		assert.deepStrictEqual(calls, []);
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarSnapshotsUnavailableDisconnected));
		assert.strictEqual(snapshotRow(overlayParent, 'fixture'), null);
	});

	test('no listSnapshots hook does not send and shows unavailable', async () => {
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
		}));
		list.show();
		await Promise.resolve();
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarSnapshotsUnavailableNoHook));
		assert.strictEqual(overlayParent.querySelector(`.${conversationLensSnapshotsRowClass}`), null);
	});

	test('empty sessionId does not send and shows unavailable', async () => {
		const calls: UniverseAgentListSnapshotsRequest[] = [];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async request => {
				calls.push(request);
				return { snapshots: [] };
			},
		}), createRosterStub({ getActiveSessionId: () => '' }));
		list.show();
		await Promise.resolve();
		assert.deepStrictEqual(calls, []);
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarSnapshotsUnavailableNoSession));
	});

	test('connected listSnapshots paints id/title/created_at/turn_count and restore plus delete, not create', async () => {
		const calls: UniverseAgentListSnapshotsRequest[] = [];
		const snapshots: UniverseAgentSessionSnapshotInfo[] = [
			{ id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', createdAt: 1_700_000_000, turnCount: 4 },
			{ id: 'snap-2', sessionId: 'sess-1', title: 'After review', createdAt: 1_700_000_100, turnCount: 7 },
		];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async request => {
				calls.push(request);
				return { snapshots };
			},
		}));
		list.show();
		await Promise.resolve();
		assert.deepStrictEqual(calls, [{ sessionId: 'sess-1' }]);
		const first = snapshotRow(overlayParent, 'snap-1');
		const second = snapshotRow(overlayParent, 'snap-2');
		assert.ok(first);
		assert.ok(second);
		assert.strictEqual(first.querySelector('.conversation-lens-snapshots-id')?.textContent, 'snap-1');
		assert.strictEqual(first.querySelector('.conversation-lens-snapshots-title-text')?.textContent, 'Before refactor');
		assert.strictEqual(first.querySelector('.conversation-lens-snapshots-created-at')?.textContent, formatEngineSnapshotCreatedAt(1_700_000_000));
		assert.strictEqual(first.querySelector('.conversation-lens-snapshots-turn-count')?.textContent, '4');
		assert.strictEqual(second.querySelector('.conversation-lens-snapshots-turn-count')?.textContent, '7');
		assert.ok(restoreButton(first)?.textContent?.includes(conversationLensSessionBarSnapshotsRestore));
		assert.ok(restoreButton(second));
		assert.ok(deleteButton(first)?.textContent?.includes(conversationLensSessionBarSnapshotsDelete));
		assert.ok(deleteButton(second));
		const text = overlayParent.textContent ?? '';
		assert.ok(!/create/i.test(text));
		assert.strictEqual(overlayParent.querySelector('button.conversation-lens-snapshots-create'), null);
	});

	test('connected empty engine list is honest empty, not fixture rows', async () => {
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({ snapshots: [] }),
		}));
		list.show();
		await Promise.resolve();
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarSnapshotsEmpty));
		assert.strictEqual(overlayParent.querySelector(`.${conversationLensSnapshotsRowClass}`), null);
	});

	test('listSnapshots failure shows read failure copy', async () => {
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => {
				throw new Error('transport reset');
			},
		}));
		list.show();
		await Promise.resolve();
		assert.ok(overlayParent.textContent?.includes(formatEngineSnapshotFailedCopy('transport reset')));
	});

	test('connection drop while open clears rows and does not keep fixture data', async () => {
		let connected = true;
		const onDidChangeConnection = new Emitter<UniverseAgentConnectionSnapshot>();
		const dropSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		};
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => connected,
			onDidChangeConnection: onDidChangeConnection.event,
			listSnapshots: async () => ({
				snapshots: [{ id: 'live-1', sessionId: 'sess-1', title: 'Live', createdAt: 2, turnCount: 1 }],
			}),
		}));
		list.show();
		await Promise.resolve();
		assert.ok(snapshotRow(overlayParent, 'live-1'));
		connected = false;
		onDidChangeConnection.fire(dropSnapshot);
		await Promise.resolve();
		assert.strictEqual(snapshotRow(overlayParent, 'live-1'), null);
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarSnapshotsUnavailableDisconnected));
	});

	test('connected restore with hook and known session sends RestoreSnapshot', async () => {
		const restoreCalls: UniverseAgentRestoreSnapshotRequest[] = [];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', createdAt: 1, turnCount: 2 }],
			}),
			restoreSnapshot: async request => {
				restoreCalls.push(request);
				return { ok: true };
			},
		}));
		list.show();
		await Promise.resolve();
		restoreButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.deepStrictEqual(restoreCalls, [{ sessionId: 'sess-1', snapshotId: 'snap-1' }]);
	});

	test('empty snapshotId restore does not send', async () => {
		const restoreCalls: UniverseAgentRestoreSnapshotRequest[] = [];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: '', sessionId: 'sess-1', title: 'Nameless', createdAt: 1, turnCount: 1 }],
			}),
			restoreSnapshot: async request => {
				restoreCalls.push(request);
				return { ok: true };
			},
		}));
		list.show();
		await Promise.resolve();
		restoreButton(snapshotRow(overlayParent, ''))?.click();
		await Promise.resolve();
		assert.deepStrictEqual(restoreCalls, []);
	});

	test('disconnected restore does not send', async () => {
		let connected = true;
		const restoreCalls: UniverseAgentRestoreSnapshotRequest[] = [];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => connected,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Live', createdAt: 1, turnCount: 1 }],
			}),
			restoreSnapshot: async request => {
				restoreCalls.push(request);
				return { ok: true };
			},
		}));
		list.show();
		await Promise.resolve();
		connected = false;
		restoreButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.deepStrictEqual(restoreCalls, []);
	});

	test('no restoreSnapshot hook does not send', async () => {
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Live', createdAt: 1, turnCount: 1 }],
			}),
		}));
		list.show();
		await Promise.resolve();
		restoreButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.ok(snapshotRow(overlayParent, 'snap-1'));
	});

	test('empty session restore does not send', async () => {
		let sessionId = 'sess-1';
		const restoreCalls: UniverseAgentRestoreSnapshotRequest[] = [];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Live', createdAt: 1, turnCount: 1 }],
			}),
			restoreSnapshot: async request => {
				restoreCalls.push(request);
				return { ok: true };
			},
		}), createRosterStub({ getActiveSessionId: () => sessionId }));
		list.show();
		await Promise.resolve();
		sessionId = '';
		restoreButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.deepStrictEqual(restoreCalls, []);
	});

	test('connected delete with hook and known session sends DeleteSnapshot after confirm', async () => {
		const deleteCalls: UniverseAgentDeleteSnapshotRequest[] = [];
		const { list, overlayParent, confirmCalls } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', createdAt: 1, turnCount: 2 }],
			}),
			deleteSnapshot: async request => {
				deleteCalls.push(request);
				return { ok: true };
			},
		}), createRosterStub(), { confirmResult: true });
		list.show();
		await Promise.resolve();
		deleteButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.strictEqual(confirmCalls.length, 1);
		assert.strictEqual(confirmCalls[0]?.type, 'warning');
		assert.ok(confirmCalls[0]?.message.includes('Before refactor'));
		assert.deepStrictEqual(deleteCalls, [{ sessionId: 'sess-1', snapshotId: 'snap-1' }]);
	});

	test('cancelled delete confirm does not send', async () => {
		const deleteCalls: UniverseAgentDeleteSnapshotRequest[] = [];
		const { list, overlayParent, confirmCalls } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', createdAt: 1, turnCount: 2 }],
			}),
			deleteSnapshot: async request => {
				deleteCalls.push(request);
				return { ok: true };
			},
		}), createRosterStub(), { confirmResult: false });
		list.show();
		await Promise.resolve();
		deleteButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.strictEqual(confirmCalls.length, 1);
		assert.deepStrictEqual(deleteCalls, []);
	});

	test('empty snapshotId delete does not send', async () => {
		const deleteCalls: UniverseAgentDeleteSnapshotRequest[] = [];
		const { list, overlayParent, confirmCalls } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: '', sessionId: 'sess-1', title: 'Nameless', createdAt: 1, turnCount: 1 }],
			}),
			deleteSnapshot: async request => {
				deleteCalls.push(request);
				return { ok: true };
			},
		}), createRosterStub(), { confirmResult: true });
		list.show();
		await Promise.resolve();
		deleteButton(snapshotRow(overlayParent, ''))?.click();
		await Promise.resolve();
		assert.deepStrictEqual(confirmCalls, []);
		assert.deepStrictEqual(deleteCalls, []);
	});

	test('disconnected delete does not send', async () => {
		let connected = true;
		const deleteCalls: UniverseAgentDeleteSnapshotRequest[] = [];
		const { list, overlayParent, confirmCalls } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => connected,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Live', createdAt: 1, turnCount: 1 }],
			}),
			deleteSnapshot: async request => {
				deleteCalls.push(request);
				return { ok: true };
			},
		}), createRosterStub(), { confirmResult: true });
		list.show();
		await Promise.resolve();
		connected = false;
		deleteButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.deepStrictEqual(confirmCalls, []);
		assert.deepStrictEqual(deleteCalls, []);
	});

	test('no deleteSnapshot hook does not send', async () => {
		const { list, overlayParent, confirmCalls } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Live', createdAt: 1, turnCount: 1 }],
			}),
		}), createRosterStub(), { confirmResult: true });
		list.show();
		await Promise.resolve();
		deleteButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.ok(snapshotRow(overlayParent, 'snap-1'));
		assert.deepStrictEqual(confirmCalls, []);
	});

	test('empty session delete does not send', async () => {
		let sessionId = 'sess-1';
		const deleteCalls: UniverseAgentDeleteSnapshotRequest[] = [];
		const { list, overlayParent, confirmCalls } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			listSnapshots: async () => ({
				snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Live', createdAt: 1, turnCount: 1 }],
			}),
			deleteSnapshot: async request => {
				deleteCalls.push(request);
				return { ok: true };
			},
		}), createRosterStub({ getActiveSessionId: () => sessionId }), { confirmResult: true });
		list.show();
		await Promise.resolve();
		sessionId = '';
		deleteButton(snapshotRow(overlayParent, 'snap-1'))?.click();
		await Promise.resolve();
		assert.deepStrictEqual(confirmCalls, []);
		assert.deepStrictEqual(deleteCalls, []);
	});
});
