/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareExtensionHostActivation } from '../../common/extensionHostActivationCache.js';

suite('shareExtensionHostActivation', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected activation is not reused; the next activation starts again', async () => {
		const cache = new Map<string, Promise<void>>();
		const activationEvent = 'onDebugVisualizer:example';
		const error = new Error('activation failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve();
		};

		const first = shareExtensionHostActivation(cache, activationEvent, load);
		const second = shareExtensionHostActivation(cache, activationEvent, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected activation must not call load again inside the same call');
		assert.strictEqual(cache.has(activationEvent), false);

		const third = shareExtensionHostActivation(cache, activationEvent, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(starts, 2, 'the next activation must start again');
		await third;
		await shareExtensionHostActivation(cache, activationEvent, load);
		assert.strictEqual(starts, 2, 'a fulfilled activation stays cached');
	});

	test('a rejection does not clear a replacement already stored for that event', async () => {
		const cache = new Map<string, Promise<void>>();
		const activationEvent = 'onDebugVisualizer:example';
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = shareExtensionHostActivation(cache, activationEvent, () => new Promise<void>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve();
		cache.set(activationEvent, replacement);

		const error = new Error('late activation failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(cache.get(activationEvent), replacement);

		let starts = 0;
		const second = shareExtensionHostActivation(cache, activationEvent, () => {
			starts++;
			return Promise.resolve();
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
