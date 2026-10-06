/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { getDefaultHoverDelegate } from '../../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { StatusbarEntryItem } from '../../../../browser/parts/statusbar/statusbarItem.js';
import { IStatusbarEntry } from '../../../../services/statusbar/browser/statusbar.js';
import { workbenchInstantiationService } from '../../workbenchTestServices.js';

suite('StatusbarEntryItem', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createStatusbarEntryItem(entry: IStatusbarEntry): StatusbarEntryItem {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const container = document.createElement('div');
		const hoverDelegate = getDefaultHoverDelegate('mouse');
		return store.add(instantiationService.createInstance(StatusbarEntryItem, container, entry, hoverDelegate));
	}

	test('empty text with showProgress=true reveals labelContainer and has progress icon', () => {
		const item = createStatusbarEntryItem({
			name: 'test',
			text: '',
			showProgress: true,
			ariaLabel: 'test'
		});

		assert.notStrictEqual(item.labelContainer.style.display, 'none');
		assert.ok(item.labelContainer.querySelector('.codicon'));
	});

	test('empty text toggles visibility when showProgress changes from false to true and back to false', () => {
		const item = createStatusbarEntryItem({
			name: 'test',
			text: '',
			showProgress: false,
			ariaLabel: 'test'
		});

		assert.strictEqual(item.labelContainer.style.display, 'none');

		item.update({
			name: 'test',
			text: '',
			showProgress: true,
			ariaLabel: 'test'
		});

		assert.notStrictEqual(item.labelContainer.style.display, 'none');
		assert.ok(item.labelContainer.querySelector('.codicon'));

		item.update({
			name: 'test',
			text: '',
			showProgress: false,
			ariaLabel: 'test'
		});

		assert.strictEqual(item.labelContainer.style.display, 'none');
	});

	test('transition from non-empty text to empty text keeps labelContainer visible when showProgress is true', () => {
		const item = createStatusbarEntryItem({
			name: 'test',
			text: 'Processing',
			showProgress: true,
			ariaLabel: 'test'
		});

		assert.notStrictEqual(item.labelContainer.style.display, 'none');

		item.update({
			name: 'test',
			text: '',
			showProgress: true,
			ariaLabel: 'test'
		});

		assert.notStrictEqual(item.labelContainer.style.display, 'none');
		assert.ok(item.labelContainer.querySelector('.codicon'));
	});
});
