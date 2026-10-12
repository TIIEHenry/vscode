/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { runWithFakedTimers } from '../../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../files/common/files.js';
import { ILogService } from '../../../log/common/log.js';
import { IUserDataProfilesService } from '../../../userDataProfile/common/userDataProfile.js';
import { getTasksContentFromSyncContent, TasksInitializer, TasksSynchroniser } from '../../common/tasksSync.js';
import { Change, IUserDataSyncLogService, IUserDataSyncStoreService, MergeState, SyncResource, SyncStatus } from '../../common/userDataSync.js';
import { UserDataSyncClient, UserDataSyncTestServer } from './userDataSyncClient.js';

suite('TasksSync', () => {

	const server = new UserDataSyncTestServer();
	let client: UserDataSyncClient;

	let testObject: TasksSynchroniser;

	teardown(async () => {
		await client.instantiationService.get(IUserDataSyncStoreService).clear();
	});

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	setup(async () => {
		client = disposableStore.add(new UserDataSyncClient(server));
		await client.setUp(true);
		testObject = client.getSynchronizer(SyncResource.Tasks) as TasksSynchroniser;
	});

	test('when tasks file does not exist', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;

			assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
			let manifest = await client.getLatestRef(SyncResource.Tasks);
			server.reset();
			await testObject.sync(manifest);

			assert.deepStrictEqual(server.requests, []);
			assert.ok(!await fileService.exists(tasksResource));

			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.deepStrictEqual(lastSyncUserData!.ref, remoteUserData.ref);
			assert.deepStrictEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
			assert.strictEqual(lastSyncUserData!.syncData, null);

			manifest = await client.getLatestRef(SyncResource.Tasks);
			server.reset();
			await testObject.sync(manifest);
			assert.deepStrictEqual(server.requests, []);

			manifest = await client.getLatestRef(SyncResource.Tasks);
			server.reset();
			await testObject.sync(manifest);
			assert.deepStrictEqual(server.requests, []);
		});
	});

	test('when tasks file does not exist and remote has changes', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			await client2.instantiationService.get(IFileService).writeFile(tasksResource2, VSBuffer.fromString(content));
			await client2.sync();

			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;

			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
		});
	});

	test('when tasks file exists locally and remote has no tasks', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			fileService.writeFile(tasksResource, VSBuffer.fromString(content));

			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
		});
	});

	test('first time sync: when tasks file exists locally with same content as remote', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			await client2.instantiationService.get(IFileService).writeFile(tasksResource2, VSBuffer.fromString(content));
			await client2.sync();

			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			await fileService.writeFile(tasksResource, VSBuffer.fromString(content));

			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
		});
	});

	test('when tasks file locally has moved forward', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			fileService.writeFile(tasksResource, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': []
			})));

			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			fileService.writeFile(tasksResource, VSBuffer.fromString(content));

			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
		});
	});

	test('when tasks file remotely has moved forward', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			const fileService2 = client2.instantiationService.get(IFileService);
			await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': []
			})));

			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;

			await client2.sync();
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			fileService2.writeFile(tasksResource2, VSBuffer.fromString(content));

			await client2.sync();
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
		});
	});

	test('when tasks file has moved forward locally and remotely with same changes', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			const fileService2 = client2.instantiationService.get(IFileService);
			await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': []
			})));

			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;

			await client2.sync();
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			fileService2.writeFile(tasksResource2, VSBuffer.fromString(content));
			await client2.sync();

			fileService.writeFile(tasksResource, VSBuffer.fromString(content));
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
		});
	});

	test('when tasks file has moved forward locally and remotely - accept preview', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			const fileService2 = client2.instantiationService.get(IFileService);
			await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': []
			})));

			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;

			await client2.sync();
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
				}]
			})));
			await client2.sync();

			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			fileService.writeFile(tasksResource, VSBuffer.fromString(content));
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			const previewContent = (await fileService.readFile(testObject.conflicts.conflicts[0].previewResource)).value.toString();
			assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
			assert.deepStrictEqual(testObject.conflicts.conflicts.length, 1);
			assert.deepStrictEqual(testObject.conflicts.conflicts[0].mergeState, MergeState.Conflict);
			assert.deepStrictEqual(testObject.conflicts.conflicts[0].localChange, Change.Modified);
			assert.deepStrictEqual(testObject.conflicts.conflicts[0].remoteChange, Change.Modified);

			await testObject.accept(testObject.conflicts.conflicts[0].previewResource);
			await testObject.apply(false);
			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), previewContent);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), previewContent);
			assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), previewContent);
		});
	});

	test('when tasks file has moved forward locally and remotely - accept modified preview', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			const fileService2 = client2.instantiationService.get(IFileService);
			await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': []
			})));

			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;

			await client2.sync();
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
				}]
			})));
			await client2.sync();

			fileService.writeFile(tasksResource, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			})));
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch 2'
				}]
			});
			await testObject.accept(testObject.conflicts.conflicts[0].previewResource, content);
			await testObject.apply(false);
			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
		});
	});

	test('when tasks file has moved forward locally and remotely - accept remote', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			const fileService2 = client2.instantiationService.get(IFileService);
			await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': []
			})));

			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;

			await client2.sync();
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
				}]
			});
			fileService2.writeFile(tasksResource2, VSBuffer.fromString(content));
			await client2.sync();

			fileService.writeFile(tasksResource, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			})));
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));
			assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);

			await testObject.accept(testObject.conflicts.conflicts[0].remoteResource);
			await testObject.apply(false);
			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
		});
	});

	test('when tasks file has moved forward locally and remotely - accept local', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			const fileService2 = client2.instantiationService.get(IFileService);
			await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': []
			})));

			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;

			await client2.sync();
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
				}]
			})));
			await client2.sync();

			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			fileService.writeFile(tasksResource, VSBuffer.fromString(content));
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));
			assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);

			await testObject.accept(testObject.conflicts.conflicts[0].localResource);
			await testObject.apply(false);
			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), content);
			assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
		});
	});

	test('when tasks file was removed in one client', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			await fileService.writeFile(tasksResource, VSBuffer.fromString(JSON.stringify({
				'version': '2.0.0',
				'tasks': []
			})));
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			await client2.sync();

			const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			const fileService2 = client2.instantiationService.get(IFileService);
			fileService2.del(tasksResource2);
			await client2.sync();

			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
			const lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), null);
			assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData!.content, client.instantiationService.get(ILogService)), null);
			assert.strictEqual(await fileService.exists(tasksResource), false);
		});
	});

	test('when tasks file is created after first sync', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			await testObject.sync(await client.getLatestRef(SyncResource.Tasks));

			const content = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			await fileService.createFile(tasksResource, VSBuffer.fromString(content));

			let lastSyncUserData = await testObject.getLastSyncUserData();
			const manifest = await client.getLatestRef(SyncResource.Tasks);
			server.reset();
			await testObject.sync(manifest);

			assert.deepStrictEqual(server.requests, [
				{ type: 'POST', url: `${server.url}/v1/resource/${testObject.resource}`, headers: { 'If-Match': lastSyncUserData?.ref } },
			]);

			lastSyncUserData = await testObject.getLastSyncUserData();
			const remoteUserData = await testObject.getRemoteUserData(null);
			assert.deepStrictEqual(lastSyncUserData!.ref, remoteUserData.ref);
			assert.deepStrictEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
			assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData!.syncData!.content, client.instantiationService.get(ILogService)), content);
		});
	});

	test('apply remote when tasks file does not exist', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const fileService = client.instantiationService.get(IFileService);
			const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
			if (await fileService.exists(tasksResource)) {
				await fileService.del(tasksResource);
			}

			const preview = (await testObject.sync(await client.getLatestRef(SyncResource.Tasks), true))!;

			server.reset();
			const content = await testObject.resolveContent(preview.resourcePreviews[0].remoteResource);
			await testObject.accept(preview.resourcePreviews[0].remoteResource, content);
			await testObject.apply(false);
			assert.deepStrictEqual(server.requests, []);
		});
	});

	test('sync profile tasks', async () => {
		await runWithFakedTimers<void>({}, async () => {
			const client2 = disposableStore.add(new UserDataSyncClient(server));
			await client2.setUp(true);
			const profile = await client2.instantiationService.get(IUserDataProfilesService).createNamedProfile('profile1');
			const expected = JSON.stringify({
				'version': '2.0.0',
				'tasks': [{
					'type': 'npm',
					'script': 'watch',
					'label': 'Watch'
				}]
			});
			await client2.instantiationService.get(IFileService).createFile(profile.tasksResource, VSBuffer.fromString(expected));
			await client2.sync();

			await client.sync();

			const syncedProfile = client.instantiationService.get(IUserDataProfilesService).profiles.find(p => p.id === profile.id)!;
			const actual = (await client.instantiationService.get(IFileService).readFile(syncedProfile.tasksResource)).value.toString();
			assert.strictEqual(actual, expected);
		});
	});

});

suite('TasksInitializer', () => {

	const server = new UserDataSyncTestServer();
	let client: UserDataSyncClient;
	let testObject: TasksInitializer;

	teardown(async () => {
		await client.instantiationService.get(IUserDataSyncStoreService).clear();
	});

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	setup(async () => {
		client = disposableStore.add(new UserDataSyncClient(server));
		await client.setUp(true);
		testObject = client.instantiationService.createInstance(TasksInitializer);
	});

	test('writes tasksResource when the tasks file is missing', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
		assert.strictEqual(await fileService.exists(tasksResource), false);

		const remoteContent = JSON.stringify({
			'version': '2.0.0',
			'tasks': [{
				'type': 'npm',
				'script': 'watch',
				'label': 'Watch'
			}]
		});
		await testObject.initialize(remoteTasksUserData(remoteContent));

		assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), remoteContent);
	});

	test('skips initialization and does not overwrite when local tasks exist', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
		const localContent = JSON.stringify({
			'version': '2.0.0',
			'tasks': [{
				'type': 'npm',
				'script': 'build',
				'label': 'Keep local'
			}]
		});
		await fileService.writeFile(tasksResource, VSBuffer.fromString(localContent));

		await testObject.initialize(remoteTasksUserData(JSON.stringify({
			'version': '2.0.0',
			'tasks': [{
				'type': 'npm',
				'script': 'watch',
				'label': 'Watch'
			}]
		})));

		assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), localContent);
	});

	test('does not overwrite a non-empty tasks file and writes when the file is empty', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
		const localContent = JSON.stringify({
			'version': '2.0.0',
			'tasks': [{
				'label': 'Keep'
			}]
		});
		const remoteContent = JSON.stringify({
			'version': '2.0.0',
			'tasks': [{
				'label': 'Remote'
			}]
		});
		await fileService.writeFile(tasksResource, VSBuffer.fromString(localContent));
		await testObject.initialize(remoteTasksUserData(remoteContent));
		assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), localContent);

		await fileService.writeFile(tasksResource, VSBuffer.fromString(''));
		await testObject.initialize(remoteTasksUserData(remoteContent));
		assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), remoteContent);

		await fileService.writeFile(tasksResource, VSBuffer.fromString(' \n\t '));
		const whitespaceRemote = `${remoteContent}\n`;
		await testObject.initialize(remoteTasksUserData(whitespaceRemote));
		assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), whitespaceRemote);
	});

	test('initialize surfaces the read error and does not write when tasks read fails with FILE_PERMISSION_DENIED or FILE_TOO_LARGE', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
		const remoteContent = JSON.stringify({
			'version': '2.0.0',
			'tasks': [{
				'type': 'npm',
				'script': 'watch',
				'label': 'Watch'
			}]
		});

		for (const result of [FileOperationResult.FILE_PERMISSION_DENIED, FileOperationResult.FILE_TOO_LARGE]) {
			if (await fileService.exists(tasksResource)) {
				await fileService.del(tasksResource);
			}
			const readError = failTasksInitializerRead(fileService, tasksResource.toString(), result);
			const loggedErrors: unknown[] = [];
			const infos: unknown[] = [];
			captureInitializerLogs(loggedErrors, infos);
			let thrown: unknown;
			try {
				await testObject.initialize(remoteTasksUserData(remoteContent));
			} catch (error) {
				thrown = error;
			}

			assert.strictEqual(await fileService.exists(tasksResource), false);
			assert.deepStrictEqual(thrown === undefined ? loggedErrors : [thrown], [readError]);
			assert.ok(!infos.includes('Skipping initializing tasks because local tasks exist.'));
		}
	});

	function remoteTasksUserData(tasksContent: string) {
		return {
			ref: '1',
			content: JSON.stringify({
				version: 1,
				content: JSON.stringify({ tasks: tasksContent }),
			}),
		};
	}

	function failTasksInitializerRead(fileService: IFileService, tasksResource: string, result: FileOperationResult): FileOperationError {
		const readError = new FileOperationError('tasks read failed', result);
		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = (resource, options, token) => {
			if (resource.toString() === tasksResource) {
				return Promise.reject(readError);
			}
			return originalReadFile(resource, options, token);
		};
		return readError;
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
