/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService, type ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IChatWidgetService } from '../../../chat/browser/chat.js';
import { IChatContextPickService } from '../../../chat/browser/attachments/chatContextPickService.js';
import { ChatContextKeys } from '../../../chat/common/actions/chatContextKeys.js';
import { AddDebugScopeToChatAction, AddDebugVariableToChatAction, AddDebugWatchExpressionToChatAction, DebugChatContextContribution, DebugSessionContextPick, isDebugChatAttachmentAllowed } from '../../browser/debugChatIntegration.js';
import { IDebugService, State } from '../../common/debug.js';

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

function getMenuItem(menuId: MenuId, commandId: string) {
	return MenuRegistry.getMenuItems(menuId)
		.filter(isIMenuItem)
		.find(item => item.command.id === commandId);
}

function debugService(focusedState: State | undefined, touches: { count: number }): IDebugService {
	return {
		getViewModel: () => {
			touches.count++;
			return {
				focusedSession: focusedState === undefined ? undefined : { state: focusedState },
			};
		},
	} as unknown as IDebugService;
}

suite('Debug chat attachments - default window (INV-NO-COPILOT)', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	const defaultContext = contextKeyService(false);
	const agentsContext = contextKeyService(true);
	const defaultWindow = { [ChatContextKeys.enabled.key]: true, [IsSessionsWindowContext.key]: false };
	const agentsWindow = { [ChatContextKeys.enabled.key]: true, [IsSessionsWindowContext.key]: true };

	test('default Code window returns before debug chat commands open chat', async () => {
		assert.strictEqual(isDebugChatAttachmentAllowed(defaultContext), false);
		assert.strictEqual(isDebugChatAttachmentAllowed(agentsContext), true);

		const actions: { action: { readonly desc: { readonly id: string; readonly precondition?: ContextKeyExpression }; run(accessor: ServicesAccessor, context?: unknown): Promise<void> }; menu: MenuId }[] = [
			{ action: new AddDebugVariableToChatAction(), menu: MenuId.DebugVariablesContext },
			{ action: new AddDebugWatchExpressionToChatAction(), menu: MenuId.DebugWatchContext },
			{ action: new AddDebugScopeToChatAction(), menu: MenuId.DebugScopesContext },
		];

		for (const { action, menu } of actions) {
			const item = getMenuItem(menu, action.desc.id);
			assert.ok(item, `${action.desc.id} should remain registered for the Agents window`);
			assert.strictEqual(evalWhen(item.when, defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(item.command.precondition, defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, defaultWindow), false, action.desc.id);
			assert.strictEqual(evalWhen(item.when, agentsWindow), true, action.desc.id);
			assert.strictEqual(evalWhen(item.command.precondition, agentsWindow), true, action.desc.id);
			assert.strictEqual(evalWhen(action.desc.precondition, agentsWindow), true, action.desc.id);

			let reveals = 0;
			const chat = {
				revealWidget: async () => {
					reveals++;
					return undefined;
				},
			};
			await action.run(accessorFor(defaultContext, (id) => {
				if (id === IChatWidgetService) {
					return chat;
				}
				if (id === IDebugService) {
					throw new Error(`${action.desc.id} must not read the debug model before opening chat`);
				}
				throw new Error(`unexpected service ${String(id)}`);
			}), undefined);
			assert.strictEqual(reveals, 0, action.desc.id);

			await action.run(accessorFor(agentsContext, (id) => {
				if (id === IChatWidgetService) {
					return chat;
				}
				if (id === IDebugService) {
					return {};
				}
				throw new Error(`unexpected service ${String(id)}`);
			}), undefined);
			assert.strictEqual(reveals, 1, action.desc.id);
		}
	});

	test('default Code window does not register the debug session chat picker', () => {
		let registered = 0;
		let created = 0;
		const pickService = {
			registerChatContextItem: () => {
				registered++;
				return { dispose() { } };
			},
		} as unknown as IChatContextPickService;
		const instantiationService = {
			createInstance: () => {
				created++;
				return {};
			},
		} as unknown as IInstantiationService;

		disposables.add(new DebugChatContextContribution(pickService, instantiationService, defaultContext));
		assert.strictEqual(registered, 0);
		assert.strictEqual(created, 0);

		const touches = { count: 0 };
		const hidden = new DebugSessionContextPick(debugService(State.Stopped, touches), defaultContext);
		assert.strictEqual(hidden.isEnabled(), false);
		assert.strictEqual(touches.count, 0, 'default Code window must not read the debug session for chat');

		registered = 0;
		created = 0;
		disposables.add(new DebugChatContextContribution(pickService, instantiationService, agentsContext));
		assert.strictEqual(registered, 1);
		assert.strictEqual(created, 1);

		const stoppedTouches = { count: 0 };
		const stopped = new DebugSessionContextPick(debugService(State.Stopped, stoppedTouches), agentsContext);
		assert.strictEqual(stopped.isEnabled(), true);
		assert.strictEqual(stoppedTouches.count, 1);

		const runningTouches = { count: 0 };
		const running = new DebugSessionContextPick(debugService(State.Running, runningTouches), agentsContext);
		assert.strictEqual(running.isEnabled(), false);
		assert.strictEqual(runningTouches.count, 1);
	});
});
