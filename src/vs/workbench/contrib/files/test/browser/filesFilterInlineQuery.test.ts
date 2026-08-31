/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { TreeVisibility } from '../../../../../base/browser/ui/tree/tree.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { URI } from '../../../../../base/common/uri.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { NullFilesConfigurationService, TestFileService } from '../../../../test/common/workbenchTestServices.js';
import { IExplorerService } from '../../browser/files.js';
import { FilesFilter } from '../../browser/views/explorerViewer.js';
import { ExplorerItem } from '../../common/explorerModel.js';

suite('Files - FilesFilter inline query', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	const fileService = new TestFileService();
	const configService = new TestConfigurationService();

	function createStat(path: string, isFolder: boolean, name?: string): ExplorerItem {
		return new ExplorerItem(URI.from({ scheme: 'file', path }), fileService, configService, NullFilesConfigurationService, undefined, isFolder, false, false, false, name);
	}

	let root: ExplorerItem;
	let filter: FilesFilter;
	let instantiationService: TestInstantiationService;

	setup(() => {
		root = createStat('/root', true, 'root');
		const src = createStat('/root/src', true, 'src');
		const index = createStat('/root/src/index.ts', false, 'index.ts');
		const readme = createStat('/root/README.md', false, 'README.md');

		root.addChild(src);
		src.addChild(index);
		root.addChild(readme);

		instantiationService = workbenchInstantiationService(undefined, disposables);
		instantiationService.stub(IExplorerService, {
			roots: [root],
			findClosestRoot: () => root,
			getEditableData: () => undefined,
		});

		filter = instantiationService.createInstance(FilesFilter);
		disposables.add(filter);
	});

	test('setInlineQuery fires onDidChange', function () {
		let changeCount = 0;
		disposables.add(filter.onDidChange(() => changeCount++));
		filter.setInlineQuery('a');
		filter.setInlineQuery('a');
		filter.setInlineQuery('b');
		assert.strictEqual(changeCount, 2);
	});

	test('inline query hides non-matching files and keeps directories visible', function () {
		filter.setInlineQuery('index');

		assert.strictEqual(filter.filter(src, TreeVisibility.Visible), true);
		assert.strictEqual(filter.filter(index, TreeVisibility.Visible), true);
		assert.strictEqual(filter.filter(readme, TreeVisibility.Visible), false);
	});

	test('empty inline query shows all visible files', function () {
		filter.setInlineQuery('missing');
		filter.setInlineQuery('');

		assert.strictEqual(filter.filter(index, TreeVisibility.Visible), true);
		assert.strictEqual(filter.filter(readme, TreeVisibility.Visible), true);
	});

	test('editable items stay visible with inline query', function () {
		instantiationService.stub(IExplorerService, {
			roots: [root],
			findClosestRoot: () => root,
			getEditableData: (stat: ExplorerItem | undefined) => stat === readme ? {} : undefined,
		});
		filter = instantiationService.createInstance(FilesFilter);
		disposables.add(filter);

		filter.setInlineQuery('missing');
		assert.strictEqual(filter.filter(readme, TreeVisibility.Visible), true);
	});
});
