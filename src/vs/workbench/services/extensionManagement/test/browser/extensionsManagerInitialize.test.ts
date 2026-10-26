/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ILocalExtension } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IExtensionManagementServerService, IWorkbenchExtensionManagementService } from '../../common/extensionManagement.js';
import { ExtensionsManager } from '../../browser/extensionEnablementService.js';

interface ListenerCounts {
	install: number;
	uninstall: number;
	profile: number;
}

function localExtension(id: string): ILocalExtension {
	return { identifier: { id } } as ILocalExtension;
}

function countingEvent<T>(onSubscribe: () => void): Event<T> {
	return () => {
		onSubscribe();
		return Disposable.None;
	};
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void } {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

suite('ExtensionsManager initialize', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createManager(reads: {
		getInstalled: () => Promise<ILocalExtension[]>;
		getInstalledWorkspaceExtensions?: () => Promise<ILocalExtension[]>;
	}): { manager: ExtensionsManager; listenerCounts: ListenerCounts } {
		const listenerCounts: ListenerCounts = { install: 0, uninstall: 0, profile: 0 };
		const extensionManagementService = {
			getInstalled: reads.getInstalled,
			getInstalledWorkspaceExtensions: async () => reads.getInstalledWorkspaceExtensions ? reads.getInstalledWorkspaceExtensions() : [],
			onDidInstallExtensions: countingEvent<never>(() => { listenerCounts.install++; }),
			onDidUninstallExtension: countingEvent<never>(() => { listenerCounts.uninstall++; }),
			onDidChangeProfile: countingEvent<never>(() => { listenerCounts.profile++; }),
		} as unknown as IWorkbenchExtensionManagementService;
		const extensionManagementServerService = {
			getExtensionManagementServer: () => null,
		} as unknown as IExtensionManagementServerService;
		const logService = {
			error: () => { },
		} as unknown as ILogService;
		const manager = disposables.add(new ExtensionsManager(extensionManagementService, extensionManagementServerService, logService));
		return { manager, listenerCounts };
	}

	test('reads installed extensions again after the first getInstalled failure', async () => {
		let reads = 0;
		const { manager } = createManager({
			getInstalled: () => {
				reads++;
				if (reads === 1) {
					throw new Error('getInstalled failed');
				}
				return Promise.resolve([localExtension('pub.a')]);
			},
		});

		await manager.whenInitialized();
		assert.strictEqual(reads, 1);
		assert.deepStrictEqual([...manager.extensions], []);

		await manager.whenInitialized();
		assert.strictEqual(reads, 2);
		assert.deepStrictEqual(manager.extensions.map(extension => extension.identifier.id), ['pub.a']);
	});

	test('concurrent whenInitialized reads installed extensions once', async () => {
		let reads = 0;
		const firstRead = deferred<ILocalExtension[]>();
		const retryRead = deferred<ILocalExtension[]>();
		const { manager } = createManager({
			getInstalled: () => {
				reads++;
				return reads === 1 ? firstRead.promise : retryRead.promise;
			},
		});

		const first = manager.whenInitialized();
		const second = manager.whenInitialized();
		assert.strictEqual(second, first);
		assert.strictEqual(reads, 1);
		firstRead.reject(new Error('getInstalled failed'));
		await first;
		await second;
		assert.strictEqual(reads, 1);

		const retryA = manager.whenInitialized();
		const retryB = manager.whenInitialized();
		assert.strictEqual(retryB, retryA);
		assert.notStrictEqual(retryA, first);
		assert.strictEqual(reads, 2);
		retryRead.resolve([localExtension('pub.a')]);
		await retryA;
		await retryB;
		assert.strictEqual(reads, 2);
		assert.deepStrictEqual(manager.extensions.map(extension => extension.identifier.id), ['pub.a']);
	});

	test('registers extension change listeners once when initialization is retried', async () => {
		let reads = 0;
		const { manager, listenerCounts } = createManager({
			getInstalled: () => {
				reads++;
				if (reads === 1) {
					throw new Error('getInstalled failed');
				}
				return Promise.resolve([]);
			},
		});

		await manager.whenInitialized();
		assert.deepStrictEqual(listenerCounts, { install: 1, uninstall: 1, profile: 1 });

		await manager.whenInitialized();
		assert.strictEqual(reads, 2);
		assert.deepStrictEqual(listenerCounts, { install: 1, uninstall: 1, profile: 1 });
	});

	test('does not read installed extensions again after success', async () => {
		let installedReads = 0;
		let workspaceReads = 0;
		const { manager, listenerCounts } = createManager({
			getInstalled: async () => {
				installedReads++;
				return [localExtension('pub.a')];
			},
			getInstalledWorkspaceExtensions: async () => {
				workspaceReads++;
				return [localExtension('pub.b')];
			},
		});

		await manager.whenInitialized();
		await manager.whenInitialized();

		assert.strictEqual(installedReads, 1);
		assert.strictEqual(workspaceReads, 1);
		assert.deepStrictEqual(manager.extensions.map(extension => extension.identifier.id), ['pub.a', 'pub.b']);
		assert.deepStrictEqual(listenerCounts, { install: 1, uninstall: 1, profile: 1 });
	});
});
