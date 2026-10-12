/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILogService, LogLevel } from '../../../../../platform/log/common/log.js';
import { IUserData, IUserDataSyncResourceInitializer, SyncResource } from '../../../../../platform/userDataSync/common/userDataSync.js';
import { UserDataSyncInitializer } from '../../browser/userDataSyncInit.js';
import { getSyncAreaLabel } from '../../common/userDataSync.js';

class CaptureLogService implements ILogService {
	declare readonly _serviceBrand: undefined;

	readonly onDidChangeLogLevel = Event.None;
	readonly infos: string[] = [];
	readonly errors: unknown[] = [];

	getLevel(): LogLevel { return LogLevel.Trace; }
	setLevel(_level: LogLevel): void { }
	trace(_message: string, ..._args: unknown[]): void { }
	debug(_message: string, ..._args: unknown[]): void { }
	info(message: string, ...args: unknown[]): void {
		this.infos.push(args.length ? `${message} ${args.map(String).join(' ')}` : message);
	}
	warn(_message: string, ..._args: unknown[]): void { }
	error(message: string | Error, ...args: unknown[]): void {
		this.errors.push(message);
		for (const arg of args) {
			this.errors.push(arg);
		}
	}
	flush(): void { }
	dispose(): void { }
}

interface IStoreClientDouble {
	readResource(resource: SyncResource, lastSyncUserData: IUserData | null): Promise<IUserData>;
}

interface IUserDataSyncInitializerAccess {
	_userDataSyncStoreClientPromise: Promise<IStoreClientDouble | undefined>;
	createSyncResourceInitializer(syncResource: SyncResource): IUserDataSyncResourceInitializer;
	initialize(syncResources: SyncResource[]): Promise<void>;
	readonly initialized: SyncResource[];
	initializeExtensions(instantiationService: never): Promise<void>;
	initializeInstalledExtensions(instantiationService: never): Promise<void>;
	initializeNewExtensions(instantiationService: never): Promise<void>;
}

function already(resource: SyncResource): string {
	return `${getSyncAreaLabel(resource)} initialized already.`;
}

function initializedMessage(resource: SyncResource): string {
	return `Initialized ${getSyncAreaLabel(resource)}`;
}

function errorMessage(resource: SyncResource): string {
	return `Error while initializing ${getSyncAreaLabel(resource)}`;
}

function countMessage(log: CaptureLogService, message: string): number {
	return log.infos.filter(line => line === message).length;
}

function createSubject(): { access: IUserDataSyncInitializerAccess; log: CaptureLogService } {
	const log = new CaptureLogService();
	const initializer = new UserDataSyncInitializer(
		undefined as never,
		undefined as never,
		undefined as never,
		undefined as never,
		undefined as never,
		{ isNew: () => false } as never,
		undefined as never,
		undefined as never,
		log,
		undefined as never,
	);
	return { access: initializer as unknown as IUserDataSyncInitializerAccess, log };
}

suite('UserDataSyncInitializer', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('calls initializer again after a failure and skips only after success', async () => {
		const { access, log } = createSubject();
		const calls: SyncResource[] = [];
		let settingsFailed = false;
		access._userDataSyncStoreClientPromise = Promise.resolve({
			readResource: async () => ({ ref: '1', content: '{}' }),
		});
		access.createSyncResourceInitializer = (syncResource: SyncResource): IUserDataSyncResourceInitializer => ({
			initialize: async () => {
				calls.push(syncResource);
				if (syncResource === SyncResource.Settings && !settingsFailed) {
					settingsFailed = true;
					throw new Error('settings init failed');
				}
			},
		});

		const resources = [SyncResource.Settings, SyncResource.GlobalState];
		const callCount = (resource: SyncResource) => calls.filter(called => called === resource).length;

		await access.initialize(resources);
		assert.strictEqual(callCount(SyncResource.Settings), 1);
		assert.strictEqual(callCount(SyncResource.GlobalState), 1);
		assert.strictEqual(countMessage(log, already(SyncResource.Settings)), 0);
		assert.strictEqual(countMessage(log, already(SyncResource.GlobalState)), 0);
		assert.strictEqual(countMessage(log, errorMessage(SyncResource.Settings)), 1);
		assert.strictEqual(countMessage(log, errorMessage(SyncResource.GlobalState)), 0);
		assert.strictEqual(countMessage(log, initializedMessage(SyncResource.Settings)), 0);
		assert.strictEqual(countMessage(log, initializedMessage(SyncResource.GlobalState)), 1);
		assert.ok(log.errors.some(error => error instanceof Error && error.message === 'settings init failed'));

		await access.initialize(resources);
		assert.strictEqual(callCount(SyncResource.Settings), 2);
		assert.strictEqual(callCount(SyncResource.GlobalState), 1);
		assert.strictEqual(countMessage(log, already(SyncResource.Settings)), 0);
		assert.strictEqual(countMessage(log, already(SyncResource.GlobalState)), 1);
		assert.strictEqual(countMessage(log, initializedMessage(SyncResource.Settings)), 1);
		assert.strictEqual(countMessage(log, errorMessage(SyncResource.Settings)), 1);

		await access.initialize(resources);
		assert.strictEqual(callCount(SyncResource.Settings), 2);
		assert.strictEqual(callCount(SyncResource.GlobalState), 1);
		assert.strictEqual(countMessage(log, already(SyncResource.Settings)), 1);
		assert.strictEqual(countMessage(log, already(SyncResource.GlobalState)), 2);
	});

	test('does not mark a resource initialized when readResource fails', async () => {
		const { access, log } = createSubject();
		const reads: SyncResource[] = [];
		const inits: SyncResource[] = [];
		let failRead = true;
		access._userDataSyncStoreClientPromise = Promise.resolve({
			readResource: async (resource: SyncResource) => {
				reads.push(resource);
				if (failRead) {
					failRead = false;
					throw new Error('read failed');
				}
				return { ref: '1', content: '{}' };
			},
		});
		access.createSyncResourceInitializer = (syncResource: SyncResource): IUserDataSyncResourceInitializer => ({
			initialize: async () => {
				inits.push(syncResource);
			},
		});

		await access.initialize([SyncResource.Settings]);
		assert.deepStrictEqual(reads, [SyncResource.Settings]);
		assert.deepStrictEqual(inits, []);
		assert.strictEqual(countMessage(log, already(SyncResource.Settings)), 0);
		assert.strictEqual(countMessage(log, errorMessage(SyncResource.Settings)), 1);
		assert.strictEqual(countMessage(log, initializedMessage(SyncResource.Settings)), 0);
		assert.ok(log.errors.some(error => error instanceof Error && error.message === 'read failed'));

		await access.initialize([SyncResource.Settings]);
		assert.deepStrictEqual(reads, [SyncResource.Settings, SyncResource.Settings]);
		assert.deepStrictEqual(inits, [SyncResource.Settings]);
		assert.strictEqual(countMessage(log, already(SyncResource.Settings)), 0);
		assert.strictEqual(countMessage(log, initializedMessage(SyncResource.Settings)), 1);

		await access.initialize([SyncResource.Settings]);
		assert.deepStrictEqual(reads, [SyncResource.Settings, SyncResource.Settings]);
		assert.deepStrictEqual(inits, [SyncResource.Settings]);
		assert.strictEqual(countMessage(log, already(SyncResource.Settings)), 1);
	});

	test('does not record extensions when either extension initializer rejects', async () => {
		const installedFailure = new Error('installed extensions failed');
		const newFailure = new Error('new extensions failed');
		const failures: { installed?: Error; created?: Error }[] = [
			{ installed: installedFailure },
			{ created: newFailure },
		];

		for (const failure of failures) {
			const { access } = createSubject();
			access.initializeInstalledExtensions = async () => {
				if (failure.installed) {
					throw failure.installed;
				}
			};
			access.initializeNewExtensions = async () => {
				if (failure.created) {
					throw failure.created;
				}
			};

			const expected = failure.installed ?? failure.created;
			await assert.rejects(
				() => access.initializeExtensions(undefined as never),
				(error: unknown) => error === expected,
			);
			assert.deepStrictEqual(access.initialized, []);
		}
	});

	test('records extensions when both extension initializers succeed', async () => {
		const { access } = createSubject();
		const calls: string[] = [];
		access.initializeInstalledExtensions = async () => {
			calls.push('installed');
		};
		access.initializeNewExtensions = async () => {
			calls.push('new');
		};

		await access.initializeExtensions(undefined as never);
		assert.deepStrictEqual(calls, ['installed', 'new']);
		assert.deepStrictEqual(access.initialized, [SyncResource.Extensions]);
	});
});
