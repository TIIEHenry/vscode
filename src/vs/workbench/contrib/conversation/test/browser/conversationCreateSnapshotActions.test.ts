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
});
