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
const SOURCE_REL = 'src/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.ts';

function wordHighlighterSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/wordHighlighter.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `wordHighlighter.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('WordHighlighter leftover fire-and-forget catch scan (D668)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('three runDelayer.trigger leftover sites are each one double-chain; bare/single gone in this file only', () => {
		// Delayer.trigger returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(wordHighlighterSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const positionCall = 'this.runDelayer.trigger(() => { this._onPositionChanged(e); })';
		const runCall = 'this.runDelayer.trigger(() => { this._run(); })';
		const restoreCall = 'this.runDelayer.trigger(() => { this._run(false, delay); })';
		assert.ok(source.includes("import { onUnexpectedError, onUnexpectedExternalError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.runDelayer\.trigger\(/g) ?? []).length, 3);
		assert.strictEqual((source.split(positionCall).length - 1), 1);
		assert.strictEqual((source.split(runCall).length - 1), 1);
		assert.strictEqual((source.split(restoreCall).length - 1), 1);
		assert.ok(source.includes(`${positionCall}${doubleCatch};`));
		assert.ok(source.includes(`${runCall}${doubleCatch};`));
		assert.ok(source.includes(`${restoreCall}${doubleCatch};`));
		assert.ok(!source.includes(`${positionCall};`));
		assert.ok(!source.includes(`${runCall};`));
		assert.ok(!source.includes(`${restoreCall};`));
		assert.ok(!source.includes(`${positionCall}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${runCall}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${restoreCall}.catch(onUnexpectedError);`));
	});
});
