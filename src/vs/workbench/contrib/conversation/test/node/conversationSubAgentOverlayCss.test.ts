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

suite('Conversation sub-agent overlay chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('overlay action motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSubAgentOverlay.css'), 'utf8');
		assert.match(css, /\.monaco-workbench \.part\.conversation \.conversation-subagent-overlay-actions \.monaco-button\s*\{[^}]*transition:\s*background-color 100ms/s);
		assert.match(css, /\.monaco-workbench \.part\.conversation \.conversation-subagent-overlay-actions \.monaco-button::after\s*\{[^}]*transition:\s*background-color 100ms/s);
		assert.doesNotMatch(css, /transition:\s*[^;]*0\.12s/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.conversation \.conversation-subagent-overlay-actions \.monaco-button\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.part\.conversation \.conversation-subagent-overlay-actions \.monaco-button::after\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.conversation \.conversation-subagent-overlay-actions \.monaco-button\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.part\.conversation \.conversation-subagent-overlay-actions \.monaco-button::after\s*\{[^}]*transition:\s*none;/s);
	});

	test('overlay action buttons keep the native target while pressing an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSubAgentOverlay.css'), 'utf8');
		assert.match(css, /\.conversation-subagent-overlay-actions \.monaco-button\s*\{[^}]*position:\s*relative;[^}]*isolation:\s*isolate;[^}]*background-color:\s*transparent !important;/s);
		assert.match(css, /\.conversation-subagent-overlay-actions \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px;[^}]*pointer-events:\s*none;/s);
		assert.match(css, /\.conversation-subagent-overlay-actions \.monaco-button:hover:not\(\.disabled\)::after,[\s\S]*?background-color:\s*var\(--vscode-toolbar-hoverBackground\)/s);
		assert.match(css, /\.conversation-subagent-overlay-actions \.monaco-button:active:not\(\.disabled\)\s*\{[^}]*background-color:\s*transparent !important;/s);
		assert.match(css, /\.conversation-subagent-overlay-actions \.monaco-button:active:not\(\.disabled\)::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/s);
	});

	test('overlay keyboard focus uses compact feedback while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/conversationSubAgentOverlay.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.part\.conversation \.conversation-subagent-overlay:focus-visible,[\s\S]*?outline:\s*none\s*!important;[\s\S]*?background-color:\s*transparent/s);
		assert.match(css, /\.conversation-subagent-overlay:focus-visible \.conversation-subagent-overlay-card,[\s\S]*?inset 0 0 0 1px var\(--vscode-toolbar-hoverBackground\)/s);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.conversation \.conversation-subagent-overlay:focus-visible,[\s\S]*?outline-color:\s*var\(--vscode-contrastActiveBorder\)/s);
	});
});
