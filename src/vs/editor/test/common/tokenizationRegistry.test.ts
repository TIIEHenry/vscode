/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { TokenizationRegistry } from '../../common/tokenizationRegistry.js';

suite('TokenizationRegistry', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('asks the factory again on the second resolve after the first creation rejects', async () => {
		const registry = new TokenizationRegistry<{ id: number }>();
		const error = new Error('first failure');
		const support = { id: 7 };
		let asks = 0;
		disposables.add(registry.registerFactory('lang', {
			get tokenizationSupport(): Promise<{ id: number } | null> {
				asks++;
				if (asks === 1) {
					return Promise.reject(error);
				}
				return Promise.resolve(support);
			}
		}));

		await assert.rejects(() => registry.getOrCreate('lang'), (reason: unknown) => reason === error);
		assert.strictEqual(asks, 1);
		assert.strictEqual(registry.get('lang'), null);
		assert.strictEqual(registry.isResolved('lang'), false);

		const created = await registry.getOrCreate('lang');
		assert.strictEqual(asks, 2);
		assert.strictEqual(created, support);
		assert.strictEqual(registry.get('lang'), support);
		assert.strictEqual(registry.isResolved('lang'), true);

		const again = await registry.getOrCreate('lang');
		assert.strictEqual(asks, 2);
		assert.strictEqual(again, support);
	});

	test('does not ask the factory again after the first creation succeeds', async () => {
		const registry = new TokenizationRegistry<{ id: number }>();
		const support = { id: 3 };
		let asks = 0;
		disposables.add(registry.registerFactory('lang', {
			get tokenizationSupport(): Promise<{ id: number } | null> {
				asks++;
				return Promise.resolve(support);
			}
		}));

		const first = await registry.getOrCreate('lang');
		const second = await registry.getOrCreate('lang');

		assert.strictEqual(asks, 1);
		assert.strictEqual(first, support);
		assert.strictEqual(second, support);
		assert.strictEqual(registry.get('lang'), support);
		assert.strictEqual(registry.isResolved('lang'), true);
	});

	test('concurrent resolve calls share one in-flight factory request', async () => {
		const registry = new TokenizationRegistry<{ id: number }>();
		const support = { id: 4 };
		let asks = 0;
		let release!: (value: { id: number }) => void;
		const gate = new Promise<{ id: number }>(resolve => { release = resolve; });
		disposables.add(registry.registerFactory('lang', {
			get tokenizationSupport(): Promise<{ id: number } | null> {
				asks++;
				return gate;
			}
		}));

		const first = registry.getOrCreate('lang');
		const second = registry.getOrCreate('lang');
		assert.strictEqual(asks, 1);

		release(support);
		const [createdFirst, createdSecond] = await Promise.all([first, second]);
		assert.strictEqual(asks, 1);
		assert.strictEqual(createdFirst, support);
		assert.strictEqual(createdSecond, support);
		assert.strictEqual(registry.get('lang'), support);
	});
});
