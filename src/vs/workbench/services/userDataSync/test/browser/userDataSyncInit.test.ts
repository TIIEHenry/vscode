/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
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
	getExtensionsPreviewInitializer(instantiationService: never): Promise<{ getPreview(): Promise<unknown> } | null>;
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

	test('caches a missing extensions client and does not read again', async () => {
		const { access } = createSubject();
		let creates = 0;
		access._userDataSyncStoreClientPromise = Promise.resolve(undefined);
		const instantiationService = {
			createInstance: () => {
				creates++;
				return {};
			},
		};

		const first = access.getExtensionsPreviewInitializer(instantiationService as never);
		const second = access.getExtensionsPreviewInitializer(instantiationService as never);
		assert.strictEqual(second, first);
		assert.strictEqual(await first, null);
		assert.strictEqual(creates, 0);

		const third = access.getExtensionsPreviewInitializer(instantiationService as never);
		assert.strictEqual(third, first);
		assert.strictEqual(creates, 0);
	});

	test('shares one in-flight extensions read, retries after readResource rejects, and caches success', async () => {
		const { access, log } = createSubject();
		const attempt = bindExtensionsAttempt(access, log);
		let rejectRead: ((error: Error) => void) | undefined;
		let releaseRead: ((data: IUserData) => void) | undefined;
		let failRead = true;
		attempt.setRead(() => {
			if (failRead) {
				return new Promise<IUserData>((_resolve, reject) => {
					rejectRead = reject;
				});
			}
			return new Promise<IUserData>(resolve => {
				releaseRead = resolve;
			});
		});
		const service = attempt.instantiationService as never;
		const failure = new Error('extensions read failed');

		const first = access.getExtensionsPreviewInitializer(service);
		const second = access.getExtensionsPreviewInitializer(service);
		assert.strictEqual(second, first);
		await until(() => attempt.reads.length === 1, 'extensions read did not start');
		assert.strictEqual(attempt.reads.length, 1);
		assert.deepStrictEqual(attempt.created, []);
		rejectRead!(failure);

		await assert.rejects(() => first, (error: unknown) => error === failure);
		await assert.rejects(() => second, (error: unknown) => error === failure);
		assert.deepStrictEqual(attempt.created, []);

		failRead = false;
		const retried = access.getExtensionsPreviewInitializer(service);
		assert.notStrictEqual(retried, first);
		const sharedRetry = access.getExtensionsPreviewInitializer(service);
		assert.strictEqual(sharedRetry, retried);
		await until(() => attempt.reads.length === 2, 'extensions read did not retry');
		releaseRead!(extensionsUserData());
		const initializer = await retried;
		assert.strictEqual(await sharedRetry, initializer);
		assert.ok(initializer);
		assert.deepStrictEqual(attempt.reads, [SyncResource.Extensions, SyncResource.Extensions]);
		assert.deepStrictEqual(attempt.created, ['ExtensionsPreviewInitializer']);

		const cached = access.getExtensionsPreviewInitializer(service);
		assert.strictEqual(cached, retried);
		assert.strictEqual(await cached, initializer);
		assert.strictEqual(attempt.reads.length, 2);
		assert.deepStrictEqual(attempt.created, ['ExtensionsPreviewInitializer']);
	});

	test('retries installed extensions after a later failure without reading or previewing again', async () => {
		const { access, log } = createSubject();
		const attempt = bindExtensionsAttempt(access, log);
		let failInstalled = true;
		attempt.setInstalledInitialize(async preview => {
			await preview.getPreview();
			if (failInstalled) {
				failInstalled = false;
				throw new Error('installed init failed');
			}
		});
		const service = attempt.instantiationService as never;

		await assert.rejects(
			() => access.initializeInstalledExtensions(service),
			(error: unknown) => error instanceof Error && error.message === 'installed init failed',
		);
		assert.deepStrictEqual(attempt.reads, [SyncResource.Extensions]);
		assert.strictEqual(attempt.installedCalls, 1);
		assert.deepStrictEqual(attempt.created, ['ExtensionsPreviewInitializer', 'InstalledExtensionsInitializer']);
		assert.deepStrictEqual(access.initialized, []);

		await access.initializeInstalledExtensions(service);
		assert.deepStrictEqual(attempt.reads, [SyncResource.Extensions]);
		assert.strictEqual(attempt.installedCalls, 1);
		assert.deepStrictEqual(attempt.created, ['ExtensionsPreviewInitializer', 'InstalledExtensionsInitializer', 'InstalledExtensionsInitializer']);

		const cached = access.initializeInstalledExtensions(service);
		await cached;
		assert.strictEqual(attempt.installedCalls, 1);
		assert.strictEqual(attempt.reads.length, 1);
		assert.strictEqual(attempt.created.filter(name => name === 'InstalledExtensionsInitializer').length, 2);
	});

	test('shares one in-flight preview, retries it after rejection, and caches it for both extension initializers', async () => {
		const { access, log } = createSubject();
		const attempt = bindExtensionsAttempt(access, log);
		let rejectInstalled: ((error: Error) => void) | undefined;
		const held = new Promise<unknown[]>((_resolve, reject) => {
			rejectInstalled = reject;
		});
		let holdInstalled = true;
		attempt.setInstalled(() => {
			if (holdInstalled) {
				return held;
			}
			return Promise.resolve([]);
		});
		const seen: Promise<unknown>[] = [];
		const record = async (preview: { getPreview(): Promise<unknown> }) => {
			const previewPromise = preview.getPreview();
			seen.push(previewPromise);
			await previewPromise;
		};
		attempt.setInstalledInitialize(record);
		attempt.setNewInitialize(record);
		const service = attempt.instantiationService as never;
		const failure = new Error('getInstalled failed');

		const first = access.initializeInstalledExtensions(service);
		const second = access.initializeInstalledExtensions(service);
		assert.strictEqual(second, first);
		await until(() => attempt.installedCalls === 1, 'getInstalled did not start');
		assert.strictEqual(attempt.reads.length, 1);
		assert.strictEqual(seen.length, 1);
		rejectInstalled!(failure);

		await assert.rejects(() => first, (error: unknown) => error === failure);
		await assert.rejects(() => second, (error: unknown) => error === failure);
		assert.deepStrictEqual(access.initialized, []);

		holdInstalled = false;
		const installedAgain = access.initializeInstalledExtensions(service);
		const createdAgain = access.initializeNewExtensions(service);
		assert.notStrictEqual(installedAgain, first);
		await installedAgain;
		await createdAgain;
		assert.strictEqual(attempt.reads.length, 1);
		assert.strictEqual(attempt.installedCalls, 2);
		assert.strictEqual(seen.length, 3);
		assert.notStrictEqual(seen[1], seen[0]);
		assert.strictEqual(seen[2], seen[1]);
		assert.strictEqual(attempt.created.filter(name => name === 'ExtensionsPreviewInitializer').length, 1);
		assert.deepStrictEqual(access.initialized, []);

		await access.initializeExtensions(service);
		assert.deepStrictEqual(access.initialized, [SyncResource.Extensions]);
		assert.strictEqual(attempt.reads.length, 1);
		assert.strictEqual(attempt.installedCalls, 2);
		assert.strictEqual(seen.length, 3);
	});
});

function extensionsUserData(): IUserData {
	return { ref: 'ext-1', content: JSON.stringify({ version: 3, content: '[]' }) };
}

interface IPreviewHandle {
	getPreview(): Promise<unknown>;
}

interface IExtensionsAttempt {
	readonly reads: SyncResource[];
	readonly created: string[];
	readonly instantiationService: { createInstance(ctor: { name: string }, ...args: unknown[]): unknown };
	installedCalls: number;
	setRead(body: () => Promise<IUserData>): void;
	setInstalled(body: () => Promise<unknown[]>): void;
	setInstalledInitialize(body: (preview: IPreviewHandle) => Promise<void>): void;
	setNewInitialize(body: (preview: IPreviewHandle) => Promise<void>): void;
}

function bindExtensionsAttempt(access: IUserDataSyncInitializerAccess, log: CaptureLogService): IExtensionsAttempt {
	const reads: SyncResource[] = [];
	const created: string[] = [];
	const installed = { calls: 0 };
	let readBody: () => Promise<IUserData> = async () => extensionsUserData();
	let installedBody: () => Promise<unknown[]> = async () => [];
	let installedInitialize: (preview: IPreviewHandle) => Promise<void> = async preview => {
		await preview.getPreview();
	};
	let newInitialize: (preview: IPreviewHandle) => Promise<void> = async preview => {
		await preview.getPreview();
	};
	const uriIdentity = {
		extUri: {
			joinPath: (resource: URI, ...pathFragment: string[]) => URI.joinPath(resource, ...pathFragment),
		},
	};
	const instantiationService = {
		createInstance: (ctor: { name: string }, ...args: unknown[]) => {
			created.push(ctor.name);
			if (ctor.name === 'ExtensionsPreviewInitializer') {
				const PreviewCtor = ctor as unknown as new (...ctorArgs: unknown[]) => IPreviewHandle;
				return new PreviewCtor(
					args[0],
					{
						getInstalled: () => {
							installed.calls++;
							return installedBody();
						},
					},
					{ hasToNeverSyncExtension: () => false },
					{},
					{},
					{ userDataSyncHome: URI.file('/sync-home') },
					log,
					{},
					uriIdentity,
				);
			}
			const preview = args[0] as IPreviewHandle;
			if (ctor.name === 'InstalledExtensionsInitializer') {
				return { initialize: () => installedInitialize(preview) };
			}
			if (ctor.name === 'NewExtensionsInitializer') {
				return { initialize: () => newInitialize(preview) };
			}
			throw new Error(`Unexpected ${ctor.name}`);
		},
	};
	access._userDataSyncStoreClientPromise = Promise.resolve({
		readResource: async (resource: SyncResource) => {
			reads.push(resource);
			return readBody();
		},
	});
	return {
		reads,
		created,
		instantiationService,
		get installedCalls() { return installed.calls; },
		setRead(body) { readBody = body; },
		setInstalled(body) { installedBody = body; },
		setInstalledInitialize(body) { installedInitialize = body; },
		setNewInitialize(body) { newInitialize = body; },
	};
}

async function until(predicate: () => boolean, message: string): Promise<void> {
	for (let attempt = 0; attempt < 40; attempt++) {
		if (predicate()) {
			return;
		}
		await Promise.resolve();
	}
	assert.fail(message);
}
