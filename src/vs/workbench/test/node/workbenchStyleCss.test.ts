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

suite('Workbench list focus chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('HC empty-list focus uses contrastActiveBorder', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/media/style.css'), 'utf8');
		assert.match(css, /hc-black[\s\S]*?monaco-list:not\(\.element-focused\):not\(:active\):focus:before[\s\S]*?outline-color:\s*var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.match(css, /hc-light[\s\S]*?monaco-list:not\(\.element-focused\):not\(:active\):focus:before[\s\S]*?outline-color:\s*var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
	});
});
