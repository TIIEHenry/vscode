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

suite('Debug expression links', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary expression link focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/debug/browser/media/debug.contribution.css'), 'utf8');
		assert.match(css, /expression \.value a\.link\.pointer:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground[^}]*color:\s*var\(--vscode-textLink-activeForeground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.monaco-list-row \.expression \.value a\.link\.pointer:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.monaco-list-row \.expression \.value a\.link\.pointer:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /expression \.value a\.link\.pointer\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});
});
