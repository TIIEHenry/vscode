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
const SOURCE_REL = 'src/vs/editor/contrib/inPlaceReplace/browser/inPlaceReplace.ts';

function inPlaceReplaceSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/inPlaceReplace.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `inPlaceReplace.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('InPlaceReplace leftover fire-and-forget catch scan (D671)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('decorationRemover then and outer currentRequest.then leftover sites are each one double-chain; single-chain gone in this file only', () => {
		// Both return Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(inPlaceReplaceSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const thenSite = 'this.decorationRemover.then(() => this.decorations.clear())';
		const outerThen = 'this.currentRequest.then(result => {';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`return ${outerThen}`));
		assert.strictEqual((source.match(/this\.decorationRemover\.then\(\(\) => this\.decorations\.clear\(\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/this\.currentRequest\.then\(result => \{/g) ?? []).length, 1);
		assert.ok(source.includes(`${thenSite}${doubleCatch};`));
		assert.ok(source.includes(`\t\t})${doubleCatch};`));
		assert.ok(!source.includes(`${thenSite};`));
		assert.ok(!source.includes(`${thenSite}.catch(onUnexpectedError);`));
		assert.ok(!source.includes('\t\t}).catch(onUnexpectedError);'));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 2);
		assert.strictEqual((source.match(/\.catch\(/g) ?? []).length, 4);
	});
});
