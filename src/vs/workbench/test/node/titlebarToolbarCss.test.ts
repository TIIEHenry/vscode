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

suite('Titlebar optional toolbars', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary toolbar actions use hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?center-adjacent-toolbar-container \.action-item:not\(\.disabled\):hover \.action-label,[\s\S]*?update-toolbar-container \.action-item:not\(\.disabled\):hover \.action-label\s*\{[^}]*background-color:\s*transparent/);
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?center-adjacent-toolbar-container \.action-item:not\(\.disabled\):hover \.action-label::after,[\s\S]*?update-toolbar-container \.action-item:not\(\.disabled\):hover \.action-label::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?center-adjacent-toolbar-container \.action-label:focus-visible,[\s\S]*?update-toolbar-container \.action-label:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*transparent/);
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?center-adjacent-toolbar-container \.action-label:focus-visible::after,[\s\S]*?update-toolbar-container \.action-label:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		const active = css.indexOf('.monaco-workbench .part.titlebar > .titlebar-container > .titlebar-right > .center-adjacent-toolbar-container .action-label:active::after');
		const hover = css.indexOf('.monaco-workbench:not(.hc-black):not(.hc-light) .part.titlebar > .titlebar-container > .titlebar-right > .center-adjacent-toolbar-container .action-item:not(.disabled):hover .action-label::after');
		assert.ok(active > hover, 'pressed toolbar face must override hover face while held');
		assert.match(css.slice(active, active + 420), /background-color:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black[\s\S]*?center-adjacent-toolbar-container \.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light[\s\S]*?center-adjacent-toolbar-container \.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-black[\s\S]*?update-toolbar-container \.action-label:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light[\s\S]*?update-toolbar-container \.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /(?:center-adjacent-toolbar-container|update-toolbar-container) \.action-label\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});
});
