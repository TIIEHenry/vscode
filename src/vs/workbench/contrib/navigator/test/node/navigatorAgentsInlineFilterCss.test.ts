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

suite('Navigator Agents inline filter chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('filter motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorAgentsInlineFilter.css'), 'utf8');
		assert.match(css, /\.navigator-agents-inline-filter-input\s*\{[^}]*transition:\s*border-color 100ms ease;/s);
		assert.match(css, /\.navigator-agents-inline-filter-clear\s*\{[^}]*transition:\s*color 100ms ease;/s);
		assert.doesNotMatch(css, /transition:\s*[^;]*0\.12s/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.navigator-agents-inline-filter-input,[\s\S]*?\.monaco-workbench\.monaco-reduce-motion \.navigator-agents-inline-filter-clear\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.navigator-agents-inline-filter-input,[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.navigator-agents-inline-filter-clear\s*\{[^}]*transition:\s*none;/s);
	});
});
