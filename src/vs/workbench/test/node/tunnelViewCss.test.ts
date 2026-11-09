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

suite('Ports view action faces', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('port action faces stay inset while the target and HC focus remain intact', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/remote/browser/media/tunnelView.css'), 'utf8');
		assert.match(css, /ports-view-actionbar-cell \.actions \.action-label\s*\{[^}]*position:\s*relative[^}]*width:\s*16px[^}]*background-color:\s*transparent/);
		assert.match(css, /ports-view-actionbar-cell \.actions \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /ports-view-actionbar-cell \.actions \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /ports-view-actionbar-cell \.actions \.action-label:focus-visible::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /ports-view-actionbar-cell \.actions \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /ports-view-actionbar-cell \.actions \.action-label:active\s*\{[^}]*background-color:\s*transparent/);
		assert.match(css, /monaco-reduce-motion[\s\S]*?ports-view-actionbar-cell \.actions \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?ports-view-actionbar-cell \.actions \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /\.hc-black, \.hc-light\)[\s\S]*?ports-view-actionbar-cell \.actions \.action-label:focus-visible[\s\S]*?contrastActiveBorder/);
	});
});
