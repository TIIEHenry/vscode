/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

suite('SessionViewHost post discipline (F2)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('core.post and takeIntents each appear once inside postAndDrain / drainIntents', () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		const leaseId = viewHost.acquireLease('sess-discipline');
		viewHost.onEngineConnectionChanged();

		const core = Reflect.get(viewHost, 'core') as { post: (...args: unknown[]) => unknown; takeIntents: (...args: unknown[]) => unknown };
		let postCalls = 0;
		let takeCalls = 0;
		const postCallerStacks: string[] = [];
		const takeCallerStacks: string[] = [];
		const origPost = core.post.bind(core);
		const origTake = core.takeIntents.bind(core);
		core.post = (...args: unknown[]) => {
			postCalls += 1;
			postCallerStacks.push(new Error().stack ?? '');
			return origPost(...args);
		};
		core.takeIntents = (...args: unknown[]) => {
			takeCalls += 1;
			takeCallerStacks.push(new Error().stack ?? '');
			return origTake(...args);
		};

		viewHost.acknowledge(leaseId, { generation: 1, frameId: 1, appliedVersion: 1 });
		assert.strictEqual(postCalls, 1);
		assert.strictEqual(takeCalls, 1);
		assert.ok(postCallerStacks[0].includes('postAndDrain'));
		assert.ok(takeCallerStacks[0].includes('drainIntents'));

		postCalls = 0;
		takeCalls = 0;
		viewHost.requestResync(leaseId);
		assert.strictEqual(postCalls, 1);
		assert.strictEqual(takeCalls, 1);
	});

	test('sessionViewHost fire-and-forget voids single-catch onUnexpectedError and eliminate double-catch', async () => {
		const seen: string[] = [];
		const origHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(err => seen.push(err instanceof Error ? err.message : String(err)));
		try {
			const connection = new TestConnection();
			const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
				orphanTimeoutMs: 0,
			}));
			const origBringUp = Reflect.get(viewHost, 'bringUpBoundSession').bind(viewHost);

			// 1. bringUpPublishedLink -> bringUpBoundSession
			viewHost.acquireLease('sess-1');
			Reflect.set(viewHost, 'bringUpBoundSession', () => Promise.reject(new Error('bringup-link-boom')));
			viewHost.onEngineConnectionChanged();
			await new Promise(resolve => setTimeout(resolve, 10));

			// 2. acquireLease (while connectionUp) -> bringUpBoundSession
			Reflect.set(viewHost, 'bringUpBoundSession', () => Promise.reject(new Error('bringup-lease-boom')));
			viewHost.acquireLease('sess-2');
			await new Promise(resolve => setTimeout(resolve, 10));
			Reflect.set(viewHost, 'bringUpBoundSession', origBringUp);

			// 3. handleIntent(chatStreamWrite) -> writeChat
			const origWriteChat = Reflect.get(viewHost, 'writeChat').bind(viewHost);
			Reflect.set(viewHost, 'writeChat', () => Promise.reject(new Error('write-chat-boom')));
			(viewHost as unknown as { handleIntent(s: string, i: unknown): void }).handleIntent('sess-1', {
				do: 'chatStreamWrite',
				correlation: 'corr-1',
				payload: {},
				chatAttemptId: 'att-1',
				writeId: 'w-1',
			});
			await new Promise(resolve => setTimeout(resolve, 10));
			Reflect.set(viewHost, 'writeChat', origWriteChat);

			// 4. handleIntent(fillHistoryGap) -> fillHistory
			const origFillHistory = Reflect.get(viewHost, 'fillHistory').bind(viewHost);
			Reflect.set(viewHost, 'fillHistory', () => Promise.reject(new Error('fill-history-boom')));
			(viewHost as unknown as { handleIntent(s: string, i: unknown): void }).handleIntent('sess-1', {
				do: 'fillHistoryGap',
				fromSeq: 1,
				toSeq: 2,
			});
			await new Promise(resolve => setTimeout(resolve, 10));
			Reflect.set(viewHost, 'fillHistory', origFillHistory);

			// 5. openSessionEventStream heartbeat arm -> sendHeartbeatAck
			await viewHost.whenEngineSessionReady('sess-1');
			const origHeartbeat = Reflect.get(viewHost, 'sendHeartbeatAck').bind(viewHost);
			Reflect.set(viewHost, 'sendHeartbeatAck', () => Promise.reject(new Error('heartbeat-ack-boom')));
			const boundSessionId = connection.subscribeCalls[0] ?? 's';
			connection.pushStreamEvent(boundSessionId, {
				heartbeat: { echo_ts: 42 },
			});
			await new Promise(resolve => setTimeout(resolve, 10));
			Reflect.set(viewHost, 'sendHeartbeatAck', origHeartbeat);
		} finally {
			setUnexpectedErrorHandler(origHandler);
		}

		assert.deepStrictEqual(seen, [
			'bringup-link-boom',
			'bringup-lease-boom',
			'write-chat-boom',
			'fill-history-boom',
			'heartbeat-ack-boom',
		]);
	});
});
