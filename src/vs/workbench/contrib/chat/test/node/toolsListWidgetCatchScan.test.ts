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
const SOURCE_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/toolsListWidget.ts';

function toolsListWidgetSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/aiCustomization/toolsListWidget.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `toolsListWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('ToolsListWidget leftover fire-and-forget catch scan', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_queryGallery leftover voids are double-chain; opener leftover stays skipped', () => {
		// _queryGallery returns Promise; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows (D480).
		const source = fs.readFileSync(toolsListWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const queryCall = 'void this._queryGallery()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._queryGallery\(\)/g) ?? []).length, 2);
		assert.ok(source.includes(`${queryCall}${doubleCatch};`));
		assert.ok(!source.includes(`${queryCall};`));
		assert.ok(!source.includes(`${queryCall}.catch(onUnexpectedError);`));
		assert.ok(!/^\t+this\._queryGallery\(\);/m.test(source));
		assert.ok(source.includes('void this._openerService.open(URI.parse(learnMore.href));'));
	});
});
