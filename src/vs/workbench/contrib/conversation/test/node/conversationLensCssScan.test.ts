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

const MAXIMIZE_CLASS = '.conversation-lens-input-maximized';
const MAXIMIZE_MUST_NOT_HIDE = ['.conversation-lens-dock-gate-row', '.conversation-lens-inbox-overlay'] as const;

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

function stripFunctionalSelectors(selector: string): string {
	let next = selector;
	let prev: string;
	do {
		prev = next;
		next = next.replace(/:(?:has|not|is|where)\((?:[^()]|\([^()]*\))*\)/g, '');
	} while (next !== prev);
	return next;
}

function hidesDisplayNone(body: string): boolean {
	return /display\s*:\s*none\b/.test(body);
}

suite('ConversationLens reveal navigation (T5a) - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('ua-common.css keeps balanced braces so letterpress and HC rules apply', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/ua-common.css'), 'utf8'));
		assert.strictEqual((css.match(/\{/g) ?? []).length, (css.match(/\}/g) ?? []).length);
			let depth = 0;
			for (const character of css) {
				if (character === '{') {
					depth++;
				} else if (character === '}') {
					depth--;
					assert.ok(depth >= 0);
				}
			}
			assert.strictEqual(depth, 0);
	});

	test('composer edit header stays hidden until an edit is active', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hiddenRule = collectCssRules(css).find(rule => rule.selector.includes('.conversation-lens-composer-edit-header[hidden]'));
		assert.ok(hiddenRule, 'edit header needs an author [hidden] rule; display:flex overrides the UA hidden style');
		assert.ok(hidesDisplayNone(hiddenRule.body));
	});

	test('identity chips and add-folder use compact focus feedback while HC keeps a contrast ring', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationIdentityStrip.css'), 'utf8'));
		const rules = collectCssRules(css);
		const normal = rules.find(rule => rule.selector.includes(':not(.hc-black):not(.hc-light)') && rule.selector.includes('.conversation-identity-chip:focus-visible'));
		assert.ok(normal, 'normal identity focus rule');
		assert.match(normal!.body, /outline\s*:\s*none\s*!important/);
		assert.match(normal!.body, /background-color\s*:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.ok(normal!.selector.includes('.conversation-identity-add-folder:focus-visible'), 'normal add-folder focus rule');
		const highContrast = rules.find(rule => rule.selector.includes('.monaco-workbench.hc-black') && rule.selector.includes('.conversation-identity-chip:focus-visible'));
		assert.ok(highContrast, 'HC identity focus rule');
		assert.match(highContrast!.body, /contrastActiveBorder/);
		assert.ok(highContrast!.selector.includes('.conversation-identity-add-folder:focus-visible'), 'HC add-folder focus rule');
	});

	test('identity strip and chips have display:none when hidden', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationIdentityStrip.css'), 'utf8'));
		const hiddenRule = collectCssRules(css).find(rule => rule.selector.includes('.conversation-identity-chip[hidden]'));
		assert.ok(hiddenRule, 'hidden identity chip needs author display:none; display:inline-flex overrides UA style');
		assert.ok(hidesDisplayNone(hiddenRule.body));
	});

	test('hidden lens surfaces do not keep a flex height', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		for (const cls of ['.conversation-lens-timeline', '.conversation-lens-trajectory', '.conversation-lens-trajectory-body', '.conversation-lens-prefirst-hero', '.conversation-lens-dock-agent']) {
			const rule = collectCssRules(css).find(candidate => candidate.selector.includes(`${cls}[hidden]`));
			assert.ok(rule, `${cls}[hidden]`);
			assert.ok(/display\s*:\s*none\b/.test(rule.body), cls);
		}
	});

	test('PreFirst hero centers the composer in the reading column', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hero = collectCssRules(css).find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-prefirst-hero');
		assert.ok(hero, 'prefirst hero rule');
		assert.ok(/justify-content\s*:\s*center\b/.test(hero.body));
		assert.ok(/flex\s*:\s*0\s+1\s+auto/.test(hero.body), 'hero stays content-sized so the column can center it');
		const column = collectCssRules(css).find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-reading-column.conversation-lens-phase-prefirst');
		assert.ok(column, 'prefirst reading column rule');
		assert.ok(/justify-content\s*:\s*safe\s+center\b/.test(column.body));
		const collapsed = collectCssRules(css).find(rule => rule.selector.includes('.conversation-lens-phase-prefirst .conversation-lens-timeline'));
		assert.ok(collapsed && /display\s*:\s*none\b/.test(collapsed.body), 'empty timeline must leave the flex flow');
	});

	test('composer dock-input suppresses nested outline on focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const focusRule = collectCssRules(css).find(rule => rule.selector.includes('.conversation-lens-dock-input:focus'));
		assert.ok(focusRule, 'dock-input:focus needs outline:none to prevent double focus outline with composer');
		assert.ok(/outline\s*:\s*none\b/.test(focusRule.body));
	});

	test('timeline articles suppress mouse focus ring and paint a compact keyboard surface', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationTimeline.css'), 'utf8'));
		const rules = collectCssRules(css);
		const item = rules.find(candidate => candidate.selector.trim() === '.conversation-timeline-item');
		assert.ok(item, 'timeline article keeps an anchored hit target');
		assert.match(item!.body, /position:\s*relative/);
		assert.match(item!.body, /isolation:\s*isolate/);
		const face = rules.find(candidate => candidate.selector.trim() === '.conversation-timeline-item::before');
		assert.ok(face, 'timeline article needs an inset visual face');
		assert.match(face!.body, /inset:\s*1px 4px/);
		const mouseFocus = collectCssRules(css).find(candidate =>
			candidate.selector.includes('.conversation-timeline-item:focus') &&
			!candidate.selector.includes(':focus-visible') &&
			/outline\s*:\s*none\s*!important/.test(candidate.body));
		assert.ok(mouseFocus, 'timeline article :focus needs outline:none !important to beat the workbench tabindex ring');
		assert.ok(mouseFocus!.selector.includes('.monaco-workbench:not(.hc-black):not(.hc-light)'));
		const normal = collectCssRules(css).find(candidate =>
			candidate.selector.includes('.conversation-timeline-item:focus-visible') &&
			candidate.selector.includes(':not(.hc-black):not(.hc-light)'));
		assert.ok(normal, 'timeline article :focus-visible needs a normal-theme keyboard surface');
		assert.match(normal!.body, /outline:\s*none\s*!important/);
		assert.match(normal!.body, /background-color:\s*transparent/);
		assert.doesNotMatch(normal!.body, /focusBorder/);
		const normalFace = rules.find(candidate => candidate.selector.includes('.conversation-timeline-item:focus-visible::before'));
		assert.ok(normalFace, 'timeline article normal focus paints the inset face');
		assert.match(normalFace!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 3%, transparent\)/);
		const highContrast = collectCssRules(css).find(candidate =>
			candidate.selector.includes('.conversation-timeline-item:focus-visible') &&
			candidate.selector.includes(':is(.hc-black, .hc-light)'));
		assert.ok(highContrast, 'timeline article HC focus-visible keeps a contrast ring');
		assert.match(highContrast!.body, /contrastActiveBorder/);
	});

	test('timeline articles use the compact 16px inter-turn rhythm', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationTimeline.css'), 'utf8'));
		const rules = collectCssRules(css);
		const item = rules.find(candidate => candidate.selector.trim() === '.conversation-timeline-item');
		assert.ok(item, 'timeline item rhythm rule');
		assert.match(item!.body, /margin-bottom\s*:\s*var\(--vscode-spacing-size160,\s*16px\)/);
		assert.strictEqual(
			rules.find(candidate => candidate.selector.includes('.conversation-timeline-item:has') && candidate.selector.includes('data-kind="user"')),
			undefined,
			'user turns share the same outer rhythm; their bubble padding remains a turn-local contract',
		);
	});

	test('narrow SessionBar CSS shows More instead of New/Delete', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		assert.ok(!css.includes('.is-medium .conversation-lens-session-more'));
		assert.ok(css.includes('.is-narrow .conversation-lens-session-more'));
		assert.ok(css.includes('.is-narrow .conversation-lens-session-new'));
		assert.ok(css.includes('.is-narrow .conversation-lens-session-delete'));
	});

	test('lens tabs keep a 32px keyboard target while the visual surface stays inset', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const tab = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab');
		assert.ok(tab, 'lens tabs need a stable hit target');
		assert.match(tab!.body, /height\s*:\s*32px/);
		assert.match(tab!.body, /border-radius\s*:\s*var\(--vscode-cornerRadius-medium,\s*6px\)/);
		const surface = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab::before');
		assert.ok(surface, 'lens tabs need an inset visual surface');
		assert.match(surface!.body, /inset\s*:\s*4px\s+7px/);
		assert.match(surface!.body, /border-radius\s*:\s*var\(--vscode-cornerRadius-small,\s*4px\)/);
		assert.match(surface!.body, /background-color\s*:\s*transparent/);
		const hoverHost = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab:hover');
		assert.ok(hoverHost, 'lens tab hover must keep the host background transparent');
		assert.match(hoverHost!.body, /background-color\s*:\s*transparent/);
		const focusVisible = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab:focus-visible::before');
		assert.ok(focusVisible, 'lens tabs need an active focus surface');
		assert.match(focusVisible!.body, /background-color\s*:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.doesNotMatch(focusVisible!.body, /outline\s*:/);
		const focusHost = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab:focus-visible');
		assert.ok(focusHost, 'lens tab focus must keep the host background transparent');
		assert.match(focusHost!.body, /background-color\s*:\s*transparent/);
		const active = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab:active::before');
		assert.ok(active, 'lens tabs need a pressed surface');
		assert.match(active!.body, /background-color\s*:\s*var\(--vscode-toolbar-activeBackground/);
		const activeHost = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab:active');
		assert.ok(activeHost, 'lens tab pressed state must keep the host background transparent');
		assert.match(activeHost!.body, /background-color\s*:\s*transparent/);
		const hoverSurfaceOffset = css.indexOf('.monaco-workbench .part.conversation .conversation-lens-lens-tab:hover::before');
		const activeSurfaceOffset = css.indexOf('.monaco-workbench .part.conversation .conversation-lens-lens-tab:active::before');
		assert.ok(hoverSurfaceOffset >= 0 && activeSurfaceOffset > hoverSurfaceOffset, 'pressed tab surface must override hover while held');
		const selected = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab[aria-selected="true"]::before');
		assert.ok(selected, 'selected lens tabs need the same inset surface');
		assert.match(selected!.body, /background-color\s*:\s*var\(--vscode-toolbar-hoverBackground\)/);
		const selectedHost = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab[aria-selected="true"]');
		assert.ok(selectedHost, 'selected lens tabs must keep the host background transparent');
		assert.match(selectedHost!.body, /background-color\s*:\s*transparent/);
		const selectedSurfaceOffset = css.indexOf('.monaco-workbench .part.conversation .conversation-lens-lens-tab[aria-selected="true"]::before');
		assert.ok(selectedSurfaceOffset >= 0 && activeSurfaceOffset > selectedSurfaceOffset, 'pressed tab surface must override the selected surface while held');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.conversation \.conversation-lens-lens-tab::before\s*\{[^}]*transition\s*:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.conversation-lens-lens-tab::before\s*\{[^}]*transition\s*:\s*none/);
		assert.strictEqual(
			rules.find(rule => rule.selector.includes('.conversation-lens-lens-tab[aria-selected="true"]:focus-visible')),
			undefined,
			'selected lens tabs should share the same active background instead of adding a focus ring',
		);
	});

	test('session title uses the active background for keyboard focus while HC keeps a contrast ring', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const normal = rules.find(rule => rule.selector.includes('.monaco-workbench:not(.hc-black):not(.hc-light)') && rule.selector.includes('.conversation-lens-session-title:focus-visible'));
		assert.ok(normal, 'session title needs a normal-theme focus-visible state');
		assert.match(normal!.body, /outline\s*:\s*none\s*!important/);
		assert.match(normal!.body, /background-color\s*:\s*transparent/);
		assert.doesNotMatch(normal!.body, /focusBorder/);
		const normalFace = rules.find(rule => rule.selector.includes('.conversation-lens-session-title:focus-visible::before'));
		assert.ok(normalFace, 'session title focus paints an inset face');
		assert.match(normalFace!.body, /toolbar-hoverBackground/);
		const highContrast = rules.find(rule => rule.selector.includes('.monaco-workbench.hc-black') && rule.selector.includes('.conversation-lens-session-title:focus-visible'));
		assert.ok(highContrast, 'HC session title focus-visible ring must remain');
		assert.match(highContrast!.body, /contrastActiveBorder/);
	});

	test('session switcher uses the active background for keyboard focus while HC keeps a contrast ring', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const normal = rules.find(rule => rule.selector.includes('.monaco-workbench:not(.hc-black):not(.hc-light)') && rule.selector.includes('.conversation-lens-session-select .monaco-select-box:focus-visible'));
		assert.ok(normal, 'session switcher needs a normal-theme focus-visible state');
		assert.match(normal!.body, /outline\s*:\s*none\s*!important/);
		assert.match(normal!.body, /background-color\s*:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.doesNotMatch(normal!.body, /focusBorder/);
		const highContrast = rules.find(rule => rule.selector.includes('.monaco-workbench.hc-black') && rule.selector.includes('.conversation-lens-session-select .monaco-select-box:focus-visible'));
		assert.ok(highContrast, 'HC session switcher focus-visible ring must remain');
		assert.match(highContrast!.body, /contrastActiveBorder/);
	});

	test('SessionBar controls use a quiet keyboard surface while HC keeps a contrast ring', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const normal = rules.find(rule => rule.selector.includes('.conversation-lens-session-controls .monaco-button:focus-visible') && /background-color:\s*transparent\s*!important/.test(rule.body));
		assert.ok(normal, 'SessionBar controls need a normal-theme focus-visible state');
		assert.match(normal!.body, /outline\s*:\s*none\s*!important/);
		assert.match(normal!.body, /background-color\s*:\s*transparent\s*!important/);
		assert.doesNotMatch(normal!.body, /focusBorder/);
		const normalFace = rules.find(rule => rule.selector.includes('.conversation-lens-session-controls .monaco-button:focus-visible') && rule.selector.includes('::after'));
		assert.ok(normalFace, 'SessionBar controls focus paint an inset face');
		assert.match(normalFace!.body, /toolbar-hoverBackground/);
		assert.match(css, /conversation-lens-session-controls \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-session-controls \.monaco-button:active:not\(\.disabled\)\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-session-controls \.monaco-button:active:not\(\.disabled\)::after[\s\S]*?toolbar-activeBackground/s);
		const highContrast = rules.find(rule => rule.selector.includes('.monaco-workbench.hc-black') && rule.selector.includes('.conversation-lens-session-controls .monaco-button:focus-visible'));
		assert.ok(highContrast, 'HC SessionBar controls need a contrast focus ring');
		assert.match(highContrast!.body, /contrastActiveBorder/);
		assert.doesNotMatch(highContrast!.body, /var\(--vscode-focusBorder\)/);
	});

	test('ordinary SessionBar actions keep active paint on the inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const host = rules.find(rule => rule.selector.includes('.conversation-lens-session-new .monaco-button:active:not(.disabled)') && rule.selector.includes('.conversation-lens-session-history .monaco-button:active:not(.disabled)') && !rule.selector.includes('::after'));
		assert.ok(host, 'ordinary SessionBar actions need an explicit clear host while pressed');
		assert.match(host!.body, /background-color\s*:\s*transparent\s*!important/);
		assert.doesNotMatch(host!.body, /toolbar-activeBackground/);
		const face = rules.find(rule => rule.selector.includes('.conversation-lens-session-new .monaco-button:active:not(.disabled)::after') && rule.selector.includes('.conversation-lens-session-history .monaco-button:active:not(.disabled)::after'));
		assert.ok(face, 'ordinary SessionBar actions need an inset active face');
		assert.match(face!.body, /toolbar-activeBackground/);
		assert.doesNotMatch(face!.body, /errorForeground/);
	});

	test('history close keeps the codicon host clear while painting an inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		assert.match(css, /conversation-lens-history-close \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-history-close \.monaco-button:hover[\s\S]*?background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-history-close \.monaco-button:hover::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-history-close \.monaco-button:active\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-history-close \.monaco-button:active::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-history-close \.monaco-button::after[\s\S]*?transition:\s*none/);
	});

	test('SessionBar delete keeps error color semantics on its inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		assert.match(css, /conversation-lens-session-delete \.monaco-button:hover:not\(\.disabled\)\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-session-delete \.monaco-button:hover:not\(\.disabled\)::after[\s\S]*?errorForeground\) 16%/s);
		assert.match(css, /conversation-lens-session-delete \.monaco-button:active:not\(\.disabled\)\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-session-delete \.monaco-button:active:not\(\.disabled\)::after[\s\S]*?errorForeground\) 28%/s);
	});

	test('snapshots close keeps the codicon host clear while painting an inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		assert.match(css, /conversation-lens-snapshots-close \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-snapshots-close \.monaco-button:hover::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-snapshots-close \.monaco-button:focus-visible\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-snapshots-close \.monaco-button:focus-visible::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-snapshots-close \.monaco-button:active\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-snapshots-close \.monaco-button:active::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-snapshots-close \.monaco-button::after[\s\S]*?transition:\s*none/);
	});

	test('maximize CSS hides the Conversation tree, not the shared slot on Trajectory', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		assert.ok(css.includes('.conversation-lens-input-maximized:not(:has(.conversation-lens-phase-prefirst)) .conversation-lens-timeline'));
		assert.ok(css.includes('.conversation-lens-input-maximized:not(:has(.conversation-lens-phase-prefirst)):not(.conversation-lens-showing-trajectory)'));
		assert.ok(!/\.conversation-timeline\.conversation-lens-input-maximized:not\(:has\(\.conversation-lens-phase-prefirst\)\)\s*\{\s*display:\s*none;/.test(css));
	});

	test('maximize CSS does not display:none the dock gate-row or inbox overlay', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hits: string[] = [];
		for (const rule of collectCssRules(css)) {
			if (!hidesDisplayNone(rule.body)) {
				continue;
			}
			for (const selector of splitSelectorList(rule.selector)) {
				if (!selector.includes(MAXIMIZE_CLASS)) {
					continue;
				}
				const surface = stripFunctionalSelectors(selector);
				for (const cls of MAXIMIZE_MUST_NOT_HIDE) {
					if (surface.includes(cls)) {
						hits.push(`${cls} via ${selector.replace(/\s+/g, ' ')}`);
					}
				}
			}
		}
		assert.deepStrictEqual(hits, []);
	});

	test('medium leaf CSS keeps SessionBar History and Snapshots on the bar', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		assert.ok(!css.includes('.is-medium .conversation-lens-session-history'));
		assert.ok(!css.includes('.is-medium .conversation-lens-session-snapshots'));
		assert.ok(!css.includes('.is-narrow .conversation-window-nav'));
		assert.ok(!css.includes('.is-compact .conversation-window-nav'));
		assert.ok(css.includes('.is-narrow .conversation-lens-session-history'));
		assert.ok(css.includes('.conversation-agent-up'));
		assert.ok(css.includes('.conversation-agent-down'));
		assert.ok(!css.includes('.is-narrow .conversation-agent-up'));
		assert.ok(!css.includes('.is-narrow .conversation-agent-down'));
		assert.ok(!css.includes('.is-compact .conversation-agent-up'));
		assert.ok(!css.includes('.is-compact .conversation-agent-down'));
	});

	test('maximize CSS keeps inbox overlay and gate-row in document flow', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const overlayHits: string[] = [];
		let overlayShrink = false;
		let gateShrink = false;
		let clusterPadding32 = false;
		let clusterFlex = false;
		for (const rule of collectCssRules(css)) {
			if (!rule.selector.includes(MAXIMIZE_CLASS)) {
				continue;
			}
			for (const selector of splitSelectorList(rule.selector)) {
				const surface = stripFunctionalSelectors(selector);
				if (surface.includes('.conversation-lens-inbox-overlay')) {
					if (/position\s*:\s*absolute/.test(rule.body) || /z-index/.test(rule.body)) {
						overlayHits.push(selector.replace(/\s+/g, ' '));
					}
					if (/flex-shrink\s*:\s*0/.test(rule.body)) {
						overlayShrink = true;
					}
				}
				if (surface.includes('.conversation-lens-dock-gate-row') && /flex-shrink\s*:\s*0/.test(rule.body)) {
					gateShrink = true;
				}
				if (surface.includes('.conversation-lens-composer-cluster')) {
					if (/padding-top\s*:\s*32px/.test(rule.body)) {
						clusterPadding32 = true;
					}
					if (/flex\s*:\s*1/.test(rule.body) && /min-height\s*:\s*0/.test(rule.body)) {
						clusterFlex = true;
					}
				}
			}
		}
		assert.deepStrictEqual(overlayHits, []);
		assert.strictEqual(overlayShrink, true);
		assert.strictEqual(gateShrink, true);
		assert.strictEqual(clusterPadding32, false);
		assert.strictEqual(clusterFlex, true);
	});

	test('session unavailable gate warning is an icon, not a filled alert', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const warningRules = rules.filter(rule => rule.selector.includes('.conversation-lens-dock-gate-row.is-warning') && !rule.selector.includes('hc-black') && !rule.selector.includes('hc-light'));
		assert.ok(warningRules.length > 0);
		for (const rule of warningRules) {
			assert.ok(!/background-color/.test(rule.body), rule.selector);
			assert.ok(!/font-weight\s*:\s*600/.test(rule.body), rule.selector);
		}
		const warningIcon = rules.find(rule => rule.selector.includes('.conversation-lens-dock-gate-row.is-warning') && rule.selector.includes('.conversation-lens-dock-gate-icon'));
		assert.ok(warningIcon);
		assert.match(warningIcon!.body, /editorWarning-foreground/);
		const icon = rules.find(rule => {
			const selector = rule.selector.trim();
			return selector.endsWith('.conversation-lens-dock-gate-icon') && !selector.includes('.is-warning');
		});
		assert.ok(icon);
		assert.match(icon!.body, /font-size\s*:\s*16px/);
		const hiddenIcon = rules.find(rule => rule.selector.includes('.conversation-lens-dock-gate-icon[hidden]'));
		assert.ok(hiddenIcon);
		assert.match(hiddenIcon!.body, /display\s*:\s*none/);
	});

	test('timeline session pills stay within one reading line without changing composer chips', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessionPill.css'), 'utf8'));
		const rules = collectCssRules(css);
		const base = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation a.conversation-session-pill');
		assert.ok(base, 'session pill base rule');
		assert.match(base!.body, /min-height\s*:\s*22px/);
		assert.match(base!.body, /line-height\s*:\s*18px/);
		assert.match(base!.body, /position\s*:\s*relative/);
		assert.match(base!.body, /isolation\s*:\s*isolate/);
		const face = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation a.conversation-session-pill::before');
		assert.ok(face, 'session pills need an inset interaction face');
		assert.match(face!.body, /inset\s*:\s*1px\s+2px/);
		assert.match(face!.body, /pointer-events\s*:\s*none/);
		const hover = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation a.conversation-session-pill:hover');
		assert.ok(hover, 'session pill hover must keep its base chip surface');
		assert.match(hover!.body, /background\s*:\s*color-mix\(in srgb, var\(--vscode-foreground\) 6%/);
		const hoverFace = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation a.conversation-session-pill:hover::before');
		assert.ok(hoverFace, 'session pill hover needs an inset face');
		assert.match(hoverFace!.body, /background-color\s*:\s*color-mix\(in srgb, var\(--vscode-foreground\) 10%/);
		const active = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation a.conversation-session-pill:active');
		assert.ok(active, 'session pill active must keep its base chip surface');
		assert.match(active!.body, /background-color\s*:\s*color-mix\(in srgb, var\(--vscode-foreground\) 6%/);
		const activeFace = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation a.conversation-session-pill:active::before');
		assert.ok(activeFace, 'session pill active needs an inset face');
		assert.match(activeFace!.body, /background-color\s*:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.conversation a\.conversation-session-pill::before\s*\{[^}]*transition:\s*none/s);
		const compact = rules.find(rule => rule.selector.includes('.conversation-lens-turn-body--reading-text') && rule.selector.includes('a.conversation-session-pill'));
		assert.ok(compact, 'timeline session pills need a scoped compact rule');
		assert.match(compact!.body, /box-sizing\s*:\s*border-box/);
		assert.match(compact!.body, /min-height\s*:\s*20px/);
		assert.match(compact!.body, /line-height\s*:\s*16px/);
		assert.match(compact!.body, /font-size\s*:\s*var\(--vscode-fontSize-label1,\s*12px\)/);
		assert.match(compact!.body, /border-radius\s*:\s*var\(--vscode-cornerRadius-circle,\s*9999px\)/);
		const composerFocus = rules.find(rule => rule.selector.includes('.conversation-composer-ref-chip') && rule.selector.includes(':focus-visible') && rule.selector.includes(':not(.hc-black)'));
		assert.ok(composerFocus, 'composer reference links need a normal-theme focus surface');
		assert.match(composerFocus!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 6%/);
		assert.match(composerFocus!.body, /outline:\s*none/);
		const composerFocusFace = rules.find(rule => rule.selector.includes('.conversation-composer-ref-chip') && rule.selector.includes(':focus-visible::before') && rule.selector.includes(':not(.hc-black)'));
		assert.ok(composerFocusFace, 'composer reference links need an inset normal-theme focus face');
		assert.match(composerFocusFace!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 10%/);
		const composerHcFocus = rules.find(rule => rule.selector.includes('.conversation-composer-ref-chip') && rule.selector.includes(':focus-visible') && rule.selector.includes(':is(.hc-black, .hc-light)'));
		assert.ok(composerHcFocus, 'composer reference links keep a high-contrast focus ring');
		assert.match(composerHcFocus!.body, /contrastActiveBorder/);
	});

	test('trajectory table and engine nav rows stay 22px without uppercase kind chrome', () => {
		const lensCss = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const engineCss = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8'));
		const lensRules = collectCssRules(lensCss);
		const engineRules = collectCssRules(engineCss);

		const recordRow = lensRules.find(rule => rule.selector.includes('.conversation-lens-trajectory-record-row') && /height\s*:\s*22px/.test(rule.body));
		assert.ok(recordRow, 'trajectory record row must be 22px');
		const foldHeader = lensRules.find(rule => rule.selector.includes('.conversation-lens-trajectory .conversation-process-fold-header') && /height\s*:\s*22px/.test(rule.body));
		assert.ok(foldHeader, 'trajectory fold header must be 22px');
		assert.match(foldHeader!.body, /width:\s*100%/, 'trajectory fold header keeps the full row hit target');
		const foldFace = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-trajectory .conversation-process-fold-header::before'));
		assert.ok(foldFace, 'trajectory fold header needs an inset visual face');
		assert.match(foldFace!.body, /inset:\s*1px 4px/);
		const foldActiveFace = lensRules.find(rule => rule.selector.includes('.conversation-lens-trajectory .conversation-process-fold-header:active') && rule.selector.endsWith('::before'));
		assert.ok(foldActiveFace, 'trajectory fold header needs a pressed visual face');
		assert.match(foldActiveFace!.body, /toolbar-activeBackground/);
		const foldHoverIndex = lensCss.indexOf('.conversation-lens-trajectory .conversation-process-fold-header:hover::before');
		const foldFocusIndex = lensCss.indexOf('.conversation-lens-trajectory .conversation-process-fold-header:focus-visible::before');
		const foldActiveIndex = lensCss.indexOf('.conversation-lens-trajectory .conversation-process-fold-header:active:not([aria-disabled="true"]):not(:disabled)::before');
		assert.ok(foldHoverIndex >= 0 && foldFocusIndex >= 0 && foldActiveIndex > foldHoverIndex && foldActiveIndex > foldFocusIndex, 'trajectory fold pressed face must follow hover and focus faces');
		assert.match(lensCss, /\.monaco-workbench\.monaco-reduce-motion[^\{]*[\s\S]*?\.conversation-lens-trajectory \.conversation-process-fold-header::before[\s\S]*?transition:\s*none/, 'trajectory fold face honors workbench reduced-motion');
		assert.match(lensCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.conversation-lens-trajectory \.conversation-process-fold-header::before[\s\S]*?transition:\s*none/, 'trajectory fold face honors prefers-reduced-motion');
		const table = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-trajectory-table'));
		assert.ok(table);
		assert.match(table!.body, /flex\s*:\s*0\s+1\s+auto/);
		assert.match(table!.body, /max-height\s*:\s*100%/);
		const tableScroll = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-trajectory-table-scroll'));
		assert.ok(tableScroll);
		assert.match(tableScroll!.body, /height\s*:\s*fit-content/);
		assert.match(tableScroll!.body, /min-height\s*:\s*22px/);
		assert.match(tableScroll!.body, /max-height\s*:\s*100%/);

		const header = lensRules.find(rule => rule.selector.includes('.conversation-lens-trajectory-table-header'));
		assert.ok(header);
		assert.ok(!/text-transform\s*:\s*uppercase/.test(header!.body));
		assert.ok(!/editor-inactiveSelectionBackground/.test(header!.body));
		assert.ok(!/background-color\s*:/.test(header!.body));

		for (const rule of lensRules.filter(candidate => candidate.selector.includes('.conversation-lens-trajectory-table-kind'))) {
			assert.ok(!/text-transform\s*:\s*uppercase/.test(rule.body), rule.selector);
		}

		const turnHeader = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-turn-header'));
		assert.ok(turnHeader);
		assert.ok(!/text-transform\s*:\s*uppercase/.test(turnHeader!.body));
		const trajectoryRole = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-trajectory-role'));
		assert.ok(trajectoryRole);
		assert.ok(!/text-transform\s*:\s*uppercase/.test(trajectoryRole!.body));
		const inspectorTitle = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-trajectory-inspector-section-title'));
		assert.ok(inspectorTitle);
		assert.match(inspectorTitle!.body, /font-size:\s*var\(--vscode-fontSize-label1,\s*12px\)/);
		assert.ok(!/text-transform\s*:\s*uppercase/.test(inspectorTitle!.body));
		const inspectorState = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-trajectory-inspector-state'));
		assert.ok(inspectorState);
		assert.match(inspectorState!.body, /descriptionForeground\)\s*12%/);
		assert.ok(!/badge-background/.test(inspectorState!.body));
		assert.ok(!/text-transform\s*:\s*uppercase/.test(inspectorState!.body));

		const userBubble = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-turn-body--user-bubble') && /border\s*:/.test(rule.body));
		assert.ok(userBubble);
		assert.match(userBubble!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 8%, transparent\)/);
		assert.match(userBubble!.body, /input-background/);
		assert.match(userBubble!.body, /border-radius:\s*var\(--vscode-cornerRadius-large,\s*8px\)/);
		assert.ok(!/font-size\s*:/.test(userBubble!.body), 'user bubble inherits the 13px turn body');
		assert.match(userBubble!.body, /box-shadow:\s*none/);
		const userBubblePressFace = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-turn-body--user-bubble.conversation-lens-turn-body--clickable::before'));
		assert.ok(userBubblePressFace, 'clickable user bubble needs an inset visual face');
		assert.match(userBubblePressFace!.body, /inset:\s*1px/);
		const userBubblePress = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-turn-body--clickable:active::before'));
		assert.ok(userBubblePress, 'clickable user bubble needs a pressed face');
		assert.match(userBubblePress!.body, /toolbar-activeBackground/);
		assert.match(lensCss, /\.monaco-workbench\.monaco-reduce-motion[^\{]*\.part\.conversation[\s\S]*\.conversation-lens-turn-body--clickable::before[\s\S]*transition:\s*none/, 'user bubble pressed face honors the workbench reduced-motion override');
		assert.match(lensCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.conversation-lens-turn-body--clickable::before[\s\S]*transition:\s*none/, 'user bubble pressed face honors the prefers-reduced-motion override');
		const userBubbleHc = lensRules.find(rule => rule.selector.includes('.hc-black') && rule.selector.includes('.conversation-lens-turn-body--user-bubble') && /border:\s*1px solid var\(--vscode-contrastBorder\)/.test(rule.body));
		assert.ok(userBubbleHc, 'high contrast user bubble keeps a contrastBorder outline');
		const userBubbleFocus = lensRules.find(rule => rule.selector.includes('.monaco-workbench:not(.hc-black):not(.hc-light)') && rule.selector.includes('.conversation-lens-turn-body--user-bubble:focus-visible'));
		assert.ok(userBubbleFocus);
		assert.match(userBubbleFocus!.body, /outline:\s*none/);
		assert.ok(!/box-shadow\s*:\s*0/.test(userBubbleFocus!.body));
		const userBubbleFocusFace = lensRules.find(rule => rule.selector.includes('.conversation-lens-turn-body--user-bubble:focus-visible::before'));
		assert.ok(userBubbleFocusFace, 'user bubble focus keeps its compact visual face');
		assert.match(userBubbleFocusFace!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 3%/);
		const userTurn = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-turn--user'));
		assert.ok(userTurn);
		assert.match(userTurn!.body, /align-items\s*:\s*flex-end/);
		const userTrajectoryHeader = lensRules.find(rule => rule.selector.includes('.conversation-lens-turn--user .conversation-lens-turn-header:has(.conversation-lens-turn-header-trajectory)'));
		assert.ok(userTrajectoryHeader, 'user trajectory control should be positioned on the user bubble corner');
		assert.match(userTrajectoryHeader!.body, /position\s*:\s*absolute/);
		assert.match(userTrajectoryHeader!.body, /inset-block-start\s*:\s*var\(--vscode-spacing-size40/);
		assert.match(userTrajectoryHeader!.body, /inset-inline-end\s*:\s*var\(--vscode-spacing-size80/);
		assert.match(userTrajectoryHeader!.body, /z-index\s*:\s*1/);
		const userTrajectoryBubbleReserve = lensRules.find(rule => rule.selector.includes('.conversation-lens-turn--user:has(.conversation-lens-turn-header-trajectory)') && rule.selector.includes('.conversation-lens-turn-body--user-bubble'));
		assert.ok(userTrajectoryBubbleReserve, 'user bubble should reserve the trajectory control corner');
		assert.match(userTrajectoryBubbleReserve!.body, /padding-inline-end\s*:\s*calc\(16px\s*\+\s*22px\s*-\s*var\(--vscode-spacing-size80/);
		const userBubbleLayout = lensRules.find(rule => rule.selector.includes('.conversation-lens-turn--user') && rule.selector.includes('.conversation-lens-turn-body--user-bubble'));
		assert.ok(userBubbleLayout);
		assert.match(userBubbleLayout!.body, /align-self\s*:\s*flex-end/);
		assert.match(userBubbleLayout!.body, /width\s*:\s*fit-content/);
		assert.match(userBubbleLayout!.body, /max-width\s*:\s*82%/);
		assert.match(userBubbleLayout!.body, /margin-inline-start\s*:\s*auto/);

		const idleSelection = lensRules.find(rule => rule.selector.includes('.conversation-lens-trajectory-record-row--selected') && !rule.selector.includes(':focus') && rule.body.includes('inactiveSelectionBackground'));
		assert.ok(idleSelection);
		const focusSelection = lensRules.find(rule => rule.selector.includes('.monaco-list:focus') && rule.selector.includes('.conversation-lens-trajectory-record-row--selected'));
		assert.ok(focusSelection);
		assert.match(focusSelection!.body, /list-activeSelectionBackground/);

		const chip = lensRules.find(rule => rule.selector.trim().endsWith('.conversation-lens-trajectory-source-block'));
		assert.ok(chip);
		assert.match(chip!.body, /color-mix\(in srgb, var\(--vscode-textLink-foreground\) 12%/);
		assert.ok(!/badge-background/.test(chip!.body));

		const navRow = engineRules.find(rule => rule.selector.includes('.engine-preferences-nav-row') && /height\s*:\s*22px/.test(rule.body));
		assert.ok(navRow, 'engine nav row must be 22px');
		assert.match(navRow!.body, /border-radius\s*:\s*var\(--vscode-cornerRadius-small/);
		assert.match(navRow!.body, /position\s*:\s*relative/, 'nav row needs an anchored visual face without changing list flow');
		const navHover = engineRules.find(rule => rule.selector.includes('.engine-preferences-nav-row:hover'));
		assert.ok(navHover);
		assert.match(navHover!.body, /background-color:\s*transparent/);
		assert.match(engineCss, /\.engine-preferences-nav-row::before\s*\{[^}]*inset:\s*1px 4px/s);
		assert.match(engineCss, /\.engine-preferences-nav-row:active::before\s*\{[^}]*toolbar-activeBackground/s);
		const navSelected = engineRules.find(rule => rule.selector.trim().endsWith('.engine-preferences-nav-row.selected'));
		assert.ok(navSelected);
		assert.match(navSelected!.body, /var\(--vscode-list-inactiveSelectionBackground\)/);
		const navFocused = engineRules.find(rule => rule.selector.includes('.engine-preferences-nav .monaco-list:focus') && rule.selector.includes('.engine-preferences-nav-row.selected'));
		assert.ok(navFocused);
		assert.match(navFocused!.body, /var\(--vscode-list-activeSelectionBackground\)/);
		const badge = engineRules.find(rule => rule.selector.trim().endsWith('.engine-preferences-nav-badge'));
		assert.ok(badge);
		assert.match(badge!.body, /background\s*:\s*none/);
		assert.match(badge!.body, /margin-left\s*:\s*auto/);
		assert.ok(!/badge-background/.test(badge!.body));
	});

	test('trajectory overview segments keep a distinct color for each kind', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const kinds = ['user', 'assistant', 'reasoning', 'tool', 'permission', 'compacted', 'error'];
		const colors: string[] = [];
		for (const kind of kinds) {
			const segment = rules.find(candidate => splitSelectorList(candidate.selector).some(selector => selector.replace(/\s+/g, ' ').trim().endsWith(`[data-segment-kind="${kind}"]`))
				&& /background-color\s*:/.test(candidate.body)
				&& !candidate.selector.includes('glyph'));
			assert.ok(segment, `missing segment color for ${kind}`);
			const color = segment!.body.match(/background-color\s*:\s*([^;]+)/)?.[1]?.trim();
			assert.ok(color, kind);
			colors.push(color!);
		}
		assert.strictEqual(new Set(colors).size, colors.length, colors.join(' | '));
	});

	test('S5 composer tokens and single-line layout rules', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const rule = (selectorIncludes: string, bodyIncludes?: string) => rules.find(candidate => {
			if (!candidate.selector.includes(selectorIncludes)) {
				return false;
			}
			return bodyIncludes === undefined || candidate.body.includes(bodyIncludes);
		});

		// 1. Composer card: 24px radius, 8% hairline, input fill, faint widget shadow
		const composer = rules.find(candidate => candidate.selector.trim().endsWith('.conversation-lens-composer') && /border-radius/.test(candidate.body));
		assert.ok(composer);
		assert.match(composer!.body, /border:\s*1px solid color-mix\(in srgb, var\(--vscode-foreground\) 8%, transparent\)/);
		assert.match(composer!.body, /input-background/);
		assert.match(composer!.body, /--conversation-composer-radius:\s*24px/);
		assert.match(composer!.body, /border-radius:\s*var\(--conversation-composer-radius,\s*24px\)/);
		assert.match(composer!.body, /var\(--vscode-widget-shadow\)/);
		assert.ok(!/rgba\(/.test(composer!.body), 'composer card must not use hardcoded rgba in border or shadow');
		assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(composer!.body), 'composer card must not hardcode a hex color');

		// 2. Focus deepens the hairline and the existing shadow. No 3px ring, no focusBorder.
		const focus = rule('.conversation-lens-composer:has(.conversation-lens-dock-input:focus-visible)');
		assert.ok(focus);
		assert.ok(focus!.selector.includes('.conversation-lens-composer:focus-within'));
		assert.match(focus!.body, /border-color:\s*color-mix\(in srgb, var\(--vscode-foreground\) 10%, transparent\)/);
		assert.match(focus!.body, /var\(--vscode-widget-shadow\)/);
		assert.ok(!/0\s+0\s+0\s+3px/.test(focus!.body));
		assert.ok(!/rgba\(/.test(focus!.body), 'composer focus state must not use hardcoded rgba');
		assert.ok(!/focusBorder/.test(focus!.body));
		for (const candidate of rules) {
			if (!candidate.selector.includes('.conversation-lens-composer')) {
				continue;
			}
			if (!/:focus|:focus-within|:focus-visible/.test(candidate.selector)) {
				continue;
			}
			assert.ok(!/0\s+0\s+0\s+3px/.test(candidate.body), candidate.selector);
		}

		// 3. No dark-theme override with hardcoded rgba
		const darkComposer = rules.find(candidate => candidate.selector.includes('.vs-dark') && candidate.selector.includes('.conversation-lens-composer'));
		assert.strictEqual(darkComposer, undefined, 'no vs-dark hardcoded rgba override for composer');

		// 4. Empty draft keeps a one-line field. Controls stay on the bar under it.
		const singleLine = rule('.conversation-lens-composer.is-single-line', 'flex-direction: column');
		assert.ok(singleLine, 'missing .conversation-lens-composer.is-single-line rule');
		assert.match(singleLine!.body, /align-items:\s*stretch/);
		assert.match(singleLine!.body, /border-radius:\s*var\(--conversation-composer-radius,\s*24px\)/);
		assert.ok(!/display:\s*contents/.test(singleLine!.body));

		const input = rules.find(candidate => candidate.selector.includes('.conversation-lens-composer.is-single-line .conversation-lens-dock-input') && !candidate.selector.includes('.conversation-lens-dock-input-row'));
		assert.ok(input);
		assert.match(input!.body, /min-height:\s*48px/);
		assert.match(input!.body, /max-height:\s*48px/);
		assert.match(input!.body, /line-height:\s*24px/);
		assert.ok(!/(?:^|;)\s*height:\s*24px/.test(input!.body));
		assert.ok(!/display:\s*contents/.test(css), 'single-line no longer flattens the toolbar onto the field');
	});

	test('composer card uses a 24px shell and a 28px neutral send control', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const dock = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensDock.ts'), 'utf8');
		const rules = collectCssRules(css);
		const rule = (selectorIncludes: string, bodyIncludes?: string) => collectCssRules(css).find(candidate => {
			if (!candidate.selector.includes(selectorIncludes)) {
				return false;
			}
			return bodyIncludes === undefined || candidate.body.includes(bodyIncludes);
		});

		const cluster = rule('.conversation-lens-composer-cluster', 'padding:');
		assert.ok(cluster);
		assert.match(cluster!.body, /padding:\s*8px 16px 16px\s*;/);
		assert.ok(!/42px/.test(cluster!.body));

		const composer = collectCssRules(css).find(candidate => candidate.selector.trim().endsWith('.conversation-lens-composer') && /border-radius/.test(candidate.body));
		assert.ok(composer);
		assert.match(composer!.body, /border-radius:\s*var\(--conversation-composer-radius,\s*24px\)/);
		assert.match(composer!.body, /box-shadow:\s*0 2px 4px/);
		assert.match(composer!.body, /input-background/);

		const field = rule('.conversation-lens-dock-input', 'padding: 8px 36px 8px 12px');
		assert.ok(field);

		const focus = rule('.conversation-lens-composer:has(.conversation-lens-dock-input:focus-visible)');
		assert.ok(focus);
		assert.match(focus!.body, /box-shadow/);
		assert.ok(!/0\s+0\s+0\s+3px/.test(focus!.body));
		assert.ok(!/focusBorder/.test(focus!.body));

		const badge = rule('.conversation-lens-dock-maximize-input', 'top: 4px');
		assert.ok(badge);
		assert.match(badge!.body, /right:\s*8px/);

		const maximizeButton = rule('.conversation-lens-dock-maximize-input-button.monaco-button', 'width: 22px');
		assert.ok(maximizeButton);
		assert.match(maximizeButton!.body, /font-size:\s*16px/);
		assert.match(css, /conversation-lens-dock-maximize-input-button\.monaco-button::after\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-dock-maximize-input-button\.monaco-button:hover[\s\S]*?background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-dock-maximize-input-button\.monaco-button:hover::after[\s\S]*?color-mix\(in srgb, var\(--vscode-foreground\) 9%/s);
		assert.match(css, /conversation-lens-dock-maximize-input-button\.monaco-button:active:not\(\.disabled\)[\s\S]*?background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-dock-maximize-input-button\.monaco-button:active:not\(\.disabled\)::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-dock-maximize-input-button\.monaco-button::after[\s\S]*?transition:\s*none/);
		assert.ok(css.includes('.conversation-lens-composer--in-turn .conversation-lens-dock-bottom-leading'));
		assert.ok(css.includes('.conversation-lens-composer--in-turn .conversation-lens-dock-model'));
		assert.ok(css.includes('.conversation-lens-composer--in-turn .conversation-lens-dock-maximize-input'));
		assert.ok(css.includes('.conversation-lens-composer-cluster:not(:has(.conversation-lens-composer))'));
		assert.ok(css.includes('.conversation-lens-turn-edit-host'));

		const bar = rule('.conversation-lens-dock-bottom-bar', 'min-height: 40px');
		assert.ok(bar);
		assert.match(bar!.body, /padding:\s*4px 8px 8px\s*;/);
		assert.match(bar!.body, /gap:\s*8px/);

		const send = rule('.conversation-lens-dock-send-button.monaco-button', 'width: 28px');
		assert.ok(send);
		assert.match(send!.body, /height:\s*28px/);
		assert.match(send!.body, /min-width:\s*28px/);
		assert.match(send!.body, /min-height:\s*28px/);
		assert.match(send!.body, /background-color:\s*var\(--vscode-foreground\)/);
		assert.ok(!/button-background/.test(send!.body));
		assert.ok(!/rgb\(/.test(send!.body) && !/#fff/.test(send!.body));
		// Button paints inline background/foreground from its styles, which would beat the class rule.
		const sendCtor = dock.slice(dock.indexOf('host.sendButton = '), dock.indexOf('host.sendButton.icon'));
		assert.match(sendCtor, /\.\.\.ghostButtonStyles/);
		assert.ok(!/defaultButtonStyles/.test(sendCtor));

		const tune = rule('.conversation-lens-dock-tune .conversation-lens-dock-control--ghost.monaco-button');
		assert.strictEqual(tune, undefined, 'the tune control stays a ghost button with no fill');

		const sendDisabled = rule('.conversation-lens-dock-send-button.monaco-button.disabled');
		assert.ok(sendDisabled);
		assert.match(sendDisabled!.body, /opacity:\s*0\.25/);
		assert.ok(!/foreground\)\s*18%/.test(sendDisabled!.body));
		const sendSection = css.slice(css.indexOf('.conversation-lens-dock-send-button'), css.indexOf('.conversation-lens-dock-permission'));
		assert.ok(!/filter\s*:/.test(sendSection));
		assert.ok(!/transform\s*:/.test(sendSection));

		const select = rule('.conversation-lens-dock-model .monaco-select-box', 'border:');
		assert.ok(select);
		assert.match(select!.body, /border:\s*none\s*!important/);
		const selectDisabled = rule('.conversation-lens-dock-model .monaco-select-box:disabled');
		assert.ok(selectDisabled);
		assert.match(selectDisabled!.body, /disabledForeground/);

		const normalControlFocus = rule('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-lens-dock-control--ghost.monaco-button:focus-visible');
		assert.ok(normalControlFocus);
		assert.match(normalControlFocus!.body, /outline:\s*none/);
		assert.match(normalControlFocus!.body, /toolbar-hoverBackground/);
		assert.ok(!/focusBorder/.test(normalControlFocus!.body));
		const highContrastControlFocus = rule('.monaco-workbench.hc-black .part.conversation .conversation-lens-dock-control.monaco-button:focus-visible');
		assert.ok(highContrastControlFocus);
		assert.match(highContrastControlFocus!.body, /contrastActiveBorder/);
		const normalSendFocus = rule('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-lens-dock-send-button.monaco-button:focus-visible');
		assert.ok(normalSendFocus);
		assert.match(normalSendFocus!.body, /outline:\s*none/);
		assert.match(normalSendFocus!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 85%/);

		const ghostPresses = rules.filter(candidate => candidate.selector.includes('.conversation-lens-dock-control--ghost.monaco-button:active:not(.disabled)'));
		assert.ok(ghostPresses.length > 0);
		assert.match(ghostPresses.at(-1)!.body, /toolbar-activeBackground/);
		const sendPresses = rules.filter(candidate => candidate.selector.includes('.conversation-lens-dock-send-button.monaco-button:active:not(.disabled)'));
		assert.ok(sendPresses.length > 0);
		assert.match(sendPresses.at(-1)!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 75%/);
		const sendHoverIndex = rules.findIndex(candidate => candidate.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-dock-send-button.monaco-button:hover:not(.disabled)');
		const sendFocusIndex = rules.findIndex(candidate => candidate.selector.trim() === '.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-lens-dock-send-button.monaco-button:focus-visible');
		const sendActiveIndex = rules.findIndex(candidate => candidate.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-dock-send-button.monaco-button:active:not(.disabled)');
		assert.ok(sendHoverIndex >= 0 && sendFocusIndex >= 0 && sendActiveIndex > sendHoverIndex && sendActiveIndex > sendFocusIndex, 'send pressed surface must follow hover and keyboard focus surfaces');
		const maximizePress = rule('.conversation-lens-dock-maximize-input .conversation-lens-dock-maximize-input-button.monaco-button:active:not(.disabled)');
		assert.ok(maximizePress, 'maximize control needs a distinct pressed surface');
		assert.match(maximizePress!.body, /background-color:\s*transparent/);
		const maximizePressFace = rule('.conversation-lens-dock-maximize-input .conversation-lens-dock-maximize-input-button.monaco-button:active:not(.disabled)::after');
		assert.ok(maximizePressFace, 'maximize control pressed surface is inset');
		assert.match(maximizePressFace!.body, /toolbar-activeBackground/);
		const atOptionHover = rule('.conversation-composer-at-option:not(.is-active):hover:not(:disabled)');
		assert.ok(atOptionHover, '@ mention options need a pointer hover surface');
		assert.match(atOptionHover!.body, /background:\s*transparent/);
		const atOptionHoverFace = rule('.conversation-composer-at-option:not(.is-active):hover:not(:disabled)::before');
		assert.ok(atOptionHoverFace, '@ mention hover paints an inset face');
		assert.match(atOptionHoverFace!.body, /list-hoverBackground/);
		const atOptionPress = rule('.conversation-composer-at-option:not(.is-active):active:not(:disabled)');
		assert.ok(atOptionPress, '@ mention options need a pressed surface');
		assert.match(atOptionPress!.body, /background:\s*transparent/);
		const atOptionPressFace = rule('.conversation-composer-at-option:not(.is-active):active:not(:disabled)::before');
		assert.ok(atOptionPressFace, '@ mention press paints an inset face');
		assert.match(atOptionPressFace!.body, /toolbar-activeBackground/);
		const refRemoveFocus = rule('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-composer-ref-remove:focus-visible');
		assert.ok(refRemoveFocus, 'reference remove needs a normal-theme focus surface');
		assert.match(refRemoveFocus!.body, /outline:\s*none/);
		assert.match(refRemoveFocus!.body, /background-color:\s*transparent/);
		assert.ok(!/focusBorder/.test(refRemoveFocus!.body));
		const refRemoveFocusFace = rule('.monaco-workbench .part.conversation .conversation-composer-ref-remove:focus-visible::before');
		assert.ok(refRemoveFocusFace, 'reference remove focus paints an inset face');
		assert.match(refRemoveFocusFace!.body, /toolbar-hoverBackground/);
		const refRemoveHcFocus = rule('.monaco-workbench.hc-black .part.conversation .conversation-composer-ref-remove:focus-visible');
		assert.ok(refRemoveHcFocus, 'reference remove keeps a high-contrast focus ring');
		assert.match(refRemoveHcFocus!.body, /contrastActiveBorder/);
		const normalSelectFocus = rule('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-lens-dock-model .monaco-select-box:focus-visible');
		assert.ok(normalSelectFocus, 'composer selectors need a normal-theme focus surface');
		assert.match(normalSelectFocus!.body, /outline:\s*none\s*!important/);
		assert.match(normalSelectFocus!.body, /toolbar-hoverBackground/);
		assert.ok(!/focusBorder/.test(normalSelectFocus!.body));
		const hcSelectFocus = rule('.monaco-workbench.hc-black .part.conversation .conversation-lens-dock-model .monaco-select-box:focus-visible');
		assert.ok(hcSelectFocus, 'composer selectors keep a high-contrast focus ring');
		assert.match(hcSelectFocus!.body, /contrastActiveBorder/);
		const normalPopupFocus = rule('.monaco-workbench:not(.hc-black):not(.hc-light) .conversation-lens-dock-add-popup .conversation-lens-dock-add-option:not(:disabled):not([aria-disabled="true"]):focus-visible');
		assert.ok(normalPopupFocus, 'composer popup options need a normal-theme focus surface');
		assert.match(normalPopupFocus!.body, /outline:\s*none/);
		assert.ok(!/focusBorder/.test(normalPopupFocus!.body));
		const hcPopupFocus = rule('.monaco-workbench:is(.hc-black, .hc-light) .conversation-lens-dock-add-popup .conversation-lens-dock-add-option:not(:disabled):not([aria-disabled="true"]):focus-visible');
		assert.ok(hcPopupFocus, 'composer popup options keep a high-contrast focus ring');
		assert.match(hcPopupFocus!.body, /contrastActiveBorder/);
		const tuneOpenFocus = rule('.monaco-workbench .conversation-lens-dock-tune-popup .conversation-lens-dock-tune-open:focus-visible');
		assert.ok(tuneOpenFocus, 'tune popup open action needs a visible focus surface');
		assert.match(tuneOpenFocus!.body, /background:\s*transparent/);
		assert.match(tuneOpenFocus!.body, /outline:\s*none/);
		const tuneOpenFocusFace = rule('.monaco-workbench .conversation-lens-dock-tune-popup .conversation-lens-dock-tune-open:focus-visible::before');
		assert.ok(tuneOpenFocusFace, 'tune popup focus paints an inset face');
		assert.match(tuneOpenFocusFace!.body, /toolbar-hoverBackground/);
		const tuneOpenPress = rule('.monaco-workbench .conversation-lens-dock-tune-popup .conversation-lens-dock-tune-open:active:not(:disabled)');
		assert.ok(tuneOpenPress, 'tune popup open action needs a pressed surface');
		assert.match(tuneOpenPress!.body, /background:\s*transparent/);
		const tuneOpenPressFace = rule('.monaco-workbench .conversation-lens-dock-tune-popup .conversation-lens-dock-tune-open:active:not(:disabled)::before');
		assert.ok(tuneOpenPressFace, 'tune popup press paints an inset face');
		assert.match(tuneOpenPressFace!.body, /toolbar-activeBackground/);
		const hcTuneOpenFocus = rule('.monaco-workbench:is(.hc-black, .hc-light) .conversation-lens-dock-tune-popup .conversation-lens-dock-tune-open:focus-visible');
		assert.ok(hcTuneOpenFocus, 'tune popup open action keeps a high-contrast focus ring');
		assert.match(hcTuneOpenFocus!.body, /contrastActiveBorder/);

		assert.ok(!dock.includes('newWorktree'));
		assert.ok(!dock.includes('conversation-lens-dock-worktree'));
	});

	test('composer popovers use the popover radius and widget shadow tokens', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const popovers = collectCssRules(css).filter(candidate => /conversation-lens-dock-(tune|more|add|templates)-popup/.test(candidate.selector));
		assert.ok(popovers.length > 0);
		for (const popover of popovers) {
			const radius = popover.body.match(/border-radius\s*:\s*([^;]+)/)?.[1]?.trim();
			if (radius) {
				assert.ok(/^(0|[0-4]px)$/.test(radius) || /^var\(--vscode-cornerRadius-(large|small)/.test(radius), `${popover.selector}: ${radius}`);
			}
			const shadow = popover.body.match(/box-shadow\s*:\s*([^;]+)/)?.[1];
			if (shadow) {
				assert.match(shadow, /var\(--vscode-widget-shadow/, popover.selector);
			}
			const isContainer = splitSelectorList(popover.selector).every(selector => /-popup$/.test(selector.trim()));
			assert.ok(!isContainer || !/font-size\s*:\s*\d/.test(popover.body), `${popover.selector} uses a font-size token`);
		}
		assert.ok(!/font-size\s*:\s*12\.5px/.test(css));
	});

	test('history, snapshots, and inbox panels use popover radius and widget shadow tokens (S7)', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		for (const cls of ['.conversation-lens-history-panel', '.conversation-lens-snapshots-panel', '.conversation-lens-inbox-list-panel']) {
			const panel = rules.find(candidate => candidate.selector.includes(cls));
			assert.ok(panel, `missing rule for ${cls}`);
			const radius = panel.body.match(/border-radius\s*:\s*([^;]+)/)?.[1]?.trim();
			assert.ok(radius, `missing border-radius for ${cls}`);
			assert.match(radius, /^var\(--vscode-cornerRadius-large/);
			assert.ok(!/12px/.test(radius), `${cls} must not use hardcoded 12px`);
			const shadow = panel.body.match(/box-shadow\s*:\s*([^;]+)/)?.[1]?.trim();
			assert.ok(shadow, `missing box-shadow for ${cls}`);
			assert.match(shadow, /var\(--vscode-widget-shadow\)/);
			assert.ok(!/rgba\(/.test(shadow), `${cls} must not use hardcoded rgba shadow`);
		}
	});

	test('sync badge max-width is 28ch by default and 12ch when narrow or compact', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		let defaultMax = '';
		let narrowMax = '';
		let compactMax = '';
		for (const rule of collectCssRules(css)) {
			for (const selector of splitSelectorList(rule.selector)) {
				const surface = selector.replace(/\s+/g, ' ');
				if (!surface.includes('.conversation-lens-session-sync-badge')) {
					continue;
				}
				const maxWidth = rule.body.match(/max-width\s*:\s*([^;]+)/)?.[1]?.trim() ?? '';
				if (!maxWidth) {
					continue;
				}
				if (surface.includes('.is-narrow')) {
					narrowMax = maxWidth;
				} else if (surface.includes('.is-compact')) {
					compactMax = maxWidth;
				} else {
					defaultMax = maxWidth;
				}
			}
		}
		assert.strictEqual(defaultMax, '28ch');
		assert.strictEqual(narrowMax, '12ch');
		assert.strictEqual(compactMax, '12ch');
	});

	test('conversation contrib has no fake voice transcript or stub Route chrome', () => {
		const contribRoot = path.join(repoRoot, 'src/vs/workbench/contrib/conversation');
		const files: string[] = [];
		const walk = (dir: string) => {
			for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
				const full = path.join(dir, entry.name);
				if (entry.isDirectory()) {
					if (entry.name === 'test') {
						continue;
					}
					walk(full);
					continue;
				}
				if (/\.(ts|css)$/.test(entry.name)) {
					files.push(full);
				}
			}
		};
		walk(contribRoot);
		const forbidden = [
			'getUserMedia',
			'MediaRecorder',
			'STUB_VOICE_TRANSCRIPT_PHRASES',
			'durationLabel: \'0:01\'',
			'Stub voice segment',
			'Stub Balanced',
			'finishVoiceClip',
			'conversation-lens-dock-mic',
			'conversation-lens-dock-route',
			'conversation-lens-session-route',
			'conversation-lens-voice-transcript-bar',
			'Stub agent',
			'Stub model',
			'dockStubAgent',
			'dockStubModel',
		];
		const hits: string[] = [];
		for (const file of files) {
			const rel = path.relative(contribRoot, file);
			const text = fs.readFileSync(file, 'utf8');
			for (const needle of forbidden) {
				if (text.includes(needle)) {
					hits.push(`${rel}: ${needle}`);
				}
			}
		}
		assert.deepStrictEqual(hits, []);
	});
});

suite('UA chrome review follow-up - 接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('PreferencesEditor caches panes instead of disposing on tab switch', () => {
		const editor = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/preferences/browser/preferencesEditor.ts'), 'utf8');
		assert.ok(editor.includes('paneCache'));
		assert.ok(editor.includes('onDidShow?.()'));
		assert.ok(!editor.includes('DOM.clearNode(this.bodyElement)'));
		assert.ok(!editor.includes('this.preferencesEditorPane.value = undefined'));
	});

	test('Connection SAS traps Tab and reserves nav height when remounted to pane root', () => {
		const sas = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/connectionPreferencesPaneSas.ts'), 'utf8');
		const pane = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts'), 'utf8');
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/connectionPreferencesPane.css'), 'utf8');
		assert.ok(sas.includes('handleConversationOverlayTab'));
		assert.ok(sas.includes('confirmButton.focus()'));
		assert.ok(pane.includes('sasReserve'));
		assert.ok(pane.includes('revealAndFocusPairingConfirm'));
		assert.ok(pane.includes('inferPairingZone'));
		assert.ok(css.includes('.connection-pairing-confirm-host'));
		assert.ok(css.includes('flex-shrink: 0'));
	});

	test('region hide control uses a remove glyph and stays keyboard focusable', () => {
		const hide = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/partRegionHideControl.ts'), 'utf8');
		assert.ok(hide.includes('Codicon.remove'));
		assert.ok(hide.includes('actionBar.setFocusable(true)'));
		assert.ok(!hide.includes('Codicon.close'));
		assert.ok(!hide.includes('actionBar.setFocusable(false)'));
	});

	test('timeline overlays stay in the timeline containing block above the dock', () => {
		const partCss = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/conversationPart.css'), 'utf8'));
		const visualizeCss = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationVisualize.css'), 'utf8'));
		const overlayCss = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSubAgentOverlay.css'), 'utf8'));
		const contribution = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationSessionChat.contribution.ts'), 'utf8');
		const binding = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts'), 'utf8');
		let timelineRelative = false;
		let dockStacked = false;
		for (const rule of collectCssRules(partCss)) {
			for (const selector of splitSelectorList(rule.selector)) {
				const surface = selector.replace(/\s+/g, ' ');
				if (surface.endsWith('.conversation-timeline') && /position\s*:\s*relative/.test(rule.body)) {
					timelineRelative = true;
				}
				if (surface.endsWith('.conversation-dock') && /position\s*:\s*relative/.test(rule.body) && /z-index\s*:\s*30/.test(rule.body)) {
					dockStacked = true;
				}
			}
		}
		assert.strictEqual(timelineRelative, true);
		assert.strictEqual(dockStacked, true);
		assert.ok(/\.part\.conversation \.conversation-visualize-overlay[\s\S]*inset\s*:\s*0/.test(visualizeCss));
		assert.ok(overlayCss.includes('.conversation-timeline'));
		assert.ok(overlayCss.includes('position: relative'));
		assert.ok(!visualizeCss.includes('backdrop-filter'), 'visualize overlay must not blur');
		assert.ok(!/box-shadow/.test(collectCssRules(visualizeCss).find(candidate => candidate.selector.includes('.conversation-visualize-option--recommended'))!.body));
		const visualizeOption = collectCssRules(visualizeCss).find(candidate => splitSelectorList(candidate.selector).some(selector => flatSelector(selector).endsWith('.conversation-visualize-option')));
		assert.ok(visualizeOption && !/transition\s*:[^;]*box-shadow/.test(visualizeOption.body), 'option transition must not include box-shadow');
		assert.ok(!overlayCss.includes('backdrop-filter'), 'subagent overlay must not blur');
		assert.ok(contribution.includes("querySelector('.conversation-timeline')"));
		assert.ok(binding.includes('host: host.slotHosts.timeline'));
	});

	test('agent picker menu items keep a usable target and pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const item = rules.find(rule => rule.selector.trim() === '.monaco-workbench .conversation-agent-down-popup .conversation-agent-down-item');
		assert.ok(item, 'agent picker items need a stable menu target');
		assert.match(item!.body, /padding:\s*4px\s+12px/);
		assert.match(item!.body, /line-height:\s*20px/);
		const hoverIndex = css.indexOf('.conversation-agent-down-popup .conversation-agent-down-item:hover');
		const focusIndex = css.indexOf('.conversation-agent-down-popup .conversation-agent-down-item:focus-visible');
		const activeIndex = css.indexOf('.conversation-agent-down-popup .conversation-agent-down-item:active');
		assert.ok(hoverIndex >= 0, 'agent picker items need a hover surface');
		assert.ok(focusIndex >= 0, 'agent picker items need a keyboard focus surface');
		assert.ok(activeIndex >= 0, 'agent picker items need a pressed surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex, 'pressed menu surface must follow hover and keyboard focus surfaces');
		const active = rules.find(rule => rule.selector.trim() === '.monaco-workbench .conversation-agent-down-popup .conversation-agent-down-item:active');
		assert.ok(active, 'agent picker pressed surface rule');
		assert.match(active!.body, /toolbar-activeBackground/);
	});

	test('trajectory overview toggle keeps pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTrajectory.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-trajectory-overview-toggle/, 'overview toggle stays a native button');
		assert.match(css, /conversation-lens-trajectory-overview-toggle::before\s*\{[^}]*inset:\s*1px 2px/s);
		const hoverIndex = css.indexOf('.conversation-lens-trajectory-overview-toggle:hover');
		const focusIndex = css.indexOf('.conversation-lens-trajectory-overview-toggle:focus-visible');
		const hcFocusIndex = css.indexOf('.monaco-workbench:is(.hc-black, .hc-light) .part.conversation .conversation-lens-trajectory-overview-toggle:focus-visible');
		const activeIndex = css.indexOf('.conversation-lens-trajectory-overview-toggle:active');
		assert.ok(hoverIndex >= 0, 'trajectory overview toggle needs a hover surface');
		assert.ok(focusIndex >= 0 && hcFocusIndex >= 0, 'trajectory overview toggle needs normal and high-contrast focus surfaces');
		assert.ok(activeIndex >= 0, 'trajectory overview toggle needs a pressed surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex && activeIndex > hcFocusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		assert.match(css, /conversation-lens-trajectory-overview-toggle:hover\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-overview-toggle:hover::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-trajectory-overview-toggle:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-overview-toggle:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-trajectory-overview-toggle::before[\s\S]*?transition:\s*none/);
	});

	test('trajectory overview segments keep interaction surfaces above per-kind colors', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const kindIndices = [...css.matchAll(/\.conversation-lens-trajectory-overview-segment\[data-segment-kind=/g)].map(match => match.index ?? -1);
		const kindSurfaceEnd = Math.max(...kindIndices);
		const hoverIndex = css.indexOf('.conversation-lens-trajectory-overview-segment:hover');
		const selectedIndex = css.indexOf('.conversation-lens-trajectory-overview-segment.conversation-lens-trajectory-overview-segment--active');
		const activeIndex = css.indexOf('.conversation-lens-trajectory-overview-segment:active');
		const focusVisibleIndex = css.indexOf('.conversation-lens-trajectory-overview-segment:focus-visible');
		assert.ok(kindSurfaceEnd >= 0, 'trajectory overview segments need per-kind base surfaces');
		assert.ok(hoverIndex > kindSurfaceEnd, 'segment hover surface must follow per-kind base colors');
		assert.ok(selectedIndex > kindSurfaceEnd, 'segment selected surface must follow per-kind base colors');
		assert.ok(activeIndex > selectedIndex, 'segment pressed surface must follow the selected surface');
		assert.ok(focusVisibleIndex > activeIndex, 'segment focus ring must follow the pressed surface');
		assert.match(css, /conversation-lens-trajectory-overview-segment::before\s*\{[^}]*inset:\s*-6px 0/s, 'segment keeps its expanded pointer hit area');
		assert.match(css, /conversation-lens-trajectory-overview-segment::after\s*\{[^}]*inset:\s*1px 0/s, 'segment focus uses a compact visual face');
		const normalFocusIndex = css.indexOf('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-lens-trajectory-overview-segment:focus-visible');
		assert.ok(normalFocusIndex >= 0, 'normal segment focus rule');
		const normalFocusBlock = css.slice(normalFocusIndex, css.indexOf('}', normalFocusIndex) + 1);
		assert.match(normalFocusBlock, /outline:\s*none\s*!important/, 'normal segment focus avoids focusBorder');
		assert.match(css, /conversation-lens-trajectory-overview-segment:focus-visible::after[\s\S]*?\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 12%/s, 'normal segment focus paints compact background');
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-lens-trajectory-overview-segment:focus-visible[\s\S]*?\{[^}]*contrastActiveBorder/s, 'HC segment focus keeps contrast ring');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-lens-trajectory-overview-segment::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-trajectory-overview-segment::after[\s\S]*?transition:\s*none/);
	});

	test('composer selectors keep pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-dock-permission .monaco-select-box:hover:not(:disabled)');
		const focusIndex = css.indexOf('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-lens-dock-permission .monaco-select-box:focus-visible');
		const hcFocusIndex = css.indexOf('.monaco-workbench.hc-black .part.conversation .conversation-lens-dock-permission .monaco-select-box:focus-visible');
		const activeIndex = css.indexOf('.conversation-lens-dock-permission .monaco-select-box:active');
		assert.ok(hoverIndex >= 0, 'composer selectors need a hover surface');
		assert.ok(focusIndex >= 0 && hcFocusIndex >= 0, 'composer selectors need normal and high-contrast focus surfaces');
		assert.ok(activeIndex >= 0, 'composer selectors need a pressed surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex && activeIndex > hcFocusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		const activeRule = collectCssRules(css).find(rule => rule.selector.includes('.conversation-lens-dock-permission .monaco-select-box:active'));
		assert.ok(activeRule, 'composer selector pressed rule must be discoverable');
		assert.match(activeRule!.body, /toolbar-activeBackground/);
		assert.match(activeRule!.body, /!important/);
	});

	test('soft composer control keeps pressed surface above hover', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-dock-control--soft.monaco-button:hover');
		const activeIndex = css.indexOf('.conversation-lens-dock-control--soft.monaco-button:active:not(.disabled)');
		assert.ok(hoverIndex >= 0, 'soft composer controls need a hover surface');
		assert.ok(activeIndex > hoverIndex, 'soft composer pressed surface must follow hover');
		const activeRule = collectCssRules(css).find(rule => rule.selector.includes('.conversation-lens-dock-control--soft.monaco-button:active:not(.disabled)'));
		assert.ok(activeRule, 'soft composer pressed rule must be discoverable');
		assert.match(activeRule!.body, /toolbar-activeBackground/);
	});

	test('composer popup items keep pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const addHoverIndex = css.indexOf('.conversation-lens-dock-add-popup .conversation-lens-dock-add-option:hover');
		const addFocusIndex = css.indexOf('.conversation-lens-dock-add-popup .conversation-lens-dock-add-option:focus-visible');
		const addHcFocusIndex = css.indexOf('.monaco-workbench:is(.hc-black, .hc-light) .conversation-lens-dock-add-popup .conversation-lens-dock-add-option:not(:disabled):not([aria-disabled="true"]):focus-visible');
		const addActiveIndex = css.indexOf('.conversation-lens-dock-add-popup .conversation-lens-dock-add-option:not(:disabled):active');
		const moreHoverIndex = css.indexOf('.conversation-lens-dock-more-popup .conversation-lens-dock-more-item:hover');
		const moreFocusIndex = css.indexOf('.conversation-lens-dock-more-popup .conversation-lens-dock-more-item:focus-visible');
		const moreActiveIndex = css.indexOf('.conversation-lens-dock-more-popup .conversation-lens-dock-more-item:not(:disabled):active');
		assert.ok(addHoverIndex >= 0 && addFocusIndex >= 0 && addHcFocusIndex >= 0, 'add popup options need hover and normal/high-contrast focus surfaces');
		assert.ok(addActiveIndex > addHoverIndex && addActiveIndex > addFocusIndex && addActiveIndex > addHcFocusIndex, 'add popup pressed surface must follow hover and keyboard focus surfaces');
		assert.ok(moreHoverIndex >= 0 && moreFocusIndex >= 0, 'More popup items need hover and keyboard focus surfaces');
		assert.ok(moreActiveIndex > moreHoverIndex && moreActiveIndex > moreFocusIndex, 'More popup pressed surface must follow hover and keyboard focus surfaces');
		const activeRule = collectCssRules(css).find(rule => rule.selector.includes('.conversation-lens-dock-add-popup .conversation-lens-dock-add-option:not(:disabled):active'));
		assert.ok(activeRule, 'composer popup pressed rule must be discoverable');
		assert.match(activeRule!.body, /toolbar-activeBackground/);
	});

	test('@ mention options keep aria-selected semantics while narrowing ordinary faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationComposerAt.ts'), 'utf8');
		assert.match(source, /append\(list, \$\('button\.conversation-composer-at-option'\)\)/, '@ mention options stay native buttons');
		assert.match(source, /option\.setAttribute\('role', 'option'\)/, '@ mention options keep option semantics');
		assert.match(source, /option\.setAttribute\('aria-selected', String\(active\)\)/, '@ mention options keep selected state');
		assert.match(source, /option\.tabIndex\s*=\s*-1/, '@ mention options keep textarea-owned focus semantics');
		assert.match(css, /conversation-composer-at-option::before\s*\{[^}]*inset:\s*1px 4px/s, '@ mention options keep the hit target while the face is inset');
		assert.match(css, /conversation-composer-at-option:not\(\.is-active\):hover:not\(:disabled\)[^\{]*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-composer-at-option:not\(\.is-active\):hover:not\(:disabled\)::before[\s\S]*?list-hoverBackground/s);
		assert.match(css, /conversation-composer-at-option:not\(\.is-active\):active:not\(:disabled\)\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-composer-at-option:not\(\.is-active\):active:not\(:disabled\)::before[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-composer-at-option\.is-active\s*\{[^}]*list-activeSelectionBackground/s, 'active option keeps its selected host surface');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-composer-at-option::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-composer-at-option::before[\s\S]*?transition:\s*none/);
	});

	test('tune popup open keeps native command semantics while narrowing its interaction face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts'), 'utf8');
		assert.match(source, /append\(popup, \$\('button\.conversation-lens-dock-tune-open'\)\)/, 'tune open stays a native button');
		assert.match(source, /open\.type\s*=\s*'button'/, 'tune open keeps button type');
		assert.match(source, /OPEN_ENGINE_PREFERENCES_COMMAND_ID/, 'tune open keeps its command action');
		assert.match(css, /conversation-lens-dock-tune-open::before\s*\{[^}]*inset:\s*1px 4px/s, 'tune open keeps its hit target while the face is inset');
		assert.match(css, /conversation-lens-dock-tune-open:hover\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-lens-dock-tune-open:hover::before[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-dock-tune-open:active:not\(:disabled\)\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-lens-dock-tune-open:active:not\(:disabled\)::before[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-lens-dock-tune-open:focus-visible\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-lens-dock-tune-open:focus-visible::before[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-lens-dock-tune-open:focus-visible[\s\S]*?contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-lens-dock-tune-open::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-dock-tune-open::before[\s\S]*?transition:\s*none/);
	});

	test('More menu actions keep menuitem semantics while narrowing ordinary faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-dock-more-item/, 'More actions stay native buttons');
		assert.match(source, /item\.setAttribute\('role', 'menuitem'\)/, 'More actions keep menuitem semantics');
		assert.match(source, /item\.setAttribute\('aria-label', label\)/, 'More actions keep accessible names');
		assert.match(css, /conversation-lens-dock-more-item:not\(\.conversation-lens-session-more-session\)::before\s*\{[^}]*inset:\s*1px 4px/s, 'More actions keep their hit target while the face is inset');
		assert.match(css, /conversation-lens-dock-more-item:not\(\.conversation-lens-session-more-session\):hover\s*,[\s\S]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-dock-more-item:not\(\.conversation-lens-session-more-session\):hover::before[\s\S]*?menu-selectionBackground/s);
		assert.match(css, /conversation-lens-dock-more-item:not\(\.conversation-lens-session-more-session\):active:not\(:disabled\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-dock-more-item:not\(\.conversation-lens-session-more-session\):active:not\(:disabled\)::before[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-lens-dock-more-item\[aria-checked="true"\]::before/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-lens-dock-more-item:not\(\.conversation-lens-session-more-session\)::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-dock-more-item:not\(\.conversation-lens-session-more-session\)::before[\s\S]*?transition:\s*none/);
	});

	test('Add menu actions keep menuitem semantics while narrowing their interaction face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationComposerAt.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-dock-add-option/, 'Add actions stay native buttons');
		assert.match(source, /item\.setAttribute\('role', 'menuitem'\)/, 'Add actions keep menuitem semantics');
		assert.match(source, /addComposerContextRef\(host, row\.candidate\.resource\)/, 'Add actions keep their command');
		assert.match(css, /conversation-lens-dock-add-option::before\s*\{[^}]*inset:\s*1px 4px/s, 'Add actions keep their hit target while the face is inset');
		assert.match(css, /conversation-lens-dock-add-option:hover\s*,[\s\S]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-dock-add-option:hover::before[\s\S]*?menu-selectionBackground/s);
		assert.match(css, /conversation-lens-dock-add-option:active:not\(:disabled\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-dock-add-option:active:not\(:disabled\)::before[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-lens-dock-add-option::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-dock-add-option::before[\s\S]*?transition:\s*none/);
	});

	test('turn action buttons keep pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-turn-actions .monaco-button:hover');
		const focusIndex = css.indexOf('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-lens-turn-actions .monaco-button:focus-visible');
		const hcFocusIndex = css.indexOf('.monaco-workbench.hc-black .part.conversation .conversation-lens-turn-actions .monaco-button:focus-visible');
		const activeIndex = css.indexOf('.conversation-lens-turn-actions .monaco-button:active:not([aria-disabled="true"]):not(:disabled)');
		assert.ok(hoverIndex >= 0, 'turn action buttons need a hover surface');
		assert.ok(focusIndex >= 0 && hcFocusIndex >= 0, 'turn action buttons need normal and high-contrast focus surfaces');
		assert.ok(activeIndex >= 0, 'turn action buttons need a pressed surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex && activeIndex > hcFocusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		assert.match(css, /conversation-lens-turn-actions \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-turn-actions \.monaco-button:hover[\s\S]*?background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-turn-actions \.monaco-button:hover::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-turn-actions \.monaco-button:active:not\([^}]+\)\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-turn-actions \.monaco-button:active:not\([^}]+\)::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-turn-actions \.monaco-button::after[\s\S]*?transition:\s*none/);
	});

	test('confirmation actions keep pressed surface above focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const activeIndex = css.indexOf('.conversation-lens-confirmation-actions .monaco-button:active:not(.disabled)');
		const focusIndex = css.indexOf('.conversation-lens-confirmation-actions .monaco-button:focus-visible');
		const hcFocusIndex = css.indexOf('.monaco-workbench:is(.hc-black, .hc-light) .part.conversation .conversation-lens-confirmation-actions .monaco-button:focus-visible');
		assert.ok(activeIndex >= 0, 'confirmation actions need a pressed surface');
		assert.ok(focusIndex >= 0 && hcFocusIndex >= 0, 'confirmation actions need normal and high-contrast focus surfaces');
		assert.ok(activeIndex > focusIndex && activeIndex > hcFocusIndex, 'pressed surface must follow confirmation action focus surfaces');
	});

	test('code block copy keeps pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const prefix = '.conversation-lens-turn-body.rendered-markdown .conversation-code-block-copy';
		const hoverIndex = css.indexOf(`${prefix}:hover`);
		const activeIndex = css.indexOf(`${prefix}:active`);
		const focusIndex = css.indexOf(`${prefix}:focus-visible`);
		const hcFocusIndex = css.indexOf('.monaco-workbench:is(.hc-black, .hc-light) .part.conversation .conversation-lens-turn-body.rendered-markdown .conversation-code-block-copy:focus-visible');
		assert.ok(hoverIndex >= 0 && activeIndex >= 0 && focusIndex >= 0 && hcFocusIndex >= 0, 'code block copy needs hover, pressed, and focus surfaces');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex && activeIndex > hcFocusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
	});

	test('code block copy keeps native Codicon semantics while narrowing its interaction face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTurnContentAdapter.ts'), 'utf8');
		assert.match(source, /append\(bar, \$\('button\.conversation-code-block-copy'\)\)/, 'code block copy stays a native button');
		assert.match(source, /copy\.type\s*=\s*'button'/, 'code block copy keeps button type');
		assert.match(source, /copy\.classList\.add\(\.\.\.ThemeIcon\.asClassNameArray\(Codicon\.copy\)\)/, 'code block copy keeps its Codicon');
		assert.match(source, /copy\.setAttribute\('aria-label', copyLabel\)/, 'code block copy keeps an accessible name');
		assert.match(css, /conversation-code-block-copy::after\s*\{[^}]*inset:\s*1px 2px/s, 'code block copy keeps its hit target while the face is inset');
		assert.match(css, /conversation-code-block-copy:hover\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-code-block-copy:hover::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-code-block-copy:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-code-block-copy:active::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-code-block-copy:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-code-block-copy:focus-visible::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-code-block-copy:focus-visible\s*\{[^}]*contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-code-block-copy::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-code-block-copy::after[\s\S]*?transition:\s*none/);
	});

	test('visualize disclosure focus follows product focus treatment while HC keeps a contrast ring', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationVisualize.css'), 'utf8'));
		const rules = collectCssRules(css);
		const normal = rules.find(rule => rule.selector.includes('.monaco-workbench:not(.hc-black):not(.hc-light)') && rule.selector.includes('.conversation-visualize-header:focus-visible'));
		assert.ok(normal, 'visualize header needs a normal-theme focus-visible rule');
		assert.match(normal!.body, /outline\s*:\s*none\s*!important/);
		assert.match(normal!.body, /background-color\s*:\s*transparent/);
		assert.doesNotMatch(normal!.body, /focusBorder/);
		assert.match(css, /\.conversation-visualize-header:focus-visible::before[\s\S]*?toolbar-hoverBackground/, 'visualize header focus paints the narrowed face');
		assert.match(css, /\.conversation-visualize-header-row:hover\s*\{[^}]*background:\s*transparent/s, 'visualize header row keeps its full hit target without a full-row fill');
		assert.match(css, /\.conversation-visualize-header-row:hover \.conversation-visualize-header::before[\s\S]*?list-hoverBackground/, 'visualize header hover paints the narrowed face');
		const highContrast = rules.find(rule => rule.selector.includes('.monaco-workbench.hc-black') && rule.selector.includes('.conversation-visualize-header:focus-visible'));
		assert.ok(highContrast, 'HC visualize header focus-visible ring must remain');
		assert.match(highContrast!.body, /contrastActiveBorder/);
		assert.match(css, /\.conversation-visualize-header::before\s*\{[^}]*inset:\s*1px 4px/s, 'visualize header keeps a narrowed visual face');
		assert.match(css, /\.conversation-visualize-header:active::before\s*\{[^}]*toolbar-activeBackground/s, 'visualize header press paints the narrowed face');
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.conversation-visualize-header::before[\s\S]*?transition:\s*none/, 'visualize header face honors reduced motion');
	});

	test('visualize expand keeps pressed surface above hover', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationVisualize.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-visualize-expand:hover');
		const activeIndex = css.indexOf('.conversation-visualize-expand:active');
		assert.ok(hoverIndex >= 0, 'visualize expand needs a hover surface');
		assert.ok(activeIndex >= 0, 'visualize expand needs a pressed surface');
		assert.ok(activeIndex > hoverIndex, 'pressed surface must follow hover so pointer-down feedback wins');
		assert.match(css, /\.conversation-visualize-expand\s*\{[^}]*position:\s*relative;[^}]*isolation:\s*isolate;[^}]*background:\s*transparent/s);
		assert.match(css, /\.conversation-visualize-expand::before\s*\{[^}]*inset:\s*1px 2px;[^}]*pointer-events:\s*none/s);
		assert.match(css, /\.conversation-visualize-expand:hover::before[\s\S]*?toolbar-hoverBackground/);
		assert.match(css, /\.conversation-visualize-expand:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /\.conversation-visualize-expand:active::before[\s\S]*?toolbar-activeBackground/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-visualize-expand::before[\s\S]*?transition:\s*none/);
	});

	test('visualize overlay actions keep the native target while pressing an inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationVisualize.css'), 'utf8'));
		const prefix = '.conversation-visualize-overlay-header .monaco-button';
		const hoverIndex = css.indexOf(`${prefix}:hover`);
		const activeIndex = css.indexOf(`${prefix}:active`);
		assert.ok(hoverIndex >= 0 && activeIndex > hoverIndex, 'overlay action pressed surface must follow hover surface');
		assert.match(css, /\.conversation-visualize-overlay-header \.monaco-button\s*\{[^}]*position:\s*relative;[^}]*isolation:\s*isolate;[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /\.conversation-visualize-overlay-header \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px;[^}]*pointer-events:\s*none/s);
		assert.match(css, /\.conversation-visualize-overlay-header \.monaco-button:hover:not\(\.disabled\)::after[\s\S]*?toolbar-hoverBackground/);
		assert.match(css, /\.conversation-visualize-overlay-header \.monaco-button:active\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /\.conversation-visualize-overlay-header \.monaco-button:active::after[\s\S]*?toolbar-activeBackground/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-visualize-overlay-header \.monaco-button::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-visualize-overlay-header \.monaco-button::after[\s\S]*?transition:\s*none/);
	});

	test('connection preferences nav keeps pressed surface above hover', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/connectionPreferencesPane.css'), 'utf8'));
		const hoverIndex = css.indexOf('.connection-preferences-nav-row:hover:not(.selected)');
		const activeIndex = css.indexOf('.connection-preferences-nav-row:active');
		assert.ok(hoverIndex >= 0, 'connection preferences nav needs a hover surface');
		assert.ok(activeIndex >= 0, 'connection preferences nav needs a pressed surface');
		assert.ok(activeIndex > hoverIndex, 'pressed surface must follow hover so pointer-down feedback wins');
	});

	test('connection preferences nav rows keep the hit target while pressing an inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/connectionPreferencesPane.css'), 'utf8'));
		const rules = collectCssRules(css);
		const row = rules.find(rule => rule.selector.trim() === '.monaco-workbench .connection-preferences-nav-row');
		assert.ok(row, 'connection preferences nav row keeps an anchored hit target');
		assert.match(row!.body, /position:\s*relative/);
		assert.match(row!.body, /isolation:\s*isolate/);
		const face = rules.find(rule => rule.selector.trim() === '.monaco-workbench .connection-preferences-nav-row::before');
		assert.ok(face, 'connection preferences nav row needs an inset visual face');
		assert.match(face!.body, /inset:\s*1px 4px/);
		assert.match(css, /connection-preferences-nav-row:hover:not\(\.selected\)\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /connection-preferences-nav-row:hover:not\(\.selected\)::before\s*\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 5%, transparent\)/s);
		assert.match(css, /connection-preferences-nav-row:active:not\(\.selected\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /connection-preferences-nav-row:active:not\(\.selected\)::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /connection-preferences-nav \.monaco-list:focus-visible \.monaco-list-row\.focused:not\(\.selected\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /connection-preferences-nav \.monaco-list:focus-visible \.monaco-list-row\.focused:not\(\.selected\)::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /connection-preferences-nav-row\.selected::before\s*\{[^}]*content:\s*none/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?connection-preferences-nav-row::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?connection-preferences-nav-row::before[\s\S]*?transition:\s*none/);
	});

	test('engine utility rows keep selection while pressing an inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8'));
		assert.match(css, /\.engine-triggers-row::before[\s\S]*?inset:\s*1px 4px/);
		assert.match(css, /\.engine-triggers-row:active::before[\s\S]*?toolbar-activeBackground/);
		assert.match(css, /\.engine-triggers-row\.selected,[\s\S]*?background:\s*var\(--vscode-list-inactiveSelectionBackground\)/, 'engine selected utility row keeps its persistent selection face');
		assert.match(css, /:not\(\.selected\):focus-visible\s*\{[^}]*background-color:\s*transparent/s, 'engine utility focus host stays transparent');
		assert.match(css, /:not\(\.selected\):focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s, 'engine utility focus paints the narrowed face');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[^\{]*[\s\S]*?\.engine-triggers-row::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.engine-triggers-row::before[\s\S]*?transition:\s*none/);
	});

	test('engine catalog, skills, and agents rows keep the hit target while hovering an inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8'));
		assert.match(css, /engine-catalog-list \.monaco-list-row[^\{]*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /engine-catalog-list \.monaco-list-row::before[^\{]*\{[^}]*inset:\s*1px 4px/s);
		assert.match(css, /engine-catalog-list \.monaco-list-row:hover:not\(\.selected\)[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /engine-skills-list \.monaco-list-row:hover:not\(\.selected\)::before[^\{]*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /engine-agents-profile-list \.monaco-list-row:hover\.selected[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /engine-catalog-list \.monaco-list-row:hover\.selected::before[^\{]*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /engine-skills-list \.monaco-list-row:hover\.selected::before[^\{]*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /engine-agents-profile-list \.monaco-list-row:hover\.selected::before[^\{]*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?engine-catalog-list, \.engine-skills-list, \.engine-agents-profile-list\) \.monaco-list-row::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?engine-catalog-list, \.engine-skills-list, \.engine-agents-profile-list\) \.monaco-list-row::before[\s\S]*?transition:\s*none/);
	});

	test('identity chips keep pressed surface above hover', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationIdentityStrip.css'), 'utf8'));
		const hoverIndex = css.indexOf('button.conversation-identity-chip:hover');
		const offlineHoverIndex = css.indexOf('conversation-identity-chip-engine--offline:hover');
		const activeIndex = css.indexOf('button.conversation-identity-chip:active');
		assert.ok(hoverIndex >= 0, 'identity chips need a hover surface');
		assert.ok(offlineHoverIndex >= 0, 'offline identity chips need a status hover surface');
		assert.ok(activeIndex >= 0, 'identity chips need a pressed surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > offlineHoverIndex, 'pressed surface must follow all chip hover surfaces');
	});

	test('session title keeps pressed surface above hover', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-session-title:hover');
		const activeIndex = css.indexOf('.conversation-lens-session-title:active:not(:disabled)');
		assert.ok(hoverIndex >= 0, 'session title needs a hover surface');
		assert.ok(activeIndex >= 0, 'session title needs a pressed surface');
		assert.ok(activeIndex > hoverIndex, 'pressed surface must follow hover so pointer-down feedback wins');
		const focusIndex = css.indexOf('.conversation-lens-session-title:focus-visible');
		assert.ok(focusIndex >= 0 && activeIndex > focusIndex, 'pressed surface must follow keyboard focus surface');
	});

	test('turn trajectory action keeps pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-turn-header-trajectory .monaco-button:hover');
		const activeIndex = css.indexOf('.conversation-lens-turn-header-trajectory .monaco-button:active');
		assert.ok(hoverIndex >= 0, 'trajectory action needs a hover surface');
		assert.ok(activeIndex >= 0, 'trajectory action needs a pressed surface');
		assert.ok(activeIndex > hoverIndex, 'pressed surface must follow hover so pointer-down feedback wins');
		const focusIndex = css.indexOf('.conversation-lens-turn-header-trajectory .monaco-button:focus');
		assert.ok(focusIndex >= 0 && activeIndex > focusIndex, 'pressed surface must follow keyboard focus surface');
		assert.match(css, /conversation-lens-turn-header-trajectory \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-turn-header-trajectory \.monaco-button:hover\s*,[\s\S]*?background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-turn-header-trajectory \.monaco-button:hover::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-turn-header-trajectory \.monaco-button:active\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-turn-header-trajectory \.monaco-button:active::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-turn-header-trajectory \.monaco-button::after[\s\S]*?transition:\s*none/);
	});

	test('pinned user copy keeps Button.icon semantics while narrowing interaction faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTimelineHost.ts'), 'utf8');
		assert.match(source, /span\.conversation-timeline-pinned-user-copy/, 'pinned copy keeps its dedicated host');
		assert.match(source, /this\.pinnedUserCopyButton\.icon\s*=\s*Codicon\.copy/, 'pinned copy remains a Button.icon control');
		assert.match(source, /ariaLabel:\s*conversationLensPinnedUserPromptCopyAria/, 'pinned copy keeps its accessible name');
		assert.match(css, /conversation-timeline-pinned-user-copy \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px/s, 'pinned copy interaction face stays inset from its hit target');
		assert.match(css, /conversation-timeline-pinned-user-copy \.monaco-button:hover\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-timeline-pinned-user-copy \.monaco-button:hover::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-timeline-pinned-user-copy \.monaco-button:active\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-timeline-pinned-user-copy \.monaco-button:active::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?conversation-timeline-pinned-user-copy \.monaco-button:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-timeline-pinned-user-copy \.monaco-button:focus-visible::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-timeline-pinned-user-copy \.monaco-button:focus-visible\s*\{[^}]*contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-timeline-pinned-user-copy \.monaco-button::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-timeline-pinned-user-copy \.monaco-button::after[\s\S]*?transition:\s*none/);
	});

	test('session leaf hide keeps pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessionWindow.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-session-leaf-hide:hover');
		const activeIndex = css.indexOf('.conversation-session-leaf-hide:active');
		const focusIndex = css.indexOf('.conversation-session-leaf-hide:focus-visible');
		const hoverSurfaceIndex = css.indexOf('.conversation-session-leaf-hide:hover::after');
		const activeSurfaceIndex = css.indexOf('.conversation-session-leaf-hide:active::after');
		assert.ok(hoverIndex >= 0, 'session leaf hide needs a hover surface');
		assert.ok(activeIndex >= 0, 'session leaf hide needs a pressed surface');
		assert.ok(focusIndex >= 0, 'session leaf hide needs a keyboard focus surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		assert.ok(hoverSurfaceIndex >= 0, 'session leaf hide needs an inset hover face');
		assert.ok(activeSurfaceIndex > hoverSurfaceIndex, 'pressed inset face must follow hover face');
		assert.match(css, /\.conversation-session-leaf-hide\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /\.conversation-session-leaf-hide::after\s*\{[^}]*inset:\s*1px 2px;[^}]*pointer-events:\s*none/s);
		assert.match(css, /\.conversation-session-leaf-hide:hover::after[\s\S]*?background-color:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.match(css, /\.conversation-session-leaf-hide:active::after[\s\S]*?background-color:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(css, /\.monaco-workbench\.hc-black[^\{]*\.conversation-session-leaf-hide:focus-visible[\s\S]*?contrastActiveBorder/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[^\{]*\.conversation-session-leaf-hide\s*\{[^}]*transition\s*:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.conversation-session-leaf-hide\s*\{[^}]*transition\s*:\s*none/);
	});

	test('review navigation keeps pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-review-nav:hover');
		const activeIndex = css.indexOf('.conversation-review-nav:active');
		const focusIndex = css.indexOf('.conversation-review-nav:focus-visible');
		assert.ok(hoverIndex >= 0, 'review navigation needs a hover surface');
		assert.ok(activeIndex >= 0, 'review navigation needs a pressed surface');
		assert.ok(focusIndex >= 0, 'review navigation needs a keyboard focus surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		assert.match(css, /\.conversation-review-nav::before\s*\{[^}]*inset:\s*2px 4px/s, 'review navigation keeps the pressed face inset from its full-row hit target');
		assert.match(css, /\.conversation-review-nav:active::before\s*\{[^}]*toolbar-activeBackground/s, 'review navigation paints pressed feedback on its inset face');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[^\{]*\.part\.conversation[\s\S]*\.conversation-review-nav::before[\s\S]*transition:\s*none/s, 'review navigation face honors the workbench reduced-motion override');
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.conversation-review-nav::before[\s\S]*transition:\s*none/s, 'review navigation face honors the prefers-reduced-motion override');
	});

	test('trajectory inspector close keeps pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-trajectory-inspector-close:hover');
		const activeIndex = css.indexOf('.conversation-lens-trajectory-inspector-close:active');
		const focusIndex = css.indexOf('.conversation-lens-trajectory-inspector-close:focus-visible');
		assert.ok(hoverIndex >= 0, 'trajectory inspector close needs a hover surface');
		assert.ok(activeIndex >= 0, 'trajectory inspector close needs a pressed surface');
		assert.ok(focusIndex >= 0, 'trajectory inspector close needs a keyboard focus surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[^\{]*\.conversation-lens-trajectory-inspector-close:focus-visible[\s\S]*?contrastActiveBorder/);
	});

	test('process fold trajectory jump keeps pressed surface above reveal and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const revealIndex = css.indexOf('.conversation-process-fold-thinking-line:hover > .conversation-process-fold-trajectory-jump');
		const activeIndex = css.indexOf('.conversation-process-fold-trajectory-jump:active:not(:disabled):not([aria-disabled="true"])');
		const focusIndex = css.indexOf('.conversation-process-fold-trajectory-jump:focus-visible');
		assert.ok(revealIndex >= 0, 'trajectory jump needs a reveal surface');
		assert.ok(activeIndex >= 0, 'trajectory jump needs a pressed surface');
		assert.ok(focusIndex >= 0, 'trajectory jump needs a keyboard focus surface');
		assert.ok(activeIndex > revealIndex && activeIndex > focusIndex, 'pressed surface must follow reveal and keyboard focus surfaces');
	});

	test('process fold trajectory jump keeps native semantics while narrowing its codicon face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts'), 'utf8');
		assert.match(source, /append\(parent, \$\('button\.conversation-process-fold-trajectory-jump'\)\)/, 'trajectory jump stays a native button');
		assert.match(source, /jump\.type\s*=\s*'button'/, 'trajectory jump keeps button type');
		assert.match(source, /jump\.classList\.add\(\.\.\.ThemeIcon\.asClassNameArray\(Codicon\.listTree\)\)/, 'trajectory jump keeps its codicon');
		assert.match(source, /jump\.setAttribute\('aria-label', conversationLensTurnViewInTrajectory\)/, 'trajectory jump keeps an accessible name');
		assert.match(css, /conversation-process-fold-trajectory-jump::after\s*\{[^}]*inset:\s*1px 2px/s, 'trajectory jump keeps its hit target while the face is inset');
		assert.match(css, /conversation-process-fold-trajectory-jump:hover[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-trajectory-jump:hover[^\{]*::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-process-fold-trajectory-jump:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-trajectory-jump:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-process-fold-trajectory-jump:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-trajectory-jump:focus-visible::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-process-fold-trajectory-jump:focus-visible\s*\{[^}]*contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-process-fold-trajectory-jump::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-process-fold-trajectory-jump::after[\s\S]*?transition:\s*none/);
	});

	test('thinking process-fold header keeps native semantics while narrowing its interaction face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts'), 'utf8');
		assert.match(source, /append\(line, \$\('button\.conversation-process-fold-thinking-header'\)\)/, 'thinking fold stays a native button');
		assert.match(source, /header\.type\s*=\s*'button'/, 'thinking fold keeps button type');
		assert.match(source, /header\.setAttribute\('aria-controls', body\.id\)/, 'thinking fold keeps its disclosure target');
		assert.match(css, /conversation-process-fold-thinking-header::before\s*\{[^}]*inset:\s*1px 2px/s, 'thinking fold keeps its hit target while the face is inset');
		assert.match(css, /conversation-process-fold-thinking-header:hover[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-thinking-header:hover[^\{]*::before[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-process-fold-thinking-header:active:not\(\[aria-disabled="true"\]\):not\(:disabled\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-thinking-header:active:not\(\[aria-disabled="true"\]\):not\(:disabled\)::before[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-process-fold-thinking-header:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-thinking-header:focus-visible::before[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-process-fold-thinking-header:focus-visible[\s\S]*?contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-process-fold-thinking-header::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-process-fold-thinking-header::before[\s\S]*?transition:\s*none/);
	});

	test('process-fold header keeps native semantics while narrowing its interaction face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts'), 'utf8');
		assert.match(source, /append\(root, \$\('button\.conversation-process-fold-header'\)\)/, 'process fold stays a native button');
		assert.match(source, /header\.setAttribute\('role', 'button'\)/, 'process fold keeps button semantics');
		assert.match(source, /header\.setAttribute\('aria-controls', children\.id\)/, 'process fold keeps its disclosure target');
		assert.match(css, /conversation-process-fold-header::before\s*\{[^}]*inset:\s*1px 2px/s, 'process fold keeps its hit target while the face is inset');
		assert.match(css, /conversation-process-fold-header:hover[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-header:hover[^\{]*::before[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-process-fold-header:active:not\(\[aria-disabled="true"\]\):not\(:disabled\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-header:active:not\(\[aria-disabled="true"\]\):not\(:disabled\)::before[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-process-fold-header:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-header:focus-visible::before[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-process-fold-header:focus-visible[\s\S]*?contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-process-fold-header::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-process-fold-header::before[\s\S]*?transition:\s*none/);
	});

	test('process fold tool headers keep the hit target while pressing an inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const header = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-process-fold-tool-header');
		assert.ok(header, 'process fold tool header keeps an anchored hit target');
		assert.match(header!.body, /position:\s*relative/);
		assert.match(header!.body, /isolation:\s*isolate/);
		const face = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-process-fold-tool-header::before');
		assert.ok(face, 'process fold tool header needs an inset visual face');
		assert.match(face!.body, /inset:\s*1px 2px/);
		assert.match(css, /button\.conversation-process-fold-tool-header:hover[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /button\.conversation-process-fold-tool-header:hover[^\{]*::before[^\{]*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /button\.conversation-process-fold-tool-header:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /button\.conversation-process-fold-tool-header:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /button\.conversation-process-fold-tool-header:active[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /button\.conversation-process-fold-tool-header:active[^\{]*::before[^\{]*\{[^}]*toolbar-activeBackground/s);
		const hoverFaceIndex = css.indexOf('button.conversation-process-fold-tool-header:hover:not([aria-disabled="true"]):not(:disabled)::before');
		const focusFaceIndex = css.indexOf('button.conversation-process-fold-tool-header:focus-visible::before');
		const activeFaceIndex = css.indexOf('button.conversation-process-fold-tool-header:active:not([aria-disabled="true"]):not(:disabled)::before');
		assert.ok(hoverFaceIndex >= 0 && focusFaceIndex >= 0 && activeFaceIndex > hoverFaceIndex && activeFaceIndex > focusFaceIndex, 'pressed tool face must follow hover and focus faces');
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?button\.conversation-process-fold-tool-header::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?button\.conversation-process-fold-tool-header::before[\s\S]*?transition:\s*none/);
	});

	test('process fold tool cancel keeps native semantics while narrowing its codicon face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts'), 'utf8');
		assert.match(source, /append\(parent, \$\('button\.conversation-process-fold-tool-cancel'\)\)/, 'tool cancel stays a native button');
		assert.match(source, /cancel\.type\s*=\s*'button'/, 'tool cancel keeps button type');
		assert.match(source, /cancel\.setAttribute\('aria-label'/, 'tool cancel keeps an accessible name');
		assert.match(source, /cancel\.setAttribute\('aria-disabled'/, 'tool cancel keeps disabled semantics');
		assert.match(css, /conversation-process-fold-tool-cancel::after\s*\{[^}]*inset:\s*1px 2px/s, 'tool cancel keeps its hit target while the face is inset');
		assert.match(css, /conversation-process-fold-tool-cancel:hover[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-tool-cancel:hover[^\{]*::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-process-fold-tool-cancel:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-tool-cancel:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-process-fold-tool-cancel:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-tool-cancel:focus-visible::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-process-fold-tool-cancel:focus-visible\s*\{[^}]*contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-process-fold-tool-cancel::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-process-fold-tool-cancel::after[\s\S]*?transition:\s*none/);
	});

	test('process fold tool respond keeps native semantics while narrowing its codicon face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts'), 'utf8');
		assert.match(source, /append\(parent, \$\('button\.conversation-process-fold-tool-respond'\)\)/, 'tool respond stays a native button');
		assert.match(source, /respond\.type\s*=\s*'button'/, 'tool respond keeps button type');
		assert.match(source, /respond\.setAttribute\('aria-label'/, 'tool respond keeps an accessible name');
		assert.match(source, /respond\.setAttribute\('aria-disabled'/, 'tool respond keeps disabled semantics');
		assert.match(source, /respond\.setAttribute\('aria-busy'/, 'tool respond keeps in-flight semantics');
		assert.match(css, /conversation-process-fold-tool-respond::after\s*\{[^}]*inset:\s*1px 2px/s, 'tool respond keeps its hit target while the face is inset');
		assert.match(css, /conversation-process-fold-tool-respond:hover[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-tool-respond:hover[^\{]*::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-process-fold-tool-respond:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-tool-respond:active:not\(:disabled\):not\(\[aria-disabled="true"\]\)::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /conversation-process-fold-tool-respond:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-process-fold-tool-respond:focus-visible::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-process-fold-tool-respond:focus-visible\s*\{[^}]*contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-process-fold-tool-respond::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-process-fold-tool-respond::after[\s\S]*?transition:\s*none/);
	});

	test('trajectory record rows keep pressed surface above hover', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-trajectory-record-row:hover:not(.conversation-lens-trajectory-record-row--selected)');
		const activeIndex = css.indexOf('.conversation-lens-trajectory-record-row:active:not(.conversation-lens-trajectory-record-row--selected)');
		const selectedIndex = css.indexOf('.conversation-lens-trajectory-record-row--selected {');
		assert.ok(hoverIndex >= 0, 'trajectory record rows need an unselected hover surface');
		assert.ok(activeIndex >= 0, 'trajectory record rows need a pressed surface');
		assert.ok(selectedIndex >= 0, 'trajectory record rows need a selected surface');
		assert.ok(activeIndex > hoverIndex, 'pressed surface must follow hover so pointer-down feedback wins');
		assert.ok(activeIndex < selectedIndex, 'selected row surface must continue to override the pressed surface');
		assert.match(css, /\.conversation-lens-trajectory-record-row::before\s*\{[^}]*inset:\s*1px 4px/s, 'trajectory record rows keep a narrowed visual face');
		assert.match(css, /\.conversation-lens-trajectory-record-row:active:not\(\.conversation-lens-trajectory-record-row--selected\)::before\s*\{[^}]*list-activeSelectionBackground/s, 'unselected row press paints the narrowed visual face');
	});

	test('question options keep radio and checkbox semantics while painting inset interaction faces', () => {
		const cssPath = path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css');
		const sourcePath = path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationQuestionSeat.ts');
		const css = stripCssComments(fs.readFileSync(cssPath, 'utf8'));
		const source = fs.readFileSync(sourcePath, 'utf8');
		assert.match(source, /setAttribute\('role', 'radio'\)/, 'single-choice options keep radio semantics');
		assert.match(source, /setAttribute\('role', 'checkbox'\)/, 'multi-choice options keep checkbox semantics');
		assert.match(source, /wireConversationSeatOptionKeys\(radios/, 'radio options retain roving keyboard wiring');
		assert.match(source, /wireConversationSeatOptionKeys\(boxes/, 'checkbox options retain keyboard wiring');
		assert.match(css, /\.conversation-lens-question-option\[role="radio"\]\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /\.monaco-workbench \.part\.conversation \.conversation-lens-question-option\[role="radio"\]::before,\s*\.monaco-workbench \.part\.conversation \.conversation-lens-question-option\[role="checkbox"\]::before\s*\{[^}]*inset:\s*1px 4px/s, 'radio and checkbox options keep a narrowed visual face');
		assert.match(css, /question-option\[role="radio"\]:hover[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /question-option\[role="radio"\]:hover[^\{]*::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /question-option\[role="checkbox"\]:active[^\{]*::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[^\{]*question-option\[role="radio"\]:focus-visible[^\{]*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /question-option\[role="checkbox"\]:focus-visible[^\{]*::before\s*\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 12%/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?question-option\[role="radio"\]::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?question-option\[role="checkbox"\]::before[\s\S]*?transition:\s*none/);
	});

	test('file edit paths keep button semantics while painting an inset interaction face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationProcessFold.ts'), 'utf8');
		assert.match(source, /append\(line, \$\('button\.conversation-file-edit-path'\)\)/, 'interactive file paths stay native buttons');
		assert.match(source, /button\.setAttribute\('aria-controls', diffArea\.id\)/, 'file path button keeps its diff disclosure target');
		assert.match(css, /button\.conversation-file-edit-path::before\s*\{[^}]*inset:\s*1px 4px/s, 'file path button keeps a narrowed visual face');
		assert.match(css, /\.conversation-file-edit-path:hover:not\(\.is-static\)\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /button\.conversation-file-edit-path:hover::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /\.conversation-file-edit-path:focus-visible\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /button\.conversation-file-edit-path:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /button\.conversation-file-edit-path:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?button\.conversation-file-edit-path::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?button\.conversation-file-edit-path::before[\s\S]*?transition:\s*none/);
	});

	test('error details toggle keeps its native button while painting a compact focus face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-turn-error-details-toggle/, 'error details remains a native button');
		assert.match(css, /conversation-lens-turn-error-details-toggle::before\s*\{[^}]*inset:\s*0 2px/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?conversation-lens-turn-error-details-toggle:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-turn-error-details-toggle:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-lens-turn-error-details-toggle:focus-visible\s*\{[^}]*contrastActiveBorder/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-lens-turn-error-details-toggle::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-turn-error-details-toggle::before[\s\S]*?transition:\s*none/);
	});

	test('user turn fold button keeps native semantics while narrowing focus and press faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-turn-fold-button/, 'user turn fold stays a native button');
		assert.match(css, /conversation-lens-turn-fold-button::before\s*\{[^}]*inset:\s*0 2px/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?conversation-lens-turn-fold-button:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-turn-fold-button:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-turn-fold-button:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-turn-fold-button:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\)[\s\S]*?conversation-lens-turn-fold-button:focus-visible\s*\{[^}]*contrastActiveBorder/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-turn-fold-button::before[\s\S]*?transition:\s*none/);
	});

	test('trajectory inspector back keeps native button semantics while narrowing interaction faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTrajectory.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-trajectory-inspector-back/, 'inspector back stays a native button');
		assert.match(source, /inspectorBackButton\.setAttribute\('aria-label', conversationTrajectoryInspectorBack\)/, 'inspector back keeps its accessible name');
		assert.match(css, /conversation-lens-trajectory-inspector-back::before\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-trajectory-inspector-back:hover\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-back:hover::before\s*\{[^}]*button-secondaryHoverBackground/s);
		assert.match(css, /conversation-lens-trajectory-inspector-back:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-back:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?conversation-lens-trajectory-inspector-back:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-back:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-trajectory-inspector-back::before[\s\S]*?transition:\s*none/);
	});

	test('trajectory inspector retry keeps native button semantics while narrowing interaction faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTrajectory.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-trajectory-inspector-retry/, 'inspector retry stays a native button');
		assert.match(css, /conversation-lens-trajectory-inspector-retry::before\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-trajectory-inspector-retry:hover\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-retry:hover::before\s*\{[^}]*button-secondaryHoverBackground/s);
		assert.match(css, /conversation-lens-trajectory-inspector-retry:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-retry:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?conversation-lens-trajectory-inspector-retry:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-retry:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-trajectory-inspector-retry::before[\s\S]*?transition:\s*none/);
	});

	test('trajectory inspector close keeps native button semantics while narrowing interaction faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTrajectory.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-trajectory-inspector-close/, 'inspector close stays a native button');
		assert.match(source, /closeButton\.setAttribute\('aria-label', conversationTrajectoryInspectorClose\)/, 'inspector close keeps its accessible name');
		assert.match(css, /conversation-lens-trajectory-inspector-close::before\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-trajectory-inspector-close:hover\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-close:hover::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-trajectory-inspector-close:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-close:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*?conversation-lens-trajectory-inspector-close:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-trajectory-inspector-close:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-trajectory-inspector-close::before[\s\S]*?transition:\s*none/);
	});

	test('error retry button keeps native semantics while narrowing interaction faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationTimelineRenderer.ts'), 'utf8');
		assert.match(source, /conversation-lens-turn-error-retry/, 'error retry keeps its native button host');
		assert.match(css, /conversation-lens-turn-error-retry \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-lens-turn-error-retry \.monaco-button:hover\s*,[\s\S]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-turn-error-retry \.monaco-button:hover::after[\s\S]*?toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-turn-error-retry \.monaco-button:active:not\(\.disabled\)\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /conversation-lens-turn-error-retry \.monaco-button:active:not\(\.disabled\)::after[\s\S]*?toolbar-activeBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-turn-error-retry \.monaco-button::after[\s\S]*?transition:\s*none/);
	});

	test('pending inbox button keeps its native target while painting an inset interaction face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationInboxOverlay.ts'), 'utf8');
		assert.match(source, /append\(this\.leftCluster, \$\('button\.conversation-lens-inbox-pending'\)\)/, 'pending confirmation stays a native button');
		assert.match(source, /this\.pendingButton\.type = 'button'/, 'pending confirmation keeps button type');
		assert.match(css, /conversation-lens-inbox-pending::before\s*\{[^}]*inset:\s*1px 4px/s, 'pending confirmation keeps a narrowed visual face');
		assert.match(css, /conversation-lens-inbox-pending:hover\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-lens-inbox-pending:hover::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-inbox-pending:active:not\(:disabled\)\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-lens-inbox-pending:active:not\(:disabled\)::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[^\{]*conversation-lens-inbox-pending:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-lens-inbox-pending:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-lens-inbox-pending::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-inbox-pending::before[\s\S]*?transition:\s*none/);
	});

	test('queue inbox chip keeps aria-pressed state while narrowing ordinary interaction faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationInboxOverlay.ts'), 'utf8');
		assert.match(source, /button\.conversation-lens-inbox-chip\.conversation-lens-inbox-queue/, 'queue remains a native inbox button');
		assert.match(source, /setAttribute\('aria-pressed', canOpen \? String\(this\.openPanel === 'queue'\) : 'false'\)/, 'queue chip keeps its pressed state contract');
		assert.match(source, /setAttribute\('aria-disabled', String\(!canOpen\)\)/, 'queue chip keeps its disabled state contract');
		assert.match(css, /conversation-lens-inbox-queue::before\s*\{[^}]*inset:\s*1px 4px/s);
		assert.match(css, /conversation-lens-inbox-queue:hover:not\(\[aria-disabled="true"\]\):not\(\[aria-pressed="true"\]\)\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /conversation-lens-inbox-queue:hover:not\(\[aria-disabled="true"\]\):not\(\[aria-pressed="true"\]\)::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-inbox-queue:active:not\(:disabled\):not\(\[aria-disabled="true"\]\):not\(\[aria-pressed="true"\]\)::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /conversation-lens-inbox-chip\[aria-pressed="true"\]\s*\{[^}]*background:\s*var\(--vscode-toolbar-activeBackground\)/s, 'pressed queue state keeps its host status face');
		assert.match(css, /conversation-lens-inbox-queue:focus-visible:not\(\[aria-pressed="true"\]\)::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-lens-inbox-queue::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-inbox-queue::before[\s\S]*?transition:\s*none/);
	});

	test('inbox Goal and Stop buttons keep button semantics while narrowing interaction faces', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationInboxOverlay.ts'), 'utf8');
		assert.match(source, /conversation-lens-inbox-goal-button/, 'Goal keeps its button host');
		assert.match(source, /conversation-lens-inbox-stop-button/, 'Stop keeps its button host');
		assert.match(css, /conversation-lens-inbox-goal-button::before\s*,[\s\S]*conversation-lens-inbox-stop-button::before\s*\{[^}]*inset:\s*1px 4px/s);
		assert.match(css, /conversation-lens-inbox-goal-button:hover:not\(\.disabled\)\s*,[\s\S]*background: transparent !important/s);
		assert.match(css, /conversation-lens-inbox-goal-button:hover:not\(\.disabled\)::before[\s\S]*toolbar-hoverBackground/s);
		assert.match(css, /conversation-lens-inbox-stop-button:active:not\(\.disabled\)::before[\s\S]*toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\)[\s\S]*conversation-lens-inbox-goal-button:focus-visible:not\(\.disabled\)[\s\S]*background-color: transparent !important/s);
		assert.match(css, /conversation-lens-inbox-stop-button:focus-visible:not\(\.disabled\)::before[\s\S]*toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-lens-inbox-goal-button::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-lens-inbox-stop-button::before[\s\S]*?transition:\s*none/);
	});

	test('message queue items keep pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-message-queue-list .queue-item:hover');
		const activeIndex = css.indexOf('.conversation-lens-message-queue-list .queue-item:active');
		const focusIndex = css.indexOf('.conversation-lens-message-queue-list .queue-item:focus-visible');
		assert.ok(hoverIndex >= 0, 'message queue items need a hover surface');
		assert.ok(activeIndex >= 0, 'message queue items need a pressed surface');
		assert.ok(focusIndex >= 0, 'message queue items need a keyboard focus surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		assert.match(css, /\.conversation-lens-message-queue-list \.queue-item::before\s*\{[^}]*inset:\s*1px 4px/s, 'message queue items keep a narrowed visual face');
		assert.match(css, /\.conversation-lens-message-queue-list \.queue-item:active::before\s*\{[^}]*toolbar-activeBackground/s, 'message queue item press paints the narrowed visual face');
		assert.match(css, /\.conversation-lens-message-queue-list \.queue-item:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s, 'message queue item focus paints the narrowed visual face');
		assert.match(css, /\.conversation-lens-message-queue-list \.queue-item\.hold-editing:active[\s\S]*?background-color:\s*var\(--vscode-toolbar-activeBackground\)/, 'hold-editing keeps its full-row pressed status surface');
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.conversation-lens-message-queue-list \.queue-item::before[\s\S]*?transition:\s*none/, 'message queue pressed face honors prefers-reduced-motion');
	});

	test('inbox chip keeps pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-inbox-chip:hover {');
		const focusIndex = css.indexOf('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-lens-inbox-chip:focus-visible');
		const hcFocusIndex = css.indexOf('.monaco-workbench:is(.hc-black, .hc-light) .part.conversation .conversation-lens-inbox-chip:focus-visible');
		const activeIndex = css.indexOf('.monaco-workbench .part.conversation .conversation-lens-inbox-chip:active {');
		assert.ok(hoverIndex >= 0, 'inbox chip needs a hover surface');
		assert.ok(focusIndex >= 0 && hcFocusIndex >= 0, 'inbox chip needs normal and high-contrast focus surfaces');
		assert.ok(activeIndex >= 0, 'inbox chip needs a pressed surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex && activeIndex > hcFocusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
	});

	test('message queue bar actions keep pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-lens-message-queue-list .queue-bar-action:hover:not(:disabled)');
		const clearHoverIndex = css.indexOf('.conversation-lens-message-queue-list .queue-bar-action.conversation-lens-inbox-queue-clear:hover:not(:disabled)');
		const activeIndex = css.indexOf('.conversation-lens-message-queue-list .queue-bar-action:not(:disabled):active');
		const focusIndex = css.indexOf('.conversation-lens-message-queue-list .queue-bar-action:focus-visible');
		const hcFocusIndex = css.indexOf('.monaco-workbench:is(.hc-black, .hc-light) .conversation-lens-message-queue-list .queue-bar-action:focus-visible');
		assert.ok(hoverIndex >= 0, 'message queue bar actions need a hover surface');
		assert.ok(clearHoverIndex >= 0, 'message queue clear action needs its error hover surface');
		assert.ok(activeIndex >= 0, 'message queue bar actions need a pressed surface');
		assert.ok(focusIndex >= 0 && hcFocusIndex >= 0, 'message queue bar actions need normal and high-contrast focus surfaces');
		assert.ok(activeIndex > hoverIndex && activeIndex > clearHoverIndex && activeIndex > focusIndex && activeIndex > hcFocusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		assert.match(css, /queue-bar-action::before\s*\{[^}]*inset:\s*1px 2px/s, 'queue bar action keeps a narrowed visual face');
		assert.match(css, /queue-bar-action:focus-visible\s*\{[^}]*background-color:\s*transparent/s, 'normal queue action focus host stays transparent');
		assert.match(css, /queue-bar-action:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s, 'normal queue action focus paints the inset face');
		assert.match(css, /queue-bar-action:not\(:disabled\):active\s*\{[^}]*background:\s*transparent/s, 'queue action press host stays transparent');
		assert.match(css, /queue-bar-action:not\(:disabled\):active::before\s*\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 6%/s, 'queue action press paints the inset face');
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?queue-bar-action::before[\s\S]*?transition:\s*none/);
	});

	test('composer reference remove keeps pressed surface above hover and focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hoverIndex = css.indexOf('.conversation-composer-ref-remove:hover');
		const focusIndex = css.indexOf('.monaco-workbench:not(.hc-black):not(.hc-light) .part.conversation .conversation-composer-ref-remove:focus-visible');
		const hcFocusIndex = css.indexOf('.monaco-workbench.hc-black .part.conversation .conversation-composer-ref-remove:focus-visible');
		const activeIndex = css.indexOf('.monaco-workbench .part.conversation .conversation-composer-ref-remove:active');
		assert.ok(hoverIndex >= 0, 'reference remove needs a hover surface');
		assert.ok(focusIndex >= 0 && hcFocusIndex >= 0, 'reference remove needs normal and high-contrast focus surfaces');
		assert.ok(activeIndex >= 0, 'reference remove needs a pressed surface');
		assert.ok(activeIndex > hoverIndex && activeIndex > focusIndex && activeIndex > hcFocusIndex, 'pressed surface must follow hover and keyboard focus surfaces');
		assert.match(css, /conversation-composer-ref-remove::before\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /conversation-composer-ref-remove:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-composer-ref-remove:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-composer-ref-remove::before[\s\S]*?transition:\s*none/);
	});

	test('engine snapshot no-hook copy does not leak API', () => {
		const strings = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensSessionBarStrings.ts'), 'utf8');
		assert.ok(strings.includes('Engine snapshots unavailable on this client.'));
		assert.ok(!strings.includes('snapshot list API'));
		assert.ok(!strings.includes('no snapshot list API'));
	});

	test('Inspect compact values wrap instead of clipping at a fixed row height', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/agentInspect.css'), 'utf8');
		const view = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/agentInspectView.ts'), 'utf8');
		assert.ok(css.includes('.is-compact .agent-inspect-entry-value'));
		assert.ok(css.includes('white-space: normal'));
		assert.ok(view.includes('hasDynamicHeight'));
		assert.ok(view.includes('supportDynamicHeights: true'));
	});

	test('Maximize and session switch close History/Snapshots; More stays session actions', () => {
		const lens = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLens.ts'), 'utf8');
		const binding = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts'), 'utf8');
		const sessionBar = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts'), 'utf8');
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		assert.ok(lens.includes('this.engineHistoryList?.close()'));
		assert.ok(lens.includes('this.engineSnapshotsList?.close()'));
		// d52e33b3bad passes restoreFocus:false so the session-switch close keeps
		// focus on the newly revealed lens instead of the closed panel anchor.
		assert.ok(binding.includes('host.engineHistoryList?.close({ restoreFocus: false })'));
		assert.ok(binding.includes('host.engineSnapshotsList?.close({ restoreFocus: false })'));
		assert.ok(!sessionBar.includes('conversationLensSessionBarGoBack'));
		assert.ok(!sessionBar.includes('trySessionBarWindowNav'));
		assert.ok(sessionBar.includes('conversationLensSessionBarHistory'));
		assert.ok(css.includes('.is-narrow .conversation-lens-snapshots-row'));
		assert.ok(css.includes('flex-wrap: wrap'));
	});

	test('Connection connect writes are held during in-flight, pairing-hold, and live SAS', () => {
		const pane = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts'), 'utf8');
		assert.ok(pane.includes('isConnectWriteHeld'));
		assert.ok(pane.includes('connectInFlight'));
		assert.ok(pane.includes('applyDisconnectedDevicesRefresh'));
		assert.ok(pane.includes('this.hubDevices = []'));
	});
});

function flatSelector(selector: string): string {
	return selector.replace(/\s+/g, ' ').trim();
}

function isHcOnlySelector(selector: string): boolean {
	const flat = flatSelector(selector);
	return /\.monaco-workbench\.hc-black\b/.test(flat) || /\.monaco-workbench\.hc-light\b/.test(flat);
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
		splitSelectorList(rule.selector).some(selector => {
			const flat = flatSelector(selector);
			return flat.includes(ringNeedle) && !isHcOnlySelector(flat);
		})
	);
	assert.ok(noneIndex >= 0, `missing outline:none !important for ${noneNeedle}`);
	assert.ok(ringIndex > noneIndex, `${ringNeedle} :focus-visible ring must follow outline:none !important`);
}

suite('Conversation lens keyboard focus ring', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('trajectory overview bar stays within 12px and keeps a focus-visible ring', () => {
		const lens = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(lens);
		const track = rules.find(rule => splitSelectorList(rule.selector).some(selector =>
			flatSelector(selector).endsWith('.conversation-lens-trajectory-overview-track')
		));
		assert.ok(track, 'missing overview track rule');
		assert.match(track!.body, /height:\s*12px/);
		assert.match(track!.body, /max-height:\s*12px/);
		const segment = rules.find(rule => splitSelectorList(rule.selector).some(selector =>
			flatSelector(selector).endsWith('.conversation-lens-trajectory-overview-segment')
		));
		assert.ok(segment, 'missing overview segment rule');
		assert.match(segment!.body, /height:\s*12px/);
		assert.match(segment!.body, /max-height:\s*12px/);
		const title = rules.find(rule => splitSelectorList(rule.selector).some(selector =>
			flatSelector(selector).endsWith('.conversation-lens-trajectory-overview-title')
		));
		assert.ok(title, 'missing overview title rule');
		assert.match(title!.body, /text-transform:\s*none/);
		const errorGlyph = rules.find(rule => splitSelectorList(rule.selector).some(selector =>
			flatSelector(selector).includes('[data-segment-kind="error"]') &&
			flatSelector(selector).endsWith('.conversation-lens-trajectory-overview-segment-glyph')
		));
		assert.ok(errorGlyph, 'missing error glyph rule');
		assert.doesNotMatch(errorGlyph!.body, /rotate\(45deg\)/);
		assertFocusVisibleRingFollowsNone(
			lens,
			'.conversation-lens-trajectory-overview-segment:focus',
			'.conversation-lens-trajectory-overview-segment:focus-visible',
		);
	});

	test('trajectory search keeps quiet keyboard focus in normal themes and a contrast ring in HC', () => {
		const lens = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(lens);
		const normal = rules.find(rule => rule.selector.includes('.conversation-lens-trajectory-search:focus-visible') && rule.selector.includes(':not(.hc-black):not(.hc-light)'));
		assert.ok(normal, 'missing normal-theme trajectory search focus rule');
		assert.match(normal!.body, /outline\s*:\s*none\s*!important/);
		assert.doesNotMatch(normal!.body, /focusBorder/);
		const highContrast = rules.find(rule => rule.selector.includes('.conversation-lens-trajectory-search:focus-visible') && (rule.selector.includes('.hc-black') || rule.selector.includes('.hc-light')) && !rule.selector.includes(':not(.hc-black):not(.hc-light)'));
		assert.ok(highContrast, 'missing HC trajectory search focus rule');
		assert.match(highContrast!.body, /contrastActiveBorder/);
		assert.match(highContrast!.body, /outline\s*:\s*1px/);
	});

	test('conversation canvas uses conversation.background; history and diff stay on editor.background', () => {
		const read = (relative: string) => stripCssComments(fs.readFileSync(path.join(repoRoot, relative), 'utf8'));
		const files = [
			read('src/vs/workbench/browser/parts/conversation/media/conversationPart.css'),
			read('src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'),
			read('src/vs/workbench/contrib/conversation/browser/media/conversationTimeline.css'),
			read('src/vs/workbench/contrib/conversation/browser/media/conversationIdentityStrip.css'),
		];
		const rules = files.flatMap(collectCssRules);
		const canvasSelectors = [
			'.part.conversation',
			'.conversation-dock',
			'.conversation-lens-timeline',
			'.conversation-lens-trajectory',
			'.conversation-timeline-pinned',
			'.conversation-identity-strip',
			'.conversation-lens-reading-column',
		];
		for (const suffix of canvasSelectors) {
			const matches = rules.filter(candidate => splitSelectorList(candidate.selector).some(selector => selector.trim().endsWith(suffix) && /background/.test(candidate.body)));
			assert.ok(matches.length > 0, `missing canvas background for ${suffix}`);
			assert.ok(matches.some(rule => /var\(--vscode-conversation-background,\s*var\(--vscode-editor-background\)\)/.test(rule.body)), suffix);
		}
		const history = rules.find(candidate => candidate.selector.trim().endsWith('.conversation-lens-history-panel'));
		assert.ok(history);
		assert.match(history!.body, /background-color:\s*var\(--vscode-editor-background\)/);
		const diff = rules.find(candidate => candidate.selector.trim().endsWith('.conversation-diff-fallback'));
		assert.ok(diff);
		assert.match(diff!.body, /background-color:\s*var\(--vscode-editor-background\)/);
	});

	test('lens tabs and SessionBar buttons use quiet focus surfaces', () => {
		const lens = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const part = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/conversationPart.css'), 'utf8'));

		const tabFocus = collectCssRules(lens).find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab:focus-visible::before');
		assert.ok(tabFocus);
		assert.match(tabFocus!.body, /background-color\s*:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.doesNotMatch(tabFocus!.body, /outline\s*:/);
		const hcTabFocus = collectCssRules(lens).find(rule => rule.selector.includes('.hc-black') && rule.selector.includes('.conversation-lens-lens-tab:focus-visible'));
		assert.ok(hcTabFocus, 'high contrast lens tabs keep a visible contrast focus indicator');
		assert.match(hcTabFocus!.body, /outline\s*:\s*2px\s+solid\s+var\(--vscode-contrastActiveBorder/);
		assert.strictEqual(
			collectCssRules(lens).find(rule => rule.selector.includes('.conversation-lens-lens-tab[aria-selected="true"]:focus-visible')),
			undefined,
		);
		const selectedTab = collectCssRules(lens).find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-lens-tab[aria-selected="true"]');
		assert.ok(selectedTab);
		assert.doesNotMatch(selectedTab!.body, /outline\s*:/, 'selected tab must not override the HC focus ring');
		const normalSessionButtonFocus = collectCssRules(lens).find(rule => rule.selector.includes('.conversation-lens-session-controls .monaco-button:focus-visible') && rule.selector.includes(':not(.hc-black):not(.hc-light)'));
		assert.ok(normalSessionButtonFocus);
		assert.match(normalSessionButtonFocus!.body, /outline:\s*none\s*!important/);
		assert.match(normalSessionButtonFocus!.body, /toolbar-hoverBackground/);
		assert.doesNotMatch(normalSessionButtonFocus!.body, /focusBorder/);
		const hcSessionButtonFocus = collectCssRules(lens).find(rule => rule.selector.includes('.hc-black') && rule.selector.includes('.conversation-lens-session-controls .monaco-button:focus-visible'));
		assert.ok(hcSessionButtonFocus);
		assert.ok(part.includes('.conversation-lens-session-bar'));
	});

	test('S9: filter chips, search boxes, and engine catalog group/row heights follow visual specification', () => {
		const lensCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		const sourcesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesTabs.css'), 'utf8');
		const enginePaneCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		const engineMcpSource = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts'), 'utf8');
		const engineAgentsSource = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/engineAgentsSection.ts'), 'utf8');
		const devListCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/connectionDeviceList.css'), 'utf8');

		// 1. Lens tabs: 32px hit target, inset active surface, unbolded selected state
		assert.match(lensCss, /\.conversation-lens-lens-tab\s*\{[^}]*height:\s*32px/s);
		assert.match(lensCss, /\.conversation-lens-lens-tab\s*\{[^}]*line-height:\s*32px/s);
		assert.match(lensCss, /\.conversation-lens-lens-tab\[aria-selected="true"\]::before\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground\)/s);
		assert.match(lensCss, /\.conversation-lens-lens-tab\[aria-selected="true"\]\s*\{[^}]*font-weight:\s*400/s);
		// The editable session title shares the session bar with 28px icon controls.
		// Keep its button hit target aligned without changing the compact visual face.
		assert.match(lensCss, /\.conversation-lens-session-title\s*\{[^}]*height:\s*28px/s);
		assert.match(lensCss, /\.conversation-lens-session-title\s*\{[^}]*line-height:\s*28px/s);

		// 2. Sources tabs: 24px height, line-height 24px, unbolded selected state with toolbar-hoverBackground
		assert.match(sourcesCss, /\.sources-tab\s*\{[^}]*height:\s*24px/s);
		assert.match(sourcesCss, /\.sources-tab\s*\{[^}]*line-height:\s*24px/s);
		assert.match(sourcesCss, /\.sources-tab::before\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(sourcesCss, /\.sources-tab:hover:not\(\.selected\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(sourcesCss, /\.sources-tab:hover:not\(\.selected\)::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(sourcesCss, /\.sources-tab:active:not\(\.selected\)::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(sourcesCss, /\.sources-tab:focus-visible:not\(\.selected\)::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(sourcesCss, /\.sources-tab\.selected\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground\)/s);
		assert.match(sourcesCss, /\.sources-tab\.selected\s*\{[^}]*font-weight:\s*400/s);

		// 3. Engine navigation: 22px, theme list surfaces, cornerRadius.small, font-weight 400
		assert.match(enginePaneCss, /\.engine-preferences-nav-row\s*\{[^}]*height:\s*22px/s);
		assert.match(enginePaneCss, /\.engine-preferences-nav-row\s*\{[^}]*border-radius:\s*var\(--vscode-cornerRadius-small/s);
		assert.match(enginePaneCss, /\.engine-preferences-nav-row:hover:not\(\.selected\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(enginePaneCss, /\.engine-preferences-nav-row:hover:not\(\.selected\)::before\s*\{[^}]*var\(--vscode-list-hoverBackground\)/s);
		assert.match(enginePaneCss, /\.engine-preferences-nav-row\.selected\s*\{[^}]*var\(--vscode-list-inactiveSelectionBackground\)/s);
		assert.match(enginePaneCss, /\.engine-preferences-nav \.monaco-list:focus \.engine-preferences-nav-row\.selected\s*\{[^}]*var\(--vscode-list-activeSelectionBackground\)/s);
		assert.match(enginePaneCss, /\.engine-preferences-nav-row\.selected \.engine-preferences-nav-label\s*\{[^}]*font-weight:\s*400/s);
		assert.match(enginePaneCss, /\.engine-preferences-nav \.monaco-list:focus \.monaco-list-row\.focused\.selected\s*\{[^}]*outline:\s*none !important/s);
		assert.match(enginePaneCss, /\.engine-preferences-nav \.monaco-list:focus-visible \.monaco-list-row\.focused\s*\{[^}]*outline:\s*1px solid var\(--vscode-focusBorder\) !important/s);
		assert.match(enginePaneCss, /\.engine-preferences-pane input\[type="search"\][\s\S]*?\{[^}]*background-color:\s*color-mix\(in srgb, var\(--vscode-foreground\) 6%, transparent\)/);
		assert.match(enginePaneCss, /\.engine-preferences-pane input\[type="search"\][\s\S]*?\{[^}]*background-image:/);

		// 4. Engine MCP tabs: 24px height, active foreground mix, font-weight 400
		assert.match(engineMcpSource, /engine-mcp-tab-bar/);
		assert.match(engineMcpSource, /setAttribute\('role', 'tab'\)/);
		assert.match(engineAgentsSource, /engine-mcp-tab-bar/);
		assert.match(engineAgentsSource, /setAttribute\('role', 'tab'\)/);
		assert.match(enginePaneCss, /\.engine-mcp-tab-bar \.monaco-button\s*\{[^}]*height:\s*24px/s);
		assert.match(enginePaneCss, /\.engine-mcp-tab-bar \.monaco-button\[aria-selected="true"\]\s*\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 8%, transparent\)/s);

		// 5. Engine catalog group headers and counts
		assert.match(enginePaneCss, /\.engine-catalog-group\s*\{[^}]*height:\s*24px/s);
		assert.match(enginePaneCss, /\.engine-skill-group[^}]*height:\s*24px/s);
		assert.match(enginePaneCss, /\.engine-catalog-group-count/);
		assert.match(enginePaneCss, /\.engine-skill-group-count/);

		// 6. Engine catalog rows: 24px height
		assert.match(enginePaneCss, /\.engine-catalog-row\s*\{[^}]*height:\s*24px/s);
		assert.match(enginePaneCss, /\.engine-skill-row\s*\{[^}]*height:\s*24px/s);

		// 7. Engine preferences search input: 24px rounded pill
		assert.match(enginePaneCss, /\.engine-preferences-search-input[^}]*height:\s*24px/s);
		assert.match(enginePaneCss, /\.engine-preferences-search-input[^}]*border-radius:\s*var\(--vscode-cornerRadius-circle,\s*9999px\)/s);

		// 8. Connection device list isolated row height: 24px
		assert.match(devListCss, /\.connection-hub-devices-list \.connection-hub-device-row\s*\{[^}]*height:\s*24px/s);
	});

	test('reading body stays 13px and the latest assistant action row is in document flow', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const reading = rules.find(rule => rule.selector.trim().endsWith('.conversation-lens-turn-body--reading-text') && /font-size\s*:/.test(rule.body));
		assert.ok(reading);
		assert.match(reading!.body, /font-size:\s*13px/);
		assert.match(reading!.body, /line-height:\s*1\.5/);
		assert.ok(!/16px/.test(reading!.body));

		const codeBlock = rules.find(rule => rule.selector.trim().endsWith('.conversation-code-block') && /border\s*:/.test(rule.body));
		assert.ok(codeBlock);
		assert.match(codeBlock!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 8%, transparent\)/);
		assert.match(codeBlock!.body, /cornerRadius-medium/);
		assert.ok(!/border:\s*none/.test(codeBlock!.body));

		const actions = rules.find(rule => rule.selector.trim().endsWith('.conversation-lens-turn-actions') && /position\s*:/.test(rule.body));
		assert.ok(actions);
		assert.match(actions!.body, /position:\s*absolute/);
		assert.ok(!/position:\s*static/.test(actions!.body), 'hidden action rows stay out of flow');
		const latest = rules.find(rule => rule.selector.includes('.conversation-timeline-item--latest-assistant') && rule.selector.includes('.conversation-lens-turn-actions') && /position\s*:/.test(rule.body));
		assert.ok(latest);
		assert.match(latest!.body, /position:\s*static/);
		assert.match(latest!.body, /opacity:\s*1/);
		const narrow = rules.find(rule => rule.selector.includes('299px') && rule.selector.includes('.conversation-lens-turn-actions'));
		assert.strictEqual(narrow, undefined, 'narrow reading column must not force every action row visible');
	});

	test('assistant action bars keep compact tokenized hit areas and reveal on hover or keyboard focus', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(css);
		const actions = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-turn-actions');
		assert.ok(actions, 'assistant action row rule');
		assert.match(actions!.body, /gap\s*:\s*var\(--vscode-spacing-size20,\s*2px\)/);
		assert.match(actions!.body, /padding-top\s*:\s*var\(--vscode-spacing-size20,\s*2px\)/);
		assert.match(actions!.body, /opacity\s*:\s*0/);
		assert.match(actions!.body, /pointer-events\s*:\s*none/);

		const reveal = rules.find(rule => rule.selector.includes('.conversation-lens-turn:hover') && rule.selector.includes('.conversation-lens-turn:focus-within'));
		assert.ok(reveal, 'hover and focus-within reveal the secondary action row');
		assert.match(reveal!.body, /opacity\s*:\s*1/);
		assert.match(reveal!.body, /pointer-events\s*:\s*auto/);

		const button = rules.find(rule => rule.selector.trim() === '.monaco-workbench .part.conversation .conversation-lens-turn-actions .monaco-button');
		assert.ok(button, 'action buttons keep a compact target');
		assert.match(button!.body, /width\s*:\s*22px/);
		assert.match(button!.body, /height\s*:\s*22px/);
		assert.match(button!.body, /border-radius\s*:\s*var\(--vscode-cornerRadius-small,\s*4px\)/);
		assert.match(button!.body, /font-size\s*:\s*var\(--vscode-codiconFontSize,\s*16px\)/);

		const ordinaryKeyboard = rules.find(rule => rule.selector.includes('.monaco-workbench:not(.hc-black):not(.hc-light)') && rule.selector.includes('.conversation-lens-turn-actions .monaco-button:focus-visible'));
		assert.ok(ordinaryKeyboard, 'ordinary action focus uses a quiet surface');
		assert.match(ordinaryKeyboard!.body, /outline\s*:\s*none/);
		assert.match(ordinaryKeyboard!.body, /background-color:\s*transparent/);
		const ordinaryKeyboardFace = rules.find(rule => rule.selector.includes('.conversation-lens-turn-actions .monaco-button:focus-visible::after'));
		assert.ok(ordinaryKeyboardFace, 'ordinary action focus paints an inset face');
		assert.match(ordinaryKeyboardFace!.body, /toolbar-hoverBackground/);
		const highContrast = rules.find(rule => rule.selector.includes('.monaco-workbench.hc-black') && rule.selector.includes('.conversation-lens-turn-actions .monaco-button:focus-visible'));
		assert.ok(highContrast, 'high contrast action focus ring');
		assert.match(highContrast!.body, /contrastActiveBorder/);

		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*\.conversation-lens-turn-actions[\s\S]*transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.conversation-lens-turn-actions[\s\S]*transition:\s*none/);
	});

	test('status marks stay visible and lens transitions stay within 100ms', () => {
		const lens = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		assert.ok(!/0\.1[2-9]s/.test(lens), 'conversationLens.css transitions stay at 100ms');
		const rules = collectCssRules(lens);
		const hiddenChevron = rules.find(rule => rule.selector.includes('.conversation-process-fold-chevron') && /opacity\s*:\s*0\b/.test(rule.body));
		assert.strictEqual(hiddenChevron, undefined, 'process-fold chevron stays opaque');
		const hiddenSummary = rules.find(rule => rule.selector.includes('.conversation-process-fold-thinking-summary') && /display\s*:\s*none/.test(rule.body));
		assert.strictEqual(hiddenSummary, undefined, 'thinking summary stays in the row');

		const identity = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationIdentityStrip.css'), 'utf8'));
		const online = collectCssRules(identity).find(rule => rule.selector.trim().endsWith('.conversation-identity-chip-engine::before'));
		assert.ok(online);
		assert.match(online!.body, /display:\s*inline-block/);
		assert.ok(!/display\s*:\s*none/.test(online!.body), 'engine status dot stays visible');
	});

	test('connection and provider chrome stay on small radii', () => {
		const connection = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/connectionPreferencesPane.css'), 'utf8'));
		const connectionRules = collectCssRules(connection);
		const status = connectionRules.find(rule => rule.selector.includes('.connection-status.is-success') && /border-radius\s*:/.test(rule.body));
		assert.ok(status);
		assert.match(status!.body, /cornerRadius-small/);
		assert.ok(!/border-radius:\s*8px/.test(status!.body));
		const pairing = connectionRules.find(rule => rule.selector.trim().endsWith('.connection-pairing-confirm') && /border-radius\s*:/.test(rule.body));
		assert.ok(pairing);
		assert.match(pairing!.body, /cornerRadius-small/);
		assert.ok(!/12px/.test(pairing!.body));

		const engine = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8'));
		// 8252bdfdd57 replaced the provider switch with icon actions on the write
		// toolbar; those buttons are the provider chrome that must stay small.
		const provider = collectCssRules(engine).find(rule => rule.selector.includes('.engine-providers-section .engine-catalog-write-toolbar .monaco-button') && /border-radius\s*:/.test(rule.body));
		assert.ok(provider);
		assert.match(provider!.body, /cornerRadius-small/);
		assert.ok(!/border-radius:\s*8px/.test(provider!.body));
		assert.ok(!/12px/.test(provider!.body));
	});

	test('scroll-to-bottom keeps a hairline and user prose uses the reading line-height', () => {
		const lens = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const rules = collectCssRules(lens);
		const scrollDown = rules.find(rule => rule.selector.trim().endsWith('.conversation-timeline-scroll-down') && /border\s*:/.test(rule.body));
		assert.ok(scrollDown);
		assert.match(scrollDown!.body, /color-mix\(in srgb, var\(--vscode-foreground\) 8%, transparent\)/);
		assert.match(scrollDown!.body, /var\(--vscode-widget-shadow\)/);
		assert.ok(!/rgba\(/.test(scrollDown!.body));
		const keyboard = rules.find(rule => rule.selector.includes('.conversation-timeline-scroll-down:focus-visible'));
		assert.ok(keyboard);
		assert.match(keyboard!.body, /outline:\s*none\s*!important/);
		assert.match(keyboard!.body, /background-color:\s*transparent/);
		assert.doesNotMatch(keyboard!.body, /focusBorder/);
		const keyboardFace = rules.find(rule => rule.selector.includes('.conversation-timeline-scroll-down:focus-visible::before'));
		assert.ok(keyboardFace, 'scroll-down focus paints an inset face');
		assert.match(keyboardFace!.body, /toolbar-hoverBackground/);
		assert.match(lens, /conversation-timeline-scroll-down::before\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(lens, /conversation-timeline-scroll-down:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(lens, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-timeline-scroll-down::before[\s\S]*?transition:\s*none/);
		const hc = rules.find(rule => rule.selector.includes('.hc-black') && rule.selector.includes('.conversation-timeline-scroll-down') && /box-shadow\s*:/.test(rule.body));
		assert.ok(hc);
		assert.match(hc!.body, /contrastBorder/);
		assert.match(hc!.body, /box-shadow:\s*none/);

		const bubble = rules.find(rule => rule.selector.trim().endsWith('.conversation-lens-turn-body--user-bubble') && /line-height\s*:/.test(rule.body));
		assert.ok(bubble);
		assert.match(bubble!.body, /line-height:\s*1\.5/);
		assert.ok(!/1\.55/.test(bubble!.body));

		const part = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/conversationPart.css'), 'utf8');
		const sessions = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessions.css'), 'utf8');
		assert.ok(!/0\.12s/.test(part));
		assert.ok(!/0\.12s/.test(sessions));
	});

	test('conversation styles use only whole-pixel font sizes and the 400 / 600 weights', () => {
		const dirs = ['src/vs/workbench/contrib/conversation/browser/media', 'src/vs/workbench/browser/parts/conversation/media'];
		for (const dir of dirs) {
			for (const file of fs.readdirSync(path.join(repoRoot, dir)).filter(name => name.endsWith('.css'))) {
				const css = stripCssComments(fs.readFileSync(path.join(repoRoot, dir, file), 'utf8'));
				assert.ok(!/font-size\s*:\s*\d+\.\d+px/.test(css), `${file}: half-pixel font-size`);
				assert.ok(!/font-weight\s*:\s*(500|700|bold)\b/.test(css), `${file}: font-weight outside 400 / 600`);
			}
		}
	});

	test('session roster selection is a background, not a left bar', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessions.css'), 'utf8'));
		assert.ok(!/\.conversation-sessions-item-active[^{]*\{[^}]*border-left/.test(css));
		assert.match(css, /\.conversation-sessions-item-icon--failed[\s\S]*errorForeground/);
		assert.match(css, /\.conversation-sessions-item-more/);
	});

	test('session keyboard focus uses row state and HC contrast instead of focusBorder rings', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessions.css'), 'utf8'));
		assert.match(css, /\.conversation-sessions-item-more:focus-visible\s*\{[^}]*outline:\s*none[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground\)/s);
		assert.match(css, /\.monaco-workbench\.hc-black[\s\S]*\.conversation-sessions-list \.monaco-list:focus-visible \.monaco-list-row\.focused[\s\S]*outline:\s*1px solid var\(--vscode-contrastActiveBorder/s);
		assert.doesNotMatch(css, /conversation-sessions-list[\s\S]*focus-visible[\s\S]*outline:\s*1px solid var\(--vscode-focusBorder/);
	});

	test('session list rows keep the hit target while pressing an inset face', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessions.css'), 'utf8'));
		const rules = collectCssRules(css);
		const row = rules.find(rule => rule.selector.trim() === '.monaco-workbench .conversation-sessions-list .monaco-list-row');
		assert.ok(row, 'session list row keeps an anchored hit target');
		assert.match(row!.body, /position:\s*relative/);
		assert.match(row!.body, /isolation:\s*isolate/);
		const face = rules.find(rule => rule.selector.trim() === '.monaco-workbench .conversation-sessions-list .monaco-list-row::before');
		assert.ok(face, 'session list row needs an inset visual face');
		assert.match(face!.body, /inset:\s*1px 4px/);
		assert.match(css, /conversation-sessions-list \.monaco-list-row:hover:not\(\.selected\):not\(:has\(\.conversation-sessions-group\)\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-sessions-list \.monaco-list-row:hover:not\(\.selected\):not\(:has\(\.conversation-sessions-group\)\)::before\s*\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 2\.5%, transparent\)/s);
		assert.match(css, /conversation-sessions-list \.monaco-list:focus-visible \.monaco-list-row\.focused:not\(\.selected\):not\(:has\(\.conversation-sessions-group\)\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-sessions-list \.monaco-list:focus-visible \.monaco-list-row\.focused:not\(\.selected\):not\(:has\(\.conversation-sessions-group\)\)::before\s*\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 4%, transparent\)/s);
		assert.match(css, /conversation-sessions-list \.monaco-list-row:active:not\(\.selected\):not\(:has\(\.conversation-sessions-group\)\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /conversation-sessions-list \.monaco-list-row:active:not\(\.selected\):not\(:has\(\.conversation-sessions-group\)\)::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?conversation-sessions-list \.monaco-list-row::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?conversation-sessions-list \.monaco-list-row::before[\s\S]*?transition:\s*none/);
	});

	test('markdown headings use heading tokens instead of em multipliers', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const headings = collectCssRules(css).filter(rule => rule.selector.includes('.rendered-markdown') && /\bh[1-6]\b/.test(rule.selector) && /font-size\s*:/.test(rule.body));
		assert.ok(headings.length > 0);
		for (const heading of headings) {
			assert.match(heading.body, /font-size:\s*var\(--vscode-fontSize-heading[23]/, heading.selector);
		}
	});
});
