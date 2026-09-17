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

	test('narrow SessionBar CSS shows More instead of New/Delete', () => {
		const css = stripCssComments(fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8'));
		assert.ok(css.includes('.is-medium .conversation-lens-session-more'));
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

	test('region hide control uses a close glyph and stays keyboard focusable', () => {
		const hide = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/partRegionHideControl.ts'), 'utf8');
		assert.ok(hide.includes('Codicon.close'));
		assert.ok(hide.includes('actionBar.setFocusable(true)'));
		assert.ok(!hide.includes('Codicon.remove'));
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
});
