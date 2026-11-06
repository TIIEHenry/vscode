/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..');

function readRepoFile(rel: string): string {
	return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

function importIndex(source: string, specifier: string): number {
	return source.indexOf(`import '${specifier}';`);
}

/**
 * The default window and the Agents window both load `style.ts`, the theme service and
 * the settings contributions, but only the default window loads the conversation
 * contribution. Product shell pieces both windows need hang off `productShell.contribution.ts`,
 * which both entries must import after the theme service.
 *
 * What those modules register is asserted by importing them (`productShellTheme.test.ts`,
 * `productWindowProfileRegistration.test.ts`). Only the import edges of the two window
 * entries stay a source scan: importing an entry evaluates the whole workbench into the
 * registries every suite in the runner process shares, both entries cannot be evaluated
 * in one process without registering the same contributions twice, and the Node runner
 * cannot load the CSS the entries pull in.
 */
suite('Product shell module is loaded by both window entries', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const entries = [
		{ label: 'default window', rel: 'src/vs/workbench/workbench.common.main.ts', themeService: './services/themes/browser/workbenchThemeService.js', productShell: './browser/productShell.contribution.js', preferences: './contrib/preferences/browser/preferences.contribution.js' },
		{ label: 'Agents window', rel: 'src/vs/sessions/sessions.common.main.ts', themeService: '../workbench/services/themes/browser/workbenchThemeService.js', productShell: '../workbench/browser/productShell.contribution.js', preferences: '../workbench/contrib/preferences/browser/preferences.contribution.js' },
	];

	for (const entry of entries) {
		test(`${entry.label} imports it after the theme service`, () => {
			const source = readRepoFile(entry.rel);
			const themeIndex = importIndex(source, entry.themeService);
			const productShellIndex = importIndex(source, entry.productShell);
			assert.ok(themeIndex >= 0, 'theme service import');
			assert.ok(productShellIndex > themeIndex, 'product shell import comes after the theme service import');
		});

		test(`${entry.label} loads the window profile registration through preferences.contribution`, () => {
			assert.ok(importIndex(readRepoFile(entry.rel), entry.preferences) >= 0, `${entry.rel} loads preferences.contribution`);
		});
	}

	test('preferences.contribution imports the window profile registration', () => {
		assert.ok(importIndex(readRepoFile('src/vs/workbench/contrib/preferences/browser/preferences.contribution.ts'), './productWindowProfile.contribution.js') >= 0);
	});
});
