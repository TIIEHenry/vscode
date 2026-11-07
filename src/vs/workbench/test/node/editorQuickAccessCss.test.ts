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

suite('Editor quick access actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary dirty-editor action focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorquickaccess.css'), 'utf8');
		assert.match(css, /\.quick-input-list \.quick-input-list-entry-action-bar \.action-label\.dirty-editor:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.quick-input-list \.quick-input-list-entry-action-bar \.action-label\.dirty-editor:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.quick-input-list \.quick-input-list-entry-action-bar \.action-label\.dirty-editor:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.quick-input-list \.quick-input-list-entry-action-bar \.action-label\.dirty-editor\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('dirty-editor action transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorquickaccess.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.action-label\.dirty-editor\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.action-label\.dirty-editor\s*\{[^}]*transition:\s*none;/);
	});
});
