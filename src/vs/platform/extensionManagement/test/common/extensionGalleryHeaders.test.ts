/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IExtensionGalleryHeadersSlot, loadExtensionGalleryHeaders } from '../../common/extensionGalleryHeaders.js';

suite('loadExtensionGalleryHeaders', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function createSlot(): IExtensionGalleryHeadersSlot<{ id: string }> {
		return { promise: undefined };
	}

	test('reads again after the cached promise rejects', async () => {
		const slot = createSlot();
		const error = new Error('marketplace headers failed');
		let calls = 0;
		const resolve = () => {
			calls++;
			if (calls === 1) {
				return Promise.reject(error);
			}
			return Promise.resolve({ id: 'ok' });
		};

		const first = loadExtensionGalleryHeaders(slot, resolve);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(calls, 1);
		assert.strictEqual(slot.promise, undefined);

		const second = loadExtensionGalleryHeaders(slot, resolve);
		assert.notStrictEqual(second, first);
		assert.deepStrictEqual(await second, { id: 'ok' });
		assert.strictEqual(calls, 2);
		assert.strictEqual(loadExtensionGalleryHeaders(slot, resolve), second);
		assert.strictEqual(calls, 2);
	});

	test('shares one read while it is in flight', async () => {
		const slot = createSlot();
		let resolveResult!: (value: { id: string }) => void;
		let calls = 0;
		const resolve = () => {
			calls++;
			return new Promise<{ id: string }>(resolveResultInner => { resolveResult = resolveResultInner; });
		};

		const first = loadExtensionGalleryHeaders(slot, resolve);
		const second = loadExtensionGalleryHeaders(slot, resolve);
		assert.strictEqual(calls, 1);
		assert.strictEqual(second, first);

		resolveResult({ id: 'ok' });
		assert.deepStrictEqual(await first, { id: 'ok' });
		assert.deepStrictEqual(await second, { id: 'ok' });
		assert.strictEqual(loadExtensionGalleryHeaders(slot, resolve), first);
		assert.strictEqual(calls, 1);
	});

	test('does not read again after success', async () => {
		const slot = createSlot();
		let calls = 0;
		const resolve = () => {
			calls++;
			return Promise.resolve({ id: 'ok' });
		};

		const first = loadExtensionGalleryHeaders(slot, resolve);
		assert.deepStrictEqual(await first, { id: 'ok' });
		const second = loadExtensionGalleryHeaders(slot, resolve);
		assert.strictEqual(second, first);
		assert.deepStrictEqual(await second, { id: 'ok' });
		assert.strictEqual(calls, 1);
	});

	test('a rejection drops the slot only while it still points at that attempt', async () => {
		const slot = createSlot();
		let rejectAttempt!: (error: Error) => void;
		let calls = 0;
		const first = loadExtensionGalleryHeaders(slot, () => {
			calls++;
			return new Promise<{ id: string }>((_resolve, reject) => { rejectAttempt = reject; });
		});
		const replacement = Promise.resolve({ id: 'newer' });
		slot.promise = replacement;

		const error = new Error('late failure');
		rejectAttempt(error);
		await assert.rejects(first, (reason: unknown) => reason === error);

		assert.strictEqual(slot.promise, replacement);
		const second = loadExtensionGalleryHeaders(slot, () => {
			calls++;
			return Promise.resolve({ id: 'other' });
		});
		assert.strictEqual(second, replacement);
		assert.deepStrictEqual(await second, { id: 'newer' });
		assert.strictEqual(calls, 1);
	});
});
