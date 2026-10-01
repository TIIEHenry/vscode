/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { isExplorerAutoRevealSuppressed, runSuppressingExplorerAutoReveal } from '../../common/explorerAutoRevealGate.js';

suite('Explorer auto reveal gate', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('stays held until the sources open settles', async () => {
		let seenDuringOpen = false;
		const pending = runSuppressingExplorerAutoReveal(async () => {
			seenDuringOpen = isExplorerAutoRevealSuppressed();
			await Promise.resolve();
			assert.strictEqual(isExplorerAutoRevealSuppressed(), true);
		});
		assert.strictEqual(isExplorerAutoRevealSuppressed(), true);
		await pending;
		assert.strictEqual(seenDuringOpen, true);
		assert.strictEqual(isExplorerAutoRevealSuppressed(), false);
	});

	test('releases after a rejection or a sync throw', async () => {
		await assert.rejects(() => runSuppressingExplorerAutoReveal(() => Promise.reject(new Error('open failed'))));
		assert.strictEqual(isExplorerAutoRevealSuppressed(), false);

		assert.throws(() => runSuppressingExplorerAutoReveal(() => {
			throw new Error('sync');
		}));
		assert.strictEqual(isExplorerAutoRevealSuppressed(), false);
	});
});
