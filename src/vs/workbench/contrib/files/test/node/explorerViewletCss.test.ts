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

suite('Explorer inline rename chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary rename focus uses toolbar hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/files/browser/media/explorerviewlet.css'), 'utf8');
		assert.match(css, /explorer-item \.monaco-inputbox input\[type="text"\]\s*\{[^}]*outline:\s*none;/);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?explorer-item \.monaco-inputbox input\[type="text"\]:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /explorer-item \.monaco-inputbox input\[type="text"\]:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /explorer-item \.monaco-inputbox input\[type="text"\]\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});
});
