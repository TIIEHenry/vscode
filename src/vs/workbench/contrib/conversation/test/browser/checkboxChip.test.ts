/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { CheckboxChip } from '../../browser/checkboxChip.js';

suite('Conversation: CheckboxChip', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('renders label and toggles checked state on click', () => {
		let toggled = false;
		let lastChecked = false;
		const chip = disposables.add(new CheckboxChip({
			label: 'New Worktree',
			ariaLabel: 'Isolate in new worktree',
			onToggle: checked => {
				toggled = true;
				lastChecked = checked;
			},
		}));

		const container = document.createElement('div');
		const element = chip.render(container);
		assert.ok(element);
		assert.strictEqual(chip.checked, false);

		const labelEl = element.querySelector('.conversation-lens-checkbox-label');
		assert.ok(labelEl);
		assert.strictEqual(labelEl.textContent, 'New Worktree');

		// Click to toggle
		const row = element.querySelector('.action-label') as HTMLElement;
		assert.ok(row);
		row.click();

		assert.strictEqual(toggled, true);
		assert.strictEqual(lastChecked, true);
		assert.strictEqual(chip.checked, true);
	});

	test('handles state updates (disabled and disabledReason)', () => {
		const chip = disposables.add(new CheckboxChip({
			label: 'New Worktree',
			ariaLabel: 'Isolate in new worktree',
			onToggle: () => { },
		}));

		const container = document.createElement('div');
		const element = chip.render(container);

		chip.update({
			checked: true,
			state: 'disabled',
			disabledReason: 'Worktree is not supported in current environment',
		});

		assert.strictEqual(chip.checked, true);
		assert.ok(element.classList.contains('disabled'));
		const row = element.querySelector('.action-label') as HTMLElement;
		assert.strictEqual(row.title, 'Worktree is not supported in current environment');
	});
});
