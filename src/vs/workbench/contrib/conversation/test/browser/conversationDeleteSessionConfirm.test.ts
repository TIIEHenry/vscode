/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IConfirmation, IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { confirmDeleteConversationSession } from '../../browser/conversationDeleteSessionConfirm.js';
import { deleteActiveSession, type IConversationLensSessionBarHost } from '../../browser/conversationLensSessionBar.js';

suite('ConversationDeleteSessionConfirm', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('confirm dialog names the session and returns the boolean', async () => {
		let seen: IConfirmation | undefined;
		let confirmed = true;
		const dialog = {
			confirm: async (confirmation: IConfirmation) => {
				seen = confirmation;
				return { confirmed };
			},
		} as unknown as IDialogService;

		assert.strictEqual(await confirmDeleteConversationSession(dialog, 'Alpha'), true);
		assert.strictEqual(seen?.type, 'warning');
		assert.strictEqual(seen?.message, 'Delete session "Alpha"?');
		assert.strictEqual(seen?.detail, 'This permanently deletes the session and its messages. This cannot be undone.');
		assert.strictEqual(seen?.primaryButton, '&&Delete');

		confirmed = false;
		assert.strictEqual(await confirmDeleteConversationSession(dialog, ''), false);
		assert.strictEqual(seen?.message, 'Delete session ""?');
	});

	function barHost(options?: {
		connected?: boolean;
		ready?: boolean;
		history?: boolean;
		pairing?: boolean;
		confirm?: () => Promise<boolean>;
	}): {
		host: IConversationLensSessionBarHost;
		sessions: { id: string; title: string }[];
		failures: string[];
		draftWrites: number;
		deleteCalls: string[];
		confirms: number;
	} {
		const sessions = [{ id: 's1', title: 'Alpha' }];
		const failures: string[] = [];
		const deleteCalls: string[] = [];
		let draftWrites = 0;
		let confirms = 0;
		const connected = options?.connected ?? true;
		const host = {
			composerPolicy: 'turnEdit',
			composeDraftSnapshot: 'draft',
			getBoundSessionId: () => 's1',
			writeComposerDraft: () => { draftWrites++; },
			deleteComposerDraftsForSession: () => { },
			showPostFailure: (reason: string) => { failures.push(reason); },
			dialogService: {
				confirm: async () => {
					confirms++;
					return { confirmed: options?.confirm ? await options.confirm() : true };
				},
			},
			stubService: {
				isEngineConnected: () => connected,
				isEngineSessionReady: () => options?.ready ?? true,
				hasEngineConnectionHistory: () => options?.history ?? false,
				getActiveSessionId: () => 's1',
				getSessions: () => sessions,
				deleteSession: (sessionId: string) => {
					deleteCalls.push(sessionId);
					const index = sessions.findIndex(session => session.id === sessionId);
					if (index < 0) {
						return false;
					}
					sessions.splice(index, 1);
					return true;
				},
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: connected || options?.pairing ? 'connected' : 'disconnected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: options?.pairing === true }),
			},
		} as unknown as IConversationLensSessionBarHost;
		return {
			host,
			sessions,
			failures,
			get draftWrites() { return draftWrites; },
			deleteCalls,
			get confirms() { return confirms; },
		};
	}

	test('cancel does not delete, notify, or write the draft', async () => {
		const fixture = barHost({ confirm: async () => false });
		await deleteActiveSession(fixture.host);
		assert.strictEqual(fixture.confirms, 1);
		assert.deepStrictEqual(fixture.deleteCalls, []);
		assert.deepStrictEqual(fixture.failures, []);
		assert.strictEqual(fixture.draftWrites, 0);
		assert.deepStrictEqual(fixture.sessions.map(session => session.id), ['s1']);
	});

	test('confirm deletes the captured session', async () => {
		const fixture = barHost();
		await deleteActiveSession(fixture.host);
		assert.strictEqual(fixture.confirms, 1);
		assert.deepStrictEqual(fixture.deleteCalls, ['s1']);
		assert.deepStrictEqual(fixture.failures, []);
		assert.deepStrictEqual(fixture.sessions, []);
	});

	test('a closed write gate or a remembered disconnect does not open the dialog', async () => {
		const leftover = barHost({ ready: false });
		await deleteActiveSession(leftover.host);
		assert.strictEqual(leftover.confirms, 0);
		assert.deepStrictEqual(leftover.deleteCalls, []);
		assert.deepStrictEqual(leftover.failures, ['session_not_ready']);

		const remembered = barHost({ connected: false, history: true });
		await deleteActiveSession(remembered.host);
		assert.strictEqual(remembered.confirms, 0);
		assert.deepStrictEqual(remembered.failures, ['engine_disconnected']);
	});

	test('a session that disappears during confirm is left alone', async () => {
		const fixture = barHost({
			confirm: async () => {
				fixture.sessions.splice(0, fixture.sessions.length);
				return true;
			},
		});
		await deleteActiveSession(fixture.host);
		assert.strictEqual(fixture.confirms, 1);
		assert.deepStrictEqual(fixture.deleteCalls, []);
		assert.deepStrictEqual(fixture.failures, []);
		assert.strictEqual(fixture.draftWrites, 0);
	});
});
