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

suite('Pane viewlet header', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('pane header press feedback honors reduced motion while preserving explicit motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/views/media/paneviewlet.css'), 'utf8');
		assert.match(css, /\.monaco-pane-view \.pane > \.pane-header\s*\{[^}]*transition:\s*background-color 0\.12s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.monaco-pane-view \.pane > \.pane-header\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.monaco-pane-view \.pane > \.pane-header\s*\{[^}]*transition:\s*none;/);
	});
});
