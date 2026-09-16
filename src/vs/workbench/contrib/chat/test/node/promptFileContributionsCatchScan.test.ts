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
const PROMPT_FILE_CONTRIBUTIONS_REL = 'src/vs/workbench/contrib/chat/browser/promptSyntax/promptFileContributions.ts';

function promptFileContributionsSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), PROMPT_FILE_CONTRIBUTIONS_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/promptSyntax/promptFileContributions.ts'),
		path.join(thisDir, '../../../../../../../', PROMPT_FILE_CONTRIBUTIONS_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `promptFileContributions.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('PromptFileContributions leftover fire-and-forget catch scan (D579)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ctor updateRegistration void is double-caught; bare/single-chain gone in this file only', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(promptFileContributionsSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleUpdate = `void this.updateRegistration()${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('async updateRegistration('));
		assert.strictEqual((source.match(/void this\.updateRegistration\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleUpdate));
		assert.ok(!source.includes('void this.updateRegistration();'));
		assert.ok(!source.includes('void this.updateRegistration().catch(onUnexpectedError);'));
	});
});
