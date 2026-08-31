/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	ConnectionPreferencesPane,
	getConnectionTestStatusText,
} from '../../browser/connectionPreferencesPane.js';

suite('ConnectionPreferencesPane', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('getConnectionTestStatusText returns honest not-connected copy', () => {
		assert.strictEqual(getConnectionTestStatusText(), 'Not connected — no engine.');
	});

	test('pane shows honest empty state without editable connection fields', () => {
		const pane = store.add(new ConnectionPreferencesPane());
		const container = pane.getDomNode();
		document.body.appendChild(container);

		const emptyState = container.querySelector('.connection-empty-state') as HTMLElement;
		assert.ok(emptyState);
		assert.strictEqual(emptyState.textContent, 'Connection not connected — no engine.');

		assert.strictEqual(container.querySelector('.connection-field-row'), null);
		assert.strictEqual(container.querySelector('.connection-field-input'), null);
		assert.strictEqual(container.querySelector('.monaco-checkbox'), null);

		container.remove();
	});

	test('Test Connection click surfaces honest status without faking success', () => {
		const pane = store.add(new ConnectionPreferencesPane());
		const container = pane.getDomNode();
		document.body.appendChild(container);

		const testButton = container.querySelector('.connection-test-row .monaco-button') as HTMLButtonElement;
		const testStatus = container.querySelector('.connection-test-status') as HTMLElement;
		assert.ok(testButton);
		assert.ok(testStatus);
		assert.strictEqual(testStatus.textContent, '');

		testButton.click();
		assert.strictEqual(testStatus.textContent, getConnectionTestStatusText());
		assert.notStrictEqual(testStatus.textContent, 'Connected');

		container.remove();
	});
});
