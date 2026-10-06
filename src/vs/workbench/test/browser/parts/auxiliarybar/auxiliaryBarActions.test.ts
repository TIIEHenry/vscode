/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { ToggleAuxiliaryBarAction, ToggleMaximizedAuxiliaryBar } from '../../../../browser/parts/auxiliarybar/auxiliaryBarActions.js';

suite('AuxiliaryBarActions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('AuxiliaryBarTitle menu items do not restrict by activity bar position', () => {
		const menuItems = MenuRegistry.getMenuItems(MenuId.AuxiliaryBarTitle).filter(isIMenuItem);

		const toggleItem = menuItems.find(item => item.command.id === ToggleAuxiliaryBarAction.ID);
		assert.ok(toggleItem, 'ToggleAuxiliaryBarAction must be registered on AuxiliaryBarTitle menu');
		assert.strictEqual(toggleItem.when, undefined, 'ToggleAuxiliaryBarAction must have no when clause');

		const toggleMaximizedItem = menuItems.find(item => item.command.id === ToggleMaximizedAuxiliaryBar.ID);
		assert.ok(toggleMaximizedItem, 'ToggleMaximizedAuxiliaryBar must be registered on AuxiliaryBarTitle menu');
		assert.strictEqual(toggleMaximizedItem.when, undefined, 'ToggleMaximizedAuxiliaryBar must have no when clause');
	});
});
