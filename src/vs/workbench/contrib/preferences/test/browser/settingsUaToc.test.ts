/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ConfigurationTarget } from '../../../../../platform/configuration/common/configuration.js';
import { Extensions, IConfigurationRegistry } from '../../../../../platform/configuration/common/configurationRegistry.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { Registry } from '../../../../../platform/registry/common/platform.js';
import { ISetting, ISettingsGroup } from '../../../../services/preferences/common/preferences.js';
import { nullRange } from '../../../../services/preferences/common/preferencesModels.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import '../../../conversation/browser/uaClientSettings.contribution.js';
import {
	DEFAULT_COMMONLY_USED_EXCLUDE_KEY_PATTERNS,
	getCommonlyUsedData,
	getSettingsTocFilter,
	getTocDataForWindow,
	ITOCEntry,
	tocData,
	uaClientLocalGroupEmptyCopy,
} from '../../browser/settingsLayout.js';
import { resolveSettingsTree } from '../../browser/settingsTree.js';
import {
	SettingsTreeEmptyCopyElement,
	SettingsTreeGroupChild,
	SettingsTreeGroupElement,
	SettingsTreeModel,
	SettingsTreeNavigationLinkElement,
	SettingsTreeNewExtensionsElement,
} from '../../browser/settingsTreeModels.js';

function childIds<T>(entry: ITOCEntry<T> | undefined): string[] {
	return entry?.children?.map(child => child.id) ?? [];
}

function findTocEntry<T>(root: ITOCEntry<T>, id: string): ITOCEntry<T> | undefined {
	if (root.id === id) {
		return root;
	}
	for (const child of root.children ?? []) {
		const match = findTocEntry(child, id);
		if (match) {
			return match;
		}
	}
	return undefined;
}

function collectGroupChildren(root: SettingsTreeGroupElement, groupId: string): SettingsTreeGroupChild[] {
	for (const child of root.children) {
		if (child instanceof SettingsTreeGroupElement) {
			if (child.id === groupId) {
				return child.children;
			}
			const nested = collectGroupChildren(child, groupId);
			if (nested.length) {
				return nested;
			}
		}
	}
	return [];
}

function mockSetting(key: string, tags?: string[]): ISetting {
	return {
		range: nullRange,
		key,
		keyRange: nullRange,
		value: null,
		valueRange: nullRange,
		description: [],
		descriptionRanges: [],
		tags
	};
}

function mockGroups(keys: string[]): ISettingsGroup[] {
	return [{
		id: 'test',
		range: nullRange,
		title: 'test',
		titleRange: nullRange,
		sections: [{
			settings: keys.map(key => mockSetting(key))
		}]
	}];
}

suite('Settings UA TOC', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	const clientLocalEmptyCopyByGroupId: Record<string, string> = {
		'ua/display': uaClientLocalGroupEmptyCopy('display'),
		'ua/chatInput': uaClientLocalGroupEmptyCopy('chat input'),
		'ua/startup': uaClientLocalGroupEmptyCopy('startup'),
		'ua/keyboardEnter': uaClientLocalGroupEmptyCopy('keyboard enter'),
		'ua/notifications': uaClientLocalGroupEmptyCopy('notification'),
		'ua/permissions': uaClientLocalGroupEmptyCopy('permissions'),
		'ua/clientTools': uaClientLocalGroupEmptyCopy('client tools'),
	};

	const expectedUaGroupIds = [
		'ua/display',
		'ua/chatInput',
		'ua/startup',
		'ua/keyboardEnter',
		'ua/notifications',
		'ua/permissions',
		'ua/clientTools',
		'ua/connection',
		'ua/engine',
		'ua/customizations',
	];

	test('default Code window TOC omits chat subtree ids', () => {
		const toc = getTocDataForWindow(false);
		const ids = childIds(toc);
		assert.ok(!ids.includes('chat'));
		for (const chatChild of childIds(tocData.children?.find(child => child.id === 'chat'))) {
			assert.ok(!ids.includes(chatChild), `default TOC must not include ${chatChild}`);
		}
	});

	test('Agents Window keeps donor chat subtree in tocData', () => {
		const toc = getTocDataForWindow(true);
		assert.ok(childIds(toc).includes('chat'));
	});

	test('default Code window keeps Copilot exclude filter when advanced settings are shown', () => {
		for (const showAdvanced of [false, true]) {
			const filter = getSettingsTocFilter(false, showAdvanced);
			assert.ok(filter, 'default window must always have a TOC filter');
			const keyPatterns = filter!.exclude?.keyPatterns ?? [];
			assert.ok(keyPatterns.some(pattern => pattern.startsWith('chat.')), `advanced=${showAdvanced} must still exclude chat keys`);
		}
	});

	test('default Code window includes Client product group skeleton', () => {
		const toc = getTocDataForWindow(false);
		assert.ok(childIds(toc).includes('ua'));
		const uaChildren = childIds(toc.children?.find(child => child.id === 'ua'));
		for (const id of expectedUaGroupIds) {
			assert.ok(uaChildren.includes(id), `Client TOC must include ${id}`);
		}
	});

	test('resolved default window tree keeps navigation-only ua groups', () => {
		const groups = mockGroups([
			'editor.fontSize',
			'chat.agent.maxRequests',
		]);
		const result = resolveSettingsTree(
			getTocDataForWindow(false),
			groups,
			getSettingsTocFilter(false, true),
			new NullLogService()
		);
		const uaEntry = findTocEntry(result.tree, 'ua');
		assert.ok(uaEntry);
		const connection = findTocEntry(result.tree, 'ua/connection');
		assert.ok(connection?.navigationLinks?.length === 1);
		assert.strictEqual(connection.navigationLinks![0].commandId, 'workbench.action.openConnectionPreferences');
		assert.ok(!connection.settings?.length);
		const customizations = findTocEntry(result.tree, 'ua/customizations');
		assert.ok(customizations?.navigationLinks?.length === 1);
		assert.strictEqual(customizations.navigationLinks![0].commandId, 'aiCustomization.openManagementEditor');
		const display = findTocEntry(result.tree, 'ua/display');
		assert.strictEqual(display?.emptyCopy, clientLocalEmptyCopyByGroupId['ua/display']);
		assert.ok(!display?.emptyCopy?.includes('not connected'));
		assert.ok(!display?.emptyCopy?.includes('no engine'));
	});

	test('SettingsTreeModel maps navigation links to SettingsTreeNavigationLinkElement', () => {
		const groups = mockGroups(['editor.fontSize']);
		const resolved = resolveSettingsTree(
			getTocDataForWindow(false),
			groups,
			getSettingsTocFilter(false, true),
			new NullLogService()
		).tree;

		const instantiationService = workbenchInstantiationService(undefined, store);
		const model = store.add(instantiationService.createInstance(SettingsTreeModel, { settingsTarget: ConfigurationTarget.USER_LOCAL }, true));
		model.update(resolved);

		for (const groupId of ['ua/connection', 'ua/engine', 'ua/customizations']) {
			const children = collectGroupChildren(model.root, groupId);
			assert.strictEqual(children.length, 1, `${groupId} must have one link row`);
			const link = children[0];
			assert.ok(link instanceof SettingsTreeNavigationLinkElement, `${groupId} must use SettingsTreeNavigationLinkElement`);
			assert.ok(!(link instanceof SettingsTreeNewExtensionsElement));
		}
	});

	test('SettingsTreeModel maps empty client groups to SettingsTreeEmptyCopyElement', () => {
		const groups = mockGroups(['editor.fontSize']);
		const resolved = resolveSettingsTree(
			getTocDataForWindow(false),
			groups,
			getSettingsTocFilter(false, true),
			new NullLogService()
		).tree;

		const instantiationService = workbenchInstantiationService(undefined, store);
		const model = store.add(instantiationService.createInstance(SettingsTreeModel, { settingsTarget: ConfigurationTarget.USER_LOCAL }, true));
		model.update(resolved);

		for (const groupId of ['ua/display', 'ua/chatInput', 'ua/startup', 'ua/keyboardEnter', 'ua/notifications', 'ua/permissions', 'ua/clientTools']) {
			const children = collectGroupChildren(model.root, groupId);
			assert.strictEqual(children.length, 1, `${groupId} must have one empty-copy row`);
			const emptyCopy = children[0];
			assert.ok(emptyCopy instanceof SettingsTreeEmptyCopyElement, `${groupId} must use SettingsTreeEmptyCopyElement`);
			assert.strictEqual(emptyCopy.message, clientLocalEmptyCopyByGroupId[groupId]);
			assert.ok(!emptyCopy.message.includes('not connected'));
			assert.ok(!emptyCopy.message.includes('no engine'));
		}
	});

	test('commonly-used excludes Copilot keys in default Code window', () => {
		const groups = mockGroups([
			'editor.fontSize',
			'GitHub.copilot-chat.manageExtension',
			'chat.agent.maxRequests',
		]);
		const commonlyUsed = getCommonlyUsedData(groups, DEFAULT_COMMONLY_USED_EXCLUDE_KEY_PATTERNS);
		const keys = commonlyUsed.settings?.map(s => s.key) ?? [];
		assert.ok(!keys.includes('GitHub.copilot-chat.manageExtension'));
		assert.ok(!keys.includes('chat.agent.maxRequests'));
		assert.ok(keys.includes('editor.fontSize'));
	});

	test('Agents Window keeps donor commonly-used without Copilot exclude', () => {
		const groups = mockGroups([
			'editor.fontSize',
			'GitHub.copilot-chat.manageExtension',
			'chat.agent.maxRequests',
		]);
		const commonlyUsed = getCommonlyUsedData(groups);
		const keys = commonlyUsed.settings?.map(s => s.key) ?? [];
		assert.ok(keys.includes('editor.fontSize'));
	});

	test('Connection is not registered as an IConfigurationRegistry key', () => {
		const properties = Registry.as<IConfigurationRegistry>(Extensions.Configuration).getConfigurationProperties();
		const keys = Object.keys(properties);
		assert.ok(!keys.some(key => key.startsWith('ua.connection.')));
		assert.ok(!keys.includes('connection.host'));
		assert.ok(!keys.includes('connection.port'));
		assert.ok(!keys.includes('ua.client.display.placeholder'));
		assert.ok(!keys.some(key => key.startsWith('ua.engine.')));
		assert.ok(!keys.includes('ua.client.clientTools.advertiseWorkspaceTools'));
		const clientKeys = keys.filter(key => key.startsWith('ua.client.')).sort();
		assert.deepStrictEqual(clientKeys, [
			'ua.client.chatInput.autoFocus',
			'ua.client.chatInput.restoreDrafts',
			'ua.client.clientTools.showToolInvocationDetails',
			'ua.client.display.conversationDensity',
			'ua.client.keyboardEnter.behavior',
			'ua.client.notifications.permissionRequests',
			'ua.client.notifications.turnCompleted',
			'ua.client.permissions.openPendingOnFocus',
			'ua.client.startup.restoreLastSession',
		]);
	});
});
