/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createInputHistoryBrowseState } from '../../browser/conversationInputHistory.js';
import { exitInputHistoryBrowse, navigateInputHistory, updateSendEnabled, type IConversationLensComposerChromeHost } from '../../browser/conversationLensComposerChrome.js';
import { saveQueueEdit, saveTurnEdit, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import { applyComposerSurfaceText, CONVERSATION_REFS_MARKER } from '../../browser/conversationComposerRefs.js';
import { getConversationChatResource } from '../../common/conversationChatInput.js';
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
		pairingHold?: boolean;
		engineConnected?: boolean;
		sessionReady?: boolean;
	}): {
		host: IConversationLensComposerChromeHost;
		drafts: Map<string, string>;
		textarea: { value: string; selectionStart: number; selectionEnd: number };
		sendButton: { enabled: boolean };
	} {
		const drafts = new Map<string, string>([['sess-a', 'A']]);
		const textarea = {
			value: options.textarea,
			selectionStart: options.selectionStart ?? 0,
			selectionEnd: options.selectionEnd ?? options.selectionStart ?? 0,
		};
		const sendButton = { enabled: false };
		const engineConnected = options.engineConnected ?? false;
		const host = {
			composerPolicy: options.composerPolicy,
			inputHistoryBrowse: createInputHistoryBrowseState(),
			dockTextarea: textarea,
			sendButton,
			getBoundSessionId: () => 'sess-a',
			writeComposerDraft: (sessionId: string, text: string) => {
				drafts.set(sessionId, text);
			},
			stubService: {
				getTurns: () => options.turns,
				isEngineConnected: () => engineConnected,
				isEngineSessionReady: () => options.sessionReady ?? true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: engineConnected ? 'connected' : 'disconnected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: options.pairingHold === true }),
			},
		} as unknown as IConversationLensComposerChromeHost;
		return { host, drafts, textarea, sendButton };
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

	test('recalling input history enables Send and leaving the recall disables it', () => {
		const { host, sendButton } = historyHost({
			composerPolicy: 'compose',
			textarea: '',
			turns: [{ id: 't1', kind: 'user', text: 'sent history' }],
			engineConnected: true,
		});
		updateSendEnabled(host);
		assert.strictEqual(sendButton.enabled, false);

		assert.ok(navigateInputHistory(host, 'older'));
		assert.strictEqual(host.dockTextarea.value, 'sent history');
		assert.strictEqual(sendButton.enabled, true, 'a recalled draft must be sendable');

		assert.ok(navigateInputHistory(host, 'newer'));
		assert.strictEqual(host.dockTextarea.value, '');
		assert.strictEqual(sendButton.enabled, false, 'restoring the empty draft must disable Send');

		assert.ok(navigateInputHistory(host, 'older'));
		exitInputHistoryBrowse(host);
		assert.strictEqual(host.dockTextarea.value, '');
		assert.strictEqual(sendButton.enabled, false, 'Escape out of history must disable Send again');
	});

	test('recalling input history during pairing hold keeps Send disabled', () => {
		const { host, sendButton } = historyHost({
			composerPolicy: 'compose',
			textarea: '',
			turns: [{ id: 't1', kind: 'user', text: 'sent history' }],
			engineConnected: true,
			pairingHold: true,
		});

		assert.ok(navigateInputHistory(host, 'older'));
		assert.strictEqual(host.dockTextarea.value, 'sent history');
		assert.strictEqual(sendButton.enabled, false);
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

		textarea.selectionStart = (textarea.value as string).length;
		textarea.selectionEnd = textarea.selectionStart;
		assert.ok(navigateInputHistory(host, 'newer'));
		assert.strictEqual(textarea.value, 'newer\nstill newer');
		assert.strictEqual(textarea.selectionStart, (textarea.value as string).length);
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

	test('saveTurnEdit unchanged or whitespace-only body exits without a write or failure', () => {
		const failures: string[] = [];
		let exited = 0;
		const { host, written } = editHost([
			{ id: 'e1', kind: 'user', text: 'hello', turnId: 't1' },
		]);
		host.dockTextarea.value = 'hello';
		host.exitComposerEdit = () => { exited++; };
		host.showPostFailure = reason => { failures.push(reason); };
		host.stubService.updateUserTurnText = () => {
			written.push({ sessionId: 'should-not', turnId: 'should-not', text: 'should-not' });
			return false;
		};

		saveTurnEdit(host);
		assert.deepStrictEqual(written, []);
		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);

		exited = 0;
		host.dockTextarea.value = '  hello  ';
		saveTurnEdit(host);
		assert.deepStrictEqual(written, []);
		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);
	});

	test('saveTurnEdit confirming a loaded refs trailer does not rewrite it', () => {
		const line = getConversationChatResource('s1', 'c1').toString();
		const stored = `hello\n${CONVERSATION_REFS_MARKER}\n${line}`;
		const textarea = document.createElement('textarea');
		const composerRefResources: string[] = [];
		const failures: string[] = [];
		const written: { text: string }[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'e1',
			dockTextarea: textarea,
			composerRefResources,
			getBoundSessionId: () => 'sess-1',
			stubService: {
				getTurns: () => [{ id: 'e1', kind: 'user', text: stored, turnId: 't1' }],
				updateUserTurnText: (_sessionId: string, _turnId: string, text: string) => {
					written.push({ text });
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
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: string) => { failures.push(reason); },
		} as unknown as IConversationLensComposerHost;

		applyComposerSurfaceText(host, stored);
		saveTurnEdit(host);
		assert.deepStrictEqual(written, []);
		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);

		host.dockTextarea.value = 'hello!';
		saveTurnEdit(host);
		assert.strictEqual(written.length, 1);
		const savedTurn = (written as readonly { readonly text: string }[])[0];
		assert.ok(savedTurn.text.includes('hello!'));
		assert.ok(savedTurn.text.includes(line));
		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 2);
	});

	test('turnEdit send stays disabled when the edited user turn is gone', () => {
		const sendButton = { enabled: true };
		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'e1',
			dockTextarea: { value: 'edited body' },
			sendButton,
			getBoundSessionId: () => 'sess-1',
			stubService: {
				getTurns: () => [],
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		} as unknown as IConversationLensComposerChromeHost;

		updateSendEnabled(host);
		assert.strictEqual(sendButton.enabled, false);
	});

	test('turnEdit send stays disabled until the loaded payload changes', () => {
		const line = getConversationChatResource('s1', 'c1').toString();
		const stored = `hello\n${CONVERSATION_REFS_MARKER}\n${line}`;
		const textarea = document.createElement('textarea');
		const composerRefResources: string[] = [];
		const sendButton = { enabled: true };
		const host = {
			composerPolicy: 'turnEdit' as const,
			editingTurnId: 'e1',
			dockTextarea: textarea,
			composerRefResources,
			sendButton,
			getBoundSessionId: () => 'sess-1',
			stubService: {
				getTurns: () => [{ id: 'e1', kind: 'user', text: stored }],
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		} as unknown as IConversationLensComposerChromeHost;

		applyComposerSurfaceText(host, stored);
		updateSendEnabled(host);
		assert.strictEqual(sendButton.enabled, false);

		textarea.value = '  hello  ';
		updateSendEnabled(host);
		assert.strictEqual(sendButton.enabled, false);

		textarea.value = 'hello!';
		updateSendEnabled(host);
		assert.strictEqual(sendButton.enabled, true);
	});

	test('saveQueueEdit unchanged or whitespace-only body exits without a write or failure', () => {
		const failures: string[] = [];
		const written: string[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'queueEdit' as const,
			dockTextarea: { value: 'hello' },
			getBoundSessionId: () => 'sess-1',
			getEditingQueueItem: () => ({ id: 'q1', content: 'hello' }),
			stubService: {
				updateMessageQueueItemContent: () => {
					written.push('should-not');
					return false;
				},
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => true,
				releaseMessageQueueItemHold: () => { },
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: string) => { failures.push(reason); },
			renderInboxStatus: () => { },
		} as unknown as IConversationLensComposerHost;

		saveQueueEdit(host);
		assert.deepStrictEqual(written, []);
		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);

		exited = 0;
		host.dockTextarea.value = '  hello  ';
		host.getEditingQueueItem = () => ({ id: 'q1', content: '  hello  ' });
		saveQueueEdit(host);
		assert.deepStrictEqual(written, []);
		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);
	});

	test('saveQueueEdit confirming a loaded refs trailer does not rewrite it', () => {
		const line = getConversationChatResource('s1', 'c1').toString();
		const stored = `hello\n${CONVERSATION_REFS_MARKER}\n${line}`;
		const textarea = document.createElement('textarea');
		const composerRefResources: string[] = [];
		const failures: string[] = [];
		const written: { text: string }[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'queueEdit' as const,
			dockTextarea: textarea,
			composerRefResources,
			getBoundSessionId: () => 'sess-1',
			getEditingQueueItem: () => ({ id: 'q1', content: stored }),
			stubService: {
				updateMessageQueueItemContent: (_sessionId: string, _itemId: string, text: string) => {
					written.push({ text });
					return true;
				},
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => true,
				releaseMessageQueueItemHold: () => { },
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: string) => { failures.push(reason); },
			renderInboxStatus: () => { },
		} as unknown as IConversationLensComposerHost;

		applyComposerSurfaceText(host, stored);
		saveQueueEdit(host);
		assert.deepStrictEqual(written, []);
		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);

		host.dockTextarea.value = 'hello!';
		saveQueueEdit(host);
		assert.strictEqual(written.length, 1);
		const savedTurn = (written as readonly { readonly text: string }[])[0];
		assert.ok(savedTurn.text.includes('hello!'));
		assert.ok(savedTurn.text.includes(line));
		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 2);
	});

	test('queueEdit send stays disabled until the loaded payload changes', () => {
		const line = getConversationChatResource('s1', 'c1').toString();
		const stored = `hello\n${CONVERSATION_REFS_MARKER}\n${line}`;
		const textarea = document.createElement('textarea');
		const composerRefResources: string[] = [];
		const sendButton = { enabled: true };
		const host = {
			composerPolicy: 'queueEdit' as const,
			editingQueueItemId: 'q1',
			dockTextarea: textarea,
			composerRefResources,
			sendButton,
			getBoundSessionId: () => 'sess-1',
			stubService: {
				getMessageQueueState: () => ({
					items: [{ id: 'q1', content: stored }],
					isPaused: false,
					isProcessing: false,
				}),
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		} as unknown as IConversationLensComposerChromeHost;

		applyComposerSurfaceText(host, stored);
		updateSendEnabled(host);
		assert.strictEqual(sendButton.enabled, false);

		textarea.value = '  hello  ';
		updateSendEnabled(host);
		assert.strictEqual(sendButton.enabled, false);

		textarea.value = 'hello!';
		updateSendEnabled(host);
		assert.strictEqual(sendButton.enabled, true);
	});
});
