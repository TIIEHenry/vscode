/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ok, strictEqual } from 'assert';
import { Event } from '../../../../common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../test/common/utils.js';
import { IStorageDatabase, IUpdateRequest, Storage } from '../../common/storage.js';

class ScriptedStorageDatabase implements IStorageDatabase {

	readonly onDidChangeItemsExternal = Event.None;

	getItemsCalls = 0;

	private readonly resolvers: Array<(items: Map<string, string>) => void> = [];

	constructor(
		private readonly steps: Array<'reject' | 'defer' | Map<string, string>>,
		private readonly failure: Error
	) { }

	getItems(): Promise<Map<string, string>> {
		const step = this.steps[this.getItemsCalls] ?? this.steps[this.steps.length - 1];
		this.getItemsCalls++;

		if (step === 'reject') {
			return Promise.reject(this.failure);
		}

		if (step === 'defer') {
			return new Promise(resolve => this.resolvers.push(resolve));
		}

		return Promise.resolve(new Map(step));
	}

	release(items: Map<string, string>): void {
		const pending = this.resolvers.splice(0, this.resolvers.length);
		for (const resolve of pending) {
			resolve(new Map(items));
		}
	}

	async updateItems(_request: IUpdateRequest): Promise<void> { }

	async optimize(): Promise<void> { }

	async close(): Promise<void> { }
}

async function flushMicrotasks(): Promise<void> {
	for (let i = 0; i < 5; i++) {
		await Promise.resolve();
	}
}

suite('Storage init', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('retries getItems after rejection and get reads the loaded item', async () => {
		const failure = new Error('getItems failed');
		const database = new ScriptedStorageDatabase([
			'reject',
			new Map([['color', 'blue']])
		], failure);
		const storage = disposables.add(new Storage(database));

		try {
			await storage.init();
			ok(false, 'expected init to reject');
		} catch (error) {
			strictEqual(error, failure);
		}

		strictEqual(database.getItemsCalls, 1);
		strictEqual(storage.get('color', 'missing'), 'missing');

		await storage.init();
		strictEqual(database.getItemsCalls, 2);
		strictEqual(storage.get('color'), 'blue');

		await storage.init();
		strictEqual(database.getItemsCalls, 2);
	});

	test('in-flight init is not treated as already complete', async () => {
		const database = new ScriptedStorageDatabase(['defer'], new Error('unused'));
		const storage = disposables.add(new Storage(database));

		let firstSettled = false;
		let secondSettled = false;
		const first = storage.init().finally(() => { firstSettled = true; });
		const second = storage.init().finally(() => { secondSettled = true; });

		await flushMicrotasks();

		strictEqual(database.getItemsCalls, 1);
		strictEqual(firstSettled, false);
		strictEqual(secondSettled, false);
		strictEqual(storage.get('color', 'missing'), 'missing');

		database.release(new Map([['color', 'blue']]));
		await first;
		await second;

		strictEqual(firstSettled, true);
		strictEqual(secondSettled, true);
		strictEqual(database.getItemsCalls, 1);
		strictEqual(storage.get('color'), 'blue');
	});
});
