/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ChatModeKind } from '../../../chat/common/constants.js';
import { CHAT_OPEN_ACTION_ID } from '../../../chat/browser/actions/chatActions.js';
import { getTaskFixWithAiQuery, runTaskFixWithAiCommand } from '../../browser/abstractTaskService.js';

suite('Task error Fix with AI', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const taskError = 'Error: missing command {\n  "type": "shell"\n}';

	test('default Code window does not offer or run Fix with AI', () => {
		assert.strictEqual(getTaskFixWithAiQuery(false, true, true, taskError), undefined);
		assert.strictEqual(getTaskFixWithAiQuery(false, true, true, 'Error: missing command'), undefined);

		runTaskFixWithAiCommand(false, () => {
			throw new Error('default Code window must not open Agents chat for a task error');
		}, 'Fix this task configuration error: `Error: missing command`');
	});

	test('Agents window offers Fix with AI only when chat can take the error', () => {
		const query = getTaskFixWithAiQuery(true, true, true, taskError);
		assert.ok(query?.includes('Fix this task configuration error:'));
		assert.ok(query?.includes('```json'));
		assert.ok(query?.includes(taskError));

		assert.strictEqual(getTaskFixWithAiQuery(true, false, true, taskError), undefined);
		assert.strictEqual(getTaskFixWithAiQuery(true, true, false, taskError), undefined);
		assert.strictEqual(getTaskFixWithAiQuery(true, true, true, undefined), undefined);
		assert.strictEqual(getTaskFixWithAiQuery(true, true, true, 'Error: missing command'), undefined);

		let opened: { commandId: string; arg: { mode: ChatModeKind; query: string } } | undefined;
		runTaskFixWithAiCommand(true, (commandId, arg) => {
			opened = { commandId, arg };
		}, query!);
		assert.deepStrictEqual(opened, {
			commandId: CHAT_OPEN_ACTION_ID,
			arg: { mode: ChatModeKind.Agent, query },
		});
	});
});
