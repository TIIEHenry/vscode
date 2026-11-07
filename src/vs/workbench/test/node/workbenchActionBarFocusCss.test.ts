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

suite('Workbench horizontal action bars', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('HC action focus restores a contrast ring after ordinary hover chrome suppresses outlines', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/media/style.css'), 'utf8');
		assert.match(css, /\.monaco-workbench \.monaco-action-bar:not\(\.vertical\) \.action-label:not\(\.disabled\):is\(:hover, :focus, :focus-visible\)[\s\S]*?background-color:\s*var\(--vscode-toolbar-hoverBackground\);[\s\S]*?outline:\s*none/);
		assert.match(css, /\.monaco-workbench\.hc-black \.monaco-action-bar:not\(\.vertical\) \.action-label:not\(\.disabled\):is\(:focus, :focus-visible\),[\s\S]*?\.monaco-workbench\.hc-light \.monaco-action-bar:not\(\.vertical\) \.action-label:not\(\.disabled\):is\(:focus, :focus-visible\),[\s\S]*?\.monaco-workbench\.hc-black \.monaco-action-bar:not\(\.vertical\) \.monaco-dropdown-with-primary:not\(\.disabled\):is\(:focus, :focus-visible\),[\s\S]*?\.monaco-workbench\.hc-light \.monaco-action-bar:not\(\.vertical\) \.monaco-dropdown-with-primary:not\(\.disabled\):is\(:focus, :focus-visible\)\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
	});
});
