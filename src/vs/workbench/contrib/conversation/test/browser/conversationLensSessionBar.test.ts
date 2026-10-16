/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { beginSessionTitleEdit, updateSessionTitle, formatSessionSwitchMeta, type IConversationLensSessionBarHost } from '../../browser/conversationLensSessionBar.js';
import type { ConversationStubSession } from '../../browser/conversationStubModel.js';

suite('ConversationLensSessionBar', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function titleHost(options: {
		boundSessionId: string;
		sessions: { id: string; title: string }[];
		activeSession: { id: string; title: string };
		initialTitle?: string;
		uaConnection?: {
			getConnectionPhase: () => { kind: string; path?: string };
			getConnectionSnapshot: () => { pairingPending: boolean };
		};
	}): IConversationLensSessionBarHost {
		const sessionTitleButton = document.createElement('button');
		sessionTitleButton.textContent = options.initialTitle ?? 'Bound title';
		const sessionTitleLive = document.createElement('span');
		const sessionTitleInput = document.createElement('input');
		sessionTitleInput.hidden = true;
		return {
			getBoundSessionId: () => options.boundSessionId,
			sessionTitleButton,
			sessionTitleLive,
			sessionTitleInput,
			sessionTitleEditing: false,
			sessionTitleEditSnapshot: '',
			stubService: {
				getSessions: () => options.sessions,
				getActiveSession: () => options.activeSession,
			},
			...(options.uaConnection !== undefined ? { uaConnection: options.uaConnection } : {}),
		} as unknown as IConversationLensSessionBarHost;
	}

	test('updateSessionTitle does not borrow active session title when bound session left roster', () => {
		const host = titleHost({
			boundSessionId: 'bound-gone',
			sessions: [{ id: 'active-only', title: 'Active title' }],
			activeSession: { id: 'active-only', title: 'Active title' },
			initialTitle: 'Still bound',
		});

		updateSessionTitle(host);

		assert.strictEqual(host.sessionTitleButton.textContent, 'Still bound');
		assert.strictEqual(host.sessionTitleLive.textContent, '');
	});

	test('beginSessionTitleEdit does not open editor when bound session left roster', () => {
		const host = titleHost({
			boundSessionId: 'bound-gone',
			sessions: [{ id: 'active-only', title: 'Active title' }],
			activeSession: { id: 'active-only', title: 'Active title' },
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
		});
		host.stubService.isEngineConnected = () => true;
		host.stubService.isEngineSessionReady = () => true;

		beginSessionTitleEdit(host);

		assert.strictEqual(host.sessionTitleEditing, false);
		assert.ok(host.sessionTitleInput.hidden);
	});

	suite('formatSessionSwitchMeta', () => {
		test('returns undefined for undefined session', () => {
			assert.strictEqual(formatSessionSwitchMeta(undefined), undefined);
		});

		test('returns 1 message when turnCount is 1', () => {
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 1 };
			assert.strictEqual(formatSessionSwitchMeta(session), '1 message');
		});

		test('returns N messages when turnCount > 1', () => {
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 4 };
			assert.strictEqual(formatSessionSwitchMeta(session), '4 messages');
		});

		test('prioritizes turnCount over lastAccessedAt', () => {
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 3, lastAccessedAt: Date.now() - 60_000 };
			assert.strictEqual(formatSessionSwitchMeta(session), '3 messages');
		});

		test('falls back to lastAccessedAt when turnCount is 0', () => {
			const now = Date.now();
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 0, lastAccessedAt: now - 120_000 };
			assert.strictEqual(formatSessionSwitchMeta(session), '2 mins ago');
		});

		test('falls back to lastAccessedAt when turnCount is undefined and turns are empty', () => {
			const now = Date.now();
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], lastAccessedAt: now - 3600_000 };
			assert.strictEqual(formatSessionSwitchMeta(session), '1 hr ago');
		});

		test('converts seconds timestamp to milliseconds for relative time', () => {
			const nowSeconds = Math.floor(Date.now() / 1000);
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 0, lastAccessedAt: nowSeconds - 300 };
			assert.strictEqual(formatSessionSwitchMeta(session), '5 mins ago');
		});

		test('returns undefined when both turnCount and lastAccessedAt are 0 or empty', () => {
			const session: ConversationStubSession = { id: 's1', title: 'Test', turns: [], turnCount: 0, lastAccessedAt: 0 };
			assert.strictEqual(formatSessionSwitchMeta(session), undefined);
		});

		test('uses turns.length when turnCount is undefined and turns exist', () => {
			const session: ConversationStubSession = {
				id: 's1',
				title: 'Test',
				turns: [{ id: 't1', kind: 'user', text: 'Hi' }, { id: 't2', kind: 'assistant', text: 'Hello' }],
			};
			assert.strictEqual(formatSessionSwitchMeta(session), '2 messages');
		});
	});
});
