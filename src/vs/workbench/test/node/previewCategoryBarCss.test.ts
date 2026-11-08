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

suite('Preview category bar focus styling', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('normal theme uses quiet toolbar feedback without a focus ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/previewCategoryBar.css'), 'utf8');
		const selector = String.raw`\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\)[^{]*\.part\.editor\.preview-categorized \.preview-category-tab:focus-visible`;
		assert.match(css, new RegExp(`${selector}\\s*\\{[^}]*outline:\\s*none\\s*!important;`, 's'));
		assert.match(css, new RegExp(`${selector}\\s*\\{[^}]*toolbar-hoverBackground`, 's'));
		assert.doesNotMatch(css, new RegExp(`${selector}[^}]*focusBorder`, 's'));
	});

	test('high contrast themes retain a contrast focus ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/previewCategoryBar.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.hc-black[\s\S]*?\.preview-category-tab:focus-visible[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder\)/);
		assert.match(css, /\.monaco-workbench\.hc-light[\s\S]*?\.preview-category-tab:focus-visible[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder\)/);
	});
});
