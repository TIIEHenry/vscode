/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { IAction } from '../../../../../base/common/actions.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../platform/commands/common/commands.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import type { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import type { ITerminalCommand } from '../../../../../platform/terminal/common/capabilities/capabilities.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IChatWidgetService } from '../../../chat/browser/chat.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { ChatAgentLocation } from '../../../chat/common/constants.js';
import { Codicon } from '../../../../../base/common/codicons.js';
import { TerminalChatAgentToolsCommandId } from '../../../terminalContrib/chatAgentTools/common/terminal.chatAgentTools.js';
import { ITerminalService } from '../../browser/terminal.js';
import { isTerminalChatAttachmentAllowed } from '../../browser/terminalChatAttachment.js';
import { getTerminalUri } from '../../browser/terminalUri.js';
import { DecorationAddon } from '../../browser/xterm/decorationAddon.js';
import { TerminalContextKeys } from '../../common/terminalContextKey.js';
import '../../../terminalContrib/chatAgentTools/browser/terminal.chatAgentTools.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function contextKeyService(isSessionsWindow: boolean | undefined): IContextKeyService {
	return {
		getContextKeyValue: <T>(key: string) => (key === IsSessionsWindowContext.key ? isSessionsWindow : undefined) as T | undefined,
	} as IContextKeyService;
}

function mutableContext(initial: boolean): { service: IContextKeyService; set(value: boolean): void } {
	let isSessionsWindow = initial;
	return {
		set(value: boolean) {
			isSessionsWindow = value;
		},
		service: {
			getContextKeyValue: <T>(key: string) => (key === IsSessionsWindowContext.key ? isSessionsWindow : undefined) as T | undefined,
		} as IContextKeyService,
	};
}

const command = { id: 'cmd-1', command: 'echo hi', hasOutput: () => false } as ITerminalCommand;

interface IAttachProbe {
	readonly reveals: number;
	readonly lastFocusedReads: number;
	readonly locationReads: readonly ChatAgentLocation[];
	readonly added: readonly unknown[];
	readonly focused: number;
	readonly terminalContexts: number;
	readonly contextItems: number;
	widgetsVisible: boolean;
	useLastFocused: boolean;
	revealReturnsWidget: boolean;
}

interface IAttachHost {
	_getCommandActions(command: ITerminalCommand): Promise<IAction[]>;
	_createAttachToChatAction(command: ITerminalCommand): IAction | undefined;
}

function createAttachHost(context: IContextKeyService, resource = getTerminalUri('workspace', 1)): { host: IAttachHost; probe: IAttachProbe } {
	const added: unknown[] = [];
	const locationReads: ChatAgentLocation[] = [];
	let reveals = 0;
	let lastFocusedReads = 0;
	let focused = 0;
	let terminalContexts = 0;
	let contextItems = 0;
	const probeState = {
		widgetsVisible: true,
		useLastFocused: false,
		revealReturnsWidget: true,
	};
	const widget = {
		attachmentCapabilities: { supportsTerminalAttachments: true },
		attachmentModel: {
			addContext(entry: unknown) { added.push(entry); },
		},
		focusInput() { focused++; },
	};
	const host = Object.create(DecorationAddon.prototype) as IAttachHost & Record<string, unknown>;
	host._contextKeyService = context;
	host._resource = resource;
	host._registeredMenuItems = new Map();
	host._chatWidgetService = {
		getWidgetsByLocations(location: ChatAgentLocation) {
			locationReads.push(location);
			return probeState.widgetsVisible ? [widget] : [];
		},
		get lastFocusedWidget() {
			lastFocusedReads++;
			return probeState.useLastFocused ? widget : undefined;
		},
		async revealWidget() {
			reveals++;
			return probeState.revealReturnsWidget ? widget : undefined;
		},
	};
	host._instantiationService = {
		createInstance() {
			terminalContexts++;
			return { asAttachment: async () => ({ id: 'terminal-command-attachment', kind: 'terminalCommand' }) };
		},
	};
	host._contextPickService = {
		registerChatContextItem() {
			contextItems++;
			return { dispose() { } };
		},
	};
	host._store = { add(value: unknown) { return value; } };
	const probe: IAttachProbe = {
		get reveals() { return reveals; },
		get lastFocusedReads() { return lastFocusedReads; },
		locationReads,
		added,
		get focused() { return focused; },
		get terminalContexts() { return terminalContexts; },
		get contextItems() { return contextItems; },
		get widgetsVisible() { return probeState.widgetsVisible; },
		set widgetsVisible(value: boolean) { probeState.widgetsVisible = value; },
		get useLastFocused() { return probeState.useLastFocused; },
		set useLastFocused(value: boolean) { probeState.useLastFocused = value; },
		get revealReturnsWidget() { return probeState.revealReturnsWidget; },
		set revealReturnsWidget(value: boolean) { probeState.revealReturnsWidget = value; },
	};
	return { host, probe };
}

function attachAction(actions: readonly IAction[]): IAction | undefined {
	return actions.find(action => action.id === 'terminal.attachToChat');
}

interface ISelectionChat {
	readonly reveals: number;
	readonly lastFocusedReads: number;
	readonly focused: number;
	readonly added: readonly unknown[];
	readonly service: object;
}

function createSelectionChat(openWidget: boolean, hasFocused = false): ISelectionChat {
	let reveals = 0;
	let lastFocusedReads = 0;
	let focused = 0;
	const added: unknown[] = [];
	const widget = {
		attachmentModel: {
			addContext(entry: unknown) { added.push(entry); },
		},
		focusInput() { focused++; },
	};
	return {
		get reveals() { return reveals; },
		get lastFocusedReads() { return lastFocusedReads; },
		get focused() { return focused; },
		added,
		service: {
			get lastFocusedWidget() {
				lastFocusedReads++;
				return hasFocused ? widget : undefined;
			},
			async revealWidget() {
				reveals++;
				return openWidget ? widget : undefined;
			},
		},
	};
}

function selectionAccessor(isSessionsWindow: boolean, selection: string | undefined, chat: ISelectionChat): { accessor: ServicesAccessor; readonly selectionReads: number; readonly chatGets: number } {
	let selectionReads = 0;
	let chatGets = 0;
	const activeInstance = {
		get selection() {
			selectionReads++;
			return selection;
		},
	};
	return {
		get selectionReads() { return selectionReads; },
		get chatGets() { return chatGets; },
		accessor: {
			get(id: unknown) {
				if (id === IContextKeyService) {
					return contextKeyService(isSessionsWindow);
				}
				if (id === IChatWidgetService) {
					chatGets++;
					return chat.service;
				}
				if (id === ITerminalService) {
					return { activeInstance };
				}
				return {};
			},
		} as ServicesAccessor,
	};
}

async function runAddTerminalSelection(accessor: ServicesAccessor): Promise<void> {
	const command = CommandsRegistry.getCommand(TerminalChatAgentToolsCommandId.ChatAddTerminalSelection);
	assert.ok(command, 'Add Terminal Selection to Chat should remain registered');
	await command.handler(accessor);
}

const terminalReady: Record<string, ContextKeyValue> = {
	[ChatContextKeys.enabled.key]: true,
	[TerminalContextKeys.processSupported.key]: true,
	[TerminalContextKeys.textSelected.key]: true,
};

suite('Terminal chat attachments - Agents window only', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('attachment is allowed only in the Agents window', () => {
		assert.strictEqual(isTerminalChatAttachmentAllowed(contextKeyService(false)), false);
		assert.strictEqual(isTerminalChatAttachmentAllowed(contextKeyService(undefined)), false);
		assert.strictEqual(isTerminalChatAttachmentAllowed(contextKeyService(true)), true);
	});

	test('default Code window does not create Attach To Chat or reveal chat', async () => {
		const { host, probe } = createAttachHost(contextKeyService(false));

		const action = host._createAttachToChatAction(command);
		const actions = await host._getCommandActions(command);

		assert.strictEqual(action, undefined);
		assert.strictEqual(attachAction(actions), undefined);
		assert.deepStrictEqual(probe.locationReads, []);
		assert.strictEqual(probe.reveals, 0);
		assert.strictEqual(probe.lastFocusedReads, 0);
		assert.strictEqual(probe.terminalContexts, 0);
		assert.deepStrictEqual(probe.added, []);
	});

	test('Agents window still attaches a terminal command and can open chat', async () => {
		const context = mutableContext(true);
		const { host, probe } = createAttachHost(context.service);
		probe.widgetsVisible = false;

		assert.strictEqual(host._createAttachToChatAction(command), undefined);
		assert.deepStrictEqual(probe.locationReads, [ChatAgentLocation.Chat]);

		probe.widgetsVisible = true;
		const actions = await host._getCommandActions(command);
		const action = attachAction(actions);
		assert.ok(action);
		assert.strictEqual(action.label, 'Attach To Chat');

		probe.useLastFocused = true;
		await action.run();
		assert.strictEqual(probe.reveals, 0);
		assert.strictEqual(probe.lastFocusedReads, 1);
		assert.strictEqual(probe.terminalContexts, 1);
		assert.strictEqual(probe.focused, 1);
		assert.strictEqual(probe.contextItems, 0);
		assert.deepStrictEqual(probe.added, [{ id: 'terminal-command-attachment', kind: 'terminalCommand' }]);

		probe.useLastFocused = false;
		probe.widgetsVisible = false;
		await action.run();
		assert.strictEqual(probe.reveals, 1);
		assert.strictEqual(probe.added.length, 2);

		probe.revealReturnsWidget = false;
		const addedBeforeMiss = probe.added.length;
		const contextsBeforeMiss = probe.terminalContexts;
		await action.run();
		assert.strictEqual(probe.reveals, 2);
		assert.strictEqual(probe.added.length, addedBeforeMiss);
		assert.strictEqual(probe.terminalContexts, contextsBeforeMiss);

		const readsBeforeBlock = probe.lastFocusedReads;
		const revealsBeforeBlock = probe.reveals;
		context.set(false);
		await action.run();
		assert.strictEqual(probe.reveals, revealsBeforeBlock);
		assert.strictEqual(probe.lastFocusedReads, readsBeforeBlock);
		assert.strictEqual(probe.added.length, addedBeforeMiss);
		assert.strictEqual(probe.terminalContexts, contextsBeforeMiss);
	});

	test('Add Terminal Selection to Chat is hidden outside the Agents window and run returns first', async () => {
		const defaultWindow = { ...terminalReady, [IsSessionsWindowContext.key]: false };
		const agentsWindow = { ...terminalReady, [IsSessionsWindowContext.key]: true };
		const item = MenuRegistry.getMenuItems(MenuId.TerminalInstanceContext)
			.filter(isIMenuItem)
			.find(candidate => candidate.command.id === TerminalChatAgentToolsCommandId.ChatAddTerminalSelection);
		assert.ok(item, 'Add Terminal Selection to Chat should remain registered');
		assert.ok(item.when?.keys().includes(IsSessionsWindowContext.key));
		assert.ok(item.command.precondition?.keys().includes(IsSessionsWindowContext.key));
		assert.strictEqual(evalWhen(item.when, defaultWindow), false);
		assert.strictEqual(evalWhen(item.command.precondition, defaultWindow), false);
		assert.strictEqual(evalWhen(item.when, agentsWindow), true);
		assert.strictEqual(evalWhen(item.command.precondition, agentsWindow), true);
		assert.strictEqual(evalWhen(item.when, { ...agentsWindow, [TerminalContextKeys.textSelected.key]: false }), false);
		assert.strictEqual(evalWhen(item.command.precondition, { ...agentsWindow, [TerminalContextKeys.textSelected.key]: false }), true);
		assert.strictEqual(evalWhen(item.command.precondition, { ...agentsWindow, [ChatContextKeys.enabled.key]: false }), false);
		assert.strictEqual(evalWhen(item.command.precondition, {
			...agentsWindow,
			[TerminalContextKeys.processSupported.key]: false,
			[TerminalContextKeys.terminalHasBeenCreated.key]: false,
		}), false);
		assert.strictEqual(evalWhen(item.command.precondition, {
			...agentsWindow,
			[TerminalContextKeys.processSupported.key]: false,
			[TerminalContextKeys.terminalHasBeenCreated.key]: true,
		}), true);

		const paletteItem = MenuRegistry.getMenuItems(MenuId.CommandPalette)
			.filter(isIMenuItem)
			.find(candidate => candidate.command.id === TerminalChatAgentToolsCommandId.ChatAddTerminalSelection);
		assert.ok(paletteItem);
		assert.strictEqual(evalWhen(paletteItem.when, defaultWindow), false);
		assert.strictEqual(evalWhen(paletteItem.when, agentsWindow), true);

		const blocked = createSelectionChat(true);
		const codeWindow = selectionAccessor(false, 'selected text', blocked);
		await runAddTerminalSelection(codeWindow.accessor);
		assert.strictEqual(codeWindow.chatGets, 0);
		assert.strictEqual(codeWindow.selectionReads, 0);
		assert.strictEqual(blocked.reveals, 0);
		assert.strictEqual(blocked.lastFocusedReads, 0);
		assert.deepStrictEqual(blocked.added, []);
		assert.strictEqual(blocked.focused, 0);

		const revealed = createSelectionChat(true);
		const agents = selectionAccessor(true, 'selected text', revealed);
		await runAddTerminalSelection(agents.accessor);
		assert.strictEqual(revealed.reveals, 1);
		assert.strictEqual(revealed.lastFocusedReads, 1);
		assert.strictEqual(revealed.focused, 1);
		assert.strictEqual(revealed.added.length, 1);
		const attached = revealed.added[0] as { kind?: string; value?: string; icon?: unknown; name?: string };
		assert.strictEqual(attached.kind, 'generic');
		assert.strictEqual(attached.value, 'selected text');
		assert.strictEqual(attached.name, 'Terminal Selection');
		assert.strictEqual(attached.icon, Codicon.terminal);

		const focused = createSelectionChat(false, true);
		await runAddTerminalSelection(selectionAccessor(true, 'selected text', focused).accessor);
		assert.strictEqual(focused.reveals, 0);
		assert.strictEqual(focused.added.length, 1);
		assert.strictEqual(focused.focused, 1);

		const empty = createSelectionChat(true);
		const noSelection = selectionAccessor(true, undefined, empty);
		await runAddTerminalSelection(noSelection.accessor);
		assert.strictEqual(noSelection.selectionReads, 1);
		assert.strictEqual(empty.reveals, 0);
		assert.deepStrictEqual(empty.added, []);

		const missing = createSelectionChat(false);
		await runAddTerminalSelection(selectionAccessor(true, 'selected text', missing).accessor);
		assert.strictEqual(missing.reveals, 1);
		assert.deepStrictEqual(missing.added, []);
		assert.strictEqual(missing.focused, 0);
	});
});
