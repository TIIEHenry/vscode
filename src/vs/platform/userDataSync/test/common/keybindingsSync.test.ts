/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../files/common/files.js';
import { ILogService } from '../../../log/common/log.js';
import { IUserDataProfilesService } from '../../../userDataProfile/common/userDataProfile.js';
import { getKeybindingsContentFromSyncContent, KeybindingsInitializer, KeybindingsSynchroniser } from '../../common/keybindingsSync.js';
import { IUserDataSyncLogService, IUserDataSyncStoreService, SyncResource, UserDataSyncError, UserDataSyncErrorCode } from '../../common/userDataSync.js';
import { UserDataSyncClient, UserDataSyncTestServer } from './userDataSyncClient.js';

suite('KeybindingsSync', () => {

	const server = new UserDataSyncTestServer();
	let client: UserDataSyncClient;

	let testObject: KeybindingsSynchroniser;

	teardown(async () => {
		await client.instantiationService.get(IUserDataSyncStoreService).clear();
	});

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	setup(async () => {
		client = disposableStore.add(new UserDataSyncClient(server));
		await client.setUp(true);
		testObject = client.getSynchronizer(SyncResource.Keybindings) as KeybindingsSynchroniser;
	});


	test('when keybindings file does not exist', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;

		assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
		let manifest = await client.getLatestRef(SyncResource.Keybindings);
		server.reset();
		await testObject.sync(manifest);

		assert.deepStrictEqual(server.requests, []);
		assert.ok(!await fileService.exists(keybindingsResource));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.deepStrictEqual(lastSyncUserData!.ref, remoteUserData.ref);
		assert.deepStrictEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
		assert.strictEqual(lastSyncUserData!.syncData, null);

		manifest = await client.getLatestRef(SyncResource.Keybindings);
		server.reset();
		await testObject.sync(manifest);
		assert.deepStrictEqual(server.requests, []);

		manifest = await client.getLatestRef(SyncResource.Keybindings);
		server.reset();
		await testObject.sync(manifest);
		assert.deepStrictEqual(server.requests, []);
	});

	test('when keybindings file is empty and remote has no changes', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString(''));

		await testObject.sync(await client.getLatestRef(SyncResource.Keybindings));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(getKeybindingsContentFromSyncContent(lastSyncUserData!.syncData!.content, true, client.instantiationService.get(ILogService)), '[]');
		assert.strictEqual(getKeybindingsContentFromSyncContent(remoteUserData.syncData!.content, true, client.instantiationService.get(ILogService)), '[]');
		assert.strictEqual((await fileService.readFile(keybindingsResource)).value.toString(), '');
	});

	test('when keybindings file is empty and remote has changes', async () => {
		const client2 = disposableStore.add(new UserDataSyncClient(server));
		await client2.setUp(true);
		const content = JSON.stringify([
			{
				'key': 'shift+cmd+w',
				'command': 'workbench.action.closeAllEditors',
			}
		]);
		await client2.instantiationService.get(IFileService).writeFile(client2.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource, VSBuffer.fromString(content));
		await client2.sync();

		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString(''));

		await testObject.sync(await client.getLatestRef(SyncResource.Keybindings));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(getKeybindingsContentFromSyncContent(lastSyncUserData!.syncData!.content, true, client.instantiationService.get(ILogService)), content);
		assert.strictEqual(getKeybindingsContentFromSyncContent(remoteUserData.syncData!.content, true, client.instantiationService.get(ILogService)), content);
		assert.strictEqual((await fileService.readFile(keybindingsResource)).value.toString(), content);
	});

	test('when keybindings file is empty with comment and remote has no changes', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		const expectedContent = '// Empty Keybindings';
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString(expectedContent));

		await testObject.sync(await client.getLatestRef(SyncResource.Keybindings));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(getKeybindingsContentFromSyncContent(lastSyncUserData!.syncData!.content, true, client.instantiationService.get(ILogService)), expectedContent);
		assert.strictEqual(getKeybindingsContentFromSyncContent(remoteUserData.syncData!.content, true, client.instantiationService.get(ILogService)), expectedContent);
		assert.strictEqual((await fileService.readFile(keybindingsResource)).value.toString(), expectedContent);
	});

	test('when keybindings file is empty and remote has keybindings', async () => {
		const client2 = disposableStore.add(new UserDataSyncClient(server));
		await client2.setUp(true);
		const content = JSON.stringify([
			{
				'key': 'shift+cmd+w',
				'command': 'workbench.action.closeAllEditors',
			}
		]);
		await client2.instantiationService.get(IFileService).writeFile(client2.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource, VSBuffer.fromString(content));
		await client2.sync();

		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString('// Empty Keybindings'));

		await testObject.sync(await client.getLatestRef(SyncResource.Keybindings));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(getKeybindingsContentFromSyncContent(lastSyncUserData!.syncData!.content, true, client.instantiationService.get(ILogService)), content);
		assert.strictEqual(getKeybindingsContentFromSyncContent(remoteUserData.syncData!.content, true, client.instantiationService.get(ILogService)), content);
		assert.strictEqual((await fileService.readFile(keybindingsResource)).value.toString(), content);
	});

	test('when keybindings file is empty and remote has empty array', async () => {
		const client2 = disposableStore.add(new UserDataSyncClient(server));
		await client2.setUp(true);
		const content =
			`// Place your key bindings in this file to override the defaults
[
]`;
		await client2.instantiationService.get(IFileService).writeFile(client2.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource, VSBuffer.fromString(content));
		await client2.sync();

		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		const expectedLocalContent = '// Empty Keybindings';
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString(expectedLocalContent));

		await testObject.sync(await client.getLatestRef(SyncResource.Keybindings));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(getKeybindingsContentFromSyncContent(lastSyncUserData!.syncData!.content, true, client.instantiationService.get(ILogService)), content);
		assert.strictEqual(getKeybindingsContentFromSyncContent(remoteUserData.syncData!.content, true, client.instantiationService.get(ILogService)), content);
		assert.strictEqual((await fileService.readFile(keybindingsResource)).value.toString(), expectedLocalContent);
	});

	test('when keybindings file is created after first sync', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		await testObject.sync(await client.getLatestRef(SyncResource.Keybindings));
		await fileService.createFile(keybindingsResource, VSBuffer.fromString('[]'));

		let lastSyncUserData = await testObject.getLastSyncUserData();
		const manifest = await client.getLatestRef(SyncResource.Keybindings);
		server.reset();
		await testObject.sync(manifest);

		assert.deepStrictEqual(server.requests, [
			{ type: 'POST', url: `${server.url}/v1/resource/${testObject.resource}`, headers: { 'If-Match': lastSyncUserData?.ref } },
		]);

		lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.deepStrictEqual(lastSyncUserData!.ref, remoteUserData.ref);
		assert.deepStrictEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
		assert.strictEqual(getKeybindingsContentFromSyncContent(lastSyncUserData!.syncData!.content, true, client.instantiationService.get(ILogService)), '[]');
	});

	test('test apply remote when keybindings file does not exist', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		if (await fileService.exists(keybindingsResource)) {
			await fileService.del(keybindingsResource);
		}

		const preview = await testObject.sync(await client.getLatestRef(SyncResource.Keybindings), true);

		server.reset();
		const content = await testObject.resolveContent(preview!.resourcePreviews[0].remoteResource);
		await testObject.accept(preview!.resourcePreviews[0].remoteResource, content);
		await testObject.apply(false);
		assert.deepStrictEqual(server.requests, []);
	});

	test('sync throws invalid content error - content is an object', async () => {
		await client.instantiationService.get(IFileService).writeFile(client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource, VSBuffer.fromString('{}'));
		try {
			await testObject.sync(await client.getLatestRef(SyncResource.Keybindings));
			assert.fail('should fail with invalid content error');
		} catch (e) {
			assert.ok(e instanceof UserDataSyncError);
			assert.deepStrictEqual((<UserDataSyncError>e).code, UserDataSyncErrorCode.LocalInvalidContent);
		}
	});

	test('sync profile keybindings', async () => {
		const client2 = disposableStore.add(new UserDataSyncClient(server));
		await client2.setUp(true);
		const profile = await client2.instantiationService.get(IUserDataProfilesService).createNamedProfile('profile1');
		await client2.instantiationService.get(IFileService).writeFile(profile.keybindingsResource, VSBuffer.fromString(JSON.stringify([
			{
				'key': 'shift+cmd+w',
				'command': 'workbench.action.closeAllEditors',
			}
		])));
		await client2.sync();

		await client.sync();

		const syncedProfile = client.instantiationService.get(IUserDataProfilesService).profiles.find(p => p.id === profile.id)!;
		const content = (await client.instantiationService.get(IFileService).readFile(syncedProfile.keybindingsResource)).value.toString();
		assert.deepStrictEqual(JSON.parse(content), [
			{
				'key': 'shift+cmd+w',
				'command': 'workbench.action.closeAllEditors',
			}
		]);
	});

	test('hasLocalData throws when keybindings read fails with FILE_PERMISSION_DENIED or FILE_TOO_LARGE', async () => {
		for (const result of [FileOperationResult.FILE_PERMISSION_DENIED, FileOperationResult.FILE_TOO_LARGE]) {
			failKeybindingsRead(result);
			try {
				await testObject.hasLocalData();
				assert.fail(`should throw when keybindings cannot be read: ${result}`);
			} catch (e) {
				assert.ok(e instanceof FileOperationError);
				assert.strictEqual(e.fileOperationResult, result);
			}
		}
	});

	test('hasLocalData returns false when keybindings file is missing, empty, or not a non-empty array', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		if (await fileService.exists(keybindingsResource)) {
			await fileService.del(keybindingsResource);
		}

		assert.strictEqual(await testObject.hasLocalData(), false);

		await fileService.writeFile(keybindingsResource, VSBuffer.fromString(''));
		assert.strictEqual(await testObject.hasLocalData(), false);

		await fileService.writeFile(keybindingsResource, VSBuffer.fromString('[]'));
		assert.strictEqual(await testObject.hasLocalData(), false);

		await fileService.writeFile(keybindingsResource, VSBuffer.fromString('{}'));
		assert.strictEqual(await testObject.hasLocalData(), false);

		await fileService.writeFile(keybindingsResource, VSBuffer.fromString('// Empty Keybindings'));
		assert.strictEqual(await testObject.hasLocalData(), false);
	});

	test('hasLocalData returns true when keybindings file is a non-empty array', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString(JSON.stringify([
			{
				'key': 'shift+cmd+w',
				'command': 'workbench.action.closeAllEditors',
			}
		])));

		assert.strictEqual(await testObject.hasLocalData(), true);
	});

	test('hasLocalData returns true when keybindings parse throws a non-FileOperationError', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString('[]'));

		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = async (resource, options, token) => {
			if (resource.toString() !== keybindingsResource.toString()) {
				return originalReadFile(resource, options, token);
			}
			const content = await originalReadFile(resource, options, token);
			return {
				...content,
				value: {
					toString(): string {
						return new Proxy(Object.create(null), {
							get(_target, prop) {
								if (prop === 'length' || prop === 'charCodeAt') {
									throw new TypeError('keybindings parse failed');
								}
								return undefined;
							}
						}) as unknown as string;
					}
				} as typeof content.value
			};
		};

		assert.strictEqual(await testObject.hasLocalData(), true);
	});

	function failKeybindingsRead(result: FileOperationResult): void {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource.toString();
		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = (resource, options, token) => {
			if (resource.toString() === keybindingsResource) {
				return Promise.reject(new FileOperationError('keybindings read failed', result));
			}
			return originalReadFile(resource, options, token);
		};
	}

});

suite('KeybindingsInitializer', () => {

	const server = new UserDataSyncTestServer();
	let client: UserDataSyncClient;
	let testObject: KeybindingsInitializer;

	teardown(async () => {
		await client.instantiationService.get(IUserDataSyncStoreService).clear();
	});

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	setup(async () => {
		client = disposableStore.add(new UserDataSyncClient(server));
		await client.setUp(true);
		testObject = client.instantiationService.createInstance(KeybindingsInitializer);
	});

	test('skips initialization and does not overwrite when local keybindings are a non-empty array', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const profile = client.instantiationService.get(IUserDataProfilesService).defaultProfile;
		const keybindingsResource = profile.keybindingsResource;
		const settingsResource = profile.settingsResource;
		assert.notStrictEqual(keybindingsResource.toString(), settingsResource.toString());

		const localKeybindings = JSON.stringify([
			{
				'key': 'alt+a',
				'command': 'workbench.action.keepLocal',
			}
		]);
		const settingsContent = '{}';
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString(localKeybindings));
		await fileService.writeFile(settingsResource, VSBuffer.fromString(settingsContent));

		const reads = trackReads(fileService);
		try {
			await testObject.initialize(remoteKeybindingsUserData(JSON.stringify([
				{
					'key': 'shift+cmd+w',
					'command': 'workbench.action.closeAllEditors',
				}
			])));
		} finally {
			reads.restore();
		}

		assert.deepStrictEqual(reads.resources, [keybindingsResource.toString()]);
		assert.ok(!reads.resources.includes(settingsResource.toString()));
		assert.strictEqual((await fileService.readFile(keybindingsResource)).value.toString(), localKeybindings);
		assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), settingsContent);
	});

	test('writes keybindingsResource when the keybindings file is missing', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const profile = client.instantiationService.get(IUserDataProfilesService).defaultProfile;
		const keybindingsResource = profile.keybindingsResource;
		const settingsResource = profile.settingsResource;
		assert.notStrictEqual(keybindingsResource.toString(), settingsResource.toString());

		if (await fileService.exists(keybindingsResource)) {
			await fileService.del(keybindingsResource);
		}
		const settingsContent = JSON.stringify([
			{
				'key': 'ctrl+s',
				'command': 'settings.should.not.be.read',
			}
		]);
		await fileService.writeFile(settingsResource, VSBuffer.fromString(settingsContent));
		assert.strictEqual(await fileService.exists(keybindingsResource), false);

		const remoteContent = JSON.stringify([
			{
				'key': 'shift+cmd+w',
				'command': 'workbench.action.closeAllEditors',
			}
		]);
		const reads = trackReads(fileService);
		try {
			await testObject.initialize(remoteKeybindingsUserData(remoteContent));
		} finally {
			reads.restore();
		}

		assert.deepStrictEqual(reads.resources, [keybindingsResource.toString()]);
		assert.ok(!reads.resources.includes(settingsResource.toString()));
		assert.strictEqual((await fileService.readFile(keybindingsResource)).value.toString(), remoteContent);
		assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), settingsContent);
	});

	test('initialize surfaces the read error and does not write when keybindings read fails with FILE_PERMISSION_DENIED or FILE_TOO_LARGE', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		const remoteContent = JSON.stringify([
			{
				'key': 'shift+cmd+w',
				'command': 'workbench.action.closeAllEditors',
			}
		]);

		for (const result of [FileOperationResult.FILE_PERMISSION_DENIED, FileOperationResult.FILE_TOO_LARGE]) {
			if (await fileService.exists(keybindingsResource)) {
				await fileService.del(keybindingsResource);
			}
			const readError = failKeybindingsInitializerRead(fileService, keybindingsResource.toString(), result);
			const loggedErrors: unknown[] = [];
			const infos: unknown[] = [];
			captureInitializerLogs(loggedErrors, infos);
			let thrown: unknown;
			try {
				await testObject.initialize(remoteKeybindingsUserData(remoteContent));
			} catch (error) {
				thrown = error;
			}

			assert.strictEqual(await fileService.exists(keybindingsResource), false);
			assert.strictEqual(thrown, readError);
			assert.deepStrictEqual(loggedErrors, [readError]);
			assert.ok(!infos.includes('Skipping initializing keybindings because local keybindings exist.'));
		}
	});

	test('initialize skips writing when keybindings parse throws a non-FileOperationError', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const keybindingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.keybindingsResource;
		const localKeybindings = '[]';
		await fileService.writeFile(keybindingsResource, VSBuffer.fromString(localKeybindings));
		const restoreRead = stubKeybindingsParseFailure(fileService, keybindingsResource.toString());
		const loggedErrors: unknown[] = [];
		const infos: unknown[] = [];
		captureInitializerLogs(loggedErrors, infos);

		try {
			await testObject.initialize(remoteKeybindingsUserData(JSON.stringify([
				{
					'key': 'shift+cmd+w',
					'command': 'workbench.action.closeAllEditors',
				}
			])));
			assert.deepStrictEqual(loggedErrors, []);
			assert.ok(infos.includes('Skipping initializing keybindings because local keybindings exist.'));
		} finally {
			restoreRead();
		}

		assert.strictEqual((await fileService.readFile(keybindingsResource)).value.toString(), localKeybindings);
	});

	function remoteKeybindingsUserData(keybindingsContent: string) {
		return {
			ref: '1',
			content: JSON.stringify({
				version: 2,
				content: JSON.stringify({
					mac: keybindingsContent,
					linux: keybindingsContent,
					windows: keybindingsContent,
				}),
			}),
		};
	}

	function trackReads(fileService: IFileService): { resources: string[]; restore: () => void } {
		const resources: string[] = [];
		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = (resource, options, token) => {
			resources.push(resource.toString());
			return originalReadFile(resource, options, token);
		};
		return {
			resources,
			restore: () => {
				target.readFile = originalReadFile;
			},
		};
	}

	function failKeybindingsInitializerRead(fileService: IFileService, keybindingsResource: string, result: FileOperationResult): FileOperationError {
		const readError = new FileOperationError('keybindings read failed', result);
		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = (resource, options, token) => {
			if (resource.toString() === keybindingsResource) {
				return Promise.reject(readError);
			}
			return originalReadFile(resource, options, token);
		};
		return readError;
	}

	function stubKeybindingsParseFailure(fileService: IFileService, keybindingsResource: string): () => void {
		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = async (resource, options, token) => {
			if (resource.toString() !== keybindingsResource) {
				return originalReadFile(resource, options, token);
			}
			const content = await originalReadFile(resource, options, token);
			return {
				...content,
				value: {
					toString(): string {
						return new Proxy(Object.create(null), {
							get(_target, prop) {
								if (prop === 'length' || prop === 'charCodeAt') {
									throw new TypeError('keybindings parse failed');
								}
								return undefined;
							}
						}) as unknown as string;
					}
				} as typeof content.value
			};
		};
		return () => {
			target.readFile = originalReadFile;
		};
	}

	function captureInitializerLogs(loggedErrors: unknown[], infos: unknown[]): void {
		const logService = client.instantiationService.get(IUserDataSyncLogService);
		const originalError = logService.error.bind(logService);
		const originalInfo = logService.info.bind(logService);
		logService.error = (message: string | Error, ...args: unknown[]) => {
			loggedErrors.push(message);
			originalError(message, ...args);
		};
		logService.info = (message: string, ...args: unknown[]) => {
			infos.push(message);
			originalInfo(message, ...args);
		};
	}

});
