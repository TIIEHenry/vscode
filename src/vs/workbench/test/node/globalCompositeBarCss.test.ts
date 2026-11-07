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

suite('Global composite bar chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('account avatar press feedback honors reduced motion while preserving the active state', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/media/globalCompositeBar.css'), 'utf8');
		assert.match(css, /\.monaco-action-bar \.action-label \.accounts-avatar\s*\{[^}]*transition:\s*opacity 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.monaco-action-bar \.action-label \.accounts-avatar\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.monaco-action-bar \.action-label \.accounts-avatar\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.monaco-action-bar \.action-item:active \.accounts-avatar\s*\{[^}]*opacity:\s*0\.8;/);
	});
});
