/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { CommandsRegistry } from '../../../../../../platform/commands/common/commands.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, type ServicesAccessor } from '../../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../../platform/log/common/log.js';
import { EditorContextKeys } from '../../../../../../editor/common/editorContextKeys.js';
import { IsSessionsWindowContext } from '../../../../../common/contextkeys.js';
import { IChatWidgetService } from '../../../browser/chat.js';
import { ChatContextKeys } from '../../../common/actions/chatContextKeys.js';
import { SearchContext } from '../../../../search/common/constants.js';
import {
	AttachFileToChatAction,
	AttachFolderToChatAction,
	AttachPinnedEditorsToChatAction,
	AttachSearchResultAction,
	AttachSelectionToChatAction,
	isChatContextAttachAllowed,
} from '../../../browser/actions/chatContextActions.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

function contextKeyService(isSessionsWindow: boolean): IContextKeyService {
	return {
		getContextKeyValue: <T>(key: string) => (key === IsSessionsWindowContext.key ? isSessionsWindow : undefined) as T | undefined,
	} as IContextKeyService;
}

function menuWhen(menuId: MenuId, commandId: string): ContextKeyExpression | undefined {
	return MenuRegistry.getMenuItems(menuId)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId)?.when;
}

function accessorFor(isSessionsWindow: boolean, onChat: () => IChatWidgetService): ServicesAccessor {
	const context = contextKeyService(isSessionsWindow);
	const accessor = {
		get(id: unknown) {
			if (id === IContextKeyService) {
				return context;
			}
			if (id === ILogService) {
				return { trace() { } };
			}
			if (id === IInstantiationService) {
				return { invokeFunction: (fn: (inner: ServicesAccessor) => unknown) => fn(accessor) };
			}
			if (id === IChatWidgetService) {
				return onChat();
			}
			throw new Error(`unexpected service ${String(id)}`);
		},
	} as ServicesAccessor;
	return accessor;
}

suite('Chat context attach - default window (INV-NO-COPILOT)', () => {

	const store = new DisposableStore();
	ensureNoDisposablesAreLeakedInTestSuite();

	suiteSetup(() => {
		if (CommandsRegistry.getCommand('workbench.action.chat.insertSearchResults')) {
			return;
		}
		store.add(registerAction2(AttachFileToChatAction));
		store.add(registerAction2(AttachFolderToChatAction));
		store.add(registerAction2(AttachPinnedEditorsToChatAction));
		store.add(registerAction2(AttachSelectionToChatAction));
		store.add(registerAction2(AttachSearchResultAction));
	});

	suiteTeardown(() => {
		store.dispose();
	});

	const defaultWindow = { [IsSessionsWindowContext.key]: false, [ChatContextKeys.enabled.key]: true };
	const agentsWindow = { ...defaultWindow, [IsSessionsWindowContext.key]: true };

	test('isChatContextAttachAllowed is true only in the Agents window', () => {
		assert.strictEqual(isChatContextAttachAllowed(contextKeyService(false)), false);
		assert.strictEqual(isChatContextAttachAllowed(contextKeyService(true)), true);
	});

	test('default Code window hides search and editor attach menus', () => {
		const searchDefault = {
			...defaultWindow,
			[SearchContext.SearchResultHeaderFocused.key]: true,
		};
		const searchAgents = { ...searchDefault, [IsSessionsWindowContext.key]: true };
		const searchWhen = menuWhen(MenuId.SearchContext, 'workbench.action.chat.insertSearchResults');
		assert.strictEqual(evalWhen(searchWhen, searchDefault), false);
		assert.strictEqual(evalWhen(searchWhen, searchAgents), true);

		const fileWhen = menuWhen(MenuId.InlineChatEditorAffordance, AttachFileToChatAction.ID);
		const fileDefault = { ...defaultWindow, [EditorContextKeys.hasNonEmptySelection.key]: false };
		const fileAgents = { ...fileDefault, [IsSessionsWindowContext.key]: true };
		assert.strictEqual(evalWhen(fileWhen, fileDefault), false);
		assert.strictEqual(evalWhen(fileWhen, fileAgents), true);

		const selectionWhen = menuWhen(MenuId.ChatEditorInlineMenu, AttachSelectionToChatAction.ID);
		const selectionDefault = { ...defaultWindow, [EditorContextKeys.hasNonEmptySelection.key]: true };
		const selectionAgents = { ...selectionDefault, [IsSessionsWindowContext.key]: true };
		assert.strictEqual(evalWhen(selectionWhen, selectionDefault), false);
		assert.strictEqual(evalWhen(selectionWhen, selectionAgents), true);

		for (const action of [
			new AttachFileToChatAction(),
			new AttachFolderToChatAction(),
			new AttachPinnedEditorsToChatAction(),
			new AttachSelectionToChatAction(),
			new AttachSearchResultAction(),
		]) {
			assert.strictEqual(evalWhen(action.desc.precondition, defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, agentsWindow), true, action.desc.id);
		}
	});

	test('default Code window returns before attach commands open chat', async () => {
		const actions = [
			new AttachFileToChatAction(),
			new AttachFolderToChatAction(),
			new AttachPinnedEditorsToChatAction(),
			new AttachSelectionToChatAction(),
			new AttachSearchResultAction(),
		];
		for (const action of actions) {
			await action.run(accessorFor(false, () => {
				throw new Error(`${action.desc.id} must not open chat in the default Code window`);
			}));
		}

		let revealed = false;
		await new AttachSearchResultAction().run(accessorFor(true, () => ({
			lastFocusedWidget: undefined,
			revealWidget: async () => {
				revealed = true;
				return undefined;
			},
		}) as unknown as IChatWidgetService));
		assert.strictEqual(revealed, true);
	});
});
