/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentConnectionSnapshot, UniverseAgentGetHistoryRequest, UniverseAgentHistoryEnvelope } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import {
	canRequestEngineHistory,
	ConversationEngineHistoryList,
	conversationLensHistoryButtonClass,
	conversationLensHistoryOverlayClass,
	conversationLensHistoryRowClass,
	formatEngineHistoryEnvelopePreview,
	formatEngineHistoryFailedCopy,
} from '../../browser/conversationEngineHistoryList.js';
import {
	conversationLensSessionBarHistory,
	conversationLensSessionBarHistoryEmpty,
	conversationLensSessionBarHistoryUnavailableDisconnected,
} from '../../browser/conversationLensSessionBarStrings.js';
import { isConversationPairingHold } from '../../browser/conversationSessionStatus.js';
import { IConversationRosterService } from '../../browser/conversationStubService.js';
import { createConversationConnectionTestStub, createEmptyTestCapabilitySnapshot } from '../common/conversationConnectionTestStub.js';

suite('ConversationEngineHistoryList', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('gate sends when connected, including empty sessionId', () => {
		assert.strictEqual(canRequestEngineHistory(false), false);
		assert.strictEqual(canRequestEngineHistory(true), true);
	});

	test('envelope preview is shallow and does not invent turn kinds', () => {
		assert.strictEqual(formatEngineHistoryEnvelopePreview(undefined), '');
		assert.strictEqual(formatEngineHistoryEnvelopePreview('hello'), 'hello');
		assert.strictEqual(formatEngineHistoryEnvelopePreview({ role: 'user', text: 'Ask' }), 'user: Ask');
		assert.strictEqual(formatEngineHistoryEnvelopePreview({ content: 'Body' }), 'Body');
		assert.strictEqual(formatEngineHistoryEnvelopePreview({ nested: { text: 'hidden' } }), '');
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
	): { list: ConversationEngineHistoryList; buttonParent: HTMLElement; overlayParent: HTMLElement } {
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IUniverseAgentConnection, connection);
		instantiationService.stub(IConversationRosterService, roster);
		const buttonParent = document.createElement('div');
		const overlayParent = document.createElement('div');
		document.body.appendChild(buttonParent);
		document.body.appendChild(overlayParent);
		store.add({ dispose: () => { buttonParent.remove(); overlayParent.remove(); } });
		const list = store.add(instantiationService.createInstance(ConversationEngineHistoryList, buttonParent, overlayParent));
		return { list, buttonParent, overlayParent };
	}

	function historyRow(overlay: HTMLElement, cursorSeq: string): HTMLElement | null {
		return overlay.querySelector(`.${conversationLensHistoryRowClass}[data-cursor-seq="${cursorSeq}"]`);
	}

	test('SessionBar control is History, not Snapshots, and overlay starts closed', () => {
		const { list, buttonParent, overlayParent } = mountList(createConversationConnectionTestStub());
		const button = buttonParent.querySelector(`.${conversationLensHistoryButtonClass} .monaco-button`) as HTMLElement | null;
		assert.ok(button);
		assert.ok(button.textContent?.includes(conversationLensSessionBarHistory));
		assert.ok(!button.textContent?.includes('Snapshots'));
		assert.strictEqual(list.isOpen(), false);
		assert.ok(overlayParent.querySelector(`.${conversationLensHistoryOverlayClass}`)?.hasAttribute('hidden'));
		assert.strictEqual(overlayParent.querySelector('.conversation-lens-trajectory'), null);
	});

	test('disconnected open does not send and shows unavailable', async () => {
		const calls: UniverseAgentGetHistoryRequest[] = [];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => false,
			getHistory: async request => {
				calls.push(request);
				return {
					envelopes: [{ cursorSeq: 'fixture', payload: { text: 'fixture' } }],
				};
			},
		}));
		list.show();
		await Promise.resolve();
		assert.deepStrictEqual(calls, []);
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarHistoryUnavailableDisconnected));
		assert.strictEqual(historyRow(overlayParent, 'fixture'), null);
	});

	test('connected empty sessionId is sent as-is', async () => {
		const calls: UniverseAgentGetHistoryRequest[] = [];
		const { list } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getHistory: async request => {
				calls.push(request);
				return { envelopes: [] };
			},
		}), createRosterStub({ getActiveSessionId: () => '' }));
		list.show();
		await Promise.resolve();
		assert.deepStrictEqual(calls, [{ sessionId: '' }]);
	});

	test('connected getHistory paints cursor_seq plus shallow preview, not snapshot restore/delete', async () => {
		const calls: UniverseAgentGetHistoryRequest[] = [];
		const envelopes: UniverseAgentHistoryEnvelope[] = [
			{ cursorSeq: '1', payload: { role: 'user', text: 'Hello' } },
			{ cursorSeq: '2', payload: { content: 'Reply' } },
		];
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getHistory: async request => {
				calls.push(request);
				return { envelopes };
			},
		}));
		list.show();
		await Promise.resolve();
		assert.deepStrictEqual(calls, [{ sessionId: 'sess-1' }]);
		const first = historyRow(overlayParent, '1');
		const second = historyRow(overlayParent, '2');
		assert.ok(first);
		assert.ok(second);
		assert.strictEqual(first.querySelector('.conversation-lens-history-cursor')?.textContent, '1');
		assert.strictEqual(first.querySelector('.conversation-lens-history-preview')?.textContent, 'user: Hello');
		assert.strictEqual(second.querySelector('.conversation-lens-history-preview')?.textContent, 'Reply');
		assert.strictEqual(overlayParent.querySelector('.conversation-lens-snapshots-restore'), null);
		assert.strictEqual(overlayParent.querySelector('.conversation-lens-snapshots-delete'), null);
	});

	test('connected empty engine list is honest empty, not fixture turns', async () => {
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getHistory: async () => ({ envelopes: [] }),
		}));
		list.show();
		await Promise.resolve();
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarHistoryEmpty));
		assert.strictEqual(overlayParent.querySelector(`.${conversationLensHistoryRowClass}`), null);
	});

	test('getHistory failure shows read failure copy', async () => {
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getHistory: async () => {
				throw new Error('transport reset');
			},
		}));
		list.show();
		await Promise.resolve();
		assert.strictEqual(overlayParent.querySelector(`.${conversationLensHistoryRowClass}`), null);
		assert.ok(overlayParent.textContent?.includes(formatEngineHistoryFailedCopy('transport reset')));
		assert.ok(!(overlayParent.textContent ?? '').includes(conversationLensSessionBarHistoryEmpty));
	});

	test('getHistory success then throw keeps leftover rows and paints failed', async () => {
		let listCalls = 0;
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const leftover: UniverseAgentHistoryEnvelope = {
			cursorSeq: 'leftover-1',
			payload: { text: 'Leftover' },
		};
		const liveSnapshot: UniverseAgentConnectionSnapshot = {
			transport: 'ok',
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		};
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => true,
			onDidChangeConnection: onDidChangeConnection.event,
			getHistory: async () => {
				listCalls++;
				if (listCalls === 1) {
					return { envelopes: [leftover] };
				}
				throw new Error('list boom');
			},
		}));
		list.show();
		await Promise.resolve();
		assert.strictEqual(listCalls, 1);
		assert.ok(historyRow(overlayParent, 'leftover-1'));

		onDidChangeConnection.fire(liveSnapshot);
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(listCalls, 2);
		assert.ok(historyRow(overlayParent, 'leftover-1'));
		assert.strictEqual(overlayParent.querySelectorAll(`.${conversationLensHistoryRowClass}`).length, 1);
		const failed = overlayParent.querySelector('.conversation-lens-history-status');
		assert.ok(failed);
		assert.ok(failed.textContent?.includes(formatEngineHistoryFailedCopy('list boom')));
		assert.ok(!(overlayParent.textContent ?? '').includes(conversationLensSessionBarHistoryEmpty));
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
			getHistory: async () => ({
				envelopes: [{ cursorSeq: 'live-1', payload: { text: 'Live' } }],
			}),
		}));
		list.show();
		await Promise.resolve();
		assert.ok(historyRow(overlayParent, 'live-1'));
		connected = false;
		onDidChangeConnection.fire(dropSnapshot);
		await Promise.resolve();
		assert.strictEqual(historyRow(overlayParent, 'live-1'), null);
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarHistoryUnavailableDisconnected));
	});

	test('connected phase with pairingPending keeps leftover history and paints disconnected', async () => {
		let connected = true;
		let pairingPending = false;
		let listCalls = 0;
		const leftover: UniverseAgentHistoryEnvelope = {
			cursorSeq: 'leftover-1',
			payload: { text: 'Leftover' },
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: connected ? 'ok' : 'idle',
			pairingPending,
			channelAlive: connected,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const { list, overlayParent } = mountList(createConversationConnectionTestStub({
			isEngineConnected: () => connected && !pairingPending,
			getConnectionPhase: () => ({ kind: connected ? 'connected' : 'disconnected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			getHistory: async () => {
				listCalls++;
				return { envelopes: [leftover] };
			},
		}));
		list.show();
		await Promise.resolve();
		assert.strictEqual(listCalls, 1);
		assert.ok(historyRow(overlayParent, 'leftover-1'));
		const listCallsAfterLoad = listCalls;

		pairingPending = true;
		onDidChangeConnection.fire(snapshot());
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(listCalls, listCallsAfterLoad);
		assert.ok(historyRow(overlayParent, 'leftover-1'));
		assert.strictEqual(overlayParent.querySelectorAll(`.${conversationLensHistoryRowClass}`).length, 1);
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarHistoryUnavailableDisconnected));
		assert.ok(!(overlayParent.textContent ?? '').includes(conversationLensSessionBarHistoryEmpty));

		connected = false;
		onDidChangeConnection.fire(snapshot());
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(historyRow(overlayParent, 'leftover-1'), null);
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarHistoryUnavailableDisconnected));
	});

	test('leftover-looks-live pairing-hold keeps leftover history and skips getHistory', async () => {
		let pairingPending = false;
		let listCalls = 0;
		const leftover: UniverseAgentHistoryEnvelope = {
			cursorSeq: 'leftover-1',
			payload: { text: 'Leftover' },
		};
		const onDidChangeConnection = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const snapshot = (): UniverseAgentConnectionSnapshot => ({
			transport: 'ok',
			pairingPending,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createEmptyTestCapabilitySnapshot(),
		});
		const connection = createConversationConnectionTestStub({
			isEngineConnected: () => true,
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: snapshot,
			onDidChangeConnection: onDidChangeConnection.event,
			getHistory: async () => {
				listCalls++;
				return { envelopes: [leftover] };
			},
		});
		const { list, overlayParent } = mountList(connection);
		list.show();
		await Promise.resolve();
		assert.strictEqual(listCalls, 1);
		assert.ok(historyRow(overlayParent, 'leftover-1'));
		assert.strictEqual(isConversationPairingHold(connection), false);
		const listCallsAfterLoad = listCalls;

		pairingPending = true;
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionPhase().kind, 'connected');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(isConversationPairingHold(connection), true);
		onDidChangeConnection.fire(snapshot());
		await new Promise(resolve => setTimeout(resolve, 0));

		assert.strictEqual(listCalls, listCallsAfterLoad, 'leftover-looks-live must not extra getHistory');
		assert.ok(historyRow(overlayParent, 'leftover-1'));
		assert.strictEqual(overlayParent.querySelectorAll(`.${conversationLensHistoryRowClass}`).length, 1);
		assert.ok(overlayParent.textContent?.includes(conversationLensSessionBarHistoryUnavailableDisconnected));
		assert.ok(!(overlayParent.textContent ?? '').includes(conversationLensSessionBarHistoryEmpty));
	});
});
