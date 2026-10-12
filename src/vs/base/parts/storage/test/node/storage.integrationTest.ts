/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { deepStrictEqual, ok, rejects, strictEqual } from 'assert';
import { tmpdir } from 'os';
import { timeout } from '../../../../common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../common/errors.js';
import { Emitter, Event } from '../../../../common/event.js';
import { join } from '../../../../common/path.js';
import { isWindows } from '../../../../common/platform.js';
import { URI } from '../../../../common/uri.js';
import { generateUuid } from '../../../../common/uuid.js';
import { Promises } from '../../../../node/pfs.js';
import { AbstractStorageService, StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { isStorageItemsChangeEvent, IStorage, IStorageDatabase, IStorageItemsChangeEvent, IUpdateRequest, Storage } from '../../common/storage.js';
import { ISQLiteStorageDatabaseOptions, SQLiteStorageDatabase } from '../../node/storage.js';
import { runWithFakedTimers } from '../../../../test/common/timeTravelScheduler.js';
import { flakySuite, getRandomTestPath } from '../../../../test/node/testUtils.js';

flakySuite('Storage Library', function () {

	let testDir: string;

	setup(function () {
		testDir = getRandomTestPath(tmpdir(), 'vsctests', 'storagelibrary');

		return fs.promises.mkdir(testDir, { recursive: true });
	});

	teardown(function () {
		return Promises.rm(testDir);
	});

	test('objects', () => {
		return runWithFakedTimers({}, async function () {
			const storage = new Storage(new SQLiteStorageDatabase(join(testDir, 'storage.db')));

			await storage.init();

			ok(!storage.getObject('foo'));
			const uri = URI.file('path/to/folder');
			storage.set('foo', { 'bar': uri });
			deepStrictEqual(storage.getObject('foo'), { 'bar': uri });

			await storage.close();
		});
	});

	test('basics', () => {
		return runWithFakedTimers({}, async function () {
			const storage = new Storage(new SQLiteStorageDatabase(join(testDir, 'storage.db')));

			await storage.init();

			// Empty fallbacks
			strictEqual(storage.get('foo', 'bar'), 'bar');
			strictEqual(storage.getNumber('foo', 55), 55);
			strictEqual(storage.getBoolean('foo', true), true);
			deepStrictEqual(storage.getObject('foo', { 'bar': 'baz' }), { 'bar': 'baz' });

			let changes = new Set<string>();
			storage.onDidChangeStorage(e => {
				changes.add(e.key);
			});

			await storage.whenFlushed(); // returns immediately when no pending updates

			// Simple updates
			const set1Promise = storage.set('bar', 'foo');
			const set2Promise = storage.set('barNumber', 55);
			const set3Promise = storage.set('barBoolean', true);
			const set4Promise = storage.set('barObject', { 'bar': 'baz' });

			let flushPromiseResolved = false;
			storage.whenFlushed().then(() => flushPromiseResolved = true);

			strictEqual(storage.get('bar'), 'foo');
			strictEqual(storage.getNumber('barNumber'), 55);
			strictEqual(storage.getBoolean('barBoolean'), true);
			deepStrictEqual(storage.getObject('barObject'), { 'bar': 'baz' });

			strictEqual(changes.size, 4);
			ok(changes.has('bar'));
			ok(changes.has('barNumber'));
			ok(changes.has('barBoolean'));
			ok(changes.has('barObject'));

			let setPromiseResolved = false;
			await Promise.all([set1Promise, set2Promise, set3Promise, set4Promise]).then(() => setPromiseResolved = true);
			strictEqual(setPromiseResolved, true);
			strictEqual(flushPromiseResolved, true);

			changes = new Set<string>();

			// Does not trigger events for same update values
			storage.set('bar', 'foo');
			storage.set('barNumber', 55);
			storage.set('barBoolean', true);
			storage.set('barObject', { 'bar': 'baz' });
			strictEqual(changes.size, 0);

			// Simple deletes
			const delete1Promise = storage.delete('bar');
			const delete2Promise = storage.delete('barNumber');
			const delete3Promise = storage.delete('barBoolean');
			const delete4Promise = storage.delete('barObject');

			ok(!storage.get('bar'));
			ok(!storage.getNumber('barNumber'));
			ok(!storage.getBoolean('barBoolean'));
			ok(!storage.getObject('barObject'));

			strictEqual(changes.size, 4);
			ok(changes.has('bar'));
			ok(changes.has('barNumber'));
			ok(changes.has('barBoolean'));
			ok(changes.has('barObject'));

			changes = new Set<string>();

			// Does not trigger events for same delete values
			storage.delete('bar');
			storage.delete('barNumber');
			storage.delete('barBoolean');
			storage.delete('barObject');
			strictEqual(changes.size, 0);

			let deletePromiseResolved = false;
			await Promise.all([delete1Promise, delete2Promise, delete3Promise, delete4Promise]).then(() => deletePromiseResolved = true);
			strictEqual(deletePromiseResolved, true);

			await storage.close();
			await storage.close(); // it is ok to call this multiple times
		});
	});

	test('external changes', () => {
		return runWithFakedTimers({}, async function () {
			class TestSQLiteStorageDatabase extends SQLiteStorageDatabase {
				private readonly _onDidChangeItemsExternal = new Emitter<IStorageItemsChangeEvent>();
				override get onDidChangeItemsExternal(): Event<IStorageItemsChangeEvent> { return this._onDidChangeItemsExternal.event; }

				fireDidChangeItemsExternal(event: IStorageItemsChangeEvent): void {
					this._onDidChangeItemsExternal.fire(event);
				}
			}

			const database = new TestSQLiteStorageDatabase(join(testDir, 'storage.db'));
			const storage = new Storage(database);

			const changes = new Set<string>();
			storage.onDidChangeStorage(e => {
				changes.add(e.key);
			});

			await storage.init();

			await storage.set('foo', 'bar');
			ok(changes.has('foo'));
			changes.clear();

			// Nothing happens if changing to same value
			const changed = new Map<string, string>();
			changed.set('foo', 'bar');
			database.fireDidChangeItemsExternal({ changed });
			strictEqual(changes.size, 0);

			// Change is accepted if valid
			changed.set('foo', 'bar1');
			database.fireDidChangeItemsExternal({ changed });
			ok(changes.has('foo'));
			strictEqual(storage.get('foo'), 'bar1');
			changes.clear();

			// Delete is accepted
			const deleted = new Set<string>(['foo']);
			database.fireDidChangeItemsExternal({ deleted });
			ok(changes.has('foo'));
			strictEqual(storage.get('foo', undefined), undefined);
			changes.clear();

			// Nothing happens if changing to same value
			database.fireDidChangeItemsExternal({ deleted });
			strictEqual(changes.size, 0);

			strictEqual(isStorageItemsChangeEvent({ changed }), true);
			strictEqual(isStorageItemsChangeEvent({ deleted }), true);
			strictEqual(isStorageItemsChangeEvent({ changed, deleted }), true);
			strictEqual(isStorageItemsChangeEvent(undefined), false);
			strictEqual(isStorageItemsChangeEvent({ changed: 'yes', deleted: false }), false);

			await storage.close();
		});
	});

	test('close flushes data', async () => {
		let storage = new Storage(new SQLiteStorageDatabase(join(testDir, 'storage.db')));
		await storage.init();

		const set1Promise = storage.set('foo', 'bar');
		const set2Promise = storage.set('bar', 'foo');

		let flushPromiseResolved = false;
		storage.whenFlushed().then(() => flushPromiseResolved = true);

		strictEqual(storage.get('foo'), 'bar');
		strictEqual(storage.get('bar'), 'foo');

		let setPromiseResolved = false;
		Promise.all([set1Promise, set2Promise]).then(() => setPromiseResolved = true);

		await storage.close();

		strictEqual(setPromiseResolved, true);
		strictEqual(flushPromiseResolved, true);

		storage = new Storage(new SQLiteStorageDatabase(join(testDir, 'storage.db')));
		await storage.init();

		strictEqual(storage.get('foo'), 'bar');
		strictEqual(storage.get('bar'), 'foo');

		await storage.close();

		storage = new Storage(new SQLiteStorageDatabase(join(testDir, 'storage.db')));
		await storage.init();

		const delete1Promise = storage.delete('foo');
		const delete2Promise = storage.delete('bar');

		ok(!storage.get('foo'));
		ok(!storage.get('bar'));

		let deletePromiseResolved = false;
		Promise.all([delete1Promise, delete2Promise]).then(() => deletePromiseResolved = true);

		await storage.close();

		strictEqual(deletePromiseResolved, true);

		storage = new Storage(new SQLiteStorageDatabase(join(testDir, 'storage.db')));
		await storage.init();

		ok(!storage.get('foo'));
		ok(!storage.get('bar'));

		await storage.close();
	});

	test('explicit flush', async () => {
		const storage = new Storage(new SQLiteStorageDatabase(join(testDir, 'storage.db')));
		await storage.init();

		storage.set('foo', 'bar');
		storage.set('bar', 'foo');

		let flushPromiseResolved = false;
		storage.whenFlushed().then(() => flushPromiseResolved = true);

		strictEqual(flushPromiseResolved, false);

		await storage.flush(0);

		strictEqual(flushPromiseResolved, true);

		await storage.close();
	});

	test('flush failure rejects whenFlushed and retries pending', () => {
		return runWithFakedTimers({}, async function () {
			let updateCalls = 0;

			class FlakyStorageDatabase implements IStorageDatabase {
				readonly onDidChangeItemsExternal = Event.None;

				async getItems(): Promise<Map<string, string>> {
					return new Map();
				}

				async updateItems(request: IUpdateRequest): Promise<void> {
					updateCalls++;
					if (updateCalls === 1) {
						strictEqual(request.insert?.get('retry-key'), 'value');
						throw new Error('flush failed once');
					}
					strictEqual(request.insert?.get('retry-key'), 'value');
				}

				async optimize(): Promise<void> { }

				async close(): Promise<void> { }
			}

			const storage = new Storage(new FlakyStorageDatabase());
			await storage.init();

			const setPromise = storage.set('retry-key', 'value');
			const whenFlushedPromise = storage.whenFlushed();
			await Promise.all([rejects(whenFlushedPromise), rejects(setPromise)]);
			strictEqual(storage.get('retry-key'), 'value');
			strictEqual(updateCalls, 1);

			const retriedWhenFlushed = storage.whenFlushed();
			await storage.flush(0);
			strictEqual(updateCalls, 2);
			strictEqual(storage.get('retry-key'), 'value');
			await retriedWhenFlushed;
			await storage.close();
		});
	});

	test('concurrent flush pending callbacks are settled per batch', () => {
		return runWithFakedTimers({}, async function () {
			let updateCalls = 0;
			const deferredUpdates: (() => void)[] = [];

			class ControlledStorageDatabase implements IStorageDatabase {
				readonly onDidChangeItemsExternal = Event.None;

				async getItems(): Promise<Map<string, string>> {
					return new Map();
				}

				updateItems(request: IUpdateRequest): Promise<void> {
					updateCalls++;
					return new Promise((resolve) => {
						deferredUpdates.push(resolve);
					});
				}

				async optimize(): Promise<void> { }
				async close(): Promise<void> { }
			}

			const storage = new Storage(new ControlledStorageDatabase());
			await storage.init();

			storage.set('key1', 'value1');
			let flushed1 = false;
			storage.whenFlushed().then(() => { flushed1 = true; });

			const flush1 = storage.flush(0);
			await timeout(1);
			strictEqual(updateCalls, 1);
			strictEqual(flushed1, false);

			storage.set('key2', 'value2');
			let flushed2 = false;
			storage.whenFlushed().then(() => { flushed2 = true; });

			deferredUpdates.shift()!();
			await flush1;

			strictEqual(flushed1, true);
			strictEqual(flushed2, false);

			const flush2 = storage.flush(0);
			await timeout(1);
			strictEqual(updateCalls, 2);
			deferredUpdates.shift()!();
			await flush2;

			strictEqual(flushed2, true);
			await storage.close();
		});
	});

	test('flush failure rejects only current batch callbacks and leaves pending for next batch', () => {
		return runWithFakedTimers({}, async function () {
			let updateCalls = 0;
			const deferredUpdates: { resolve?: () => void; reject?: (err: Error) => void }[] = [];

			class ControlledStorageDatabase implements IStorageDatabase {
				readonly onDidChangeItemsExternal = Event.None;

				async getItems(): Promise<Map<string, string>> {
					return new Map();
				}

				updateItems(request: IUpdateRequest): Promise<void> {
					updateCalls++;
					return new Promise((resolve, reject) => {
						deferredUpdates.push({ resolve, reject });
					});
				}

				async optimize(): Promise<void> { }
				async close(): Promise<void> { }
			}

			const storage = new Storage(new ControlledStorageDatabase());
			await storage.init();

			const set1 = storage.set('key1', 'value1');
			let error1: Error | undefined;
			storage.whenFlushed().catch(err => { error1 = err; });

			const flush1 = storage.flush(0);
			await timeout(1);
			strictEqual(updateCalls, 1);

			const set2 = storage.set('key2', 'value2');
			let flushed2 = false;
			let error2: Error | undefined;
			storage.whenFlushed().then(() => { flushed2 = true; }, err => { error2 = err; });

			deferredUpdates.shift()!.reject!(new Error('flush 1 failed'));
			await flush1.catch(() => { });
			await set1.catch(() => { });

			ok(error1);
			strictEqual(error2, undefined);
			strictEqual(flushed2, false);

			const flush2 = storage.flush(0);
			await timeout(1);
			strictEqual(updateCalls, 2);
			deferredUpdates.shift()!.resolve!();
			await flush2;
			await set2;

			strictEqual(flushed2, true);
			strictEqual(error2, undefined);
			await storage.close();
		});
	});

	test('AbstractStorageService.flush resolves when updateItems rejects once', () => {
		return runWithFakedTimers({}, async function () {
			let updateCalls = 0;

			class FlakyStorageDatabase implements IStorageDatabase {
				readonly onDidChangeItemsExternal = Event.None;

				async getItems(): Promise<Map<string, string>> {
					return new Map();
				}

				async updateItems(request: IUpdateRequest): Promise<void> {
					updateCalls++;
					if (updateCalls === 1) {
						strictEqual(request.insert?.get('retry-key'), 'value');
						throw new Error('flush failed once');
					}
					strictEqual(request.insert?.get('retry-key'), 'value');
				}

				async optimize(): Promise<void> { }

				async close(): Promise<void> { }
			}

			const storage = new Storage(new FlakyStorageDatabase());
			await storage.init();

			class FlakyFlushStorageService extends AbstractStorageService {
				protected override shouldFlushWhenIdle(): boolean {
					return false;
				}

				protected override getStorage(scope: StorageScope): IStorage | undefined {
					return scope === StorageScope.APPLICATION ? storage : undefined;
				}

				protected override getLogDetails(): string | undefined {
					return undefined;
				}

				protected override async doInitialize(): Promise<void> { }

				protected override async switchToProfile(): Promise<void> { }

				protected override async switchToWorkspace(): Promise<void> { }

				override hasScope(): boolean {
					return false;
				}
			}

			const service = new FlakyFlushStorageService();
			const logged: unknown[] = [];
			const originalHandler = errorHandler.getUnexpectedErrorHandler();
			setUnexpectedErrorHandler(error => { logged.push(error); });

			try {
				const setPromise = storage.set('retry-key', 'value');
				const setRejected = setPromise.then(() => false, () => true);
				await service.flush();
				strictEqual(await setRejected, true);
				strictEqual(storage.get('retry-key'), 'value');
				strictEqual(updateCalls, 1);
				strictEqual(logged.length, 1);

				await storage.flush(0);
				strictEqual(updateCalls, 2);
				await storage.whenFlushed();
			} finally {
				setUnexpectedErrorHandler(originalHandler);
				service.dispose();
				await storage.close();
			}
		});
	});

	test('AbstractStorageService.store and remove handle a rejected flush', () => {
		return runWithFakedTimers({}, async function () {
			let updateCalls = 0;

			class FlakyStorageDatabase implements IStorageDatabase {
				readonly onDidChangeItemsExternal = Event.None;

				async getItems(): Promise<Map<string, string>> {
					return new Map();
				}

				async updateItems(request: IUpdateRequest): Promise<void> {
					updateCalls++;
					if (updateCalls === 1) {
						strictEqual(request.insert?.get('direct-key'), 'direct-value');
						strictEqual(request.delete?.has('kept-key'), true);
						throw new Error('flush failed once');
					}
				}

				async optimize(): Promise<void> { }

				async close(): Promise<void> { }
			}

			const storage = new Storage(new FlakyStorageDatabase());
			await storage.init();

			class FlakyFlushStorageService extends AbstractStorageService {
				protected override shouldFlushWhenIdle(): boolean {
					return false;
				}

				protected override getStorage(scope: StorageScope): IStorage | undefined {
					return scope === StorageScope.APPLICATION ? storage : undefined;
				}

				protected override getLogDetails(): string | undefined {
					return undefined;
				}

				protected override async doInitialize(): Promise<void> { }

				protected override async switchToProfile(): Promise<void> { }

				protected override async switchToWorkspace(): Promise<void> { }

				override hasScope(): boolean {
					return false;
				}
			}

			const service = new FlakyFlushStorageService();
			const logged: unknown[] = [];
			const unhandled: unknown[] = [];
			const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
			process.on('unhandledRejection', onUnhandled);
			const originalHandler = errorHandler.getUnexpectedErrorHandler();
			setUnexpectedErrorHandler(error => { logged.push(error); });

			try {
				const directSet = storage.set('direct-key', 'direct-value');
				service.store('kept-key', 'kept-value', StorageScope.APPLICATION, StorageTarget.MACHINE);
				service.remove('kept-key', StorageScope.APPLICATION);

				await rejects(directSet, /flush failed once/);
				await new Promise<void>(resolve => process.nextTick(resolve));

				strictEqual(unhandled.length, 0);
				strictEqual(logged.length, 4);
				ok(logged.every(error => error instanceof Error && (error as Error).message === 'flush failed once'));
				strictEqual(updateCalls, 1);
				strictEqual(storage.get('direct-key'), 'direct-value');
				ok(!storage.get('kept-key'));
			} finally {
				process.off('unhandledRejection', onUnhandled);
				setUnexpectedErrorHandler(originalHandler);
				service.dispose();
				await storage.close();
			}
		});
	});

	test('conflicting updates', () => {
		return runWithFakedTimers({}, async function () {
			const storage = new Storage(new SQLiteStorageDatabase(join(testDir, 'storage.db')));
			await storage.init();

			let changes = new Set<string>();
			storage.onDidChangeStorage(e => {
				changes.add(e.key);
			});

			const set1Promise = storage.set('foo', 'bar1');
			const set2Promise = storage.set('foo', 'bar2');
			const set3Promise = storage.set('foo', 'bar3');

			let flushPromiseResolved = false;
			storage.whenFlushed().then(() => flushPromiseResolved = true);

			strictEqual(storage.get('foo'), 'bar3');
			strictEqual(changes.size, 1);
			ok(changes.has('foo'));

			let setPromiseResolved = false;
			await Promise.all([set1Promise, set2Promise, set3Promise]).then(() => setPromiseResolved = true);
			ok(setPromiseResolved);
			ok(flushPromiseResolved);

			changes = new Set<string>();

			const set4Promise = storage.set('bar', 'foo');
			const delete1Promise = storage.delete('bar');

			ok(!storage.get('bar'));

			strictEqual(changes.size, 1);
			ok(changes.has('bar'));

			let setAndDeletePromiseResolved = false;
			await Promise.all([set4Promise, delete1Promise]).then(() => setAndDeletePromiseResolved = true);
			ok(setAndDeletePromiseResolved);

			await storage.close();
		});
	});

	test('corrupt DB recovers', async () => {
		return runWithFakedTimers({}, async function () {
			const storageFile = join(testDir, 'storage.db');

			let storage = new Storage(new SQLiteStorageDatabase(storageFile));
			await storage.init();

			await storage.set('bar', 'foo');

			await Promises.writeFile(storageFile, 'This is a broken DB');

			// The insert hits the overwritten file and the statement errors.
			// updateItems rejects; close still rebuilds from the cache.
			await rejects(storage.set('foo', 'bar'));

			strictEqual(storage.get('bar'), 'foo');
			strictEqual(storage.get('foo'), 'bar');

			await storage.close();

			storage = new Storage(new SQLiteStorageDatabase(storageFile));
			await storage.init();

			strictEqual(storage.get('bar'), 'foo');
			strictEqual(storage.get('foo'), 'bar');

			await storage.close();
		});
	});
});

flakySuite('SQLite Storage Library', function () {

	function toSet(elements: string[]): Set<string> {
		const set = new Set<string>();
		elements.forEach(element => set.add(element));

		return set;
	}

	function execSqlite(dbPath: string, sql: string): Promise<void> {
		return import('@vscode/sqlite3').then(sqlite3 => new Promise((resolve, reject) => {
			const db = new sqlite3.default.Database(dbPath, (err: Error | null) => {
				if (err) {
					reject(err);
					return;
				}

				db.exec(sql, (execErr: Error | null) => {
					db.close(() => execErr ? reject(execErr) : resolve());
				});
			});
		}));
	}

	let testdir: string;

	setup(function () {
		testdir = getRandomTestPath(tmpdir(), 'vsctests', 'storagelibrary');

		return fs.promises.mkdir(testdir, { recursive: true });
	});

	teardown(function () {
		return Promises.rm(testdir);
	});

	async function testDBBasics(path: string, logError?: (error: Error | string) => void) {
		let options!: ISQLiteStorageDatabaseOptions;
		if (logError) {
			options = {
				logging: {
					logError
				}
			};
		}

		const storage = new SQLiteStorageDatabase(path, options);

		const items = new Map<string, string>();
		items.set('foo', 'bar');
		items.set('some/foo/path', 'some/bar/path');
		items.set(JSON.stringify({ foo: 'bar' }), JSON.stringify({ bar: 'foo' }));

		let storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		await storage.updateItems({ insert: items });

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);
		strictEqual(storedItems.get('foo'), 'bar');
		strictEqual(storedItems.get('some/foo/path'), 'some/bar/path');
		strictEqual(storedItems.get(JSON.stringify({ foo: 'bar' })), JSON.stringify({ bar: 'foo' }));

		await storage.updateItems({ delete: toSet(['foo']) });
		storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size - 1);
		ok(!storedItems.has('foo'));
		strictEqual(storedItems.get('some/foo/path'), 'some/bar/path');
		strictEqual(storedItems.get(JSON.stringify({ foo: 'bar' })), JSON.stringify({ bar: 'foo' }));

		await storage.updateItems({ insert: items });
		storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);
		strictEqual(storedItems.get('foo'), 'bar');
		strictEqual(storedItems.get('some/foo/path'), 'some/bar/path');
		strictEqual(storedItems.get(JSON.stringify({ foo: 'bar' })), JSON.stringify({ bar: 'foo' }));

		const itemsChange = new Map<string, string>();
		itemsChange.set('foo', 'otherbar');
		await storage.updateItems({ insert: itemsChange });

		storedItems = await storage.getItems();
		strictEqual(storedItems.get('foo'), 'otherbar');

		await storage.updateItems({ delete: toSet(['foo', 'bar', 'some/foo/path', JSON.stringify({ foo: 'bar' })]) });
		storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		await storage.updateItems({ insert: items, delete: toSet(['foo', 'some/foo/path', 'other']) });
		storedItems = await storage.getItems();
		strictEqual(storedItems.size, 1);
		strictEqual(storedItems.get(JSON.stringify({ foo: 'bar' })), JSON.stringify({ bar: 'foo' }));

		await storage.updateItems({ delete: toSet([JSON.stringify({ foo: 'bar' })]) });
		storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		let recoveryCalled = false;
		await storage.close(() => {
			recoveryCalled = true;

			return new Map();
		});

		strictEqual(recoveryCalled, false);
	}

	test('basics', async () => {
		await testDBBasics(join(testdir, 'storage.db'));
	});

	test('basics (open multiple times)', async () => {
		await testDBBasics(join(testdir, 'storage.db'));
		await testDBBasics(join(testdir, 'storage.db'));
	});

	test('basics (corrupt DB falls back to empty DB)', async () => {
		const corruptDBPath = join(testdir, 'broken.db');
		const corruptBytes = 'This is a broken DB';
		await Promises.writeFile(corruptDBPath, corruptBytes);

		let expectedError: Error | string | undefined = undefined;
		const storage = new SQLiteStorageDatabase(corruptDBPath, {
			logging: {
				logError: error => { expectedError = error; }
			}
		});

		const storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);
		ok((await storage.checkIntegrity(false)).includes('in-memory'));

		let closeError: unknown;
		try {
			await storage.close();
		} catch (error) {
			closeError = error;
		}
		ok(closeError);

		ok(expectedError);
		strictEqual(await fs.promises.readFile(`${corruptDBPath}.corrupt`, 'utf8'), corruptBytes);
		strictEqual(await Promises.exists(corruptDBPath), false);
	});

	test('basics (corrupt DB restores from previous backup)', async () => {
		const storagePath = join(testdir, 'storage.db');
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');
		items.set('some/foo/path', 'some/bar/path');
		items.set(JSON.stringify({ foo: 'bar' }), JSON.stringify({ bar: 'foo' }));

		await storage.updateItems({ insert: items });
		await storage.close();

		await Promises.writeFile(storagePath, 'This is now a broken DB');

		storage = new SQLiteStorageDatabase(storagePath);

		const storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);
		strictEqual(storedItems.get('foo'), 'bar');
		strictEqual(storedItems.get('some/foo/path'), 'some/bar/path');
		strictEqual(storedItems.get(JSON.stringify({ foo: 'bar' })), JSON.stringify({ bar: 'foo' }));

		let recoveryCalled = false;
		await storage.close(() => {
			recoveryCalled = true;

			return new Map();
		});

		strictEqual(recoveryCalled, false);
	});

	test('basics (corrupt DB falls back to empty DB if backup is corrupt)', async () => {
		const storagePath = join(testdir, 'storage.db');
		const backupPath = `${storagePath}.backup`;
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');
		items.set('some/foo/path', 'some/bar/path');
		items.set(JSON.stringify({ foo: 'bar' }), JSON.stringify({ bar: 'foo' }));

		await storage.updateItems({ insert: items });
		await storage.close();

		const mainCorruptBytes = 'This is now a broken DB';
		const backupCorruptBytes = 'This is now also a broken DB';
		await Promises.writeFile(storagePath, mainCorruptBytes);
		await Promises.writeFile(backupPath, backupCorruptBytes);

		storage = new SQLiteStorageDatabase(storagePath);

		const storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);
		ok((await storage.checkIntegrity(false)).includes('in-memory'));

		let closeError: unknown;
		try {
			await storage.close();
		} catch (error) {
			closeError = error;
		}
		ok(closeError);

		strictEqual(await fs.promises.readFile(`${storagePath}.corrupt`, 'utf8'), mainCorruptBytes);
		strictEqual(await fs.promises.readFile(backupPath, 'utf8'), backupCorruptBytes);
		strictEqual(await Promises.exists(storagePath), false);
	});

	test('basics (empty recovery does not overwrite existing backup)', async () => {
		const storagePath = join(testdir, 'storage.db');
		const backupPath = `${storagePath}.backup`;
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');

		await storage.updateItems({ insert: items });
		await storage.close();

		const mainCorruptBytes = 'This is now a broken DB';
		const backupCorruptBytes = 'This is now also a broken DB';
		await fs.promises.writeFile(storagePath, mainCorruptBytes);
		await fs.promises.writeFile(backupPath, backupCorruptBytes);

		const backupBytesBeforeOpen = await fs.promises.readFile(backupPath);

		storage = new SQLiteStorageDatabase(storagePath);

		const storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);
		ok((await storage.checkIntegrity(false)).includes('in-memory'));

		try {
			await storage.close(() => new Map());
		} catch {
			/* close may reject when recovery returns an empty map */
		}

		deepStrictEqual(await fs.promises.readFile(backupPath), backupBytesBeforeOpen);
	});

	(isWindows ? test.skip /* Windows will fail to write to open DB due to locking */ : test)('basics (DB that becomes corrupt during runtime stores all state from cache on close)', async () => {
		const storagePath = join(testdir, 'storage.db');
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');
		items.set('some/foo/path', 'some/bar/path');
		items.set(JSON.stringify({ foo: 'bar' }), JSON.stringify({ bar: 'foo' }));

		await storage.updateItems({ insert: items });
		await storage.close();

		const backupPath = `${storagePath}.backup`;
		strictEqual(await Promises.exists(backupPath), true);

		storage = new SQLiteStorageDatabase(storagePath);
		await storage.getItems();

		await Promises.writeFile(storagePath, 'This is now a broken DB');

		// we still need to trigger a check to the DB so that we get to know that
		// the DB is corrupt. We have no extra code on shutdown that checks for the
		// health of the DB. This is an optimization to not perform too many tasks
		// on shutdown.
		await storage.checkIntegrity(true).then(null, error => { } /* error is expected here but we do not want to fail */);

		await fs.promises.unlink(backupPath); // also test that the recovery DB is backed up properly

		let recoveryCalled = false;
		await storage.close(() => {
			recoveryCalled = true;

			return items;
		});

		strictEqual(recoveryCalled, true);
		strictEqual(await Promises.exists(backupPath), true);

		storage = new SQLiteStorageDatabase(storagePath);

		const storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);
		strictEqual(storedItems.get('foo'), 'bar');
		strictEqual(storedItems.get('some/foo/path'), 'some/bar/path');
		strictEqual(storedItems.get(JSON.stringify({ foo: 'bar' })), JSON.stringify({ bar: 'foo' }));

		recoveryCalled = false;
		await storage.close(() => {
			recoveryCalled = true;

			return new Map();
		});

		strictEqual(recoveryCalled, false);
	});

	(isWindows ? test.skip /* Windows will fail to write to open DB due to locking */ : test)('basics (close recovery rejects when recovery throws before replace)', async () => {
		const storagePath = join(testdir, 'storage.db');
		const backupPath = `${storagePath}.backup`;
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');

		await storage.updateItems({ insert: items });
		await storage.close();

		storage = new SQLiteStorageDatabase(storagePath);
		await storage.getItems();

		const corruptBytes = 'This is now a broken DB';
		await fs.promises.writeFile(storagePath, corruptBytes);
		await storage.checkIntegrity(true).then(null, () => { /* expected */ });

		const mainBytesBeforeClose = await fs.promises.readFile(storagePath);
		const backupBytesBeforeClose = await fs.promises.readFile(backupPath);

		await rejects(storage.close(() => {
			throw new Error('recovery failed before replace');
		}));

		deepStrictEqual(await fs.promises.readFile(storagePath), mainBytesBeforeClose);
		deepStrictEqual(await fs.promises.readFile(backupPath), backupBytesBeforeClose);
		deepStrictEqual(mainBytesBeforeClose.toString(), corruptBytes);
	});

	(isWindows ? test.skip /* Windows rename does not replace an existing file */ : test)('basics (close recovery keeps original bytes when replace rename fails)', async () => {
		const storagePath = join(testdir, 'storage.db');
		const backupPath = `${storagePath}.backup`;
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');

		await storage.updateItems({ insert: items });
		await storage.close();

		storage = new SQLiteStorageDatabase(storagePath);
		await storage.getItems();

		const corruptBytes = 'This is now a broken DB';
		await fs.promises.writeFile(storagePath, corruptBytes);
		await storage.checkIntegrity(true).then(null, () => { /* expected */ });

		const mainBytesBeforeClose = await fs.promises.readFile(storagePath);
		const backupBytesBeforeClose = await fs.promises.readFile(backupPath);

		const originalRename = fs.promises.rename.bind(fs.promises);
		fs.promises.rename = (async (source: fs.PathLike, target: fs.PathLike) => {
			if (String(source).endsWith('.recovery-temp') && String(target) === storagePath) {
				const error = new Error('replace rename failed') as NodeJS.ErrnoException;
				error.code = 'EIO';
				throw error;
			}
			return originalRename(source, target);
		}) as typeof fs.promises.rename;

		try {
			await rejects(storage.close(() => items));
		} finally {
			fs.promises.rename = originalRename;
		}

		deepStrictEqual(await fs.promises.readFile(storagePath), mainBytesBeforeClose);
		deepStrictEqual(await fs.promises.readFile(backupPath), backupBytesBeforeClose);
		strictEqual(await Promises.exists(`${storagePath}.recovery-replace`), false);
		const recoveryTempPath = `${storagePath}.recovery-temp`;
		ok(await Promises.exists(recoveryTempPath));
		const tempStorage = new SQLiteStorageDatabase(recoveryTempPath);
		const tempItems = await tempStorage.getItems();
		strictEqual(tempItems.get('foo'), 'bar');
		await tempStorage.close();
		deepStrictEqual(mainBytesBeforeClose.toString(), corruptBytes);
	});

	(isWindows ? test.skip /* Windows will fail to write to open DB due to locking */ : test)('basics (close recovery replaces a missing main path without deleting the temp db)', async () => {
		const storagePath = join(testdir, 'storage.db');
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');

		await storage.updateItems({ insert: items });
		await storage.close();

		storage = new SQLiteStorageDatabase(storagePath);
		await storage.getItems();

		await fs.promises.writeFile(storagePath, 'This is now a broken DB');
		await storage.checkIntegrity(true).then(null, () => { /* expected */ });
		await fs.promises.unlink(storagePath);
		strictEqual(await Promises.exists(storagePath), false);

		await storage.close(() => items);

		strictEqual(await Promises.exists(`${storagePath}.recovery-temp`), false);
		strictEqual(await Promises.exists(`${storagePath}.recovery-replace`), false);
		storage = new SQLiteStorageDatabase(storagePath);
		const storedItems = await storage.getItems();
		strictEqual(storedItems.get('foo'), 'bar');
		await storage.close();
	});

	(isWindows ? test.skip /* Windows will fail to write to open DB due to locking */ : test)('basics (close recovery keeps temp when main path is missing and replace throws ENOENT)', async () => {
		const storagePath = join(testdir, 'storage.db');
		const backupPath = `${storagePath}.backup`;
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');

		await storage.updateItems({ insert: items });
		await storage.close();

		storage = new SQLiteStorageDatabase(storagePath);
		await storage.getItems();

		await fs.promises.writeFile(storagePath, 'This is now a broken DB');
		await storage.checkIntegrity(true).then(null, () => { /* expected */ });
		await fs.promises.unlink(storagePath);

		const backupBytesBeforeClose = await fs.promises.readFile(backupPath);
		const originalRename = fs.promises.rename.bind(fs.promises);
		fs.promises.rename = (async (source: fs.PathLike, target: fs.PathLike) => {
			if (String(source).endsWith('.recovery-temp') && String(target) === storagePath) {
				const error = new Error('replace rename failed') as NodeJS.ErrnoException;
				error.code = 'ENOENT';
				throw error;
			}
			return originalRename(source, target);
		}) as typeof fs.promises.rename;

		try {
			await rejects(storage.close(() => items));
		} finally {
			fs.promises.rename = originalRename;
		}

		strictEqual(await Promises.exists(storagePath), false);
		strictEqual(await Promises.exists(`${storagePath}.recovery-replace`), false);
		deepStrictEqual(await fs.promises.readFile(backupPath), backupBytesBeforeClose);
		const recoveryTempPath = `${storagePath}.recovery-temp`;
		ok(await Promises.exists(recoveryTempPath));
		const tempStorage = new SQLiteStorageDatabase(recoveryTempPath);
		const tempItems = await tempStorage.getItems();
		strictEqual(tempItems.get('foo'), 'bar');
		await tempStorage.close();
	});

	(isWindows ? test.skip /* Windows will fail to write to open DB due to locking */ : test)('basics (close recovery with data updates backup to match recovered DB)', async () => {
		const storagePath = join(testdir, 'storage.db');
		const backupPath = `${storagePath}.backup`;
		let storage = new SQLiteStorageDatabase(storagePath);

		const items = new Map<string, string>();
		items.set('foo', 'bar');
		items.set('some/foo/path', 'some/bar/path');

		await storage.updateItems({ insert: items });
		await storage.close();

		strictEqual(await Promises.exists(backupPath), true);

		storage = new SQLiteStorageDatabase(storagePath);
		await storage.getItems();

		await fs.promises.writeFile(storagePath, 'This is now a broken DB');
		await storage.checkIntegrity(true).then(null, () => { /* expected */ });

		await storage.close(() => items);

		const mainBytesAfterClose = await fs.promises.readFile(storagePath);
		const backupBytesAfterClose = await fs.promises.readFile(backupPath);
		deepStrictEqual(mainBytesAfterClose, backupBytesAfterClose);

		storage = new SQLiteStorageDatabase(storagePath);
		const storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);
		strictEqual(storedItems.get('foo'), 'bar');
		strictEqual(storedItems.get('some/foo/path'), 'some/bar/path');
	});

	(isWindows ? test.skip : test)('startup recovery from valid .recovery-temp when main db is missing', async () => {
		const storagePath = join(testdir, 'storage.db');
		const tempPath = `${storagePath}.recovery-temp`;
		const replacePath = `${storagePath}.recovery-replace`;

		let storage = new SQLiteStorageDatabase(tempPath);
		const tempItems = new Map<string, string>();
		tempItems.set('tempKey', 'tempVal');
		await storage.updateItems({ insert: tempItems });
		await storage.close();

		storage = new SQLiteStorageDatabase(replacePath);
		const replaceItems = new Map<string, string>();
		replaceItems.set('replaceKey', 'replaceVal');
		await storage.updateItems({ insert: replaceItems });
		await storage.close();

		strictEqual(await Promises.exists(storagePath), false);

		storage = new SQLiteStorageDatabase(storagePath);
		const items = await storage.getItems();
		strictEqual(items.get('tempKey'), 'tempVal');
		strictEqual(items.has('replaceKey'), false);
		await storage.close();

		strictEqual(await Promises.exists(storagePath), true);
		strictEqual(await Promises.exists(tempPath), false);
	});

	(isWindows ? test.skip : test)('startup recovery from valid .recovery-replace when temp is corrupt', async () => {
		const storagePath = join(testdir, 'storage.db');
		const tempPath = `${storagePath}.recovery-temp`;
		const replacePath = `${storagePath}.recovery-replace`;

		let storage = new SQLiteStorageDatabase(replacePath);
		const replaceItems = new Map<string, string>();
		replaceItems.set('replaceKey', 'replaceVal');
		await storage.updateItems({ insert: replaceItems });
		await storage.close();

		await fs.promises.writeFile(tempPath, 'Corrupted SQLite temp database bytes');

		strictEqual(await Promises.exists(storagePath), false);

		storage = new SQLiteStorageDatabase(storagePath);
		const items = await storage.getItems();
		strictEqual(items.get('replaceKey'), 'replaceVal');
		await storage.close();

		strictEqual(await Promises.exists(storagePath), true);
		strictEqual(await Promises.exists(replacePath), false);
		strictEqual(await Promises.exists(tempPath), true);
		strictEqual(await fs.promises.readFile(tempPath, 'utf8'), 'Corrupted SQLite temp database bytes');
	});

	(isWindows ? test.skip : test)('startup recovery does not overwrite existing main db', async () => {
		const storagePath = join(testdir, 'storage.db');
		const tempPath = `${storagePath}.recovery-temp`;
		const replacePath = `${storagePath}.recovery-replace`;

		let storage = new SQLiteStorageDatabase(storagePath);
		const mainItems = new Map<string, string>();
		mainItems.set('mainKey', 'mainVal');
		await storage.updateItems({ insert: mainItems });
		await storage.close();

		storage = new SQLiteStorageDatabase(tempPath);
		const tempItems = new Map<string, string>();
		tempItems.set('tempKey', 'tempVal');
		await storage.updateItems({ insert: tempItems });
		await storage.close();

		storage = new SQLiteStorageDatabase(replacePath);
		const replaceItems = new Map<string, string>();
		replaceItems.set('replaceKey', 'replaceVal');
		await storage.updateItems({ insert: replaceItems });
		await storage.close();

		storage = new SQLiteStorageDatabase(storagePath);
		const items = await storage.getItems();
		strictEqual(items.get('mainKey'), 'mainVal');
		strictEqual(items.has('tempKey'), false);
		strictEqual(items.has('replaceKey'), false);
		await storage.close();

		strictEqual(await Promises.exists(tempPath), true);
		strictEqual(await Promises.exists(replacePath), true);
	});

	(isWindows ? test.skip : test)('startup recovery preserves corrupt sidecars and restores from backup', async () => {
		const storagePath = join(testdir, 'storage.db');
		const tempPath = `${storagePath}.recovery-temp`;
		const replacePath = `${storagePath}.recovery-replace`;
		const backupPath = `${storagePath}.backup`;

		let storage = new SQLiteStorageDatabase(storagePath);
		const backupItems = new Map<string, string>();
		backupItems.set('backupKey', 'backupVal');
		await storage.updateItems({ insert: backupItems });
		await (storage as any).backup();
		await storage.close();

		strictEqual(await Promises.exists(backupPath), true);

		await fs.promises.unlink(storagePath);

		await fs.promises.writeFile(tempPath, 'Corrupted temp db');
		await fs.promises.writeFile(replacePath, 'Corrupted replace db');

		storage = new SQLiteStorageDatabase(storagePath);
		const items = await storage.getItems();
		strictEqual(items.get('backupKey'), 'backupVal');
		await storage.close();

		strictEqual(await fs.promises.readFile(tempPath, 'utf8'), 'Corrupted temp db');
		strictEqual(await fs.promises.readFile(replacePath, 'utf8'), 'Corrupted replace db');
	});

	(isWindows ? test.skip : test)('startup recovery keeps validated .recovery-temp keys when rename onto missing main fails', async () => {
		const storagePath = join(testdir, 'storage.db');
		const tempPath = `${storagePath}.recovery-temp`;

		let seed = new SQLiteStorageDatabase(tempPath);
		const originalItems = new Map<string, string>();
		originalItems.set('K', 'old');
		await seed.updateItems({ insert: originalItems });
		await seed.close();
		strictEqual(await Promises.exists(storagePath), false);

		let renameAttempts = 0;
		const originalRename = fs.promises.rename.bind(fs.promises);
		fs.promises.rename = (async (source: fs.PathLike, target: fs.PathLike) => {
			if (String(source) === tempPath && String(target) === storagePath) {
				renameAttempts++;
				const error = new Error('restore rename failed') as NodeJS.ErrnoException;
				error.code = 'EIO';
				throw error;
			}
			return originalRename(source, target);
		}) as typeof fs.promises.rename;

		try {
			const database = new SQLiteStorageDatabase(storagePath);
			const storage = new Storage(database);
			await storage.init();
			strictEqual(renameAttempts >= 1, true);
			strictEqual(await Promises.exists(tempPath), true);
			strictEqual(await Promises.exists(storagePath), true);
			strictEqual(storage.get('K'), 'old');
			strictEqual(await database.checkIntegrity(false), 'ok');

			await storage.set('K', 'new');
			await storage.close();
		} finally {
			fs.promises.rename = originalRename;
		}

		strictEqual(await Promises.exists(tempPath), true);
		const preserved = new SQLiteStorageDatabase(tempPath);
		const preservedItems = await preserved.getItems();
		strictEqual(preservedItems.get('K'), 'old');
		await preserved.close();

		const main = new SQLiteStorageDatabase(storagePath);
		const mainItems = await main.getItems();
		strictEqual(mainItems.get('K'), 'new');
		await main.close();
	});

	(isWindows ? test.skip : test)('startup recovery keeps validated .recovery-replace keys when temp is corrupt and rename onto missing main fails', async () => {
		const storagePath = join(testdir, 'storage.db');
		const tempPath = `${storagePath}.recovery-temp`;
		const replacePath = `${storagePath}.recovery-replace`;
		const corruptTemp = 'Corrupted SQLite temp database bytes';

		let seed = new SQLiteStorageDatabase(replacePath);
		const originalItems = new Map<string, string>();
		originalItems.set('K', 'old');
		await seed.updateItems({ insert: originalItems });
		await seed.close();
		await fs.promises.writeFile(tempPath, corruptTemp);
		strictEqual(await Promises.exists(storagePath), false);

		let renameAttempts = 0;
		const originalRename = fs.promises.rename.bind(fs.promises);
		fs.promises.rename = (async (source: fs.PathLike, target: fs.PathLike) => {
			if (String(source) === replacePath && String(target) === storagePath) {
				renameAttempts++;
				const error = new Error('restore rename failed') as NodeJS.ErrnoException;
				error.code = 'EIO';
				throw error;
			}
			return originalRename(source, target);
		}) as typeof fs.promises.rename;

		try {
			const database = new SQLiteStorageDatabase(storagePath);
			const storage = new Storage(database);
			await storage.init();
			strictEqual(renameAttempts >= 1, true);
			strictEqual(await Promises.exists(replacePath), true);
			strictEqual(await Promises.exists(storagePath), true);
			strictEqual(storage.get('K'), 'old');
			strictEqual(await database.checkIntegrity(false), 'ok');

			await storage.set('K', 'new');
			await storage.close();
		} finally {
			fs.promises.rename = originalRename;
		}

		strictEqual(await fs.promises.readFile(tempPath, 'utf8'), corruptTemp);
		const preserved = new SQLiteStorageDatabase(replacePath);
		const preservedItems = await preserved.getItems();
		strictEqual(preservedItems.get('K'), 'old');
		await preserved.close();

		const main = new SQLiteStorageDatabase(storagePath);
		const mainItems = await main.getItems();
		strictEqual(mainItems.get('K'), 'new');
		await main.close();
	});

	(isWindows ? test.skip /* second connection cannot write a trigger while the DB is open */ : test)('statement error rejects updateItems and whenFlushed and returns the key to pending', async () => {
		const storagePath = join(testdir, 'storage.db');
		const database = new SQLiteStorageDatabase(storagePath);
		const storage = new Storage(database);
		await storage.init();

		// Inject a statement error. ItemTable uses ON CONFLICT REPLACE, so a normal
		// duplicate insert does not fail. END TRANSACTION still succeeds; the
		// transaction promise must reject from the statement error flag.
		await execSqlite(storagePath, 'CREATE TRIGGER storage_fail_item_insert BEFORE INSERT ON ItemTable BEGIN SELECT RAISE(ABORT, \'injected statement error\'); END;');

		try {
			const setPromise = storage.set('K', 'new');
			const whenFlushedPromise = storage.whenFlushed();
			await Promise.all([
				rejects(setPromise, /injected statement error/),
				rejects(whenFlushedPromise, /injected statement error/),
			]);

			const pendingInserts = (storage as any).pendingInserts as Map<string, string>;
			const pendingDeletes = (storage as any).pendingDeletes as Set<string>;
			ok(pendingInserts.get('K') === 'new' || pendingDeletes.has('K'));
		} finally {
			await execSqlite(storagePath, 'DROP TRIGGER IF EXISTS storage_fail_item_insert;').catch(() => { /* ignore */ });
			await storage.close().catch(() => { /* connection is already erroneous */ });
		}
	});

	test('real world example', async function () {
		let storage = new SQLiteStorageDatabase(join(testdir, 'storage.db'));

		const items1 = new Map<string, string>();
		items1.set('colorthemedata', '{"id":"vs vscode-theme-defaults-themes-light_plus-json","label":"Light+ (default light)","settingsId":"Default Light+","selector":"vs.vscode-theme-defaults-themes-light_plus-json","themeTokenColors":[{"settings":{"foreground":"#000000ff","background":"#ffffffff"}},{"scope":["meta.embedded","source.groovy.embedded"],"settings":{"foreground":"#000000ff"}},{"scope":"emphasis","settings":{"fontStyle":"italic"}},{"scope":"strong","settings":{"fontStyle":"bold"}},{"scope":"meta.diff.header","settings":{"foreground":"#000080"}},{"scope":"comment","settings":{"foreground":"#008000"}},{"scope":"constant.language","settings":{"foreground":"#0000ff"}},{"scope":["constant.numeric"],"settings":{"foreground":"#098658"}},{"scope":"constant.regexp","settings":{"foreground":"#811f3f"}},{"name":"css tags in selectors, xml tags","scope":"entity.name.tag","settings":{"foreground":"#800000"}},{"scope":"entity.name.selector","settings":{"foreground":"#800000"}},{"scope":"entity.other.attribute-name","settings":{"foreground":"#ff0000"}},{"scope":["entity.other.attribute-name.class.css","entity.other.attribute-name.class.mixin.css","entity.other.attribute-name.id.css","entity.other.attribute-name.parent-selector.css","entity.other.attribute-name.pseudo-class.css","entity.other.attribute-name.pseudo-element.css","source.css.less entity.other.attribute-name.id","entity.other.attribute-name.attribute.scss","entity.other.attribute-name.scss"],"settings":{"foreground":"#800000"}},{"scope":"invalid","settings":{"foreground":"#cd3131"}},{"scope":"markup.underline","settings":{"fontStyle":"underline"}},{"scope":"markup.bold","settings":{"fontStyle":"bold","foreground":"#000080"}},{"scope":"markup.heading","settings":{"fontStyle":"bold","foreground":"#800000"}},{"scope":"markup.italic","settings":{"fontStyle":"italic"}},{"scope":"markup.inserted","settings":{"foreground":"#098658"}},{"scope":"markup.deleted","settings":{"foreground":"#a31515"}},{"scope":"markup.changed","settings":{"foreground":"#0451a5"}},{"scope":["punctuation.definition.quote.begin.markdown","punctuation.definition.list.begin.markdown"],"settings":{"foreground":"#0451a5"}},{"scope":"markup.inline.raw","settings":{"foreground":"#800000"}},{"name":"brackets of XML/HTML tags","scope":"punctuation.definition.tag","settings":{"foreground":"#800000"}},{"scope":"meta.preprocessor","settings":{"foreground":"#0000ff"}},{"scope":"meta.preprocessor.string","settings":{"foreground":"#a31515"}},{"scope":"meta.preprocessor.numeric","settings":{"foreground":"#098658"}},{"scope":"meta.structure.dictionary.key.python","settings":{"foreground":"#0451a5"}},{"scope":"storage","settings":{"foreground":"#0000ff"}},{"scope":"storage.type","settings":{"foreground":"#0000ff"}},{"scope":"storage.modifier","settings":{"foreground":"#0000ff"}},{"scope":"string","settings":{"foreground":"#a31515"}},{"scope":["string.comment.buffered.block.pug","string.quoted.pug","string.interpolated.pug","string.unquoted.plain.in.yaml","string.unquoted.plain.out.yaml","string.unquoted.block.yaml","string.quoted.single.yaml","string.quoted.double.xml","string.quoted.single.xml","string.unquoted.cdata.xml","string.quoted.double.html","string.quoted.single.html","string.unquoted.html","string.quoted.single.handlebars","string.quoted.double.handlebars"],"settings":{"foreground":"#0000ff"}},{"scope":"string.regexp","settings":{"foreground":"#811f3f"}},{"name":"String interpolation","scope":["punctuation.definition.template-expression.begin","punctuation.definition.template-expression.end","punctuation.section.embedded"],"settings":{"foreground":"#0000ff"}},{"name":"Reset JavaScript string interpolation expression","scope":["meta.template.expression"],"settings":{"foreground":"#000000"}},{"scope":["support.constant.property-value","support.constant.font-name","support.constant.media-type","support.constant.media","constant.other.color.rgb-value","constant.other.rgb-value","support.constant.color"],"settings":{"foreground":"#0451a5"}},{"scope":["support.type.vendored.property-name","support.type.property-name","variable.css","variable.scss","variable.other.less","source.coffee.embedded"],"settings":{"foreground":"#ff0000"}},{"scope":["support.type.property-name.json"],"settings":{"foreground":"#0451a5"}},{"scope":"keyword","settings":{"foreground":"#0000ff"}},{"scope":"keyword.control","settings":{"foreground":"#0000ff"}},{"scope":"keyword.operator","settings":{"foreground":"#000000"}},{"scope":["keyword.operator.new","keyword.operator.expression","keyword.operator.cast","keyword.operator.sizeof","keyword.operator.instanceof","keyword.operator.logical.python"],"settings":{"foreground":"#0000ff"}},{"scope":"keyword.other.unit","settings":{"foreground":"#098658"}},{"scope":["punctuation.section.embedded.begin.php","punctuation.section.embedded.end.php"],"settings":{"foreground":"#800000"}},{"scope":"support.function.git-rebase","settings":{"foreground":"#0451a5"}},{"scope":"constant.sha.git-rebase","settings":{"foreground":"#098658"}},{"name":"coloring of the Java import and package identifiers","scope":["storage.modifier.import.java","variable.language.wildcard.java","storage.modifier.package.java"],"settings":{"foreground":"#000000"}},{"name":"this.self","scope":"variable.language","settings":{"foreground":"#0000ff"}},{"name":"Function declarations","scope":["entity.name.function","support.function","support.constant.handlebars"],"settings":{"foreground":"#795E26"}},{"name":"Types declaration and references","scope":["meta.return-type","support.class","support.type","entity.name.type","entity.name.class","storage.type.numeric.go","storage.type.byte.go","storage.type.boolean.go","storage.type.string.go","storage.type.uintptr.go","storage.type.error.go","storage.type.rune.go","storage.type.cs","storage.type.generic.cs","storage.type.modifier.cs","storage.type.variable.cs","storage.type.annotation.java","storage.type.generic.java","storage.type.java","storage.type.object.array.java","storage.type.primitive.array.java","storage.type.primitive.java","storage.type.token.java","storage.type.groovy","storage.type.annotation.groovy","storage.type.parameters.groovy","storage.type.generic.groovy","storage.type.object.array.groovy","storage.type.primitive.array.groovy","storage.type.primitive.groovy"],"settings":{"foreground":"#267f99"}},{"name":"Types declaration and references, TS grammar specific","scope":["meta.type.cast.expr","meta.type.new.expr","support.constant.math","support.constant.dom","support.constant.json","entity.other.inherited-class"],"settings":{"foreground":"#267f99"}},{"name":"Control flow keywords","scope":"keyword.control","settings":{"foreground":"#AF00DB"}},{"name":"Variable and parameter name","scope":["variable","meta.definition.variable.name","support.variable","entity.name.variable"],"settings":{"foreground":"#001080"}},{"name":"Object keys, TS grammar specific","scope":["meta.object-literal.key"],"settings":{"foreground":"#001080"}},{"name":"CSS property value","scope":["support.constant.property-value","support.constant.font-name","support.constant.media-type","support.constant.media","constant.other.color.rgb-value","constant.other.rgb-value","support.constant.color"],"settings":{"foreground":"#0451a5"}},{"name":"Regular expression groups","scope":["punctuation.definition.group.regexp","punctuation.definition.group.assertion.regexp","punctuation.definition.character-class.regexp","punctuation.character.set.begin.regexp","punctuation.character.set.end.regexp","keyword.operator.negation.regexp","support.other.parenthesis.regexp"],"settings":{"foreground":"#d16969"}},{"scope":["constant.character.character-class.regexp","constant.other.character-class.set.regexp","constant.other.character-class.regexp","constant.character.set.regexp"],"settings":{"foreground":"#811f3f"}},{"scope":"keyword.operator.quantifier.regexp","settings":{"foreground":"#000000"}},{"scope":["keyword.operator.or.regexp","keyword.control.anchor.regexp"],"settings":{"foreground":"#ff0000"}},{"scope":"constant.character","settings":{"foreground":"#0000ff"}},{"scope":"constant.character.escape","settings":{"foreground":"#ff0000"}},{"scope":"token.info-token","settings":{"foreground":"#316bcd"}},{"scope":"token.warn-token","settings":{"foreground":"#cd9731"}},{"scope":"token.error-token","settings":{"foreground":"#cd3131"}},{"scope":"token.debug-token","settings":{"foreground":"#800080"}}],"extensionData":{"extensionId":"vscode.theme-defaults","extensionPublisher":"vscode","extensionName":"theme-defaults","extensionIsBuiltin":true},"colorMap":{"editor.background":"#ffffff","editor.foreground":"#000000","editor.inactiveSelectionBackground":"#e5ebf1","editorIndentGuide.background":"#d3d3d3","editorIndentGuide.activeBackground":"#939393","editor.selectionHighlightBackground":"#add6ff4d","editorSuggestWidget.background":"#f3f3f3","activityBarBadge.background":"#007acc","sideBarTitle.foreground":"#6f6f6f","list.hoverBackground":"#e8e8e8","input.placeholderForeground":"#767676","settings.textInputBorder":"#cecece","settings.numberInputBorder":"#cecece"}}');
		items1.set('commandpalette.mru.cache', '{"usesLRU":true,"entries":[{"key":"revealFileInOS","value":3},{"key":"extension.openInGitHub","value":4},{"key":"workbench.extensions.action.openExtensionsFolder","value":11},{"key":"workbench.action.showRuntimeExtensions","value":14},{"key":"workbench.action.toggleTabsVisibility","value":15},{"key":"extension.liveServerPreview.open","value":16},{"key":"workbench.action.openIssueReporter","value":18},{"key":"workbench.action.openProcessExplorer","value":19},{"key":"workbench.action.toggleSharedProcess","value":20},{"key":"workbench.action.configureLocale","value":21},{"key":"workbench.action.appPerf","value":22},{"key":"workbench.action.reportPerformanceIssueUsingReporter","value":23},{"key":"workbench.action.openGlobalKeybindings","value":25},{"key":"workbench.action.output.toggleOutput","value":27},{"key":"extension.sayHello","value":29}]}');
		items1.set('cpp.1.lastsessiondate', 'Fri Oct 05 2018');
		items1.set('debug.actionswidgetposition', '0.6880952380952381');

		const items2 = new Map<string, string>();
		items2.set('workbench.editors.files.textfileeditor', '{"textEditorViewState":[["file:///Users/dummy/Documents/ticino-playground/play.htm",{"0":{"cursorState":[{"inSelectionMode":false,"selectionStart":{"lineNumber":6,"column":16},"position":{"lineNumber":6,"column":16}}],"viewState":{"scrollLeft":0,"firstPosition":{"lineNumber":1,"column":1},"firstPositionDeltaTop":0},"contributionsState":{"editor.contrib.folding":{},"editor.contrib.wordHighlighter":false}}}],["file:///Users/dummy/Documents/ticino-playground/nakefile.js",{"0":{"cursorState":[{"inSelectionMode":false,"selectionStart":{"lineNumber":7,"column":81},"position":{"lineNumber":7,"column":81}}],"viewState":{"scrollLeft":0,"firstPosition":{"lineNumber":1,"column":1},"firstPositionDeltaTop":20},"contributionsState":{"editor.contrib.folding":{},"editor.contrib.wordHighlighter":false}}}],["file:///Users/dummy/Desktop/vscode2/.gitattributes",{"0":{"cursorState":[{"inSelectionMode":false,"selectionStart":{"lineNumber":9,"column":12},"position":{"lineNumber":9,"column":12}}],"viewState":{"scrollLeft":0,"firstPosition":{"lineNumber":1,"column":1},"firstPositionDeltaTop":20},"contributionsState":{"editor.contrib.folding":{},"editor.contrib.wordHighlighter":false}}}],["file:///Users/dummy/Desktop/vscode2/src/vs/workbench/contrib/search/browser/openAnythingHandler.ts",{"0":{"cursorState":[{"inSelectionMode":false,"selectionStart":{"lineNumber":1,"column":1},"position":{"lineNumber":1,"column":1}}],"viewState":{"scrollLeft":0,"firstPosition":{"lineNumber":1,"column":1},"firstPositionDeltaTop":0},"contributionsState":{"editor.contrib.folding":{},"editor.contrib.wordHighlighter":false}}}]]}');

		const items3 = new Map<string, string>();
		items3.set('nps/iscandidate', 'false');
		items3.set('telemetry.instanceid', 'd52bfcd4-4be6-476b-a38f-d44c717c41d6');
		items3.set('workbench.activity.pinnedviewlets', '[{"id":"workbench.view.explorer","pinned":true,"order":0,"visible":true},{"id":"workbench.view.search","pinned":true,"order":1,"visible":true},{"id":"workbench.view.scm","pinned":true,"order":2,"visible":true},{"id":"workbench.view.debug","pinned":true,"order":3,"visible":true},{"id":"workbench.view.extensions","pinned":true,"order":4,"visible":true},{"id":"workbench.view.extension.gitlens","pinned":true,"order":7,"visible":true},{"id":"workbench.view.extension.test","pinned":false,"visible":false}]');
		items3.set('workbench.panel.height', '419');
		items3.set('very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.very.long.key.', 'is long');

		let storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		await Promise.all([
			await storage.updateItems({ insert: items1 }),
			await storage.updateItems({ insert: items2 }),
			await storage.updateItems({ insert: items3 })
		]);

		strictEqual(await storage.checkIntegrity(true), 'ok');
		strictEqual(await storage.checkIntegrity(false), 'ok');

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, items1.size + items2.size + items3.size);

		const items1Keys: string[] = [];
		items1.forEach((value, key) => {
			items1Keys.push(key);
			strictEqual(storedItems.get(key), value);
		});

		const items2Keys: string[] = [];
		items2.forEach((value, key) => {
			items2Keys.push(key);
			strictEqual(storedItems.get(key), value);
		});

		const items3Keys: string[] = [];
		items3.forEach((value, key) => {
			items3Keys.push(key);
			strictEqual(storedItems.get(key), value);
		});

		await Promise.all([
			await storage.updateItems({ delete: toSet(items1Keys) }),
			await storage.updateItems({ delete: toSet(items2Keys) }),
			await storage.updateItems({ delete: toSet(items3Keys) })
		]);

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		await Promise.all([
			await storage.updateItems({ insert: items1 }),
			await storage.getItems(),
			await storage.updateItems({ insert: items2 }),
			await storage.getItems(),
			await storage.updateItems({ insert: items3 }),
			await storage.getItems(),
		]);

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, items1.size + items2.size + items3.size);

		await storage.close();

		storage = new SQLiteStorageDatabase(join(testdir, 'storage.db'));

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, items1.size + items2.size + items3.size);

		await storage.close();
	});

	test('very large item value', async function () {
		const storage = new SQLiteStorageDatabase(join(testdir, 'storage.db'));

		let randomData = createLargeRandomData(); // 3.6MB

		await storage.updateItems({ insert: randomData.items });

		let storedItems = await storage.getItems();
		strictEqual(randomData.items.get('colorthemedata'), storedItems.get('colorthemedata'));
		strictEqual(randomData.items.get('commandpalette.mru.cache'), storedItems.get('commandpalette.mru.cache'));
		strictEqual(randomData.items.get('super.large.string'), storedItems.get('super.large.string'));

		randomData = createLargeRandomData();

		await storage.updateItems({ insert: randomData.items });

		storedItems = await storage.getItems();
		strictEqual(randomData.items.get('colorthemedata'), storedItems.get('colorthemedata'));
		strictEqual(randomData.items.get('commandpalette.mru.cache'), storedItems.get('commandpalette.mru.cache'));
		strictEqual(randomData.items.get('super.large.string'), storedItems.get('super.large.string'));

		const toDelete = new Set<string>();
		toDelete.add('super.large.string');
		await storage.updateItems({ delete: toDelete });

		storedItems = await storage.getItems();
		strictEqual(randomData.items.get('colorthemedata'), storedItems.get('colorthemedata'));
		strictEqual(randomData.items.get('commandpalette.mru.cache'), storedItems.get('commandpalette.mru.cache'));
		ok(!storedItems.get('super.large.string'));

		await storage.close();
	});

	test('multiple concurrent writes execute in sequence', async () => {
		return runWithFakedTimers({}, async () => {
			class TestStorage extends Storage {
				getStorage(): IStorageDatabase {
					return this.database;
				}
			}

			const storage = new TestStorage(new SQLiteStorageDatabase(join(testdir, 'storage.db')));

			await storage.init();

			storage.set('foo', 'bar');
			storage.set('some/foo/path', 'some/bar/path');

			await timeout(2);

			storage.set('foo1', 'bar');
			storage.set('some/foo1/path', 'some/bar/path');

			await timeout(2);

			storage.set('foo2', 'bar');
			storage.set('some/foo2/path', 'some/bar/path');

			await timeout(2);

			storage.delete('foo1');
			storage.delete('some/foo1/path');

			await timeout(2);

			storage.delete('foo4');
			storage.delete('some/foo4/path');

			await timeout(5);

			storage.set('foo3', 'bar');
			await storage.set('some/foo3/path', 'some/bar/path');

			const items = await storage.getStorage().getItems();
			strictEqual(items.get('foo'), 'bar');
			strictEqual(items.get('some/foo/path'), 'some/bar/path');
			strictEqual(items.has('foo1'), false);
			strictEqual(items.has('some/foo1/path'), false);
			strictEqual(items.get('foo2'), 'bar');
			strictEqual(items.get('some/foo2/path'), 'some/bar/path');
			strictEqual(items.get('foo3'), 'bar');
			strictEqual(items.get('some/foo3/path'), 'some/bar/path');

			await storage.close();
		});
	});

	test('lots of INSERT & DELETE (below inline max)', async () => {
		const storage = new SQLiteStorageDatabase(join(testdir, 'storage.db'));

		const { items, keys } = createManyRandomData(200);

		await storage.updateItems({ insert: items });

		let storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);

		await storage.updateItems({ delete: keys });

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		await storage.close();
	});

	test('lots of INSERT & DELETE (above inline max)', async () => {
		const storage = new SQLiteStorageDatabase(join(testdir, 'storage.db'));

		const { items, keys } = createManyRandomData();

		await storage.updateItems({ insert: items });

		let storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);

		await storage.updateItems({ delete: keys });

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		await storage.close();
	});

	test('invalid path does not hang', async () => {
		const storage = new SQLiteStorageDatabase(join(testdir, 'nonexist', 'storage.db'));

		let error;
		try {
			await storage.getItems();
			await storage.close();
		} catch (e) {
			error = e;
		}

		ok(error);
	});

	test('optimize', async () => {
		const dbPath = join(testdir, 'storage.db');
		let storage = new SQLiteStorageDatabase(dbPath);

		const { items, keys } = createManyRandomData(400, true);

		await storage.updateItems({ insert: items });

		let storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);

		await storage.optimize();
		await storage.close();

		const sizeBeforeDeleteAndOptimize = (await fs.promises.stat(dbPath)).size;

		storage = new SQLiteStorageDatabase(dbPath);

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, items.size);

		await storage.updateItems({ delete: keys });

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		await storage.optimize();
		await storage.close();

		storage = new SQLiteStorageDatabase(dbPath);

		storedItems = await storage.getItems();
		strictEqual(storedItems.size, 0);

		await storage.close();

		const sizeAfterDeleteAndOptimize = (await fs.promises.stat(dbPath)).size;

		strictEqual(sizeAfterDeleteAndOptimize < sizeBeforeDeleteAndOptimize, true);
	});

	function createManyRandomData(length = 400, includeVeryLarge = false) {
		const items = new Map<string, string>();
		const keys = new Set<string>();

		for (let i = 0; i < length; i++) {
			const uuid = generateUuid();
			const key = `key: ${uuid}`;

			items.set(key, `value: ${uuid}`);
			keys.add(key);
		}

		if (includeVeryLarge) {
			const largeData = createLargeRandomData();
			for (const [key, value] of largeData.items) {
				items.set(key, value);
				keys.add(key);
			}
		}

		return { items, keys };
	}

	function createLargeRandomData() {
		const items = new Map<string, string>();
		items.set('colorthemedata', '{"id":"vs vscode-theme-defaults-themes-light_plus-json","label":"Light+ (default light)","settingsId":"Default Light+","selector":"vs.vscode-theme-defaults-themes-light_plus-json","themeTokenColors":[{"settings":{"foreground":"#000000ff","background":"#ffffffff"}},{"scope":["meta.embedded","source.groovy.embedded"],"settings":{"foreground":"#000000ff"}},{"scope":"emphasis","settings":{"fontStyle":"italic"}},{"scope":"strong","settings":{"fontStyle":"bold"}},{"scope":"meta.diff.header","settings":{"foreground":"#000080"}},{"scope":"comment","settings":{"foreground":"#008000"}},{"scope":"constant.language","settings":{"foreground":"#0000ff"}},{"scope":["constant.numeric"],"settings":{"foreground":"#098658"}},{"scope":"constant.regexp","settings":{"foreground":"#811f3f"}},{"name":"css tags in selectors, xml tags","scope":"entity.name.tag","settings":{"foreground":"#800000"}},{"scope":"entity.name.selector","settings":{"foreground":"#800000"}},{"scope":"entity.other.attribute-name","settings":{"foreground":"#ff0000"}},{"scope":["entity.other.attribute-name.class.css","entity.other.attribute-name.class.mixin.css","entity.other.attribute-name.id.css","entity.other.attribute-name.parent-selector.css","entity.other.attribute-name.pseudo-class.css","entity.other.attribute-name.pseudo-element.css","source.css.less entity.other.attribute-name.id","entity.other.attribute-name.attribute.scss","entity.other.attribute-name.scss"],"settings":{"foreground":"#800000"}},{"scope":"invalid","settings":{"foreground":"#cd3131"}},{"scope":"markup.underline","settings":{"fontStyle":"underline"}},{"scope":"markup.bold","settings":{"fontStyle":"bold","foreground":"#000080"}},{"scope":"markup.heading","settings":{"fontStyle":"bold","foreground":"#800000"}},{"scope":"markup.italic","settings":{"fontStyle":"italic"}},{"scope":"markup.inserted","settings":{"foreground":"#098658"}},{"scope":"markup.deleted","settings":{"foreground":"#a31515"}},{"scope":"markup.changed","settings":{"foreground":"#0451a5"}},{"scope":["punctuation.definition.quote.begin.markdown","punctuation.definition.list.begin.markdown"],"settings":{"foreground":"#0451a5"}},{"scope":"markup.inline.raw","settings":{"foreground":"#800000"}},{"name":"brackets of XML/HTML tags","scope":"punctuation.definition.tag","settings":{"foreground":"#800000"}},{"scope":"meta.preprocessor","settings":{"foreground":"#0000ff"}},{"scope":"meta.preprocessor.string","settings":{"foreground":"#a31515"}},{"scope":"meta.preprocessor.numeric","settings":{"foreground":"#098658"}},{"scope":"meta.structure.dictionary.key.python","settings":{"foreground":"#0451a5"}},{"scope":"storage","settings":{"foreground":"#0000ff"}},{"scope":"storage.type","settings":{"foreground":"#0000ff"}},{"scope":"storage.modifier","settings":{"foreground":"#0000ff"}},{"scope":"string","settings":{"foreground":"#a31515"}},{"scope":["string.comment.buffered.block.pug","string.quoted.pug","string.interpolated.pug","string.unquoted.plain.in.yaml","string.unquoted.plain.out.yaml","string.unquoted.block.yaml","string.quoted.single.yaml","string.quoted.double.xml","string.quoted.single.xml","string.unquoted.cdata.xml","string.quoted.double.html","string.quoted.single.html","string.unquoted.html","string.quoted.single.handlebars","string.quoted.double.handlebars"],"settings":{"foreground":"#0000ff"}},{"scope":"string.regexp","settings":{"foreground":"#811f3f"}},{"name":"String interpolation","scope":["punctuation.definition.template-expression.begin","punctuation.definition.template-expression.end","punctuation.section.embedded"],"settings":{"foreground":"#0000ff"}},{"name":"Reset JavaScript string interpolation expression","scope":["meta.template.expression"],"settings":{"foreground":"#000000"}},{"scope":["support.constant.property-value","support.constant.font-name","support.constant.media-type","support.constant.media","constant.other.color.rgb-value","constant.other.rgb-value","support.constant.color"],"settings":{"foreground":"#0451a5"}},{"scope":["support.type.vendored.property-name","support.type.property-name","variable.css","variable.scss","variable.other.less","source.coffee.embedded"],"settings":{"foreground":"#ff0000"}},{"scope":["support.type.property-name.json"],"settings":{"foreground":"#0451a5"}},{"scope":"keyword","settings":{"foreground":"#0000ff"}},{"scope":"keyword.control","settings":{"foreground":"#0000ff"}},{"scope":"keyword.operator","settings":{"foreground":"#000000"}},{"scope":["keyword.operator.new","keyword.operator.expression","keyword.operator.cast","keyword.operator.sizeof","keyword.operator.instanceof","keyword.operator.logical.python"],"settings":{"foreground":"#0000ff"}},{"scope":"keyword.other.unit","settings":{"foreground":"#098658"}},{"scope":["punctuation.section.embedded.begin.php","punctuation.section.embedded.end.php"],"settings":{"foreground":"#800000"}},{"scope":"support.function.git-rebase","settings":{"foreground":"#0451a5"}},{"scope":"constant.sha.git-rebase","settings":{"foreground":"#098658"}},{"name":"coloring of the Java import and package identifiers","scope":["storage.modifier.import.java","variable.language.wildcard.java","storage.modifier.package.java"],"settings":{"foreground":"#000000"}},{"name":"this.self","scope":"variable.language","settings":{"foreground":"#0000ff"}},{"name":"Function declarations","scope":["entity.name.function","support.function","support.constant.handlebars"],"settings":{"foreground":"#795E26"}},{"name":"Types declaration and references","scope":["meta.return-type","support.class","support.type","entity.name.type","entity.name.class","storage.type.numeric.go","storage.type.byte.go","storage.type.boolean.go","storage.type.string.go","storage.type.uintptr.go","storage.type.error.go","storage.type.rune.go","storage.type.cs","storage.type.generic.cs","storage.type.modifier.cs","storage.type.variable.cs","storage.type.annotation.java","storage.type.generic.java","storage.type.java","storage.type.object.array.java","storage.type.primitive.array.java","storage.type.primitive.java","storage.type.token.java","storage.type.groovy","storage.type.annotation.groovy","storage.type.parameters.groovy","storage.type.generic.groovy","storage.type.object.array.groovy","storage.type.primitive.array.groovy","storage.type.primitive.groovy"],"settings":{"foreground":"#267f99"}},{"name":"Types declaration and references, TS grammar specific","scope":["meta.type.cast.expr","meta.type.new.expr","support.constant.math","support.constant.dom","support.constant.json","entity.other.inherited-class"],"settings":{"foreground":"#267f99"}},{"name":"Control flow keywords","scope":"keyword.control","settings":{"foreground":"#AF00DB"}},{"name":"Variable and parameter name","scope":["variable","meta.definition.variable.name","support.variable","entity.name.variable"],"settings":{"foreground":"#001080"}},{"name":"Object keys, TS grammar specific","scope":["meta.object-literal.key"],"settings":{"foreground":"#001080"}},{"name":"CSS property value","scope":["support.constant.property-value","support.constant.font-name","support.constant.media-type","support.constant.media","constant.other.color.rgb-value","constant.other.rgb-value","support.constant.color"],"settings":{"foreground":"#0451a5"}},{"name":"Regular expression groups","scope":["punctuation.definition.group.regexp","punctuation.definition.group.assertion.regexp","punctuation.definition.character-class.regexp","punctuation.character.set.begin.regexp","punctuation.character.set.end.regexp","keyword.operator.negation.regexp","support.other.parenthesis.regexp"],"settings":{"foreground":"#d16969"}},{"scope":["constant.character.character-class.regexp","constant.other.character-class.set.regexp","constant.other.character-class.regexp","constant.character.set.regexp"],"settings":{"foreground":"#811f3f"}},{"scope":"keyword.operator.quantifier.regexp","settings":{"foreground":"#000000"}},{"scope":["keyword.operator.or.regexp","keyword.control.anchor.regexp"],"settings":{"foreground":"#ff0000"}},{"scope":"constant.character","settings":{"foreground":"#0000ff"}},{"scope":"constant.character.escape","settings":{"foreground":"#ff0000"}},{"scope":"token.info-token","settings":{"foreground":"#316bcd"}},{"scope":"token.warn-token","settings":{"foreground":"#cd9731"}},{"scope":"token.error-token","settings":{"foreground":"#cd3131"}},{"scope":"token.debug-token","settings":{"foreground":"#800080"}}],"extensionData":{"extensionId":"vscode.theme-defaults","extensionPublisher":"vscode","extensionName":"theme-defaults","extensionIsBuiltin":true},"colorMap":{"editor.background":"#ffffff","editor.foreground":"#000000","editor.inactiveSelectionBackground":"#e5ebf1","editorIndentGuide.background":"#d3d3d3","editorIndentGuide.activeBackground":"#939393","editor.selectionHighlightBackground":"#add6ff4d","editorSuggestWidget.background":"#f3f3f3","activityBarBadge.background":"#007acc","sideBarTitle.foreground":"#6f6f6f","list.hoverBackground":"#e8e8e8","input.placeholderForeground":"#767676","settings.textInputBorder":"#cecece","settings.numberInputBorder":"#cecece"}}');
		items.set('commandpalette.mru.cache', '{"usesLRU":true,"entries":[{"key":"revealFileInOS","value":3},{"key":"extension.openInGitHub","value":4},{"key":"workbench.extensions.action.openExtensionsFolder","value":11},{"key":"workbench.action.showRuntimeExtensions","value":14},{"key":"workbench.action.toggleTabsVisibility","value":15},{"key":"extension.liveServerPreview.open","value":16},{"key":"workbench.action.openIssueReporter","value":18},{"key":"workbench.action.openProcessExplorer","value":19},{"key":"workbench.action.toggleSharedProcess","value":20},{"key":"workbench.action.configureLocale","value":21},{"key":"workbench.action.appPerf","value":22},{"key":"workbench.action.reportPerformanceIssueUsingReporter","value":23},{"key":"workbench.action.openGlobalKeybindings","value":25},{"key":"workbench.action.output.toggleOutput","value":27},{"key":"extension.sayHello","value":29}]}');

		const uuid = generateUuid();
		const value: string[] = [];
		for (let i = 0; i < 100000; i++) {
			value.push(uuid);
		}

		items.set('super.large.string', value.join()); // 3.6MB

		return { items, uuid, value };
	}
});


