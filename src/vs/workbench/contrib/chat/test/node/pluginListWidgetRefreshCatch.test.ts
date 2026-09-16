/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

suite('pluginListWidget refresh fire-and-forget (D556)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('pluginListWidget fire-and-forget refresh voids double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = readPluginListWidgetSource();
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleRefresh = `void this.refresh()${doubleCatch};`;
		assert.strictEqual((source.match(/void this\.refresh\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length, 7);
		assert.ok(source.includes(doubleRefresh));
		assert.ok(source.includes('onUnexpectedError'));
		assert.ok(!source.includes('void this.refresh();'));
		assert.ok(!source.includes('void this.refresh().catch(onUnexpectedError);'));
	});
});

function readPluginListWidgetSource(): string {
	const thisDir = path.dirname(fileURLToPath(import.meta.url));
	const relative = 'src/vs/workbench/contrib/chat/browser/aiCustomization/pluginListWidget.ts';
	const candidates = [
		path.join(process.cwd(), relative),
		path.join(thisDir, '../../../../../../../', relative),
	];
	const filePath = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(filePath, 'pluginListWidget.ts not found from cwd or import.meta');
	return fs.readFileSync(filePath, 'utf8');
}
