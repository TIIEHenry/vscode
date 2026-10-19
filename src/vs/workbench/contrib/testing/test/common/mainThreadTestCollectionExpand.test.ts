/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { MainThreadTestCollection } from '../../common/mainThreadTestCollection.js';
import { TestDiffOpType, TestItemExpandState } from '../../common/testTypes.js';

suite('MainThreadTestCollection expand', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function collectionWithOneTest(expandActual: (id: string, levels: number) => Promise<void>): { collection: MainThreadTestCollection; testId: string } {
		const testId = 'ctrlId';
		const collection = new MainThreadTestCollection({ asCanonicalUri: uri => uri }, expandActual);
		collection.apply([{
			op: TestDiffOpType.Add,
			item: {
				controllerId: 'ctrlId',
				expand: TestItemExpandState.Expandable,
				item: {
					extId: testId,
					label: 'root',
					tags: [],
					busy: false,
					uri: undefined,
					range: null,
					description: null,
					error: null,
					sortText: null,
				},
			},
		}]);
		return { collection, testId };
	}

	test('a rejected expand is not reused; the next expand expands again', async () => {
		const error = new Error('expand failed');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		const { collection, testId } = collectionWithOneTest((_id, _levels) => {
			starts++;
			if (starts === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return Promise.resolve();
		});

		const first = collection.expand(testId, 1);
		const second = collection.expand(testId, 1);
		assert.strictEqual(first, second);
		assert.strictEqual(starts, 1);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(second, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 1, 'a rejected expand must not call expandActual again inside the same call');

		const third = collection.expand(testId, 1);
		assert.notStrictEqual(third, first);
		await third;
		assert.strictEqual(starts, 2, 'the next expand must expand again');
		await collection.expand(testId, 1);
		assert.strictEqual(starts, 2, 'a fulfilled expand stays cached');
	});

	test('a rejection does not clear a replacement expand already stored', async () => {
		const error = new Error('late expand failure');
		let starts = 0;
		let rejectFirst: ((reason: unknown) => void) | undefined;
		let resolveSecond: (() => void) | undefined;
		const { collection, testId } = collectionWithOneTest((_id, levels) => {
			starts++;
			if (levels === 1) {
				return new Promise<void>((_resolve, reject) => {
					rejectFirst = reject;
				});
			}
			return new Promise<void>(resolve => {
				resolveSecond = resolve;
			});
		});

		const first = collection.expand(testId, 1);
		const replacement = collection.expand(testId, 2);
		assert.notStrictEqual(replacement, first);
		assert.strictEqual(starts, 2);

		rejectFirst!(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(starts, 2, 'a rejected expand must not call expandActual again inside the same call');

		const again = collection.expand(testId, 2);
		assert.strictEqual(again, replacement);
		assert.strictEqual(starts, 2, 'a rejection must not clear an expand that replaced this attempt');

		resolveSecond!();
		await replacement;
		await collection.expand(testId, 2);
		assert.strictEqual(starts, 2, 'a fulfilled expand stays cached');
	});
});
