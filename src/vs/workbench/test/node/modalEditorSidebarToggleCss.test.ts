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

suite('Modal editor sidebar toggle', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('sidebar toggle transitions honor reduced motion while shared HC focus styling remains intact', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/modalEditorPart.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.modal-editor-sidebar-toggle \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.modal-editor-sidebar-toggle \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.doesNotMatch(css, /\.modal-editor-sidebar-toggle \.action-label\s*\{[^}]*outline(?:-color)?:/);
	});
});
