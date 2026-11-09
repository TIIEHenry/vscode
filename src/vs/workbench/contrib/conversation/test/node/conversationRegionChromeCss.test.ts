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

	test('hide control and session title row are 36px, hit target 28px', () => {
		const part = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/conversationPart.css'), 'utf8');
		const lens = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationLens.css'), 'utf8');
		const nav = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationNavigation.css'), 'utf8');

		const chrome = ruleBody(part, '.monaco-workbench .part.conversation > .conversation-region-chrome');
		assert.match(chrome, /height:\s*36px/);
		assert.doesNotMatch(chrome, /height:\s*35px/);

		const label = ruleBody(part, '.monaco-workbench .part.conversation > .conversation-region-chrome .title-actions .action-label');
		assert.match(label, /width:\s*28px/);
		assert.match(label, /height:\s*28px/);
		assert.match(label, /padding:\s*0/);
		assert.match(label, /background-color:\s*transparent/);
		const face = ruleBody(part, '.monaco-workbench .part.conversation > .conversation-region-chrome .title-actions .action-label::after');
		assert.match(face, /inset:\s*1px 2px/);
		assert.match(face, /background-color:\s*transparent/);

		const sessionBar = ruleBody(part, '.monaco-workbench .part.conversation .conversation-session-bar');
		assert.match(sessionBar, /height:\s*36px/);
		assert.match(sessionBar, /max-height:\s*36px/);

		const lensBar = ruleBody(lens, '.monaco-workbench .part.conversation .conversation-lens-session-bar');
		assert.match(lensBar, /height:\s*36px/);
		assert.match(lensBar, /max-height:\s*36px/);

		const windowNav = ruleBody(nav, '.monaco-workbench .part.conversation .conversation-window-nav');
		assert.match(windowNav, /height:\s*36px/);
		assert.match(windowNav, /max-height:\s*36px/);
	});

	test('conversation chrome pressed surfaces win over hover and focus surfaces', () => {
		const part = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/conversationPart.css'), 'utf8');
		const titleHover = part.indexOf('.monaco-workbench .part.conversation > .conversation-region-chrome .title-actions .action-label:hover');
		const titlePressed = part.indexOf('.monaco-workbench .part.conversation > .conversation-region-chrome .title-actions .action-label:active');
		assert.ok(titleHover >= 0, 'conversation title action hover surface contract');
		assert.ok(titlePressed > titleHover, 'conversation title action pressed surface must follow hover surface');
		assert.match(part.slice(titlePressed, titlePressed + 260), /background-color:\s*transparent/);
		const titlePressedFace = part.indexOf('.monaco-workbench .part.conversation > .conversation-region-chrome .title-actions .action-label:active::after');
		assert.ok(titlePressedFace > titlePressed, 'conversation title action pressed face must follow host state');
		assert.match(part.slice(titlePressedFace, titlePressedFace + 220), /background-color:\s*var\(--vscode-toolbar-activeBackground/);
		assert.match(part, /\.monaco-workbench\.monaco-reduce-motion \.part\.conversation > \.conversation-region-chrome \.title-actions \.action-label::after\s*\{[^}]*transition:\s*none;/s);
		assert.match(part, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.conversation > \.conversation-region-chrome \.title-actions \.action-label::after\s*\{[^}]*transition:\s*none;/s);

		const sessionHover = part.indexOf('.monaco-workbench .part.conversation .conversation-session-bar .monaco-button:hover:not(.disabled)');
		const sessionPressed = part.indexOf('.monaco-workbench .part.conversation .conversation-session-bar .monaco-button:active:not(.disabled)');
		assert.ok(sessionHover >= 0, 'conversation session action hover surface contract');
		assert.ok(sessionPressed > sessionHover, 'conversation session action pressed surface must follow hover surface');
		assert.match(part.slice(sessionPressed, sessionPressed + 420), /background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});

	test('conversation title action keeps a contrast ring in HC themes', () => {
		const part = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/media/conversationPart.css'), 'utf8');
		assert.match(part, /\.monaco-workbench:is\(\.hc-black, \.hc-light\) \.part\.conversation > \.conversation-region-chrome \.title-actions \.action-label:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder, var\(--vscode-focusBorder\)\) !important/);
		assert.doesNotMatch(part, /\.monaco-workbench:is\(\.hc-black, \.hc-light\) \.part\.conversation > \.conversation-region-chrome \.title-actions \.action-label:focus-visible\s*\{[^}]*background-color:/);
	});

	test('session leaf hide control keeps motion within the 100ms contract and honors reduced motion', () => {
		const sessionWindow = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSessionWindow.css'), 'utf8');
		const hideControl = ruleBody(sessionWindow, '.monaco-workbench .part.conversation .conversation-session-leaf-hide');
		const hideSurface = ruleBody(sessionWindow, '.monaco-workbench .part.conversation .conversation-session-leaf-hide::after');
		assert.match(hideControl, /transition:\s*color 100ms/);
		assert.match(hideSurface, /inset:\s*1px 2px/);
		assert.match(hideSurface, /transition:\s*background-color 100ms/);
		assert.doesNotMatch(sessionWindow, /transition:\s*[^;]*0\.12s/);
		assert.match(sessionWindow, /\.monaco-workbench\.monaco-reduce-motion \.part\.conversation \.conversation-session-leaf-hide\s*\{[^}]*transition:\s*none;/s);
		assert.match(sessionWindow, /\.monaco-workbench\.monaco-reduce-motion \.part\.conversation \.conversation-session-leaf-hide::after\s*\{[^}]*transition:\s*none;/s);
		assert.match(sessionWindow, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.conversation \.conversation-session-leaf-hide\s*\{[^}]*transition:\s*none;/s);
		assert.match(sessionWindow, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.conversation \.conversation-session-leaf-hide::after\s*\{[^}]*transition:\s*none;/s);
	});
});
