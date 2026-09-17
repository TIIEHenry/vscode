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
const SOURCE_REL = 'src/vs/workbench/contrib/notebook/common/notebookEditorInput.ts';

function notebookEditorInputSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../common/notebookEditorInput.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `notebookEditorInput.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('NotebookEditorInput leftover fire-and-forget catch scan (D660)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('side-loaded this.resolve() leftover site double-catch onUnexpectedError (D660)', () => {
		// this.resolve() returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(notebookEditorInputSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'this.resolve()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.resolve\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
