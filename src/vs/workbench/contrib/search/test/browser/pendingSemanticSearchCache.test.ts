/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { acquirePendingSemanticSearch } from '../../browser/pendingSemanticSearchCache.js';

suite('acquirePendingSemanticSearch', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('concurrent calls share one in-flight promise', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let starts = 0;
		let resolveFirst: ((value: string) => void) | undefined;
		const start = () => {
			starts++;
			return new Promise<string>(resolve => {
				resolveFirst = resolve;
			});
		};

		const first = acquirePendingSemanticSearch(slot, start);
		const second = acquirePendingSemanticSearch(slot, start);
		assert.strictEqual(first, second);
		assert.strictEqual(slot.promise, first);
		assert.strictEqual(starts, 1);

		resolveFirst!('ok');
		assert.strictEqual(await first, 'ok');
		assert.strictEqual(await second, 'ok');
		assert.strictEqual(slot.promise, first);
	});

	test('surfaces a rejection without retrying, then starts again on the next call', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		const error = new Error('semantic search failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const start = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('again');
		};

		const first = acquirePendingSemanticSearch(slot, start);
		const second = acquirePendingSemanticSearch(slot, start);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected search must not start again inside the same call');
		assert.strictEqual(slot.promise, undefined);

		assert.strictEqual(await acquirePendingSemanticSearch(slot, start), 'again');
		assert.strictEqual(starts, 2, 'the next search must start again');
	});

	test('returns the same success when the caller did not clear the slot', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let starts = 0;
		let started: Promise<string> | undefined;
		const first = acquirePendingSemanticSearch(slot, () => {
			starts++;
			started = Promise.resolve('ok');
			return started;
		});

		assert.strictEqual(first, started);
		assert.strictEqual(slot.promise, first);
		assert.strictEqual(await first, 'ok');

		const second = acquirePendingSemanticSearch(slot, () => {
			starts++;
			return Promise.resolve('other');
		});
		assert.strictEqual(second, first);
		assert.strictEqual(starts, 1);
		assert.strictEqual(await second, 'ok');
		assert.strictEqual(slot.promise, first);
	});

	test('a caller clear on the first result stays cleared after success', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let starts = 0;
		let resolveFirst: ((value: string) => void) | undefined;
		let clearFirst: (() => void) | undefined;
		const first = acquirePendingSemanticSearch(slot, clearIfCurrent => {
			starts++;
			clearFirst = clearIfCurrent;
			return new Promise<string>(resolve => {
				resolveFirst = resolve;
			});
		});

		clearFirst!();
		assert.strictEqual(slot.promise, undefined);

		resolveFirst!('ok');
		assert.strictEqual(await first, 'ok');
		assert.strictEqual(slot.promise, undefined);
		assert.strictEqual(starts, 1, 'success must not start another attempt after the caller cleared');

		const next = acquirePendingSemanticSearch(slot, () => {
			starts++;
			return Promise.resolve('next');
		});
		assert.strictEqual(starts, 2);
		assert.notStrictEqual(next, first);
		assert.strictEqual(await next, 'next');
	});

	test('a rejection clears the slot only while it still points at that attempt', async () => {
		const slot: { promise: Promise<string> | undefined } = { promise: undefined };
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = acquirePendingSemanticSearch(slot, () => {
			starts++;
			return new Promise<string>((_resolve, reject) => {
				rejectFirst = reject;
			});
		});
		const replacement = Promise.resolve('newer');
		slot.promise = replacement;

		const error = new Error('late semantic failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);

		assert.strictEqual(slot.promise, replacement);
		const second = acquirePendingSemanticSearch(slot, () => {
			starts++;
			return Promise.resolve('other');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(await second, 'newer');
		assert.strictEqual(starts, 1);
	});
});
