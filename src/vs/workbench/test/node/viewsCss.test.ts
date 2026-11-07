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

suite('Views empty message links', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('empty message link feedback honors reduced motion while preserving the active state', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /tree-explorer-viewlet-tree-view \.message p > a\s*\{[^}]*transition:\s*opacity 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.tree-explorer-viewlet-tree-view \.message p > a\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.tree-explorer-viewlet-tree-view \.message p > a\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /tree-explorer-viewlet-tree-view \.message p > a:active\s*\{[^}]*opacity:\s*0\.8;/);
	});

	test('welcome view links honor reduced motion while preserving the active state', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /pane > \.pane-body \.welcome-view-content a\s*\{[^}]*transition:\s*opacity 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.pane > \.pane-body \.welcome-view-content a\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.pane > \.pane-body \.welcome-view-content a\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /pane > \.pane-body \.welcome-view-content a:active\s*\{[^}]*opacity:\s*0\.8;/);
	});

	test('welcome view button layout honors reduced motion while preserving the wide state', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-enable-motion \.pane > \.pane-body \.welcome-view-content > \.button-container\s*\{[^}]*transition:\s*0\.2s max-width ease-out;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.pane > \.pane-body \.welcome-view-content > \.button-container\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.pane > \.pane-body \.welcome-view-content > \.button-container\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /welcome-view-content\.wide > \.button-container\s*\{[^}]*max-width:\s*100%;/);
	});

	test('welcome view buttons honor reduced motion while preserving pressed feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /welcome-view-content > \.button-container > \.monaco-button,[\s\S]*?transition:\s*background-color 0\.08s ease, filter 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.pane > \.pane-body \.welcome-view-content > \.button-container > \.monaco-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.pane > \.pane-body \.welcome-view-content > \.button-container > \.monaco-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /welcome-view-content > \.button-container > \.monaco-button:active,[\s\S]*?filter:\s*brightness\(0\.92\);/);
	});

	test('custom view node actions honor reduced motion while preserving pressed feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /custom-view-tree-node-item \.actions \.action-label\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.customview-tree[\s\S]*?custom-view-tree-node-item \.actions \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?customview-tree[\s\S]*?custom-view-tree-node-item \.actions \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /custom-view-tree-node-item \.actions \.action-label:active\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});

	test('custom view node checkboxes honor reduced motion while preserving pressed feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /custom-view-tree-node-item-checkbox\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.customview-tree[\s\S]*?custom-view-tree-node-item-checkbox\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?customview-tree[\s\S]*?custom-view-tree-node-item-checkbox\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /custom-view-tree-node-item-checkbox:active\s*\{[^}]*background-color:\s*var\(--vscode-inputOption-activeBackground/);
	});

	test('custom view node rows honor reduced motion while preserving active selection', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /custom-view-tree-node-item\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.customview-tree[\s\S]*?custom-view-tree-node-item\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?customview-tree[\s\S]*?custom-view-tree-node-item\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /customview-tree \.monaco-list \.monaco-list-row:active \.custom-view-tree-node-item\s*\{[^}]*background-color:\s*var\(--vscode-list-activeSelectionBackground\);/);
	});

	test('view pane filter actions honor reduced motion while preserving pressed feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /viewpane-filter > \.viewpane-filter-controls \.monaco-action-bar \.action-label\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.viewpane-filter > \.viewpane-filter-controls \.monaco-action-bar \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.viewpane-filter > \.viewpane-filter-controls \.monaco-action-bar \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /viewpane-filter > \.viewpane-filter-controls \.monaco-action-bar \.action-label:active\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});

	test('empty message buttons honor reduced motion while preserving pressed feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/views.css'), 'utf8');
		assert.match(css, /tree-explorer-viewlet-tree-view \.message \.button-container > \.monaco-button\s*\{[^}]*transition:\s*background-color 0\.08s ease, filter 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.tree-explorer-viewlet-tree-view \.message \.button-container > \.monaco-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.tree-explorer-viewlet-tree-view \.message \.button-container > \.monaco-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /tree-explorer-viewlet-tree-view \.message \.button-container > \.monaco-button:active\s*\{[^}]*filter:\s*brightness\(0\.92\);/);
	});
});
