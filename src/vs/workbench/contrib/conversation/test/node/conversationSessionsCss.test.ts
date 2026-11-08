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

suite('Conversation sessions chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('session row More keeps a usable target and pressed surface above hover and focus', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessions.css'), 'utf8');
		const more = css.indexOf('.monaco-workbench .conversation-sessions-item-more {');
		assert.ok(more >= 0, 'More button base rule');
		assert.match(css.slice(more, more + 520), /width:\s*var\(--vscode-spacing-size280\)/);
		assert.match(css.slice(more, more + 520), /height:\s*var\(--vscode-spacing-size280\)/);

		const focusIndex = css.indexOf('.monaco-workbench .conversation-sessions-item-more:focus-visible');
		const hoverIndex = css.indexOf('.monaco-workbench .conversation-sessions-item-more:hover');
		const activeIndex = css.indexOf('.monaco-workbench .conversation-sessions-item-more:active');
		assert.ok(focusIndex >= 0, 'More button focus surface contract');
		assert.ok(hoverIndex >= 0, 'More button hover surface contract');
		assert.ok(activeIndex > focusIndex && activeIndex > hoverIndex, 'pressed surface must follow focus and hover surfaces');
		assert.match(css.slice(activeIndex, activeIndex + 260), /background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});
});
