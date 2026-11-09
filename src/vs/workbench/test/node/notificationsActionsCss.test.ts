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

suite('Notifications actions', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('notification actions honor reduced motion while preserving shared focus semantics', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/notifications/media/notificationsActions.css'), 'utf8');
		assert.match(css, /notification-list-item-toolbar-container \.action-label,[\s\S]*?notifications-center-header-toolbar \.action-label\s*\{[^}]*transition:\s*background-color 0\.12s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?notification-list-item-toolbar-container \.action-label,[\s\S]*?notifications-center-header-toolbar \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?notifications-center-header-toolbar \.action-label::after\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?notification-list-item-toolbar-container \.action-label,[\s\S]*?notifications-center-header-toolbar \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?notifications-center-header-toolbar \.action-label::after\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?notifications-center-header-toolbar \.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder, var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /notifications-center-header-toolbar \.action-label\s*\{[^}]*outline(?:-color)?:/);
	});

	test('notification actions keep their target while painting inset hover, focus, and pressed faces', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/notifications/media/notificationsActions.css'), 'utf8');
		assert.match(css, /notifications-center-header-toolbar \.action-label\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/);
		assert.match(css, /notifications-center-header-toolbar \.action-label::after\s*\{[^}]*inset:\s*1px 2px/);
		assert.match(css, /notifications-center-header-toolbar \.action-label:hover::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /notifications-center-header-toolbar \.action-label:focus-visible::after\s*\{[^}]*toolbar-hoverBackground/);
		assert.match(css, /notifications-center-header-toolbar \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/);
		assert.match(css, /notifications-center-header-toolbar \.action-label:active\s*\{[^}]*background-color:\s*transparent/);
	});
});
