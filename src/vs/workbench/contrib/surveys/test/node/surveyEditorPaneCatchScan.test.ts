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
const SOURCE_REL = 'src/vs/workbench/contrib/surveys/browser/surveyEditorPane.ts';

function surveyEditorPaneSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/surveyEditorPane.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `surveyEditorPane.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SurveyEditorPane leftover fire-and-forget catch scan (D665)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('closeEditor leftover site double-catch onUnexpectedError (D665)', () => {
		// closeEditor returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(surveyEditorPaneSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'this.editorService.closeEditor({ editor: submittedInput, groupId: this.group.id })';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.editorService\.closeEditor\(\{ editor: submittedInput, groupId: this\.group\.id \}\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
