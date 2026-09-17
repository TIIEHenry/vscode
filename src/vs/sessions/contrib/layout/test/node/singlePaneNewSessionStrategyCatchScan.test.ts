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
const SOURCE_REL = 'src/vs/sessions/contrib/layout/browser/singlePane/singlePaneNewSessionStrategy.ts';

function singlePaneNewSessionStrategySourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/singlePane/singlePaneNewSessionStrategy.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `singlePaneNewSessionStrategy.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SinglePaneNewSessionStrategy leftover fire-and-forget catch scan (D643)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_openEmptyFiles finally + double-catch onUnexpectedError (D643)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(singlePaneNewSessionStrategySourcePath(), 'utf8');
		const finallyFirst = '.finally(() => suppression.dispose())';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const finallyDouble = `${finallyFirst}${doubleCatch}`;
		const finallySingleTerminated = `${finallyFirst}.catch(onUnexpectedError);`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _openEmptyFiles('));
		assert.ok(source.includes('): Promise<void> {'));
		assert.strictEqual((source.match(/void this\._openEmptyFiles\(/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\.finally\(\(\) => suppression\.dispose\(\)\)/g) ?? []).length, 1);
		assert.ok(source.includes(finallyDouble));
		assert.ok(!source.includes(finallySingleTerminated));
	});
});
