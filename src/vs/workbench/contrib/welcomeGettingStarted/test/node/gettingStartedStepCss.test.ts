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

suite('Getting Started step button chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary step focus uses tile hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/welcomeGettingStarted/browser/media/gettingStarted.css'), 'utf8');
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?step-list-container button:focus-visible\s*\{[^}]*box-shadow:\s*none;[^}]*outline:\s*none;[^}]*welcomePage-tileHoverBackground/);
		assert.match(css, /step-list-container button:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /step-list-container button:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});
});
