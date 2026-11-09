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

suite('Engine preferences CSS contract', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('button focus uses a quiet ordinary-theme surface and HC contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.engine-preferences-pane \.monaco-button:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground\);/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\) \.engine-preferences-pane \.monaco-button:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder, var\(--vscode-focusBorder\)\);/s);
	});

	test('test engine focus keeps ordinary themes quiet while preserving HC contrast', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.engine-test-row > \.monaco-button:focus-visible\s*\{[^}]*outline:\s*none;[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground\);/s);
		assert.match(css, /\.monaco-workbench:is\(\.hc-black, \.hc-light\) \.engine-test-row > \.monaco-button:focus-visible\s*\{[^}]*outline:\s*1px solid var\(--vscode-contrastActiveBorder, var\(--vscode-focusBorder\)\);/s);
	});

	test('back action keeps its full hit area while painting an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /\.engine-preferences-back\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate[^}]*background:\s*transparent/s);
		assert.match(css, /\.engine-preferences-back::before\s*\{[^}]*inset:\s*1px 2px[^}]*background:\s*var\(--vscode-button-secondaryBackground\)[^}]*pointer-events:\s*none/s);
		assert.match(css, /\.engine-preferences-back:hover\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /\.engine-preferences-back:hover::before\s*\{[^}]*background:\s*var\(--vscode-button-secondaryHoverBackground\)/s);
		assert.match(css, /\.engine-preferences-back:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /\.engine-preferences-back:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\) \.engine-preferences-back:focus-visible\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\) \.engine-preferences-back:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /monaco-reduce-motion[\s\S]*?engine-preferences-back::before[\s\S]*?transition:\s*none/s);
		assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*?engine-preferences-back::before[\s\S]*?transition:\s*none/s);
	});

	test('catalog action buttons keep the host quiet while painting a compact inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /engine-triggers-actions \.monaco-button,[\s\S]*?engine-catalog-icon-actions \.monaco-button\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /engine-triggers-actions \.monaco-button::after,[\s\S]*?engine-catalog-icon-actions \.monaco-button::after\s*\{[^}]*inset:\s*1px 2px[^}]*pointer-events:\s*none/s);
		assert.match(css, /engine-triggers-actions \.monaco-button:hover:not\(\.disabled\),[\s\S]*?engine-catalog-icon-actions \.monaco-button:hover:not\(\.disabled\)\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /engine-triggers-actions \.monaco-button:hover:not\(\.disabled\)::after,[\s\S]*?engine-catalog-icon-actions \.monaco-button:hover:not\(\.disabled\)::after\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /engine-triggers-actions \.monaco-button:active:not\(\.disabled\)::after,[\s\S]*?engine-catalog-icon-actions \.monaco-button:active:not\(\.disabled\)::after\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /engine-triggers-actions \.monaco-button:focus-visible::after,[\s\S]*?engine-catalog-icon-actions \.monaco-button:focus-visible::after\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /monaco-reduce-motion[\s\S]*?engine-triggers-actions \.monaco-button::after[\s\S]*?transition:\s*none/s);
		assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*?engine-catalog-icon-actions \.monaco-button::after[\s\S]*?transition:\s*none/s);
	});

	test('provider write toolbar keeps the icon action face inset', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /engine-providers-section \.engine-catalog-write-toolbar \.monaco-button:hover:not\(\.disabled\)\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /engine-catalog-icon-actions \.monaco-button:hover:not\(\.disabled\)::after\s*\{[^}]*toolbar-hoverBackground/s);
	});

	test('confirmation cancel keeps its hit area while painting an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /engine-confirm-popover-actions \.engine-confirm-popover-cancel\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate[^}]*background:\s*transparent/s);
		assert.match(css, /engine-confirm-popover-actions \.engine-confirm-popover-cancel::before\s*\{[^}]*inset:\s*1px 2px[^}]*pointer-events:\s*none/s);
		assert.match(css, /engine-confirm-popover-actions \.engine-confirm-popover-cancel:hover\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /engine-confirm-popover-actions \.engine-confirm-popover-cancel:hover::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /engine-confirm-popover-actions \.engine-confirm-popover-cancel:active\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /engine-confirm-popover-actions \.engine-confirm-popover-cancel:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\) \.engine-confirm-popover-actions \.engine-confirm-popover-cancel:focus-visible\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\) \.engine-confirm-popover-actions \.engine-confirm-popover-cancel:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /monaco-reduce-motion[\s\S]*?engine-confirm-popover-actions \.engine-confirm-popover-cancel::before[\s\S]*?transition:\s*none/s);
		assert.match(css, /prefers-reduced-motion:\s*reduce[\s\S]*?engine-confirm-popover-actions \.engine-confirm-popover-cancel::before[\s\S]*?transition:\s*none/s);
	});

	test('MCP tabs keep the pressed surface above hover', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts'), 'utf8');
		const agentsSource = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/engineAgentsSection.ts'), 'utf8');
		const hoverIndex = css.indexOf('.monaco-workbench .engine-mcp-tab-bar .monaco-button:hover');
		const activeIndex = css.indexOf('.monaco-workbench .engine-mcp-tab-bar .monaco-button:active');
		assert.ok(hoverIndex >= 0, 'MCP tabs need a hover surface');
		assert.ok(activeIndex >= 0, 'MCP tabs need a pressed surface');
		assert.ok(activeIndex > hoverIndex, 'pressed surface must follow hover so pointer-down feedback wins');
		assert.match(source, /engine-mcp-tab-bar/);
		assert.match(source, /setAttribute\('role', 'tab'\)/);
		assert.match(agentsSource, /engine-mcp-tab-bar/);
		assert.match(agentsSource, /setAttribute\('role', 'tab'\)/);
		assert.match(source, /setActiveTab\('definitions'\)/);
		assert.match(source, /setActiveTab\('runtime'\)/);
		assert.match(css, /engine-mcp-tab-bar \.monaco-button\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /engine-mcp-tab-bar \.monaco-button::before\s*\{[^}]*inset:\s*1px 2px/s);
		assert.match(css, /engine-mcp-tab-bar \.monaco-button:hover\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /engine-mcp-tab-bar \.monaco-button:hover::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /engine-mcp-tab-bar \.monaco-button:active\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /engine-mcp-tab-bar \.monaco-button:active::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /engine-mcp-tab-bar \.monaco-button\[aria-selected="true"\]\s*\{[^}]*background:\s*color-mix\(in srgb, var\(--vscode-foreground\) 8%/s);
		assert.match(css, /engine-preferences-pane \.engine-mcp-tab-bar \.monaco-button\[aria-selected="true"\]\s*\{[^}]*!important/s);
		assert.match(css, /engine-preferences-pane \.engine-mcp-tab-bar \.monaco-button:active[\s\S]*?background-color:\s*transparent\s*!important/s);
		assert.match(css, /not\(\.hc-black\):not\(\.hc-light\) \.engine-preferences-pane \.engine-mcp-tab-bar \.monaco-button:focus-visible\s*\{[^}]*background-color:\s*transparent\s*!important/s);
		assert.match(css, /engine-preferences-pane \.engine-mcp-tab-bar \.monaco-button:focus-visible::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?engine-mcp-tab-bar \.monaco-button::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?engine-mcp-tab-bar \.monaco-button::before[\s\S]*?transition:\s*none/);
	});

	test('provider status rows keep status content while hovering an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /engine-catalog-row\.engine-provider-status-row\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /engine-catalog-row\.engine-provider-status-row::before\s*\{[^}]*inset:\s*1px 4px/s);
		assert.match(css, /engine-catalog-row\.engine-provider-status-row:hover\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /engine-catalog-row\.engine-provider-status-row:hover::before\s*\{[^}]*toolbar-hoverBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?engine-provider-status-row::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?engine-provider-status-row::before[\s\S]*?transition:\s*none/);
	});

	test('provider preset rows keep add actions while hovering an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /engine-provider-preset-row\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /engine-provider-preset-row::before\s*\{[^}]*inset:\s*1px 4px/s);
		assert.match(css, /engine-provider-preset-row:hover\s*\{[^}]*background:\s*transparent/s);
		assert.match(css, /engine-provider-preset-row:hover::before\s*\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 4%/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?engine-provider-preset-row::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?engine-provider-preset-row::before[\s\S]*?transition:\s*none/);
	});

	test('disconnected detail body hugs content without changing the connected viewport contract', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/media/enginePreferencesPane.css'), 'utf8');
		assert.match(css, /\.monaco-workbench \.engine-preferences-detail-body\s*\{[^}]*flex:\s*1 1 auto;/s);
		assert.match(css, /\.monaco-workbench \.engine-preferences-detail-body\.is-disconnected\s*\{[^}]*flex:\s*0 1 auto;/s);
	});
});
