/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shouldIgnoreAlreadyActiveTask } from '../../browser/abstractTaskService.js';
import { TaskRunSource } from '../../common/tasks.js';

suite('shouldIgnoreAlreadyActiveTask', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('Reconnect and FolderOpen ignore only when active.same is true', () => {
		assert.strictEqual(shouldIgnoreAlreadyActiveTask(TaskRunSource.Reconnect, { same: true }), true);
		assert.strictEqual(shouldIgnoreAlreadyActiveTask(TaskRunSource.Reconnect, undefined), false);
		assert.strictEqual(shouldIgnoreAlreadyActiveTask(TaskRunSource.Reconnect, { same: false }), false);

		assert.strictEqual(shouldIgnoreAlreadyActiveTask(TaskRunSource.FolderOpen, { same: true }), true);
		assert.strictEqual(shouldIgnoreAlreadyActiveTask(TaskRunSource.FolderOpen, { same: false }), false);

		assert.strictEqual(shouldIgnoreAlreadyActiveTask(TaskRunSource.User, { same: true }), false);
	});
});
