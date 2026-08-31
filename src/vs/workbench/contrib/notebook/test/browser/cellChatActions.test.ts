/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { CTX_NOTEBOOK_CHAT_HAS_AGENT } from '../../browser/controller/chat/notebookChatContext.js';
import { NotebookSetting } from '../../common/notebookCommon.js';
import { NOTEBOOK_EDITOR_EDITABLE } from '../../common/notebookContextKeys.js';

import '../../browser/controller/chat/cellChatActions.js';

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

const notebookChatReady: Record<string, ContextKeyValue> = {
	[NOTEBOOK_EDITOR_EDITABLE.key]: true,
	[CTX_NOTEBOOK_CHAT_HAS_AGENT.key]: true,
	[`config.${NotebookSetting.cellChat}`]: true,
	[`config.${NotebookSetting.cellGenerate}`]: true,
	'config.notebook.insertToolbarLocation': 'notebookToolbar',
};

const defaultWindow: Record<string, ContextKeyValue> = {
	...notebookChatReady,
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...notebookChatReady,
	[IsSessionsWindowContext.key]: true,
};

const generateCodeMenuTargets: { menuId: MenuId; commandId: string; label: string }[] = [
	{ menuId: MenuId.NotebookCellBetween, commandId: 'notebook.cell.chat.start', label: 'NotebookCellBetween Generate' },
	{ menuId: MenuId.NotebookCellListTop, commandId: 'notebook.cell.chat.startAtTop', label: 'NotebookCellListTop Generate' },
	{ menuId: MenuId.NotebookToolbar, commandId: 'notebook.cell.chat.start', label: 'NotebookToolbar Generate' },
];

suite('NotebookCellChatActions - default window chrome (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window hides Generate / Start Chat notebook cell menu items', () => {
		for (const { menuId, commandId, label } of generateCodeMenuTargets) {
			const item = getMenuItem(menuId, commandId);
			assert.ok(item, `${label} should remain registered for Agents Window`);
			assert.ok(item.when, `${label} menu item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${label}`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`Agents Window may show ${label}`
			);
		}
	});
});
