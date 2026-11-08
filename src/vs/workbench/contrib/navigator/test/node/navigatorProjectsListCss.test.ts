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

suite('Navigator projects row chrome', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('folder name keeps width, path stays capped, active row uses neutral chrome', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorProjectsList.css'), 'utf8');
		assert.match(css, /\.navigator-projects-node-name\s*\{[^}]*min-width:\s*8ch/s);
		assert.match(css, /\.navigator-projects-node-description\s*\{[^}]*max-width:\s*46%/s);
		assert.match(css, /\.navigator-projects-row-actions\.is-available\.is-session-actions/);
		assert.match(css, /monaco-list-row:hover \.navigator-projects-row-actions\.is-available\.is-workdir-actions/);
		assert.match(css, /monaco-list-row\.focused \.navigator-projects-row-actions\.is-available\.is-workdir-actions/);
		assert.doesNotMatch(css, /monaco-list-row\.selected \.navigator-projects-row-actions\.is-available\.is-workdir-actions/);
		assert.ok(!/inset\s+2px\s+0\s+0\s+var\(--vscode-focusBorder\)/.test(css), 'rounded inset shadow reads as a parenthesis');
		assert.match(css, /navigator-projects-list \.monaco-list-row\s*\{[^}]*cornerRadius-xLarge/s);
		assert.match(css, /navigator-projects-list \.monaco-list-row\.selected\s*\{[^}]*color-mix\(in srgb, var\(--vscode-foreground\) 4%/s);
		assert.match(css, /navigator-projects-node-label\.is-active-session/);
		assert.match(css, /navigator-projects-row-actions\s*\{[^}]*spacing-size20/s);
		assert.doesNotMatch(css, /\.monaco-list-row:has\(\.is-active-session\)::after/);
	});

	test('keyboard focus uses a quiet row surface in ordinary themes and contrast in HC', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorProjectsList.css'), 'utf8');
		assert.match(css, /:focus-visible \.monaco-list-row\.focused:not\(\.selected\)[^\{]*\{[^}]*outline:\s*none\s*!important[^}]*background-color:\s*transparent/s);
		assert.match(css, /:focus-visible \.monaco-list-row\.focused:not\(\.selected\)[^\{]*::before[^\{]*\{[^}]*toolbar-hoverBackground/s);
		assert.doesNotMatch(css, /navigator-projects-list[\s\S]*:focus-visible \.monaco-list-row\.focused\s*\{[^}]*focusBorder/);
		assert.match(css, /hc-black[\s\S]*navigator-projects-list \.monaco-list:focus-visible \.monaco-list-row\.focused[\s\S]*contrastActiveBorder/);
		assert.match(css, /hc-light[\s\S]*navigator-projects-list \.monaco-list:focus-visible \.monaco-list-row\.focused[\s\S]*contrastActiveBorder/);
	});

	test('team member and task rows use quiet ordinary focus and contrast in HC', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorTeamList.css'), 'utf8');
		assert.match(css, /navigator-team-list \.monaco-list:focus-visible \.monaco-list-row\.focused:not\(\.selected\)[^{]*\{[^}]*outline:\s*none\s*!important[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/s);
		assert.match(css, /navigator-team-tasks-list \.monaco-list:focus-visible \.monaco-list-row\.focused:not\(\.selected\)[^{]*\{[^}]*outline:\s*none\s*!important[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground/s);
		assert.doesNotMatch(css, /navigator-team-(?:tasks-)?list[\s\S]*:focus-visible \.monaco-list-row\.focused\s*\{[^}]*focusBorder/);
		assert.match(css, /hc-black[\s\S]*navigator-team-list \.monaco-list:focus-visible \.monaco-list-row\.focused[\s\S]*contrastActiveBorder/);
		assert.match(css, /hc-light[\s\S]*navigator-team-tasks-list \.monaco-list:focus-visible \.monaco-list-row\.focused[\s\S]*contrastActiveBorder/);
	});

	test('pressed team status filters retain the active surface while keyboard-focused', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorTeamList.css'), 'utf8');
		const focused = css.indexOf('.navigator-team-status-filter:focus-visible');
		const pressedFocused = css.indexOf('.navigator-team-status-filter[aria-pressed="true"]:focus-visible');
		assert.ok(focused >= 0 && pressedFocused > focused, 'pressed focus override must follow the general focus rule');
		assert.match(css.slice(pressedFocused), /background-color:\s*var\(--vscode-toolbar-activeBackground/);
	});

	test('inline filter boxes have transparent resting border and focusBorder on focus (S9)', () => {
		const projectsFilterCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorProjectsInlineFilter.css'), 'utf8');
		const agentsFilterCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorAgentsInlineFilter.css'), 'utf8');
		const teamFilterCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorTeamInlineFilter.css'), 'utf8');

		for (const css of [projectsFilterCss, agentsFilterCss, teamFilterCss]) {
			assert.match(css, /border:\s*1px solid transparent;/);
			assert.match(css, /border-color:\s*var\(--vscode-focusBorder\);/);
			assert.match(css, /border-color:\s*var\(--vscode-contrastActiveBorder,\s*var\(--vscode-focusBorder\)\);/);
		}
	});

	test('project rows keep motion within the 100ms contract and honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorProjectsList.css'), 'utf8');
		assert.match(css, /navigator-projects-list \.monaco-list-row::before\s*\{[^}]*inset:\s*1px 4px/s);
		assert.match(css, /navigator-projects-list \.monaco-list-row:hover[^\{]*::before[^\{]*\{[^}]*2\.5%/s);
		assert.match(css, /navigator-projects-list \.monaco-list-row:active[^\{]*::before[^\{]*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /navigator-projects-list \.monaco-list-row\s*\{[^}]*transition:\s*background-color 100ms ease;/s);
		assert.doesNotMatch(css, /transition:\s*background-color\s+0\.12s/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.navigator-projects-list \.monaco-list-row[^\{]*\{[^}]*transition:\s*none;/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.navigator-projects-list \.monaco-list-row::before\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.navigator-projects-list \.monaco-list-row[^\{]*\{[^}]*transition:\s*none;/s);
	});

	test('Projects inline filter motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorProjectsInlineFilter.css'), 'utf8');
		assert.match(css, /\.navigator-projects-inline-filter-input\s*\{[^}]*transition:\s*border-color 100ms ease;/s);
		assert.match(css, /\.navigator-projects-inline-filter-clear\s*\{[^}]*transition:\s*color 100ms ease;/s);
		assert.doesNotMatch(css, /transition:\s*[^;]*0\.12s/);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion \.navigator-projects-inline-filter-input,[\s\S]*?\.monaco-workbench\.monaco-reduce-motion \.navigator-projects-inline-filter-clear\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.navigator-projects-inline-filter-input,[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\) \.navigator-projects-inline-filter-clear\s*\{[^}]*transition:\s*none;/s);
	});

	test('Team inline filter motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorTeamInlineFilter.css'), 'utf8');
		assert.match(css, /navigator-team-inline-filter-input\s*\{[^}]*transition:\s*border-color 100ms ease;/s);
		assert.match(css, /navigator-team-inline-filter-clear\s*\{[^}]*transition:\s*color 100ms ease;/s);
		assert.doesNotMatch(css, /transition:\s*[^;]*0\.12s/);
		assert.match(css, /monaco-workbench\.monaco-reduce-motion[\s\S]*?navigator-team-inline-filter-input,[\s\S]*?navigator-team-inline-filter-clear[\s\S]*?transition:\s*none;/s);
		assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?navigator-team-inline-filter-input,[\s\S]*?navigator-team-inline-filter-clear[\s\S]*?transition:\s*none;/s);
	});

	test('Team rows keep motion within the 100ms contract and honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/navigator/browser/media/navigatorTeamList.css'), 'utf8');
		assert.match(css, /navigator-team-list \.monaco-list-row,[\s\S]*?navigator-team-tasks-list \.monaco-list-row\s*\{[^}]*transition:\s*background-color 100ms ease;/s);
		assert.doesNotMatch(css, /transition:\s*background-color\s+0\.12s/);
		assert.match(css, /monaco-workbench\.monaco-reduce-motion[\s\S]*?navigator-team-list \.monaco-list-row,[\s\S]*?navigator-team-tasks-list \.monaco-list-row\s*\{[^}]*transition:\s*none;/s);
		assert.match(css, /prefers-reduced-motion: reduce[\s\S]*?monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?navigator-team-list \.monaco-list-row,[\s\S]*?navigator-team-tasks-list \.monaco-list-row\s*\{[^}]*transition:\s*none;/s);
	});
});
