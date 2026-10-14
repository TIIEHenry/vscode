/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { loadCachedHoverModel } from '../../../browser/agentSessions/agentSessionHoverWidget.js';

suite('loadCachedHoverModel', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('starts again after the first rejection', async () => {
		const slot: { modelRef?: Promise<string | undefined> } = {};
		const error = new Error('hover model failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const start = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string | undefined>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('model');
		};

		const first = loadCachedHoverModel(slot, start);
		const second = loadCachedHoverModel(slot, start);
		assert.strictEqual(first, second);
		assert.strictEqual(slot.modelRef, first);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected load must not start again inside the same call');
		assert.strictEqual(slot.modelRef, undefined);

		assert.strictEqual(await loadCachedHoverModel(slot, start), 'model');
		assert.strictEqual(starts, 2, 'the next load must start again');
		assert.strictEqual(await loadCachedHoverModel(slot, start), 'model');
		assert.strictEqual(starts, 2, 'a fulfilled model stays cached');
	});

	test('does not start again when the load resolves a model or undefined', async () => {
		const modelSlot: { modelRef?: Promise<string | undefined> } = {};
		let modelStarts = 0;
		const startModel = () => {
			modelStarts++;
			return Promise.resolve('model');
		};
		const firstModel = loadCachedHoverModel(modelSlot, startModel);
		assert.strictEqual(await firstModel, 'model');
		assert.strictEqual(await loadCachedHoverModel(modelSlot, startModel), 'model');
		assert.strictEqual(modelStarts, 1);
		assert.strictEqual(modelSlot.modelRef, firstModel);

		const emptySlot: { modelRef?: Promise<undefined> } = {};
		let emptyStarts = 0;
		const startEmpty = () => {
			emptyStarts++;
			return Promise.resolve(undefined);
		};
		const firstEmpty = loadCachedHoverModel(emptySlot, startEmpty);
		const secondEmpty = loadCachedHoverModel(emptySlot, startEmpty);
		assert.strictEqual(firstEmpty, secondEmpty);
		assert.strictEqual(emptyStarts, 1);
		assert.strictEqual(await firstEmpty, undefined);
		assert.strictEqual(await loadCachedHoverModel(emptySlot, startEmpty), undefined);
		assert.strictEqual(emptyStarts, 1, 'undefined is a cached result, not a miss');
		assert.strictEqual(emptySlot.modelRef, firstEmpty);
	});

	test('starts once for concurrent callers', async () => {
		const slot: { modelRef?: Promise<string> } = {};
		let starts = 0;
		let resolveFirst: ((value: string) => void) | undefined;
		const start = () => {
			starts++;
			return new Promise<string>(resolve => {
				resolveFirst = resolve;
			});
		};

		const first = loadCachedHoverModel(slot, start);
		const second = loadCachedHoverModel(slot, start);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		resolveFirst!('model');
		assert.strictEqual(await first, 'model');
		assert.strictEqual(await second, 'model');
		assert.strictEqual(await loadCachedHoverModel(slot, start), 'model');
		assert.strictEqual(starts, 1);
	});
});
