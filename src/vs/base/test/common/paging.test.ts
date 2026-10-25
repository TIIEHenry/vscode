/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { disposableTimeout } from '../../common/async.js';
import { CancellationToken, CancellationTokenSource } from '../../common/cancellation.js';
import { CancellationError, isCancellationError } from '../../common/errors.js';
import { IPageIterator, IPager, PageIteratorPager, PagedModel } from '../../common/paging.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from './utils.js';

function getPage(pageIndex: number, cancellationToken: CancellationToken): Promise<number[]> {
	if (cancellationToken.isCancellationRequested) {
		return Promise.reject(new CancellationError());
	}

	return Promise.resolve([0, 1, 2, 3, 4].map(i => i + (pageIndex * 5)));
}

class TestPager implements IPager<number> {

	readonly firstPage = [0, 1, 2, 3, 4];
	readonly pageSize = 5;
	readonly total = 100;
	readonly getPage: (pageIndex: number, cancellationToken: CancellationToken) => Promise<number[]>;

	constructor(getPageFn?: (pageIndex: number, cancellationToken: CancellationToken) => Promise<number[]>) {
		this.getPage = getPageFn || getPage;
	}
}

suite('PagedModel', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('isResolved', () => {
		const pager = new TestPager();
		const model = new PagedModel(pager);

		assert(model.isResolved(0));
		assert(model.isResolved(1));
		assert(model.isResolved(2));
		assert(model.isResolved(3));
		assert(model.isResolved(4));
		assert(!model.isResolved(5));
		assert(!model.isResolved(6));
		assert(!model.isResolved(7));
		assert(!model.isResolved(8));
		assert(!model.isResolved(9));
		assert(!model.isResolved(10));
		assert(!model.isResolved(99));
	});

	test('resolve single', async () => {
		const pager = new TestPager();
		const model = new PagedModel(pager);

		assert(!model.isResolved(5));

		await model.resolve(5, CancellationToken.None);
		assert(model.isResolved(5));
	});

	test('resolve page', async () => {
		const pager = new TestPager();
		const model = new PagedModel(pager);

		assert(!model.isResolved(5));
		assert(!model.isResolved(6));
		assert(!model.isResolved(7));
		assert(!model.isResolved(8));
		assert(!model.isResolved(9));
		assert(!model.isResolved(10));

		await model.resolve(5, CancellationToken.None);
		assert(model.isResolved(5));
		assert(model.isResolved(6));
		assert(model.isResolved(7));
		assert(model.isResolved(8));
		assert(model.isResolved(9));
		assert(!model.isResolved(10));
	});

	test('resolve page 2', async () => {
		const pager = new TestPager();
		const model = new PagedModel(pager);

		assert(!model.isResolved(5));
		assert(!model.isResolved(6));
		assert(!model.isResolved(7));
		assert(!model.isResolved(8));
		assert(!model.isResolved(9));
		assert(!model.isResolved(10));

		await model.resolve(10, CancellationToken.None);
		assert(!model.isResolved(5));
		assert(!model.isResolved(6));
		assert(!model.isResolved(7));
		assert(!model.isResolved(8));
		assert(!model.isResolved(9));
		assert(model.isResolved(10));
	});

	test('preemptive cancellation works', async function () {
		const pager = new TestPager(() => {
			assert(false);
		});

		const model = new PagedModel(pager);

		try {
			await model.resolve(5, CancellationToken.Cancelled);
			return assert(false);
		}
		catch (err) {
			return assert(isCancellationError(err));
		}
	});

	test('cancellation works', function () {
		const pager = new TestPager((_, token) => new Promise((_, e) => {
			store.add(token.onCancellationRequested(() => e(new CancellationError())));
		}));

		const model = new PagedModel(pager);
		const tokenSource = store.add(new CancellationTokenSource());

		const promise = model.resolve(5, tokenSource.token).then(
			() => assert(false),
			err => assert(isCancellationError(err))
		);

		setTimeout(() => tokenSource.cancel(), 10);

		return promise;
	});

	test('same page cancellation works', function () {
		let state = 'idle';

		const pager = new TestPager((pageIndex, token) => {
			state = 'resolving';

			return new Promise((_, e) => {
				store.add(token.onCancellationRequested(() => {
					state = 'idle';
					e(new CancellationError());
				}));
			});
		});

		const model = new PagedModel(pager);

		assert.strictEqual(state, 'idle');

		const tokenSource1 = new CancellationTokenSource();
		const promise1 = model.resolve(5, tokenSource1.token).then(
			() => assert(false),
			err => assert(isCancellationError(err))
		);

		assert.strictEqual(state, 'resolving');

		const tokenSource2 = new CancellationTokenSource();
		const promise2 = model.resolve(6, tokenSource2.token).then(
			() => assert(false),
			err => assert(isCancellationError(err))
		);

		assert.strictEqual(state, 'resolving');

		store.add(disposableTimeout(() => {
			assert.strictEqual(state, 'resolving');
			tokenSource1.cancel();
			assert.strictEqual(state, 'resolving');

			store.add(disposableTimeout(() => {
				assert.strictEqual(state, 'resolving');
				tokenSource2.cancel();
				assert.strictEqual(state, 'idle');
			}, 10));
		}, 10));

		return Promise.all([promise1, promise2]);
	});
});

suite('PageIteratorPager', () => {
	class Iterator implements IPageIterator<number> {
		constructor(
			readonly elements: number[],
			readonly total: number,
			readonly hasNextPage: boolean,
			private readonly page: number,
			private readonly next: (page: number) => Promise<Iterator>,
			private readonly calls: number[]
		) { }

		getNextPage(_token: CancellationToken): Promise<IPageIterator<number>> {
			this.calls.push(this.page + 1);
			return this.next(this.page + 1);
		}
	}

	function createIterator(pages: number[][], calls: number[], delay = 0): Iterator {
		const build = (page: number): Iterator => new Iterator(
			pages[page] ?? [],
			pages.length * 5,
			page + 1 < pages.length,
			page,
			async nextPage => {
				if (delay) {
					await new Promise(resolve => setTimeout(resolve, delay));
				}
				return build(nextPage);
			},
			calls
		);
		return build(0);
	}

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('a higher page joins the load already running instead of starting a second cursor', async () => {
		const calls: number[] = [];
		const pages = [[0, 1], [2, 3], [4, 5], [6, 7]];
		const pager = new PageIteratorPager(createIterator(pages, calls, 5));
		store.add({ dispose: () => pager.dispose() });

		const [first, third] = await Promise.all([
			pager.getPage(1, CancellationToken.None),
			pager.getPage(3, CancellationToken.None)
		]);

		assert.deepStrictEqual({ first, third, calls }, {
			first: [2, 3],
			third: [6, 7],
			// One sequential walk: page 1, 2, 3. No two `getNextPage` calls overlap.
			calls: [1, 2, 3]
		});
	});

	test('a lower page requested after a higher one comes from the same cached walk', async () => {
		const calls: number[] = [];
		const pager = new PageIteratorPager(createIterator([[0], [1], [2], [3]], calls, 2));
		store.add({ dispose: () => pager.dispose() });

		const third = await pager.getPage(3, CancellationToken.None);
		const first = await pager.getPage(1, CancellationToken.None);

		assert.deepStrictEqual({ third, first, calls }, { third: [3], first: [1], calls: [1, 2, 3] });
	});

	test('one caller cancelling leaves the shared load running for the other', async () => {
		const calls: number[] = [];
		const pager = new PageIteratorPager(createIterator([[0], [1], [2]], calls, 5));
		store.add({ dispose: () => pager.dispose() });

		const cancelled = new CancellationTokenSource();
		const first = pager.getPage(2, cancelled.token);
		const second = pager.getPage(2, CancellationToken.None);
		cancelled.cancel();

		await assert.rejects(first, (error: Error) => isCancellationError(error));
		assert.deepStrictEqual(await second, [2]);
		assert.deepStrictEqual(calls, [1, 2]);
	});

	test('stops loading once every caller has cancelled', async () => {
		const calls: number[] = [];
		const pager = new PageIteratorPager(createIterator([[0], [1], [2], [3]], calls, 5));
		store.add({ dispose: () => pager.dispose() });

		const cancelled = new CancellationTokenSource();
		const pending = pager.getPage(3, cancelled.token);
		cancelled.cancel();

		await assert.rejects(pending, (error: Error) => isCancellationError(error));
		await new Promise(resolve => setTimeout(resolve, 20));
		assert.deepStrictEqual(calls, [1]);
	});
});
