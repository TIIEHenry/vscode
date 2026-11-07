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

suite('Editor empty group focus', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary focus stays quiet while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editorgroupview.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.part\.editor > \.content:not\(\.empty\) \.editor-group-container\.empty\.active:focus,[\s\S]*?\.content\.empty \.editor-group-container\.empty\.active:focus\s*\{[^}]*outline:\s*none/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.editor > \.content:not\(\.empty\) \.editor-group-container\.empty\.active:focus,[\s\S]*?\.monaco-workbench\.hc-light \.part\.editor > \.content:not\(\.empty\) \.editor-group-container\.empty\.active:focus\s*\{[^}]*outline-offset:\s*-2px;[^}]*outline:\s*1px solid var\(--vscode-editorGroup-focusedEmptyBorder,\s*var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)\)/);
		assert.doesNotMatch(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?editor-group-container\.empty\.active:focus\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});
});
