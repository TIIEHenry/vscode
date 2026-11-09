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

suite('Terminal tab selection surface', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('active terminal entry exposes a quiet selected surface while retaining its active border', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/terminal/browser/media/terminal.css'), 'utf8');
		assert.match(css, /\.pane-body\.integrated-terminal \.terminal-tabs-entry\.is-active\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(css, /\.terminal-tabs-entry\.is-active::before\s*\{[^}]*background-color:\s*var\(--vscode-terminal-tab-activeBorder\)/);
	});
});
