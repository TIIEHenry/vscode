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

suite('User Data Profiles editor actions', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	test('profile header actions keep their target while painting inset hover and pressed faces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/userDataProfile/browser/media/userDataProfilesEditor.css'), 'utf8');
		assert.match(css, /profile-header \.profile-actions-container \.actions-container \.action-label\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /profile-header \.profile-actions-container \.actions-container \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /profile-header \.profile-actions-container \.actions-container \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /profile-header \.profile-actions-container \.actions-container \.action-label:focus-visible::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /profile-header \.profile-actions-container \.actions-container \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
	});

	test('profile header action faces honor reduced motion while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/userDataProfile/browser/media/userDataProfilesEditor.css'), 'utf8');
		assert.match(css, /monaco-reduce-motion[\s\S]*?profile-header \.profile-actions-container \.actions-container \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?profile-header \.profile-actions-container \.actions-container \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\) \.profiles-editor[\s\S]*?profile-header \.profile-actions-container \.actions-container \.action-label:focus-visible/);
	});

	test('profile tree actions keep their target while painting inset hover and pressed faces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/userDataProfile/browser/media/userDataProfilesEditor.css'), 'utf8');
		assert.match(css, /profile-tree-item-actions-container \.action-label\s*\{[^}]*position:\s*relative;[^}]*isolation:\s*isolate;[^}]*background-color:\s*transparent/);
		assert.match(css, /profile-tree-item-actions-container \.action-label::after\s*\{[^}]*inset:\s*1px\s+2px;[^}]*z-index:\s*-1;[^}]*pointer-events:\s*none;/);
		assert.match(css, /profile-tree-item-actions-container \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /profile-tree-item-actions-container \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /monaco-reduce-motion[\s\S]*?profile-tree-item-actions-container \.action-label::after\s*\{[^}]*transition:\s*none/);
	});
});
