/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareDebugVisualizerActivation } from '../../common/debugVisualizerActivation.js';

suite('shareDebugVisualizerActivation', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected visualizer activation is not reused; the next lookup activates again', async () => {
		const cache = new Map<string, Promise<void>>();
		const id = 'myVisualizer';
		const error = new Error('debug visualizer activation failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const activate = () => {
			starts++;
			if (starts === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve();
		};

		const first = shareDebugVisualizerActivation(cache, id, activate);
		const second = shareDebugVisualizerActivation(cache, id, activate);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected activation must not call activate again inside the same call');
		assert.strictEqual(cache.has(id), false);

		const third = shareDebugVisualizerActivation(cache, id, activate);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next lookup must activate again');
		await third;
		await shareDebugVisualizerActivation(cache, id, activate);
		assert.strictEqual(starts, 2, 'a fulfilled activation stays cached');
	});

	test('a rejection does not clear a replacement already stored for that id', async () => {
		const cache = new Map<string, Promise<void>>();
		const id = 'myVisualizer';
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareDebugVisualizerActivation(cache, id, () => new Promise<void>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve();
		cache.set(id, replacement);

		const error = new Error('late debug visualizer activation failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get(id), replacement);

		let starts = 0;
		const second = shareDebugVisualizerActivation(cache, id, () => {
			starts++;
			return Promise.resolve();
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
