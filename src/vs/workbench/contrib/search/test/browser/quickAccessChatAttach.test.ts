/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isQuickAccessChatAttachAllowed, runQuickAccessChatAttach } from '../../../chat/browser/chat.js';

suite('Quick Access chat attach', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isQuickAccessChatAttachAllowed is true only in the Agents window', () => {
		assert.strictEqual(isQuickAccessChatAttachAllowed(false), false);
		assert.strictEqual(isQuickAccessChatAttachAllowed(undefined), false);
		assert.strictEqual(isQuickAccessChatAttachAllowed(true), true);
	});

	test('default Code window does not attach and does not read the chat widget', () => {
		let reads = 0;
		const attached = runQuickAccessChatAttach({
			isSessionsWindow: false,
			wantsAttach: true,
			addContext: () => { reads++; },
		});
		assert.strictEqual(attached, false);
		assert.strictEqual(reads, 0);
	});

	test('missing window flag does not attach', () => {
		let reads = 0;
		const attached = runQuickAccessChatAttach({
			isSessionsWindow: undefined,
			wantsAttach: true,
			addContext: () => { reads++; },
		});
		assert.strictEqual(attached, false);
		assert.strictEqual(reads, 0);
	});

	test('Agents window still attaches when the pick asks to attach', () => {
		let reads = 0;
		const attached = runQuickAccessChatAttach({
			isSessionsWindow: true,
			wantsAttach: true,
			addContext: () => { reads++; },
		});
		assert.strictEqual(attached, true);
		assert.strictEqual(reads, 1);
	});

	test('Agents window does not attach when the pick is not an attach', () => {
		let reads = 0;
		const attached = runQuickAccessChatAttach({
			isSessionsWindow: true,
			wantsAttach: false,
			addContext: () => { reads++; },
		});
		assert.strictEqual(attached, false);
		assert.strictEqual(reads, 0);
	});
});
