/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, suite, test } from 'vitest';
import { mock } from '../../../../util/common/test/simpleMock';
import { Event } from '../../../../util/vs/base/common/event';
import { VSBuffer } from '../../../../util/vs/base/common/buffer';
import { URI } from '../../../../util/vs/base/common/uri';
import { IInstantiationService } from '../../../../util/vs/platform/instantiation/common/instantiation';
import { SyncDescriptor } from '../../../../util/vs/platform/instantiation/common/descriptors';
import { EmbeddingType } from '../../common/embeddingsComputer';
import { EmbeddingCacheType, RemoteCacheType, RemoteEmbeddingsCache } from '../../common/embeddingsIndex';
import { IVSCodeExtensionContext } from '../../../extContext/common/extensionContext';
import { IFileSystemService } from '../../../filesystem/common/fileSystemService';
import { MockFileSystemService } from '../../../filesystem/node/test/mockFileSystemService';
import { FetchOptions, IFetcherService, Response } from '../../../networking/common/fetcherService';
import { MockExtensionContext } from '../../../test/node/extensionContext';
import { createPlatformServices, ITestingServicesAccessor } from '../../../test/node/services';
import { DisposableStore } from '../../../../util/vs/base/common/lifecycle';

const CACHE_KEY = 'testRemoteEmbeddings';
const CACHE_VERSION = '9.9.9-test';

const OLD_CACHE = { staleEntry: { embedding: { type: EmbeddingType.text3small_512.id, value: [0.1] } } };
const NEW_CACHE = { freshEntry: { embedding: { type: EmbeddingType.text3small_512.id, value: [0.2] } } };

class ConfigurableMockFileSystemService extends MockFileSystemService {
	deleteShouldFail = false;
	writeShouldFail = false;

	override async delete(uri: URI): Promise<void> {
		if (this.deleteShouldFail) {
			const err = new Error('simulated delete failure') as NodeJS.ErrnoException;
			err.code = 'EACCES';
			throw err;
		}
		return super.delete(uri);
	}

	override async writeFile(uri: URI, content: Uint8Array): Promise<void> {
		if (this.writeShouldFail) {
			throw new Error('simulated write failure');
		}
		return super.writeFile(uri, content);
	}
}

function createFetcher(latestText: string, remoteBody: object): IFetcherService {
	return new (class extends mock<IFetcherService>() {
		override readonly onDidFetch = Event.None;
		override readonly onDidCompleteFetch = Event.None;
		override getUserAgentLibrary(): string {
			return 'test-fetcher';
		}
		override fetch(_url: string, options?: FetchOptions): Promise<Response> {
			if (options?.callSite === 'embeddings-remote-cache-latest') {
				return Promise.resolve(Response.fromText(200, 'OK', {} as any, latestText, 'test-stub'));
			}
			if (options?.callSite === 'embeddings-remote-cache') {
				return Promise.resolve(Response.fromText(200, 'OK', {} as any, JSON.stringify(remoteBody), 'test-stub'));
			}
			return Promise.resolve(Response.fromText(404, 'Not Found', {} as any, '', 'test-stub'));
		}
	})();
}

async function seedLocalCache(
	fileSystem: ConfigurableMockFileSystemService,
	extensionContext: MockExtensionContext,
): Promise<void> {
	const storageUri = extensionContext.globalStorageUri!;
	await fileSystem.createDirectory(storageUri);
	const cacheFile = URI.joinPath(storageUri, `${CACHE_KEY}.json`);
	await fileSystem.writeFile(cacheFile, VSBuffer.fromString(JSON.stringify(OLD_CACHE)).buffer);
	await extensionContext.globalState.update(`${CACHE_KEY}-version`, CACHE_VERSION);
	await extensionContext.globalState.update(`${CACHE_KEY}-version-remote`, 'old-remote-latest');
}

function createRemoteCache(
	disposables: DisposableStore,
	fileSystem: ConfigurableMockFileSystemService,
	storageDir: string,
): { accessor: ITestingServicesAccessor; remoteCache: RemoteEmbeddingsCache; extensionContext: MockExtensionContext } {
	const services = createPlatformServices();
	services.define(IFileSystemService, fileSystem);
	services.define(IFetcherService, createFetcher('new-remote-latest', NEW_CACHE));
	services.define(IVSCodeExtensionContext, new SyncDescriptor(MockExtensionContext, [storageDir]));
	const accessor = disposables.add(services.createTestingAccessor());
	const extensionContext = accessor.get(IVSCodeExtensionContext) as MockExtensionContext;
	const remoteCache = accessor.get(IInstantiationService).createInstance(
		RemoteEmbeddingsCache,
		EmbeddingCacheType.GLOBAL,
		CACHE_KEY,
		CACHE_VERSION,
		EmbeddingType.text3small_512,
		RemoteCacheType.Settings,
	);
	return { accessor, remoteCache, extensionContext };
}

suite('RemoteEmbeddingsCache updateCache ordering', () => {
	let disposables: DisposableStore;
	let storageDir: string;
	let fileSystem: ConfigurableMockFileSystemService;

	beforeEach(() => {
		disposables = new DisposableStore();
		storageDir = mkdtempSync(join(tmpdir(), 'embeddings-cache-test-'));
		fileSystem = new ConfigurableMockFileSystemService();
	});

	afterEach(() => {
		disposables.dispose();
		rmSync(storageDir, { recursive: true, force: true });
	});

	test('write failure leaves remote version key stale and does not return old JSON on retry', async () => {
		const { remoteCache, extensionContext } = createRemoteCache(disposables, fileSystem, storageDir);
		await seedLocalCache(fileSystem, extensionContext);
		fileSystem.deleteShouldFail = true;
		fileSystem.writeShouldFail = true;

		await assert.rejects(() => remoteCache.getCache());
		assert.strictEqual(extensionContext.globalState.get(`${CACHE_KEY}-version-remote`), 'old-remote-latest');

		await assert.rejects(() => remoteCache.getCache());
	});

	test('delete success with write failure rejects and clears readable local cache', async () => {
		const { remoteCache, extensionContext } = createRemoteCache(disposables, fileSystem, storageDir);
		await seedLocalCache(fileSystem, extensionContext);

		fileSystem.deleteShouldFail = false;
		fileSystem.writeShouldFail = true;

		await assert.rejects(() => remoteCache.getCache());
		const local = await (remoteCache as any).embeddingsCache.getCache();
		assert.strictEqual(local, undefined);
	});
});
