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
 */
suite('Product shell module is loaded by both window entries', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const entries = [
		{ label: 'default window', rel: 'src/vs/workbench/workbench.common.main.ts', themeService: './services/themes/browser/workbenchThemeService.js', productShell: './browser/productShell.contribution.js' },
		{ label: 'Agents window', rel: 'src/vs/sessions/sessions.common.main.ts', themeService: '../workbench/services/themes/browser/workbenchThemeService.js', productShell: '../workbench/browser/productShell.contribution.js' },
	];

	for (const entry of entries) {
		test(`${entry.label} imports it after the theme service`, () => {
			const source = readRepoFile(entry.rel);
			const themeIndex = importIndex(source, entry.themeService);
			const productShellIndex = importIndex(source, entry.productShell);
			assert.ok(themeIndex >= 0, 'theme service import');
			assert.ok(productShellIndex > themeIndex, 'product shell import comes after the theme service import');
		});
	}

	test('the product style sheets come from the module, not from style.ts', () => {
		const style = readRepoFile('src/vs/workbench/browser/style.ts');
		assert.ok(!style.includes('productAccessibility.css'));
		assert.ok(!style.includes('ua-common.css'));

		const productShell = readRepoFile('src/vs/workbench/browser/productShell.contribution.ts');
		assert.ok(productShell.includes(`import './productShell/media/productAccessibility.css';`));
		assert.ok(productShell.includes(`import './parts/conversation/media/ua-common.css';`));
		assert.ok(fs.existsSync(path.join(repoRoot, 'src/vs/workbench/browser/productShell/media/productAccessibility.css')));
	});

	test('the module is not hung off the conversation contribution, which the Agents window does not load', () => {
		const conversation = readRepoFile('src/vs/workbench/contrib/conversation/browser/conversation.contribution.ts');
		assert.ok(!conversation.includes('productShell.contribution'));
	});
});
