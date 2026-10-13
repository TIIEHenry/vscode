/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IFileService, IFileStatWithMetadata, IResolveFileOptions } from '../../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IUriIdentityService } from '../../../../../platform/uriIdentity/common/uriIdentity.js';
import { IUserDataProfile, IUserDataProfilesService } from '../../../../../platform/userDataProfile/common/userDataProfile.js';
import { ALL_SYNC_RESOURCES, ISyncResourceHandle, IUserDataAutoSyncService, IUserDataSyncResourceProviderService, IUserDataSyncService, SyncResource } from '../../../../../platform/userDataSync/common/userDataSync.js';
import { IUserDataSyncMachine, IUserDataSyncMachinesService } from '../../../../../platform/userDataSync/common/userDataSyncMachines.js';
import { ITreeItem } from '../../../../common/views.js';
import { IUserDataSyncWorkbenchService } from '../../../../services/userDataSync/common/userDataSync.js';
import { ExtractedUserDataSyncActivityViewDataProvider, LocalUserDataSyncActivityViewDataProvider, RemoteUserDataSyncActivityViewDataProvider } from '../../browser/userDataSyncViews.js';

const otherProfileId = 'other';

suite('User Data Sync Activity View', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	test('local activity view reads sync resource handles again after the first rejection when the same profile is expanded', async () => {
		let handleReads = 0;
		let notifications = 0;
		let rejectHandles = true;
		const instantiationService = createInstantiationService(disposables, () => { notifications++; });
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider({
			getLocalSyncResourceHandles: async (_syncResource, profile) => {
				handleReads++;
				assert.strictEqual(profile?.id, otherProfileId);
				if (rejectHandles) {
					throw new Error('local sync resource handles failed');
				}
				return [syncHandle(_syncResource)];
			},
		}));
		const provider = instantiationService.createInstance(LocalUserDataSyncActivityViewDataProvider);
		const profile = await profileItem(provider);

		await assert.rejects(() => provider.getChildren(profile));
		assert.strictEqual(handleReads, ALL_SYNC_RESOURCES.length);
		assert.strictEqual(notifications, 1);

		rejectHandles = false;
		const children = await provider.getChildren(profile);
		assert.strictEqual(handleReads, ALL_SYNC_RESOURCES.length * 2);
		assert.strictEqual(children.length, ALL_SYNC_RESOURCES.length);
		assert.strictEqual(notifications, 1);
	});

	test('local activity view shares one in-flight handle read when the same profile is expanded twice', async () => {
		let handleReads = 0;
		const gate = defer<void>();
		const instantiationService = createInstantiationService(disposables);
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider({
			getLocalSyncResourceHandles: async syncResource => {
				handleReads++;
				await gate.promise;
				return [syncHandle(syncResource)];
			},
		}));
		const provider = instantiationService.createInstance(LocalUserDataSyncActivityViewDataProvider);
		const profile = await profileItem(provider);

		const first = provider.getChildren(profile);
		const second = provider.getChildren(profile);
		assert.strictEqual(handleReads, ALL_SYNC_RESOURCES.length);

		gate.resolve();
		const [firstChildren, secondChildren] = await Promise.all([first, second]);
		assert.strictEqual(handleReads, ALL_SYNC_RESOURCES.length);
		assert.strictEqual(firstChildren.length, ALL_SYNC_RESOURCES.length);
		assert.strictEqual(secondChildren.length, ALL_SYNC_RESOURCES.length);
	});

	test('local activity view keeps a successful handle read until the next root refresh', async () => {
		let handleReads = 0;
		const instantiationService = createInstantiationService(disposables);
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider({
			getLocalSyncResourceHandles: async syncResource => {
				handleReads++;
				return [syncHandle(syncResource)];
			},
		}));
		const provider = instantiationService.createInstance(LocalUserDataSyncActivityViewDataProvider);
		const profile = await profileItem(provider);

		const children = await provider.getChildren(profile);
		assert.strictEqual(children.length, ALL_SYNC_RESOURCES.length);
		assert.strictEqual(handleReads, ALL_SYNC_RESOURCES.length);

		await provider.getChildren(profile);
		assert.strictEqual(handleReads, ALL_SYNC_RESOURCES.length);

		await provider.getChildren();
		assert.strictEqual(handleReads, ALL_SYNC_RESOURCES.length);

		await provider.getChildren(profile);
		assert.strictEqual(handleReads, ALL_SYNC_RESOURCES.length * 2);
	});

	test('remote activity view reads machines again after the first rejection when the same sync resource is expanded', async () => {
		let machineReads = 0;
		let notifications = 0;
		let rejectMachines = true;
		const instantiationService = createInstantiationService(disposables, () => { notifications++; });
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider());
		instantiationService.stub(IUserDataSyncMachinesService, upcastPartial<IUserDataSyncMachinesService>({
			getMachines: async () => {
				machineReads++;
				if (rejectMachines) {
					throw new Error('machines failed');
				}
				return [deskMachine];
			},
		}));
		const provider = instantiationService.createInstance(RemoteUserDataSyncActivityViewDataProvider);
		const syncResource = await firstSyncResource(provider);

		await assert.rejects(() => provider.getChildren(syncResource));
		assert.strictEqual(machineReads, 1);
		assert.strictEqual(notifications, 1);

		rejectMachines = false;
		const children = await provider.getChildren(syncResource);
		assert.strictEqual(machineReads, 2);
		assert.strictEqual(children[0].description, deskMachine.name);
		assert.strictEqual(notifications, 1);
	});

	test('remote activity view shares one in-flight machine read when the same sync resource is expanded twice', async () => {
		let machineReads = 0;
		let machineIdReads = 0;
		const gate = defer<IUserDataSyncMachine[]>();
		const instantiationService = createInstantiationService(disposables);
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider({
			getMachineId: async () => {
				machineIdReads++;
				return deskMachine.id;
			},
		}));
		instantiationService.stub(IUserDataSyncMachinesService, upcastPartial<IUserDataSyncMachinesService>({
			getMachines: () => {
				machineReads++;
				return gate.promise;
			},
		}));
		const provider = instantiationService.createInstance(RemoteUserDataSyncActivityViewDataProvider);
		const syncResource = await firstSyncResource(provider);

		const first = provider.getChildren(syncResource);
		const second = provider.getChildren(syncResource);
		await nextMacrotask();
		assert.strictEqual(machineIdReads, 2);
		assert.strictEqual(machineReads, 1);

		gate.resolve([deskMachine]);
		const [firstChildren, secondChildren] = await Promise.all([first, second]);
		assert.strictEqual(machineReads, 1);
		assert.strictEqual(firstChildren[0].description, deskMachine.name);
		assert.strictEqual(secondChildren[0].description, deskMachine.name);
	});

	test('remote activity view keeps a successful machine read until the next root refresh', async () => {
		let machineReads = 0;
		const instantiationService = createInstantiationService(disposables);
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider());
		instantiationService.stub(IUserDataSyncMachinesService, upcastPartial<IUserDataSyncMachinesService>({
			getMachines: async () => {
				machineReads++;
				return [deskMachine];
			},
		}));
		const provider = instantiationService.createInstance(RemoteUserDataSyncActivityViewDataProvider);
		const syncResource = await firstSyncResource(provider);

		const children = await provider.getChildren(syncResource);
		assert.strictEqual(children[0].description, deskMachine.name);
		assert.strictEqual(machineReads, 1);

		await provider.getChildren(syncResource);
		assert.strictEqual(machineReads, 1);

		await provider.getChildren();
		assert.strictEqual(machineReads, 1);

		await provider.getChildren(syncResource);
		assert.strictEqual(machineReads, 2);
	});

	test('extracted activity view reads synced machines again after the first rejection when the same sync resource is expanded', async () => {
		let machineReads = 0;
		let notifications = 0;
		let rejectMachines = true;
		const instantiationService = createExtractedInstantiationService(disposables, () => { notifications++; });
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider({
			getLocalSyncedMachines: async () => {
				machineReads++;
				if (rejectMachines) {
					throw new Error('local synced machines failed');
				}
				return [deskMachine];
			},
		}));
		const provider = instantiationService.createInstance(ExtractedUserDataSyncActivityViewDataProvider, activityDataResource);
		const syncResource = await firstSyncResource(provider);

		await assert.rejects(() => provider.getChildren(syncResource));
		assert.strictEqual(machineReads, 1);
		assert.strictEqual(notifications, 1);

		rejectMachines = false;
		const children = await provider.getChildren(syncResource);
		assert.strictEqual(machineReads, 2);
		assert.strictEqual(children[0].description, deskMachine.name);
		assert.strictEqual(notifications, 1);
	});

	test('extracted activity view shares one in-flight machine read when the same sync resource is expanded twice', async () => {
		let machineReads = 0;
		let machineIdReads = 0;
		const gate = defer<IUserDataSyncMachine[]>();
		const instantiationService = createExtractedInstantiationService(disposables);
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider({
			getMachineId: async () => {
				machineIdReads++;
				return deskMachine.id;
			},
			getLocalSyncedMachines: () => {
				machineReads++;
				return gate.promise;
			},
		}));
		const provider = instantiationService.createInstance(ExtractedUserDataSyncActivityViewDataProvider, activityDataResource);
		const syncResource = await firstSyncResource(provider);

		const first = provider.getChildren(syncResource);
		const second = provider.getChildren(syncResource);
		await nextMacrotask();
		assert.strictEqual(machineIdReads, 2);
		assert.strictEqual(machineReads, 1);

		gate.resolve([deskMachine]);
		const [firstChildren, secondChildren] = await Promise.all([first, second]);
		assert.strictEqual(machineReads, 1);
		assert.strictEqual(firstChildren[0].description, deskMachine.name);
		assert.strictEqual(secondChildren[0].description, deskMachine.name);
	});

	test('extracted activity view keeps a successful machine read until the next root refresh', async () => {
		let machineReads = 0;
		const instantiationService = createExtractedInstantiationService(disposables);
		instantiationService.stub(IUserDataSyncResourceProviderService, resourceProvider({
			getLocalSyncedMachines: async () => {
				machineReads++;
				return [deskMachine];
			},
		}));
		const provider = instantiationService.createInstance(ExtractedUserDataSyncActivityViewDataProvider, activityDataResource);
		const syncResource = await firstSyncResource(provider);

		const children = await provider.getChildren(syncResource);
		assert.strictEqual(children[0].description, deskMachine.name);
		assert.strictEqual(machineReads, 1);

		await provider.getChildren(syncResource);
		assert.strictEqual(machineReads, 1);

		await provider.getChildren();
		assert.strictEqual(machineReads, 1);

		await provider.getChildren(syncResource);
		assert.strictEqual(machineReads, 2);
	});
});

const activityDataResource = URI.parse('file:///sync-activity');
const deskMachine: IUserDataSyncMachine = { id: 'm1', name: 'Desk', isCurrent: false };

function syncHandle(syncResource: SyncResource): ISyncResourceHandle {
	return { created: 1, uri: URI.parse(`sync://${syncResource}`) };
}

function resourceProvider(overrides: Partial<IUserDataSyncResourceProviderService> = {}): IUserDataSyncResourceProviderService {
	return upcastPartial<IUserDataSyncResourceProviderService>({
		getRemoteSyncedProfiles: async () => [],
		getLocalSyncedProfiles: async () => [],
		getRemoteSyncResourceHandles: async syncResource => [syncHandle(syncResource)],
		getLocalSyncResourceHandles: async syncResource => [syncHandle(syncResource)],
		getAssociatedResources: async () => [{ resource: URI.parse('sync://file'), comparableResource: URI.parse('sync://compare') }],
		getMachineId: async () => deskMachine.id,
		getLocalSyncedMachines: async () => [deskMachine],
		resolveContent: async () => null,
		resolveUserDataSyncResource: () => undefined,
		...overrides,
	});
}

function createInstantiationService(disposables: Pick<DisposableStore, 'add'>, onError?: () => void): TestInstantiationService {
	const instantiationService = disposables.add(new TestInstantiationService());
	const defaultProfile = upcastPartial<IUserDataProfile>({ id: 'default', name: 'Default', isDefault: true });
	const otherProfile = upcastPartial<IUserDataProfile>({ id: otherProfileId, name: 'Other', isDefault: false });
	instantiationService.stub(IUserDataSyncService, upcastPartial<IUserDataSyncService>({}));
	instantiationService.stub(IUserDataAutoSyncService, upcastPartial<IUserDataAutoSyncService>({}));
	instantiationService.stub(IUserDataSyncWorkbenchService, upcastPartial<IUserDataSyncWorkbenchService>({}));
	instantiationService.stub(INotificationService, upcastPartial<INotificationService>({
		error: () => { onError?.(); },
	}));
	instantiationService.stub(IUserDataProfilesService, upcastPartial<IUserDataProfilesService>({
		defaultProfile,
		profiles: [defaultProfile, otherProfile],
	}));
	return instantiationService;
}

function createExtractedInstantiationService(disposables: Pick<DisposableStore, 'add'>, onError?: () => void): TestInstantiationService {
	const instantiationService = createInstantiationService(disposables, onError);
	const resolve: IFileService['resolve'] = async (_resource: URI, _options?: IResolveFileOptions): Promise<IFileStatWithMetadata> => upcastPartial<IFileStatWithMetadata>({ isDirectory: true });
	instantiationService.stub(IFileService, upcastPartial<IFileService>({
		resolve,
	}));
	instantiationService.stub(IUriIdentityService, upcastPartial<IUriIdentityService>({}));
	return instantiationService;
}

async function profileItem(provider: LocalUserDataSyncActivityViewDataProvider): Promise<ITreeItem> {
	const roots = await provider.getChildren();
	const profile = roots.find(item => item.handle === otherProfileId);
	if (!profile) {
		throw new Error('missing profile');
	}
	return profile;
}

async function firstSyncResource(provider: { getChildren(element?: ITreeItem): Promise<ITreeItem[]> }): Promise<ITreeItem> {
	const roots = await provider.getChildren();
	const syncResource = roots[0];
	if (!syncResource) {
		throw new Error('missing sync resource');
	}
	return syncResource;
}

function defer<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(c => { resolve = c; });
	return { promise, resolve };
}

function nextMacrotask(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}
