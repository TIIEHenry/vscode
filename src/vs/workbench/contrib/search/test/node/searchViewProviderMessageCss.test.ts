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

suite('Search provider message links', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary provider link focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/search/browser/media/searchview.css'), 'utf8');
		assert.match(css, /\.text-search-provider-messages \.providerMessage a:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.text-search-provider-messages \.providerMessage a:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.text-search-provider-messages \.providerMessage a:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.text-search-provider-messages \.providerMessage a\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});
});
