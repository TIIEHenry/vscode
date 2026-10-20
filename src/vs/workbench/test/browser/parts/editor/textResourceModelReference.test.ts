/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { shareTextResourceModelReference } from '../../../../common/editor/textResourceEditorInput.js';

function loadReference<T>(current: { value: Promise<T> | undefined }, load: () => Promise<T>): Promise<T> {
	return shareTextResourceModelReference(
		() => current.value,
		next => { current.value = next; },
		load,
	);
}

suite('shareTextResourceModelReference', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected text resource resolve is not reused; the next resolve loads again', async () => {
		const current: { value: Promise<string> | undefined } = { value: undefined };
		const error = new Error('text resource resolve failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('model');
		};

		const first = loadReference(current, load);
		const second = loadReference(current, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected resolve must not call load again inside the same call');
		assert.strictEqual(current.value, undefined);

		const third = loadReference(current, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'model');
		assert.strictEqual(starts, 2, 'the next resolve must load again');
		await loadReference(current, load);
		assert.strictEqual(starts, 2, 'a fulfilled resolve stays cached');
	});

	test('a rejection does not clear a replacement already stored for that resolve', async () => {
		const current: { value: Promise<string> | undefined } = { value: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = loadReference(current, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('model-replacement');
		current.value = replacement;

		const error = new Error('late text resource resolve failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(current.value, replacement);

		let starts = 0;
		const second = loadReference(current, () => {
			starts++;
			return Promise.resolve('model-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
