/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { URI } from '../../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IExtensionsControlManifest } from '../../../../../platform/extensionManagement/common/extensionManagement.js';
import { WebExtensionsScannerService } from '../../browser/webExtensionsScannerService.js';

interface ICustomBuiltinExtensionsInfo {
	readonly extensions: readonly { readonly id: string; readonly preRelease: boolean }[];
	readonly extensionsToMigrate: readonly (readonly [string, string])[];
	readonly extensionLocations: readonly URI[];
	readonly extensionGalleryResources: readonly URI[];
}

interface ICachedWebExtension {
	readonly identifier: { readonly id: string };
}

interface IScannerCache {
	readCustomBuiltinExtensionsInfoFromEnv(): Promise<ICustomBuiltinExtensionsInfo>;
	migrateExtensionsStorage(customBuiltinExtensions: readonly []): Promise<void>;
	updateCustomBuiltinExtensionsCache(): Promise<readonly ICachedWebExtension[]>;
	_customBuiltinExtensionsInfoPromise: Promise<ICustomBuiltinExtensionsInfo> | undefined;
	_migrateExtensionsStoragePromise: Promise<void> | undefined;
	_updateCustomBuiltinExtensionsCachePromise: Promise<readonly ICachedWebExtension[]> | undefined;
	writeCustomBuiltinExtensionsCache(updateFn: (extensions: readonly ICachedWebExtension[]) => readonly ICachedWebExtension[]): Promise<readonly ICachedWebExtension[]>;
}

function emptyControlManifest(): IExtensionsControlManifest {
	return { malicious: [], deprecated: {}, search: [] };
}

function createHarness(additionalBuiltinExtensions: readonly unknown[], hooks: {
	isExtensionGalleryResource?: (uri: URI) => Promise<boolean>;
	getExtensionsControlManifest?: () => Promise<IExtensionsControlManifest>;
	getExtensions?: () => Promise<readonly []>;
} = {}): { service: IScannerCache; reads(): number } {
	let reads = 0;
	// Skip the constructor. It only wires web cache files and an eventual cache update.
	const service: IScannerCache = Object.assign(Object.create(WebExtensionsScannerService.prototype), {
		environmentService: {
			options: {
				get additionalBuiltinExtensions() {
					reads++;
					return additionalBuiltinExtensions;
				}
			}
		},
		extensionResourceLoaderService: {
			isExtensionGalleryResource: (uri: URI) => {
				if (!hooks.isExtensionGalleryResource) {
					return Promise.reject(new Error('unexpected isExtensionGalleryResource'));
				}
				return hooks.isExtensionGalleryResource(uri);
			}
		},
		galleryService: {
			getExtensionsControlManifest: () => {
				if (!hooks.getExtensionsControlManifest) {
					return Promise.reject(new Error('unexpected getExtensionsControlManifest'));
				}
				return hooks.getExtensionsControlManifest();
			},
			getExtensions: () => {
				if (!hooks.getExtensions) {
					return Promise.reject(new Error('unexpected getExtensions'));
				}
				return hooks.getExtensions();
			}
		},
		logService: {
			info() { },
			error() { },
		},
		_customBuiltinExtensionsInfoPromise: undefined,
		_migrateExtensionsStoragePromise: undefined,
		_updateCustomBuiltinExtensionsCachePromise: undefined,
	});
	return { service, reads: () => reads };
}

async function until(predicate: () => boolean, message: string): Promise<void> {
	for (let attempt = 0; attempt < 20 && !predicate(); attempt++) {
		await Promise.resolve();
	}
	assert.ok(predicate(), message);
}

suite('WebExtensionsScannerService additional builtin extension reads', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const location = URI.parse('https://example.com/additional-builtin');

	test('reads again after isExtensionGalleryResource rejects', async () => {
		const error = new Error('gallery resource check failed');
		let galleryCalls = 0;
		const { service, reads } = createHarness([location.toJSON()], {
			isExtensionGalleryResource: async () => {
				galleryCalls++;
				if (galleryCalls === 1) {
					throw error;
				}
				return false;
			}
		});

		const first = service.readCustomBuiltinExtensionsInfoFromEnv();
		const sharedFailure = service.readCustomBuiltinExtensionsInfoFromEnv();
		assert.strictEqual(sharedFailure, first);
		assert.strictEqual(galleryCalls, 1);
		await assert.rejects(first, (reason: unknown) => reason === error);
		await assert.rejects(sharedFailure, (reason: unknown) => reason === error);
		assert.strictEqual(galleryCalls, 1);
		const afterFailure = reads();
		assert.ok(afterFailure > 0);

		const second = service.readCustomBuiltinExtensionsInfoFromEnv();
		assert.notStrictEqual(second, first);
		const info = await second;
		assert.deepStrictEqual(info.extensionLocations.map(uri => uri.toString()), [location.toString()]);
		assert.deepStrictEqual(info.extensionGalleryResources, []);
		assert.deepStrictEqual(info.extensions, []);
		assert.deepStrictEqual(info.extensionsToMigrate, []);
		assert.strictEqual(galleryCalls, 2);
		const afterRetry = reads();
		assert.ok(afterRetry > afterFailure);

		const cached = service.readCustomBuiltinExtensionsInfoFromEnv();
		assert.strictEqual(cached, second);
		assert.strictEqual(await cached, info);
		assert.strictEqual(galleryCalls, 2);
		assert.strictEqual(reads(), afterRetry);
	});

	test('reads again after checkAdditionalBuiltinExtensions rejects', async () => {
		const error = new Error('control manifest failed');
		let manifestCalls = 0;
		const { service, reads } = createHarness(['pub.ext'], {
			getExtensionsControlManifest: async () => {
				manifestCalls++;
				if (manifestCalls === 1) {
					throw error;
				}
				return emptyControlManifest();
			}
		});

		const first = service.readCustomBuiltinExtensionsInfoFromEnv();
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(manifestCalls, 1);
		const afterFailure = reads();

		const second = service.readCustomBuiltinExtensionsInfoFromEnv();
		assert.notStrictEqual(second, first);
		assert.deepStrictEqual(await second, {
			extensions: [{ id: 'pub.ext', preRelease: false }],
			extensionsToMigrate: [],
			extensionLocations: [],
			extensionGalleryResources: [],
		});
		assert.strictEqual(manifestCalls, 2);
		assert.ok(reads() > afterFailure);
		assert.strictEqual(service.readCustomBuiltinExtensionsInfoFromEnv(), second);
		assert.strictEqual(manifestCalls, 2);
	});

	test('shares one read while it is in flight', async () => {
		let galleryCalls = 0;
		let releaseGallery!: (value: boolean) => void;
		const { service, reads } = createHarness([location.toJSON()], {
			isExtensionGalleryResource: () => {
				galleryCalls++;
				return new Promise<boolean>(resolve => { releaseGallery = resolve; });
			}
		});

		const first = service.readCustomBuiltinExtensionsInfoFromEnv();
		const second = service.readCustomBuiltinExtensionsInfoFromEnv();
		assert.strictEqual(galleryCalls, 1);
		assert.strictEqual(second, first);
		const afterStart = reads();
		assert.ok(afterStart > 0);

		releaseGallery(true);
		const info = await first;
		assert.strictEqual(await second, info);
		assert.deepStrictEqual(info.extensionGalleryResources.map(uri => uri.toString()), [location.toString()]);
		assert.deepStrictEqual(info.extensionLocations, []);
		assert.strictEqual(service.readCustomBuiltinExtensionsInfoFromEnv(), first);
		assert.strictEqual(galleryCalls, 1);
		assert.strictEqual(reads(), afterStart);
	});

	test('does not read again after success', async () => {
		let manifestCalls = 0;
		const manifest: IExtensionsControlManifest = {
			malicious: [{ extensionOrPublisher: 'evil' }],
			deprecated: {
				'old.ext': {
					extension: {
						id: 'new.ext',
						displayName: 'New',
						autoMigrate: { storage: true },
					},
				},
			},
			search: [],
		};
		const { service, reads } = createHarness([
			'evil.ext',
			{ id: 'old.ext', preRelease: true },
			{ id: 'good.ext', migrateStorageFrom: 'prev.ext' },
		], {
			getExtensionsControlManifest: async () => {
				manifestCalls++;
				return manifest;
			}
		});

		const first = service.readCustomBuiltinExtensionsInfoFromEnv();
		assert.deepStrictEqual(await first, {
			extensions: [
				{ id: 'new.ext', preRelease: true },
				{ id: 'good.ext', preRelease: false },
			],
			extensionsToMigrate: [['prev.ext', 'good.ext']],
			extensionLocations: [],
			extensionGalleryResources: [],
		});
		const afterSuccess = reads();
		assert.strictEqual(manifestCalls, 1);

		const second = service.readCustomBuiltinExtensionsInfoFromEnv();
		assert.strictEqual(second, first);
		assert.deepStrictEqual(await second, await first);
		assert.strictEqual(manifestCalls, 1);
		assert.strictEqual(reads(), afterSuccess);
	});

	test('a rejection drops the info promise only while it still points at that attempt', async () => {
		const error = new Error('late gallery resource failure');
		let rejectGallery!: (reason: Error) => void;
		let galleryCalls = 0;
		const { service, reads } = createHarness([location.toJSON()], {
			isExtensionGalleryResource: () => {
				galleryCalls++;
				return new Promise<boolean>((_resolve, reject) => { rejectGallery = reject; });
			}
		});

		const first = service.readCustomBuiltinExtensionsInfoFromEnv();
		const afterStart = reads();
		const replacement = Promise.resolve<ICustomBuiltinExtensionsInfo>({
			extensions: [],
			extensionsToMigrate: [],
			extensionLocations: [],
			extensionGalleryResources: [],
		});
		service._customBuiltinExtensionsInfoPromise = replacement;

		rejectGallery(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(service._customBuiltinExtensionsInfoPromise, replacement);
		assert.strictEqual(service.readCustomBuiltinExtensionsInfoFromEnv(), replacement);
		assert.deepStrictEqual(await replacement, {
			extensions: [],
			extensionsToMigrate: [],
			extensionLocations: [],
			extensionGalleryResources: [],
		});
		assert.strictEqual(galleryCalls, 1);
		assert.strictEqual(reads(), afterStart);
	});

	test('storage migration reads again after gallery getExtensions rejects', async () => {
		const error = new Error('gallery list failed');
		let listCalls = 0;
		const { service, reads } = createHarness([{ id: 'to.ext', migrateStorageFrom: 'from.ext' }], {
			getExtensionsControlManifest: async () => emptyControlManifest(),
			getExtensions: async () => {
				listCalls++;
				if (listCalls === 1) {
					throw error;
				}
				return [];
			}
		});

		const first = service.migrateExtensionsStorage([]);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(listCalls, 1);
		const afterFailure = reads();

		await service.migrateExtensionsStorage([]);
		assert.strictEqual(listCalls, 2);
		assert.strictEqual(reads(), afterFailure);

		await service.migrateExtensionsStorage([]);
		assert.strictEqual(listCalls, 2);
		assert.strictEqual(reads(), afterFailure);
	});

	test('storage migration shares one in-flight attempt', async () => {
		let listCalls = 0;
		let releaseList!: (value: readonly []) => void;
		const { service, reads } = createHarness([{ id: 'to.ext', migrateStorageFrom: 'from.ext' }], {
			getExtensionsControlManifest: async () => emptyControlManifest(),
			getExtensions: () => {
				listCalls++;
				return new Promise<readonly []>(resolve => { releaseList = resolve; });
			}
		});

		const first = service.migrateExtensionsStorage([]);
		const second = service.migrateExtensionsStorage([]);
		await until(() => listCalls === 1, 'in-flight migration did not reach gallery getExtensions');
		assert.strictEqual(listCalls, 1);
		const slot = service._migrateExtensionsStoragePromise;
		const afterStart = reads();

		releaseList([]);
		await first;
		await second;
		assert.strictEqual(service._migrateExtensionsStoragePromise, slot);
		assert.strictEqual(listCalls, 1);
		assert.strictEqual(reads(), afterStart);

		await service.migrateExtensionsStorage([]);
		assert.strictEqual(service._migrateExtensionsStoragePromise, slot);
		assert.strictEqual(listCalls, 1);
		assert.strictEqual(reads(), afterStart);
	});

	test('storage migration does not run again after success', async () => {
		let listCalls = 0;
		const { service, reads } = createHarness([{ id: 'to.ext', migrateStorageFrom: 'from.ext' }], {
			getExtensionsControlManifest: async () => emptyControlManifest(),
			getExtensions: async () => {
				listCalls++;
				return [];
			}
		});

		await service.migrateExtensionsStorage([]);
		assert.strictEqual(listCalls, 1);
		const afterSuccess = reads();
		const slot = service._migrateExtensionsStoragePromise;

		await service.migrateExtensionsStorage([]);
		assert.strictEqual(listCalls, 1);
		assert.strictEqual(reads(), afterSuccess);
		assert.strictEqual(service._migrateExtensionsStoragePromise, slot);
	});

	test('storage migration rejection drops the promise only while it still points at that attempt', async () => {
		const error = new Error('late gallery list failure');
		let rejectList!: (reason: Error) => void;
		let listCalls = 0;
		const { service, reads } = createHarness([{ id: 'to.ext', migrateStorageFrom: 'from.ext' }], {
			getExtensionsControlManifest: async () => emptyControlManifest(),
			getExtensions: () => {
				listCalls++;
				return new Promise<readonly []>((_resolve, reject) => { rejectList = reject; });
			}
		});

		const first = service.migrateExtensionsStorage([]);
		await until(() => listCalls === 1, 'migration did not reach gallery getExtensions');
		const afterStart = reads();
		const replacement = Promise.resolve();
		service._migrateExtensionsStoragePromise = replacement;

		rejectList(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(service._migrateExtensionsStoragePromise, replacement);
		await service.migrateExtensionsStorage([]);
		assert.strictEqual(service._migrateExtensionsStoragePromise, replacement);
		assert.strictEqual(listCalls, 1);
		assert.strictEqual(reads(), afterStart);
	});

	test('cache update reads again after the cache write rejects', async () => {
		const error = new Error('cache write failed');
		let writes = 0;
		const { service, reads } = createHarness([]);
		service.writeCustomBuiltinExtensionsCache = async () => {
			writes++;
			if (writes === 1) {
				throw error;
			}
			return [];
		};

		const first = service.updateCustomBuiltinExtensionsCache();
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(writes, 1);
		const afterFailure = reads();

		assert.deepStrictEqual(await service.updateCustomBuiltinExtensionsCache(), []);
		assert.strictEqual(writes, 2);
		assert.strictEqual(reads(), afterFailure);

		assert.deepStrictEqual(await service.updateCustomBuiltinExtensionsCache(), []);
		assert.strictEqual(writes, 2);
		assert.strictEqual(reads(), afterFailure);
	});

	test('cache update shares one in-flight attempt', async () => {
		let writes = 0;
		let releaseWrite!: (value: readonly ICachedWebExtension[]) => void;
		const { service, reads } = createHarness([]);
		service.writeCustomBuiltinExtensionsCache = () => {
			writes++;
			return new Promise<readonly ICachedWebExtension[]>(resolve => { releaseWrite = resolve; });
		};

		const first = service.updateCustomBuiltinExtensionsCache();
		const second = service.updateCustomBuiltinExtensionsCache();
		await until(() => writes === 1, 'in-flight cache update did not reach the cache write');
		assert.strictEqual(writes, 1);
		const slot = service._updateCustomBuiltinExtensionsCachePromise;
		const afterStart = reads();

		releaseWrite([]);
		assert.deepStrictEqual(await first, []);
		assert.deepStrictEqual(await second, []);
		assert.strictEqual(service._updateCustomBuiltinExtensionsCachePromise, slot);
		assert.strictEqual(writes, 1);
		assert.strictEqual(reads(), afterStart);

		assert.deepStrictEqual(await service.updateCustomBuiltinExtensionsCache(), []);
		assert.strictEqual(service._updateCustomBuiltinExtensionsCachePromise, slot);
		assert.strictEqual(writes, 1);
		assert.strictEqual(reads(), afterStart);
	});

	test('cache update does not run again after success', async () => {
		let writes = 0;
		const { service, reads } = createHarness([]);
		service.writeCustomBuiltinExtensionsCache = async () => {
			writes++;
			return [];
		};

		assert.deepStrictEqual(await service.updateCustomBuiltinExtensionsCache(), []);
		assert.strictEqual(writes, 1);
		const afterSuccess = reads();
		const slot = service._updateCustomBuiltinExtensionsCachePromise;

		assert.deepStrictEqual(await service.updateCustomBuiltinExtensionsCache(), []);
		assert.strictEqual(writes, 1);
		assert.strictEqual(reads(), afterSuccess);
		assert.strictEqual(service._updateCustomBuiltinExtensionsCachePromise, slot);
	});

	test('cache update rejection drops the promise only while it still points at that attempt', async () => {
		const error = new Error('late cache write failure');
		let rejectWrite!: (reason: Error) => void;
		let writes = 0;
		const { service, reads } = createHarness([]);
		service.writeCustomBuiltinExtensionsCache = () => {
			writes++;
			return new Promise<readonly ICachedWebExtension[]>((_resolve, reject) => { rejectWrite = reject; });
		};

		const first = service.updateCustomBuiltinExtensionsCache();
		await until(() => writes === 1, 'cache update did not reach the cache write');
		const afterStart = reads();
		const replacement = Promise.resolve<readonly ICachedWebExtension[]>([]);
		service._updateCustomBuiltinExtensionsCachePromise = replacement;

		rejectWrite(error);
		await assert.rejects(first, (reason: unknown) => reason === error);
		assert.strictEqual(service._updateCustomBuiltinExtensionsCachePromise, replacement);
		assert.deepStrictEqual(await service.updateCustomBuiltinExtensionsCache(), []);
		assert.strictEqual(service._updateCustomBuiltinExtensionsCachePromise, replacement);
		assert.strictEqual(writes, 1);
		assert.strictEqual(reads(), afterStart);
	});
});
