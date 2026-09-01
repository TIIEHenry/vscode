/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { INSTALL_DICTATION_MODEL_COMMAND_ID } from '../../../browser/speechToText/chatSpeechToTextService.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { registerInstallDictationModelAction } from '../../../electron-browser/actions/installDictationModelAction.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function findCommandPaletteItem(commandId: string) {
	return MenuRegistry.getMenuItems(MenuId.CommandPalette)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

registerInstallDictationModelAction();

const dictationReady: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.enabled.key]: true,
	'config.dictation.enabled': true,
};

const agentsWindowDictationReady: Record<string, ContextKeyValue> = {
	...dictationReady,
	[IsSessionsWindowContext.key]: true,
};

suite('InstallDictationModelAction - default window Command Palette', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Install Dictation Model F1 stays in Command Palette for Agents Window only', () => {
		const item = findCommandPaletteItem(INSTALL_DICTATION_MODEL_COMMAND_ID);
		assert.ok(item, `${INSTALL_DICTATION_MODEL_COMMAND_ID} should remain registered for Agents Window`);
		assert.ok(item.when, `${INSTALL_DICTATION_MODEL_COMMAND_ID} Command Palette item should have a when clause`);

		assert.strictEqual(
			evalWhen(item.when, dictationReady),
			false,
			'default Code window must hide Install Dictation Model in Command Palette'
		);
		assert.strictEqual(
			evalWhen(item.when, agentsWindowDictationReady),
			true,
			'Agents Window may list Install Dictation Model in Command Palette'
		);
	});
});
