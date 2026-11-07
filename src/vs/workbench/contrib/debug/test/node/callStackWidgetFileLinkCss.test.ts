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

suite('Debug call stack file links', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary file link focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/debug/browser/media/callStackWidget.css'), 'utf8');
		assert.match(css, /call-stack-go-to-file-link:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground[^}]*color:\s*var\(--vscode-textLink-activeForeground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.monaco-editor \.call-stack-go-to-file-link:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.monaco-editor \.call-stack-go-to-file-link:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /call-stack-go-to-file-link\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});
});
