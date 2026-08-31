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
