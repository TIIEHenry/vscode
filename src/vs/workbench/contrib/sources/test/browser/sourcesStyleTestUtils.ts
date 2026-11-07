/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getWindow } from '../../../../../base/browser/dom.js';
import { DisposableStore, toDisposable } from '../../../../../base/common/lifecycle.js';

/**
 * Mounts production Sources stylesheets under a `.monaco-workbench .part.sources`
 * root so tests can read computed styles. Transitions are off because a computed
 * value right after a state change would report the transition start.
 */
export async function mountSourcesStyleRoot(store: Pick<DisposableStore, 'add'>, stylesheets: readonly string[], variables: Readonly<Record<string, string>>): Promise<HTMLElement> {
	const sheets: CSSStyleSheet[] = [];
	for (const name of stylesheets) {
		const link = document.createElement('link');
		link.rel = 'stylesheet';
		link.href = new URL(`../../browser/media/${name}`, import.meta.url).href;
		store.add(toDisposable(() => link.remove()));
		await new Promise<void>((resolve, reject) => {
			link.onload = () => resolve();
			link.onerror = () => reject(new Error(`Sources stylesheet failed to load: ${name}`));
			document.head.appendChild(link);
		});
		if (link.sheet) {
			sheets.push(link.sheet);
		}
	}

	// Pseudo-classes cannot be forced, so their rules are copied onto `.sim-hover` / `.sim-focus-visible`.
	let simulated = '.sources-style-test * { transition: none !important; }\n';
	for (const sheet of sheets) {
		for (const rule of sheet.cssRules) {
			if (rule instanceof CSSStyleRule && /:(hover|focus-visible)\b/.test(rule.selectorText)) {
				const selector = rule.selectorText.replace(/:hover\b/g, '.sim-hover').replace(/:focus-visible\b/g, '.sim-focus-visible');
				simulated += `${selector} { ${rule.style.cssText} }\n`;
			}
		}
	}
	const style = document.createElement('style');
	style.textContent = simulated;
	document.head.appendChild(style);
	store.add(toDisposable(() => style.remove()));

	const workbench = document.createElement('div');
	workbench.className = 'monaco-workbench sources-style-test';
	for (const [name, value] of Object.entries(variables)) {
		workbench.style.setProperty(`--vscode-${name}`, value);
	}
	const part = document.createElement('div');
	part.className = 'part sources';
	workbench.appendChild(part);
	document.body.appendChild(workbench);
	store.add(toDisposable(() => workbench.remove()));
	return part;
}

/** Builds `<tag class="a b">` under a parent from a `tag.a.b` shorthand. */
export function appendStyled(parent: HTMLElement, shorthand: string): HTMLElement {
	const [tag, ...classes] = shorthand.split('.');
	const element = document.createElement(tag || 'div');
	element.classList.add(...classes);
	parent.appendChild(element);
	return element;
}

export function computedStyle(element: Element, pseudo?: string): CSSStyleDeclaration {
	return getWindow(element).getComputedStyle(element, pseudo);
}
