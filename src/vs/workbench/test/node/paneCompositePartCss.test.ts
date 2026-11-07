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

suite('Pane composite focus indicator chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('HC focus indicators use contrastActiveBorder rather than the normal focus token', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/media/paneCompositePart.css'), 'utf8');
		assert.match(css, /hc-black[\s\S]*?action-item:focus \.active-item-indicator:before[\s\S]*?border-top-color:\s*var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.match(css, /hc-black[\s\S]*?header-or-footer\.footer[\s\S]*?action-item:focus \.active-item-indicator:before[\s\S]*?border-bottom-color:\s*var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
	});

	test('pane composite title actions honor reduced motion while preserving active feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/media/paneCompositePart.css'), 'utf8');
		assert.match(css, /title\.has-composite-bar > \.title-actions[\s\S]*?\.action-item \.action-label\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?title\.has-composite-bar > \.title-actions[\s\S]*?\.action-item \.action-label,[\s\S]*?global-actions-left[\s\S]*?\.action-item \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?title\.has-composite-bar > \.title-actions[\s\S]*?\.action-item \.action-label,[\s\S]*?global-actions-left[\s\S]*?\.action-item \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /title\.has-composite-bar > \.title-actions[\s\S]*?\.action-item \.action-label:active,[\s\S]*?background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});

	test('pane composite bar items honor reduced motion while preserving active feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/media/paneCompositePart.css'), 'utf8');
		assert.match(css, /composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item,[\s\S]*?header-or-footer[\s\S]*?composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item,[\s\S]*?header-or-footer[\s\S]*?composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item:active,[\s\S]*?background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});

	test('pane composite drag indicators honor reduced motion while preserving drop visibility', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/media/paneCompositePart.css'), 'utf8');
		assert.match(css, /composite-bar > \.monaco-action-bar \.action-item::before,[\s\S]*?transition-delay:\s*100ms;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?composite-bar > \.monaco-action-bar \.action-item::before,[\s\S]*?action-item::after\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?composite-bar > \.monaco-action-bar \.action-item::before,[\s\S]*?action-item::after\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /composite-bar-container\.dragged-over[\s\S]*?action-item::before,[\s\S]*?display:\s*block;/);
	});

	test('pane composite empty actions honor reduced motion while preserving pressed feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/media/paneCompositePart.css'), 'utf8');
		assert.match(css, /empty-pane-message-area \.empty-pane-message a,[\s\S]*?\.monaco-button\s*\{[^}]*transition:\s*background-color 0\.08s ease, filter 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?empty-pane-message-area \.empty-pane-message a,[\s\S]*?empty-pane-message \.monaco-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?empty-pane-message-area \.empty-pane-message a,[\s\S]*?empty-pane-message \.monaco-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /empty-pane-message-area \.empty-pane-message a:active,[\s\S]*?filter:\s*brightness\(0\.92\);[\s\S]*?opacity:\s*0\.85;/);
	});
});
