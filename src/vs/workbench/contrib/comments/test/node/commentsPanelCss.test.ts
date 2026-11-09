/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

suite('Comments panel link chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary link focus uses toolbar hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/comments/browser/media/panel.css'), 'utf8');
		assert.match(css, /\.comments-panel-container \.text a:focus\s*\{[^}]*outline:\s*none;/);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?\.comments-panel-container \.text a:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /comments-panel-container \.text a:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.comments-panel-container \.text a:focus\s*\{[^}]*var\(--vscode-focusBorder\)/);
	});

	test('comment actions keep their target while painting inset hover, focus, and pressed faces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/comments/browser/media/panel.css'), 'utf8');
		assert.match(css, /comments-panel-container \.actions \.action-label\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /comments-panel-container \.actions \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /comments-panel-container \.actions \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /comments-panel-container \.actions \.action-label:focus-visible::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /comments-panel-container \.actions \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /comments-panel-container \.actions \.action-label:active\s*\{[^}]*background-color:\s*transparent/);
	});

	test('comment action faces honor reduced motion while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/comments/browser/media/panel.css'), 'utf8');
		assert.match(css, /monaco-reduce-motion[\s\S]*?comments-panel-container \.actions \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?comments-panel-container \.actions \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /comments-panel[\s\S]*?\.hc-black, \.hc-light[\s\S]*?comments-panel-container \.actions \.action-label:focus-visible/);
	});
});
