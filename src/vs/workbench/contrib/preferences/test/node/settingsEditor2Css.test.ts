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

suite('Settings editor tabs chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary keyboard focus uses toolbar hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/preferences/browser/media/settingsEditor2.css'), 'utf8');
		assert.match(css, /settings-tabs-widget[^\n]*action-label:focus-visible\s*\{[\s\S]*?outline:\s*none;[\s\S]*?background:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.match(css, /hc-black[\s\S]*?action-label:focus-visible\s*\{[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /action-label:focus\s*\{[\s\S]*?color-mix\(in srgb, var\(--vscode-focusBorder\)/);
	});

	test('search actions paint inset hover and pressed faces without shrinking their targets', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/preferences/browser/media/settingsEditor2.css'), 'utf8');
		assert.match(css, /search-container-widgets \.action-label:not\(\.monaco-custom-toggle\)\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /search-container-widgets \.action-label:not\(\.monaco-custom-toggle\)::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /search-container-widgets \.action-label:not\(\.monaco-custom-toggle\):hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /search-container-widgets \.action-label:not\(\.monaco-custom-toggle\):active::after\s*\{[^}]*toolbar-activeBackground/);
	});

	test('settings body links use quiet focus in normal themes and contrast focus in HC', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/preferences/browser/media/settingsEditor2.css'), 'utf8');
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?setting-item-markdown a:focus-visible,[\s\S]*?edit-in-settings-button:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /hc-black[\s\S]*?setting-item-markdown a:focus-visible,[\s\S]*?hc-light[\s\S]*?setting-item-markdown a:focus-visible,[\s\S]*?edit-in-settings-button:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /setting-item-markdown a:focus,[\s\S]*?outline:\s*1px solid -webkit-focus-ring-color/);
	});

	test('search action faces honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/preferences/browser/media/settingsEditor2.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?search-container-widgets \.action-label:not\(\.monaco-custom-toggle\)::after\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?search-container-widgets \.action-label:not\(\.monaco-custom-toggle\)::after\s*\{[^}]*transition:\s*none;/);
	});
});
