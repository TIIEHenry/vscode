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

suite('Breadcrumbs picker focus', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary picker rows remove the ring while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/breadcrumbscontrol.css'), 'utf8');
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?monaco-breadcrumbs-picker \.tree \.monaco-list:focus \.monaco-list-row\.focused\s*\{[^}]*outline:\s*none;/);
		assert.match(css, /hc-black[\s\S]*?monaco-breadcrumbs-picker \.tree \.monaco-list:focus \.monaco-list-row\.focused[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.match(css, /hc-light[\s\S]*?monaco-breadcrumbs-picker \.tree \.monaco-list:focus \.monaco-list-row\.focused[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
	});

	test('picker item transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/breadcrumbscontrol.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.monaco-breadcrumbs-picker \.picker-item\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.monaco-breadcrumbs-picker \.picker-item\s*\{[^}]*transition:\s*none;/);
	});
});
