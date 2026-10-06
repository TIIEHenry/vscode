/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { promptSasConfirmInPane } from '../../browser/connectionPreferencesPaneSas.js';

suite('connectionPreferencesPaneSas (browser)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('disconnecting pairing host cancels SAS and releases document focus trap', async () => {
		const host = document.createElement('div');
		host.className = 'connection-pairing-confirm-host';
		document.body.appendChild(host);
		const outside = document.createElement('button');
		outside.textContent = 'Outside';
		document.body.appendChild(outside);

		const flow = promptSasConfirmInPane(host, {
			displayName: 'Studio',
			sasCode: 'ABCD-EFGH',
			engineIdentityId: '0123456789abcdef',
		});
		await Promise.resolve();
		assert.ok(host.querySelector('.monaco-dialog-box'));

		host.remove();
		const result = await flow;
		assert.strictEqual(result.confirmed, false);

		outside.focus();
		await Promise.resolve();
		assert.strictEqual(document.activeElement, outside);

		outside.remove();
	});
});
