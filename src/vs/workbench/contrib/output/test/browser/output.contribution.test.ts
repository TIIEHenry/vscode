/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { IContextKeyService, type ContextKeyExpression, type ContextKeyValue } from '../../../../../platform/contextkey/common/contextkey.js';
import type { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { Extensions as ViewExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation, WindowEnablement } from '../../../../common/views.js';
import { IsSessionsWindowContext } from '../../../../common/contextkeys.js';
import { IOutputService, OUTPUT_VIEW_ID } from '../../../../services/output/common/output.js';
import { AddCompoundLogAction, ImportLogAction, isOutputPanelCommandAllowed, ShowLogsAction, ShowOutputChannelsAction } from '../../browser/output.contribution.js';

function evalWhen(when: ContextKeyExpression | undefined, values: Record<string, ContextKeyValue>): boolean {
	if (!when) {
		return true;
	}
	return when.evaluate({ getValue: <T extends ContextKeyValue = ContextKeyValue>(key: string) => values[key] as T });
}

const defaultWindow = { [IsSessionsWindowContext.key]: false };
const agentsWindow = { [IsSessionsWindowContext.key]: true };

suite('OutputContribution - default window chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Output panel view is gated to Agents Window', () => {
		const viewContainersRegistry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);
		const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);

		const viewContainer = viewContainersRegistry.get(OUTPUT_VIEW_ID);
		assert.ok(viewContainer, 'Output panel container should remain registered');
		assert.strictEqual(viewContainer.hideIfEmpty, true, 'Output panel container should hide when empty');
		assert.strictEqual(
			viewContainersRegistry.getViewContainerLocation(viewContainer),
			ViewContainerLocation.Panel,
			'Output should remain a Panel container'
		);
		assert.strictEqual(viewContainer.windowEnablement, WindowEnablement.Sessions, 'Output panel container should be Agents Window only');

		const outputView = viewsRegistry.getView(OUTPUT_VIEW_ID);
		assert.ok(outputView, 'Output view should remain registered');
		assert.strictEqual(outputView.windowEnablement, WindowEnablement.Sessions, 'Output view should be Agents Window only');

		assert.ok(outputView.openCommandActionDescriptor?.keybindings?.when, 'Output toggle keybinding should have a when clause');
		assert.strictEqual(
			evalWhen(outputView.openCommandActionDescriptor!.keybindings!.when, defaultWindow),
			false,
			'default Code window must hide Output toggle keybinding'
		);
		assert.strictEqual(
			evalWhen(outputView.openCommandActionDescriptor!.keybindings!.when, agentsWindow),
			true,
			'Agents Window may keep Output toggle keybinding'
		);
	});

	test('Output panel commands do not run outside the Agents Window', async () => {
		const defaultContext = contextKeyService(false);
		const agentsContext = contextKeyService(true);
		assert.strictEqual(isOutputPanelCommandAllowed(defaultContext), false);
		assert.strictEqual(isOutputPanelCommandAllowed(agentsContext), true);

		const actions = [ShowOutputChannelsAction, ShowLogsAction, AddCompoundLogAction, ImportLogAction];
		for (const Action of actions) {
			const action = new Action();
			const paletteItem = MenuRegistry.getMenuItems(MenuId.CommandPalette)
				.filter(isIMenuItem)
				.find(item => item.command.id === action.desc.id);
			assert.ok(paletteItem, `${action.desc.id} should remain in the command palette`);
			assert.strictEqual(evalWhen(paletteItem.when, defaultWindow), false, `${action.desc.id} must hide from the Code window palette`);
			assert.strictEqual(evalWhen(paletteItem.when, agentsWindow), true, `${action.desc.id} may show in the Agents Window palette`);
			assert.strictEqual(evalWhen(paletteItem.command.precondition, defaultWindow), false, `${action.desc.id} precondition must fail in the Code window`);

			await action.run(accessorFor(defaultContext, () => {
				throw new Error(`${action.desc.id} must return before opening a picker or changing output`);
			}));
		}

		let sawQuickInput = false;
		await new ShowOutputChannelsAction().run(accessorFor(agentsContext, (id) => {
			if (id === IOutputService) {
				return { getChannelDescriptors: () => [] };
			}
			if (id === IQuickInputService) {
				sawQuickInput = true;
				return { pick: async () => undefined };
			}
			throw new Error(`unexpected service ${String(id)}`);
		}));
		assert.strictEqual(sawQuickInput, true, 'Agents Window may open the output channel picker');
	});
});

function contextKeyService(isSessionsWindow: boolean): IContextKeyService {
	return {
		getContextKeyValue: <T>(key: string) => (key === IsSessionsWindowContext.key ? isSessionsWindow : undefined) as T | undefined,
	} as IContextKeyService;
}

function accessorFor(contextKeyService: IContextKeyService, getOther: (id: unknown) => unknown): ServicesAccessor {
	return {
		get(id: unknown) {
			if (id === IContextKeyService) {
				return contextKeyService;
			}
			return getOther(id);
		},
	} as ServicesAccessor;
}
