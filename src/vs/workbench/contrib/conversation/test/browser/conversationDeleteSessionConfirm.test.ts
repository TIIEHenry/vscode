/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import type { UniverseAgentConnectionSnapshot } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IConfirmation, IDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { captureConversationDeleteOwner, confirmDeleteConversationSession, guardConversationDeleteConfirmation } from '../../browser/conversationDeleteSessionConfirm.js';
import { deleteActiveSession, type IConversationLensSessionBarHost } from '../../browser/conversationLensSessionBar.js';

suite('ConversationDeleteSessionConfirm', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

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
			isDisposed: false,
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
				onDidChangeEngineConnection: Event.None,
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
			uaConnection: createConversationConnectionTestStub({
				getConnectionPhase: () => ({ kind: connected || options?.pairing ? 'connected' : 'disconnected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ ...createConversationConnectionTestStub().getConnectionSnapshot(), pairingPending: options?.pairing === true }),
			}),
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
	for (const change of ['engine', 'link', 'disconnect-return', 'dispose', 'session'] as const) {
		test(`SessionBar drops a pending confirmation after ${change}`, async () => {
			const answer = new DeferredPromise<boolean>();
			const fixture = barHost({ confirm: () => answer.p });
			const changes = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
			let snapshot = fixture.host.uaConnection.getConnectionSnapshot();
			let disposed = false;
			let sessionId = 's1';
			Object.defineProperty(fixture.host, 'isDisposed', { get: () => disposed });
			fixture.host.getBoundSessionId = () => sessionId;
			Object.defineProperty(fixture.host, 'uaConnection', { value: createConversationConnectionTestStub({
				getConnectionSnapshot: () => snapshot,
				onDidChangeConnection: changes.event,
			}) });
			const deleting = deleteActiveSession(fixture.host);
			if (change === 'engine') {
				snapshot = { ...snapshot, engineIdentityId: 'engine-b' };
			} else if (change === 'link') {
				snapshot = { ...snapshot, linkId: 2 };
			} else if (change === 'disconnect-return') {
				changes.fire({ ...snapshot, phase: { kind: 'disconnected' } });
			} else if (change === 'dispose') {
				disposed = true;
			} else {
				sessionId = 's2';
			}
			changes.fire(snapshot);
			await answer.complete(true);
			await deleting;
			assert.deepStrictEqual({ deleted: fixture.deleteCalls, writes: fixture.draftWrites, failures: fixture.failures }, { deleted: [], writes: 0, failures: [] });
			assert.strictEqual(changes.hasListeners(), false, 'confirmation subscriptions are released');
		});
	}

	test('owner capture rejects invalid Engine links and accepts an identity-less live link', () => {
		const fixture = barHost();
		for (const linkId of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
			const connection = createConversationConnectionTestStub({ getConnectionSnapshot: () => ({ ...fixture.host.uaConnection.getConnectionSnapshot(), linkId }) });
			assert.strictEqual(captureConversationDeleteOwner(fixture.host.stubService, connection), undefined);
		}
		const connection = createConversationConnectionTestStub({ getConnectionSnapshot: () => ({ ...fixture.host.uaConnection.getConnectionSnapshot(), engineIdentityId: undefined, linkId: 7 }) });
		assert.deepStrictEqual(captureConversationDeleteOwner(fixture.host.stubService, connection), { kind: 'engine', engineIdentityId: undefined, linkId: 7 });
	});

	test('unrelated capability notifications preserve a confirmation and local-to-engine changes invalidate it', () => {
		const fixture = barHost({ connected: false });
		const changes = store.add(new Emitter<UniverseAgentConnectionSnapshot>());
		const connection = createConversationConnectionTestStub({ onDidChangeConnection: changes.event });
		const owner = captureConversationDeleteOwner(fixture.host.stubService, connection)!;
		const guard = store.add(guardConversationDeleteConfirmation(owner, fixture.host.stubService, connection));
		changes.fire(connection.getConnectionSnapshot());
		assert.strictEqual(guard.isCurrent(), true);
		changes.fire({ ...connection.getConnectionSnapshot(), phase: { kind: 'connected', path: 'loopback' } });
		changes.fire(connection.getConnectionSnapshot());
		assert.strictEqual(guard.isCurrent(), false);
	});

	for (const accepted of [true, false]) {
		test(`SessionBar synchronous delete ${accepted} cannot settle on a replacement owner`, async () => {
			const fixture = barHost();
			let snapshot = fixture.host.uaConnection.getConnectionSnapshot();
			let cleared = 0;
			Object.defineProperty(fixture.host, 'uaConnection', { value: createConversationConnectionTestStub({ getConnectionSnapshot: () => snapshot }) });
			fixture.host.deleteComposerDraftsForSession = () => { cleared++; };
			fixture.host.stubService.deleteSession = () => {
				snapshot = { ...snapshot, linkId: 2 };
				return accepted;
			};
			await deleteActiveSession(fixture.host);
			assert.deepStrictEqual({ writes: fixture.draftWrites, cleared, failures: fixture.failures }, { writes: 1, cleared: 0, failures: [] });
		});
	}

});
