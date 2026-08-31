/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { ACTION_ASK_IN_CHAT, ACTION_START, CTX_INLINE_CHAT_FILE_BELONGS_TO_CHAT, CTX_INLINE_CHAT_HAS_AGENT, CTX_INLINE_CHAT_POSSIBLE } from '../../common/inlineChat.js';
import { EditorContextKeys } from '../../../../../editor/common/editorContextKeys.js';

import '../../browser/inlineChat.contribution.js';

function evalWhen(when: ContextKeyExpression, values: Record<string, ContextKeyValue>): boolean {
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

const agentsWindowInlineChatReady: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: true,
	[CTX_INLINE_CHAT_HAS_AGENT.key]: true,
	[CTX_INLINE_CHAT_POSSIBLE.key]: true,
	[EditorContextKeys.readOnly.key]: false,
	[EditorContextKeys.editorSimpleInput.key]: false,
	[CTX_INLINE_CHAT_FILE_BELONGS_TO_CHAT.key]: false,
	'config.inlineChat.askInChat': false,
};

const agentsWindowAskInChatReady: Record<string, ContextKeyValue> = {
	...agentsWindowInlineChatReady,
	[CTX_INLINE_CHAT_FILE_BELONGS_TO_CHAT.key]: true,
	'config.inlineChat.askInChat': true,
};

suite('InlineChatActions - default window Copilot chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window hides Open Inline Chat from Command Palette, editor context, Chat title bar, and Ctrl+I', () => {
		const commandPaletteItem = MenuRegistry.getMenuItems(MenuId.CommandPalette)
			.filter(isIMenuItem)
			.find(item => item.command.id === ACTION_START);

		assert.ok(commandPaletteItem, 'Open Inline Chat should remain registered for Agents Window');
		assert.ok(commandPaletteItem.when, 'Command Palette item should have a when clause');

		const editorContextItem = MenuRegistry.getMenuItems(MenuId.EditorContext)
			.filter(isIMenuItem)
			.find(item => item.command.id === ACTION_START);

		assert.ok(editorContextItem, 'Open Inline Chat should remain registered on editor context for Agents Window');
		assert.ok(editorContextItem.when, 'Editor context item should have a when clause');

		const chatTitleBarItem = MenuRegistry.getMenuItems(MenuId.ChatTitleBarMenu)
			.filter(isIMenuItem)
			.find(item => item.command.id === ACTION_START);

		assert.ok(chatTitleBarItem, 'Open Inline Chat should remain registered on Chat title bar for Agents Window');
		assert.ok(chatTitleBarItem.when, 'Chat title bar item should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };

		assert.strictEqual(
			evalWhen(commandPaletteItem.when, defaultWindow),
			false,
			'default Code window must hide Open Inline Chat in Command Palette'
		);
		assert.strictEqual(
			evalWhen(commandPaletteItem.when, agentsWindowInlineChatReady),
			true,
			'Agents Window may list Open Inline Chat in Command Palette'
		);
		assert.strictEqual(
			evalWhen(editorContextItem.when, defaultWindow),
			false,
			'default Code window must hide Open Inline Chat in editor context menu'
		);
		assert.strictEqual(
			evalWhen(editorContextItem.when, agentsWindowInlineChatReady),
			true,
			'Agents Window may show Open Inline Chat in editor context menu'
		);
		assert.strictEqual(
			evalWhen(chatTitleBarItem.when, defaultWindow),
			false,
			'default Code window must hide Open Inline Chat in Chat title bar menu'
		);
		assert.strictEqual(
			evalWhen(chatTitleBarItem.when, agentsWindowInlineChatReady),
			true,
			'Agents Window may show Open Inline Chat in Chat title bar menu'
		);
	});

	test('default Code window hides Ask in Chat editor entry', () => {
		const commandPaletteItem = MenuRegistry.getMenuItems(MenuId.CommandPalette)
			.filter(isIMenuItem)
			.find(item => item.command.id === ACTION_ASK_IN_CHAT);

		assert.ok(commandPaletteItem, 'Ask in Chat should remain registered for Agents Window');
		assert.ok(commandPaletteItem.when, 'Command Palette item should have a when clause');

		const editorContextItem = MenuRegistry.getMenuItems(MenuId.EditorContext)
			.filter(isIMenuItem)
			.find(item => item.command.id === ACTION_ASK_IN_CHAT);

		assert.ok(editorContextItem, 'Ask in Chat should remain registered on editor context for Agents Window');
		assert.ok(editorContextItem.when, 'Editor context item should have a when clause');

		const defaultWindow = { [IsSessionsWindowContext.key]: false };

		assert.strictEqual(
			evalWhen(commandPaletteItem.when, defaultWindow),
			false,
			'default Code window must hide Ask in Chat in Command Palette'
		);
		assert.strictEqual(
			evalWhen(commandPaletteItem.when, agentsWindowAskInChatReady),
			true,
			'Agents Window may list Ask in Chat in Command Palette'
		);
		assert.strictEqual(
			evalWhen(editorContextItem.when, defaultWindow),
			false,
			'default Code window must hide Ask in Chat in editor context menu'
		);
		assert.strictEqual(
			evalWhen(editorContextItem.when, agentsWindowAskInChatReady),
			true,
			'Agents Window may show Ask in Chat in editor context menu'
		);
	});
});
