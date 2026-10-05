/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { OS } from '../../../../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { EditorContextKeys } from '../../../../../../editor/common/editorContextKeys.js';
import { isIMenuItem, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { KeybindingsRegistry } from '../../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { IsSessionsWindowContext, ResourceContextKey } from '../../../../../common/contextkeys.js';
import { AI_CUSTOMIZATION_ITEM_TYPE_KEY, AICustomizationManagementItemMenuId } from '../../../browser/aiCustomization/aiCustomizationManagement.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { PROMPT_LANGUAGE_ID, PromptsType } from '../../../common/promptSyntax/promptTypes.js';
import { isPromptRunChatAllowed, runPromptInChat } from '../../../browser/promptSyntax/runPromptAction.js';

import '../../../browser/chat.shared.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

const promptFileEditor: Record<string, ContextKeyValue> = {
	[ChatContextKeys.enabled.key]: true,
	[IsSessionsWindowContext.key]: false,
	[EditorContextKeys.editorTextFocus.key]: true,
	[ResourceContextKey.HasResource.key]: true,
	[ResourceContextKey.LangId.key]: PROMPT_LANGUAGE_ID,
};

const agentsPromptFileEditor: Record<string, ContextKeyValue> = {
	...promptFileEditor,
	[IsSessionsWindowContext.key]: true,
};

suite('Run Prompt chat', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isPromptRunChatAllowed is true only in the Agents window', () => {
		assert.strictEqual(isPromptRunChatAllowed(false), false);
		assert.strictEqual(isPromptRunChatAllowed(undefined), false);
		assert.strictEqual(isPromptRunChatAllowed(true), true);
	});

	test('default Code window does not open a picker, create a chat, or reveal a widget', async () => {
		let runs = 0;
		const ran = await runPromptInChat({
			isSessionsWindow: false,
			run: async () => { runs++; },
		});
		assert.strictEqual(ran, false);
		assert.strictEqual(runs, 0);
	});

	test('missing window flag does not run the prompt', async () => {
		let runs = 0;
		const ran = await runPromptInChat({
			isSessionsWindow: undefined,
			run: async () => { runs++; },
		});
		assert.strictEqual(ran, false);
		assert.strictEqual(runs, 0);
	});

	test('Agents window still runs the prompt', async () => {
		let runs = 0;
		const ran = await runPromptInChat({
			isSessionsWindow: true,
			run: async () => { runs++; },
		});
		assert.strictEqual(ran, true);
		assert.strictEqual(runs, 1);
	});

	test('Run Prompt keybindings stay on the Agents window', () => {
		for (const commandId of [
			'workbench.action.chat.run.prompt',
			'workbench.action.chat.run.prompt.current',
			'workbench.action.chat.run-in-new-chat.prompt.current',
		]) {
			const keybinding = KeybindingsRegistry.getDefaultKeybindingsForOS(OS)
				.find(item => item.command === commandId);
			assert.ok(keybinding, `${commandId} keybinding should be registered`);
			assert.ok(keybinding.when, `${commandId} keybinding should have a when clause`);
			assert.strictEqual(evalWhen(keybinding.when, promptFileEditor), false, `default Code window must disable ${commandId}`);
			assert.strictEqual(evalWhen(keybinding.when, agentsPromptFileEditor), true, `Agents window may enable ${commandId}`);
		}
	});

	test('Customizations Run Prompt stays hidden outside the Agents window', () => {
		const item = MenuRegistry.getMenuItems(AICustomizationManagementItemMenuId)
			.filter(isIMenuItem)
			.find(entry => entry.command.id === 'aiCustomizationManagement.runPrompt');
		assert.ok(item, 'Run Prompt should remain registered for the Agents window');
		assert.ok(item.when, 'Run Prompt menu item should have a when clause');

		const promptItem = { [AI_CUSTOMIZATION_ITEM_TYPE_KEY]: PromptsType.prompt };
		assert.strictEqual(
			evalWhen(item.when, { ...promptFileEditor, ...promptItem }),
			false,
			'default Code window must hide Run Prompt on a prompt item'
		);
		assert.strictEqual(
			evalWhen(item.when, { ...agentsPromptFileEditor, ...promptItem }),
			true,
			'Agents window may show Run Prompt on a prompt item'
		);
		assert.strictEqual(
			evalWhen(item.when, { ...agentsPromptFileEditor, [AI_CUSTOMIZATION_ITEM_TYPE_KEY]: PromptsType.skill }),
			false,
			'Agents window must not show Run Prompt on a non-prompt item'
		);
	});
});
