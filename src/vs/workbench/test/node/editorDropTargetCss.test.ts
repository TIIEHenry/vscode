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

suite('Editor drop target motion', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('overlay movement honors reduced motion while preserving explicit motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editordroptarget.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-enable-motion[\s\S]*?overlay-move-transition\s*\{[^}]*transition:\s*top 70ms ease-out/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?overlay-move-transition\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?overlay-move-transition\s*\{[^}]*transition:\s*none;/);
	});

	test('drop prompt opacity honors reduced motion while preserving explicit motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editordroptarget.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-enable-motion[\s\S]*?editor-group-overlay-drop-into-prompt\s*\{[^}]*transition:\s*opacity 150ms ease-out/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?editor-group-overlay-drop-into-prompt\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?editor-group-overlay-drop-into-prompt\s*\{[^}]*transition:\s*none;/);
	});

	test('overlay opacity honors reduced motion while preserving explicit motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/media/editordroptarget.css'), 'utf8');
		assert.match(css, /\.monaco-workbench\.monaco-enable-motion[\s\S]*?editor-group-overlay-indicator\s*\{[^}]*transition:\s*opacity 150ms ease-out/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?editor-group-overlay-indicator\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?editor-group-overlay-indicator\s*\{[^}]*transition:\s*none;/);
	});
});
