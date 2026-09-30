/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { deepStrictEqual, ok, strictEqual } from 'assert';
import { Event } from '../../../../common/event.js';
import { runWithFakedTimers } from '../../../../test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../test/common/utils.js';
import { IStorageDatabase, IUpdateRequest, MIGRATED_KEY, MigratingStorage, Storage } from '../../common/storage.js';

class ControllableStorageDatabase implements IStorageDatabase {

	readonly onDidChangeItemsExternal = Event.None;

	private readonly store = new Map<string, string>();

	private releaseBlockedUpdate: (() => void) | undefined;
	private rejectBlockedUpdate: ((error: Error) => void) | undefined;
	private blockedUpdatePromise: Promise<void> | undefined;

	get(key: string): string | undefined {
		return this.store.get(key);
	}

	blockNextUpdate(): void {
		this.blockedUpdatePromise = new Promise<void>((resolve, reject) => {
			this.releaseBlockedUpdate = resolve;
			this.rejectBlockedUpdate = reject;
		});
	}

	completeBlockedUpdate(): void {
		this.releaseBlockedUpdate?.();
		this.releaseBlockedUpdate = undefined;
		this.rejectBlockedUpdate = undefined;
		this.blockedUpdatePromise = undefined;
	}

	failBlockedUpdate(error: Error): void {
		this.rejectBlockedUpdate?.(error);
		this.releaseBlockedUpdate = undefined;
		this.rejectBlockedUpdate = undefined;
		this.blockedUpdatePromise = undefined;
	}

	async getItems(): Promise<Map<string, string>> {
		return new Map(this.store);
	}

	async updateItems(request: IUpdateRequest): Promise<void> {
		if (this.blockedUpdatePromise) {
			await this.blockedUpdatePromise;
		}

		request.insert?.forEach((value, key) => this.store.set(key, value));
		request.delete?.forEach(key => this.store.delete(key));
	}

	async optimize(): Promise<void> { }

	async close(): Promise<void> { }
}

suite('MigratingStorage', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('keeps fallback key until primary updateItems completes', () => {
		return runWithFakedTimers({}, async () => {
			const primaryDatabase = new ControllableStorageDatabase();
			const fallbackDatabase = new ControllableStorageDatabase();

			const primaryStorage = new MigratingStorage(primaryDatabase);
			const fallbackStorage = new Storage(fallbackDatabase);

			try {
				await primaryStorage.init();
				await fallbackStorage.init();

				await fallbackStorage.set('migrate.me', 'from-fallback');
				await fallbackStorage.flush(0);

				primaryStorage.setFallbackStorage(fallbackStorage, false);

				primaryDatabase.blockNextUpdate();
				strictEqual(primaryStorage.get('migrate.me'), 'from-fallback');
				strictEqual(fallbackDatabase.get('migrate.me'), 'from-fallback');

				primaryDatabase.completeBlockedUpdate();
				await primaryStorage.flush(0);
				await fallbackStorage.flush(0);

				strictEqual(primaryDatabase.get('migrate.me'), 'from-fallback');
				ok(!fallbackDatabase.get('migrate.me'));

				await primaryStorage.close();
				await fallbackStorage.close();
			} finally {
				primaryStorage.dispose();
				fallbackStorage.dispose();
			}
		});
	});

	test('keeps fallback key when primary updateItems rejects', () => {
		return runWithFakedTimers({}, async () => {
			const primaryDatabase = new ControllableStorageDatabase();
			const fallbackDatabase = new ControllableStorageDatabase();

			const primaryStorage = new MigratingStorage(primaryDatabase);
			const fallbackStorage = new Storage(fallbackDatabase);

			try {
				await primaryStorage.init();
				await fallbackStorage.init();

				await fallbackStorage.set('migrate.me', 'from-fallback');
				await fallbackStorage.flush(0);

				primaryStorage.setFallbackStorage(fallbackStorage, false);

				primaryDatabase.blockNextUpdate();
				strictEqual(primaryStorage.get('migrate.me'), 'from-fallback');

				const rejectedFlush = primaryStorage.flush(0);
				primaryDatabase.failBlockedUpdate(new Error('primary write failed'));
				try {
					await rejectedFlush;
					ok(false, 'expected primary flush to reject');
				} catch {
					// expected
				}

				strictEqual(fallbackDatabase.get('migrate.me'), 'from-fallback');
				const migratedRaw = primaryStorage.get(MIGRATED_KEY);
				ok(!migratedRaw || !JSON.parse(migratedRaw).includes('migrate.me'));

				await primaryStorage.close();
				await fallbackStorage.close();
			} finally {
				primaryStorage.dispose();
				fallbackStorage.dispose();
			}
		});
	});

	test('does not migrate from fallback after primary storage is closed', () => {
		return runWithFakedTimers({}, async () => {
			const primaryDatabase = new ControllableStorageDatabase();
			const fallbackDatabase = new ControllableStorageDatabase();

			const primaryStorage = new MigratingStorage(primaryDatabase);
			const fallbackStorage = new Storage(fallbackDatabase);

			try {
				await primaryStorage.init();
				await fallbackStorage.init();

				await fallbackStorage.set('migrate.me', 'from-fallback');
				await fallbackStorage.flush(0);

				primaryStorage.setFallbackStorage(fallbackStorage, false);
				await primaryStorage.close();

				strictEqual(primaryStorage.get('migrate.me', 'default'), 'default');
				strictEqual(fallbackDatabase.get('migrate.me'), 'from-fallback');
				ok(!primaryDatabase.get('migrate.me'));

				await fallbackStorage.close();
			} finally {
				primaryStorage.dispose();
				fallbackStorage.dispose();
			}
		});
	});

	test('records migrated keys only after primary write succeeds', () => {
		return runWithFakedTimers({}, async () => {
			const primaryDatabase = new ControllableStorageDatabase();
			const fallbackDatabase = new ControllableStorageDatabase();

			const primaryStorage = new MigratingStorage(primaryDatabase);
			const fallbackStorage = new Storage(fallbackDatabase);

			try {
				await primaryStorage.init();
				await fallbackStorage.init();

				await fallbackStorage.set('migrate.me', 'from-fallback');
				await fallbackStorage.flush(0);

				primaryStorage.setFallbackStorage(fallbackStorage, false);
				strictEqual(primaryStorage.get('migrate.me'), 'from-fallback');

				await primaryStorage.flush(0);
				await fallbackStorage.flush(0);

				strictEqual(primaryDatabase.get('migrate.me'), 'from-fallback');
				ok(!fallbackDatabase.get('migrate.me'));

				const migratedRaw = primaryStorage.get(MIGRATED_KEY);
				ok(migratedRaw);
				deepStrictEqual(JSON.parse(migratedRaw!), ['migrate.me']);

				await primaryStorage.close();
				await fallbackStorage.close();
			} finally {
				primaryStorage.dispose();
				fallbackStorage.dispose();
			}
		});
	});
});
