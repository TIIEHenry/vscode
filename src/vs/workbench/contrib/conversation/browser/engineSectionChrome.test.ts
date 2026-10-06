/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { EnginePreferencesSectionBase } from './engineSectionChrome.js';

class TestEnginePreferencesSection extends EnginePreferencesSectionBase {
	layout(_width: number, _height: number): void {
	}

	showFailureStatus(message: string): void {
		this.showStatus(message, 'error');
	}

	showCatalogEmpty(message: string): void {
		this.showEmptyState(message);
	}

	showInfoStatus(message: string): void {
		this.showStatus(message, 'info');
	}
}

suite('EnginePreferencesSectionBase', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('showEmptyState clears a visible failure status so stale error copy is not stacked', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		try {
			const section = new TestEnginePreferencesSection(parent, '.engine-test-section', 'Tools');
			section.showFailureStatus('Could not load tools catalog.');

			const status = parent.querySelector('.engine-section-status') as HTMLElement;
			const empty = parent.querySelector('.engine-section-empty') as HTMLElement;
			assert.ok(status.classList.contains('is-visible'));
			assert.strictEqual(status.textContent, 'Could not load tools catalog.');

			section.showCatalogEmpty('No tools on this engine yet.');
			assert.ok(!status.classList.contains('is-visible'), 'failure status must not stay visible above empty copy');
			assert.strictEqual(status.textContent, '');
			assert.ok(empty.classList.contains('is-visible'));
			assert.strictEqual(empty.textContent, 'No tools on this engine yet.');
		} finally {
			parent.remove();
		}
	});

	test('showStatus hides empty state so list status does not share the pane with empty copy', () => {
		const parent = document.createElement('div');
		document.body.appendChild(parent);
		try {
			const section = new TestEnginePreferencesSection(parent, '.engine-test-section', 'Rules');
			section.showCatalogEmpty('No project rules yet.');

			const status = parent.querySelector('.engine-section-status') as HTMLElement;
			const empty = parent.querySelector('.engine-section-empty') as HTMLElement;
			assert.ok(empty.classList.contains('is-visible'));

			section.showInfoStatus('Loading rules…');
			assert.ok(!empty.classList.contains('is-visible'));
			assert.strictEqual(empty.textContent, '');
			assert.ok(status.classList.contains('is-visible'));
			assert.strictEqual(status.textContent, 'Loading rules…');
		} finally {
			parent.remove();
		}
	});
});
