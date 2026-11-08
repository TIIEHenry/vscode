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

suite('Engine preferences pane focus styling', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('back action uses a quiet ordinary surface while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.engine-preferences-back:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\) \.engine-preferences-back:focus-visible\s*\{[^}]*outline:\s*var\(--vscode-strokeThickness, 1px\) solid var\(--vscode-contrastActiveBorder, var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /\.monaco-workbench \.engine-preferences-back:focus-visible\s*\{[^}]*outline:\s*var\(--vscode-strokeThickness, 1px\) solid var\(--vscode-focusBorder\)/);
	});
});
