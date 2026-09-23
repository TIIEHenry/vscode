/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createInputHistoryBrowseState } from '../../browser/conversationInputHistory.js';
import { exitInputHistoryBrowse, navigateInputHistory, type IConversationLensComposerChromeHost } from '../../browser/conversationLensComposerChrome.js';
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
		turns: { id: string; kind: string; text: string }[];
	}): {
		host: IConversationLensComposerChromeHost;
		drafts: Map<string, string>;
	} {
		const drafts = new Map<string, string>([['sess-a', 'A']]);
		const host = {
			composerPolicy: options.composerPolicy,
			inputHistoryBrowse: createInputHistoryBrowseState(),
			dockTextarea: { value: options.textarea },
			getBoundSessionId: () => 'sess-a',
			writeComposerDraft: (sessionId: string, text: string) => {
				drafts.set(sessionId, text);
			},
			stubService: {
				getTurns: () => options.turns,
			},
		} as unknown as IConversationLensComposerChromeHost;
		return { host, drafts };
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
});
