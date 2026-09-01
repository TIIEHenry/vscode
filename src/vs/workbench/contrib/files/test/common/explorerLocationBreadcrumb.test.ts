/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as dom from '../../../../../base/browser/dom.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { EXPLORER_LOCATION_ROOT_ID, getExplorerLocationBreadcrumbItems } from '../../common/explorerLocationBreadcrumb.js';
import { ExplorerInlineFilterBox } from '../../browser/explorerInlineFilterBox.js';
import { ExplorerLocationBreadcrumbBox } from '../../browser/explorerLocationBreadcrumbBox.js';

suite('Files - explorer location breadcrumb', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	const rootLabel = 'Root';

	test('getExplorerLocationBreadcrumbItems returns empty for missing folder', function () {
		assert.deepStrictEqual(getExplorerLocationBreadcrumbItems(undefined, rootLabel), []);
	});

	test('getExplorerLocationBreadcrumbItems yields Root and path segments in order', function () {
		const items = getExplorerLocationBreadcrumbItems(URI.file('/home/user/project'), rootLabel);
		assert.strictEqual(items.length, 4);
		assert.strictEqual(items[0].id, EXPLORER_LOCATION_ROOT_ID);
		assert.strictEqual(items[0].label, rootLabel);
		assert.strictEqual(items[1].label, 'home');
		assert.strictEqual(items[2].label, 'user');
		assert.strictEqual(items[3].label, 'project');
	});

	test('getExplorerLocationBreadcrumbItems does not insert middle ellipsis', function () {
		const items = getExplorerLocationBreadcrumbItems(URI.file('/a/b/c/d/e/f/g/h'), rootLabel);
		for (const item of items) {
			assert.notStrictEqual(item.label, '…');
			assert.notStrictEqual(item.label, '...');
		}
		assert.strictEqual(items.length, 9);
	});

	test('getExplorerLocationBreadcrumbItems keeps every segment for multi-segment paths', function () {
		const items = getExplorerLocationBreadcrumbItems(URI.file('/storage/emulated/0'), rootLabel);
		assert.deepStrictEqual(items.map(item => item.label), ['Root', 'storage', 'emulated', '0']);
	});

	test('ExplorerLocationBreadcrumbBox hides row when items are empty', function () {
		const container = dom.$('.explorer-view-body');
		document.body.appendChild(container);

		const box = disposables.add(new ExplorerLocationBreadcrumbBox(container));
		box.setItems([]);

		assert.ok(box.element.classList.contains('hidden'));
		assert.strictEqual(box.isVisible, false);

		container.remove();
	});

	test('ExplorerLocationBreadcrumbBox mounts above inline filter in body chrome order', function () {
		const container = dom.$('.explorer-view-body');
		document.body.appendChild(container);

		const breadcrumbBox = disposables.add(new ExplorerLocationBreadcrumbBox(container));
		breadcrumbBox.setItems([{ id: EXPLORER_LOCATION_ROOT_ID, label: rootLabel }, { id: URI.file('/project').toString(), label: 'project' }]);
		const filterBox = disposables.add(new ExplorerInlineFilterBox(container, 'Filter files', 'Filter files'));
		const treeContainer = dom.append(container, dom.$('.explorer-folders-view'));

		const children = Array.from(container.children);
		assert.strictEqual(children.indexOf(breadcrumbBox.element) < children.indexOf(filterBox.element), true);
		assert.strictEqual(children.indexOf(filterBox.element) < children.indexOf(treeContainer), true);

		container.remove();
	});

	test('ExplorerLocationBreadcrumbBox layout reserves tree space when visible', function () {
		const container = dom.$('.explorer-view-body');
		document.body.appendChild(container);

		const breadcrumbBox = disposables.add(new ExplorerLocationBreadcrumbBox(container));
		breadcrumbBox.setItems([{ id: EXPLORER_LOCATION_ROOT_ID, label: rootLabel }]);
		disposables.add(new ExplorerInlineFilterBox(container, 'Filter files', 'Filter files'));
		const treeContainer = dom.append(container, dom.$('.explorer-folders-view'));
		treeContainer.style.flex = '1';

		const totalChromeHeight = ExplorerLocationBreadcrumbBox.HEIGHT + ExplorerInlineFilterBox.HEIGHT;
		assert.strictEqual(totalChromeHeight, 56);
		assert.ok(treeContainer.parentElement === container);

		container.remove();
	});
});
