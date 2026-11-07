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

suite('Open Editors dirty count chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ordinary focus uses toolbar hover feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/files/browser/views/media/openeditors.css'), 'utf8');
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?open-editors-dirty-count-container[^\n]*focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/);
		assert.match(css, /open-editors-dirty-count-container[^\n]*focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\)/);
		assert.doesNotMatch(css, /open-editors-dirty-count-container[^\n]*focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\)/);
	});
});
