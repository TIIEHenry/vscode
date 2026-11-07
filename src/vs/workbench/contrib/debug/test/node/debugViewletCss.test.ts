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

suite('Debug start configuration', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary configuration focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/debug/browser/media/debugViewlet.css'), 'utf8');
		assert.match(css, /start-debug-action-item \.configuration \.monaco-dropdown > \.dropdown-label:focus\s*\{[^}]*outline:\s*none;/);
		assert.match(css, /start-debug-action-item \.configuration \.monaco-dropdown > \.dropdown-label:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.monaco-action-bar[\s\S]*?dropdown-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.monaco-action-bar[\s\S]*?dropdown-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /dropdown-label:focus\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});
});
