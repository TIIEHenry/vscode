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

suite('Editor group toolbar', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary group toolbar focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /editor-group-container-toolbar \.action-label:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*transparent/);
		assert.match(css, /editor-group-container-toolbar \.action-label:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.editor[\s\S]*?editor-group-container-toolbar \.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.part\.editor[\s\S]*?editor-group-container-toolbar \.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /editor-group-container-toolbar \.action-label\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('group toolbar action faces stay inset while preserving the host hit target', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /editor-group-container-toolbar \.action-label\s*\{[^}]*background-color:\s*transparent/);
		assert.match(css, /editor-group-container-toolbar \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /editor-group-container-toolbar \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /editor-group-container-toolbar \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /editor-group-container-toolbar \.action-label:focus-visible::after\s*\{[^}]*toolbar-hoverBackground/);
	});

	test('group toolbar transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?editor-group-container-toolbar \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?editor-group-container-toolbar \.action-label\s*\{[^}]*transition:\s*none;/);
	});

	test('preview category empty-group actions keep the hit target while painting an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /preview-category-empty-group-actions \.action-label\s*\{[^}]*width:\s*24px[^}]*height:\s*24px[^}]*background-color:\s*transparent/);
		assert.match(css, /preview-category-empty-group-actions \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /preview-category-empty-group-actions \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /preview-category-empty-group-actions \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /preview-category-empty-group-actions \.action-label:focus-visible::after\s*\{[^}]*toolbar-hoverBackground/);
	});

	test('preview category empty-group actions honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /monaco-reduce-motion[\s\S]*?preview-category-empty-group-actions \.action-label[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?preview-category-empty-group-actions \.action-label[\s\S]*?transition:\s*none/);
	});

	test('preview category empty actions keep the full target while painting an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /preview-category-empty-action-button\s*\{[^}]*position:\s*relative[^}]*background:\s*none/);
		assert.match(css, /preview-category-empty-action-button::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /preview-category-empty-action-button:hover\s*\{[^}]*background:\s*transparent/);
		assert.match(css, /preview-category-empty-action-button:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /preview-category-empty-action-button:active\s*\{[^}]*background:\s*transparent/);
		assert.match(css, /preview-category-empty-action-button:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /preview-category-empty-action-button:focus-visible::after\s*\{[^}]*toolbar-hoverBackground/);
	});

	test('preview category empty actions honor reduced motion for the inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /monaco-reduce-motion[\s\S]*?preview-category-empty-action-button::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?preview-category-empty-action-button::after[\s\S]*?transition:\s*none/);
	});
});
