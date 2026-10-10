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

function ruleBody(css: string, selector: string): string {
	const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '');
	const pattern = new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
	const match = pattern.exec(stripped);
	assert.ok(match, `missing rule ${selector}`);
	return match![1];
}

suite('Conversation hide chrome aligns with the preview category bar', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('hide control and session title row are 28px, hit target 24px', () => {
		const part = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/conversationPart.css'), 'utf8');
		const lens = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		const nav = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationNavigation.css'), 'utf8');

		const chrome = ruleBody(part, '.monaco-workbench .part.conversation > .conversation-region-chrome');
		assert.match(chrome, /height:\s*28px/);
		assert.doesNotMatch(chrome, /height:\s*35px/);

		const label = ruleBody(part, '.monaco-workbench .part.conversation > .conversation-region-chrome .title-actions .action-label');
		assert.match(label, /width:\s*24px/);
		assert.match(label, /height:\s*24px/);
		assert.match(label, /padding:\s*0/);

		const sessionBar = ruleBody(part, '.monaco-workbench .part.conversation .conversation-session-bar');
		assert.match(sessionBar, /height:\s*28px/);
		assert.match(sessionBar, /max-height:\s*28px/);

		const lensBar = ruleBody(lens, '.monaco-workbench .part.conversation .conversation-lens-session-bar');
		assert.match(lensBar, /height:\s*28px/);
		assert.match(lensBar, /max-height:\s*28px/);

		const windowNav = ruleBody(nav, '.monaco-workbench .part.conversation .conversation-window-nav');
		assert.match(windowNav, /height:\s*28px/);
		assert.match(windowNav, /max-height:\s*28px/);
	});
});
