/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../configuration/test/common/testConfigurationService.js';
import { IEnvironmentService } from '../../../environment/common/environment.js';
import { ExtensionGalleryManifestStatus, IExtensionGalleryManifestService } from '../../../extensionManagement/common/extensionGalleryManifest.js';
import { getServiceMachineId } from '../../../externalServices/common/serviceMachineId.js';
import { IFileService } from '../../../files/common/files.js';
import { NullLogService } from '../../../log/common/log.js';
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

	function createLoader(readServiceMachineId: typeof getServiceMachineId): TestExtensionResourceLoaderService {
		return disposables.add(new TestExtensionResourceLoaderService(
			new class extends mock<IFileService>() { }(),
			disposables.add(new InMemoryStorageService()),
			productService,
			environmentService,
			configurationService,
			manifestService,
			new NullLogService(),
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
});
