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

suite('Exception widget actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary exception action focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/debug/browser/media/exceptionWidget.css'), 'utf8');
		assert.match(css, /exception-widget \.title \.actions \.action-label:focus-visible\s*\{[^}]*outline:\s*none;/);
		assert.match(css, /exception-widget \.title \.actions \.action-label:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.monaco-editor[\s\S]*?exception-widget \.title \.actions \.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.monaco-editor[\s\S]*?exception-widget \.title \.actions \.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /exception-widget \.title \.actions \.action-label\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('ordinary exception actions paint inset hover and pressed faces without shrinking their targets', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/debug/browser/media/exceptionWidget.css'), 'utf8');
		assert.match(css, /exception-widget \.title \.actions \.action-label\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /exception-widget \.title \.actions \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /exception-widget \.title \.actions \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /exception-widget \.title \.actions \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
	});

	test('exception action faces honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/debug/browser/media/exceptionWidget.css'), 'utf8');
		assert.match(css, /monaco-reduce-motion[\s\S]*?exception-widget \.title \.actions \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?exception-widget \.title \.actions \.action-label::after[\s\S]*?transition:\s*none/);
	});
});
