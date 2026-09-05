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
		assert.ok(overlayParent.textContent?.includes(formatEngineHistoryFailedCopy('transport reset')));
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
});
