/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { ICommandService } from '../../../../../platform/commands/common/commands.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import type { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IChatWidgetService, type IChatWidget } from '../../../chat/browser/chat.js';
import { ScmEditorTriggerSetupAction } from '../../browser/scm.contribution.js';
import { AddScmHistoryItemChangeToChatAction, AddScmHistoryItemToChatAction, isScmHistoryItemChatAllowed, SCMHistoryItemContext, SummarizeScmHistoryItemAction } from '../../browser/scmHistoryChatContext.js';
import { ScmInputTriggerSetupAction } from '../../browser/scmInput.js';
import type { ISCMHistoryItem, ISCMHistoryItemChange } from '../../common/history.js';
import type { ISCMProvider, ISCMViewService } from '../../common/scm.js';

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

function menuPrecondition(menuId: MenuId, commandId: string): ContextKeyExpression | undefined {
	return MenuRegistry.getMenuItems(menuId)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId)?.command.precondition;
}

suite('SCM agents chat commands - default window (INV-NO-COPILOT)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const defaultContext = contextKeyService(false);
	const agentsContext = contextKeyService(true);
	const defaultWindow = { [IsSessionsWindowContext.key]: false };
	const agentsWindow = { [IsSessionsWindowContext.key]: true };

	test('default Code window does not offer Source Control history chat attachments', () => {
		assert.strictEqual(isScmHistoryItemChatAllowed(defaultContext), false);
		assert.strictEqual(isScmHistoryItemChatAllowed(agentsContext), true);

		const hidden = new SCMHistoryItemContext({
			activeRepository: { get() { throw new Error('default Code window must not read the SCM repository for history chat'); } },
		} as unknown as ISCMViewService, defaultContext);
		const widget = { attachmentCapabilities: { supportsSourceControlAttachments: true } } as IChatWidget;
		assert.strictEqual(hidden.isEnabled(widget), false);

		const offered = new SCMHistoryItemContext({
			activeRepository: {
				get: () => ({ repository: { provider: { historyProvider: { get: () => ({}) } } } }),
			},
		} as unknown as ISCMViewService, agentsContext);
		assert.strictEqual(offered.isEnabled(widget), true);
		assert.strictEqual(offered.isEnabled({ attachmentCapabilities: {} } as IChatWidget), false);
	});

	test('default Code window returns before history chat commands open chat', async () => {
		const actions = [
			new AddScmHistoryItemToChatAction(),
			new SummarizeScmHistoryItemAction(),
			new AddScmHistoryItemChangeToChatAction(),
		];

		for (const action of actions) {
			assert.strictEqual(evalWhen(action.desc.precondition, defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, agentsWindow), true, action.desc.id);
		}

		const absentProvider = undefined as unknown as ISCMProvider;
		const absentHistoryItem = undefined as unknown as ISCMHistoryItem;
		const absentHistoryChange = undefined as unknown as ISCMHistoryItemChange;
		const refuseChat = (id: string) => accessorFor(defaultContext, () => {
			throw new Error(`${id} must not open chat in the default Code window`);
		});
		await new AddScmHistoryItemToChatAction().run(refuseChat(AddScmHistoryItemToChatAction.ID), absentProvider, absentHistoryItem);
		await new SummarizeScmHistoryItemAction().run(refuseChat(SummarizeScmHistoryItemAction.ID), absentProvider, absentHistoryItem);
		await new AddScmHistoryItemChangeToChatAction().run(refuseChat(AddScmHistoryItemChangeToChatAction.ID), absentHistoryItem, absentHistoryChange);

		let revealed = false;
		await new AddScmHistoryItemToChatAction().run(accessorFor(agentsContext, (id) => {
			if (id === IChatWidgetService) {
				return {
					revealWidget: async () => {
						revealed = true;
						return undefined;
					},
				};
			}
			throw new Error(`unexpected service ${String(id)}`);
		}), absentProvider, absentHistoryItem);
		assert.strictEqual(revealed, true);
	});

	test('default Code window returns before SCM AI setup commands run', async () => {
		const setupActions = [
			{ action: new ScmInputTriggerSetupAction(), menu: MenuId.SCMInputBox },
			{ action: new ScmEditorTriggerSetupAction(), menu: MenuId.EditorContent },
		];

		for (const { action, menu } of setupActions) {
			assert.strictEqual(evalWhen(menuPrecondition(menu, action.desc.id), defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(menuPrecondition(menu, action.desc.id), agentsWindow), true, action.desc.id);
			await action.run(accessorFor(defaultContext, () => {
				throw new Error(`${action.desc.id} must not start chat setup in the default Code window`);
			}));
		}

		let started = false;
		await new ScmEditorTriggerSetupAction().run(accessorFor(agentsContext, (id) => {
			if (id === ICommandService) {
				return {
					executeCommand: async () => {
						started = true;
						return false;
					},
				};
			}
			throw new Error(`unexpected service ${String(id)}`);
		}));
		assert.strictEqual(started, true);
	});
});
