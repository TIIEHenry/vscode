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
const SOURCE_REL = 'src/vs/workbench/contrib/browserView/electron-browser/features/browserAutoReloadFeatures.ts';

function browserAutoReloadFeaturesSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/browserView/electron-browser/features/browserAutoReloadFeatures.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `browserAutoReloadFeatures.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('BrowserAutoReloadFeatures leftover fire-and-forget catch scan (D658)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this._model.reload() is single-chain; double-chain count is strictly 0', () => {
		const source = fs.readFileSync(browserAutoReloadFeaturesSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'this._model.reload()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\._model\.reload\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${singleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 0);
		assert.ok(!source.includes(doubleCatch));
	});
});
