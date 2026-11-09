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

suite('Merge editor action chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('code view header actions paint inset hover and pressed faces without shrinking their targets', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/mergeEditor/browser/view/media/mergeEditor.css'), 'utf8');
		assert.match(css, /merge-editor \.code-view > \.header \.action-label\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /merge-editor \.code-view > \.header \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /merge-editor \.code-view > \.header \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /merge-editor \.code-view > \.header \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
	});

	test('code view header action faces honor reduced motion while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/mergeEditor/browser/view/media/mergeEditor.css'), 'utf8');
		assert.match(css, /monaco-reduce-motion[\s\S]*?merge-editor \.code-view > \.header \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?merge-editor \.code-view > \.header \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /merge-editor[\s\S]*?\.hc-black, \.hc-light[\s\S]*?\.code-view > \.header \.action-label:focus-visible/);
	});
});
