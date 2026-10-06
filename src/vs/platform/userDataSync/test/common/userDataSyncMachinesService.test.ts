/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { getServiceMachineId } from '../../../externalServices/common/serviceMachineId.js';
import { IEnvironmentService } from '../../../environment/common/environment.js';
import { IFileService } from '../../../files/common/files.js';
import { IStorageService } from '../../../storage/common/storage.js';
import { IUserData, IUserDataSyncStoreService } from '../../common/userDataSync.js';
import { UserDataSyncMachinesService } from '../../common/userDataSyncMachines.js';
import { UserDataSyncClient } from './userDataSyncClient.js';

suite('UserDataSyncMachinesService', () => {

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	function createMachinesService(
		client: UserDataSyncClient,
		options: {
			initialUserData: IUserData;
			writeResource?: IUserDataSyncStoreService['writeResource'];
		},
	): UserDataSyncMachinesService {
		let userData = options.initialUserData;
		let writeCount = 0;
		const writeResource = options.writeResource ?? (async (_resource, content) => {
			writeCount++;
			userData = { ref: `${writeCount}`, content };
			return userData.ref;
		});

		client.instantiationService.stub(IUserDataSyncStoreService, {
			_serviceBrand: undefined,
			readResource: async () => userData,
			writeResource: async (resource, content, ref) => writeResource(resource, content, ref),
		} as IUserDataSyncStoreService);

		return disposableStore.add(client.instantiationService.createInstance(UserDataSyncMachinesService));
	}

	test('getMachines returns empty list when content is null without writing', async () => {
		const client = disposableStore.add(new UserDataSyncClient());
		await client.setUp(true);

		let writeCount = 0;
		const service = createMachinesService(client, {
			initialUserData: { ref: '0', content: null },
			writeResource: async () => {
				writeCount++;
				return '1';
			},
		});

		const machines = await service.getMachines();

		assert.deepStrictEqual(machines, []);
		assert.strictEqual(writeCount, 0);
	});

	test('rejects reads and mutations when machines JSON is malformed', async () => {
		const client = disposableStore.add(new UserDataSyncClient());
		await client.setUp(true);

		const validContent = JSON.stringify({ version: 1, machines: [{ id: 'machine-a', name: 'A' }] });
		let userData: IUserData = { ref: '1', content: validContent };
		let writeCount = 0;

		client.instantiationService.stub(IUserDataSyncStoreService, {
			_serviceBrand: undefined,
			readResource: async () => userData,
			writeResource: async (_resource, content) => {
				writeCount++;
				userData = { ref: `${writeCount}`, content };
				return userData.ref;
			},
		} as IUserDataSyncStoreService);

		const service = disposableStore.add(client.instantiationService.createInstance(UserDataSyncMachinesService));
		await service.getMachines();

		userData = { ref: '2', content: '{ invalid json' };

		await assert.rejects(() => service.getMachines());
		await assert.rejects(() => service.addCurrentMachine());
		await assert.rejects(() => service.setEnablements([['machine-a', true]]));
		assert.strictEqual(writeCount, 0);
	});
});

suite('UserDataSyncMachinesService writeMachinesGeneration', () => {

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	async function createServiceWithMachine(writeResource: IUserDataSyncStoreService['writeResource']): Promise<{ service: UserDataSyncMachinesService; machineId: string }> {
		const client = disposableStore.add(new UserDataSyncClient());
		await client.setUp(true);

		const environmentService = client.instantiationService.get(IEnvironmentService);
		const fileService = client.instantiationService.get(IFileService);
		const storageService = client.instantiationService.get(IStorageService);
		const machineId = await getServiceMachineId(environmentService, fileService, storageService);

		const validContent = JSON.stringify({
			version: 1,
			machines: [{ id: machineId, name: 'Test machine' }]
		});

		let userData: IUserData = { ref: '1', content: validContent };

		client.instantiationService.stub(IUserDataSyncStoreService, {
			_serviceBrand: undefined,
			readResource: async () => userData,
			writeResource: async (resource, content, ref) => {
				const refOut = await writeResource(resource, content, ref);
				userData = { ref: refOut, content };
				return refOut;
			},
		} as IUserDataSyncStoreService);

		const service = disposableStore.add(client.instantiationService.createInstance(UserDataSyncMachinesService));
		await service.getMachines();

		return { service, machineId };
	}

	test('coalesces overlapping writes queued before the first upload starts', async () => {
		const writeBodies: string[] = [];
		const { service, machineId } = await createServiceWithMachine(async (_resource, content) => {
			writeBodies.push(content);
			return 'etag-1';
		});

		await Promise.all([
			service.setEnablements([[machineId, false]]),
			service.setEnablements([[machineId, true]]),
		]);

		assert.strictEqual(writeBodies.length, 1);
		const parsed = JSON.parse(writeBodies[0]);
		assert.strictEqual(parsed.machines[0].disabled, undefined);
	});

	test('serializes writes so the second upload uses the first etag', async () => {
		let releaseFirst!: (ref: string) => void;
		const firstWrite = new Promise<string>(resolve => { releaseFirst = resolve; });
		const writeCalls: { content: string; ref: string | null }[] = [];
		let call = 0;

		const { service, machineId } = await createServiceWithMachine(async (_resource, content, ref) => {
			writeCalls.push({ content, ref });
			call++;
			if (call === 1) {
				return await firstWrite;
			}
			return 'etag-2';
		});

		const first = service.setEnablements([[machineId, false]]);
		const second = service.setEnablements([[machineId, true]]);

		await new Promise(resolve => setTimeout(resolve, 0));
		assert.strictEqual(writeCalls.length, 1);
		releaseFirst('etag-1');

		await Promise.all([first, second]);

		assert.strictEqual(writeCalls.length, 2);
		assert.strictEqual(writeCalls[0].ref, '1');
		assert.strictEqual(writeCalls[1].ref, 'etag-1');
		assert.strictEqual(JSON.parse(writeCalls[1].content).machines[0].disabled, undefined);
	});
});
