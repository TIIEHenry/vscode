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
const SOURCE_REL = 'src/vs/sessions/contrib/automations/browser/automationDialog.ts';

function sourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/automationDialog.ts'),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `automationDialog.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('Automation dialog fire-and-forget catch scan (D1330)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('repository reload and mobile dispatch catch rejected promises', () => {
		const source = fs.readFileSync(sourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.reloadRepository\([^\n;]+\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(new RegExp(`void this\\.reloadRepository\\([^\\n;]+\\)${doubleCatch}`, 'g')) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._dispatchPickerItem\(item\)/g) ?? []).length, 1);
		assert.ok(source.includes(`void this._dispatchPickerItem(item)${doubleCatch};`));
	});
});
