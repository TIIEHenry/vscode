/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { PostOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { ConversationComposerPostFailureReason } from '../../browser/conversationLensDockStrings.js';
import { createTestComposerModel } from './conversationComposerModelTestUtils.js';
import { applyActiveSession, copyTurn, deleteTurn, regenerateTurn, resolveConfirmation, retryError, type IConversationLensSessionBindingHost } from '../../browser/conversationLensSessionBinding.js';

suite('conversationLensSessionBinding (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createHeldRetryErrorHost(): {
		host: IConversationLensSessionBindingHost;
		boundSessionId: { current: string };
		isDisposed: { current: boolean };
		failures: ConversationComposerPostFailureReason[];
		release: (mode: 'reject' | 'throw') => void;
	} {
		let release!: (mode: 'reject' | 'throw') => void;
		const held = new Promise<'reject' | 'throw'>(resolve => {
			release = resolve;
		});
		const boundSessionId = { current: 'sess-A' };
		const isDisposed = { current: false };
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			get isDisposed() {
				return isDisposed.current;
			},
			getBoundSessionId: () => boundSessionId.current,
			postBound: async (): Promise<PostOutcome> => {
				const mode = await held;
				if (mode === 'throw') {
					throw new Error('postBound boom');
				}
				return { accepted: false, reason: 'no_such_session' };
			},
			stubService: {
				isEngineConnected: () => false,
				isEngineSessionReady: () => true,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'disconnected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;
		return { host, boundSessionId, isDisposed, failures, release };
	}

	test('retryError postBound outcome after session switch does not paint failure on the new session', async () => {
		const seen: Array<{ mode: 'reject' | 'throw'; failures: ConversationComposerPostFailureReason[] }> = [];
		for (const mode of ['reject', 'throw'] as const) {
			const fixture = createHeldRetryErrorHost();
			retryError(fixture.host, { id: 'msg-1' });
			fixture.boundSessionId.current = 'sess-B';
			fixture.release(mode);
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			seen.push({ mode, failures: fixture.failures });
		}
		assert.deepStrictEqual(seen, [
			{ mode: 'reject', failures: [] },
			{ mode: 'throw', failures: [] },
		]);
	});

	test('retryError postBound reject after dispose does not show failed', async () => {
		const fixture = createHeldRetryErrorHost();
		retryError(fixture.host, { id: 'msg-1' });
		fixture.isDisposed.current = true;
		fixture.release('throw');
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));
		assert.deepStrictEqual(fixture.failures, []);
	});

	const regenerateTurnArgs = {
		id: 'assistant-1',
		userTurnId: 'user-1',
		preservedContent: 'hello',
	} as const;

	test('regenerateTurn postBound outcome after session switch does not paint failure on the new session', async () => {
		const seen: Array<{ mode: 'reject' | 'throw'; failures: ConversationComposerPostFailureReason[] }> = [];
		for (const mode of ['reject', 'throw'] as const) {
			const fixture = createHeldRetryErrorHost();
			regenerateTurn(fixture.host, regenerateTurnArgs);
			fixture.boundSessionId.current = 'sess-B';
			fixture.release(mode);
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			seen.push({ mode, failures: fixture.failures });
		}
		assert.deepStrictEqual(seen, [
			{ mode: 'reject', failures: [] },
			{ mode: 'throw', failures: [] },
		]);
	});

	test('regenerateTurn postBound reject after dispose does not show failed', async () => {
		const fixture = createHeldRetryErrorHost();
		regenerateTurn(fixture.host, regenerateTurnArgs);
		fixture.isDisposed.current = true;
		fixture.release('throw');
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));
		assert.deepStrictEqual(fixture.failures, []);
	});

	function createRecordingHost(options: { accepted?: boolean; forwarded?: boolean; clipboardFails?: boolean } = {}) {
		const log: string[] = [];
		const host = {
			isDisposed: false,
			getBoundSessionId: () => 'sess-A',
			postBound: async (): Promise<PostOutcome> => options.accepted ? { accepted: true, correlation: { id: 'corr-1' } } : { accepted: false, reason: 'mailbox_full' },
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				hasEngineConnectionHistory: () => true,
				getSessionSource: () => 'local',
				resolveConfirmation: () => options.forwarded === true,
				deleteTurn: () => false,
			},
			uaConnection: {
				getConnectionPhase: () => ({ kind: 'connected', path: 'loopback' }),
				getConnectionSnapshot: () => ({ pairingPending: false }),
			},
			clipboardService: {
				writeText: async () => {
					if (options.clipboardFails) {
						throw new Error('denied');
					}
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => log.push(`postFailure:${reason}`),
			clearPostFailure: () => log.push('clearPostFailure'),
			noteResponseFailure: (turnId: string, error: string) => log.push(`response:${turnId}:${error}`),
			noteTurnActionFailure: (rowId: string, message: string) => log.push(`action:${rowId}:${message}`),
			settleTurnWrite: (rowId: string, accepted: boolean) => log.push(`settle:${rowId}:${accepted}`),
			focusTimelineRecord: () => log.push('focus'),
		} as unknown as IConversationLensSessionBindingHost;
		return { host, log };
	}

	async function flushPost(): Promise<void> {
		await new Promise<void>(resolve => setImmediate(() => resolve()));
	}

	test('accepted Retry settles the row and clears the composer failure row; a refused one keeps the failure', async () => {
		const accepted = createRecordingHost({ accepted: true });
		retryError(accepted.host, { id: 'err-1' });
		const refused = createRecordingHost({ accepted: false });
		retryError(refused.host, { id: 'err-2' });
		await flushPost();
		assert.deepStrictEqual({ accepted: accepted.log, refused: refused.log }, {
			accepted: ['settle:err-1:true', 'clearPostFailure'],
			refused: ['settle:err-2:false', 'postFailure:mailbox_full'],
		});
	});

	test('a refused permission answer stays on its seat, not on the composer', async () => {
		const { host, log } = createRecordingHost({ forwarded: false });
		await resolveConfirmation(host, 'perm-1', 'allowed');
		assert.deepStrictEqual(log, ['response:perm-1:the engine did not receive it']);
	});

	test('failed Delete and Copy are reported on their row', async () => {
		const deleted = createRecordingHost();
		deleteTurn(deleted.host, 'turn-9', undefined, 'row-9');
		const copied = createRecordingHost({ clipboardFails: true });
		copyTurn(copied.host, 'text', 'row-3');
		await flushPost();
		assert.deepStrictEqual({ deleted: deleted.log, copied: copied.log }, {
			deleted: ['action:row-9:Couldn\'t delete this message.'],
			copied: ['action:row-3:Couldn\'t copy to the clipboard.'],
		});
	});

	test('switching session clears the composer failure row and row-local action state', () => {
		const log: string[] = [];
		const noop = () => { };
		const host = {
			visualizeOverlay: { close: noop },
			engineHistoryList: undefined,
			engineSnapshotsList: undefined,
			inboxOverlay: { closeListPanel: noop },
			trajectoryView: { clearSessionState: noop },
			timelineTree: { clearTurnActionState: () => log.push('clearTurnActionState') },
			clearPostFailure: () => log.push('clearPostFailure'),
			exitComposerEdit: noop,
			resetInputHistoryBrowse: noop,
			refreshSessionSelectOptions: noop,
			syncSessionConfigSelects: noop,
			updateSessionTitle: noop,
			readComposerDraft: () => '',
			dockTextarea: document.createElement('textarea'),
			bindSessionView: noop,
			renderInboxStatus: noop,
			updateConversationPhase: noop,
			updateSyncChrome: noop,
			composerModel: createTestComposerModel(store),
			getBoundSessionId: () => 'sess-B',
			stubService: {},
			uaConnection: {},
		} as unknown as IConversationLensSessionBindingHost;
		applyActiveSession(host, 'sess-B');
		assert.deepStrictEqual(log, ['clearPostFailure', 'clearTurnActionState']);
	});

});
