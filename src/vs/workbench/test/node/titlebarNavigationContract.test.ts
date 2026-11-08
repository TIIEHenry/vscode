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

suite('Titlebar navigation placement', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('moves history actions into the left navigation toolbar without creating a logo', () => {
		const actions = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/editor/editorActions.ts'), 'utf8');
		const titlebar = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/titlebar/titlebarPart.ts'), 'utf8');
		const nativeTitlebar = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts'), 'utf8');
		const menuIds = fs.readFileSync(path.join(repoRoot, 'src/vs/platform/actions/common/actions.ts'), 'utf8');
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css'), 'utf8');

		assert.strictEqual((actions.match(/MenuId\.TitleBarNavigation/g) ?? []).length, 2);
		assert.doesNotMatch(actions, /MenuId\.CommandCenter, order:\s*[12]/);
		assert.match(actions, /class NavigateForwardAction[\s\S]*?precondition:\s*ContextKeyExpr\.has\('canNavigateForward'\)[\s\S]*?keybinding:/);
		assert.match(actions, /class NavigateBackwardsAction[\s\S]*?precondition:\s*ContextKeyExpr\.has\('canNavigateBack'\)[\s\S]*?keybinding:/);
		assert.match(menuIds, /static readonly TitleBarNavigation = new MenuId\('TitleBarNavigation'\);/);
		assert.match(titlebar, /this\.navigationToolbarElement = prepend\(this\.leftContent, \$\('div\.navigation-toolbar-container'\)\);/);
		assert.match(titlebar, /createInstance\(MenuWorkbenchToolBar, this\.navigationToolbarElement, MenuId\.TitleBarNavigation/);
		assert.match(titlebar, /this\.dragRegion = prepend\(this\.rootContainer, \$\('div\.titlebar-drag-region'\)\);/);
		assert.doesNotMatch(titlebar, /window-appicon/);
		assert.doesNotMatch(nativeTitlebar, /appIcon|window-appicon/);
		assert.match(css, /titlebar-left > \.navigation-toolbar-container\s*\{[^}]*order:\s*1;/);
		assert.match(css, /titlebar-left > \.navigation-toolbar-container\.has-no-actions\s*\{[^}]*display:\s*none;/);
		assert.match(css, /navigation-toolbar-container \.action-label\s*\{[^}]*height:\s*28px[^}]*background-color:\s*transparent/s);
		assert.match(css, /navigation-toolbar-container \.action-label::after\s*\{[^}]*inset:\s*1px 2px[^}]*background-color:\s*transparent/s);
		assert.match(css, /navigation-toolbar-container .*action-item:not\(\.disabled\):active \.action-label::after\s*\{[^}]*toolbar-activeBackground/s);
		assert.doesNotMatch(css, /window-appicon/);
	});

	test('marks window.doubleClickIconToClose deprecated because the title bar draws no application icon', () => {
		const desktop = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/electron-browser/desktop.contribution.ts'), 'utf8');
		const start = desktop.indexOf(`'window.doubleClickIconToClose': {`);
		const end = desktop.indexOf(`'window.titleBarStyle': {`, start);

		assert.ok(start >= 0 && end > start, 'window.doubleClickIconToClose stays registered so configured values do not become unknown settings');
		assert.ok(desktop.slice(start, end).includes(`'markdownDeprecationMessage': localize(`));
	});

	test('keeps right titlebar toolbar actions on an inset interaction face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css'), 'utf8');

		assert.match(css, /center-adjacent-toolbar-container \.action-label,[\s\S]*?update-toolbar-container \.action-label\s*\{[^}]*position:\s*relative[^}]*background-color:\s*transparent/s);
		assert.match(css, /center-adjacent-toolbar-container \.action-label::after,[\s\S]*?update-toolbar-container \.action-label::after\s*\{[^}]*inset:\s*1px 2px[^}]*background-color:\s*transparent/s);
		assert.match(css, /center-adjacent-toolbar-container \.action-label:active::after,[\s\S]*?update-toolbar-container \.action-label:active::after\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /center-adjacent-toolbar-container \.action-item:not\(\.disabled\):hover \.action-label::after,[\s\S]*?update-toolbar-container \.action-item:not\(\.disabled\):hover \.action-label::after\s*\{[^}]*toolbar-hoverBackground/s);
	});
});
