/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../configuration/test/common/testConfigurationService.js';
import { IEnvironmentService } from '../../../environment/common/environment.js';
import { ExtensionGalleryManifestStatus, IExtensionGalleryManifest, IExtensionGalleryManifestService } from '../../../extensionManagement/common/extensionGalleryManifest.js';
import { getServiceMachineId } from '../../../externalServices/common/serviceMachineId.js';
import { IFileService } from '../../../files/common/files.js';
import { ILogService, NullLogService } from '../../../log/common/log.js';
import product from '../../../product/common/product.js';
import { IProductService } from '../../../product/common/productService.js';
import { InMemoryStorageService } from '../../../storage/common/storage.js';
import { TelemetryConfiguration, TELEMETRY_SETTING_ID } from '../../../telemetry/common/telemetry.js';
import { AbstractExtensionResourceLoaderService } from '../../common/extensionResourceLoader.js';

class TestEnvironmentService extends mock<IEnvironmentService>() {
	override readonly serviceMachineIdResource = URI.parse('inmemory://machine-id');
	override readonly isBuilt = true;
	override readonly disableTelemetry = false;
}

class TestExtensionResourceLoaderService extends AbstractExtensionResourceLoaderService {
	override readExtensionResource(): Promise<string> {
		return Promise.resolve('');
	}

	getHeaders(): Promise<Record<string, string>> {
		return this.getExtensionGalleryRequestHeaders();
	}
}

class DeferredMachineIdReads {
	count = 0;
	private readonly pending: { resolve: (id: string) => void; reject: (error: Error) => void }[] = [];

	get pendingCount(): number {
		return this.pending.length;
	}

	readonly read: typeof getServiceMachineId = async () => {
		this.count++;
		return new Promise<string>((resolve, reject) => {
			this.pending.push({ resolve, reject });
		});
	};

	settleNext(error?: Error, id = 'machine-id'): void {
		const next = this.pending.shift();
		assert.ok(next, 'expected a pending service machine id read');
		if (error) {
			next.reject(error);
		} else {
			next.resolve(id);
		}
	}
}

suite('ExtensionResourceLoaderService', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	const manifestService: IExtensionGalleryManifestService = {
		_serviceBrand: undefined,
		extensionGalleryManifestStatus: ExtensionGalleryManifestStatus.Unavailable,
		onDidChangeExtensionGalleryManifestStatus: Event.None,
		onDidChangeExtensionGalleryManifest: Event.None,
		getExtensionGalleryManifest: async () => null,
	};
	const productService: IProductService = { _serviceBrand: undefined, ...product, enableTelemetry: true };
	const environmentService = new TestEnvironmentService();
	const configurationService = new TestConfigurationService({ [TELEMETRY_SETTING_ID]: TelemetryConfiguration.ON });

	function createLoader(
		readServiceMachineId: typeof getServiceMachineId,
		gallery: IExtensionGalleryManifestService = manifestService,
		logService: ILogService = new NullLogService(),
	): TestExtensionResourceLoaderService {
		return disposables.add(new TestExtensionResourceLoaderService(
			new class extends mock<IFileService>() { }(),
			disposables.add(new InMemoryStorageService()),
			productService,
			environmentService,
			configurationService,
			gallery,
			logService,
			readServiceMachineId,
		));
	}

	test('reads the service machine id again after the first read fails', async () => {
		let count = 0;
		const loader = createLoader(async () => {
			count++;
			if (count === 1) {
				throw new Error('service machine id failed');
			}
			return 'machine-2';
		});

		await assert.rejects(loader.getHeaders(), /service machine id failed/);
		const headers = await loader.getHeaders();

		assert.deepStrictEqual({
			reads: count,
			machineId: headers['X-Machine-Id'],
		}, {
			reads: 2,
			machineId: 'machine-2',
		});
	});

	test('shares one in-flight service machine id read', async () => {
		const reads = new DeferredMachineIdReads();
		const loader = createLoader(reads.read);
		const first = loader.getHeaders();
		const second = loader.getHeaders();
		const readsWhileInFlight = reads.count;
		while (reads.pendingCount > 0) {
			reads.settleNext(undefined, 'machine-id');
		}
		const headers = await Promise.all([first, second]);

		assert.deepStrictEqual({
			reads: readsWhileInFlight,
			machineIds: headers.map(header => header['X-Machine-Id']),
		}, {
			reads: 1,
			machineIds: ['machine-id', 'machine-id'],
		});
	});

	test('does not read the service machine id again after it succeeds', async () => {
		let count = 0;
		const loader = createLoader(async () => {
			count++;
			return 'machine-id';
		});

		const first = await loader.getHeaders();
		const second = await loader.getHeaders();

		assert.deepStrictEqual({
			reads: count,
			machineIds: [first['X-Machine-Id'], second['X-Machine-Id']],
		}, {
			reads: 1,
			machineIds: ['machine-id', 'machine-id'],
		});
	});

	test('reads the gallery manifest again after the first read fails', async () => {
		const gallery = new DeferredGalleryManifest(disposables);
		const log = new CaptureLogService();
		const loader = createLoader(async () => 'machine-id', gallery.service, log);
		const extension = { publisher: 'pub', name: 'ext', version: '1.0.0' };

		const first = loader.supportsExtensionGalleryResources();
		assert.strictEqual(gallery.reads, 1);
		gallery.settleNext(new Error('gallery manifest failed'));
		assert.strictEqual(await first, false);
		assert.strictEqual(gallery.listeners, 0);
		assert.ok(log.errors.some(error => error instanceof Error && error.message === 'gallery manifest failed'));

		const second = loader.getExtensionGalleryResourceURL(extension);
		assert.strictEqual(gallery.reads, 2);
		gallery.settleNext(undefined, extensionGalleryManifest('https://gallery.example/{publisher}/{name}/{version}/{path}'));
		const url = await second;

		assert.strictEqual(url?.authority, 'gallery.example');
		assert.strictEqual(gallery.reads, 2);
		assert.strictEqual(gallery.listeners, 1);
	});

	test('reads the gallery manifest again after a synchronous failure', async () => {
		let reads = 0;
		const gallery = galleryService(() => {
			reads++;
			if (reads === 1) {
				throw new Error('gallery manifest failed sync');
			}
			return Promise.resolve(extensionGalleryManifest('https://gallery.example/{publisher}/{name}/{version}/{path}'));
		});
		const log = new CaptureLogService();
		const loader = createLoader(async () => 'machine-id', gallery, log);

		assert.strictEqual(await loader.supportsExtensionGalleryResources(), false);
		assert.strictEqual(reads, 1);
		assert.strictEqual(log.errors.length, 1);

		const url = await loader.getExtensionGalleryResourceURL({ publisher: 'pub', name: 'ext', version: '1.0.0' });
		assert.strictEqual(reads, 2);
		assert.strictEqual(url?.authority, 'gallery.example');
	});

	test('shares one in-flight gallery manifest read', async () => {
		const gallery = new DeferredGalleryManifest(disposables);
		const loader = createLoader(async () => 'machine-id', gallery.service);
		const extension = { publisher: 'pub', name: 'ext', version: '1.0.0' };

		const supports = loader.supportsExtensionGalleryResources();
		const url = loader.getExtensionGalleryResourceURL(extension);
		const isGallery = loader.isExtensionGalleryResource(URI.parse('https://gallery.example/pub/ext/1.0.0/extension'));
		assert.strictEqual(gallery.reads, 1);

		gallery.settleNext(undefined, extensionGalleryManifest('https://gallery.example/{publisher}/{name}/{version}/{path}'));
		const [supportsResult, urlResult, isGalleryResult] = await Promise.all([supports, url, isGallery]);

		assert.deepStrictEqual({
			reads: gallery.reads,
			listeners: gallery.listeners,
			supports: supportsResult,
			authority: urlResult?.authority,
			isGallery: isGalleryResult,
		}, {
			reads: 1,
			listeners: 1,
			supports: true,
			authority: 'gallery.example',
			isGallery: true,
		});
	});

	test('does not read the gallery manifest again after it succeeds', async () => {
		const gallery = new DeferredGalleryManifest(disposables);
		const loader = createLoader(async () => 'machine-id', gallery.service);
		const extension = { publisher: 'pub', name: 'ext', version: '1.0.0' };

		const first = loader.supportsExtensionGalleryResources();
		gallery.settleNext(undefined, extensionGalleryManifest('https://gallery.example/{publisher}/{name}/{version}/{path}'));
		assert.strictEqual(await first, true);

		await loader.supportsExtensionGalleryResources();
		const url = await loader.getExtensionGalleryResourceURL(extension);
		assert.strictEqual(await loader.isExtensionGalleryResource(url!), true);

		assert.strictEqual(gallery.reads, 1);
		assert.strictEqual(gallery.listeners, 1);
	});

	test('does not read the gallery manifest again when the read succeeds with null', async () => {
		const gallery = new DeferredGalleryManifest(disposables);
		const loader = createLoader(async () => 'machine-id', gallery.service);

		const first = loader.supportsExtensionGalleryResources();
		gallery.settleNext(undefined, null);
		assert.strictEqual(await first, false);
		assert.strictEqual(await loader.getExtensionGalleryResourceURL({ publisher: 'pub', name: 'ext', version: '1.0.0' }), undefined);
		assert.strictEqual(gallery.reads, 1);
		assert.strictEqual(gallery.listeners, 1);
	});

	test('registers the gallery manifest change listener once and applies the event manifest', async () => {
		const gallery = new DeferredGalleryManifest(disposables);
		const loader = createLoader(async () => 'machine-id', gallery.service);
		const extension = { publisher: 'pub', name: 'ext', version: '1.0.0' };

		const first = loader.getExtensionGalleryResourceURL(extension);
		gallery.settleNext(undefined, extensionGalleryManifest('https://first.example/{publisher}/{name}/{version}/{path}'));
		assert.strictEqual((await first)?.authority, 'first.example');
		assert.strictEqual(gallery.listeners, 1);

		gallery.fire(extensionGalleryManifest('https://second.example/{publisher}/{name}/{version}/{path}'));
		const updated = await loader.getExtensionGalleryResourceURL(extension);
		await loader.supportsExtensionGalleryResources();
		await loader.isExtensionGalleryResource(updated!);

		assert.strictEqual(updated?.authority, 'second.example');
		assert.strictEqual(gallery.reads, 1);
		assert.strictEqual(gallery.listeners, 1);

		gallery.fire(null);
		assert.strictEqual(await loader.supportsExtensionGalleryResources(), false);
		assert.strictEqual(gallery.reads, 1);
		assert.strictEqual(gallery.listeners, 1);
	});
});

class CaptureLogService extends NullLogService {
	readonly errors: (string | Error)[] = [];
	override error(message: string | Error, ..._args: unknown[]): void {
		this.errors.push(message);
	}
}

function extensionGalleryManifest(resourceUri: string): IExtensionGalleryManifest {
	return {
		version: '3.0-preview.1',
		resources: [{ id: resourceUri, type: 'ExtensionResourceUriTemplate' }],
		capabilities: { extensionQuery: {} },
	};
}

function galleryService(read: () => Promise<IExtensionGalleryManifest | null>): IExtensionGalleryManifestService {
	return {
		_serviceBrand: undefined,
		extensionGalleryManifestStatus: ExtensionGalleryManifestStatus.Unavailable,
		onDidChangeExtensionGalleryManifestStatus: Event.None,
		onDidChangeExtensionGalleryManifest: Event.None,
		getExtensionGalleryManifest: read,
	};
}

class DeferredGalleryManifest {
	reads = 0;
	listeners = 0;
	private readonly pending: { resolve: (manifest: IExtensionGalleryManifest | null) => void; reject: (error: Error) => void }[] = [];
	private readonly emitter: Emitter<IExtensionGalleryManifest | null>;
	readonly service: IExtensionGalleryManifestService;

	constructor(disposables: Pick<ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>, 'add'>) {
		this.emitter = disposables.add(new Emitter<IExtensionGalleryManifest | null>());
		this.service = {
			_serviceBrand: undefined,
			extensionGalleryManifestStatus: ExtensionGalleryManifestStatus.Unavailable,
			onDidChangeExtensionGalleryManifestStatus: Event.None,
			onDidChangeExtensionGalleryManifest: (listener, thisArgs, extra) => {
				this.listeners++;
				return this.emitter.event(listener, thisArgs, extra);
			},
			getExtensionGalleryManifest: () => {
				this.reads++;
				return new Promise((resolve, reject) => {
					this.pending.push({ resolve, reject });
				});
			},
		};
	}

	settleNext(error?: Error, manifest: IExtensionGalleryManifest | null = null): void {
		const next = this.pending.shift();
		assert.ok(next, 'expected a pending gallery manifest read');
		if (error) {
			next.reject(error);
		} else {
			next.resolve(manifest);
		}
	}

	fire(manifest: IExtensionGalleryManifest | null): void {
		this.emitter.fire(manifest);
	}
}
