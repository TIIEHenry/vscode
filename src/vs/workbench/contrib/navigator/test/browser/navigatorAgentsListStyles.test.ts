/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getWindow } from '../../../../../base/browser/dom.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const FOREGROUND = 'rgb(200, 100, 0)';

async function loadNavigatorStylesheet(store: Pick<DisposableStore, 'add'>): Promise<HTMLLinkElement> {
	const stylesheet = document.createElement('link');
	stylesheet.rel = 'stylesheet';
	stylesheet.href = new URL('../../browser/media/navigator.css', import.meta.url).href;
	store.add(toDisposable(() => stylesheet.remove()));
	await new Promise<void>((resolve, reject) => {
		stylesheet.onload = () => resolve();
		stylesheet.onerror = () => reject(new Error('Navigator stylesheet failed to load'));
		document.head.appendChild(stylesheet);
	});
	return stylesheet;
}

function mountAgentsList(store: Pick<DisposableStore, 'add'>, listClass: string) {
	const workbench = document.createElement('div');
	workbench.className = 'monaco-workbench navigator-style-test';
	workbench.style.setProperty('--vscode-foreground', FOREGROUND);
	workbench.style.setProperty('--vscode-focusBorder', 'rgb(0, 255, 0)');
	workbench.style.setProperty('--vscode-list-focusOutline', 'rgb(0, 0, 255)');
	const container = document.createElement('div');
	container.className = listClass;
	const list = document.createElement('div');
	list.className = 'monaco-list';
	const row = document.createElement('div');
	row.className = 'monaco-list-row';
	const actions = document.createElement('div');
	actions.className = 'navigator-agents-row-actions';
	const action = document.createElement('a');
	action.className = 'action-label';
	actions.appendChild(action);
	row.appendChild(actions);
	list.appendChild(row);
	container.appendChild(list);
	workbench.appendChild(container);
	document.body.appendChild(workbench);
	store.add(toDisposable(() => workbench.remove()));
	return { workbench, list, row, action };
}

function foregroundAlpha(color: string): number {
	const match = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+) \/ ([\d.e-]+)\)$/.exec(color) ?? /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(color);
	assert.ok(match, color);
	const channels = match.slice(1, 4).map(Number);
	const scale = channels.some(value => value > 1) ? 1 : 255;
	assert.deepStrictEqual(channels.map(value => Math.round(value * scale)), [200, 100, 0], `${color} is a foreground tint`);
	return Number(Number(match[4]).toFixed(2));
}

suite('Navigator agents list styles', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	for (const listClass of ['navigator-agents-hierarchy-tree', 'navigator-agents-activity-list']) {
		test(`${listClass}: keyboard focus uses a neutral background, not a focus outline (PRD-028.4)`, async () => {
			const stylesheet = await loadNavigatorStylesheet(store);
			// Pseudo-classes cannot be forced, so their rules are copied onto simulated classes.
			let simulatedCss = '.navigator-style-test * { transition: none !important; }\n';
			for (const rule of stylesheet.sheet ? [...stylesheet.sheet.cssRules] : []) {
				if (rule instanceof CSSStyleRule && /:(focus-visible|focus)\b/.test(rule.selectorText)) {
					const selector = rule.selectorText
						.replace(/:focus-visible\b/g, '.sim-focus-visible')
						.replace(/:focus(?![-\w])/g, '.sim-focus');
					simulatedCss += `${selector} { ${rule.style.cssText} }\n`;
				}
			}
			const simulatedStyle = document.createElement('style');
			simulatedStyle.textContent = simulatedCss;
			document.head.appendChild(simulatedStyle);
			store.add(toDisposable(() => simulatedStyle.remove()));

			const { list, row } = mountAgentsList(store, listClass);
			const style = () => getWindow(row).getComputedStyle(row);

			row.classList.add('selected');
			const selectedAlpha = foregroundAlpha(style().backgroundColor);
			row.classList.remove('selected');

			list.classList.add('sim-focus', 'sim-focus-visible');
			row.classList.add('focused');
			assert.strictEqual(style().outlineStyle, 'none', 'keyboard-focused row draws no outline');
			const focusedAlpha = foregroundAlpha(style().backgroundColor);
			assert.ok(focusedAlpha > 0.05 && focusedAlpha < selectedAlpha, `focused row ${focusedAlpha} sits between hover and selection ${selectedAlpha}`);

			row.classList.add('selected');
			assert.strictEqual(style().outlineStyle, 'none', 'keyboard-focused selected row draws no outline');
			assert.ok(foregroundAlpha(style().backgroundColor) > selectedAlpha, 'keyboard focus on the selected row stays distinguishable from plain selection');
		});

		test(`${listClass}: row motion stays within 100ms and stops under reduce motion`, async () => {
			await loadNavigatorStylesheet(store);
			const { workbench, row, action } = mountAgentsList(store, listClass);
			const duration = (element: HTMLElement) => getWindow(element).getComputedStyle(element).transitionDuration;

			assert.deepStrictEqual({ row: duration(row), action: duration(action) }, { row: '0.1s', action: '0.1s' });
			workbench.classList.add('monaco-reduce-motion');
			assert.deepStrictEqual({ row: duration(row), action: duration(action) }, { row: '0s', action: '0s' });
		});
	}
});
