/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { BrowserTitlebarPart } from '../../../../browser/parts/titlebar/titlebarPart.js';

suite('BrowserTitlebarPart overflow', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const updateTitleBarToolBarOverflow = Reflect.get(BrowserTitlebarPart.prototype, 'updateTitleBarToolBarOverflow') as (this: BrowserTitlebarPart) => void;

	test('hides the action toolbar when custom window controls would still be clipped', () => {
		let clientWidth = 80;
		let scrollWidth = 240;
		const root = createMeasuredElement(() => clientWidth, () => scrollWidth);
		const center = mainWindow.document.createElement('div');
		center.className = 'center-adjacent-toolbar-container';
		const update = mainWindow.document.createElement('div');
		update.className = 'update-toolbar-container';
		const action = mainWindow.document.createElement('div');
		action.className = 'action-toolbar-container';
		const windowControls = mainWindow.document.createElement('div');
		windowControls.className = 'window-controls-container';
		const icon = mainWindow.document.createElement('div');
		icon.className = 'window-icon window-close';
		windowControls.appendChild(icon);

		const titlebarPart = Object.create(BrowserTitlebarPart.prototype) as BrowserTitlebarPart;
		Reflect.set(titlebarPart, 'rootContainer', root);
		Reflect.set(titlebarPart, 'centerAdjacentToolBarElement', center);
		Reflect.set(titlebarPart, 'updateToolBarElement', update);
		Reflect.set(titlebarPart, 'actionToolBarElement', action);
		Reflect.set(titlebarPart, 'windowControlsContainer', windowControls);

		updateTitleBarToolBarOverflow.call(titlebarPart);
		assert.deepStrictEqual(overflowState(center, update, action, windowControls), {
			center: true,
			update: true,
			action: true,
			windowControls: false,
		});

		icon.remove();
		updateTitleBarToolBarOverflow.call(titlebarPart);
		assert.deepStrictEqual(overflowState(center, update, action, windowControls), {
			center: true,
			update: true,
			action: false,
			windowControls: false,
		});

		windowControls.appendChild(icon);
		action.classList.add('has-no-actions');
		updateTitleBarToolBarOverflow.call(titlebarPart);
		assert.strictEqual(action.classList.contains('overflowing'), false);
		assert.strictEqual(windowControls.classList.contains('overflowing'), false);

		action.classList.remove('has-no-actions');
		clientWidth = 400;
		updateTitleBarToolBarOverflow.call(titlebarPart);
		assert.deepStrictEqual(overflowState(center, update, action, windowControls), {
			center: false,
			update: false,
			action: false,
			windowControls: false,
		});
	});

	test('action toolbar overflowing does not keep layout width', () => {
		const visible = mountActionToolbar(false);
		const hidden = mountActionToolbar(true);
		try {
			assert.strictEqual(mainWindow.getComputedStyle(visible.action).display, 'flex');
			assert.ok(visible.action.offsetWidth > 0);
			assert.strictEqual(mainWindow.getComputedStyle(hidden.action).display, 'none');
			assert.strictEqual(hidden.action.offsetWidth, 0);
		} finally {
			visible.root.remove();
			hidden.root.remove();
		}
	});
});

function overflowState(center: HTMLElement, update: HTMLElement, action: HTMLElement, windowControls: HTMLElement) {
	return {
		center: center.classList.contains('overflowing'),
		update: update.classList.contains('overflowing'),
		action: action.classList.contains('overflowing'),
		windowControls: windowControls.classList.contains('overflowing'),
	};
}

function createMeasuredElement(clientWidth: () => number, scrollWidth: () => number): HTMLElement {
	const element = mainWindow.document.createElement('div');
	Object.defineProperties(element, {
		clientWidth: { get: clientWidth },
		scrollWidth: { get: scrollWidth },
	});
	return element;
}

function mountActionToolbar(overflowing: boolean): { root: HTMLElement; action: HTMLElement } {
	const workbench = mainWindow.document.createElement('div');
	workbench.className = 'monaco-workbench';
	const part = mainWindow.document.createElement('div');
	part.className = 'part titlebar';
	const container = mainWindow.document.createElement('div');
	container.className = 'titlebar-container';
	const right = mainWindow.document.createElement('div');
	right.className = 'titlebar-right';
	const action = mainWindow.document.createElement('div');
	action.className = overflowing ? 'action-toolbar-container overflowing' : 'action-toolbar-container';
	const child = mainWindow.document.createElement('div');
	child.style.width = '48px';
	child.style.height = '16px';
	action.appendChild(child);
	right.appendChild(action);
	container.appendChild(right);
	part.appendChild(container);
	workbench.appendChild(part);
	mainWindow.document.body.appendChild(workbench);
	return { root: workbench, action };
}
