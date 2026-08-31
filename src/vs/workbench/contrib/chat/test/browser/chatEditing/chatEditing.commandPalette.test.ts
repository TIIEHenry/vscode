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
import { ChatConfiguration } from '../../../common/constants.js';
import { hasUndecidedChatEditingResourceContextKey } from '../../../common/editing/chatEditingService.js';
import { AcceptAction, AcceptAllEditsAction, RejectAction } from '../../../browser/chatEditing/chatEditingEditorActions.js';
import { ChatEditingShowChangesAction, ViewPreviousEditsAction } from '../../../browser/chatEditing/chatEditingActions.js';
import { registerChatEditorActions } from '../../../browser/chatEditing/chatEditingEditorActions.js';
import { ctxHasEditorModification, ctxIsCurrentlyBeingModified } from '../../../browser/chatEditing/chatEditingEditorContextKeys.js';

import '../../../browser/chatEditing/chatEditingActions.js';
import '../../../browser/planReviewFeedback/planReviewFeedbackEditorOverlay.js';

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

const defaultWindow: Record<string, ContextKeyValue> = {
	...chatEnabled,
	[IsSessionsWindowContext.key]: false,
	[ChatContextKeys.inChatSession.key]: true,
	[ChatContextKeys.lockedToCodingAgent.key]: false,
	[ChatContextKeys.readOnly.key]: false,
	[`config.${ChatConfiguration.CheckpointsEnabled}`]: true,
	[hasUndecidedChatEditingResourceContextKey.key]: true,
	[ctxHasEditorModification.key]: true,
	[ctxIsCurrentlyBeingModified.key]: false,
	['planReviewFeedback.hasFeedback']: true,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const sessionsWindowOnlyCommandIds = [
	ChatEditingShowChangesAction.ID,
	'workbench.action.chat.restoreLastCheckpoint',
	'chatEditor.action.navigateNext',
	'chatEditor.action.navigatePrevious',
	AcceptAction.ID,
	RejectAction.ID,
	'chatEditor.action.acceptHunk',
	'chatEditor.action.undoHunk',
	'chatEditor.action.showAccessibleDiffView',
	AcceptAllEditsAction.ID,
	'planReviewFeedback.action.navigatePrevious',
	'planReviewFeedback.action.navigateNext',
	'planReviewFeedback.action.clearAll',
];

suite('ChatEditingActions - default window Command Palette (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		registerChatEditorActions();
	});

	test('Chat editing commands stay in Command Palette for Agents Window only', () => {
		for (const commandId of sessionsWindowOnlyCommandIds) {
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

	test('View Previous Edits stays in Command Palette for Agents Window only', () => {
		const commandId = ViewPreviousEditsAction.Id;
		const item = getCommandPaletteItem(commandId);
		assert.ok(item, `${commandId} should remain registered for Agents Window`);
		assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);

		const defaultCtx = {
			...defaultWindow,
			[hasUndecidedChatEditingResourceContextKey.key]: false,
		};
		const agentsCtx = {
			...agentsWindow,
			[hasUndecidedChatEditingResourceContextKey.key]: false,
		};

		assert.strictEqual(
			evalWhen(item.when, defaultCtx),
			false,
			`default Code window must hide ${commandId} in Command Palette`
		);
		assert.strictEqual(
			evalWhen(item.when, agentsCtx),
			true,
			`Agents Window may list ${commandId} in Command Palette`
		);
	});
});
