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

suite('Notifications toasts', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('toast entrance honors reduced motion while preserving explicit motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/notifications/media/notificationsToasts.css'), 'utf8');
		assert.match(css, /notification-toast-container > \.notification-toast\s*\{[^}]*transition:\s*transform 300ms ease-out, opacity 300ms ease-out/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?notification-toast-container > \.notification-toast\s*\{[^}]*transition:\s*transform 0ms ease-out, opacity 0ms ease-out;/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) > \.notifications-toasts[\s\S]*?notification-toast-container > \.notification-toast\s*\{[^}]*transition:\s*none;/);
	});
});
