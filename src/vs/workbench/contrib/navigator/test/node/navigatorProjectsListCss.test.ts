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
});
