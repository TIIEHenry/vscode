/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { Event } from '../../../../base/common/event.js';
import { runWithFakedTimers } from '../../../../base/test/common/timeTravelScheduler.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IConfigurationService } from '../../../configuration/common/configuration.js';
import { ConfigurationScope, Extensions, IConfigurationRegistry } from '../../../configuration/common/configurationRegistry.js';
import { FileOperationError, FileOperationResult, IFileService } from '../../../files/common/files.js';
import { Registry } from '../../../registry/common/platform.js';
import { IUserDataProfile, IUserDataProfilesService } from '../../../userDataProfile/common/userDataProfile.js';
import { ISettingsSyncContent, parseSettingsSyncContent, SettingsInitializer, SettingsSynchroniser } from '../../common/settingsSync.js';
import { ISyncData, IUserDataSyncLogService, IUserDataSyncStoreService, SyncResource, SyncStatus, UserDataSyncError, UserDataSyncErrorCode } from '../../common/userDataSync.js';
import { UserDataSyncClient, UserDataSyncTestServer } from './userDataSyncClient.js';

suite('SettingsSync - Auto', () => {

	const server = new UserDataSyncTestServer();
	let client: UserDataSyncClient;
	let testObject: SettingsSynchroniser;

	teardown(async () => {
		await client.instantiationService.get(IUserDataSyncStoreService).clear();
	});

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	setup(async () => {
		Registry.as<IConfigurationRegistry>(Extensions.Configuration).registerConfiguration({
			'id': 'settingsSync',
			'type': 'object',
			'properties': {
				'settingsSync.machine': {
					'type': 'string',
					'scope': ConfigurationScope.MACHINE
				},
				'settingsSync.machineOverridable': {
					'type': 'string',
					'scope': ConfigurationScope.MACHINE_OVERRIDABLE
				}
			}
		});
		client = disposableStore.add(new UserDataSyncClient(server));
		await client.setUp(true);
		testObject = client.getSynchronizer(SyncResource.Settings) as SettingsSynchroniser;
	});

	test('when settings file does not exist', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;

		assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
		let manifest = await client.getLatestRef(SyncResource.Settings);
		server.reset();
		await testObject.sync(manifest);

		assert.deepStrictEqual(server.requests, []);
		assert.ok(!await fileService.exists(settingResource));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.deepStrictEqual(lastSyncUserData!.ref, remoteUserData.ref);
		assert.deepStrictEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
		assert.strictEqual(lastSyncUserData!.syncData, null);

		manifest = await client.getLatestRef(SyncResource.Settings);
		server.reset();
		await testObject.sync(manifest);
		assert.deepStrictEqual(server.requests, []);

		manifest = await client.getLatestRef(SyncResource.Settings);
		server.reset();
		await testObject.sync(manifest);
		assert.deepStrictEqual(server.requests, []);
	}));

	test('when settings file is empty and remote has no changes', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		await fileService.writeFile(settingsResource, VSBuffer.fromString(''));

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(parseSettingsSyncContent(lastSyncUserData!.syncData!.content)?.settings, '{}');
		assert.strictEqual(parseSettingsSyncContent(remoteUserData.syncData!.content)?.settings, '{}');
		assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), '');
	}));

	test('when settings file is empty and remote has changes', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const client2 = disposableStore.add(new UserDataSyncClient(server));
		await client2.setUp(true);
		const content =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"workbench.tree.indent": 20,
	"workbench.colorCustomizations": {
		"editorLineNumber.activeForeground": "#ff0000",
		"[GitHub Sharp]": {
			"statusBarItem.remoteBackground": "#24292E",
			"editorPane.background": "#f3f1f11a"
		}
	},

	"gitBranch.base": "remote-repo/master",

	// Experimental
	"workbench.view.experimental.allowMovingToNewContainer": true,
}`;
		await client2.instantiationService.get(IFileService).writeFile(client2.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource, VSBuffer.fromString(content));
		await client2.sync();

		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		await fileService.writeFile(settingsResource, VSBuffer.fromString(''));

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(parseSettingsSyncContent(lastSyncUserData!.syncData!.content)?.settings, content);
		assert.strictEqual(parseSettingsSyncContent(remoteUserData.syncData!.content)?.settings, content);
		assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), content);
	}));

	test('when settings file is created after first sync', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const fileService = client.instantiationService.get(IFileService);

		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		await testObject.sync(await client.getLatestRef(SyncResource.Settings));
		await fileService.createFile(settingsResource, VSBuffer.fromString('{}'));

		let lastSyncUserData = await testObject.getLastSyncUserData();
		const manifest = await client.getLatestRef(SyncResource.Settings);
		server.reset();
		await testObject.sync(manifest);

		assert.deepStrictEqual(server.requests, [
			{ type: 'POST', url: `${server.url}/v1/resource/${testObject.resource}`, headers: { 'If-Match': lastSyncUserData?.ref } },
		]);

		lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.deepStrictEqual(lastSyncUserData!.ref, remoteUserData.ref);
		assert.deepStrictEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
		assert.strictEqual(parseSettingsSyncContent(lastSyncUserData!.syncData!.content)?.settings, '{}');
	}));

	test('sync for first time to the server', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const expected =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"workbench.tree.indent": 20,
	"workbench.colorCustomizations": {
		"editorLineNumber.activeForeground": "#ff0000",
		"[GitHub Sharp]": {
			"statusBarItem.remoteBackground": "#24292E",
			"editorPane.background": "#f3f1f11a"
		}
	},

	"gitBranch.base": "remote-repo/master",

	// Experimental
	"workbench.view.experimental.allowMovingToNewContainer": true,
}`;

		await updateSettings(expected, client);
		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, expected);
	}));

	test('do not sync machine settings', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue"
}`;
		await updateSettings(settingsContent, client);

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp"
}`);
	}));

	test('do not sync machine settings when spread across file', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"settingsSync.machine": "someValue",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machineOverridable": "someValue"
}`;
		await updateSettings(settingsContent, client);

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp"
}`);
	}));

	test('do not sync machine settings when spread across file - 2', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"settingsSync.machine": "someValue",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machineOverridable": "someValue",
	"files.simpleDialog.enable": true,
}`;
		await updateSettings(settingsContent, client);

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"files.simpleDialog.enable": true,
}`);
	}));

	test('sync when all settings are machine settings', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const settingsContent =
			`{
	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue"
}`;
		await updateSettings(settingsContent, client);

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, `{
}`);
	}));

	test('sync when all settings are machine settings with trailing comma', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const settingsContent =
			`{
	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue",
}`;
		await updateSettings(settingsContent, client);

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, `{
	,
}`);
	}));

	test('local change event is triggered when settings are changed', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const content =
			`{
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,
}`;

		await updateSettings(content, client);
		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const promise = Event.toPromise(testObject.onDidChangeLocal);
		await updateSettings(`{
	"files.autoSave": "off",
	"files.simpleDialog.enable": true,
}`, client);
		await promise;
	}));

	test('do not sync ignored settings', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Editor
	"editor.fontFamily": "Fira Code",

	// Terminal
	"terminal.integrated.shell.osx": "some path",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`;
		await updateSettings(settingsContent, client);

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`);
	}));

	test('do not sync ignored and machine settings', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Editor
	"editor.fontFamily": "Fira Code",

	// Terminal
	"terminal.integrated.shell.osx": "some path",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	],

	// Machine
	"settingsSync.machine": "someValue",
}`;
		await updateSettings(settingsContent, client);

		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	],
}`);
	}));

	test('sync throws invalid content error', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const expected =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"workbench.tree.indent": 20,
	"workbench.colorCustomizations": {
		"editorLineNumber.activeForeground": "#ff0000",
		"[GitHub Sharp]": {
			"statusBarItem.remoteBackground": "#24292E",
			"editorPane.background": "#f3f1f11a"
		}
	}

	"gitBranch.base": "remote-repo/master",

	// Experimental
	"workbench.view.experimental.allowMovingToNewContainer": true,
}`;

		await updateSettings(expected, client);

		try {
			await testObject.sync(await client.getLatestRef(SyncResource.Settings));
			assert.fail('should fail with invalid content error');
		} catch (e) {
			assert.ok(e instanceof UserDataSyncError);
			assert.deepStrictEqual((<UserDataSyncError>e).code, UserDataSyncErrorCode.LocalInvalidContent);
		}
	}));

	test('sync throws invalid content error - content is an array', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		await updateSettings('[]', client);
		try {
			await testObject.sync(await client.getLatestRef(SyncResource.Settings));
			assert.fail('should fail with invalid content error');
		} catch (e) {
			assert.ok(e instanceof UserDataSyncError);
			assert.deepStrictEqual((<UserDataSyncError>e).code, UserDataSyncErrorCode.LocalInvalidContent);
		}
	}));

	test('sync when there are conflicts', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const client2 = disposableStore.add(new UserDataSyncClient(server));
		await client2.setUp(true);
		await updateSettings(JSON.stringify({
			'a': 1,
			'b': 2,
			'settingsSync.ignoredSettings': ['a']
		}), client2);
		await client2.sync();

		await updateSettings(JSON.stringify({
			'a': 2,
			'b': 1,
			'settingsSync.ignoredSettings': ['a']
		}), client);
		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
		assert.strictEqual(testObject.conflicts.conflicts[0].localResource.toString(), testObject.localResource.toString());

		const fileService = client.instantiationService.get(IFileService);
		const mergeContent = (await fileService.readFile(testObject.conflicts.conflicts[0].previewResource)).value.toString();
		assert.strictEqual(mergeContent, '');
	}));

	test('sync profile settings', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const client2 = disposableStore.add(new UserDataSyncClient(server));
		await client2.setUp(true);
		const profile = await client2.instantiationService.get(IUserDataProfilesService).createNamedProfile('profile1');
		await updateSettings(JSON.stringify({
			'a': 1,
			'b': 2,
		}), client2, profile);
		await client2.sync();

		await client.sync();

		assert.strictEqual(testObject.status, SyncStatus.Idle);

		const syncedProfile = client.instantiationService.get(IUserDataProfilesService).profiles.find(p => p.id === profile.id)!;
		const content = (await client.instantiationService.get(IFileService).readFile(syncedProfile.settingsResource)).value.toString();
		assert.deepStrictEqual(JSON.parse(content), {
			'a': 1,
			'b': 2,
		});
	}));

	test('sync rejects when settings read fails with FILE_PERMISSION_DENIED and remote content stays', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		await assertSettingsReadFailureLeavesRemoteUnchanged(FileOperationResult.FILE_PERMISSION_DENIED);
	}));

	test('sync rejects when settings read fails with FILE_TOO_LARGE and remote content stays', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		await assertSettingsReadFailureLeavesRemoteUnchanged(FileOperationResult.FILE_TOO_LARGE);
	}));

	test('sync treats FILE_NOT_FOUND as empty settings and merges to remote', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const synced = await syncRemoteWithNonIgnoredSettings();
		failSettingsRead(FileOperationResult.FILE_NOT_FOUND);

		await testObject.sync(synced.ref);

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(lastSyncUserData!.ref, remoteUserData.ref);
		assert.deepStrictEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
		assert.notStrictEqual(remoteUserData.syncData!.content, synced.content);
		assert.strictEqual(parseSettingsSyncContent(remoteUserData.syncData!.content)?.settings, '{}');
	}));

	test('SettingsSynchroniser hasLocalData throws when settings read fails with FILE_PERMISSION_DENIED or FILE_TOO_LARGE', async () => {
		for (const result of [FileOperationResult.FILE_PERMISSION_DENIED, FileOperationResult.FILE_TOO_LARGE]) {
			failSettingsRead(result);
			try {
				await testObject.hasLocalData();
				assert.fail(`should throw when settings cannot be read: ${result}`);
			} catch (e) {
				assert.ok(e instanceof FileOperationError);
				assert.strictEqual(e.fileOperationResult, result);
			}
		}
	});

	test('SettingsSynchroniser hasLocalData returns false when settings file is missing or empty', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		if (await fileService.exists(settingsResource)) {
			await fileService.del(settingsResource);
		}

		assert.strictEqual(await testObject.hasLocalData(), false);

		await fileService.writeFile(settingsResource, VSBuffer.fromString(''));
		assert.strictEqual(await testObject.hasLocalData(), false);
	});

	test('SettingsSynchroniser hasLocalData returns true when settings file is non-empty', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		await fileService.writeFile(settingsResource, VSBuffer.fromString('{\n\t"files.autoSave": "afterDelay"\n}'));

		assert.strictEqual(await testObject.hasLocalData(), true);
	});

	async function syncRemoteWithNonIgnoredSettings(): Promise<{ content: string; ref: string }> {
		await updateSettings('{\n\t"files.autoSave": "afterDelay"\n}', client);
		await testObject.sync(await client.getLatestRef(SyncResource.Settings));

		const lastSyncUserData = await testObject.getLastSyncUserData();
		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(lastSyncUserData!.ref, remoteUserData.ref);
		assert.deepStrictEqual(lastSyncUserData!.syncData, remoteUserData.syncData);
		const remoteSettings = parseSettingsSyncContent(remoteUserData.syncData!.content)!.settings;
		assert.ok(remoteSettings.includes('"files.autoSave"'));
		return { content: remoteUserData.syncData!.content, ref: remoteUserData.ref };
	}

	async function assertSettingsReadFailureLeavesRemoteUnchanged(result: FileOperationResult): Promise<void> {
		const synced = await syncRemoteWithNonIgnoredSettings();
		failSettingsRead(result);

		try {
			await testObject.sync(synced.ref);
			assert.fail('should fail when settings cannot be read');
		} catch (e) {
			assert.ok(e instanceof FileOperationError);
			assert.strictEqual(e.fileOperationResult, result);
		}

		const remoteUserData = await testObject.getRemoteUserData(null);
		assert.strictEqual(remoteUserData.ref, synced.ref);
		assert.strictEqual(remoteUserData.syncData!.content, synced.content);
	}

	function failSettingsRead(result: FileOperationResult): void {
		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource.toString();
		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = (resource, options, token) => {
			if (resource.toString() === settingsResource) {
				return Promise.reject(new FileOperationError('settings read failed', result));
			}
			return originalReadFile(resource, options, token);
		};
	}

});

suite('SettingsSync - Manual', () => {

	const server = new UserDataSyncTestServer();
	let client: UserDataSyncClient;
	let testObject: SettingsSynchroniser;

	teardown(async () => {
		await client.instantiationService.get(IUserDataSyncStoreService).clear();
	});

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	setup(async () => {
		client = disposableStore.add(new UserDataSyncClient(server));
		await client.setUp(true);
		testObject = client.getSynchronizer(SyncResource.Settings) as SettingsSynchroniser;
	});

	test('do not sync ignored settings', () => runWithFakedTimers<void>({ useFakeTimers: true }, async () => {
		const settingsContent =
			`{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Editor
	"editor.fontFamily": "Fira Code",

	// Terminal
	"terminal.integrated.shell.osx": "some path",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`;
		await updateSettings(settingsContent, client);

		let preview = await testObject.sync(await client.getLatestRef(SyncResource.Settings), true);
		assert.strictEqual(testObject.status, SyncStatus.Syncing);
		preview = await testObject.accept(preview!.resourcePreviews[0].previewResource);
		preview = await testObject.apply(false);

		const { content } = await client.read(testObject.resource);
		assert.ok(content !== null);
		const actual = parseSettings(content);
		assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`);
	}));

});

suite('SettingsInitializer', () => {

	const server = new UserDataSyncTestServer();
	let client: UserDataSyncClient;
	let testObject: SettingsInitializer;

	teardown(async () => {
		await client.instantiationService.get(IUserDataSyncStoreService).clear();
	});

	const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();

	setup(async () => {
		client = disposableStore.add(new UserDataSyncClient(server));
		await client.setUp(true);
		testObject = client.instantiationService.createInstance(SettingsInitializer);
	});

	test('skips initialization and does not overwrite when local settings are non-empty', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		const localSettings = '{\n\t"files.autoSave": "afterDelay"\n}';
		await fileService.writeFile(settingsResource, VSBuffer.fromString(localSettings));

		await testObject.initialize(remoteSettingsUserData('{\n\t"editor.fontSize": 14\n}'));

		assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), localSettings);
	});

	test('writes settingsResource when the settings file is missing', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		if (await fileService.exists(settingsResource)) {
			await fileService.del(settingsResource);
		}
		assert.strictEqual(await fileService.exists(settingsResource), false);

		const remoteSettings = '{\n\t"editor.fontSize": 14\n}';
		await testObject.initialize(remoteSettingsUserData(remoteSettings));

		assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), remoteSettings);
	});

	test('initialize surfaces the read error and does not write when settings read fails with FILE_PERMISSION_DENIED or FILE_TOO_LARGE', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		const remoteSettings = '{\n\t"editor.fontSize": 14\n}';

		for (const result of [FileOperationResult.FILE_PERMISSION_DENIED, FileOperationResult.FILE_TOO_LARGE]) {
			if (await fileService.exists(settingsResource)) {
				await fileService.del(settingsResource);
			}
			const readError = failSettingsInitializerRead(fileService, settingsResource.toString(), result);
			const loggedErrors: unknown[] = [];
			const infos: unknown[] = [];
			captureInitializerLogs(loggedErrors, infos);
			let thrown: unknown;
			try {
				await testObject.initialize(remoteSettingsUserData(remoteSettings));
			} catch (error) {
				thrown = error;
			}

			assert.strictEqual(await fileService.exists(settingsResource), false);
			assert.strictEqual(thrown, readError);
			assert.deepStrictEqual(loggedErrors, [readError]);
			assert.ok(!infos.includes('Skipping initializing settings because local settings exist.'));
		}
	});

	test('initialize skips writing when settings parse throws a non-FileOperationError', async () => {
		const fileService = client.instantiationService.get(IFileService);
		const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
		const localSettings = '{\n\t"files.autoSave": "afterDelay"\n}';
		await fileService.writeFile(settingsResource, VSBuffer.fromString(localSettings));
		const restoreRead = stubSettingsParseFailure(fileService, settingsResource.toString());
		const loggedErrors: unknown[] = [];
		const infos: unknown[] = [];
		captureInitializerLogs(loggedErrors, infos);

		try {
			await testObject.initialize(remoteSettingsUserData('{\n\t"editor.fontSize": 14\n}'));
			assert.deepStrictEqual(loggedErrors, []);
			assert.ok(infos.includes('Skipping initializing settings because local settings exist.'));
		} finally {
			restoreRead();
		}

		assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), localSettings);
	});

	function remoteSettingsUserData(settings: string) {
		return {
			ref: '1',
			content: JSON.stringify({
				version: 2,
				content: JSON.stringify({ settings }),
			}),
		};
	}

	function failSettingsInitializerRead(fileService: IFileService, settingsResource: string, result: FileOperationResult): FileOperationError {
		const readError = new FileOperationError('settings read failed', result);
		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = (resource, options, token) => {
			if (resource.toString() === settingsResource) {
				return Promise.reject(readError);
			}
			return originalReadFile(resource, options, token);
		};
		return readError;
	}

	function stubSettingsParseFailure(fileService: IFileService, settingsResource: string): () => void {
		const target = fileService as { readFile: IFileService['readFile'] };
		const originalReadFile = target.readFile.bind(fileService);
		target.readFile = async (resource, options, token) => {
			if (resource.toString() !== settingsResource) {
				return originalReadFile(resource, options, token);
			}
			const content = await originalReadFile(resource, options, token);
			return {
				...content,
				value: {
					toString(): string {
						return new Proxy(Object.create(null), {
							get(_target, prop) {
								if (prop === 'length' || prop === 'charCodeAt' || prop === 'trim') {
									throw new TypeError('settings parse failed');
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

function parseSettings(content: string): string {
	const syncData: ISyncData = JSON.parse(content);
	const settingsSyncContent: ISettingsSyncContent = JSON.parse(syncData.content);
	return settingsSyncContent.settings;
}

async function updateSettings(content: string, client: UserDataSyncClient, profile?: IUserDataProfile): Promise<void> {
	await client.instantiationService.get(IFileService).writeFile((profile ?? client.instantiationService.get(IUserDataProfilesService).defaultProfile).settingsResource, VSBuffer.fromString(content));
	await client.instantiationService.get(IConfigurationService).reloadConfiguration();
}
