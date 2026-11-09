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

suite('Editor tab actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary tab action focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /\.tabs-container > \.tab > \.tab-actions \.action-label:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*transparent/);
		assert.match(css, /\.tabs-container > \.tab > \.tab-actions \.action-label:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.editor[\s\S]*?\.tabs-container > \.tab > \.tab-actions \.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.part\.editor[\s\S]*?\.tabs-container > \.tab > \.tab-actions \.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.tabs-container > \.tab > \.tab-actions \.action-label\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('ordinary tab actions keep the target while painting inset hover and pressed faces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /\.tab > \.tab-actions \.action-label\.codicon\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /\.tab > \.tab-actions \.action-label\.codicon::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /\.tab > \.tab-actions \.action-label\.codicon:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /\.tab > \.tab-actions \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
	});

	test('tab action transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.tab-actions \.action-label\.codicon\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.tab-actions \.action-label\.codicon::after\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.tab-actions \.action-label\.codicon\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.tab-actions \.action-label\.codicon::after\s*\{[^}]*transition:\s*none;/);
	});

	test('editor actions keep their target while painting inset hover and pressed faces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /\.editor-actions \.action-item \.action-label\s*\{[^}]*position:\s*relative;[^}]*isolation:\s*isolate;[^}]*background-color:\s*transparent/);
		assert.match(css, /\.editor-actions \.action-item \.action-label::after\s*\{[^}]*inset:\s*1px\s+2px;[^}]*z-index:\s*-1;[^}]*pointer-events:\s*none;/);
		assert.match(css, /\.editor-actions \.action-item \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /\.editor-actions \.action-item \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.editor-actions \.action-item \.action-label::after\s*\{[^}]*transition:\s*none;/);
	});
});
