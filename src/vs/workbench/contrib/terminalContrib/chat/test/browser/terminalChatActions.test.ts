/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { type ContextKeyExpression, type ContextKeyValue, ContextKeyValue as ContextKeyValueType, IContext, IContextKeyService } from '../../../../../../platform/contextkey/common/contextkey.js';
import type { ServicesAccessor } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { ChatContextKeys } from '../../../../chat/common/actions/chatContextKeys.js';
import { ITerminalService } from '../../../../terminal/browser/terminal.js';
import { TerminalContextKeys } from '../../../../terminal/common/terminalContextKey.js';
import { TerminalChatController } from '../../browser/terminalChatController.js';
import '../../browser/terminalChatActions.js';
import '../../../../scm/browser/scm.contribution.js';
import '../../../../scm/browser/scmInput.js';
import '../../../../scm/browser/scmHistoryChatContext.js';
import '../../../../inlineChat/browser/inlineChat.contribution.js';
import { MENU_TERMINAL_CHAT_WIDGET_STATUS, TerminalChatCommandId, TerminalChatContextKeys } from '../../browser/terminalChat.js';

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

function getMenuItem(menuId: MenuId, commandId: string) {
	return MenuRegistry.getMenuItems(menuId)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

const chatReady: Record<string, ContextKeyValue> = {
	[ChatContextKeys.enabled.key]: true,
	[TerminalChatContextKeys.hasChatAgent.key]: true,
};

const defaultWindow: Record<string, ContextKeyValue> = {
	...chatReady,
	[IsSessionsWindowContext.key]: false,
};

const agentsWindow: Record<string, ContextKeyValue> = {
	...defaultWindow,
	[IsSessionsWindowContext.key]: true,
};

const agentsWindowScmInputReady: Record<string, ContextKeyValue> = {
	...agentsWindow,
	[ChatContextKeys.Setup.hidden.key]: false,
	[ChatContextKeys.Setup.disabledInWorkspace.key]: false,
	[ChatContextKeys.Setup.completed.key]: false,
	scmProvider: 'git',
};

const agentsWindowInlineChatFixReady: Record<string, ContextKeyValue> = {
	...agentsWindow,
	inlineChatHasEditsAgent: true,
	'config.inlineChat.fixDiagnostics': true,
	inlineChatFileBelongsToChat: false,
};

suite('Terminal Chat actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function hasViewInChat(overrides: Record<string, ContextKeyValue>): boolean {
		const context: IContext = {
			getValue: <T extends ContextKeyValueType>(key: string): T | undefined => overrides[key] as T | undefined,
		};
		return MenuRegistry.getMenuItems(MENU_TERMINAL_CHAT_WIDGET_STATUS)
			.filter(isIMenuItem)
			.some(item => item.command.id === TerminalChatCommandId.ViewInChat && (!item.when || item.when.evaluate(context)));
	}

	test('shows View in Chat only for local terminal chat sessions', () => {
		const base = {
			[TerminalChatContextKeys.responseContainsCodeBlock.key]: true,
			[TerminalChatContextKeys.requestActive.key]: false,
		};

		assert.deepStrictEqual({
			local: hasViewInChat({ ...base, [TerminalChatContextKeys.usesAgentHost.key]: false }),
			agentHost: hasViewInChat({ ...base, [TerminalChatContextKeys.usesAgentHost.key]: true }),
		}, {
			local: true,
			agentHost: false,
		});
	});
});

suite('NonChatCopilotChrome - default window menus (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const terminalChatPaletteOnlyIds = [
		TerminalChatCommandId.FocusMostRecentChatTerminal,
		TerminalChatCommandId.FocusMostRecentChatTerminalOutput,
	];

	const scmChatMenuIds: Array<{ menuId: MenuId; commandId: string }> = [
		{ menuId: MenuId.SCMInputBox, commandId: 'scm.input.triggerSetup' },
		{ menuId: MenuId.EditorContent, commandId: 'scm.editor.triggerSetup' },
		{ menuId: MenuId.SCMHistoryItemContext, commandId: 'workbench.scm.action.graph.addHistoryItemToChat' },
		{ menuId: MenuId.SCMHistoryItemContext, commandId: 'workbench.scm.action.graph.summarizeHistoryItem' },
		{ menuId: MenuId.SCMHistoryItemChangeContext, commandId: 'workbench.scm.action.graph.addHistoryItemChangeToChat' },
	];

	test('default Code window hides Terminal Inline Chat from Command Palette and context menu', () => {
		const startPaletteItem = getCommandPaletteItem(TerminalChatCommandId.Start);
		assert.ok(startPaletteItem, `${TerminalChatCommandId.Start} should remain registered for Agents Window`);
		assert.ok(startPaletteItem.when, `${TerminalChatCommandId.Start} Command Palette item should have a when clause`);
		const terminalReady = { [TerminalContextKeys.processSupported.key]: true };
		assert.strictEqual(
			evalWhen(startPaletteItem.when, defaultWindow),
			false,
			`default Code window must hide ${TerminalChatCommandId.Start} in Command Palette`
		);
		assert.strictEqual(
			evalWhen(startPaletteItem.when, { ...defaultWindow, ...terminalReady }),
			false,
			`default Code window must hide ${TerminalChatCommandId.Start} in Command Palette even when a terminal process is supported`
		);
		assert.strictEqual(
			evalWhen(startPaletteItem.when, { ...agentsWindow, ...terminalReady }),
			true,
			`Agents Window may list ${TerminalChatCommandId.Start} in Command Palette`
		);

		const closePaletteItem = getCommandPaletteItem(TerminalChatCommandId.Close);
		assert.ok(closePaletteItem, `${TerminalChatCommandId.Close} should remain registered for Agents Window`);
		assert.ok(closePaletteItem.when, `${TerminalChatCommandId.Close} Command Palette item should have a when clause`);
		assert.strictEqual(
			evalWhen(closePaletteItem.when, defaultWindow),
			false,
			`default Code window must hide ${TerminalChatCommandId.Close} in Command Palette`
		);
		assert.strictEqual(
			evalWhen(closePaletteItem.when, { ...agentsWindow, [TerminalChatContextKeys.visible.key]: true }),
			true,
			`Agents Window may list ${TerminalChatCommandId.Close} in Command Palette`
		);

		const hiddenPaletteItem = getCommandPaletteItem(TerminalChatCommandId.ViewHiddenChatTerminals);
		assert.ok(hiddenPaletteItem, `${TerminalChatCommandId.ViewHiddenChatTerminals} should remain registered for Agents Window`);
		assert.ok(hiddenPaletteItem.when, `${TerminalChatCommandId.ViewHiddenChatTerminals} Command Palette item should have a when clause`);
		assert.strictEqual(
			evalWhen(hiddenPaletteItem.when, defaultWindow),
			false,
			`default Code window must hide ${TerminalChatCommandId.ViewHiddenChatTerminals} in Command Palette`
		);
		assert.strictEqual(
			evalWhen(hiddenPaletteItem.when, { ...agentsWindow, [TerminalChatContextKeys.hasHiddenChatTerminals.key]: true }),
			true,
			`Agents Window may list ${TerminalChatCommandId.ViewHiddenChatTerminals} in Command Palette`
		);

		const contextItem = getMenuItem(MenuId.TerminalInstanceContext, TerminalChatCommandId.Start);
		assert.ok(contextItem, 'Terminal Open Inline Chat should remain registered for Agents Window');
		assert.ok(contextItem.when, 'Terminal context menu item should have a when clause');
		assert.strictEqual(
			evalWhen(contextItem.when, defaultWindow),
			false,
			'default Code window must hide Terminal Open Inline Chat in terminal context menu'
		);
		assert.strictEqual(
			evalWhen(contextItem.when, agentsWindow),
			true,
			'Agents Window may show Terminal Open Inline Chat in terminal context menu'
		);
	});

	test('default Code window hides Terminal Chat focus commands from Command Palette', () => {
		const inChatSession = {
			...agentsWindow,
			[ChatContextKeys.inChatSession.key]: true,
		};
		const defaultInChatSession = {
			...defaultWindow,
			[ChatContextKeys.inChatSession.key]: true,
		};

		for (const commandId of terminalChatPaletteOnlyIds) {
			const item = getCommandPaletteItem(commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} Command Palette item should have a when clause`);
			assert.strictEqual(
				evalWhen(item.when, defaultInChatSession),
				false,
				`default Code window must hide ${commandId} in Command Palette`
			);
			assert.strictEqual(
				evalWhen(item.when, inChatSession),
				true,
				`Agents Window may list ${commandId} in Command Palette`
			);
		}
	});

	test('default Code window hides SCM and inline-chat Fix diagnostics Copilot menus', () => {
		const scmAgentsContextByCommandId: Record<string, Record<string, ContextKeyValue>> = {
			'scm.input.triggerSetup': agentsWindowScmInputReady,
			'workbench.scm.action.graph.addHistoryItemToChat': agentsWindow,
			'workbench.scm.action.graph.summarizeHistoryItem': agentsWindow,
			'workbench.scm.action.graph.addHistoryItemChangeToChat': agentsWindow,
		};

		for (const { menuId, commandId } of scmChatMenuIds) {
			const item = getMenuItem(menuId, commandId);
			assert.ok(item, `${commandId} should remain registered for Agents Window`);
			assert.ok(item.when, `${commandId} menu item should have a when clause`);
			assert.strictEqual(
				evalWhen(item.when, defaultWindow),
				false,
				`default Code window must hide ${commandId} in ${String(menuId)}`
			);

			const agentsContext = scmAgentsContextByCommandId[commandId];
			if (agentsContext) {
				assert.strictEqual(
					evalWhen(item.when, agentsContext),
					true,
					`Agents Window may show ${commandId} in ${String(menuId)}`
				);
			}
		}

		const fixItem = getMenuItem(MenuId.MarkerHoverStatusBar, 'inlineChat.fixDiagnostics');
		assert.ok(fixItem, 'inlineChat.fixDiagnostics should remain registered for Agents Window');
		assert.ok(fixItem.when, 'Fix diagnostics marker hover item should have a when clause');
		assert.strictEqual(
			evalWhen(fixItem.when, defaultWindow),
			false,
			'default Code window must hide inlineChat.fixDiagnostics in marker hover'
		);
		assert.strictEqual(
			evalWhen(fixItem.when, agentsWindowInlineChatFixReady),
			true,
			'Agents Window may show inlineChat.fixDiagnostics in marker hover'
		);
	});
});

interface ITerminalInlineChatStartCounts {
	updateInput: number;
	acceptInput: number;
	reveal: number;
	query: string | undefined;
}

function runTerminalInlineChatStart(isSessionsWindow: boolean | undefined, opts: unknown): ITerminalInlineChatStartCounts {
	const counts: ITerminalInlineChatStartCounts = { updateInput: 0, acceptInput: 0, reveal: 0, query: undefined };
	const controller = {
		updateInput(query: string): void {
			counts.updateInput++;
			counts.query = query;
		},
		terminalChatWidget: {
			acceptInput(): void {
				counts.acceptInput++;
			},
			reveal(): void {
				counts.reveal++;
			},
		},
	};
	const activeInstance = {
		instanceId: 1,
		xterm: {},
		getContribution: (id: string) => id === TerminalChatController.ID ? controller : undefined,
	};
	const accessor = {
		get(id: unknown) {
			if (id === IContextKeyService) {
				return {
					getContextKeyValue: <T>(key: string) => (key === IsSessionsWindowContext.key ? isSessionsWindow : undefined) as T | undefined,
				};
			}
			if (id === ITerminalService) {
				return {
					detachedInstances: [],
					activeInstance,
				};
			}
			return {};
		},
	} as ServicesAccessor;
	const previous = TerminalChatController.activeChatController;
	TerminalChatController.activeChatController = undefined;
	try {
		const command = CommandsRegistry.getCommand(TerminalChatCommandId.Start);
		assert.ok(command, TerminalChatCommandId.Start);
		command.handler(accessor, opts);
	} finally {
		TerminalChatController.activeChatController = previous;
	}
	return counts;
}

suite('Terminal Inline Chat start - default window', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default Code window returns before updateInput, acceptInput, and reveal', () => {
		for (const isSessionsWindow of [false, undefined]) {
			const counts = runTerminalInlineChatStart(isSessionsWindow, { query: 'fix the command', isPartialQuery: false });
			assert.strictEqual(counts.updateInput, 0, String(isSessionsWindow));
			assert.strictEqual(counts.acceptInput, 0, String(isSessionsWindow));
			assert.strictEqual(counts.reveal, 0, String(isSessionsWindow));
			assert.strictEqual(counts.query, undefined, String(isSessionsWindow));
		}
	});

	test('Agents window still reveals terminal inline chat and accepts the query', () => {
		const counts = runTerminalInlineChatStart(true, { query: 'fix the command', isPartialQuery: false });
		assert.strictEqual(counts.updateInput, 1);
		assert.strictEqual(counts.acceptInput, 1);
		assert.strictEqual(counts.reveal, 1);
		assert.strictEqual(counts.query, 'fix the command');
	});
});
