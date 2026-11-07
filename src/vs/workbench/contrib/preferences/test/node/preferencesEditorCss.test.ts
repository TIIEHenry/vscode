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

suite('Preferences navigation chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary back-link focus has no ring while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/preferences/browser/media/preferencesEditor.css'), 'utf8');
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?back-to-client-settings\.monaco-button:focus-visible\s*\{[^}]*outline:\s*none;/);
		assert.match(css, /back-to-client-settings\.monaco-button:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /back-to-client-settings\.monaco-button:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});
});
