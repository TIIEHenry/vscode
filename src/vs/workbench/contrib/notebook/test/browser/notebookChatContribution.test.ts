/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT, NOTEBOOK_CELL_OUTPUT_MIMETYPE } from '../../common/notebookContextKeys.js';
import { NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST } from '../../browser/contrib/chat/notebookChatUtils.js';

import '../../browser/controller/chat/notebook.chat.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getMenuItem(menuId: MenuId, commandId: string) {
	return MenuRegistry.getMenuItems(menuId)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const outputChatReady: Record<string, ContextKeyValue> = {
	[NOTEBOOK_CELL_HAS_OUTPUTS.key]: true,
	[NOTEBOOK_CELL_OUTPUT_MIMETYPE.key]: 'text/plain',
	[NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT.key]: NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST,
	[ChatContextKeys.enabled.key]: true,
};

const defaultWindow: Record<string, ContextKeyValue> = {
	...outputChatReady,
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...outputChatReady,
	[IsSessionsWindowContext.key]: true,
};

suite('NotebookChatContribution - default window chrome (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window hides Add Cell Output to Chat menu item', () => {
		const item = getMenuItem(MenuId.NotebookOutputToolbar, 'notebook.cellOutput.addToChat');
		assert.ok(item, 'Add Cell Output to Chat should remain registered for Agents Window');
		assert.ok(item.when, 'menu item should have a when clause');
		assert.ok(item.command.precondition, 'menu item should have a command precondition');

		assert.strictEqual(
			evalWhen(item.when, defaultWindow),
			false,
			'default Code window must hide Add Cell Output to Chat (menu when)'
		);
		assert.strictEqual(
			evalWhen(item.command.precondition, defaultWindow),
			false,
			'default Code window must hide Add Cell Output to Chat (precondition)'
		);
		assert.strictEqual(
			evalWhen(item.when, agentsWindow),
			true,
			'Agents Window may show Add Cell Output to Chat (menu when)'
		);
		assert.strictEqual(
			evalWhen(item.command.precondition, agentsWindow),
			true,
			'Agents Window may show Add Cell Output to Chat (precondition)'
		);
	});
});
