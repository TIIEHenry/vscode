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

suite('Modal editor navigation', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary navigation focus uses command-center feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/modalEditorPart.css'), 'utf8');
		assert.match(css, /\.modal-editor-nav-button\.monaco-button:focus-visible:not\(\.disabled\)\s*\{[^}]*outline:\s*none;[^}]*opacity:\s*1;[^}]*background-color:\s*var\(--vscode-commandCenter-activeBackground\)/);
		assert.match(css, /\.monaco-workbench\.hc-black[\s\S]*?\.modal-editor-nav-button\.monaco-button:focus-visible:not\(\.disabled\),[\s\S]*?\.monaco-workbench\.hc-light[\s\S]*?\.modal-editor-nav-button\.monaco-button:focus-visible:not\(\.disabled\)\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.modal-editor-nav-button\.monaco-button\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('navigation transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/modalEditorPart.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.modal-editor-navigation \.modal-editor-nav-button\.monaco-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.modal-editor-navigation \.modal-editor-nav-button\.monaco-button\s*\{[^}]*transition:\s*none;/);
	});
});
