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
const SOURCE_REL = 'src/vs/editor/contrib/format/browser/formatActions.ts';

function formatActionsSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/formatActions.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `formatActions.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('FormatOnPaste leftover fire-and-forget catch scan (D669)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('formatDocumentRangesWithSelectedProvider leftover site double-catch onUnexpectedError (D669)', () => {
		// invokeFunction returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(formatActionsSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'this._instantiationService.invokeFunction(formatDocumentRangesWithSelectedProvider, this.editor, range, FormattingMode.Silent, Progress.None, CancellationToken.None, false)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\._instantiationService\.invokeFunction\(formatDocumentRangesWithSelectedProvider/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
