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
const SESSION_HEADER_REL = 'src/vs/sessions/browser/parts/sessionHeader.ts';

function sessionHeaderSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SESSION_HEADER_REL),
		path.join(thisDir, '../../browser/parts/sessionHeader.ts'),
		path.join(thisDir, '../../../../../', SESSION_HEADER_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionHeader.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionHeader leftover fire-and-forget catch scan (D632)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('inline renameSession double-catch onUnexpectedError (D632)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionHeaderSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = '.renameSession(session, newTitle)';
		const doubleCall = `${call}\n\t\t\t\t\t${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/\.renameSession\(session, newTitle\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call}\n\t\t\t\t\t.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${call};`));
	});
});
