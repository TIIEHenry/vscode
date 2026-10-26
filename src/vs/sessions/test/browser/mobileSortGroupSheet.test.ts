/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mainWindow } from '../../../base/browser/window.js';
import { EventType as TouchEventType } from '../../../base/browser/touch.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { type IMobileSortGroupSheetItem, showMobileSortGroupSheet } from '../../browser/parts/mobile/mobileSortGroupSheet.js';

suite('Mobile sort/group sheet - D1369', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const document = mainWindow.document;
	const items: readonly IMobileSortGroupSheetItem[] = [
		{ id: 'created', label: 'Sort by Created', checked: true, group: 'sort' },
		{ id: 'updated', label: 'Sort by Updated', checked: false, group: 'sort' },
	];

	function createFixture() {
		const container = document.createElement('div');
		const openerHost = container.appendChild(document.createElement('div'));
		const opener = openerHost.appendChild(document.createElement('button'));
		opener.type = 'button';
		opener.textContent = 'Sort';
		const outside = container.appendChild(document.createElement('button'));
		outside.type = 'button';
		outside.textContent = 'Outside';
		document.body.appendChild(container);
		opener.focus();
		const closes: HTMLButtonElement[] = [];
		store.add({ dispose: () => {
			closes.forEach(close => close.click());
			container.remove();
		} });
		return {
			opener, openerHost, outside,
			open(entries = items) {
				const result = showMobileSortGroupSheet(container, 'Sort', entries);
				const overlays = container.querySelectorAll<HTMLElement>('.mobile-sort-group-sheet-overlay');
				const overlay = overlays[overlays.length - 1];
				const sheet = overlay.querySelector<HTMLElement>('.mobile-sort-group-sheet')!;
				const close = sheet.querySelector<HTMLButtonElement>('.mobile-sort-group-sheet-close')!;
				closes.push(close);
				return {
					result, overlay, sheet, close,
					backdrop: overlay.querySelector<HTMLElement>('.mobile-sort-group-sheet-backdrop')!,
					rows: [...sheet.querySelectorAll<HTMLButtonElement>('.mobile-sort-group-sheet-item')],
				};
			},
		};
	}

	function pressKey(key: string, shiftKey = false): KeyboardEvent {
		const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
		mainWindow.dispatchEvent(event);
		return event;
	}

	test('Tab and Shift+Tab cycle in DOM order and skip disabled controls', async () => {
		const fixture = createFixture();
		const view = fixture.open();
		assert.strictEqual(document.activeElement, view.rows[0]);
		view.rows[1].focus();
		assert.strictEqual(pressKey('Tab').defaultPrevented, true);
		assert.strictEqual(document.activeElement, view.close);
		pressKey('Tab', true);
		assert.strictEqual(document.activeElement, view.rows[1]);
		view.rows[1].disabled = true;
		view.rows[0].focus();
		pressKey('Tab');
		assert.strictEqual(document.activeElement, view.close);
		view.close.click();
		await view.result;
	});

	test('an empty sheet initially focuses Close', async () => {
		const fixture = createFixture();
		const view = fixture.open([]);
		assert.strictEqual(document.activeElement, view.close);
		pressKey('Tab', true);
		assert.strictEqual(document.activeElement, view.close);
		view.close.click();
		await view.result;
	});

	for (const dismiss of ['close', 'backdrop', 'escape', 'selection', 'tap'] as const) {
		test(`${dismiss} dismiss restores the opener and preserves its result`, async () => {
			const fixture = createFixture();
			const view = fixture.open();
			switch (dismiss) {
				case 'close': view.close.click(); break;
				case 'backdrop': view.rows[0].blur(); view.backdrop.click(); break;
				case 'escape': assert.strictEqual(pressKey('Escape').defaultPrevented, true); break;
				case 'selection': view.rows[1].click(); break;
				case 'tap': view.backdrop.dispatchEvent(new Event(TouchEventType.Tap)); break;
			}
			assert.strictEqual(document.activeElement, fixture.opener);
			assert.strictEqual(view.overlay.inert, true);
			assert.strictEqual(view.overlay.getAttribute('aria-hidden'), 'true');
			assert.strictEqual(await view.result, dismiss === 'selection' ? 'updated' : undefined);
			assert.strictEqual(view.overlay.isConnected, false);
		});
	}

	test('closing chrome releases keys immediately and cannot steal a reopened sheet focus', async () => {
		const fixture = createFixture();
		const first = fixture.open();
		first.close.click();
		assert.strictEqual(pressKey('Tab').defaultPrevented, false);
		const second = fixture.open();
		second.close.focus();
		pressKey('Tab', true);
		assert.strictEqual(document.activeElement, second.rows[1]);
		await first.result;
		assert.strictEqual(document.activeElement, second.rows[1]);
		assert.strictEqual(second.overlay.isConnected, true);
		second.close.click();
		await second.result;
	});

	for (const unavailable of ['hidden', 'ancestor-hidden', 'removed', 'disabled'] as const) {
		test(`does not restore an opener that is ${unavailable}`, async () => {
			const fixture = createFixture();
			const view = fixture.open();
			switch (unavailable) {
				case 'hidden': fixture.opener.hidden = true; break;
				case 'ancestor-hidden': fixture.openerHost.style.display = 'none'; break;
				case 'removed': fixture.opener.remove(); break;
				case 'disabled': fixture.opener.disabled = true; break;
			}
			view.close.click();
			await view.result;
			assert.notStrictEqual(document.activeElement, fixture.opener);
		});
	}

	test('does not reclaim focus moved outside before or during the close animation', async () => {
		const fixture = createFixture();
		const first = fixture.open();
		fixture.outside.focus();
		first.close.click();
		assert.strictEqual(document.activeElement, fixture.outside);
		await first.result;
		assert.strictEqual(document.activeElement, fixture.outside);
		fixture.opener.focus();
		const second = fixture.open();
		second.close.click();
		fixture.outside.focus();
		await second.result;
		assert.strictEqual(document.activeElement, fixture.outside);
	});
});
