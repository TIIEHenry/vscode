/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const DIALOG_REL = 'src/vs/sessions/browser/sessionsSignInDialog.ts';

function sessionsSignInDialogSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), DIALOG_REL),
		path.join(thisDir, '../../browser/sessionsSignInDialog.ts'),
		path.join(thisDir, '../../../../../', DIALOG_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionsSignInDialog.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionsSignInDialog leftover fire-and-forget catch scan (D578)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('constructor show void double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionsSignInDialogSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.show()';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assert.ok(source.includes('async show('));
		assert.strictEqual((source.match(/void this\.show\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
