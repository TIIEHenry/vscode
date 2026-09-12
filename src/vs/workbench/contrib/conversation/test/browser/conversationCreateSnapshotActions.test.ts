/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canCreateEngineSnapshot,
	CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE,
	conversationCreateSnapshotDisconnectedCopy,
	conversationCreateSnapshotFailedCopy,
	notifyCreateSnapshotRejected,
	notifyCreateSnapshotUnavailable,
	resolveCreateSnapshotTitle,
	shouldHoldCreateSnapshotWrite,
	tryCreateSnapshotAfterPrompt,
} from '../../browser/conversationCreateSnapshotActions.contribution.js';

suite('ConversationCreateSnapshotActions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('canCreateEngineSnapshot is honest for disconnected / no hook / empty session', () => {
		assert.strictEqual(canCreateEngineSnapshot(true, true, 'ua-only'), true);
		assert.strictEqual(canCreateEngineSnapshot(false, true, 'ua-only'), false);
		assert.strictEqual(canCreateEngineSnapshot(true, false, 'ua-only'), false);
		assert.strictEqual(canCreateEngineSnapshot(true, true, ''), false);
		assert.strictEqual(canCreateEngineSnapshot(true, true, '   '), false);
		assert.strictEqual(canCreateEngineSnapshot(true, true, undefined), false);
	});

	test('resolveCreateSnapshotTitle keeps empty title and defaults when omitted', () => {
		assert.strictEqual(resolveCreateSnapshotTitle(undefined), CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE);
		assert.strictEqual(resolveCreateSnapshotTitle(''), '');
		assert.strictEqual(resolveCreateSnapshotTitle('Before refactor'), 'Before refactor');
	});

	test('notifyCreateSnapshotRejected stays silent when created', () => {
		const errors: string[] = [];
		assert.strictEqual(notifyCreateSnapshotRejected(true, true, false, {
			error: message => { errors.push(String(message)); },
		}), true);
		assert.deepStrictEqual(errors, []);
	});

	test('notifyCreateSnapshotRejected connected false uses failed copy', () => {
		const errors: string[] = [];
		assert.strictEqual(notifyCreateSnapshotRejected(false, true, false, {
			error: message => { errors.push(String(message)); },
		}), false);
		assert.deepStrictEqual(errors, [conversationCreateSnapshotFailedCopy]);
	});

	test('notifyCreateSnapshotRejected disconnected with history uses disconnected copy', () => {
		const errors: string[] = [];
		assert.strictEqual(notifyCreateSnapshotRejected(false, false, true, {
			error: message => { errors.push(String(message)); },
		}), false);
		assert.deepStrictEqual(errors, [conversationCreateSnapshotDisconnectedCopy]);
	});

	test('notifyCreateSnapshotUnavailable disconnected with history shows disconnected copy', () => {
		const errors: string[] = [];
		notifyCreateSnapshotUnavailable(false, true, {
			error: message => { errors.push(String(message)); },
		});
		assert.deepStrictEqual(errors, [conversationCreateSnapshotDisconnectedCopy]);
	});

	test('notifyCreateSnapshotUnavailable never-connected stays silent', () => {
		const errors: string[] = [];
		notifyCreateSnapshotUnavailable(false, false, {
			error: message => { errors.push(String(message)); },
		});
		assert.deepStrictEqual(errors, []);
	});

	test('pairing-hold leftover-looks-live holds write and shows disconnected copy', () => {
		const looksLive = {
			getConnectionSnapshot: () => ({ pairingPending: true }),
			getConnectionPhase: () => ({ kind: 'connected' as const, path: 'direct' as const }),
			isEngineConnected: () => true,
		};
		const live = {
			getConnectionSnapshot: () => ({ pairingPending: false }),
			getConnectionPhase: () => ({ kind: 'connected' as const, path: 'direct' as const }),
			isEngineConnected: () => true,
		};
		assert.strictEqual(looksLive.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(shouldHoldCreateSnapshotWrite(looksLive), true);
		assert.strictEqual(shouldHoldCreateSnapshotWrite(live), false);
		assert.strictEqual(canCreateEngineSnapshot(true, true, 'ua-only'), true);
		const errors: string[] = [];
		if (shouldHoldCreateSnapshotWrite(looksLive)) {
			notifyCreateSnapshotUnavailable(false, true, {
				error: message => { errors.push(String(message)); },
			});
		}
		assert.deepStrictEqual(errors, [conversationCreateSnapshotDisconnectedCopy]);
	});

	test('after prompt leftover-looks-live holds write: 0 createSnapshot + unavailable notice', () => {
		const looksLive = {
			getConnectionSnapshot: () => ({ pairingPending: true }),
			getConnectionPhase: () => ({ kind: 'connected' as const, path: 'direct' as const }),
			isEngineConnected: () => true,
		};
		assert.strictEqual(looksLive.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(looksLive.getConnectionSnapshot().pairingPending, true);
		assert.strictEqual(shouldHoldCreateSnapshotWrite(looksLive), true);
		assert.strictEqual(canCreateEngineSnapshot(looksLive.isEngineConnected(), true, 'ua-only'), true);

		const title = resolveCreateSnapshotTitle('After prompt');
		const createSnapshotCalls: { title: string }[] = [];
		const errors: string[] = [];
		const created = tryCreateSnapshotAfterPrompt(
			looksLive,
			true,
			{ error: message => { errors.push(String(message)); } },
			() => {
				createSnapshotCalls.push({ title });
				return true;
			},
			looksLive.isEngineConnected(),
		);

		assert.strictEqual(created, undefined);
		assert.strictEqual(createSnapshotCalls.length, 0, 'after-prompt leftover-looks-live must not createSnapshot');
		assert.deepStrictEqual(errors, [conversationCreateSnapshotDisconnectedCopy]);
	});
});
