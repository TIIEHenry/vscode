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
const OVERVIEW_REL = 'src/vs/sessions/contrib/aiCustomizationTreeView/browser/aiCustomizationOverviewView.ts';

function aiCustomizationOverviewViewSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), OVERVIEW_REL),
		path.join(thisDir, '../../browser/aiCustomizationOverviewView.ts'),
		path.join(thisDir, '../../../../../../../', OVERVIEW_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `aiCustomizationOverviewView.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AICustomizationOverviewView leftover fire-and-forget catch scan (D614)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('loadCounts voids double-catch onUnexpectedError (D614)', () => {
		// Bare loadCounts voids / dropped Promises leak on reject; a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(aiCustomizationOverviewViewSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.loadCounts()';
		const doubleCall = `${call}${doubleCatch}`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async loadCounts(): Promise<void>'));
		assert.strictEqual((source.match(/void this\.loadCounts\(\)/g) ?? []).length, 5);
		assert.strictEqual((source.match(/void this\.loadCounts\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 5);
		assert.ok(source.includes(`${doubleCall};`));
		assert.ok(source.includes(`${doubleCall})`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError))`));
		assert.ok(!source.includes('() => this.loadCounts()'));
		assert.ok(!source.includes('\t\t\tthis.loadCounts();'));
		assert.ok(source.includes('this.openOverview();'));
		assert.ok(!source.includes('this.openOverview().catch'));
	});
});
