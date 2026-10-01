/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));

function readRepoFile(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found, 'utf8');
}

function stripCssComments(css: string): string {
	return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function collectCssRules(css: string): { selector: string; body: string }[] {
	const rules: { selector: string; body: string }[] = [];
	const re = /([^{}]+)\{([^{}]*)\}/g;
	let match: RegExpExecArray | null;
	while ((match = re.exec(css))) {
		const selector = match[1].trim();
		if (selector.startsWith('@')) {
			continue;
		}
		rules.push({ selector, body: match[2] });
	}
	return rules;
}

function splitSelectorList(selectorList: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = '';
	for (const ch of selectorList) {
		if (ch === '(') {
			depth++;
		} else if (ch === ')') {
			depth--;
		} else if (ch === ',' && depth === 0) {
			parts.push(current.trim());
			current = '';
			continue;
		}
		current += ch;
	}
	if (current.trim()) {
		parts.push(current.trim());
	}
	return parts;
}

function flatSelector(selector: string): string {
	return selector.replace(/\s+/g, ' ').trim();
}

function assertFocusVisibleRingFollowsNone(css: string, noneNeedle: string, ringNeedle: string): void {
	const rules = collectCssRules(css);
	const noneIndex = rules.findIndex(rule =>
		/outline\s*:\s*none\s*!important/.test(rule.body) &&
		splitSelectorList(rule.selector).some(selector => {
			const flat = flatSelector(selector);
			return flat.includes(noneNeedle) && !flat.includes(':focus-visible');
		})
	);
	const ringIndex = rules.findIndex(rule =>
		rule.body.includes('var(--vscode-focusBorder)') &&
		splitSelectorList(rule.selector).some(selector => flatSelector(selector).includes(ringNeedle))
	);
	assert.ok(noneIndex >= 0, `missing outline:none !important for ${noneNeedle}`);
	assert.ok(ringIndex > noneIndex, `${ringNeedle} :focus-visible ring must follow outline:none !important`);
}

suite('Sessions keyboard focus ring', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('sessions inputs titlebar and send button keep focus-visible rings', () => {
		const style = stripCssComments(readRepoFile('src/vs/sessions/browser/media/style.css'));
		const titlebar = stripCssComments(readRepoFile('src/vs/sessions/contrib/sessions/browser/media/sessionsTitleBarWidget.css'));
		const chat = stripCssComments(readRepoFile('src/vs/sessions/contrib/chat/browser/media/chatInput.css'));
		const styleRules = collectCssRules(style);

		const syntheticIndex = styleRules.findIndex(rule =>
			splitSelectorList(rule.selector).some(selector => flatSelector(selector).includes('.monaco-inputbox.synthetic-focus'))
		);
		assert.ok(syntheticIndex >= 0, 'synthetic-focus needs a ring rule');
		const synthetic = styleRules[syntheticIndex]!;
		assert.ok(synthetic.body.includes('var(--vscode-focusBorder)'));
		assert.ok(!/outline\s*:\s*none/.test(synthetic.body), 'synthetic-focus must not stay outline:none');

		assertFocusVisibleRingFollowsNone(
			style,
			'input:focus',
			'input:not([type="checkbox"]):not([type="radio"]):focus-visible'
		);
		assertFocusVisibleRingFollowsNone(style, 'textarea:focus', 'textarea:focus-visible');
		const inputNone = styleRules.findIndex(rule =>
			/outline\s*:\s*none\s*!important/.test(rule.body) &&
			splitSelectorList(rule.selector).some(selector => flatSelector(selector).includes('input:focus') && !flatSelector(selector).includes(':focus-visible'))
		);
		assert.ok(syntheticIndex > inputNone, 'synthetic-focus ring must follow the input outline:none !important rule');

		assertFocusVisibleRingFollowsNone(
			titlebar,
			'.agent-sessions-titlebar-container:focus',
			'.agent-sessions-titlebar-container:focus-visible'
		);

		const send = collectCssRules(chat).find(rule =>
			/min-width\s*:/.test(rule.body) &&
			splitSelectorList(rule.selector).some(selector => flatSelector(selector) === '.sessions-chat-send-button .monaco-button')
		);
		assert.ok(send, 'send button size rule');
		assert.match(send.body, /min-width\s*:\s*24px/);

		assertFocusVisibleRingFollowsNone(
			chat,
			'.sessions-chat-send-button .monaco-button:focus',
			'.sessions-chat-send-button:has(.monaco-button:not(.disabled):focus-visible)'
		);
	});
});
