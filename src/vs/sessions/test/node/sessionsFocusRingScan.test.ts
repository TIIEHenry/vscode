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

	test('sessions chat composer has no glass or drop shadow', () => {
		const chatView = stripCssComments(readRepoFile('src/vs/sessions/contrib/chat/browser/media/chatView.css'));
		const chatInput = stripCssComments(readRepoFile('src/vs/sessions/contrib/chat/browser/media/chatInput.css'));
		const inSession = stripCssComments(readRepoFile('src/vs/sessions/contrib/chat/browser/media/newChatInSession.css'));
		for (const css of [chatView, chatInput, inSession]) {
			assert.ok(!css.includes('backdrop-filter'), 'chat composer css must not blur');
			assert.ok(!css.includes('4px 16px'), 'chat composer css must not drop a 4px 16px shadow');
		}

		const card = collectCssRules(chatView).find(rule =>
			rule.selector.includes('.new-chat-widget-content') && rule.selector.includes(':not(.new-chat-in-session)')
		);
		assert.ok(card, 'background chat card rule');
		assert.match(card.body, /background:\s*var\(--session-view-background\)/);
		assert.match(card.body, /box-shadow:\s*none/);

		const focusedInput = collectCssRules(chatView).find(rule =>
			splitSelectorList(rule.selector).some(selector => flatSelector(selector) === '.agent-sessions-workbench .interactive-session .chat-input-container.focused')
		);
		assert.ok(focusedInput, 'session chat input focus rule');
		assert.match(focusedInput.body, /border-color:\s*var\(--vscode-focusBorder\)/);
		assert.match(focusedInput.body, /box-shadow:\s*none/);

		const newChatFocus = collectCssRules(chatInput).find(rule =>
			splitSelectorList(rule.selector).some(selector => flatSelector(selector) === ':not(.hc-black):not(.hc-light) .new-chat-input-area:focus-within')
		);
		assert.ok(newChatFocus, 'new chat focus rule');
		assert.match(newChatFocus.body, /border-color:\s*var\(--vscode-focusBorder\)/);
		assert.match(newChatFocus.body, /box-shadow:\s*none/);

		const inSessionFocus = collectCssRules(inSession).find(rule =>
			splitSelectorList(rule.selector).some(selector => flatSelector(selector) === '.new-chat-in-session .new-chat-input-area:focus-within')
		);
		assert.ok(inSessionFocus, 'in-session chat focus rule');
		assert.match(inSessionFocus.body, /border-color:\s*var\(--vscode-focusBorder\)/);
		assert.match(inSessionFocus.body, /box-shadow:\s*none/);

		const hcSessionFocus = collectCssRules(chatView).find(rule =>
			splitSelectorList(rule.selector).some(selector => flatSelector(selector) === '.monaco-workbench.hc-black.agent-sessions-workbench .interactive-session .chat-input-container.focused')
		);
		assert.ok(hcSessionFocus, 'high contrast session focus must share the workbench root');
		assert.match(hcSessionFocus.body, /border-color:\s*var\(--vscode-contrastActiveBorder, var\(--vscode-contrastBorder\)\)/);
		assert.match(hcSessionFocus.body, /box-shadow:\s*none/);

		const hcNewChatFocus = collectCssRules(chatInput).find(rule =>
			splitSelectorList(rule.selector).some(selector => flatSelector(selector) === '.monaco-workbench.hc-black .new-chat-input-area:focus-within')
		);
		assert.ok(hcNewChatFocus, 'high contrast new chat focus rule');
		assert.match(hcNewChatFocus.body, /border-color:\s*var\(--vscode-contrastActiveBorder, var\(--vscode-contrastBorder\)\)/);
		assert.match(hcNewChatFocus.body, /box-shadow:\s*none/);

		const hcInSessionFocus = collectCssRules(inSession).find(rule =>
			splitSelectorList(rule.selector).some(selector => flatSelector(selector) === '.hc-black .new-chat-in-session .new-chat-input-area:focus-within')
		);
		assert.ok(hcInSessionFocus, 'high contrast in-session focus rule');
		assert.match(hcInSessionFocus.body, /border-color:\s*var\(--vscode-contrastActiveBorder, var\(--vscode-contrastBorder\)\)/);
		assert.match(hcInSessionFocus.body, /box-shadow:\s*none/);
	});
});
