/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { applySessionViewTimeline, refreshTrajectoryRecords, type IConversationLensProjectionHost } from '../../browser/conversationLensProjection.js';
import { bindSessionView, type IConversationLensSessionBindingHost } from '../../browser/conversationLensSessionBinding.js';

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
});
