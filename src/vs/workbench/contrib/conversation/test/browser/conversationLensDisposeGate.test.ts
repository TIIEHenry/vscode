/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applySessionViewTimeline, refreshTrajectoryRecords, type IConversationLensProjectionHost } from '../../browser/conversationLensProjection.js';
import { saveQueueEdit, saveTurnEdit, submitDraft, type IConversationLensComposerHost } from '../../browser/conversationLensComposer.js';
import { showPostFailure, type IConversationLensComposerChromeHost } from '../../browser/conversationLensComposerChrome.js';
import {
	conversationLensPostFailed,
	conversationLensPostFailedDisconnected,
	conversationLensPostFailedNoSession,
	type ConversationComposerPostFailureReason,
} from '../../browser/conversationLensDockStrings.js';
import { bindSessionView, cancelToolCall, copyTurn, deleteTurn, resolveConfirmation, resolveQuestion, retryError, type IConversationLensSessionBindingHost } from '../../browser/conversationLensSessionBinding.js';
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

	test('bindSessionView acquireSessionView throw shows failed and does not leave an unhandled rejection', async () => {
		const lifetime = new DisposableStore();
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let applyEntries = 0;
		const host = {
			_store: { isDisposed: false },
			sessionViewLifetime: lifetime,
			sessionViewLease: { sessionId: 'prior' },
			lastAttachedEntries: [],
			stubService: {
				isEngineConnected: () => true,
				isEngineSessionReady: () => true,
				acquireSessionView: () => {
					throw new Error('acquire boom');
				},
			},
			timelineTree: { applyEntries: () => { applyEntries++; } },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			applySessionViewTimeline: () => { },
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			bindSessionView(host, 'sess-leftover');
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.strictEqual(host.sessionViewLease, undefined);
			assert.strictEqual(applyEntries, 0);
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
			lifetime.dispose();
		}
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

	test('resolveConfirmation connected roster false shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let focused = 0;
		let forwarded = 0;
		let postBound = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				postBound++;
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => true,
				hasEngineConnectionHistory: () => false,
				resolveConfirmation: () => {
					forwarded++;
					return false;
				},
			},
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
			assert.strictEqual(forwarded, 1);
			assert.strictEqual(postBound, 0);
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(focused, 0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveConfirmation connected roster false then disconnect shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let connected = true;
		let focused = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => connected,
				hasEngineConnectionHistory: () => true,
				resolveConfirmation: () => {
					connected = false;
					return false;
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		await resolveConfirmation(host, 'turn-1', 'skipped');

		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(focused, 0);
	});

	test('resolveQuestion connected roster false shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		let focused = 0;
		let forwarded = 0;
		let postBound = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				postBound++;
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => true,
				hasEngineConnectionHistory: () => false,
				respondQuestion: () => {
					forwarded++;
					return false;
				},
			},
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
			assert.strictEqual(forwarded, 1);
			assert.strictEqual(postBound, 0);
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(focused, 0);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('resolveQuestion connected roster false then disconnect shows engine_disconnected', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let connected = true;
		let focused = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			postBound: async (): Promise<PostOutcome> => {
				return { accepted: true, correlation: { id: 'x' } };
			},
			stubService: {
				isEngineConnected: () => connected,
				hasEngineConnectionHistory: () => true,
				respondQuestion: () => {
					connected = false;
					return false;
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
			focusTimelineRecord: () => { focused++; },
		} as unknown as IConversationLensSessionBindingHost;

		await resolveQuestion(host, 'turn-1', 'req-1', { q1: { selectedLabels: ['a'] } });

		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(focused, 0);
	});

	test('submitDraft postBound reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		const host = {
			composerPolicy: 'compose',
			submitInFlight: false,
			modelSelectedIndex: 1,
			dockTextarea: { value: 'hello' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			sessionViewLease: {
				post: async () => {
					throw new Error('postBound boom');
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			void submitDraft(host);
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
			assert.strictEqual(host.submitInFlight, false);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('saveTurnEdit roster false after disconnect stays in edit and shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'turnEdit',
			editingTurnId: 'turn-1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				updateUserTurnText: () => false,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => true,
			},
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveTurnEdit(host);

		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(exited, 0);
		assert.strictEqual(host.editingTurnId, 'turn-1');
		assert.strictEqual(host.composerPolicy, 'turnEdit');
		assert.strictEqual(host.dockTextarea.value, 'revised later');
	});

	test('saveTurnEdit roster false without connection history stays in edit and shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'turnEdit',
			editingTurnId: 'turn-1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				updateUserTurnText: () => false,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveTurnEdit(host);

		assert.deepStrictEqual(failures, ['failed']);
		assert.strictEqual(exited, 0);
		assert.strictEqual(host.editingTurnId, 'turn-1');
		assert.strictEqual(host.composerPolicy, 'turnEdit');
	});

	test('saveTurnEdit roster true exits edit and does not show post failure', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		const host = {
			composerPolicy: 'turnEdit',
			editingTurnId: 'turn-1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			stubService: {
				updateUserTurnText: () => true,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			exitComposerEdit: () => { exited++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveTurnEdit(host);

		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);
	});

	test('saveQueueEdit roster false after disconnect stays in edit and shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		let released = 0;
		let renderedInbox = 0;
		const host = {
			composerPolicy: 'queueEdit',
			editingQueueItemId: 'q1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			getEditingQueueItem: () => ({ id: 'q1', content: 'queued' }),
			stubService: {
				updateMessageQueueItemContent: () => false,
				releaseMessageQueueItemHold: () => { released++; },
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => true,
			},
			exitComposerEdit: () => { exited++; },
			renderInboxStatus: () => { renderedInbox++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveQueueEdit(host);

		assert.deepStrictEqual(failures, ['engine_disconnected']);
		assert.strictEqual(exited, 0);
		assert.strictEqual(released, 0);
		assert.strictEqual(renderedInbox, 0);
		assert.strictEqual(host.editingQueueItemId, 'q1');
		assert.strictEqual(host.composerPolicy, 'queueEdit');
		assert.strictEqual(host.dockTextarea.value, 'revised later');
	});

	test('saveQueueEdit roster false without connection history stays in edit and shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		let released = 0;
		const host = {
			composerPolicy: 'queueEdit',
			editingQueueItemId: 'q1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			getEditingQueueItem: () => ({ id: 'q1', content: 'queued' }),
			stubService: {
				updateMessageQueueItemContent: () => false,
				releaseMessageQueueItemHold: () => { released++; },
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			exitComposerEdit: () => { exited++; },
			renderInboxStatus: () => { },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveQueueEdit(host);

		assert.deepStrictEqual(failures, ['failed']);
		assert.strictEqual(exited, 0);
		assert.strictEqual(released, 0);
		assert.strictEqual(host.editingQueueItemId, 'q1');
		assert.strictEqual(host.composerPolicy, 'queueEdit');
	});

	test('saveQueueEdit roster true exits edit and does not show post failure', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let exited = 0;
		let released = 0;
		let renderedInbox = 0;
		const host = {
			composerPolicy: 'queueEdit',
			editingQueueItemId: 'q1',
			dockTextarea: { value: 'revised later' },
			getBoundSessionId: () => 'sess-1',
			getEditingQueueItem: () => ({ id: 'q1', content: 'queued' }),
			stubService: {
				updateMessageQueueItemContent: () => true,
				releaseMessageQueueItemHold: () => { released++; },
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			exitComposerEdit: () => { exited++; },
			renderInboxStatus: () => { renderedInbox++; },
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensComposerHost;

		saveQueueEdit(host);

		assert.deepStrictEqual(failures, []);
		assert.strictEqual(exited, 1);
		assert.strictEqual(released, 1);
		assert.strictEqual(renderedInbox, 1);
	});

	test('copyTurn writeText reject shows failed and does not leave an unhandled rejection', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		const host = {
			clipboardService: {
				writeText: async () => {
					throw new Error('writeText boom');
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		process.on('unhandledRejection', onUnhandled);
		try {
			copyTurn(host, 'copied');
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(failures, ['failed']);
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('copyTurn writeText resolve stays silent', async () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const written: string[] = [];
		const host = {
			clipboardService: {
				writeText: async (text: string) => {
					written.push(text);
				},
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		copyTurn(host, 'copied');
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		assert.deepStrictEqual(written, ['copied']);
		assert.deepStrictEqual(failures, []);
	});

	test('deleteTurn roster false after disconnect shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let deleteCalls = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				deleteTurn: () => {
					deleteCalls++;
					return false;
				},
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => true,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		deleteTurn(host, 'turn-1');

		assert.strictEqual(deleteCalls, 1);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('deleteTurn roster false without connection history shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				deleteTurn: () => false,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		deleteTurn(host, 'turn-1');

		assert.deepStrictEqual(failures, ['failed']);
	});

	test('deleteTurn roster true stays silent', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				deleteTurn: () => true,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		deleteTurn(host, 'turn-1');

		assert.deepStrictEqual(failures, []);
	});

	test('cancelToolCall roster false after disconnect shows engine_disconnected', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		let cancelCalls = 0;
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				cancelToolCall: () => {
					cancelCalls++;
					return false;
				},
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => true,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		cancelToolCall(host, { id: 'tc-1', agentId: 'sub:a' });

		assert.strictEqual(cancelCalls, 1);
		assert.deepStrictEqual(failures, ['engine_disconnected']);
	});

	test('cancelToolCall roster false without connection history shows failed', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				cancelToolCall: () => false,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		cancelToolCall(host, { id: 'tc-1' });

		assert.deepStrictEqual(failures, ['failed']);
	});

	test('cancelToolCall roster true stays silent', () => {
		const failures: ConversationComposerPostFailureReason[] = [];
		const host = {
			getBoundSessionId: () => 'sess-1',
			stubService: {
				cancelToolCall: () => true,
				isEngineConnected: () => false,
				hasEngineConnectionHistory: () => false,
			},
			showPostFailure: (reason: ConversationComposerPostFailureReason) => {
				failures.push(reason);
			},
		} as unknown as IConversationLensSessionBindingHost;

		cancelToolCall(host, { id: 'tc-1' });

		assert.deepStrictEqual(failures, []);
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
