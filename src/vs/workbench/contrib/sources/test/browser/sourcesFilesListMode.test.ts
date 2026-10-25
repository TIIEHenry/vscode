/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isEqualOrParent } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { isIMenuItem, MenuId, MenuRegistry } from '../../../../../platform/actions/common/actions.js';
import { SOURCES_FILES_LIST_MODE_STORAGE_KEY, sourcesFilterFitsOnBar, sourcesListDirectoryTarget } from '../../common/sourcesFilesListMode.js';
import { readSourcesFilesListMode, SOURCES_FILES_EXPLORER_ID, sourcesFilesListModeScope, sourcesFilesListModeStorageKey } from '../../browser/sourcesFilesExplorer.js';
import { SourcesListFilterBox } from '../../browser/sourcesListFilterBox.js';

suite('Sources - files list mode', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const contains = (resource: URI, parent: URI) => isEqualOrParent(resource, parent);

	test('list directory stays on the workspace folder when the pick is above it', function () {
		const root = URI.file('/home/clarence/Projects/Agents/UniverseAgent');
		const home = URI.file('/home');
		const nested = URI.file('/home/clarence/Projects/Agents/UniverseAgent/src');

		assert.strictEqual(sourcesListDirectoryTarget(undefined, [root], contains)?.toString(), root.toString());
		assert.strictEqual(sourcesListDirectoryTarget(home, [root], contains)?.toString(), root.toString());
		assert.strictEqual(sourcesListDirectoryTarget(root, [root], contains)?.toString(), root.toString());
		assert.strictEqual(sourcesListDirectoryTarget(nested, [root], contains)?.toString(), nested.toString());
		assert.strictEqual(sourcesListDirectoryTarget(URI.file('/tmp/other'), [root], contains)?.toString(), root.toString());
		assert.strictEqual(sourcesListDirectoryTarget(root, [], contains), undefined);
	});

	test('list directory snaps to the only workspace folder contained by the pick', function () {
		const left = URI.file('/work/left');
		const right = URI.file('/work/right');
		const parent = URI.file('/work');

		assert.strictEqual(sourcesListDirectoryTarget(parent, [left], contains)?.toString(), left.toString());
		assert.strictEqual(sourcesListDirectoryTarget(parent, [left, right], contains)?.toString(), left.toString());
		assert.strictEqual(sourcesListDirectoryTarget(URI.file('/work/right/lib'), [left, right], contains)?.toString(), URI.file('/work/right/lib').toString());
	});

	test('filter fits on the bar only when the part is at least 600px', function () {
		assert.strictEqual(sourcesFilterFitsOnBar(0), false);
		assert.strictEqual(sourcesFilterFitsOnBar(599), false);
		assert.strictEqual(sourcesFilterFitsOnBar(600), true);
	});

	test('sources filter clear action has its own accessible name', function () {
		const parent = document.createElement('div');
		const filter = store.add(new SourcesListFilterBox(parent, 'Filter files', 'Filter files'));
		const clear = parent.querySelector('.sources-list-filter-clear') as HTMLButtonElement | null;
		assert.ok(clear);
		assert.strictEqual(clear.type, 'button');
		assert.strictEqual(clear.getAttribute('aria-label'), 'Clear filter');
		filter.dispose();
	});

	test('same project key shares list mode and different project keys stay independent', function () {
		const values = new Map<string, string>();
		const read = (key: string) => values.get(key);
		const projectA = 'engine-a\n/work/app';
		const projectB = 'engine-b\n/work/app';

		const first = readSourcesFilesListMode(read, projectA, 'sess-1');
		assert.strictEqual(first.writeSeed, true);
		values.set(first.storageKey, 'list');

		const sameProject = readSourcesFilesListMode(read, projectA, 'sess-2');
		assert.strictEqual(sameProject.storageKey, sourcesFilesListModeStorageKey(projectA, 'sess-1'));
		assert.strictEqual(sameProject.mode, 'list');
		assert.strictEqual(sameProject.writeSeed, false);

		const otherProject = readSourcesFilesListMode(read, projectB, 'sess-1');
		assert.notStrictEqual(otherProject.storageKey, first.storageKey);
		assert.strictEqual(otherProject.mode, 'tree');
		assert.strictEqual(otherProject.writeSeed, true);
		values.set(otherProject.storageKey, 'tree');

		assert.strictEqual(readSourcesFilesListMode(read, projectA, 'sess-2').mode, 'list');
		assert.strictEqual(readSourcesFilesListMode(read, projectB, 'sess-3').mode, 'tree');
	});

	test('missing project key is session private and the window key seeds once', function () {
		const values = new Map<string, string>();
		values.set(SOURCES_FILES_LIST_MODE_STORAGE_KEY, 'list');
		const read = (key: string) => values.get(key);

		assert.strictEqual(sourcesFilesListModeScope(undefined, 'sess-1'), 'session:sess-1');
		assert.notStrictEqual(
			sourcesFilesListModeStorageKey(undefined, 'sess-1'),
			sourcesFilesListModeStorageKey(undefined, 'sess-2'),
		);

		const seeded = readSourcesFilesListMode(read, undefined, 'sess-1');
		assert.strictEqual(seeded.mode, 'list');
		assert.strictEqual(seeded.writeSeed, true);
		values.set(seeded.storageKey, seeded.mode);
		assert.strictEqual(values.get(SOURCES_FILES_LIST_MODE_STORAGE_KEY), 'list');

		values.set(SOURCES_FILES_LIST_MODE_STORAGE_KEY, 'tree');
		const again = readSourcesFilesListMode(read, undefined, 'sess-1');
		assert.strictEqual(again.mode, 'list');
		assert.strictEqual(again.writeSeed, false);
		assert.strictEqual(values.get(SOURCES_FILES_LIST_MODE_STORAGE_KEY), 'tree');

		const otherSession = readSourcesFilesListMode(read, undefined, 'sess-2');
		assert.strictEqual(otherSession.mode, 'tree');
		assert.strictEqual(otherSession.writeSeed, true);
		assert.ok(otherSession.storageKey.includes('session:sess-2'));
	});

	test('switching the active work root reloads that project list mode', function () {
		const values = new Map<string, string>();
		const read = (key: string) => values.get(key);
		const left = 'engine\n/left';
		const right = 'engine\n/right';
		values.set(sourcesFilesListModeStorageKey(left, 'sess-left'), 'list');
		values.set(sourcesFilesListModeStorageKey(right, 'sess-right'), 'tree');

		assert.strictEqual(readSourcesFilesListMode(read, left, 'sess-left').mode, 'list');
		assert.strictEqual(readSourcesFilesListMode(read, left, 'sess-left').writeSeed, false);
		assert.strictEqual(readSourcesFilesListMode(read, right, 'sess-right').mode, 'tree');
		assert.strictEqual(readSourcesFilesListMode(read, left, 'sess-left').mode, 'list');
	});

	test('files explorer registers six navigation actions in ViewTitle with correct orders and metadata', function () {
		const items = MenuRegistry.getMenuItems(MenuId.ViewTitle).filter(isIMenuItem);
		const filesItems = items.filter(item => {
			const when = item.when?.serialize();
			return when?.includes(`view == '${SOURCES_FILES_EXPLORER_ID}'`) || when?.includes(`view == ${SOURCES_FILES_EXPLORER_ID}`);
		});

		const expectedActions = [
			{ id: 'sources.files.action.createFile', order: 10 },
			{ id: 'sources.files.action.createFolder', order: 20 },
			{ id: 'sources.files.action.refresh', order: 30 },
			{ id: 'sources.files.action.collapse', order: 40 },
			{ id: 'sources.files.action.viewAsTree', order: 50 },
			{ id: 'sources.files.action.viewAsList', order: 60 },
		];

		for (const expected of expectedActions) {
			const found = filesItems.find(item => item.command.id === expected.id);
			assert.ok(found, `Expected action ${expected.id} to be registered in ViewTitle`);
			assert.strictEqual(found.group, 'navigation');
			assert.strictEqual(found.order, expected.order);
			assert.ok(found.command.icon, `Expected action ${expected.id} to have an icon`);
			assert.ok(found.command.title, `Expected action ${expected.id} to have a title`);
		}
	});
});
