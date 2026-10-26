/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/sessions/contrib/providers/remoteAgentHost/browser/mobileHostFilterActionViewItem.ts';
const STYLE_REL = 'src/vs/sessions/contrib/providers/remoteAgentHost/browser/media/hostPickerSheet.css';

function readRepoFile(relativePath: string, fallbackPath: string): string {
	const candidates = [
		path.join(process.cwd(), relativePath),
		path.join(thisDir, fallbackPath),
		path.join(thisDir, '../../../../../../../', relativePath),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${relativePath} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

suite('Mobile host picker focus boundary scan (D1331)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('modal keeps focus inside and restores the opener', () => {
		const source = readRepoFile(SOURCE_REL, '../../browser/mobileHostFilterActionViewItem.ts');
		assert.ok(source.includes("sheet.setAttribute('aria-modal', 'true');"));
		assert.ok(source.includes("const opener = this.element;"));
		assert.ok(source.includes("event.key !== 'Tab'"));
		assert.ok(source.includes("focusable[nextIndex]?.focus();"));
		assert.ok(source.includes("(focusRefs.firstCheckedHost ?? focusRefs.firstHost ?? focusRefs.rediscover ?? closeBtn).focus();"));
		assert.ok(source.includes("if (opener?.isConnected) {"));
		assert.ok(source.includes("opener.focus();"));
	});

	test('host rows retain a visible tokenized keyboard focus ring', () => {
		const style = readRepoFile(STYLE_REL, '../../browser/media/hostPickerSheet.css');
		const focusRule = style.match(/\.host-picker-sheet-item:focus-visible\s*\{([^}]*)\}/)?.[1] ?? '';
		assert.ok(focusRule.includes('outline: 1px solid var(--vscode-focusBorder)'));
		assert.ok(focusRule.includes('outline-offset: -1px'));
	});
});
