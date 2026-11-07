/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ACTIVITY_ACTION_REL = 'src/vs/workbench/browser/parts/activitybar/media/activityaction.css';
const ACTIVITY_BAR_PART_REL = 'src/vs/workbench/browser/parts/activitybar/media/activitybarpart.css';

function readRepoFile(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return fs.readFileSync(found!, 'utf8');
}

suite('activity bar CSS contracts', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('standard action fallbacks match ActivitybarPart defaults', () => {
		const css = readRepoFile(ACTIVITY_ACTION_REL);
		assert.ok(css.includes('height: var(--activity-bar-action-height, 44px);'));
		assert.ok(css.includes('line-height: var(--activity-bar-action-height, 44px);'));
		assert.ok(css.includes('font-size: var(--activity-bar-icon-size, 20px);'));
		assert.ok(css.includes('width: var(--activity-bar-width, 48px);'));
		assert.ok(css.includes('top: 24px;'), 'badge positioning remains an independent contract');
		assert.ok(!css.includes('var(--activity-bar-action-height, 48px)'));
		assert.ok(!css.includes('var(--activity-bar-icon-size, 24px)'));
	});

	test('activity transitions stay within the motion contract and honor reduced motion', () => {
		const css = readRepoFile(ACTIVITY_ACTION_REL);
		assert.ok(css.includes('transition: color 100ms ease;'));
		assert.ok(css.includes('transition: background-color 100ms ease;'));
		assert.ok(!css.includes('0.15s'), 'activity bar transitions must not exceed 100ms');
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .activitybar'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .activitybar'));
		for (const selector of [
			'.monaco-workbench.monaco-reduce-motion .activitybar > .content .composite-bar > .monaco-action-bar .action-item::before',
			'.monaco-workbench.monaco-reduce-motion .activitybar > .content .composite-bar > .monaco-action-bar .action-item::after',
			'.monaco-workbench:not(.monaco-enable-motion) .activitybar > .content .composite-bar > .monaco-action-bar .action-item::before',
			'.monaco-workbench:not(.monaco-enable-motion) .activitybar > .content .composite-bar > .monaco-action-bar .action-item::after',
		]) {
			assert.ok(css.includes(selector), `drag indicator reduced-motion selector missing: ${selector}`);
		}
		assert.ok((css.match(/transition: none;/g) ?? []).length >= 2, 'reduced motion must disable both activity transitions');
	});

	test('compact menubar toggle honors reduced motion', () => {
		const css = readRepoFile(ACTIVITY_BAR_PART_REL);
		assert.ok(css.includes('transition: background-color 0.08s ease;'));
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .activitybar .menubar.compact .toolbar-toggle-more'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .activitybar .menubar.compact .toolbar-toggle-more'));
		assert.ok(css.includes('transition: none;'));
	});

	test('ordinary-theme keyboard focus uses a quiet surface while selected actions keep active background', () => {
		const css = readRepoFile(ACTIVITY_ACTION_REL);
		assert.match(css, /\.action-item\.checked \.active-item-indicator:before\s*\{[^}]*background:\s*var\(--vscode-activityBar-activeBackground\)/s);
		assert.match(css, /\.action-item:focus:not\(\.clicked\):not\(\.checked\) \.active-item-indicator:before\s*\{[^}]*background:\s*var\(--vscode-toolbar-hoverBackground/s);
		assert.doesNotMatch(css, /\.action-item:focus \.active-item-indicator:before\s*\{[^}]*background:\s*var\(--vscode-activityBar-activeBackground\)/s);
	});
});
