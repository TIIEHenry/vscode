/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { IConfigurationChangeEvent, IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { NullLogService } from '../../../../../platform/log/common/log.js';
import { IMcpGalleryManifest, McpGalleryManifestStatus } from '../../../../../platform/mcp/common/mcpGalleryManifest.js';
import { mcpGalleryServiceUrlConfig } from '../../../../../platform/mcp/common/mcpManagement.js';
import { IProductService } from '../../../../../platform/product/common/productService.js';
import { IRequestService } from '../../../../../platform/request/common/request.js';
import { IRemoteAgentService } from '../../../remote/common/remoteAgentService.js';
import { WorkbenchMcpGalleryManifestService } from '../../browser/mcpGalleryManifestService.js';

const GALLERY = 'https://example.test/gallery';

class CountingConfigurationService extends TestConfigurationService {
	listenerCount = 0;

	constructor(configuration?: Record<string, unknown>) {
		super(configuration);
		const event = this.onDidChangeConfiguration;
		const wrapped: Event<IConfigurationChangeEvent> = (listener, thisArgs, disposables) => {
			this.listenerCount++;
			const subscription = event(listener, thisArgs, disposables);
			const originalDispose = subscription.dispose.bind(subscription);
			subscription.dispose = () => {
				this.listenerCount--;
				originalDispose();
			};
			return subscription;
		};
		(this as { onDidChangeConfiguration: Event<IConfigurationChangeEvent> }).onDidChangeConfiguration = wrapped;
	}
}

class ScriptedGalleryManifestService extends WorkbenchMcpGalleryManifestService {
	creates = 0;
	private failTimes: number;
	private gate: Promise<void> | undefined;
	private releaseGate: (() => void) | undefined;

	constructor(configurationService: IConfigurationService, failTimes: number) {
		super(
			{} as IProductService,
			{ getConnection: () => null } as IRemoteAgentService,
			{} as IRequestService,
			new NullLogService(),
			configurationService,
		);
		this.failTimes = failTimes;
	}

	blockNextCreate(): void {
		this.gate = new Promise<void>(resolve => {
			this.releaseGate = resolve;
		});
	}

	release(): void {
		const release = this.releaseGate;
		this.releaseGate = undefined;
		this.gate = undefined;
		release?.();
	}

	protected override async createMcpGalleryManifest(url: string, version?: string): Promise<IMcpGalleryManifest> {
		this.creates++;
		if (this.gate) {
			const gate = this.gate;
			this.gate = undefined;
			await gate;
		}
		if (this.failTimes > 0) {
			this.failTimes--;
			throw new Error('gallery unavailable');
		}
		return {
			url,
			version: version ?? 'v0.1',
			resources: [],
		};
	}
}

function drain(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

suite('WorkbenchMcpGalleryManifestService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(failTimes = 0): { service: ScriptedGalleryManifestService; configuration: CountingConfigurationService } {
		const configuration = new CountingConfigurationService({
			'chat.mcp.gallery': {
				serviceUrl: GALLERY,
				version: 'v0.1',
			},
		});
		const service = store.add(new ScriptedGalleryManifestService(configuration, failTimes));
		store.add(configuration.onDidChangeConfigurationEmitter);
		return { service, configuration };
	}

	test('a rejected manifest read is fetched again and can succeed', async () => {
		const { service, configuration } = createService(1);

		await assert.rejects(() => service.getMcpGalleryManifest(), /gallery unavailable/);
		assert.strictEqual(service.creates, 1);
		assert.strictEqual(service.mcpGalleryManifestStatus, McpGalleryManifestStatus.Unavailable);
		assert.strictEqual(configuration.listenerCount, 1);

		const manifest = await service.getMcpGalleryManifest();
		assert.strictEqual(manifest?.url, GALLERY);
		assert.strictEqual(manifest?.version, 'v0.1');
		assert.strictEqual(service.creates, 2);
		assert.strictEqual(service.mcpGalleryManifestStatus, McpGalleryManifestStatus.Available);
		assert.strictEqual(configuration.listenerCount, 1);

		assert.strictEqual(await service.getMcpGalleryManifest(), manifest);
		assert.strictEqual(service.creates, 2);
		assert.strictEqual(configuration.listenerCount, 1);
	});

	test('in-flight manifest reads share one create', async () => {
		const { service, configuration } = createService();
		service.blockNextCreate();

		const first = service.getMcpGalleryManifest();
		const second = service.getMcpGalleryManifest();
		await drain();
		assert.strictEqual(service.creates, 1);
		assert.strictEqual(configuration.listenerCount, 1);

		service.release();
		const [left, right] = await Promise.all([first, second]);
		assert.strictEqual(left, right);
		assert.strictEqual(left?.url, GALLERY);
		assert.strictEqual(left?.version, 'v0.1');

		const third = await service.getMcpGalleryManifest();
		assert.strictEqual(third, left);
		assert.strictEqual(service.creates, 1);
		assert.strictEqual(configuration.listenerCount, 1);
	});

	test('a successful read does not register the configuration listener again', async () => {
		const { service, configuration } = createService();

		const manifest = await service.getMcpGalleryManifest();
		assert.strictEqual(manifest?.url, GALLERY);
		assert.strictEqual(configuration.listenerCount, 1);
		assert.strictEqual(service.creates, 1);

		await service.getMcpGalleryManifest();
		assert.strictEqual(service.creates, 1);
		assert.strictEqual(configuration.listenerCount, 1);

		configuration.onDidChangeConfigurationEmitter.fire({
			affectsConfiguration: (key: string) => key === mcpGalleryServiceUrlConfig,
		} as IConfigurationChangeEvent);
		await drain();
		assert.strictEqual(service.creates, 2);
		assert.strictEqual(configuration.listenerCount, 1);

		configuration.onDidChangeConfigurationEmitter.fire({
			affectsConfiguration: () => false,
		} as IConfigurationChangeEvent);
		await drain();
		assert.strictEqual(service.creates, 2);
		assert.strictEqual(configuration.listenerCount, 1);
	});

});
