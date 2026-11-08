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

suite('Agent Inspect row chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('row motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/agentInspect.css'), 'utf8');
		assert.match(css, /\.monaco-workbench \.agent-inspect-list \.monaco-list-row\s*\{[^}]*transition:\s*background-color 100ms ease;/s);
		assert.doesNotMatch(css, /transition:\s*[^;]*0\.12s/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.agent-inspect-list \.monaco-list-row\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.agent-inspect-list \.monaco-list-row\s*\{[^}]*transition:\s*none;/s);
	});
});
