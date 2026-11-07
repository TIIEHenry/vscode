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

suite('Panel composite title actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('panel title actions honor reduced motion while preserving active color feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/panel/media/panelpart.css'), 'utf8');
		assert.match(css, /part\.panel > \.title > \.composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item \.action-label\s*\{[^}]*transition:\s*color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.panel > \.title > \.composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.panel > \.title > \.composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /part\.panel > \.title > \.composite-bar-container > \.composite-bar > \.monaco-action-bar \.action-item:active \.action-label\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(css, /part\.panel > \.title > \.composite-bar-container >\s*\.composite-bar > \.monaco-action-bar \.action-item:focus \.action-label,[\s\S]*?color:\s*var\(--vscode-panelTitle-activeForeground\)/);
	});
});
