/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Disposable } from '../../../base/common/lifecycle.js';
import { mock } from '../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { ILogService, NullLogService } from '../../../platform/log/common/log.js';
import { IStorageService } from '../../../platform/storage/common/storage.js';
import { IUserDataProfile, IUserDataProfilesService } from '../../../platform/userDataProfile/common/userDataProfile.js';
import { IUserDataProfileStorageService } from '../../../platform/userDataProfile/common/userDataProfileStorageService.js';
import { IChatEntitlementService, IChatSentiment } from '../../../workbench/services/chat/common/chatEntitlementService.js';
import { SessionsSetUpService } from '../../browser/sessionsSetUpService.js';

const profileReadFailed = '[sessions welcome] Failed to read setup state from default profile:';

interface ISetupInitProbe {
	_initPromise: Promise<void> | undefined;
	whenSetupDone(): Promise<boolean>;
}

function probe(service: SessionsSetUpService): ISetupInitProbe {
	return service as unknown as ISetupInitProbe;
}

class ProfileReads {
	count = 0;
	syncError: Error | undefined;
	private readonly pending: { resolve: () => void; reject: (error: Error) => void }[] = [];
	private readonly storage = new class extends mock<IStorageService>() { }();

	withProfile<T>(_profile: IUserDataProfile, fn: (storageService: IStorageService) => Promise<T>): Promise<T> {
		this.count++;
		if (this.syncError) {
			const error = this.syncError;
			this.syncError = undefined;
			throw error;
		}
		return new Promise<void>((resolve, reject) => {
			this.pending.push({ resolve, reject });
		}).then(() => fn(this.storage));
	}

	settleNext(error?: Error): void {
		const next = this.pending.shift();
		assert.ok(next, 'expected a pending default profile read');
		if (error) {
			next.reject(error);
		} else {
			next.resolve();
		}
	}
}

class FakeEntitlement extends mock<IChatEntitlementService>() {
	completed = false;
	markCount = 0;

	override get sentiment(): IChatSentiment {
		return { completed: this.completed };
	}

	override markSetupCompleted(): void {
		this.markCount++;
		this.completed = true;
	}
}

class CaptureLogService extends NullLogService {
	readonly logged: unknown[][] = [];

	override error(message: string | Error, ...args: unknown[]): void {
		this.logged.push([message, ...args]);
	}
}

interface IHarness {
	service: SessionsSetUpService;
	reads: ProfileReads;
	entitlement: FakeEntitlement;
	log: CaptureLogService;
	profile: { completed: boolean };
}

function createHarness(store: ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>, options?: { completed?: boolean; syncError?: Error }): IHarness {
	const profile = { completed: options?.completed ?? false };
	const reads = new ProfileReads();
	reads.syncError = options?.syncError;
	const entitlement = new FakeEntitlement();
	const log = new CaptureLogService();
	const defaultProfile = { id: 'default', isDefault: true, name: 'Default' } as IUserDataProfile;
	const profiles = new class extends mock<IUserDataProfilesService>() {
		override readonly defaultProfile = defaultProfile;
	};
	const profileStorage = new class extends mock<IUserDataProfileStorageService>() {
		override withProfileScopedStorageService<T>(profileToRead: IUserDataProfile, fn: (storageService: IStorageService) => Promise<T>): Promise<T> {
			assert.strictEqual(profileToRead, defaultProfile);
			return reads.withProfile(profileToRead, fn);
		}
	};
	const child = new class extends mock<IInstantiationService>() {
		override createInstance<T>(_ctor: unknown, ..._args: unknown[]): T {
			return {
				state: { completed: profile.completed },
				dispose() { },
			} as unknown as T;
		}
	};
	const instantiationService = new class extends mock<IInstantiationService>() {
		override createInstance<T>(_ctor: unknown, ..._args: unknown[]): T {
			return new Disposable() as unknown as T;
		}
		override createChild(): IInstantiationService {
			return child;
		}
	};
	const service = store.add(new SessionsSetUpService(instantiationService, profileStorage, profiles, entitlement, log));
	return { service, reads, entitlement, log, profile };
}

suite('SessionsSetUpService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('reads the default profile again on the second whenSetupDone after the first read fails', async () => {
		const error = new Error('default profile read failed');
		const harness = createHarness(store);
		const first = probe(harness.service).whenSetupDone();
		assert.strictEqual(harness.reads.count, 1);
		harness.reads.settleNext(error);
		assert.strictEqual(await first, false);
		assert.strictEqual(harness.entitlement.markCount, 0);
		assert.deepStrictEqual(harness.log.logged, [[profileReadFailed, error]]);

		harness.profile.completed = true;
		const second = probe(harness.service).whenSetupDone();
		assert.strictEqual(harness.reads.count, 2);
		harness.reads.settleNext();
		assert.strictEqual(await second, true);
		assert.strictEqual(harness.entitlement.markCount, 1);
		assert.strictEqual(harness.reads.count, 2);

		assert.strictEqual(await probe(harness.service).whenSetupDone(), true);
		assert.strictEqual(harness.reads.count, 2);
		assert.strictEqual(harness.entitlement.markCount, 1);
	});

	test('concurrent whenSetupDone calls share one profile read', async () => {
		const harness = createHarness(store);
		const first = probe(harness.service).whenSetupDone();
		const second = probe(harness.service).whenSetupDone();
		assert.strictEqual(harness.reads.count, 1);

		harness.reads.settleNext();
		assert.deepStrictEqual(await Promise.all([first, second]), [false, false]);
		assert.strictEqual(harness.reads.count, 1);
		assert.strictEqual(harness.entitlement.markCount, 0);

		assert.strictEqual(await probe(harness.service).whenSetupDone(), false);
		assert.strictEqual(harness.reads.count, 1);
	});

	test('a completed default profile marks setup done and is not read again', async () => {
		const harness = createHarness(store, { completed: true });
		const first = probe(harness.service).whenSetupDone();
		assert.strictEqual(harness.reads.count, 1);
		harness.reads.settleNext();

		assert.strictEqual(await first, true);
		assert.strictEqual(harness.entitlement.markCount, 1);
		assert.strictEqual(harness.entitlement.completed, true);
		assert.strictEqual(harness.reads.count, 1);

		assert.strictEqual(await probe(harness.service).whenSetupDone(), true);
		assert.strictEqual(harness.reads.count, 1);
		assert.strictEqual(harness.entitlement.markCount, 1);
	});

	test('a synchronous read failure is read again on the next whenSetupDone', async () => {
		const error = new Error('default profile read failed sync');
		const harness = createHarness(store, { syncError: error });
		const first = probe(harness.service).whenSetupDone();
		assert.strictEqual(harness.reads.count, 1);
		assert.strictEqual(await first, false);
		assert.strictEqual(harness.entitlement.markCount, 0);
		assert.deepStrictEqual(harness.log.logged, [[profileReadFailed, error]]);

		const second = probe(harness.service).whenSetupDone();
		assert.strictEqual(harness.reads.count, 2);
		harness.reads.settleNext();
		assert.strictEqual(await second, false);
		assert.strictEqual(await probe(harness.service).whenSetupDone(), false);
		assert.strictEqual(harness.reads.count, 2);
	});

	test('a failed read drops the promise only while it still points at that attempt', async () => {
		const error = new Error('default profile read failed late');
		const harness = createHarness(store);
		const first = probe(harness.service).whenSetupDone();
		const replacement = Promise.resolve();
		probe(harness.service)._initPromise = replacement;

		harness.reads.settleNext(error);
		assert.strictEqual(await first, false);
		assert.strictEqual(probe(harness.service)._initPromise, replacement);
		assert.strictEqual(harness.reads.count, 1);
		assert.deepStrictEqual(harness.log.logged, [[profileReadFailed, error]]);

		assert.strictEqual(await probe(harness.service).whenSetupDone(), false);
		assert.strictEqual(harness.reads.count, 1);
		assert.strictEqual(probe(harness.service)._initPromise, replacement);
	});
});
