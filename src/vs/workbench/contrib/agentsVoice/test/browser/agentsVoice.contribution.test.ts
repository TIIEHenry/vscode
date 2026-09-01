/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import type { ContextKeyExpression, ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { AGENTS_VOICE_CONNECTED, AGENTS_VOICE_ENTITLED } from '../../common/agentsVoice.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { SHOW_VOICE_MODE_ONBOARDING_COMMAND } from '../../../chat/browser/speechToText/micButtonMenuActions.js';

import '../../browser/agentsVoice.contribution.js';

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

const defaultWindow: Record<string, ContextKeyValue> = {
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.enabled.key]: true,
	'config.agents.voice.enabled': true,
	[AGENTS_VOICE_ENTITLED.key]: true,
	[AGENTS_VOICE_CONNECTED.key]: true,
};

const agentsWindowVoiceReady: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	'agentsVoice.openSettings',
	SHOW_VOICE_MODE_ONBOARDING_COMMAND,
	'agentsVoice.pushToTalk',
	'agentsVoice.disconnect',
	'agentsVoice.simulateConnection',
	'agentsVoice.resetOnboarding',
];

suite('AgentsVoiceContribution - default window Command Palette', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Voice F1 commands stay in Command Palette for Agents Window only', () => {
		for (const commandId of sessionsWindowOnlyCommandIds) {
			const item = findCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, agentsWindowVoiceReady),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});
});
