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

suite('Editor tab focus', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary tab focus removes the product ring while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.part\.editor > \.content \.editor-group-container > \.title \.tabs-container > \.tab:focus-visible\s*\{[^}]*outline:\s*none/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.editor > \.content \.editor-group-container > \.title \.tabs-container > \.tab:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.part\.editor > \.content \.editor-group-container > \.title \.tabs-container > \.tab:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.tabs-container > \.tab:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});

	test('tab transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/multieditortabscontrol.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.tabs-container > \.tab\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.tabs-container > \.tab\s*\{[^}]*transition:\s*none;/);
	});
});
