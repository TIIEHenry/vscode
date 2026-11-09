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

suite('Editor add tab chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary focus uses toolbar hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?add-tab-action:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*transparent/);
		assert.match(css, /add-tab-action:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /add-tab-action:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /add-tab-action:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});

	test('add tab keeps the full hit area while painting an inset pressed face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /add-tab-action\s*\{[^}]*position:\s*relative;[^}]*isolation:\s*isolate;[^}]*width:\s*var\(--vscode-spacing-size240,\s*24px\)[^}]*height:\s*var\(--vscode-spacing-size240,\s*24px\)/);
		assert.match(css, /add-tab-action::after\s*\{[^}]*inset:\s*1px\s+2px;[^}]*z-index:\s*-1;[^}]*pointer-events:\s*none;/);
		assert.match(css, /add-tab-action:active::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});

	test('add-tab transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.tabs-bar-add-tab \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.tabs-bar-add-tab \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?add-tab-action::after\s*\{[^}]*transition:\s*none;/);
	});
});
