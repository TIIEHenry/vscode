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
const SOURCE_REL = 'src/vs/workbench/contrib/debug/browser/breakpointEditorContribution.ts';

function breakpointEditorContributionSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/debug/browser/breakpointEditorContribution.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `breakpointEditorContribution.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('BreakpointEditorContribution leftover fire-and-forget catch scan (D662)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('runTo(uri, lineNumber) leftover site double-catch onUnexpectedError (D662)', () => {
		// runTo returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(breakpointEditorContributionSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'this.debugService.runTo(uri, lineNumber)';
		const site = `run: () => ${call}`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.debugService\.runTo\(uri, lineNumber\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${site}${doubleCatch}`));
		assert.ok(!source.includes(`${site}${doubleCatch};`));
		assert.ok(!source.includes(`${site};`));
		assert.ok(!source.includes(`${site}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${site}\n`));
		assert.ok(!source.includes(`${site}.catch(onUnexpectedError)\n`));
	});
});
