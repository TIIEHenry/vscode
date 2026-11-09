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

const MEDIA = 'src/vs/workbench/contrib/debug/browser/media';
const DEBUG_TOOLBAR_CSS = `${MEDIA}/debugToolBar.css`;
const CALL_STACK_WIDGET_CSS = `${MEDIA}/callStackWidget.css`;
const BREAKPOINT_WIDGET_CSS = `${MEDIA}/breakpointWidget.css`;
const EXCEPTION_WIDGET_CSS = `${MEDIA}/exceptionWidget.css`;
const DEBUG_HOVER_CSS = `${MEDIA}/debugHover.css`;
const DEBUG_VIEWLET_CSS = `${MEDIA}/debugViewlet.css`;
const DEBUG_CONTRIBUTION_CSS = `${MEDIA}/debug.contribution.css`;
const REPL_CSS = `${MEDIA}/repl.css`;
const FILES = [DEBUG_TOOLBAR_CSS, CALL_STACK_WIDGET_CSS, BREAKPOINT_WIDGET_CSS, EXCEPTION_WIDGET_CSS, DEBUG_HOVER_CSS, DEBUG_VIEWLET_CSS, DEBUG_CONTRIBUTION_CSS, REPL_CSS];

const TOOLBAR_ACTIVE_BACKGROUND = 'background-color: var(--vscode-toolbar-activeBackground, rgba(255, 255, 255, 0.1));';

interface IMotionRule {
	readonly file: string;
	readonly selectors: readonly string[];
	readonly transition: string;
	readonly activeSelectors: readonly string[];
	readonly activeDeclaration: string;
}

function toolbarPressRule(file: string, selector: string, transition: string): IMotionRule {
	return { file, selectors: [selector], transition, activeSelectors: [`${selector}:active`], activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND };
}

const RULES: readonly IMotionRule[] = [
	{
		file: DEBUG_TOOLBAR_CSS,
		// The upstream base rule has two spaces after .monaco-workbench; its :active rule has one.
		selectors: ['.monaco-workbench  .debug-toolbar .monaco-action-bar .action-item .action-label'],
		transition: 'background-color 100ms ease',
		activeSelectors: ['.monaco-workbench .debug-toolbar .monaco-action-bar .action-item .action-label:active'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	toolbarPressRule(CALL_STACK_WIDGET_CSS, '.multiCallStackFrame .collapse-button a', 'background-color 100ms ease'),
	toolbarPressRule(CALL_STACK_WIDGET_CSS, '.multiCallStackFrame .title[role="link"]', 'opacity 100ms ease'),
	toolbarPressRule(CALL_STACK_WIDGET_CSS, '.monaco-editor .call-stack-go-to-file-link', 'opacity 100ms ease'),
	toolbarPressRule(BREAKPOINT_WIDGET_CSS, '.monaco-editor .zone-widget .zone-widget-container.breakpoint-widget .select-breakpoint-container .monaco-button', 'background-color 100ms ease'),
	toolbarPressRule(EXCEPTION_WIDGET_CSS, '.monaco-editor .zone-widget .zone-widget-container.exception-widget .title .actions .action-label', 'background-color 100ms ease'),
	toolbarPressRule(EXCEPTION_WIDGET_CSS, '.monaco-editor .zone-widget .zone-widget-container.exception-widget .stack-trace a', 'opacity 100ms ease'),
	toolbarPressRule(DEBUG_HOVER_CSS, '.monaco-editor .debug-hover-widget .debug-hover-tree .monaco-list-row', 'background-color 100ms ease'),
	toolbarPressRule(DEBUG_VIEWLET_CSS, '.monaco-workbench .part > .title > .title-actions .start-debug-action-item .codicon-debug-start', 'background-color 100ms ease'),
	toolbarPressRule(DEBUG_VIEWLET_CSS, '.monaco-workbench .monaco-action-bar .start-debug-action-item .configuration .monaco-dropdown > .dropdown-label', 'background-color 100ms ease'),
	{
		file: DEBUG_VIEWLET_CSS,
		selectors: [
			'.debug-pane .debug-call-stack .thread',
			'.debug-pane .debug-call-stack .session',
			'.debug-pane .debug-call-stack .stack-frame',
		],
		transition: 'background-color 0.08s ease',
		activeSelectors: [
			'.debug-pane .debug-call-stack .monaco-list-row:active .thread',
			'.debug-pane .debug-call-stack .monaco-list-row:active .session',
			'.debug-pane .debug-call-stack .monaco-list-row:active .stack-frame',
		],
		activeDeclaration: 'background-color: var(--vscode-list-activeSelectionBackground);',
	},
	toolbarPressRule(DEBUG_VIEWLET_CSS, '.debug-pane .monaco-list-row .monaco-action-bar .action-label', 'background-color 100ms ease'),
	{
		file: DEBUG_VIEWLET_CSS,
		selectors: [
			'.debug-pane .debug-call-stack .load-all',
			'.debug-pane .debug-call-stack .show-more',
		],
		transition: 'opacity 100ms ease',
		activeSelectors: [
			'.debug-pane .debug-call-stack .load-all:active',
			'.debug-pane .debug-call-stack .show-more:active',
		],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: DEBUG_VIEWLET_CSS,
		selectors: ['.debug-pane .monaco-list-row .expression'],
		transition: 'background-color 0.08s ease',
		activeSelectors: ['.debug-pane .monaco-list-row:active .expression'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	{
		file: DEBUG_VIEWLET_CSS,
		selectors: ['.debug-pane .debug-breakpoints .breakpoint'],
		transition: 'background-color 0.08s ease',
		activeSelectors: ['.debug-pane .debug-breakpoints .monaco-list-row:active .breakpoint'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	toolbarPressRule(DEBUG_VIEWLET_CSS, '.debug-pane .debug-breakpoints .breakpoint .monaco-custom-toggle', 'background-color 0.08s ease'),
	toolbarPressRule(DEBUG_CONTRIBUTION_CSS, '.codicon-debug-hint', 'opacity 100ms ease'),
	toolbarPressRule(DEBUG_CONTRIBUTION_CSS, '.monaco-editor .inline-breakpoint-widget', 'background-color 0.08s ease'),
	toolbarPressRule(DEBUG_CONTRIBUTION_CSS, '.monaco-workbench .monaco-list-row .expression .value a.link.pointer', 'background-color 0.08s ease'),
	{
		file: REPL_CSS,
		selectors: ['.monaco-workbench .repl .repl-tree .monaco-tl-contents'],
		transition: 'background-color 0.08s ease',
		activeSelectors: ['.monaco-workbench .repl .repl-tree .monaco-list-row:active .monaco-tl-contents'],
		activeDeclaration: TOOLBAR_ACTIVE_BACKGROUND,
	},
	toolbarPressRule(REPL_CSS, '.monaco-workbench .repl .repl-tree .monaco-tl-contents .expression .lazy-button', 'background-color 0.08s ease'),
	{
		file: REPL_CSS,
		selectors: [
			'.monaco-workbench .repl .repl-tree .output.expression.value-and-source .source',
			'.monaco-workbench .repl .repl-tree .group .source',
		],
		transition: 'background-color 0.08s ease',
		activeSelectors: [
			'.monaco-workbench .repl .repl-tree .output.expression.value-and-source .source:active',
			'.monaco-workbench .repl .repl-tree .group .source:active',
		],
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

suite('Debug reduced motion chrome', () => {

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
});
