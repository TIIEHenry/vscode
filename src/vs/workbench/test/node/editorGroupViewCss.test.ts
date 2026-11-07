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

suite('Editor watermark empty action chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary focus uses the existing quiet hover fill while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /preview-category-empty-action-button:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background:\s*color-mix\(in srgb, var\(--vscode-foreground\) 10%/);
		assert.match(css, /hc-black[\s\S]*?preview-category-empty-action-button:focus-visible[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /preview-category-empty-action-button:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});

	test('preview actions honor reduced motion without changing ordinary or HC focus styling', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /\.preview-category-empty-action-button\s*\{[^}]*transition:\s*background-color 0\.12s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?preview-category-empty-action-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?preview-category-empty-action-button\s*\{[^}]*transition:\s*none;/);
	});
});
