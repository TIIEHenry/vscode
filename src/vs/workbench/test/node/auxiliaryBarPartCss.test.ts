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

suite('Auxiliary bar title actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('auxiliary bar title actions honor reduced motion while preserving active feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css'), 'utf8');
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label\s*\{[^}]*transition:\s*background-color 0\.12s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.auxiliarybar \.title-actions \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.auxiliarybar \.title-actions \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label:active:not\(\.disabled\)\s*\{[^}]*background-color:\s*transparent/);
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label:active:not\(\.disabled\)::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(css, /part\.auxiliarybar > \.title > \.composite-bar-container[\s\S]*?color:\s*var\(--vscode-sideBarTitle-foreground\)/);
	});

	test('ordinary composite actions use a quiet hover surface while HC keeps contrast', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?auxiliarybar[\s\S]*?action-item:not\(\.checked\):is\(:hover, :focus-visible\)[\s\S]*?outline:\s*none\s*!important[\s\S]*?background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.doesNotMatch(css, /\.monaco-workbench \.part\.auxiliarybar[\s\S]*?outline:\s*var\(--vscode-contrastActiveBorder,\s*unset\)\s+(?:solid|dashed)/);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?auxiliarybar[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder, var\(--vscode-focusBorder\)\)/);
	});

	test('title actions keep the hit target while painting an inset interaction face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/auxiliarybar/media/auxiliaryBarPart.css'), 'utf8');
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label\s*\{[^}]*background-color:\s*transparent/);
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label:hover[^}]*background-color:\s*transparent/);
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label:active[^}]*background-color:\s*transparent/);
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label:hover[^}]*::after/);
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label:active[^}]*::after/);
		assert.match(css, /part\.auxiliarybar \.title-actions \.action-label::after\s*\{[^}]*transition:\s*background-color 0\.12s ease/);
	});
});
