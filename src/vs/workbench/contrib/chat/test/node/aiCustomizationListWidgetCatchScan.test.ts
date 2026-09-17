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
const LIST_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationListWidget.ts';

function aiCustomizationListWidgetSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), LIST_WIDGET_REL),
		path.join(thisDir, '../../../../../workbench/contrib/chat/browser/aiCustomization/aiCustomizationListWidget.ts'),
		path.join(thisDir, '../../../../../../../', LIST_WIDGET_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `aiCustomizationListWidget.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AICustomizationListWidget leftover fire-and-forget catch scan (D595)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('search delayedFilter.trigger Promise is double-caught (D595)', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(aiCustomizationListWidgetSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.delayedFilter\.trigger\(/g) ?? []).length, 1);
		assert.ok(source.includes('void this.delayedFilter.trigger(() => {'));
		const delayerMatch = source.match(/void this\.delayedFilter\.trigger\(\(\) => \{[\s\S]*?this\.filterItems\(\)[\s\S]*?announceItemCount[\s\S]*?publicLog2[\s\S]*?\}\)((?:\.catch\(onUnexpectedError\))+);/);
		assert.ok(delayerMatch, 'delayedFilter.trigger call site not found');
		assert.strictEqual(delayerMatch[1], doubleCatch);
		assert.ok(!/^\t\t\tthis\.delayedFilter\.trigger\(/m.test(source));
		assert.ok(!source.includes('\t\t\tthis.delayedFilter.trigger(() => {'));
	});
});
