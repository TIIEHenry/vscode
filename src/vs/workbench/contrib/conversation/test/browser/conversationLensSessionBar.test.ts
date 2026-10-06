/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { beginSessionTitleEdit, updateSessionTitle, type IConversationLensSessionBarHost } from '../../browser/conversationLensSessionBar.js';

suite('ConversationLensSessionBar', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function titleHost(options: {
		boundSessionId: string;
		sessions: { id: string; title: string }[];
		activeSession: { id: string; title: string };
		initialTitle?: string;
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
		});
		host.uaConnection = {
			getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
		};
		host.stubService.isEngineConnected = () => true;
		host.stubService.isEngineSessionReady = () => true;

		beginSessionTitleEdit(host);

		assert.strictEqual(host.sessionTitleEditing, false);
		assert.ok(host.sessionTitleInput.hidden);
	});

});
