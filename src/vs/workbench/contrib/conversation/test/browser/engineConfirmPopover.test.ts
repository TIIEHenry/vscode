/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IContextViewService } from '../../../../../platform/contextview/browser/contextView.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { showEngineConfirmPopover } from '../../browser/engineConfirmPopover.js';

suite('EngineConfirmPopover', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mountAnchor(): HTMLButtonElement {
		const anchor = document.createElement('button');
		anchor.textContent = 'Delete';
		document.body.appendChild(anchor);
		store.add({ dispose: () => anchor.remove() });
		anchor.focus();
		return anchor;
	}

	function press(target: Element, key: string, keyCode: number, shiftKey = false): void {
		target.dispatchEvent(new KeyboardEvent('keydown', { key, keyCode, shiftKey, bubbles: true, cancelable: true }));
	}

	function activeClass(): string {
		return document.activeElement?.className ?? '';
	}

	/** Earlier tests leave their context view in the document; the newest popover is the open one. */
	function newestConfirmButton(): HTMLButtonElement {
		const matches = document.querySelectorAll<HTMLButtonElement>('.engine-confirm-popover-confirm');
		return matches[matches.length - 1];
	}

	test('Tab cycles inside the popover and Escape returns focus to the trigger', async () => {
		const contextViewService = workbenchInstantiationService(undefined, store).invokeFunction(accessor => accessor.get(IContextViewService));
		const anchor = mountAnchor();
		const result = showEngineConfirmPopover({ contextViewService, anchor, message: 'Delete trigger?', confirmLabel: 'Delete' });
		const focusTrail = [activeClass()];
		press(document.activeElement!, 'Tab', 9);
		focusTrail.push(activeClass());
		press(document.activeElement!, 'Tab', 9);
		focusTrail.push(activeClass());
		press(document.activeElement!, 'Tab', 9, true);
		focusTrail.push(activeClass());
		press(document.activeElement!, 'Escape', 27);
		const confirmed = await result;
		assert.deepStrictEqual({
			focusTrail,
			confirmed,
			anchorFocused: document.activeElement === anchor,
			anchorOpenClass: anchor.classList.contains('is-confirm-open'),
		}, {
			focusTrail: [
				'engine-confirm-popover-cancel',
				'engine-confirm-popover-confirm is-danger',
				'engine-confirm-popover-cancel',
				'engine-confirm-popover-confirm is-danger',
			],
			confirmed: false,
			anchorFocused: true,
			anchorOpenClass: false,
		});
	});

	test('confirm returns focus to the trigger', async () => {
		const contextViewService = workbenchInstantiationService(undefined, store).invokeFunction(accessor => accessor.get(IContextViewService));
		const anchor = mountAnchor();
		const result = showEngineConfirmPopover({ contextViewService, anchor, message: 'Remove?', confirmLabel: 'Remove' });
		newestConfirmButton().click();
		assert.deepStrictEqual({ confirmed: await result, anchorFocused: document.activeElement === anchor }, { confirmed: true, anchorFocused: true });
	});
});
