/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import type { IWebWorkerClient, Proxied } from '../../../../../base/common/worker/webWorker.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { IWebWorkerService } from '../../../../../platform/webWorker/browser/webWorkerService.js';
import { ThreadedBackgroundTokenizerFactory } from '../../browser/backgroundTokenization/threadedBackgroundTokenizerFactory.js';
import type { TextMateTokenizationWorker } from '../../browser/backgroundTokenization/worker/textMateTokenizationWorker.worker.js';

interface IFakeWorker {
	readonly init: DeferredPromise<void>;
	disposeCount: number;
}

function requestWorkerProxy(factory: ThreadedBackgroundTokenizerFactory): Promise<Proxied<TextMateTokenizationWorker> | null> {
	const getWorkerProxy = Reflect.get(factory, '_getWorkerProxy') as () => Promise<Proxied<TextMateTokenizationWorker> | null>;
	return getWorkerProxy.call(factory);
}

function cachedWorkerProxyPromise(factory: ThreadedBackgroundTokenizerFactory): Promise<unknown> | null {
	return Reflect.get(factory, '_workerProxyPromise') as Promise<unknown> | null;
}

function createHarness(store: ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>): { factory: ThreadedBackgroundTokenizerFactory; workers: IFakeWorker[] } {
	const workers: IFakeWorker[] = [];
	const webWorkerService: IWebWorkerService = {
		_serviceBrand: undefined,
		createWorkerClient: <T extends object>(): IWebWorkerClient<T> => {
			const init = new DeferredPromise<void>();
			const fake: IFakeWorker = { init, disposeCount: 0 };
			workers.push(fake);
			const client: IWebWorkerClient<TextMateTokenizationWorker> = {
				proxy: {
					$init: () => init.p,
					$acceptTheme: async () => { },
				} as Proxied<TextMateTokenizationWorker>,
				dispose: () => { fake.disposeCount++; },
				setChannel: () => { },
				getChannel: () => { throw new Error('unused'); },
			};
			return client as unknown as IWebWorkerClient<T>;
		},
		getWorkerUrl: () => '',
	};
	const factory = new ThreadedBackgroundTokenizerFactory(
		() => { },
		() => true,
		{} as never,
		{} as never,
		{} as never,
		{ isBuilt: false } as never,
		{} as never,
		{} as never,
		webWorkerService,
	);
	store.add({ dispose: () => factory.dispose() });
	return { factory, workers };
}

suite('ThreadedBackgroundTokenizerFactory', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('creates another worker after the first $init fails', async () => {
		const { factory, workers } = createHarness(store);
		const first = requestWorkerProxy(factory);
		assert.strictEqual(workers.length, 1);

		await workers[0].init.error(new Error('init failed'));
		await assert.rejects(first, (error: unknown) => error instanceof Error && error.message === 'init failed');

		assert.strictEqual(cachedWorkerProxyPromise(factory), null);
		const second = requestWorkerProxy(factory);
		assert.notStrictEqual(second, first);
		assert.strictEqual(workers.length, 2);
		assert.strictEqual(cachedWorkerProxyPromise(factory), second);
	});

	test('in-flight requests share one worker creation', async () => {
		const { factory, workers } = createHarness(store);
		const first = requestWorkerProxy(factory);
		const second = requestWorkerProxy(factory);

		assert.strictEqual(first, second);
		assert.strictEqual(workers.length, 1);
		assert.strictEqual(cachedWorkerProxyPromise(factory), first);

		workers[0].init.complete();
		const firstProxy = await first;
		const secondProxy = await second;
		assert.ok(firstProxy);
		assert.strictEqual(secondProxy, firstProxy);
		assert.strictEqual(workers.length, 1);
		assert.strictEqual(workers[0].disposeCount, 0);
	});

	test('disposes the worker when $init fails', async () => {
		const { factory, workers } = createHarness(store);
		const first = requestWorkerProxy(factory);

		await workers[0].init.error(new Error('init failed'));
		await assert.rejects(first);

		assert.strictEqual(workers[0].disposeCount, 1);
		assert.strictEqual(workers.length, 1);
		assert.strictEqual(cachedWorkerProxyPromise(factory), null);
	});

	test('does not create another worker after $init succeeds', async () => {
		const { factory, workers } = createHarness(store);
		const first = requestWorkerProxy(factory);
		workers[0].init.complete();
		const proxy = await first;

		const second = requestWorkerProxy(factory);
		assert.strictEqual(second, first);
		assert.strictEqual(await second, proxy);
		assert.strictEqual(workers.length, 1);
		assert.strictEqual(workers[0].disposeCount, 0);
		assert.strictEqual(cachedWorkerProxyPromise(factory), first);
	});

	test('an older $init failure does not dispose the worker created after grammar definitions change', async () => {
		const { factory, workers } = createHarness(store);
		const first = requestWorkerProxy(factory);
		factory.setGrammarDefinitions([]);

		assert.strictEqual(workers[0].disposeCount, 1);
		assert.strictEqual(cachedWorkerProxyPromise(factory), null);

		const second = requestWorkerProxy(factory);
		assert.strictEqual(workers.length, 2);
		assert.notStrictEqual(second, first);

		await workers[0].init.error(new Error('stale init'));
		await assert.rejects(first, (error: unknown) => error instanceof Error && error.message === 'stale init');

		assert.strictEqual(workers[0].disposeCount, 1);
		assert.strictEqual(workers[1].disposeCount, 0);
		assert.strictEqual(cachedWorkerProxyPromise(factory), second);

		workers[1].init.complete();
		assert.ok(await second);
		assert.strictEqual(requestWorkerProxy(factory), second);
		assert.strictEqual(workers.length, 2);

		factory.setGrammarDefinitions([]);
		assert.strictEqual(workers[1].disposeCount, 1);
		assert.strictEqual(cachedWorkerProxyPromise(factory), null);
	});
});
