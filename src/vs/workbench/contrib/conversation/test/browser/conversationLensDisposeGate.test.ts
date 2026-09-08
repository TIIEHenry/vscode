/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applySessionViewTimeline, refreshTrajectoryRecords, type IConversationLensProjectionHost } from '../../browser/conversationLensProjection.js';
import { showPostFailure, type IConversationLensComposerChromeHost } from '../../browser/conversationLensComposerChrome.js';
import {
	conversationLensPostFailed,
	conversationLensPostFailedDisconnected,
	conversationLensPostFailedNoSession,
	type ConversationComposerPostFailureReason,
} from '../../browser/conversationLensDockStrings.js';
import { bindSessionView, resolveConfirmation, resolveQuestion, retryError, type IConversationLensSessionBindingHost } from '../../browser/conversationLensSessionBinding.js';
import type { ConversationWriteMessage, PostOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';

suite('conversation lens dispose gate', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('applySessionViewTimeline skips applyEntries after _store dispose', () => {
		let applyEntries = 0;
		const host = {
			_store: { isDisposed: true },
			sessionViewLease: { sessionId: 's1' },
			timelineTree: { applyEntries: () => { applyEntries++; } },
		} as unknown as IConversationLensProjectionHost;
		applySessionViewTimeline(host, { kind: 'baseline' });
		assert.strictEqual(applyEntries, 0);
	});

	test('refreshTrajectoryRecords skips setRecords after _store dispose', () => {
		let setRecords = 0;
		let readRecords = 0;
		const host = {
			_store: { isDisposed: true },
			filterAgentId: undefined,
			sessionViewLease: undefined,
			stubService: {
				getTrajectoryRecords: () => {
					readRecords++;
					return [];
				},
			},
			trajectoryView: { setRecords: () => { setRecords++; } },
		} as unknown as IConversationLensProjectionHost;
		refreshTrajectoryRecords(host, 's1');
		assert.strictEqual(readRecords, 0);
		assert.strictEqual(setRecords, 0);
	});

	test('refreshTrajectoryRecords still setRecords while _store is live', () => {
		let setRecords = 0;
		const host = {
			_store: { isDisposed: false },
			filterAgentId: undefined,
			sessionViewLease: undefined,
			stubService: {
				getTrajectoryRecords: () => [],
				isEngineConnected: () => false,
				getTurns: () => [],
			},
			trajectoryView: { setRecords: () => { setRecords++; } },
		} as unknown as IConversationLensProjectionHost;
		refreshTrajectoryRecords(host, 's1');
		assert.strictEqual(setRecords, 1);
	});

	test('bindSessionView skips applyEntries after _store dispose', () => {
		const lifetime = new DisposableStore();
		lifetime.dispose();
		let applyEntries = 0;
		let acquire = 0;
		const host = {
			_store: { isDisposed: true },
			sessionViewLifetime: lifetime,
			sessionViewLease: { sessionId: 's1' },
			lastAttachedEntries: [],
			stubService: {
				isEngineConnected: () => false,
				acquireSessionView: () => {
					acquire++;
					return { sessionId: 's1', snapshot: { sessionId: 's1' } };
				},
			},
			timelineTree: { applyEntries: () => { applyEntries++; } },
		} as unknown as IConversationLensSessionBindingHost;
		bindSessionView(host, '');
		assert.strictEqual(applyEntries, 0);
		assert.strictEqual(acquire, 0);
	});

	test('bindSessionView still applyEntries empty tree while _store is live', () => {
		const lifetime = new DisposableStore();
		let applyEntries = 0;
		const host = {
			_store: { isDisposed: false },
			sessionViewLifetime: lifetime,
			sessionViewLease: { sessionId: 's1' },
			lastAttachedEntries: [{ id: 't1' }],
			stubService: {
				isEngineConnected: () => false,
			},
			timelineTree: { applyEntries: () => { applyEntries++; } },
		} as unknown as IConversationLensSessionBindingHost;
		bindSessionView(host, '');
		assert.strictEqual(applyEntries, 1);
		assert.strictEqual(host.sessionViewLease, undefined);
		assert.deepStrictEqual(host.lastAttachedEntries, []);
		lifetime.dispose();
	});

	test('retryError posts continueGeneration on the bound lease and does not call roster.retryError', async () => {
		const posted: ConversationWriteMessage[] = [];
		let rosterRetry = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (msg: ConversationWriteMessage): Promise<PostOutcome> => {
				posted.push(msg);
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				retryError: () => {
					rosterRetry++;
					return true;
				},
			},
			showPostFailure: () => { },
		} as unknown as IConversationLensSessionBindingHost;

		retryError(host, { id: '  msg-1  ', turnId: '  turn-1  ', agentId: '  sub:a  ' });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.deepStrictEqual(posted, [{
			kind: 'continueGeneration',
			agentId: 'sub:a',
			turnId: 'turn-1',
			messageId: 'msg-1',
		}]);
		assert.strictEqual(rosterRetry, 0);
	});

	test('retryError omitted turnId and agentId fall back to messageId and root', async () => {
		const posted: ConversationWriteMessage[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (msg: ConversationWriteMessage): Promise<PostOutcome> => {
				posted.push(msg);
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: { retryError: () => true },
			showPostFailure: () => { },
		} as unknown as IConversationLensSessionBindingHost;

		retryError(host, { id: 'msg-only' });
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.deepStrictEqual(posted, [{
			kind: 'continueGeneration',
			agentId: 'root',
			turnId: 'msg-only',
			messageId: 'msg-only',
		}]);
	});

	test('retryError blank messageId posts nothing', async () => {
		let postBound = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				postBound++;
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: { retryError: () => true },
			showPostFailure: () => { },
		} as unknown as IConversationLensSessionBindingHost;

		retryError(host, { id: '   ' });
		assert.strictEqual(postBound, 0);
	});

	test('retryError postBound reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				throw new Error('postBound boom');
			},
			stubService: { retryError: () => true },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			retryError(host, { id: 'msg-1' });
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveConfirmation postBound reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let focused = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				throw new Error('postBound boom');
			},
			stubService: { isEngineConnected: () => false },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			void resolveConfirmation(host, 'turn-1', 'allowed');
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(focused, 0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveQuestion postBound reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let focused = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				throw new Error('postBound boom');
			},
			stubService: { isEngineConnected: () => false },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			void resolveQuestion(host, 'turn-1', 'req-1', { q1: { selectedLabels: ['a'] } });
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(focused, 0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('showPostFailure failed uses retry copy not disconnected', () => {
		const gateRow = {
			hidden: true,
			setAttribute: () => { },
			removeAttribute: () => { },
		};
		const gateLabel = { textContent: '' };
		const host = {
			postFailureVisible: false,
			sendFailureTimeout: undefined as ReturnType<typeof setTimeout> | undefined,
			gateRow,
			gateLabel,
		} as unknown as IConversationLensComposerChromeHost;

		showPostFailure(host, 'failed');

		assert.strictEqual(host.postFailureVisible, true);
		assert.strictEqual(gateRow.hidden, false);
		assert.strictEqual(gateLabel.textContent, conversationLensPostFailed);
		assert.notStrictEqual(gateLabel.textContent, conversationLensPostFailedDisconnected);
		assert.notStrictEqual(gateLabel.textContent, conversationLensPostFailedNoSession);
		assert.ok(!/disconnected/i.test(gateLabel.textContent ?? ''));
		if (host.sendFailureTimeout) {
			clearTimeout(host.sendFailureTimeout);
			host.sendFailureTimeout = undefined;
		}
	});
});
