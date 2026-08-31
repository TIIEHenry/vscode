/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { EnginePreferencesPane } from '../../browser/enginePreferencesPane.js';

suite('EnginePreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('pane shows honest empty state without editable engine fields', () => {
		const pane = store.add(new EnginePreferencesPane());
		const container = pane.getDomNode();
		document.body.appendChild(container);

		const title = container.querySelector('h2') as HTMLElement;
		assert.ok(title);
		assert.strictEqual(title.textContent, 'Engine');

		const emptyState = container.querySelector('.engine-empty-state') as HTMLElement;
		assert.ok(emptyState);
		assert.strictEqual(emptyState.textContent, 'Engine not connected — no engine.');

		assert.strictEqual(container.querySelector('.engine-field-row'), null);
		assert.strictEqual(container.querySelector('.engine-field-input'), null);

		container.remove();
	});
});
