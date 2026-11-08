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

suite('Editor watermark toolbar', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary watermark action focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /editor-group-watermark-toolbar-container \.action-label:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*transparent/);
		assert.match(css, /editor-group-watermark-toolbar-container \.action-label:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.editor[\s\S]*?editor-group-watermark-toolbar-container \.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.part\.editor[\s\S]*?editor-group-watermark-toolbar-container \.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /editor-group-watermark-toolbar-container \.action-label\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('watermark action presses an inset face while keeping the host transparent', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /editor-group-watermark-toolbar-container \.action-label:active\s*\{[^}]*background-color:\s*transparent/);
		assert.match(css, /editor-group-watermark-toolbar-container \.action-label:active::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(css, /editor-group-watermark-toolbar-container \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
	});

	test('watermark action transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?editor-group-watermark-toolbar-container \.action-label(?:,|\s*\{)[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?editor-group-watermark-toolbar-container \.action-label(?:,|\s*\{)[^}]*transition:\s*none;/);
	});
});
