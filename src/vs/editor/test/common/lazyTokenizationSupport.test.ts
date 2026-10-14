/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { shareLazyTokenizationSupport } from '../../common/languages.js';

suite('shareLazyTokenizationSupport', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected tokenization support creation is not reused; the next read creates again', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('tokenization support create failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const create = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('support');
		};

		const first = shareLazyTokenizationSupport(slot, create);
		const second = shareLazyTokenizationSupport(slot, create);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected creation must not call create again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		const third = shareLazyTokenizationSupport(slot, create);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'support');
		assert.strictEqual(starts, 2, 'the next read must create again');
		await shareLazyTokenizationSupport(slot, create);
		assert.strictEqual(starts, 2, 'a fulfilled creation stays cached');
	});

	test('a rejection does not clear a replacement already stored in the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareLazyTokenizationSupport(slot, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('support-replacement');
		slot.promise = replacement;

		const error = new Error('late tokenization support failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(slot.promise, replacement);

		let starts = 0;
		const second = shareLazyTokenizationSupport(slot, () => {
			starts++;
			return Promise.resolve('support-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
