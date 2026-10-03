/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../base/browser/window.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { TitlebarPart } from '../../browser/parts/titlebarPart.js';

suite('Sessions - Titlebar Part', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	const updateTitleBarToolBarOverflow = Reflect.get(TitlebarPart.prototype, 'updateTitleBarToolBarOverflow') as (this: TitlebarPart) => void;

	test('hides optional toolbar groups when a titlebar section overflows', () => {
		let centerClientWidth = 100;
		let rightClientWidth = 100;
		const root = createMeasuredElement(() => 100, () => 100);
		const left = createMeasuredElement(() => 20, () => 20);
		const toolBars = [20, 20, 20, 20, 20, 20].map(() => mainWindow.document.createElement('div'));
		toolBars[0].classList.add('titlebar-screen-reader-container');
		const center = createMeasuredElement(
			() => centerClientWidth,
			() => 40 + visibleWidth(toolBars[1], 20) + visibleWidth(toolBars[2], 20)
		);
		const right = createMeasuredElement(
			() => rightClientWidth,
			() => 40 + visibleWidth(toolBars[0], 20) + visibleWidth(toolBars[3], 20) + visibleWidth(toolBars[4], 20) + visibleWidth(toolBars[5], 20)
		);
		const titlebarPart = Object.create(TitlebarPart.prototype) as TitlebarPart;
		Reflect.set(titlebarPart, 'rootContainer', root);
		Reflect.set(titlebarPart, 'leftContent', left);
		Reflect.set(titlebarPart, 'centerContent', center);
		Reflect.set(titlebarPart, 'rightContent', right);
		Reflect.set(titlebarPart, 'overflowManagedToolBarElements', toolBars);

		updateTitleBarToolBarOverflow.call(titlebarPart);
		const prioritized = toolBars.map(element => element.classList.contains('overflowing'));

		centerClientWidth = 200;
		rightClientWidth = 200;
		updateTitleBarToolBarOverflow.call(titlebarPart);
		const expanded = toolBars.map(element => element.classList.contains('overflowing'));

		assert.deepStrictEqual({ prioritized, expanded }, {
			prioritized: [true, false, false, false, false, false],
			expanded: [false, false, false, false, false, false],
		});
	});

	test('center titlebar actions stay above the window drag region', () => {
		const workbench = mainWindow.document.createElement('div');
		workbench.className = 'monaco-workbench agent-sessions-workbench';
		workbench.style.cssText = 'position:relative;width:360px;height:35px;';

		const part = mainWindow.document.createElement('div');
		part.className = 'part titlebar';
		part.style.cssText = 'position:absolute;inset:0;';

		const root = mainWindow.document.createElement('div');
		root.className = 'titlebar-container sessions-titlebar-container has-center';

		const dragRegion = mainWindow.document.createElement('div');
		dragRegion.className = 'titlebar-drag-region';

		const center = mainWindow.document.createElement('div');
		center.className = 'titlebar-center';

		const actions = mainWindow.document.createElement('div');
		actions.className = 'titlebar-actions-container titlebar-center-actions-container';

		const button = mainWindow.document.createElement('button');
		button.textContent = 'Open';
		button.style.cssText = 'width:64px;height:22px;';

		actions.appendChild(button);
		center.appendChild(actions);
		root.append(dragRegion, center);
		part.appendChild(root);
		workbench.appendChild(part);
		mainWindow.document.body.appendChild(workbench);

		try {
			const rect = button.getBoundingClientRect();
			const hit = rect.width > 0
				? mainWindow.document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
				: null;
			const style = mainWindow.getComputedStyle(actions);
			assert.deepStrictEqual({
				position: style.position,
				zIndex: style.zIndex,
				hitIsAction: !!hit && actions.contains(hit),
			}, {
				position: 'relative',
				zIndex: '2500',
				hitIsAction: true,
			});
		} finally {
			workbench.remove();
		}
	});
});

function createMeasuredElement(clientWidth: () => number, scrollWidth: () => number): HTMLElement {
	const element = mainWindow.document.createElement('div');
	Object.defineProperties(element, {
		clientWidth: { get: clientWidth },
		scrollWidth: { get: scrollWidth },
	});
	return element;
}

function visibleWidth(element: HTMLElement, width: number): number {
	return element.classList.contains('overflowing') || element.classList.contains('has-no-actions') ? 0 : width;
}
