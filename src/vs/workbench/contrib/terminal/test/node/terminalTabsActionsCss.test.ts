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

suite('Terminal tab actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary tab action focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/terminal/browser/media/terminal.css'), 'utf8');
		assert.match(css, /tabs-list \.actions \.action-label:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*transparent/);
		assert.match(css, /tabs-list \.actions \.action-label:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.pane-body\.integrated-terminal[\s\S]*?tabs-list \.actions \.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.pane-body\.integrated-terminal[\s\S]*?tabs-list \.actions \.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /tabs-list \.actions \.action-label\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('ordinary tab actions paint inset hover and pressed faces without shrinking their targets', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/terminal/browser/media/terminal.css'), 'utf8');
		assert.match(css, /tabs-list \.actions \.action-label\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /tabs-list \.actions \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /tabs-list \.actions \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /tabs-list \.actions \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
	});

	test('ordinary tab action faces honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/terminal/browser/media/terminal.css'), 'utf8');
		assert.match(css, /monaco-reduce-motion[\s\S]*?tabs-list \.actions \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?tabs-list \.actions \.action-label::after[\s\S]*?transition:\s*none/);
	});

	test('single terminal tabs keep their target while painting an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/terminal/browser/media/terminal.css'), 'utf8');
		assert.match(css, /single-terminal-tab\s*\{[^}]*position:\s*relative;[^}]*isolation:\s*isolate;[^}]*background-color:\s*transparent/);
		assert.match(css, /single-terminal-tab::after\s*\{[^}]*inset:\s*1px\s+2px;[^}]*z-index:\s*-1;[^}]*pointer-events:\s*none;/);
		assert.match(css, /single-terminal-tab:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /single-terminal-tab:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /monaco-reduce-motion[\s\S]*?single-terminal-tab::after\s*\{[^}]*transition:\s*none/);
	});
});
