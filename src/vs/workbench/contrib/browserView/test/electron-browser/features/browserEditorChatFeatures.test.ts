/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, isISubmenuItem, MenuId, MenuRegistry } from '../../../../../../platform/actions/common/actions.js';
import { BrowserViewCommandId } from '../../../../../../platform/browserView/common/browserView.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import type { ServicesAccessor } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { ChatContextKeys } from '../../../../chat/common/actions/chatContextKeys.js';
import { BrowserEditorInput } from '../../../common/browserEditorInput.js';
import { CONTEXT_BROWSER_HAS_ERROR, CONTEXT_BROWSER_HAS_URL } from '../../../electron-browser/browserEditor.js';
import { BrowserEditorChatIntegration, isBrowserEditorChatAttachmentAllowed } from '../../../electron-browser/features/browserEditorChatFeatures.js';

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

function accessorFor(context: IContextKeyService, getOther: (id: unknown) => unknown): ServicesAccessor {
	return {
		get(id: unknown) {
			if (id === IContextKeyService) {
				return context;
			}
			return getOther(id);
		},
	} as ServicesAccessor;
}

const browserReady = {
	activeEditor: BrowserEditorInput.EDITOR_ID,
	[CONTEXT_BROWSER_HAS_URL.key]: true,
	[CONTEXT_BROWSER_HAS_ERROR.key]: false,
	[ChatContextKeys.enabled.key]: true,
	'config.workbench.browser.experimentalUserTools.enabled': true,
};
const defaultWindow = { ...browserReady, [IsSessionsWindowContext.key]: false };
const agentsWindow = { ...browserReady, [IsSessionsWindowContext.key]: true };

const chatCommandIds = [
	BrowserViewCommandId.AddElementToChat,
	BrowserViewCommandId.AddElementCommentToChat,
	BrowserViewCommandId.AddConsoleLogsToChat,
	BrowserViewCommandId.AddScreenshotToChat,
	BrowserViewCommandId.AddAreaScreenshotToChat,
	BrowserViewCommandId.AddFullPageScreenshotToChat,
];

interface ChatDouble {
	readonly reveals: number;
	readonly lastFocusedReads: number;
	readonly added: unknown[][];
	readonly preserveFocus: boolean | undefined;
	readonly service: object;
}

function createChatDouble(openWidget: boolean): ChatDouble {
	let reveals = 0;
	let lastFocusedReads = 0;
	let preserveFocus: boolean | undefined;
	const added: unknown[][] = [];
	const widget = {
		viewModel: {},
		attachmentModel: {
			addContext: (...entries: unknown[]) => { added.push(entries); },
		},
	};
	return {
		get reveals() { return reveals; },
		get lastFocusedReads() { return lastFocusedReads; },
		get preserveFocus() { return preserveFocus; },
		added,
		service: {
			async revealWidget(nextPreserveFocus?: boolean) {
				reveals++;
				preserveFocus = nextPreserveFocus;
				return openWidget ? widget : undefined;
			},
			get lastFocusedWidget() {
				lastFocusedReads++;
				return openWidget ? widget : undefined;
			},
		},
	};
}

interface BrowserChatHost {
	addConsoleLogsToChat(): Promise<void>;
	addScreenshotToChat(): Promise<void>;
	addAreaScreenshotToChat(): Promise<void>;
	addFullPageScreenshotToChat(): Promise<void>;
	readonly widgets: readonly { readonly element: unknown }[];
	_revealChatWidgetForAttachment(preserveFocus?: boolean): Promise<unknown>;
	_attachToChat(entries: readonly object[]): Promise<boolean>;
	_attachElementDataToChat(elementData: object, model: object): Promise<boolean>;
	_toggleShareWithAgent(): Promise<void>;
}

function createHost(props: Record<string, unknown>): BrowserChatHost {
	const host = Object.create(BrowserEditorChatIntegration.prototype) as BrowserChatHost;
	Object.assign(host, props);
	return host;
}

suite('Browser editor chat attachments - Agents window only', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('attachment is allowed only in the Agents window', () => {
		assert.strictEqual(isBrowserEditorChatAttachmentAllowed(contextKeyService(false)), false);
		assert.strictEqual(isBrowserEditorChatAttachmentAllowed(contextKeyService(undefined)), false);
		assert.strictEqual(isBrowserEditorChatAttachmentAllowed(contextKeyService(true)), true);
	});

	test('default Code window never reveals chat or confirms an attachment', async () => {
		const chat = createChatDouble(false);
		const pick = disposables.add(new Emitter<undefined>());
		let confirms = 0;
		let captures = 0;
		let logReads = 0;
		let areaToggles = 0;
		const model = {
			url: 'https://untrusted.example/page',
			isAreaSelectionActive: false,
			captureScreenshot: async () => {
				captures++;
				return { buffer: new Uint8Array([1]) };
			},
			getConsoleLogs: async () => {
				logReads++;
				return 'console output';
			},
			toggleAreaSelection: async () => {
				areaToggles++;
				pick.fire(undefined);
			},
			onDidPickArea: pick.event,
			setSharedWithAgent: async () => {
				throw new Error('default Code window must not share the browser with an agent');
			},
		};
		const host = createHost({
			contextKeyService: contextKeyService(false),
			editor: {
				model,
				ensureBrowserFocus() { },
				browserContainer: { classList: { toggle() { } } },
			},
			chatWidgetService: chat.service,
			dialogService: {
				confirm: async () => {
					confirms++;
					return { confirmed: true, checkboxChecked: false };
				},
			},
			configurationService: { getValue: () => false },
			storageService: { getBoolean: () => false },
			telemetryService: { publicLog2() { } },
			logService: { error() { } },
		});

		await host.addConsoleLogsToChat();
		await host.addScreenshotToChat();
		await host.addAreaScreenshotToChat();
		await host.addFullPageScreenshotToChat();
		assert.strictEqual(await host._attachToChat([{ id: 'element-1' }]), false);
		assert.strictEqual(await host._revealChatWidgetForAttachment(true), undefined);
		assert.strictEqual(await host._attachElementDataToChat({
			url: 'https://untrusted.example/page',
			outerHTML: '<button id="save">Save</button>',
			computedStyle: 'color: red;',
			bounds: { x: 0, y: 0, width: 1, height: 1 },
		}, model), false);
		await host._toggleShareWithAgent();

		assert.strictEqual(chat.reveals, 0, 'default Code window must not call revealWidget');
		assert.strictEqual(chat.lastFocusedReads, 0, 'default Code window must not read lastFocusedWidget');
		assert.deepStrictEqual(chat.added, []);
		assert.strictEqual(confirms, 0, 'attachment confirmation must not open before the window check');
		assert.strictEqual(captures, 0);
		assert.strictEqual(logReads, 0);
		assert.strictEqual(areaToggles, 0);
		assert.strictEqual(host.widgets.length, 0, 'Share with Agent must not appear');
	});

	test('Agents window still opens chat and attaches a browser screenshot', async () => {
		const chat = createChatDouble(true);
		const shareButton = { id: 'share' };
		let confirms = 0;
		let captures = 0;
		const host = createHost({
			contextKeyService: contextKeyService(true),
			editor: {
				model: {
					url: 'http://127.0.0.1:3000/',
					captureScreenshot: async () => {
						captures++;
						return { buffer: new Uint8Array([9]) };
					},
				},
			},
			chatWidgetService: chat.service,
			dialogService: {
				confirm: async () => {
					confirms++;
					return { confirmed: true, checkboxChecked: false };
				},
			},
			storageService: { getBoolean: () => false },
			telemetryService: { publicLog2() { } },
			logService: { error() { } },
			_shareButtonContainer: shareButton,
		});

		await host.addScreenshotToChat();

		assert.strictEqual(captures, 1);
		assert.strictEqual(chat.reveals, 1, 'Agents window must open chat');
		assert.strictEqual(chat.lastFocusedReads, 0);
		assert.strictEqual(chat.added.length, 1);
		const attached = chat.added[0][0] as { kind?: string };
		assert.strictEqual(attached.kind, 'image');
		assert.strictEqual(confirms, 0);
		assert.strictEqual(host.widgets.length, 1);
		assert.strictEqual(host.widgets[0].element, shareButton);
	});

	test('Agents window reveal still honors preserveFocus and attaches context', async () => {
		const revealChat = createChatDouble(true);
		const revealHost = createHost({
			contextKeyService: contextKeyService(true),
			chatWidgetService: revealChat.service,
		});
		assert.ok(await revealHost._revealChatWidgetForAttachment(true));
		assert.strictEqual(revealChat.reveals, 1);
		assert.strictEqual(revealChat.preserveFocus, true);
		assert.strictEqual(revealChat.lastFocusedReads, 0);

		const attachChat = createChatDouble(true);
		const attachHost = createHost({
			contextKeyService: contextKeyService(true),
			chatWidgetService: attachChat.service,
		});
		assert.strictEqual(await attachHost._attachToChat([{ id: 'console-logs-1' }]), true);
		assert.strictEqual(attachChat.reveals, 1);
		assert.strictEqual(attachChat.added.length, 1);
		assert.deepStrictEqual(attachChat.added[0], [{ id: 'console-logs-1' }]);
	});

	test('add-to-chat commands and the share menu stay hidden outside the Agents window', async () => {
		const submenu = MenuRegistry.getMenuItems(MenuId.BrowserActionsToolbar)
			.filter(isISubmenuItem)
			.find(item => item.submenu === MenuId.BrowserChatActionsMenu);
		assert.ok(submenu, 'Add to Chat submenu should remain registered');
		assert.strictEqual(evalWhen(submenu.when, defaultWindow), false);
		assert.strictEqual(evalWhen(submenu.when, agentsWindow), true);

		const defaultContext = contextKeyService(false);
		const agentsContext = contextKeyService(true);
		for (const id of chatCommandIds) {
			const item = MenuRegistry.getMenuItems(MenuId.BrowserChatActionsMenu)
				.filter(isIMenuItem)
				.find(candidate => candidate.command.id === id);
			assert.ok(item, id);
			assert.strictEqual(evalWhen(item.when, defaultWindow), false, id);
			assert.strictEqual(evalWhen(item.when, agentsWindow), true, id);
			assert.strictEqual(evalWhen(item.command.precondition, defaultWindow), false, id);
			assert.strictEqual(evalWhen(item.command.precondition, agentsWindow), true, id);

			const palette = MenuRegistry.getMenuItems(MenuId.CommandPalette)
				.filter(isIMenuItem)
				.find(candidate => candidate.command.id === id);
			assert.ok(palette, id);
			assert.strictEqual(evalWhen(palette.when, defaultWindow), false, id);
			assert.strictEqual(evalWhen(palette.when, agentsWindow), true, id);

			const command = CommandsRegistry.getCommand(id);
			assert.ok(command, id);
			await command.handler(accessorFor(defaultContext, () => {
				throw new Error(`${id} must not open chat in the default Code window`);
			}));

			let continued = false;
			try {
				await command.handler(accessorFor(agentsContext, () => {
					continued = true;
					throw new Error('stop');
				}));
				assert.ok(false, `${id} should keep going in the Agents window`);
			} catch (error) {
				assert.strictEqual(continued, true, id);
				assert.strictEqual((error as Error).message, 'stop');
			}
		}
	});
});
