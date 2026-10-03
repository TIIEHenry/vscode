/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isEqualOrParent } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { sourcesFilterFitsOnBar, sourcesListDirectoryTarget } from '../../common/sourcesFilesListMode.js';

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
});
