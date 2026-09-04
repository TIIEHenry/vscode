/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	canCreateEngineSnapshot,
	CONVERSATION_CREATE_SNAPSHOT_DEFAULT_TITLE,
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
});
