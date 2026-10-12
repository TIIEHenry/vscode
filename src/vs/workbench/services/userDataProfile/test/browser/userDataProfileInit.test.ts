/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { bufferToStream, VSBuffer } from '../../../../../base/common/buffer.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService, IFileStatWithMetadata } from '../../../../../platform/files/common/files.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { IStorageService } from '../../../../../platform/storage/common/storage.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IUserDataProfile } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { IBrowserWorkbenchEnvironmentService } from '../../../environment/browser/environmentService.js';
import { UserDataProfileInitializer } from '../../browser/userDataProfileInit.js';
import { IUserDataProfileService } from '../../common/userDataProfile.js';
import { IInstantiationService } from '../../../../../platform/instantiation/common/instantiation.js';
import { ExtensionsResourceInitializer } from '../../browser/extensionsResource.js';

function stub<T>(partial: Partial<T>): T {
	return partial as T;
}

const settingsDocument = '{"settings":"{}"}';

function profileResponse(statusCode: number, body: unknown) {
	const text = typeof body === 'string' ? body : JSON.stringify(body);
	return {
		res: { statusCode, headers: {} },
		stream: bufferToStream(VSBuffer.fromString(text)),
	};
}

function createTrackedInitializer(profile: { name: string; contents?: string | URI }, request: IRequestService['request']) {
	const info: string[] = [];
	const errors: Array<string | Error> = [];
	const warns: string[] = [];
	const written: Array<{ resource: string; text: string }> = [];
	const settingsResource = URI.file('/profile/settings.json');
	const keybindingsResource = URI.file('/profile/keybindings.json');
	const initializer = new UserDataProfileInitializer(
		stub<IBrowserWorkbenchEnvironmentService>({
			options: { profile } as IBrowserWorkbenchEnvironmentService['options'],
		}),
		stub<IFileService>({
			async writeFile(resource, content) {
				written.push({
					resource: resource.toString(),
					text: content instanceof VSBuffer ? content.toString() : '',
				});
				return writtenStat(resource);
			},
		}),
		stub<IUserDataProfileService>({
			currentProfile: { settingsResource, keybindingsResource } as IUserDataProfile,
		}),
		stub<IStorageService>({}),
		stub<ILogService>({
			trace() { },
			info(message: string) {
				info.push(message);
			},
			warn(message: string) {
				warns.push(message);
			},
			error(message: string | Error) {
				errors.push(message);
			},
		}),
		stub<IUriIdentityService>({}),
		stub<IRequestService>({ request }),
	);
	return { initializer, info, errors, warns, written, settingsResource, keybindingsResource };
}

function writtenStat(resource: URI): IFileStatWithMetadata {
	return {
		resource,
		name: 'settings.json',
		isFile: true,
		isDirectory: false,
		isSymbolicLink: false,
		mtime: 0,
		ctime: 0,
		etag: '',
		size: 0,
		readonly: false,
		locked: false,
		executable: false,
		children: undefined,
	};
}

suite('UserDataProfileInitializer', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('retries settings until initialize succeeds, then skips', async () => {
		const settingsResource = URI.file('/profile/settings.json');
		const settingsContent = '{"settings":"{}"}';
		const info: string[] = [];
		const errors: Array<string | Error> = [];
		let failuresLeft = 2;
		const writeError = new Error('settings write failed');
		let phaseAttempts: string[] = [];
		let phaseWritten: string[] = [];

		const fileService = stub<IFileService>({
			async writeFile(resource, content) {
				phaseAttempts.push(resource.toString());
				if (failuresLeft > 0) {
					failuresLeft--;
					throw writeError;
				}
				phaseWritten.push(content instanceof VSBuffer ? content.toString() : '');
				return writtenStat(resource);
			},
		});
		const logService = stub<ILogService>({
			trace() { },
			info(message: string) {
				info.push(message);
			},
			error(message: string | Error) {
				errors.push(message);
			},
		});
		const environmentService = stub<IBrowserWorkbenchEnvironmentService>({
			options: {
				profile: {
					name: 'test',
					contents: JSON.stringify({ settings: settingsContent }),
				},
			},
		});
		const userDataProfileService = stub<IUserDataProfileService>({
			currentProfile: { settingsResource } as IUserDataProfile,
		});
		const storageService = stub<IStorageService>({
			isNew() {
				throw new Error('initializeRequiredResources must not call requiresInitialization');
			},
		});
		const initializer = new UserDataProfileInitializer(
			environmentService,
			fileService,
			userDataProfileService,
			storageService,
			logService,
			stub<IUriIdentityService>({}),
			stub<IRequestService>({}),
		);

		const report: Array<{ info: string[]; errors: string[]; attempts: string[]; written: string[] }> = [];
		async function call(): Promise<void> {
			const infoStart = info.length;
			const errorStart = errors.length;
			phaseAttempts = [];
			phaseWritten = [];
			await initializer.initializeRequiredResources();
			report.push({
				info: info.slice(infoStart),
				errors: errors.slice(errorStart).map(error => error instanceof Error ? error.message : error),
				attempts: phaseAttempts.slice(),
				written: phaseWritten.slice(),
			});
		}

		await call();
		await call();
		await call();
		await call();

		const settingsUri = settingsResource.toString();
		assert.deepStrictEqual(report, [
			{
				info: ['UserDataProfileInitializer: Error while initializing settings'],
				errors: ['settings write failed'],
				attempts: [settingsUri],
				written: [],
			},
			{
				info: ['UserDataProfileInitializer: Error while initializing settings'],
				errors: ['settings write failed'],
				attempts: [settingsUri],
				written: [],
			},
			{
				info: ['UserDataProfileInitializer: Initialized settings'],
				errors: [],
				attempts: [settingsUri],
				written: ['{}'],
			},
			{
				info: ['UserDataProfileInitializer: settings initialized already.'],
				errors: [],
				attempts: [],
				written: [],
			},
		]);
	});

	test('retries installed extensions until initialize succeeds, then skips', async () => {
		const extensionsContent = '[{"identifier":{"id":"pub.ext"}}]';
		const info: string[] = [];
		const errors: Array<string | Error> = [];
		let failuresLeft = 2;
		const initError = new Error('extensions init failed');
		let phaseAttempts: string[] = [];
		let phaseCreated = 0;
		const returned: Array<Promise<void>> = [];

		const instantiationService = stub<IInstantiationService>({
			createInstance: ((ctor: unknown) => {
				assert.strictEqual(ctor, ExtensionsResourceInitializer);
				phaseCreated++;
				return {
					async initialize(content: string) {
						phaseAttempts.push(content);
						if (failuresLeft > 0) {
							failuresLeft--;
							throw initError;
						}
					},
				};
			}) as IInstantiationService['createInstance'],
		});
		const logService = stub<ILogService>({
			trace() { },
			info(message: string) {
				info.push(message);
			},
			error(message: string | Error) {
				errors.push(message);
			},
		});
		const environmentService = stub<IBrowserWorkbenchEnvironmentService>({
			options: {
				profile: {
					name: 'test',
					contents: JSON.stringify({ extensions: extensionsContent }),
				},
			},
		});
		const initializer = new UserDataProfileInitializer(
			environmentService,
			stub<IFileService>({}),
			stub<IUserDataProfileService>({}),
			stub<IStorageService>({}),
			logService,
			stub<IUriIdentityService>({}),
			stub<IRequestService>({}),
		);

		const report: Array<{ info: string[]; errors: string[]; attempts: string[]; created: number }> = [];
		async function call(): Promise<void> {
			const infoStart = info.length;
			const errorStart = errors.length;
			phaseAttempts = [];
			phaseCreated = 0;
			const promise = initializer.initializeInstalledExtensions(instantiationService);
			returned.push(promise);
			await promise;
			report.push({
				info: info.slice(infoStart),
				errors: errors.slice(errorStart).map(error => error instanceof Error ? error.message : error),
				attempts: phaseAttempts.slice(),
				created: phaseCreated,
			});
		}

		await call();
		await call();
		await call();
		await call();

		assert.notStrictEqual(returned[0], returned[1]);
		assert.notStrictEqual(returned[1], returned[2]);
		assert.notStrictEqual(returned[2], returned[3]);
		assert.deepStrictEqual(report, [
			{
				info: ['UserDataProfileInitializer: Error while initializing extensions'],
				errors: ['extensions init failed'],
				attempts: [extensionsContent],
				created: 1,
			},
			{
				info: ['UserDataProfileInitializer: Error while initializing extensions'],
				errors: ['extensions init failed'],
				attempts: [extensionsContent],
				created: 1,
			},
			{
				info: ['UserDataProfileInitializer: Initialized extensions'],
				errors: [],
				attempts: [extensionsContent],
				created: 1,
			},
			{
				info: ['UserDataProfileInitializer: extensions initialized already.'],
				errors: [],
				attempts: [],
				created: 1,
			},
		]);
	});

	test('shares one in-flight installed extensions attempt and retries after the swallowed failure', async () => {
		const extensionsContent = '[{"identifier":{"id":"pub.ext"}}]';
		const info: string[] = [];
		const errors: Array<string | Error> = [];
		let created = 0;
		let executed = 0;
		let release!: () => void;
		let started!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const startedPromise = new Promise<void>(resolve => { started = resolve; });
		const initError = new Error('extensions init failed');

		const instantiationService = stub<IInstantiationService>({
			createInstance: ((ctor: unknown) => {
				assert.strictEqual(ctor, ExtensionsResourceInitializer);
				created++;
				return {
					async initialize() {
						executed++;
						started();
						await gate;
						throw initError;
					},
				};
			}) as IInstantiationService['createInstance'],
		});
		const initializer = new UserDataProfileInitializer(
			stub<IBrowserWorkbenchEnvironmentService>({
				options: {
					profile: {
						name: 'test',
						contents: JSON.stringify({ extensions: extensionsContent }),
					},
				},
			}),
			stub<IFileService>({}),
			stub<IUserDataProfileService>({}),
			stub<IStorageService>({}),
			stub<ILogService>({
				trace() { },
				info(message: string) {
					info.push(message);
				},
				error(message: string | Error) {
					errors.push(message);
				},
			}),
			stub<IUriIdentityService>({}),
			stub<IRequestService>({}),
		);

		const first = initializer.initializeInstalledExtensions(instantiationService);
		const second = initializer.initializeInstalledExtensions(instantiationService);
		assert.strictEqual(first, second);
		await startedPromise;
		assert.strictEqual(created, 1);
		assert.strictEqual(executed, 1);
		release();
		await first;
		await second;
		assert.strictEqual(created, 1);
		assert.strictEqual(executed, 1);
		assert.deepStrictEqual(info, ['UserDataProfileInitializer: Error while initializing extensions']);
		assert.strictEqual(errors.length, 1);
		assert.strictEqual(errors[0], initError);

		await initializer.initializeInstalledExtensions(instantiationService);
		assert.strictEqual(created, 2);
		assert.strictEqual(executed, 2);
		assert.deepStrictEqual(info, [
			'UserDataProfileInitializer: Error while initializing extensions',
			'UserDataProfileInitializer: Error while initializing extensions',
		]);
	});

	test('caches the skip when the profile template has no extensions', async () => {
		let created = 0;
		const instantiationService = stub<IInstantiationService>({
			createInstance: (() => {
				created++;
				return { async initialize() { } };
			}) as IInstantiationService['createInstance'],
		});
		const initializer = new UserDataProfileInitializer(
			stub<IBrowserWorkbenchEnvironmentService>({
				options: {
					profile: {
						name: 'test',
						contents: JSON.stringify({ settings: '{"editor.fontSize":14}' }),
					},
				},
			}),
			stub<IFileService>({}),
			stub<IUserDataProfileService>({}),
			stub<IStorageService>({}),
			stub<ILogService>({
				trace() { },
				info() { },
				error() { },
			}),
			stub<IUriIdentityService>({}),
			stub<IRequestService>({}),
		);

		const first = initializer.initializeInstalledExtensions(instantiationService);
		const second = initializer.initializeInstalledExtensions(instantiationService);
		assert.strictEqual(first, second);
		await first;
		await second;
		const third = initializer.initializeInstalledExtensions(instantiationService);
		assert.strictEqual(third, first);
		await third;
		assert.strictEqual(created, 0);
	});

	test('does not cache a null template skip, then initializes extensions after a later read', async () => {
		const extensionsContent = '[{"identifier":{"id":"pub.ext"}}]';
		const profileUri = URI.parse('https://example.com/profile.json');
		let live = false;
		let requests = 0;
		let created = 0;
		const attempts: string[] = [];
		let release!: () => void;
		let started!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const startedPromise = new Promise<void>(resolve => { started = resolve; });
		const tracked = createTrackedInitializer({ name: 'test', contents: profileUri }, (async () => {
			requests++;
			if (!live) {
				started();
				await gate;
				return profileResponse(503, '');
			}
			return profileResponse(200, { extensions: extensionsContent });
		}) as IRequestService['request']);
		const instantiationService = stub<IInstantiationService>({
			createInstance: ((ctor: unknown) => {
				assert.strictEqual(ctor, ExtensionsResourceInitializer);
				created++;
				return {
					async initialize(content: string) {
						attempts.push(content);
					},
				};
			}) as IInstantiationService['createInstance'],
		});

		const first = tracked.initializer.initializeInstalledExtensions(instantiationService);
		const second = tracked.initializer.initializeInstalledExtensions(instantiationService);
		assert.strictEqual(first, second);
		await startedPromise;
		assert.strictEqual(requests, 1);
		assert.strictEqual(created, 0);
		release();
		await first;
		await second;
		assert.strictEqual(created, 0);
		assert.deepStrictEqual(attempts, []);

		live = true;
		const third = tracked.initializer.initializeInstalledExtensions(instantiationService);
		assert.notStrictEqual(third, first);
		await third;
		assert.strictEqual(requests, 2);
		assert.strictEqual(created, 1);
		assert.deepStrictEqual(attempts, [extensionsContent]);
		assert.deepStrictEqual(tracked.info, ['UserDataProfileInitializer: Initialized extensions']);
	});

	test('shares one in-flight profile template read, then keeps the template object', async () => {
		const profileUri = URI.parse('https://example.com/profile.json');
		const template = {
			settings: settingsDocument,
			keybindings: JSON.stringify({ platform: 'Linux', keybindings: '[]' }),
		};
		let requests = 0;
		let release!: () => void;
		let started!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const startedPromise = new Promise<void>(resolve => { started = resolve; });
		const tracked = createTrackedInitializer({ name: 'test', contents: profileUri }, (async () => {
			requests++;
			started();
			await gate;
			return profileResponse(200, template);
		}) as IRequestService['request']);
		const instantiationService = stub<IInstantiationService>({
			createInstance: (() => {
				throw new Error('extensions initializer should not be created');
			}) as IInstantiationService['createInstance'],
		});

		const required = tracked.initializer.initializeRequiredResources();
		const other = tracked.initializer.initializeOtherResources(instantiationService);
		await startedPromise;
		assert.strictEqual(requests, 1);
		release();
		await required;
		await other;
		assert.strictEqual(requests, 1);
		assert.deepStrictEqual(tracked.written, [
			{ resource: tracked.settingsResource.toString(), text: '{}' },
			{ resource: tracked.keybindingsResource.toString(), text: '[]' },
		]);
		assert.deepStrictEqual(tracked.info, [
			'UserDataProfileInitializer: Initialized settings',
			'UserDataProfileInitializer: Initialized keybindings',
		]);

		await tracked.initializer.initializeRequiredResources();
		await tracked.initializer.initializeOtherResources(instantiationService);
		assert.strictEqual(requests, 1);
		assert.strictEqual(tracked.written.length, 2);
		assert.deepStrictEqual(tracked.info, [
			'UserDataProfileInitializer: Initialized settings',
			'UserDataProfileInitializer: Initialized keybindings',
			'UserDataProfileInitializer: settings initialized already.',
			'UserDataProfileInitializer: keybindings initialized already.',
		]);
	});

	test('keeps null when the profile has no contents', async () => {
		let storedContents: string | undefined;
		let contentReads = 0;
		const profile = {
			name: 'test',
			get contents() {
				contentReads++;
				return storedContents;
			},
		};
		const tracked = createTrackedInitializer(profile, (async () => {
			throw new Error('profile template should not be requested');
		}) as IRequestService['request']);

		await tracked.initializer.initializeRequiredResources();
		const readsAfterFirst = contentReads;
		assert.ok(readsAfterFirst > 0);
		await tracked.initializer.initializeRequiredResources();
		assert.strictEqual(contentReads, readsAfterFirst);

		storedContents = JSON.stringify({ settings: settingsDocument });
		await tracked.initializer.initializeRequiredResources();
		assert.strictEqual(contentReads, readsAfterFirst);
		assert.deepStrictEqual(tracked.written, []);
		assert.deepStrictEqual(tracked.info, []);
		assert.deepStrictEqual(tracked.errors, []);
	});

	test('reads again after profile JSON fails to parse, then initializes settings', async () => {
		const profile = { name: 'test', contents: '{' };
		const tracked = createTrackedInitializer(profile, (async () => {
			throw new Error('profile template should not be requested');
		}) as IRequestService['request']);

		await tracked.initializer.initializeRequiredResources();
		assert.deepStrictEqual(tracked.written, []);
		assert.deepStrictEqual(tracked.info, []);
		assert.strictEqual(tracked.errors.length, 1);
		assert.ok(tracked.errors[0] instanceof Error);

		profile.contents = JSON.stringify({ settings: settingsDocument });
		await tracked.initializer.initializeRequiredResources();
		assert.strictEqual(tracked.errors.length, 1);
		assert.deepStrictEqual(tracked.written, [{
			resource: tracked.settingsResource.toString(),
			text: '{}',
		}]);
		assert.deepStrictEqual(tracked.info, ['UserDataProfileInitializer: Initialized settings']);
	});

	test('reads again when profile JSON is not a template object, then initializes settings', async () => {
		const profile = { name: 'test', contents: '{"settings":1}' };
		const tracked = createTrackedInitializer(profile, (async () => {
			throw new Error('profile template should not be requested');
		}) as IRequestService['request']);

		await tracked.initializer.initializeRequiredResources();
		assert.deepStrictEqual(tracked.written, []);
		assert.deepStrictEqual(tracked.info, []);
		assert.deepStrictEqual(tracked.errors, []);

		profile.contents = JSON.stringify({ settings: settingsDocument });
		await tracked.initializer.initializeRequiredResources();
		assert.deepStrictEqual(tracked.written, [{
			resource: tracked.settingsResource.toString(),
			text: '{}',
		}]);
		assert.deepStrictEqual(tracked.info, ['UserDataProfileInitializer: Initialized settings']);
	});

	test('shares one in-flight failed profile request, then initializes settings on the next read', async () => {
		const requestError = new Error('profile request failed');
		let requests = 0;
		let release!: () => void;
		let started!: () => void;
		const gate = new Promise<void>(resolve => { release = resolve; });
		const startedPromise = new Promise<void>(resolve => { started = resolve; });
		const tracked = createTrackedInitializer({
			name: 'test',
			contents: URI.parse('https://example.com/profile.json'),
		}, (async () => {
			requests++;
			started();
			await gate;
			if (requests === 1) {
				throw requestError;
			}
			return profileResponse(200, { settings: settingsDocument });
		}) as IRequestService['request']);

		const first = tracked.initializer.initializeRequiredResources();
		const second = tracked.initializer.initializeRequiredResources();
		await startedPromise;
		assert.strictEqual(requests, 1);
		release();
		await first;
		await second;
		assert.strictEqual(requests, 1);
		assert.deepStrictEqual(tracked.written, []);
		assert.deepStrictEqual(tracked.info, []);
		assert.deepStrictEqual(tracked.errors, [requestError]);

		await tracked.initializer.initializeRequiredResources();
		assert.strictEqual(requests, 2);
		assert.deepStrictEqual(tracked.written, [{
			resource: tracked.settingsResource.toString(),
			text: '{}',
		}]);
		assert.deepStrictEqual(tracked.info, ['UserDataProfileInitializer: Initialized settings']);
	});

	test('reads again after a non-200 profile response, then initializes settings', async () => {
		const profileUri = URI.parse('https://example.com/profile.json');
		let live = false;
		let requests = 0;
		const tracked = createTrackedInitializer({ name: 'test', contents: profileUri }, (async () => {
			requests++;
			if (!live) {
				return profileResponse(503, '');
			}
			return profileResponse(200, { settings: settingsDocument });
		}) as IRequestService['request']);

		await tracked.initializer.initializeRequiredResources();
		assert.strictEqual(requests, 1);
		assert.deepStrictEqual(tracked.written, []);
		assert.deepStrictEqual(tracked.info, []);
		assert.deepStrictEqual(tracked.errors, []);
		assert.deepStrictEqual(tracked.warns, [
			`UserDataProfileInitializer: Failed to get profile from URL: ${profileUri.toString(true)}. Status code: 503.`,
		]);

		live = true;
		await tracked.initializer.initializeRequiredResources();
		assert.strictEqual(requests, 2);
		assert.deepStrictEqual(tracked.written, [{
			resource: tracked.settingsResource.toString(),
			text: '{}',
		}]);
		assert.deepStrictEqual(tracked.info, ['UserDataProfileInitializer: Initialized settings']);
	});

	test('reads again when a 200 profile response has no template object, then initializes settings', async () => {
		const bodies: unknown[] = [null, { settings: 1 }, { settings: settingsDocument }];
		let requests = 0;
		const tracked = createTrackedInitializer({
			name: 'test',
			contents: URI.parse('https://example.com/profile.json'),
		}, (async () => {
			return profileResponse(200, bodies[requests++]);
		}) as IRequestService['request']);

		await tracked.initializer.initializeRequiredResources();
		await tracked.initializer.initializeRequiredResources();
		assert.strictEqual(requests, 2);
		assert.deepStrictEqual(tracked.written, []);
		assert.deepStrictEqual(tracked.info, []);
		assert.deepStrictEqual(tracked.errors, []);

		await tracked.initializer.initializeRequiredResources();
		assert.strictEqual(requests, 3);
		assert.deepStrictEqual(tracked.written, [{
			resource: tracked.settingsResource.toString(),
			text: '{}',
		}]);
		assert.deepStrictEqual(tracked.info, ['UserDataProfileInitializer: Initialized settings']);
	});

	test('initializeOtherResources reads again after a failed template fetch and initializes keybindings', async () => {
		const profileUri = URI.parse('https://example.com/profile.json');
		let live = false;
		let requests = 0;
		const tracked = createTrackedInitializer({ name: 'test', contents: profileUri }, (async () => {
			requests++;
			if (!live) {
				return profileResponse(503, '');
			}
			return profileResponse(200, {
				keybindings: JSON.stringify({ platform: 'Linux', keybindings: '[]' }),
			});
		}) as IRequestService['request']);
		const instantiationService = stub<IInstantiationService>({
			createInstance: (() => {
				throw new Error('extensions initializer should not be created');
			}) as IInstantiationService['createInstance'],
		});

		await tracked.initializer.initializeOtherResources(instantiationService);
		assert.strictEqual(requests, 2);
		assert.deepStrictEqual(tracked.written, []);
		assert.deepStrictEqual(tracked.info, []);
		assert.deepStrictEqual(tracked.warns, [
			`UserDataProfileInitializer: Failed to get profile from URL: ${profileUri.toString(true)}. Status code: 503.`,
			`UserDataProfileInitializer: Failed to get profile from URL: ${profileUri.toString(true)}. Status code: 503.`,
		]);

		live = true;
		await tracked.initializer.initializeOtherResources(instantiationService);
		assert.strictEqual(requests, 3);
		assert.deepStrictEqual(tracked.written, [{
			resource: tracked.keybindingsResource.toString(),
			text: '[]',
		}]);
		assert.deepStrictEqual(tracked.info, ['UserDataProfileInitializer: Initialized keybindings']);
	});
});
