/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createInputHistoryBrowseState } from '../../browser/conversationInputHistory.js';
import { exitInputHistoryBrowse, navigateInputHistory, type IConversationLensComposerChromeHost } from '../../browser/conversationLensComposerChrome.js';
import { saveTurnEdit, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import { deleteActiveSession, type IConversationLensSessionBarHost } from '../../browser/conversationLensSessionBar.js';

suite('ConversationComposerEditDraft', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function deleteHost(options: {
		composerPolicy: IConversationLensSessionBarHost['composerPolicy'];
		composeDraftSnapshot: string;
		textarea: string;
		deleteResult: boolean;
	}): {
		host: IConversationLensSessionBarHost;
		drafts: Map<string, string>;
		written: string[];
	} {
		const drafts = new Map<string, string>();
		const written: string[] = [];
		const host = {
			composerPolicy: options.composerPolicy,
			composeDraftSnapshot: options.composeDraftSnapshot,
			dockTextarea: { value: options.textarea },
			getBoundSessionId: () => 'sess-a',
			writeComposerDraft: (sessionId: string, text: string) => {
				written.push(text);
				drafts.set(sessionId, text);
			},
			deleteComposerDraftsForSession: (sessionId: string) => {
				drafts.delete(sessionId);
			},
			showPostFailure: () => { },
			stubService: {
				getActiveSessionId: () => 'sess-a',
				getSessions: () => [{ id: 'sess-a' }],
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => false,
				deleteSession: () => options.deleteResult,
				onDidChangeActiveSession: new Emitter<string>().event,
				onDidChangeSession: new Emitter<string>().event,
				onDidFailEngineAction: new Emitter<{ sessionId: string; action: string }>().event,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		} as unknown as IConversationLensSessionBarHost;
		return { host, drafts, written };
	}

	function historyHost(options: {
		composerPolicy: IConversationLensComposerChromeHost['composerPolicy'];
		textarea: string;
		selectionStart?: number;
		selectionEnd?: number;
		turns: { id: string; kind: string; text: string }[];
	}): {
		host: IConversationLensComposerChromeHost;
		drafts: Map<string, string>;
		textarea: { value: string; selectionStart: number; selectionEnd: number };
	} {
		const drafts = new Map<string, string>([['sess-a', 'A']]);
		const textarea = {
			value: options.textarea,
			selectionStart: options.selectionStart ?? 0,
			selectionEnd: options.selectionEnd ?? options.selectionStart ?? 0,
		};
		const host = {
			composerPolicy: options.composerPolicy,
			inputHistoryBrowse: createInputHistoryBrowseState(),
			dockTextarea: textarea,
			getBoundSessionId: () => 'sess-a',
			writeComposerDraft: (sessionId: string, text: string) => {
				drafts.set(sessionId, text);
			},
			stubService: {
				getTurns: () => options.turns,
			},
		} as unknown as IConversationLensComposerChromeHost;
		return { host, drafts, textarea };
	}

	test('turnEdit deleteSession false keeps compose draft snapshot not bubble text', () => {
		const { host, drafts, written } = deleteHost({
			composerPolicy: 'turnEdit',
			composeDraftSnapshot: 'A',
			textarea: 'B',
			deleteResult: false,
		});

		deleteActiveSession(host);

		assert.deepStrictEqual(written, ['A', 'A']);
		assert.strictEqual(drafts.get('sess-a'), 'A');
		assert.strictEqual(host.dockTextarea.value, 'A');
	});

	test('compose deleteSession false still writes textarea into drafts', () => {
		const { host, drafts, written } = deleteHost({
			composerPolicy: 'compose',
			composeDraftSnapshot: 'A',
			textarea: 'live compose',
			deleteResult: false,
		});

		deleteActiveSession(host);

		assert.deepStrictEqual(written, ['live compose', 'live compose']);
		assert.strictEqual(drafts.get('sess-a'), 'live compose');
		assert.strictEqual(host.dockTextarea.value, 'live compose');
	});

	test('turnEdit input history does not write history text into drafts', () => {
		const { host, drafts } = historyHost({
			composerPolicy: 'turnEdit',
			textarea: '',
			turns: [{ id: 't1', kind: 'user', text: 'B' }],
		});

		assert.ok(navigateInputHistory(host, 'older'));
		assert.strictEqual(host.dockTextarea.value, 'B');
		assert.strictEqual(drafts.get('sess-a'), 'A');

		exitInputHistoryBrowse(host);
		assert.strictEqual(drafts.get('sess-a'), 'A');
	});

	test('compose input history still writes textarea into drafts', () => {
		const { host, drafts } = historyHost({
			composerPolicy: 'compose',
			textarea: '',
			turns: [{ id: 't1', kind: 'user', text: 'sent history' }],
		});

		assert.ok(navigateInputHistory(host, 'older'));
		assert.strictEqual(host.dockTextarea.value, 'sent history');
		assert.strictEqual(drafts.get('sess-a'), 'sent history');

		exitInputHistoryBrowse(host);
		assert.strictEqual(host.dockTextarea.value, '');
		assert.strictEqual(drafts.get('sess-a'), '');
	});

	test('arrow inside a recalled multi-line draft does not replace it', () => {
		const { host, drafts, textarea } = historyHost({
			composerPolicy: 'compose',
			textarea: '',
			turns: [
				{ id: 't1', kind: 'user', text: 'older\nstill older' },
				{ id: 't2', kind: 'user', text: 'newer\nstill newer' },
			],
		});

		assert.ok(navigateInputHistory(host, 'older'));
		assert.strictEqual(textarea.value, 'newer\nstill newer');
		assert.strictEqual(textarea.selectionStart, 0);
		assert.strictEqual(textarea.selectionEnd, 0);
		assert.strictEqual(drafts.get('sess-a'), 'newer\nstill newer');

		textarea.selectionStart = 'newer\n'.length;
		textarea.selectionEnd = textarea.selectionStart;
		assert.strictEqual(navigateInputHistory(host, 'older'), false);
		assert.strictEqual(textarea.value, 'newer\nstill newer');
		assert.strictEqual(host.inputHistoryBrowse.browseIndex, 0);

		textarea.selectionStart = 0;
		textarea.selectionEnd = 0;
		assert.ok(navigateInputHistory(host, 'older'));
		assert.strictEqual(textarea.value, 'older\nstill older');
		assert.strictEqual(textarea.selectionStart, 0);

		textarea.selectionStart = 2;
		textarea.selectionEnd = 2;
		assert.strictEqual(navigateInputHistory(host, 'newer'), false);
		assert.strictEqual(textarea.value, 'older\nstill older');

		textarea.selectionStart = textarea.value.length;
		textarea.selectionEnd = textarea.selectionStart;
		assert.ok(navigateInputHistory(host, 'newer'));
		assert.strictEqual(textarea.value, 'newer\nstill newer');
		assert.strictEqual(textarea.selectionStart, textarea.value.length);
	});

	test('blank lines below the first do not start input history', () => {
		const { host, textarea } = historyHost({
			composerPolicy: 'compose',
			textarea: '\n\n',
			selectionStart: 1,
			turns: [{ id: 't1', kind: 'user', text: 'sent' }],
		});

		assert.strictEqual(navigateInputHistory(host, 'older'), false);
		assert.strictEqual(textarea.value, '\n\n');
		assert.strictEqual(host.inputHistoryBrowse.browseIndex, -1);
	});

	function editHost(turns: readonly { id: string; kind: string; text: string; turnId?: string; agentId?: string; streaming?: boolean }[]): { host: IConversationLensComposerHost; written: { sessionId: string; turnId: string; text: string; agentId?: string }[] } {
		const written: { sessionId: string; turnId: string; text: string; agentId?: string }[] = [];
		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'e1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				getTurns: () => turns,
				updateUserTurnText: (sessionId: string, turnId: string, text: string, agentId?: string) => {
					written.push({ sessionId, turnId, text, agentId });
					return true;
				},
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
			exitComposerEdit() { },
			showPostFailure() { },
		} as unknown as IConversationLensComposerHost;
		return { host, written };
	}

	test('saveTurnEdit passes the user turn agentId while another agent is streaming', () => {
		const { host, written } = editHost([
			{ id: 'e1', kind: 'user', text: 'hello', turnId: 't1', agentId: 'coder' },
			{ id: 'a1', kind: 'assistant', text: 'live', streaming: true, agentId: 'sub:live' },
		]);
		saveTurnEdit(host);
		assert.deepStrictEqual(written, [{ sessionId: 'sess-1', turnId: 't1', text: 'revised later', agentId: 'coder' }]);
	});

	test('saveTurnEdit omits agentId when the user turn has none', () => {
		const { host, written } = editHost([
			{ id: 'e1', kind: 'user', text: 'hello', turnId: 't1' },
		]);
		saveTurnEdit(host);
		assert.deepStrictEqual(written, [{ sessionId: 'sess-1', turnId: 't1', text: 'revised later', agentId: undefined }]);
	});
});
