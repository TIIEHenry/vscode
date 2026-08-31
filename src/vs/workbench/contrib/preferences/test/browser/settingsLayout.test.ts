/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { ISetting, ISettingsGroup } from '../../../../services/preferences/common/preferences.js';
import { nullRange } from '../../../../services/preferences/common/preferencesModels.js';
import { ADVANCED_SETTING_TAG } from '../../common/preferences.js';
import { getSettingsTocFilter, getTocDataForWindow, ITOCEntry, tocData } from '../../browser/settingsLayout.js';
import { resolveSettingsTree } from '../../browser/settingsTree.js';

function childIds<T>(entry: ITOCEntry<T> | undefined): string[] {
	return entry?.children?.map(child => child.id) ?? [];
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

function mockGroups(keys: Array<string | { key: string; tags?: string[] }>): ISettingsGroup[] {
	return [{
		id: 'test',
		range: nullRange,
		title: 'test',
		titleRange: nullRange,
		sections: [{
			settings: keys.map(entry => typeof entry === 'string' ? mockSetting(entry) : mockSetting(entry.key, entry.tags))
		}]
	}];
}

suite('Settings TOC by window', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('source tocData still has the Chat tree', () => {
		assert.ok(childIds(tocData).includes('chat'), 'settingsLayout source must keep id:\'chat\'');
	});

	test('default Code window assembly omits Chat and keeps Search and Diff', () => {
		const toc = getTocDataForWindow(false);
		const ids = childIds(toc);
		assert.ok(!ids.includes('chat'), 'default Code window must not hang the Chat TOC node');
		assert.ok(ids.includes('editor'));
		assert.ok(ids.includes('features'));
		assert.ok(childIds(toc.children?.find(child => child.id === 'features')).includes('features/search'), 'Search TOC must remain');
		assert.ok(childIds(toc.children?.find(child => child.id === 'editor')).includes('editor/diffEditor'), 'Diff TOC must remain');
		assert.notStrictEqual(toc, tocData);
		assert.ok(childIds(tocData).includes('chat'), 'source tocData must be unchanged');
	});

	test('Agents Window uses source tocData including Chat', () => {
		const toc = getTocDataForWindow(true);
		assert.strictEqual(toc, tocData, 'Agents Window must use the source TOC structure');
		assert.ok(childIds(toc).includes('chat'));
	});

	test('default Code window always has an exclude filter, including when advanced is on', () => {
		const advancedOn = getSettingsTocFilter(false, true);
		assert.ok(advancedOn, 'default window must not pass filter=undefined when advanced is on');
		assert.ok(advancedOn.exclude, 'default window must always carry exclude');
		assert.ok(advancedOn.exclude.keyPatterns?.includes('chat.agent.*'), 'default window exclude must cover Chat keys so Chat cannot leak back');

		const advancedOff = getSettingsTocFilter(false, false);
		assert.ok(advancedOff?.exclude);
		assert.ok(advancedOff.exclude.tags?.includes(ADVANCED_SETTING_TAG));
		assert.ok(advancedOff.exclude.keyPatterns?.includes('chat.agent.*'));
	});

	test('Agents Window keeps source filter behavior', () => {
		assert.strictEqual(getSettingsTocFilter(true, true), undefined, 'Agents Window may omit filter when advanced is on');
		const advancedOff = getSettingsTocFilter(true, false);
		assert.deepStrictEqual(advancedOff, { exclude: { tags: [ADVANCED_SETTING_TAG] } });
	});

	test('resolved default window TOC omits Chat even when advanced is on', () => {
		const groups = mockGroups([
			'editor.fontSize',
			'search.exclude',
			'diffEditor.renderSideBySide',
			'chat.agent.maxRequests',
			{ key: 'editor.minimap.enabled', tags: [ADVANCED_SETTING_TAG] }
		]);
		const result = resolveSettingsTree(
			getTocDataForWindow(false),
			groups,
			getSettingsTocFilter(false, true),
			new NullLogService()
		);
		assert.ok(!childIds(result.tree).includes('chat'));
		assert.ok(childIds(result.tree).includes('editor'));
		assert.ok(childIds(result.tree).includes('features'));
		assert.ok(childIds(result.tree.children?.find(child => child.id === 'features')).includes('features/search'));
		assert.ok(childIds(result.tree.children?.find(child => child.id === 'editor')).includes('editor/diffEditor'));
	});

	test('resolved Agents Window TOC keeps Chat', () => {
		const groups = mockGroups([
			'editor.fontSize',
			'chat.agent.maxRequests'
		]);
		const result = resolveSettingsTree(
			getTocDataForWindow(true),
			groups,
			getSettingsTocFilter(true, true),
			new NullLogService()
		);
		assert.ok(childIds(result.tree).includes('chat'));
		assert.ok(childIds(result.tree.children?.find(child => child.id === 'chat')).includes('chat/agent'));
	});
});
