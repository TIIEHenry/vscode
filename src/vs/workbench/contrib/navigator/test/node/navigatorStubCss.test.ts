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

suite('Navigator Agents row chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('row and action motion stay within the 100ms contract and honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorStub.css'), 'utf8');
		assert.match(css, /\.monaco-workbench \.navigator-agents-hierarchy-tree \.monaco-list-row,[\s\S]*?\.monaco-workbench \.navigator-agents-activity-list \.monaco-list-row\s*\{[^}]*transition:\s*background-color 100ms ease;/s);
		assert.match(css, /\.monaco-workbench \.navigator-agents-row-actions \.action-label\s*\{[^}]*transition:\s*background-color 100ms ease;/s);
		assert.doesNotMatch(css, /transition:\s*[^;]*0\.12s/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.navigator-agents-hierarchy-tree \.monaco-list-row,[\s\S]*?\.monaco-workbench\.monaco-reduce-motion \.navigator-agents-row-actions \.action-label\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.navigator-agents-hierarchy-tree \.monaco-list-row,[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.navigator-agents-row-actions \.action-label\s*\{[^}]*transition:\s*none;/s);
	});

	test('ordinary focused agent rows use a quiet surface and HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorStub.css'), 'utf8');
		assert.match(css, /navigator-agents-hierarchy-tree \.monaco-list:focus-visible \.monaco-list-row\.focused[^\{]*\{[^}]*outline:\s*none\s*!important[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/s);
		assert.match(css, /navigator-agents-activity-list \.monaco-list:focus-visible \.monaco-list-row\.focused[^\{]*\{[^}]*outline:\s*none\s*!important[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/s);
		assert.match(css, /hc-black[\s\S]*navigator-agents-hierarchy-tree \.monaco-list:focus-visible \.monaco-list-row\.focused[\s\S]*contrastActiveBorder/);
		assert.match(css, /hc-light[\s\S]*navigator-agents-activity-list \.monaco-list:focus-visible \.monaco-list-row\.focused[\s\S]*contrastActiveBorder/);
	});
});
