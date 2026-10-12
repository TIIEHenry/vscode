/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ok, strictEqual } from 'assert';
import { Emitter, Event } from '../../../../common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../test/common/utils.js';
import { IStorageDatabase, IStorageItemsChangeEvent, IUpdateRequest, Storage } from '../../common/storage.js';

class ScriptedStorageDatabase implements IStorageDatabase {

	private readonly emitter = new Emitter<IStorageItemsChangeEvent>();
	readonly onDidChangeItemsExternal: Event<IStorageItemsChangeEvent> = this.emitter.event;

	getItemsCalls = 0;

	private readonly resolvers: Array<(items: Map<string, string>) => void> = [];
	private readonly rejecters: Array<(error: Error) => void> = [];

	constructor(
		private readonly steps: Array<'reject' | 'defer' | 'defer-reject' | Map<string, string>>,
		private readonly failure: Error
	) { }

	dispose(): void {
		this.emitter.dispose();
	}

	getItems(): Promise<Map<string, string>> {
		const step = this.steps[this.getItemsCalls] ?? this.steps[this.steps.length - 1];
		this.getItemsCalls++;

		if (step === 'reject') {
			return Promise.reject(this.failure);
		}

		if (step === 'defer') {
			return new Promise(resolve => this.resolvers.push(resolve));
		}

		if (step === 'defer-reject') {
			return new Promise((_resolve, reject) => this.rejecters.push(reject));
		}

		return Promise.resolve(new Map(step));
	}

	release(items: Map<string, string>): void {
		const pending = this.resolvers.splice(0, this.resolvers.length);
		for (const resolve of pending) {
			resolve(new Map(items));
		}
	}

	fail(): void {
		const pending = this.rejecters.splice(0, this.rejecters.length);
		for (const reject of pending) {
			reject(this.failure);
		}
	}

	emitExternal(change: IStorageItemsChangeEvent): void {
		this.emitter.fire(change);
	}

	readonly updates: IUpdateRequest[] = [];

	async updateItems(request: IUpdateRequest): Promise<void> {
		this.updates.push({
			insert: new Map(request.insert ?? []),
			delete: new Set(request.delete ?? []),
		});
	}

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
		const database = disposables.add(new ScriptedStorageDatabase([
			'reject',
			new Map([['color', 'blue']])
		], failure));
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
		const database = disposables.add(new ScriptedStorageDatabase(['defer'], new Error('unused')));
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

	test('cache edits override loaded rows after pending maps are flushed', async () => {
		const database = disposables.add(new ScriptedStorageDatabase(['defer'], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		const preWrite = storage.set('pre', 'temp');
		const preDelete = storage.delete('pre');
		const colorWrite = storage.set('color', 'red');
		const goneWrite = storage.set('gone', 'temp');
		await storage.flush(0);

		const first = storage.init();
		const second = storage.init();
		await flushMicrotasks();
		strictEqual(database.getItemsCalls, 1);

		const colorAgain = storage.set('color', 'green');
		const goneDelete = storage.delete('gone');
		const extraWrite = storage.set('extra', 'mem');
		await storage.flush(0);

		database.release(new Map([
			['pre', 'disk'],
			['color', 'blue'],
			['gone', 'disk'],
			['size', 'large'],
		]));
		await first;
		await second;
		await Promise.all([preWrite, preDelete, colorWrite, goneWrite, colorAgain, goneDelete, extraWrite]);

		strictEqual(database.getItemsCalls, 1);
		strictEqual(storage.get('pre', 'missing'), 'missing');
		strictEqual(storage.get('color'), 'green');
		strictEqual(storage.get('gone', 'missing'), 'missing');
		strictEqual(storage.get('extra'), 'mem');
		strictEqual(storage.get('size'), 'large');
	});

	test('external updates during getItems override loaded rows', async () => {
		const database = disposables.add(new ScriptedStorageDatabase(['defer'], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		const writing = storage.set('doomed', 'local');
		const initPromise = storage.init();
		await flushMicrotasks();

		database.emitExternal({ changed: new Map([['color', 'red']]) });
		database.emitExternal({ deleted: new Set(['doomed']) });
		database.release(new Map([
			['color', 'blue'],
			['doomed', 'disk'],
			['size', 'large'],
		]));
		await initPromise;
		await writing;

		strictEqual(database.getItemsCalls, 1);
		strictEqual(storage.get('color'), 'red');
		strictEqual(storage.get('doomed', 'missing'), 'missing');
		strictEqual(storage.get('size'), 'large');
	});

	test('delete during a rejected load is not restored when init retries', async () => {
		const failure = new Error('getItems failed');
		const database = disposables.add(new ScriptedStorageDatabase([
			'defer-reject',
			new Map([['color', 'blue'], ['size', 'large']])
		], failure));
		const storage = disposables.add(new Storage(database));

		const writing = storage.set('color', 'red');
		const first = storage.init();
		await flushMicrotasks();
		strictEqual(database.getItemsCalls, 1);

		const removing = storage.delete('color');
		await storage.flush(0);
		database.fail();

		try {
			await first;
			ok(false, 'expected init to reject');
		} catch (error) {
			strictEqual(error, failure);
		}

		strictEqual(storage.get('color', 'missing'), 'missing');

		await storage.init();
		await Promise.all([writing, removing]);

		strictEqual(database.getItemsCalls, 2);
		strictEqual(storage.get('color', 'missing'), 'missing');
		strictEqual(storage.get('size'), 'large');
	});

	test('delete of a key never stored in memory is omitted from the loaded snapshot', async () => {
		const database = disposables.add(new ScriptedStorageDatabase(['defer'], new Error('unused')));
		const storage = disposables.add(new Storage(database));
		const changes: string[] = [];
		disposables.add(storage.onDidChangeStorage(e => changes.push(e.key)));

		const initPromise = storage.init();
		await flushMicrotasks();
		strictEqual(database.getItemsCalls, 1);

		const removing = storage.delete('color');
		await storage.flush(0);

		strictEqual(database.updates.length, 0);
		strictEqual(changes.length, 0);

		database.release(new Map([
			['color', 'blue'],
			['size', 'large'],
		]));
		await initPromise;
		await removing;

		strictEqual(database.updates.length, 0);
		strictEqual(changes.length, 0);
		strictEqual(storage.get('color', 'missing'), 'missing');
		strictEqual(storage.get('size'), 'large');
	});

	test('set after deleting a key never stored in memory keeps the written value', async () => {
		const database = disposables.add(new ScriptedStorageDatabase(['defer'], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		const initPromise = storage.init();
		await flushMicrotasks();

		const removing = storage.delete('color');
		const writing = storage.set('color', 'red');
		await storage.flush(0);

		strictEqual(database.updates.length, 1);
		strictEqual(database.updates[0].insert?.get('color'), 'red');
		strictEqual(database.updates[0].delete?.has('color'), false);

		database.release(new Map([
			['color', 'blue'],
			['size', 'large'],
		]));
		await initPromise;
		await Promise.all([removing, writing]);

		strictEqual(storage.get('color'), 'red');
		strictEqual(storage.get('size'), 'large');
	});

	test('delete of a missing key after init does not enqueue pending changes', async () => {
		const database = disposables.add(new ScriptedStorageDatabase([
			new Map([['size', 'large']])
		], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		await storage.init();

		const changes: string[] = [];
		disposables.add(storage.onDidChangeStorage(e => changes.push(e.key)));

		const removingMissing = storage.delete('color');
		await storage.flush(0);
		await removingMissing;

		strictEqual(database.updates.length, 0);
		strictEqual(changes.length, 0);
		strictEqual(storage.get('color', 'missing'), 'missing');
		strictEqual(storage.get('size'), 'large');

		const removingCached = storage.delete('size');
		await storage.flush(0);
		await removingCached;

		strictEqual(database.updates.length, 1);
		strictEqual(database.updates[0].delete?.has('size'), true);
		strictEqual(database.updates[0].insert?.has('size'), false);
		strictEqual(database.updates[0].insert?.has('color'), false);
		strictEqual(changes.length, 1);
		strictEqual(storage.get('size', 'missing'), 'missing');
	});

	test('external delete of a key only in the in-flight snapshot is omitted after merge', async () => {
		const database = disposables.add(new ScriptedStorageDatabase(['defer'], new Error('unused')));
		const storage = disposables.add(new Storage(database));
		const changes: string[] = [];
		disposables.add(storage.onDidChangeStorage(e => changes.push(e.key)));

		const initPromise = storage.init();
		await flushMicrotasks();
		strictEqual(database.getItemsCalls, 1);

		database.emitExternal({ deleted: new Set(['color']) });

		const pendingDeletes = (storage as unknown as { pendingDeletes: Set<string> }).pendingDeletes;
		strictEqual(pendingDeletes.has('color'), false);
		strictEqual(changes.length, 0);

		await storage.flush(0);
		strictEqual(database.updates.length, 0);
		strictEqual(pendingDeletes.has('color'), false);

		database.release(new Map([
			['color', 'blue'],
			['size', 'large'],
		]));
		await initPromise;

		strictEqual(storage.get('color'), undefined);
		strictEqual(storage.get('size'), 'large');
		strictEqual(changes.length, 0);
		strictEqual((storage as unknown as { pendingDeletes: Set<string> }).pendingDeletes.has('color'), false);
	});

	test('external write after external delete of an unloaded key keeps the written value', async () => {
		const database = disposables.add(new ScriptedStorageDatabase(['defer'], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		const initPromise = storage.init();
		await flushMicrotasks();

		database.emitExternal({ deleted: new Set(['color']) });
		database.emitExternal({ changed: new Map([['color', 'red']]) });

		database.release(new Map([
			['color', 'blue'],
			['size', 'large'],
		]));
		await initPromise;

		strictEqual(storage.get('color'), 'red');
		strictEqual(storage.get('size'), 'large');
	});

	test('external delete of a missing key after init does not emit', async () => {
		const database = disposables.add(new ScriptedStorageDatabase([
			new Map([['size', 'large']])
		], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		await storage.init();

		const changes: string[] = [];
		disposables.add(storage.onDidChangeStorage(e => changes.push(e.key)));

		database.emitExternal({ deleted: new Set(['color']) });
		await storage.flush(0);

		strictEqual(changes.length, 0);
		strictEqual(database.updates.length, 0);
		strictEqual((storage as unknown as { pendingDeletes: Set<string> }).pendingDeletes.has('color'), false);
		strictEqual(storage.get('color'), undefined);
		strictEqual(storage.get('size'), 'large');
	});

	test('external delete of a cached pending insert does not flush the old string', async () => {
		const database = disposables.add(new ScriptedStorageDatabase([
			new Map([['color', 'blue']])
		], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		await storage.init();
		strictEqual(storage.get('color'), 'blue');

		const writing = storage.set('color', 'red');
		const pendingInserts = (storage as unknown as { pendingInserts: Map<string, string> }).pendingInserts;
		strictEqual(pendingInserts.get('color'), 'red');

		database.emitExternal({ deleted: new Set(['color']) });

		strictEqual(pendingInserts.has('color'), false);
		strictEqual(storage.get('color', 'missing'), 'missing');

		await storage.flush(0);
		await writing;

		strictEqual(database.updates.length, 0);
		strictEqual(pendingInserts.has('color'), false);
		strictEqual(storage.get('color', 'missing'), 'missing');
	});

	test('external update of an unflushed insert flushes the new value', async () => {
		const database = disposables.add(new ScriptedStorageDatabase([
			new Map([['color', 'blue']])
		], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		await storage.init();

		const writing = storage.set('color', 'red');
		const pendingInserts = (storage as unknown as { pendingInserts: Map<string, string> }).pendingInserts;
		strictEqual(pendingInserts.get('color'), 'red');

		database.emitExternal({ changed: new Map([['color', 'green']]) });

		strictEqual(storage.get('color'), 'green');
		strictEqual(pendingInserts.get('color'), 'green');

		await storage.flush(0);
		await writing;

		strictEqual(database.updates.length, 1);
		strictEqual(database.updates[0].insert?.get('color'), 'green');
		strictEqual(database.updates[0].delete?.has('color'), false);
		strictEqual(storage.get('color'), 'green');
	});

	test('external update of a pending delete does not flush that delete', async () => {
		const database = disposables.add(new ScriptedStorageDatabase([
			new Map([['color', 'blue']])
		], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		await storage.init();

		const removing = storage.delete('color');
		const pending = storage as unknown as { pendingInserts: Map<string, string>; pendingDeletes: Set<string> };
		strictEqual(pending.pendingDeletes.has('color'), true);

		database.emitExternal({ changed: new Map([['color', 'green']]) });

		strictEqual(storage.get('color'), 'green');
		strictEqual(pending.pendingDeletes.has('color'), false);
		strictEqual(pending.pendingInserts.has('color'), false);

		await storage.flush(0);
		await removing;

		strictEqual(database.updates.length, 0);
		strictEqual(pending.pendingDeletes.has('color'), false);
		strictEqual(pending.pendingInserts.has('color'), false);
		strictEqual(storage.get('color'), 'green');
	});

	test('external delete of a key missing from cache does not enter pending', async () => {
		const database = disposables.add(new ScriptedStorageDatabase([
			new Map([['size', 'large']])
		], new Error('unused')));
		const storage = disposables.add(new Storage(database));

		await storage.init();

		database.emitExternal({ deleted: new Set(['color']) });

		const pending = storage as unknown as { pendingInserts: Map<string, string>; pendingDeletes: Set<string> };
		strictEqual(pending.pendingInserts.has('color'), false);
		strictEqual(pending.pendingDeletes.has('color'), false);

		await storage.flush(0);

		strictEqual(database.updates.length, 0);
		strictEqual(pending.pendingInserts.has('color'), false);
		strictEqual(pending.pendingDeletes.has('color'), false);
		strictEqual(storage.get('color'), undefined);
		strictEqual(storage.get('size'), 'large');
	});
});
