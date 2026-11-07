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

suite('Screencast keyboard overlay', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('keyboard overlay opacity honors reduced motion while preserving explicit motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/actions/media/actions.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-enable-motion \.screencast-keyboard\s*\{[^}]*transition:\s*opacity 0\.3s ease-out/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.screencast-keyboard\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.screencast-keyboard\s*\{[^}]*transition:\s*none;/);
	});
});
