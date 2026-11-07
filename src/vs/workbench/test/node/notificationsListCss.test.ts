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

suite('Notifications list chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('notification links use a quiet normal-theme focus state and retain HC contrast', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/notifications/media/notificationsList.css'), 'utf8');
		const linkSelector = String.raw`\.notifications-list-container \.notification-list-item \.notification-list-item-message a`;

		assert.match(css, new RegExp(`${linkSelector}:focus\\s*\\{[^}]*outline:\\s*none;`, 's'));
		assert.match(css, new RegExp(`\\.monaco-workbench:not\\(\\.hc-black\\):not\\(\\.hc-light\\)[^{]*${linkSelector}:focus-visible\\s*\\{[^}]*background-color:\\s*var\\(--vscode-toolbar-hoverBackground\\);`, 's'));
		assert.match(css, new RegExp(`\\.monaco-workbench\\.hc-black[^{]*${linkSelector}:focus-visible[\\s\\S]*?outline:\\s*1px solid var\\(--vscode-contrastActiveBorder\\);`, 's'));
		assert.match(css, new RegExp(`\\.monaco-workbench\\.hc-light[^{]*${linkSelector}:focus-visible[\\s\\S]*?outline:\\s*1px solid var\\(--vscode-contrastActiveBorder\\);`, 's'));
		assert.doesNotMatch(css, new RegExp(`${linkSelector}:focus[^}]*var\\(--vscode-focusBorder\\)`, 's'));
	});

	test('notification list row feedback honors reduced motion while preserving the active state', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/notifications/media/notificationsList.css'), 'utf8');
		assert.match(css, /\.notifications-list-container \.monaco-list-row\s*\{[^}]*transition:\s*background-color 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.notifications-list-container \.monaco-list-row\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.notifications-list-container \.monaco-list-row\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /\.notifications-list-container \.monaco-list-row:active\s*\{[^}]*background-color:\s*var\(--vscode-list-activeSelectionBackground\);/);
	});

	test('notification action buttons honor reduced motion while preserving pressed feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/notifications/media/notificationsList.css'), 'utf8');
		assert.match(css, /notification-list-item-buttons-container > \.monaco-button-dropdown,[\s\S]*?transition:\s*background-color 0\.08s ease, filter 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?notification-list-item-buttons-container > \.monaco-button-dropdown,[\s\S]*?notification-list-item-buttons-container \.monaco-dropdown-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?notification-list-item-buttons-container > \.monaco-button-dropdown,[\s\S]*?notification-list-item-buttons-container \.monaco-dropdown-button\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /notification-list-item-buttons-container \.monaco-dropdown-button:active\s*\{[^}]*filter:\s*brightness\(0\.92\);/);
	});

	test('notification message links honor reduced motion while preserving focus feedback', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/notifications/media/notificationsList.css'), 'utf8');
		assert.match(css, /notification-list-item-message a\s*\{[^}]*transition:\s*opacity 0\.08s ease;/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?notification-list-item-message a\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?notification-list-item-message a\s*\{[^}]*transition:\s*none;/);
		assert.match(css, /notification-list-item-message a:focus-visible\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground\);/);
	});
});
