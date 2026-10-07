/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getDefaultHoverDelegate } from '../../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { Action } from '../../../../../base/common/actions.js';
import { Event } from '../../../../../base/common/event.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IMenu, IMenuService, MenuId, MenuItemAction, SubmenuItemAction } from '../../../../../platform/actions/common/actions.js';
import { ChatAIDisabledSettingId } from '../../../../../platform/chat/common/chatSettings.js';
import { IConfigurationChangeEvent } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IEditorGroupsService } from '../../../../services/editor/common/editorGroupsService.js';
import { DEFAULT_EDITOR_PART_OPTIONS } from '../../../../browser/parts/editor/editor.js';
import { CommandCenterControl } from '../../../../browser/parts/titlebar/commandCenterControl.js';
import { WindowTitle } from '../../../../browser/parts/titlebar/windowTitle.js';
import { TestEditorGroupsService, workbenchInstantiationService } from '../../workbenchTestServices.js';

suite('Command Center Compact', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('restores the search icon when leaving compact command-center chrome', () => {
		const configurationService = new TestConfigurationService({
			'chat.agentsControl.enabled': 'compact',
		});
		store.add(configurationService.onDidChangeConfigurationEmitter);

		const quickOpen = store.add(new Action('workbench.action.quickOpenWithModes', 'Search', 'codicon-search'));
		const submenu = new SubmenuItemAction({ title: 'Command Center', submenu: MenuId.CommandCenterCenter }, undefined, [quickOpen]);
		const instantiationService = workbenchInstantiationService({
			configurationService: () => configurationService,
		}, store);
		instantiationService.stub(IMenuService, commandCenterMenuService(submenu));

		const editorGroupsService = instantiationService.get(IEditorGroupsService);
		assert.ok(editorGroupsService instanceof TestEditorGroupsService);
		editorGroupsService.partOptions = { ...DEFAULT_EDITOR_PART_OPTIONS };

		const windowTitle = upcastPartial<WindowTitle>({
			onDidChange: Event.None,
			get value() { return 'Workspace'; },
			get workspaceName() { return 'Workspace'; },
			get fileName() { return undefined; },
			isCustomTitleFormat: () => false,
			getTitleDecorations: () => ({ prefix: undefined, suffix: undefined }),
			getWindowTitle: () => 'Workspace',
		});
		const control = store.add(instantiationService.createInstance(CommandCenterControl, windowTitle, getDefaultHoverDelegate('mouse')));
		const quickPick = control.element.querySelector('.command-center-quick-pick');
		assert.ok(quickPick instanceof HTMLElement);
		const label = quickPick.querySelector('.search-label');
		assert.ok(label instanceof HTMLElement);

		assertCompact(quickPick, true);

		fireConfiguration(configurationService, 'chat.agentsControl.enabled', 'hidden');
		assert.strictEqual(control.element.querySelector('.command-center-quick-pick'), quickPick);
		assert.strictEqual(quickPick.querySelector('.search-label'), label);
		assertCompact(quickPick, false);
		const searchIcon = quickPick.querySelector('.search-icon');
		assert.ok(searchIcon instanceof HTMLElement);

		fireConfiguration(configurationService, 'chat.agentsControl.enabled', 'compact');
		assertCompact(quickPick, true);
		assert.strictEqual(quickPick.querySelector('.search-label'), label);

		fireConfiguration(configurationService, 'chat.agentsControl.enabled', 'badge');
		assertCompact(quickPick, false);
		assert.strictEqual(quickPick.querySelector('.search-icon'), searchIcon);

		fireConfiguration(configurationService, 'chat.agentsControl.enabled', true);
		assertCompact(quickPick, true);

		configurationService.setUserConfiguration(ChatAIDisabledSettingId, true);
		configurationService.setUserConfiguration('disableAICustomizations', true);
		configurationService.onDidChangeConfigurationEmitter.fire(upcastPartial<IConfigurationChangeEvent>({
			affectsConfiguration: (key: string) => key === ChatAIDisabledSettingId || key === 'disableAICustomizations',
		}));
		assert.strictEqual(control.element.querySelector('.command-center-quick-pick'), quickPick);
		assertCompact(quickPick, false);
		assert.strictEqual(quickPick.querySelector('.search-icon'), searchIcon);
		assert.strictEqual(quickPick.querySelector('.search-label'), label);
	});
});

function commandCenterMenuService(submenu: SubmenuItemAction): IMenuService {
	const groups: [string, Array<MenuItemAction | SubmenuItemAction>][] = [['navigation', [submenu]]];
	const menu: IMenu = {
		onDidChange: Event.None,
		dispose() { },
		getActions: () => groups,
	};
	return upcastPartial<IMenuService>({
		createMenu: (id: MenuId) => id === MenuId.CommandCenter ? menu : { onDidChange: Event.None, dispose() { }, getActions: () => [] },
		getMenuActions: () => [],
		getMenuContexts: () => new Set<string>(),
		resetHiddenStates: () => undefined,
	});
}

function fireConfiguration(configurationService: TestConfigurationService, key: string, value: unknown): void {
	configurationService.setUserConfiguration(key, value);
	configurationService.onDidChangeConfigurationEmitter.fire(upcastPartial<IConfigurationChangeEvent>({
		affectsConfiguration: (candidate: string) => candidate === key,
	}));
}

function assertCompact(quickPick: HTMLElement, compact: boolean): void {
	assert.strictEqual(quickPick.classList.contains('compact-mode'), compact);
	assert.strictEqual(quickPick.querySelector('.search-icon') instanceof HTMLElement, !compact);
}
