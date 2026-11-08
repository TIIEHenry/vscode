/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { escapeRegExpCharacters } from '../../../../../base/common/strings.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

const TERMINAL_CSS = 'src/vs/workbench/contrib/terminal/browser/media/terminal.css';
const XTERM_CSS = 'src/vs/workbench/contrib/terminal/browser/media/xterm.css';
const WIDGETS_CSS = 'src/vs/workbench/contrib/terminal/browser/media/widgets.css';
const VOICE_CSS = 'src/vs/workbench/contrib/terminal/browser/media/terminalVoice.css';
const STICKY_SCROLL_CSS = 'src/vs/workbench/contrib/terminalContrib/stickyScroll/browser/media/stickyScroll.css';
const INITIAL_HINT_CSS = 'src/vs/workbench/contrib/terminalContrib/inlineHint/browser/media/terminalInitialHint.css';
const FILES = [TERMINAL_CSS, XTERM_CSS, WIDGETS_CSS, VOICE_CSS, STICKY_SCROLL_CSS, INITIAL_HINT_CSS];

const TOOLBAR_ACTIVE_BACKGROUND = 'background-color: var(--vscode-toolbar-activeBackground, rgba(255, 255, 255, 0.1));';

interface IMotionRule {
	readonly file: string;
	readonly selectors: readonly string[];
	readonly transition: string;
	readonly activeSelectors: readonly string[];
	readonly activeDeclaration: string;
}

const RULES: readonly IMotionRule[] = [
	{
		file: TERMINAL_CSS,
		selectors: [
			'.monaco-workbench .terminal-editor .xterm a:not(.xterm-invalid-link)',
			'.monaco-workbench .pane-body.integrated-terminal .xterm a:not(.xterm-invalid-link)',
		],
		transition: 'background-color 0.08s ease',
		activeSelectors: [
			'.monaco-workbench .terminal-editor .xterm a:not(.xterm-invalid-link):active',
			'.monaco-workbench .pane-body.integrated-terminal .xterm a:not(.xterm-invalid-link):active',
		],
		activeDeclaration: 'opacity: 0.8;',
	},
	{
		file: TERMINAL_CSS,
		selectors: ['.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry'],
		transition: 'background-color 100ms ease',
		activeSelectors: ['.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: TERMINAL_CSS,
		selectors: ['.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry .terminal-tabs-chat-entry-delete'],
		transition: 'opacity 100ms ease, background-color 100ms ease',
		activeSelectors: ['.monaco-workbench .pane-body.integrated-terminal .terminal-tabs-chat-entry .terminal-tabs-chat-entry-delete:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: TERMINAL_CSS,
		selectors: ['.monaco-workbench .pane-body.integrated-terminal .tabs-list .monaco-list-row'],
		transition: 'background-color 100ms ease',
		activeSelectors: ['.monaco-workbench .pane-body.integrated-terminal .tabs-list .monaco-list-row:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: TERMINAL_CSS,
		selectors: ['.monaco-workbench .pane-body.integrated-terminal .tabs-list .actions .action-label'],
		transition: 'background-color 100ms ease',
		activeSelectors: ['.monaco-workbench .pane-body.integrated-terminal .tabs-list .actions .action-label:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: TERMINAL_CSS,
		selectors: ['.monaco-action-bar .action-item .single-terminal-tab'],
		transition: 'background-color 100ms ease',
		activeSelectors: ['.monaco-action-bar .action-item .single-terminal-tab:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: TERMINAL_CSS,
		selectors: ['.monaco-workbench .terminal .terminal-command-decoration:not(.default)'],
		transition: 'background-color 0.08s ease',
		activeSelectors: ['.monaco-workbench .terminal .terminal-command-decoration:not(.default):active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: XTERM_CSS,
		selectors: ['.xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-scra'],
		transition: 'background-color 0.08s ease',
		activeSelectors: ['.xterm .xterm-scrollable-element > .xterm-scrollbar > .xterm-scra:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: WIDGETS_CSS,
		selectors: ['.monaco-workbench .terminal-env-var-info'],
		transition: 'opacity 100ms ease',
		activeSelectors: ['.monaco-workbench .terminal-env-var-info:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: VOICE_CSS,
		selectors: ['.terminal-voice.recording.codicon.codicon-mic-filled'],
		transition: 'background-color 0.08s ease',
		activeSelectors: ['.terminal-voice.recording.codicon.codicon-mic-filled:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: STICKY_SCROLL_CSS,
		selectors: ['.terminal-sticky-scroll .hover-overlay'],
		transition: 'background-color 100ms ease',
		activeSelectors: ['.terminal-sticky-scroll .hover-overlay:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: INITIAL_HINT_CSS,
		selectors: ['.monaco-workbench .terminal-initial-hint a'],
		transition: 'background-color 0.08s ease',
		activeSelectors: ['.monaco-workbench .terminal-initial-hint a:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
];

const cssCache = new Map<string, string>();

function readCss(file: string): string {
	let css = cssCache.get(file);
	if (css === undefined) {
		css = fs.readFileSync(path.join(repoRoot, file), 'utf8');
		cssCache.set(file, css);
	}
	return css;
}

function selectorGroup(selectors: readonly string[]): string {
	return selectors.map(escapeRegExpCharacters).join(',\\s*');
}

function withRoot(root: string, selector: string): string {
	return `${root} ${selector.replace(/^\.monaco-workbench\s+/, '')}`;
}

suite('Terminal reduced motion chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('repo press and hover transitions stay within 100ms', () => {
		for (const rule of RULES) {
			const pattern = new RegExp(`^${selectorGroup(rule.selectors)}\\s*\\{[^}]*transition:\\s*${escapeRegExpCharacters(rule.transition)};`, 'm');
			assert.match(readCss(rule.file), pattern, `${rule.file}: ${rule.selectors[0]} should use transition: ${rule.transition}`);
		}
		for (const file of FILES) {
			assert.ok(!readCss(file).includes('0.12s'), `${file} must not keep 120ms transitions`);
		}
	});

	test('reduced motion turns each repo transition off, branch by branch', () => {
		for (const rule of RULES) {
			const css = readCss(rule.file);
			const reduced = rule.selectors.map(selector => withRoot('.monaco-workbench.monaco-reduce-motion', selector));
			const media = rule.selectors.map(selector => withRoot('.monaco-workbench:not(.monaco-enable-motion)', selector));
			for (const selector of [...reduced, ...media]) {
				assert.ok(css.includes(selector), `${rule.file}: missing ${selector}`);
			}
			assert.match(css, new RegExp(`^${selectorGroup(reduced)}\\s*\\{\\s*transition:\\s*none;\\s*\\}`, 'm'), `${rule.file}: ${reduced[0]} should disable the transition`);
			for (const selector of media) {
				// Other rules may share the @media block; [^@] keeps the match inside a single at-rule.
				const inReducedMotionQuery = new RegExp(`@media\\s*\\(prefers-reduced-motion:\\s*reduce\\)\\s*\\{[^@]*?(?:^|,)\\s*${escapeRegExpCharacters(selector)}\\s*(?:,[^{]*)?\\{[^}]*transition:\\s*none;`, 'm');
				assert.match(css, inReducedMotionQuery, `${rule.file}: ${selector} should disable the transition under prefers-reduced-motion`);
			}
		}
	});

	test('press feedback keeps its declarations', () => {
		for (const rule of RULES) {
			const pattern = new RegExp(`^${selectorGroup(rule.activeSelectors)}\\s*\\{[^}]*${escapeRegExpCharacters(rule.activeDeclaration)}`, 'm');
			assert.match(readCss(rule.file), pattern, `${rule.file}: ${rule.activeSelectors[0]} should keep ${rule.activeDeclaration}`);
		}
	});

	test('upstream terminal motion is left as is', () => {
		assert.match(readCss(TERMINAL_CSS), /\.monaco-workbench\.monaco-enable-motion \.pane-body\.integrated-terminal \.terminal-drop-overlay\s*\{\s*transition:\s*left 70ms ease-out, right 70ms ease-out, top 70ms ease-out, bottom 70ms ease-out, opacity 150ms ease-out;\s*\}/);
		const xterm = readCss(XTERM_CSS);
		assert.ok(xterm.includes('transition: opacity 100ms linear;'));
		assert.ok(xterm.includes('transition: opacity 800ms linear;'));
		assert.ok(readCss(VOICE_CSS).includes('animation: ani-terminal-speech 1s infinite;'));
	});
});
