/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { PostOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
import { regenerateTurn, retryError, type IConversationLensSessionBindingHost } from './conversationLensSessionBinding.js';

suite('conversationLensSessionBinding (browser)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

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

});
