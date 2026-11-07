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

suite('Sidebar title actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('title action feedback honors reduced motion while preserving the active state', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css'), 'utf8');
		assert.match(css, /\.part\.sidebar \.title-actions \.action-label\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.sidebar \.title-actions \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.sidebar \.title-actions \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.part\.sidebar \.title-actions \.action-label:active\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});

	test('collapsible header actions honor reduced motion while preserving the active state', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/sidebar/media/sidebarpart.css'), 'utf8');
		assert.match(css, /\.viewlet \.collapsible\.header \.action-label\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.viewlet \.collapsible\.header \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.viewlet \.collapsible\.header \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.viewlet \.collapsible\.header \.action-label:active\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});
});
