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

suite('Panel composite title actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('panel title actions honor reduced motion while preserving active color feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/panel/media/panelpart.css'), 'utf8');
		assert.match(css, /part\.panel > \.title > \.composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item \.action-label\s*\{[^}]*transition:\s*color 0\.08s ease, background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.panel > \.title > \.composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.panel > \.title > \.composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /part\.panel > \.title > \.composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item:active \.action-label\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(css, /part\.panel > \.title > \.composite-bar-container >\s*\.composite-bar > \.monaco-action-bar \.action-item:focus \.action-label,[\s\S]*?color:\s*var\(--vscode-panelTitle-activeForeground\)/);
	});

	test('ordinary hover and keyboard focus use a quiet toolbar surface while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/panel/media/panelpart.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?part\.panel[\s\S]*?\.action-item:not\(\.disabled\):hover \.action-label,[\s\S]*?\.action-item:not\(\.disabled\):focus-visible \.action-label\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?part\.panel[\s\S]*?\.action-item:focus-visible \.action-label\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
	});

	test('pressed surface is declared after hover and focus surfaces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/panel/media/panelpart.css'), 'utf8');
		const hoverIndex = css.indexOf('.action-item:not(.disabled):hover .action-label');
		const focusIndex = css.indexOf('.action-item:not(.disabled):focus-visible .action-label');
		const pressedIndex = css.indexOf('.action-item:active .action-label');
		assert.ok(hoverIndex >= 0 && focusIndex >= 0 && pressedIndex > hoverIndex && pressedIndex > focusIndex, 'pressed panel surface must win over hover/focus');
		assert.match(css.slice(pressedIndex), /background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});
});
