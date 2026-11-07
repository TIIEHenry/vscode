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

suite('Statusbar part', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary status entry focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/statusbar/media/statusbarpart.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.part\.statusbar > \.items-container > \.statusbar-item > \.statusbar-item-label:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-statusBarItem-hoverBackground,\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.statusbar > \.items-container > \.statusbar-item > \.statusbar-item-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.part\.statusbar > \.items-container > \.statusbar-item > \.statusbar-item-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.part\.statusbar > \.items-container > \.statusbar-item > \.statusbar-item-label:focus-visible\s*\{[^}]*var\(--vscode-focusBorder\)/);
	});

	test('status entry press feedback honors reduced motion while preserving active and focus states', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/statusbar/media/statusbarpart.css'), 'utf8');
		assert.match(css, /part\.statusbar > \.items-container > \.statusbar-item > \.statusbar-item-label\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.statusbar > \.items-container > \.statusbar-item > \.statusbar-item-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.statusbar > \.items-container > \.statusbar-item > \.statusbar-item-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /part\.statusbar > \.items-container > \.statusbar-item a:active:not\(\.disabled\) \.statusbar-item-label,[\s\S]*?background-color:\s*var\(--vscode-statusBarItem-activeBackground/);
	});
});
