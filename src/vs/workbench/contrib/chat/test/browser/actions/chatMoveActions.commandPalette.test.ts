/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { registerMoveActions } from '../../../browser/actions/chatMoveActions.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function getCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const chatEnabled = { [ChatContextKeys.enabled.key]: true };

suite('ChatMoveActions - default window Command Palette', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		registerMoveActions();
	});

	test('default Code window hides Move Chat palette entries', () => {
		const defaultWindow = { ...chatEnabled, [IsSessionsWindowContext.key]: false };
		const agentsWindow = { ...chatEnabled, [IsSessionsWindowContext.key]: true };

		const openInEditorItem = getCommandPaletteItem('workbench.action.chat.openInEditor');
		assert.strictEqual(openInEditorItem, undefined, 'Move Chat into Editor Area must stay off Command Palette (f1: false)');

		for (const commandId of [
			'workbench.action.chat.openInNewWindow',
			'workbench.action.chat.openInSidebar',
		]) {
			const item = getCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindow),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});
});
