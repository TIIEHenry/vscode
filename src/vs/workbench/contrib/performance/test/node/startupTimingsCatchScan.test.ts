/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/workbench/contrib/performance/electron-browser/startupTimings.ts';

function startupTimingsSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../electron-browser/startupTimings.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `startupTimings.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('NativeStartupTimings leftover fire-and-forget catch scan (D661)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_report and _appendStartupTimes leftover sites are each one double-chain; bare/single gone in this file only', () => {
		// Both return Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(startupTimingsSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const reportCall = 'this._report()';
		const appendCall = 'this._appendStartupTimes(standardStartupError)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\._report\(\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/this\._appendStartupTimes\(standardStartupError\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${reportCall}${doubleCatch};`));
		assert.ok(source.includes(`${appendCall}${doubleCatch};`));
		assert.ok(!source.includes(`${reportCall};`));
		assert.ok(!source.includes(`${appendCall};`));
		assert.ok(!source.includes(`${reportCall}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${appendCall}.catch(onUnexpectedError);`));
	});
});
