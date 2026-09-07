/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applySessionViewTimeline, refreshTrajectoryRecords, type IConversationLensProjectionHost } from '../../browser/conversationLensProjection.js';
import { bindSessionView, retryError, type IConversationLensSessionBindingHost } from '../../browser/conversationLensSessionBinding.js';
import type { ConversationWriteMessage, PostOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';

suite('conversation lens dispose gate', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('applySessionViewTimeline skips applyEntries after dispose', () => {
		let applyEntries = 0;
		const host = {
			isDisposed: true,
			sessionViewLease: { sessionId: 's1' },
			timelineTree: { applyEntries: () => { applyEntries++; } },
		} as unknown as IConversationLensProjectionHost;
		applySessionViewTimeline(host, { kind: 'baseline' });
		assert.strictEqual(applyEntries, 0);
	});

	test('refreshTrajectoryRecords skips setRecords after dispose', () => {
		let setRecords = 0;
		let readRecords = 0;
		const host = {
			isDisposed: true,
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

	test('refreshTrajectoryRecords still setRecords while live', () => {
		let setRecords = 0;
		const host = {
			isDisposed: false,
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

	test('bindSessionView skips applyEntries after dispose', () => {
		const lifetime = new DisposableStore();
		lifetime.dispose();
		let applyEntries = 0;
		let acquire = 0;
		const host = {
			isDisposed: true,
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

	test('bindSessionView still applyEntries empty tree while live', () => {
		const lifetime = new DisposableStore();
		let applyEntries = 0;
		const host = {
			isDisposed: false,
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
});
