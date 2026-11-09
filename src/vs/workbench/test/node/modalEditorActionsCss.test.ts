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

suite('Modal editor actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary action focus uses toolbar hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/modalEditorPart.css'), 'utf8');
		assert.match(css, /\.modal-editor-action-container \.actions-container \.action-label:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*transparent/);
		assert.match(css, /\.modal-editor-action-container \.actions-container \.action-label:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.monaco-modal-editor-block[\s\S]*?\.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.monaco-modal-editor-block[\s\S]*?\.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.modal-editor-action-container \.actions-container \.action-label\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('ordinary actions keep the full target while painting inset hover and pressed faces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/modalEditorPart.css'), 'utf8');
		assert.match(css, /\.modal-editor-action-container \.actions-container \.action-label\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /\.modal-editor-action-container \.actions-container \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /\.modal-editor-action-container \.actions-container \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /\.modal-editor-action-container \.actions-container \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
	});

	test('header actions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/modalEditorPart.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.modal-editor-action-container \.actions-container \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.modal-editor-action-container \.actions-container \.action-label::after\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.modal-editor-action-container \.actions-container \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.modal-editor-action-container \.actions-container \.action-label::after\s*\{[^}]*transition:\s*none;/);
	});
});
