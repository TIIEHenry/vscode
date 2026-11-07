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

suite('Editor title breadcrumbs', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary breadcrumb focus uses hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editortitlecontrol.css'), 'utf8');
		assert.match(css, /breadcrumbs-below-tabs[\s\S]*?\.monaco-breadcrumb-item:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.editor[\s\S]*?breadcrumbs-below-tabs[\s\S]*?\.monaco-breadcrumb-item:focus-visible,[\s\S]*?\.monaco-workbench\.hc-light \.part\.editor[\s\S]*?breadcrumbs-below-tabs[\s\S]*?\.monaco-breadcrumb-item:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /breadcrumbs-below-tabs[\s\S]*?\.monaco-breadcrumb-item\s*\{[^}]*outline-color:\s*var\(--vscode-focusBorder\)/);
	});

	test('below-tabs breadcrumb transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editortitlecontrol.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?breadcrumbs-below-tabs[\s\S]*?\.monaco-breadcrumb-item\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?breadcrumbs-below-tabs[\s\S]*?\.monaco-breadcrumb-item\s*\{[^}]*transition:\s*none;/);
	});
});
