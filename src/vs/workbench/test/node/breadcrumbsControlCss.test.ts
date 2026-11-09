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

suite('Breadcrumbs editor type chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary focus uses toolbar hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/breadcrumbscontrol.css'), 'utf8');
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?breadcrumbs-editor-type:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*transparent/);
		assert.match(css, /breadcrumbs-editor-type:focus-visible::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /breadcrumbs-editor-type:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /breadcrumbs-editor-type:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});

	test('editor type keeps the full target while painting inset hover and pressed faces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/breadcrumbscontrol.css'), 'utf8');
		assert.match(css, /breadcrumbs-editor-type\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/);
		assert.match(css, /breadcrumbs-editor-type::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /breadcrumbs-editor-type:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /breadcrumbs-editor-type:active\s*\{[^}]*background-color:\s*transparent/);
		assert.match(css, /breadcrumbs-editor-type:active::after\s*\{[^}]*toolbar-activeBackground/);
		const active = css.indexOf('.monaco-workbench .breadcrumbs-control.with-editor-type > .breadcrumbs-editor-type:active::after');
		const hover = css.indexOf('.monaco-workbench .breadcrumbs-control.with-editor-type > .breadcrumbs-editor-type:hover::after');
		const focus = css.indexOf('.monaco-workbench:not(.hc-black):not(.hc-light) .breadcrumbs-control.with-editor-type > .breadcrumbs-editor-type:focus-visible::after');
		assert.ok(active > hover && active > focus, 'pressed breadcrumb face must override hover and focus faces while held');
	});

	test('editor type transitions honor reduced motion without changing focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/breadcrumbscontrol.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?breadcrumbs-control\.with-editor-type > \.breadcrumbs-editor-type\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?breadcrumbs-control\.with-editor-type > \.breadcrumbs-editor-type::after\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?breadcrumbs-control\.with-editor-type > \.breadcrumbs-editor-type\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?breadcrumbs-control\.with-editor-type > \.breadcrumbs-editor-type::after\s*\{[^}]*transition:\s*none;/);
	});
});
