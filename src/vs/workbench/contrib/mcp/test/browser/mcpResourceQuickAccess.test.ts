/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { DisposableStore } from '../../../../../base/common/lifecycle.js';
import { constObservable } from '../../../../../base/common/observable.js';
import { URI } from '../../../../../base/common/uri.js';
import { mock } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IFileService, IFileStat } from '../../../../../platform/files/common/files.js';
import { ServiceCollection } from '../../../../../platform/instantiation/common/serviceCollection.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../../platform/quickinput/common/quickInput.js';
import { IChatAttachmentResolveService } from '../../../chat/browser/attachments/chatAttachmentResolveService.js';
import { McpResourcePickHelper } from '../../browser/mcpResourceQuickAccess.js';
import { McpIcons } from '../../common/mcpIcons.js';
import { IMcpResource, IMcpServer, IMcpService, McpResourceURI } from '../../common/mcpTypes.js';

class TestMcpServer extends mock<IMcpServer>() {
	override readonly definition = { id: 'test-server', label: 'Test Server' };
}

class TestMcpService extends mock<IMcpService>() {
	override readonly servers = constObservable<IMcpServer[]>([]);
}

class TestFileService extends mock<IFileService>() {
	private _nextResolve: DeferredPromise<IFileStat> | undefined;
	private _resolveHandler: ((uri: URI) => IFileStat | Promise<IFileStat>) | undefined;

	setNextResolveDeferred(deferred: DeferredPromise<IFileStat>): void {
		this._nextResolve = deferred;
	}

	setResolveHandler(handler: (uri: URI) => IFileStat | Promise<IFileStat>): void {
		this._resolveHandler = handler;
	}

	override resolve(resource: URI): Promise<IFileStat> {
		if (this._nextResolve) {
			const deferred = this._nextResolve;
			this._nextResolve = undefined;
			return deferred.p;
		}
		if (this._resolveHandler) {
			return Promise.resolve(this._resolveHandler(resource));
		}
		return Promise.reject(new Error('Unexpected resolve'));
	}
}

function directoryStat(children: { name: string; resource: URI }[]): IFileStat {
	return {
		resource: URI.file('/'),
		name: '/',
		isDirectory: true,
		isFile: false,
		isSymbolicLink: false,
		children: children.map(child => ({
			resource: child.resource,
			name: child.name,
			isDirectory: false,
			isFile: true,
			isSymbolicLink: false,
			children: undefined,
		})),
	};
}

function directoryResource(server: IMcpServer, filePath: string, name: string): IMcpResource {
	const fileUri = URI.file(filePath);
	return {
		uri: McpResourceURI.fromServer(server.definition, fileUri),
		mcpUri: filePath,
		name,
		title: name,
		description: undefined,
		mimeType: 'inode/directory',
		sizeInBytes: undefined,
		icons: McpIcons.fromParsed(undefined),
	};
}

function visibleDirectoryChildNames(helper: McpResourcePickHelper): string[] {
	const state = helper.getPicks().get();
	const names: string[] = [];
	for (const resources of state.picks.values()) {
		for (const resource of resources) {
			names.push(resource.name);
		}
	}
	return names;
}

function createHelper(store: DisposableStore, fileService: TestFileService): McpResourcePickHelper {
	const services = new ServiceCollection(
		[IMcpService, new TestMcpService()],
		[IFileService, fileService],
		[IQuickInputService, new mock<IQuickInputService>()],
		[INotificationService, new mock<INotificationService>()],
		[IChatAttachmentResolveService, new mock<IChatAttachmentResolveService>()],
	);
	const insta = store.add(new TestInstantiationService(services));
	return store.add(insta.createInstance(McpResourcePickHelper));
}

suite('McpResourcePickHelper', () => {
	const ds = ensureNoDisposablesAreLeakedInTestSuite();

	test('stale navigate does not update directory state after navigateBack', async () => {
		const fileService = new TestFileService();
		const server = new TestMcpServer();
		const dirA = directoryResource(server, '/dir-a/', 'dir-a');
		const dirB = directoryResource(server, '/dir-b/', 'dir-b');
		const rootResources = [dirA, dirB];

		fileService.setResolveHandler(uri => {
			if (uri.toString() === dirA.uri.toString()) {
				return directoryStat([{ name: 'child-a', resource: URI.file('/dir-a/child-a') }]);
			}
			return directoryStat([{ name: 'stale-child', resource: URI.file('/dir-b/stale-child') }]);
		});

		const helper = createHelper(ds, fileService);
		(helper as unknown as { _resources: { set: (value: unknown, tx: unknown) => void } })._resources.set({
			picks: new Map([[server, rootResources]]),
			isBusy: false,
		}, undefined);

		assert.strictEqual(await helper.navigate(dirA, server), true);
		assert.deepStrictEqual(visibleDirectoryChildNames(helper), ['child-a']);
		assert.strictEqual(helper.checkIfNestedResources(), true);

		const pendingResolve = new DeferredPromise<IFileStat>();
		fileService.setNextResolveDeferred(pendingResolve);
		const pendingNavigate = helper.navigate(dirB, server);

		assert.strictEqual(helper.navigateBack(), true);
		assert.strictEqual(helper.checkIfNestedResources(), false);
		assert.deepStrictEqual(visibleDirectoryChildNames(helper), rootResources.map(r => r.name));

		pendingResolve.complete(directoryStat([{ name: 'stale-child', resource: URI.file('/dir-b/stale-child') }]));
		assert.strictEqual(await pendingNavigate, false);
		assert.strictEqual(helper.checkIfNestedResources(), false);
		assert.deepStrictEqual(visibleDirectoryChildNames(helper), rootResources.map(r => r.name));
	});

	test('stale navigate does not update directory state when superseded by another navigate', async () => {
		const fileService = new TestFileService();
		const server = new TestMcpServer();
		const dirA = directoryResource(server, '/dir-a/', 'dir-a');
		const dirB = directoryResource(server, '/dir-b/', 'dir-b');
		const rootResources = [dirA, dirB];

		const helper = createHelper(ds, fileService);
		(helper as unknown as { _resources: { set: (value: unknown, tx: unknown) => void } })._resources.set({
			picks: new Map([[server, rootResources]]),
			isBusy: false,
		}, undefined);

		const firstResolve = new DeferredPromise<IFileStat>();
		fileService.setNextResolveDeferred(firstResolve);
		const firstNavigate = helper.navigate(dirA, server);

		const secondResolve = new DeferredPromise<IFileStat>();
		fileService.setNextResolveDeferred(secondResolve);
		const secondNavigate = helper.navigate(dirB, server);

		firstResolve.complete(directoryStat([{ name: 'stale-child', resource: URI.file('/dir-a/stale-child') }]));
		assert.strictEqual(await firstNavigate, false);
		assert.deepStrictEqual(visibleDirectoryChildNames(helper), rootResources.map(r => r.name));

		secondResolve.complete(directoryStat([{ name: 'child-b', resource: URI.file('/dir-b/child-b') }]));
		assert.strictEqual(await secondNavigate, true);
		assert.deepStrictEqual(visibleDirectoryChildNames(helper), ['child-b']);
	});

	test('stale navigate does not update directory state after dispose', async () => {
		const fileService = new TestFileService();
		const server = new TestMcpServer();
		const dirA = directoryResource(server, '/dir-a/', 'dir-a');

		const store = ds.add(new DisposableStore());
		const helper = createHelper(store, fileService);

		const pendingResolve = new DeferredPromise<IFileStat>();
		fileService.setNextResolveDeferred(pendingResolve);
		const pendingNavigate = helper.navigate(dirA, server);

		helper.dispose();
		pendingResolve.complete(directoryStat([{ name: 'stale-child', resource: URI.file('/dir-a/stale-child') }]));
		assert.strictEqual(await pendingNavigate, false);
	});
});
