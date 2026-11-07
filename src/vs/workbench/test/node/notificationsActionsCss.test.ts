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
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?notification-list-item-toolbar-container \.action-label,[\s\S]*?notifications-center-header-toolbar \.action-label\s*\{[^}]*transition:\s*none;/);
		assert.doesNotMatch(css, /notifications-center-header-toolbar \.action-label\s*\{[^}]*outline(?:-color)?:/);
	});
});
