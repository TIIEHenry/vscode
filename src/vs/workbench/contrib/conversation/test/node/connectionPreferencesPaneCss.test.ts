/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

suite('Connection preferences motion contract', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('prefers-reduced-motion honors the explicit motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/connectionPreferencesPane.css'), 'utf8');
		const media = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
		assert.ok(media.startsWith('@media'), 'connection pane reduced-motion media block is present');
		assert.strictEqual((media.match(/\.monaco-workbench:not\(\.monaco-enable-motion\)/g) ?? []).length, 6);
		assert.match(media, /\.monaco-workbench:not\(\.monaco-enable-motion\) \.connection-preferences-pane \.connection-preferences-nav-row::before[\s\S]*?transition:\s*none;/s);
		assert.match(media, /\.connection-preferences-pane \.monaco-button,[\s\S]*\.connection-preferences-pane \.connection-toggle-details\s*\{[^}]*transition:\s*none;/s);
		const classRules = css.slice(0, css.indexOf('@media (prefers-reduced-motion: reduce)'));
		assert.match(classRules, /\.monaco-workbench\.monaco-reduce-motion \.connection-preferences-pane \.monaco-button,[\s\S]*\.connection-preferences-pane \.connection-toggle-details\s*\{[^}]*transition:\s*none;/s);
	});
});
