/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getWindow } from '../../../../../base/browser/dom.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { NavigatorAgentsInlineFilterBox } from '../../browser/navigatorAgentsInlineFilterBox.js';
import { NavigatorProjectsInlineFilterBox } from '../../browser/navigatorProjectsInlineFilterBox.js';
import { NavigatorTeamInlineFilterBox } from '../../browser/navigatorTeamInlineFilterBox.js';

const FOCUS_BORDER = 'rgb(1, 2, 3)';
const CONTRAST_ACTIVE_BORDER = 'rgb(4, 5, 6)';
const TRANSPARENT = 'rgba(0, 0, 0, 0)';

async function loadStylesheet(store: Pick<DisposableStore, 'add'>, relativePath: string): Promise<void> {
	const stylesheet = document.createElement('link');
	stylesheet.rel = 'stylesheet';
	stylesheet.href = new URL(relativePath, import.meta.url).href;
	store.add(toDisposable(() => stylesheet.remove()));
	await new Promise<void>((resolve, reject) => {
		stylesheet.onload = () => resolve();
		stylesheet.onerror = () => reject(new Error(`Navigator stylesheet failed to load: ${relativePath}`));
		document.head.appendChild(stylesheet);
	});
}

suite('Navigator inline filter styles', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const { name, css, create } of [
		{ name: 'Projects', css: 'navigatorProjectsInlineFilter.css', create: (parent: HTMLElement) => new NavigatorProjectsInlineFilterBox(parent, 'Filter', 'Filter') },
		{ name: 'Agents', css: 'navigatorAgentsInlineFilter.css', create: (parent: HTMLElement) => new NavigatorAgentsInlineFilterBox(parent, 'Filter', 'Filter') },
		{ name: 'Team', css: 'navigatorTeamInlineFilter.css', create: (parent: HTMLElement) => new NavigatorTeamInlineFilterBox(parent, 'Filter', 'Filter') },
	]) {
		test(`${name} filter keeps a transparent resting border and paints the focus border while focused (S9)`, async () => {
			await loadStylesheet(store, `../../browser/media/${css}`);
			// The border-color transition would report its start value right after a state change.
			const noTransition = document.createElement('style');
			noTransition.textContent = '.navigator-style-test * { transition: none !important; }';
			document.head.appendChild(noTransition);
			store.add(toDisposable(() => noTransition.remove()));
			const theme = document.createElement('div');
			theme.className = 'navigator-style-test';
			const workbench = document.createElement('div');
			workbench.className = 'monaco-workbench';
			workbench.style.setProperty('--vscode-focusBorder', FOCUS_BORDER);
			theme.appendChild(workbench);
			document.body.appendChild(theme);
			store.add(toDisposable(() => theme.remove()));
			const box = store.add(create(workbench));
			const input = box.element.querySelector('input');
			assert.ok(input);
			const border = () => {
				const style = getWindow(input).getComputedStyle(input);
				return `${style.borderTopWidth} ${style.borderTopStyle} ${style.borderTopColor}`;
			};

			assert.strictEqual(border(), `1px solid ${TRANSPARENT}`);
			input.dispatchEvent(new FocusEvent('focus'));
			assert.strictEqual(border(), `1px solid ${FOCUS_BORDER}`);

			theme.classList.add('hc-black');
			assert.strictEqual(border(), `1px solid ${FOCUS_BORDER}`, 'high contrast falls back to focusBorder without contrastActiveBorder');
			workbench.style.setProperty('--vscode-contrastActiveBorder', CONTRAST_ACTIVE_BORDER);
			assert.strictEqual(border(), `1px solid ${CONTRAST_ACTIVE_BORDER}`);

			input.dispatchEvent(new FocusEvent('blur'));
			assert.strictEqual(border(), `1px solid ${TRANSPARENT}`);
		});
	}
});
