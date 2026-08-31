/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../platform/actions/common/actions.js';
import { ILocalizedString } from '../../../nls.js';
import {
	ToggleConversationVisibilityActionId,
	ToggleEditorVisibilityActionId,
	ToggleSidebarVisibilityAction,
	ToggleSourcesVisibilityActionId,
} from '../../browser/actions/layoutActions.js';
import { ToggleAuxiliaryBarAction } from '../../browser/parts/auxiliarybar/auxiliaryBarActions.js';
import { TogglePanelAction } from '../../browser/parts/panel/panelActions.js';

import '../../browser/actions/layoutActions.js';
import '../../browser/parts/panel/panelActions.js';
import '../../browser/parts/auxiliarybar/auxiliaryBarActions.js';

const PRODUCT_LAYOUT_TOGGLE_IDS = [
	ToggleSidebarVisibilityAction.ID,
	ToggleConversationVisibilityActionId,
	ToggleEditorVisibilityActionId,
	ToggleSourcesVisibilityActionId,
];

function commandTitle(title: string | ILocalizedString): string {
	return typeof title === 'string' ? title : title.value;
}

suite('LayoutControlMenu - product four-button cluster', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('default-window primary toggles use product titles and exclude Panel/Aux', () => {
		const items = MenuRegistry.getMenuItems(MenuId.LayoutControlMenu).filter(isIMenuItem);
		const defaultWindowToggleItems = items.filter(item =>
			item.group === 'navigation'
			&& PRODUCT_LAYOUT_TOGGLE_IDS.includes(item.command.id)
		);

		const commandIds = [...new Set(defaultWindowToggleItems.map(item => item.command.id))];
		assert.deepStrictEqual([...commandIds].sort(), [...PRODUCT_LAYOUT_TOGGLE_IDS].sort());

		for (const item of defaultWindowToggleItems) {
			const expectedTitle = item.command.id === ToggleSidebarVisibilityAction.ID ? 'Navigator'
				: item.command.id === ToggleConversationVisibilityActionId ? 'Conversation'
					: item.command.id === ToggleEditorVisibilityActionId ? 'Preview'
						: 'Sources';
			assert.strictEqual(commandTitle(item.command.title), expectedTitle, item.command.id);
		}

		assert.strictEqual(
			items.some(item => item.command.id === TogglePanelAction.ID),
			false,
			'Panel must not register on LayoutControlMenu'
		);
		assert.strictEqual(
			items.some(item => item.command.id === ToggleAuxiliaryBarAction.ID),
			false,
			'Auxiliary Bar must not register on LayoutControlMenu'
		);
	});

	test('Panel and Auxiliary Bar stay on LayoutControlMenuSubmenu only', () => {
		const submenuItems = MenuRegistry.getMenuItems(MenuId.LayoutControlMenuSubmenu).filter(isIMenuItem);
		assert.ok(submenuItems.some(item => item.command.id === TogglePanelAction.ID));
		assert.ok(submenuItems.some(item => item.command.id === ToggleAuxiliaryBarAction.ID));
		assert.strictEqual(
			MenuRegistry.getMenuItems(MenuId.LayoutControlMenu).filter(isIMenuItem).some(item => item.command.id === TogglePanelAction.ID),
			false
		);
		assert.strictEqual(
			MenuRegistry.getMenuItems(MenuId.LayoutControlMenu).filter(isIMenuItem).some(item => item.command.id === ToggleAuxiliaryBarAction.ID),
			false
		);
	});
});
