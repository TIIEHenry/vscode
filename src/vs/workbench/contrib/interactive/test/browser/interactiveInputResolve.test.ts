/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { clearInteractiveInputResolverOnReject } from '../../browser/interactiveEditorInput.js';

function resolveInput<T>(current: { value: Promise<T> | null }, compute: () => Promise<T>): Promise<T> {
	if (current.value) {
		return current.value;
	}

	current.value = compute();
	clearInteractiveInputResolverOnReject(() => current.value, () => {
		current.value = null;
	});
	return current.value;
}

suite('interactive input resolve', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected interactive notebook resolve is not reused; the next call resolves again', async () => {
		const current: { value: Promise<string> | null } = { value: null };
		const error = new Error('interactive resolve failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const compute = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('notebook');
		};

		const first = resolveInput(current, compute);
		const second = resolveInput(current, compute);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected resolve must not call compute again inside the same call');
		assert.strictEqual(current.value, null);

		const third = resolveInput(current, compute);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next call must resolve again');
		await third;
		await resolveInput(current, compute);
		assert.strictEqual(starts, 2, 'a fulfilled resolve stays cached');
	});

	test('a rejection does not clear a replacement already stored for that resolve', async () => {
		const current: { value: Promise<string> | null } = { value: null };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = resolveInput(current, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('replacement');
		current.value = replacement;

		const error = new Error('late interactive resolve failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(current.value, replacement);

		let starts = 0;
		const second = resolveInput(current, () => {
			starts++;
			return Promise.resolve('again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
