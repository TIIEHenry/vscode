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
		assert.ok(!/\{\s*\n\s*\.monaco-workbench/.test(css));
	});

	test('composer edit header stays hidden until an edit is active', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const hiddenRule = collectCssRules(css).find(rule => rule.selector.includes('.conversation-lens-composer-edit-header[hidden]'));
		assert.ok(hiddenRule, 'edit header needs an author [hidden] rule; display:flex overrides the UA hidden style');
		assert.ok(hidesDisplayNone(hiddenRule.body));
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

	test('timeline articles suppress the workbench tabindex focus outline', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationTimeline.css'), 'utf8'));
		const rule = collectCssRules(css).find(candidate => candidate.selector.includes('.conversation-timeline-item:focus-visible'));
		assert.ok(rule, 'timeline article focus needs outline:none to beat the workbench tabindex ring');
		assert.ok(rule.selector.includes('.monaco-workbench:not(.hc-black):not(.hc-light)'));
		assert.ok(rule.selector.includes('.conversation-timeline-item:focus'));
		assert.ok(/outline\s*:\s*none\s*!important/.test(rule.body));
		const painted = collectCssRules(css).filter(candidate =>
			/\.conversation-timeline-item:focus/.test(candidate.selector) && /outline\s*:\s*1px/.test(candidate.body));
		assert.strictEqual(painted.length, 0);
	});

	test('narrow SessionBar CSS shows More instead of New/Delete', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		assert.ok(!css.includes('.is-medium .conversation-lens-session-more'));
		assert.ok(css.includes('.is-narrow .conversation-lens-session-more'));
		assert.ok(css.includes('.is-narrow .conversation-lens-session-new'));
		assert.ok(css.includes('.is-narrow .conversation-lens-session-delete'));
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

	test('medium leaf CSS keeps SessionBar History, Snapshots, and window-nav on the bar', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		assert.ok(!css.includes('.is-medium .conversation-lens-session-history'));
		assert.ok(!css.includes('.is-medium .conversation-lens-session-snapshots'));
		assert.ok(!css.includes('.is-medium .conversation-window-nav'));
		assert.ok(css.includes('.is-narrow .conversation-lens-session-history'));
		assert.ok(css.includes('.is-narrow .conversation-window-nav'));
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

	test('trajectory table and engine nav rows stay 22px without uppercase kind chrome', () => {
		const lensCss = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const engineCss = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8'));
		const lensRules = collectCssRules(lensCss);
		const engineRules = collectCssRules(engineCss);

		const recordRow = lensRules.find(rule => rule.selector.includes('.conversation-lens-trajectory-record-row') && /height\s*:\s*22px/.test(rule.body));
		assert.ok(recordRow, 'trajectory record row must be 22px');
		const foldHeader = lensRules.find(rule => rule.selector.includes('.conversation-lens-trajectory .conversation-process-fold-header') && /height\s*:\s*22px/.test(rule.body));
		assert.ok(foldHeader, 'trajectory fold header must be 22px');

		const header = lensRules.find(rule => rule.selector.includes('.conversation-lens-trajectory-table-header'));
		assert.ok(header);
		assert.ok(!/text-transform\s*:\s*uppercase/.test(header!.body));
		assert.ok(!/editor-inactiveSelectionBackground/.test(header!.body));
		assert.ok(!/background-color\s*:/.test(header!.body));

		for (const rule of lensRules.filter(candidate => candidate.selector.includes('.conversation-lens-trajectory-table-kind'))) {
			assert.ok(!/text-transform\s*:\s*uppercase/.test(rule.body), rule.selector);
		}

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
		const badge = engineRules.find(rule => rule.selector.trim().endsWith('.engine-preferences-nav-badge'));
		assert.ok(badge);
		assert.match(badge!.body, /background\s*:\s*none/);
		assert.ok(!/badge-background/.test(badge!.body));
	});

	test('composer card uses the capsule input style and a 28px send control', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const dock = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensDock.ts'), 'utf8');
		const rule = (selectorIncludes: string, bodyIncludes?: string) => collectCssRules(css).find(candidate => {
			if (!candidate.selector.includes(selectorIncludes)) {
				return false;
			}
			return bodyIncludes === undefined || candidate.body.includes(bodyIncludes);
		});

		const cluster = rule('.conversation-lens-composer-cluster', 'padding:');
		assert.ok(cluster);
		assert.match(cluster!.body, /padding:\s*6px 12px 8px\s*;/);
		assert.ok(!/42px/.test(cluster!.body));

		const composer = collectCssRules(css).find(candidate => candidate.selector.trim().endsWith('.conversation-lens-composer') && /border-radius/.test(candidate.body));
		assert.ok(composer);
		assert.match(composer!.body, /border-radius:\s*16px/);
		assert.match(composer!.body, /box-shadow:\s*0 4px 12px 0 rgba\(0,\s*0,\s*0,\s*0\.02\)/);

		const focus = rule('.conversation-lens-composer:focus-within');
		assert.ok(focus);
		assert.match(focus!.body, /focusBorder/);
		assert.ok(!/box-shadow/.test(focus!.body));

		const bar = rule('.conversation-lens-dock-bottom-bar', 'min-height: 28px');
		assert.ok(bar);
		assert.match(bar!.body, /padding:\s*2px 8px 6px\s*;/);
		assert.match(bar!.body, /gap:\s*8px/);

		const send = rule('.conversation-lens-dock-send-button.monaco-button', 'width: 28px');
		assert.ok(send);
		assert.match(send!.body, /rgb\(65,\s*118,\s*230\)/);

		const sendDisabled = rule('.conversation-lens-dock-send-button.monaco-button.disabled');
		assert.ok(sendDisabled);
		assert.match(sendDisabled!.body, /opacity:\s*0\.4/);
		assert.ok(!/foreground\)\s*18%/.test(sendDisabled!.body));
		const sendSection = css.slice(css.indexOf('.conversation-lens-dock-send-button'), css.indexOf('.conversation-lens-dock-permission'));
		assert.ok(!/filter\s*:/.test(sendSection));

		const select = rule('.conversation-lens-dock-model .monaco-select-box', 'border:');
		assert.ok(select);
		assert.match(select!.body, /border:\s*none\s*!important/);
		const selectDisabled = rule('.conversation-lens-dock-model .monaco-select-box:disabled');
		assert.ok(selectDisabled);
		assert.match(selectDisabled!.body, /disabledForeground/);

		const controlFocus = rule('.conversation-lens-dock-control.monaco-button:focus-visible');
		assert.ok(controlFocus);
		assert.match(controlFocus!.body, /focusBorder/);

		assert.ok(!dock.includes('newWorktree'));
		assert.ok(!dock.includes('conversation-lens-dock-worktree'));
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
		assert.ok(contribution.includes("querySelector('.conversation-timeline')"));
		assert.ok(binding.includes('host: host.slotHosts.timeline'));
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

	test('Maximize and session switch close History/Snapshots; More includes window nav', () => {
		const lens = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLens.ts'), 'utf8');
		const binding = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensSessionBinding.ts'), 'utf8');
		const sessionBar = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensSessionBar.ts'), 'utf8');
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		assert.ok(lens.includes('this.engineHistoryList?.close()'));
		assert.ok(lens.includes('this.engineSnapshotsList?.close()'));
		assert.ok(binding.includes('host.engineHistoryList?.close()'));
		assert.ok(binding.includes('host.engineSnapshotsList?.close()'));
		assert.ok(sessionBar.includes('conversationLensSessionBarGoBack'));
		assert.ok(sessionBar.includes('trySessionBarWindowNav'));
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

	test('lens tab and session bar button keep a focus-visible focusBorder ring', () => {
		const lens = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		const part = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/conversationPart.css'), 'utf8'));

		assertFocusVisibleRingFollowsNone(lens, '.conversation-lens-lens-tab:focus', '.conversation-lens-lens-tab:focus-visible');
		assertFocusVisibleRingFollowsNone(lens, '.conversation-lens-lens-tab[aria-selected="true"]', '.conversation-lens-lens-tab[aria-selected="true"]:focus-visible');
		assertFocusVisibleRingFollowsNone(lens, '.conversation-lens-session-bar .monaco-button:focus', '.conversation-lens-session-bar .monaco-button:focus-visible');
		assertFocusVisibleRingFollowsNone(lens, '.conversation-lens-session-controls .monaco-button:focus', '.conversation-lens-session-controls .monaco-button:focus-visible');
		assertFocusVisibleRingFollowsNone(lens, '.conversation-window-nav .monaco-button:focus', '.conversation-window-nav .monaco-button:focus-visible');

		assertFocusVisibleRingFollowsNone(part, '.conversation-session-bar .monaco-button:focus', '.conversation-session-bar .monaco-button:focus-visible');
		assertFocusVisibleRingFollowsNone(part, '.conversation-lens-session-bar .monaco-button:focus', '.conversation-lens-session-bar .monaco-button:focus-visible');
		assertFocusVisibleRingFollowsNone(part, '.conversation-window-nav .monaco-button:focus', '.conversation-window-nav .monaco-button:focus-visible');
	});
});
