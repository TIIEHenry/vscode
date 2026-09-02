/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { decodeKeybinding } from '../../../base/common/keybindings.js';
import { KeyCode, KeyMod } from '../../../base/common/keyCodes.js';
import { OperatingSystem, OS } from '../../../base/common/platform.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../platform/actions/common/actions.js';
import { ILocalizedString } from '../../../nls.js';
import { KeybindingsRegistry } from '../../../platform/keybinding/common/keybindingsRegistry.js';
import {
	ProductLayoutToggleKeybindingPrimary,
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

const PRODUCT_LAYOUT_TOGGLE_KEYBINDINGS: ReadonlyArray<{ id: string; primary: number }> = [
	{ id: ToggleSidebarVisibilityAction.ID, primary: ProductLayoutToggleKeybindingPrimary.navigator },
	{ id: ToggleConversationVisibilityActionId, primary: ProductLayoutToggleKeybindingPrimary.conversation },
	{ id: ToggleEditorVisibilityActionId, primary: ProductLayoutToggleKeybindingPrimary.preview },
	{ id: ToggleSourcesVisibilityActionId, primary: ProductLayoutToggleKeybindingPrimary.sources },
];

const OPEN_CONVERSATION_KEYBINDINGS = {
	[OperatingSystem.Windows]: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyI,
	[OperatingSystem.Linux]: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyI,
	[OperatingSystem.Macintosh]: KeyMod.CtrlCmd | KeyMod.WinCtrl | KeyCode.KeyI,
} as const;

function getDefaultKeybindingRule(os: OperatingSystem, commandId: string, primary: number) {
	const hash = decodeKeybinding(primary, os)!.getHashCode();
	return KeybindingsRegistry.getDefaultKeybindingsForOS(os)
		.find(item => item.command === commandId && item.keybinding?.getHashCode() === hash);
}

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

	test('product layout toggles register default keybindings without conflicting with Open Conversation or Navigator', () => {
		for (const os of [OperatingSystem.Windows, OperatingSystem.Linux, OperatingSystem.Macintosh]) {
			const hashes = new Set<string>();
			for (const { id, primary } of PRODUCT_LAYOUT_TOGGLE_KEYBINDINGS) {
				const rule = getDefaultKeybindingRule(os, id, primary);
				assert.ok(rule, `${id} should register default keybinding on OS ${os}`);
				const hash = rule.keybinding!.getHashCode();
				assert.ok(!hashes.has(hash), `duplicate product layout keybinding on OS ${os}: ${id}`);
				hashes.add(hash);
			}

			const openConversationHash = decodeKeybinding(OPEN_CONVERSATION_KEYBINDINGS[os], os)!.getHashCode();
			assert.ok(!hashes.has(openConversationHash), `product layout keys must not collide with Open Conversation on OS ${os}`);
		}

		const navigatorRule = getDefaultKeybindingRule(OS, ToggleSidebarVisibilityAction.ID, ProductLayoutToggleKeybindingPrimary.navigator);
		assert.ok(navigatorRule, 'Navigator toggle should keep Ctrl/Cmd+B');
	});
});
