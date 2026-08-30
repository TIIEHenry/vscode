/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { NullFilesConfigurationService, TestFileService } from '../../../../test/common/workbenchTestServices.js';
import { ExplorerItem } from '../../../files/common/explorerModel.js';
import { SortOrder } from '../../../files/common/files.js';
import { collectSourcesFileEntries } from '../../common/sourcesFilesModel.js';

suite('Sources - Files list projection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const fileService = new TestFileService();
	const configService = new TestConfigurationService();

	function createStat(this: Mocha.Context, path: string, name: string, isFolder: boolean): ExplorerItem {
		return new ExplorerItem(toResource.call(this, path), fileService, configService, NullFilesConfigurationService, undefined, isFolder, false, false, false, name);
	}

	test('collectSourcesFileEntries projects resolved explorer files', async function () {
		const root = createStat.call(this, '/project', 'project', true);
		root._isDirectoryResolved = true;

		const src = createStat.call(this, '/project/src', 'src', true);
		src._isDirectoryResolved = true;
		root.addChild(src);

		const index = createStat.call(this, '/project/src/index.ts', 'index.ts', false);
		src.addChild(index);

		const readme = createStat.call(this, '/project/README.md', 'README.md', false);
		root.addChild(readme);

		const entries = await collectSourcesFileEntries([root], SortOrder.Default);

		assert.strictEqual(entries.length, 2);
		assert.strictEqual(entries[0].name, 'index.ts');
		assert.strictEqual(entries[0].description, 'src/index.ts');
		assert.strictEqual(entries[1].name, 'README.md');
		assert.strictEqual(entries[1].description, 'README.md');
	});

	test('collectSourcesFileEntries skips excluded items', async function () {
		const root = createStat.call(this, '/project', 'project', true);
		root._isDirectoryResolved = true;

		const hidden = createStat.call(this, '/project/hidden.ts', 'hidden.ts', false);
		hidden.isExcluded = true;
		root.addChild(hidden);

		const visible = createStat.call(this, '/project/visible.ts', 'visible.ts', false);
		root.addChild(visible);

		const entries = await collectSourcesFileEntries([root], SortOrder.Default);

		assert.strictEqual(entries.length, 1);
		assert.strictEqual(entries[0].name, 'visible.ts');
	});
});
