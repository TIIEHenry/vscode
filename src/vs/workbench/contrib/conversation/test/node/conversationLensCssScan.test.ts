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
