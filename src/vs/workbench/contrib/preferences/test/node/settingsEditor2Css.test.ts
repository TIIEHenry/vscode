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

suite('Settings editor tabs chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary keyboard focus uses toolbar hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/preferences/browser/media/settingsEditor2.css'), 'utf8');
		assert.match(css, /settings-tabs-widget[^\n]*action-label:focus-visible\s*\{[\s\S]*?outline:\s*none;[\s\S]*?background:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.match(css, /hc-black[\s\S]*?action-label:focus-visible\s*\{[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /action-label:focus\s*\{[\s\S]*?color-mix\(in srgb, var\(--vscode-focusBorder\)/);
	});
});
