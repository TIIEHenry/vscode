/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/sessions/contrib/providers/agentHost/browser/sessionGitHubInfo.ts';

function sessionGitHubInfoSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionGitHubInfo.ts'),
		path.join(thisDir, '../../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionGitHubInfo.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SessionGitHubInfo leftover fire-and-forget catch scan (D621)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('PR-number lookup.then keeps D181 inner catch; success-path throw double-catch onUnexpectedError (D621)', () => {
		// lookup already swallows reject (D181). then success-path throw still leaks;
		// a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionGitHubInfoSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const thenHead = 'lookup.then(prNumber => {';
		const doubleThenTail = `})${doubleCatch};\n\t\treturn prNumberObs;`;
		const singleThenTail = '}).catch(onUnexpectedError);\n\t\treturn prNumberObs;';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes(thenHead));
		assert.strictEqual((source.match(/lookup\.then\(prNumber => \{/g) ?? []).length, 1);
		assert.ok(source.includes(doubleThenTail));
		assert.ok(!source.includes(singleThenTail));
		assert.ok(source.includes('.catch(error => {\n\t\t\tonUnexpectedError(error);\n\t\t\treturn undefined;\n\t\t})'));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
	});
});
