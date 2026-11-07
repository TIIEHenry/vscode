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

suite('Titlebar menubar', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary menu focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/titlebar/media/menubarControl.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.menubar > \.menubar-menu-button:focus-visible \.menubar-menu-title\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.menubar > \.menubar-menu-button:focus-visible \.menubar-menu-title,[\s\S]*?\.monaco-workbench\.hc-light \.menubar > \.menubar-menu-button:focus-visible \.menubar-menu-title\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.menubar > \.menubar-menu-button:focus-visible \.menubar-menu-title\s*\{[^}]*var\(--vscode-focusBorder\)/);
	});
});
