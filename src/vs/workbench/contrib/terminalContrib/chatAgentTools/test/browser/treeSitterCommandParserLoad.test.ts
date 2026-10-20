/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../../base/test/common/utils.js';
import { shareTreeSitterCommandParser } from '../../browser/treeSitterCommandParser.js';

function loadParser<T>(current: { value: Promise<T> | undefined }, load: () => Promise<T>): Promise<T> {
	return shareTreeSitterCommandParser(
		() => current.value,
		next => { current.value = next; },
		load,
	);
}

suite('shareTreeSitterCommandParser', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('a rejected command parser load is not reused; the next call loads again', async () => {
		const current: { value: Promise<string> | undefined } = { value: undefined };
		const error = new Error('command parser load failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const load = () => {
			starts++;
			if (starts === 1) {
				return new Promise<string>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve('parser');
		};

		const first = loadParser(current, load);
		const second = loadParser(current, load);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected load must not call load again inside the same call');
		assert.strictEqual(current.value, undefined);

		const third = loadParser(current, load);
		assert.notStrictEqual(third, first);
		assert.strictEqual(await third, 'parser');
		assert.strictEqual(starts, 2, 'the next call must load again');
		await loadParser(current, load);
		assert.strictEqual(starts, 2, 'a fulfilled load stays cached');
	});

	test('a rejection does not clear a replacement already stored for that load', async () => {
		const current: { value: Promise<string> | undefined } = { value: undefined };
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const first = loadParser(current, () => new Promise<string>((_resolve, reject) => {
			rejectFirst = reject;
		}));
		const replacement = Promise.resolve('parser-replacement');
		current.value = replacement;

		const error = new Error('late command parser load failure');
		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(current.value, replacement);

		let starts = 0;
		const second = loadParser(current, () => {
			starts++;
			return Promise.resolve('parser-again');
		});
		assert.strictEqual(second, replacement);
		assert.strictEqual(starts, 0);
	});
});
