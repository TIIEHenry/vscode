/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { VSBuffer, bufferToStream } from '../../../../base/common/buffer.js';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IRequestContext, IRequestOptions } from '../../../../base/parts/request/common/request.js';
import { NullLogService } from '../../../log/common/log.js';
import { IRequestService } from '../../../request/common/request.js';
import { IProductService } from '../../../product/common/productService.js';
import { McpGalleryManifestService } from '../../common/mcpGalleryManifestService.js';

const GALLERY = 'https://example.test/gallery';

class ProbeManifestService extends McpGalleryManifestService {
	manifestFor(url: string, version?: string) {
		return this.createMcpGalleryManifest(url, version);
	}
}

class TestLogService extends NullLogService {
	readonly errors: unknown[] = [];
	readonly infos: string[] = [];

	override info(message: string): void {
		this.infos.push(message);
	}

	override error(message: string | Error): void {
		this.errors.push(message);
	}
}

class ScriptedRequestService implements IRequestService {
	readonly _serviceBrand: undefined;
	readonly onDidCompleteRequest = Event.None;
	readonly urls: string[] = [];

	constructor(private readonly respond: (options: IRequestOptions) => Promise<IRequestContext> | IRequestContext) { }

	async request(options: IRequestOptions): Promise<IRequestContext> {
		this.urls.push(options.url!);
		return this.respond(options);
	}

	async resolveProxy() { return undefined; }
	async lookupAuthorization() { return undefined; }
	async lookupKerberosAuthorization() { return undefined; }
	async loadCertificates() { return []; }
}

function response(statusCode: number): IRequestContext {
	return {
		res: { statusCode, headers: {} },
		stream: bufferToStream(VSBuffer.fromString('')),
	};
}

suite('McpGalleryManifestService version probe', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(respond: (options: IRequestOptions) => Promise<IRequestContext> | IRequestContext) {
		const requests = new ScriptedRequestService(respond);
		const log = new TestLogService();
		const service = store.add(new ProbeManifestService({} as IProductService, requests, log));
		return { service, requests, log };
	}

	test('an explicit version does not probe', async () => {
		const { service, requests } = createService(() => {
			throw new Error('should not probe');
		});

		const manifest = await service.manifestFor(GALLERY, 'v0');

		assert.strictEqual(manifest.version, 'v0');
		assert.strictEqual(manifest.url, GALLERY);
		assert.deepStrictEqual(requests.urls, []);
	});

	test('HTTP 200 for v0.1 is cached and not probed again', async () => {
		const { service, requests, log } = createService(() => response(200));

		const first = await service.manifestFor(GALLERY);
		const second = await service.manifestFor(`${GALLERY}/`);

		assert.strictEqual(first.version, 'v0.1');
		assert.strictEqual(second.version, 'v0.1');
		assert.strictEqual(second.url, GALLERY);
		assert.deepStrictEqual(requests.urls, [`${GALLERY}/v0.1/servers?limit=1`]);
		assert.deepStrictEqual(log.errors, []);
		assert.deepStrictEqual(log.infos, []);
	});

	test('in-flight probes share one request, and the resolved version stays cached', async () => {
		let release!: (context: IRequestContext) => void;
		const { service, requests } = createService(() => new Promise(resolve => { release = resolve; }));

		const first = service.manifestFor(GALLERY);
		const second = service.manifestFor(GALLERY);
		assert.deepStrictEqual(requests.urls, [`${GALLERY}/v0.1/servers?limit=1`]);

		release(response(200));
		assert.strictEqual((await first).version, 'v0.1');
		assert.strictEqual((await second).version, 'v0.1');
		assert.strictEqual((await service.manifestFor(GALLERY)).version, 'v0.1');
		assert.deepStrictEqual(requests.urls, [`${GALLERY}/v0.1/servers?limit=1`]);
	});

	test('authoritative non-success answers are cached as the fallback version', async () => {
		const { service, requests, log } = createService(options => {
			assert.strictEqual(options.type, 'GET');
			assert.strictEqual(options.callSite, 'mcpGalleryManifestService.checkVersion');
			return response(404);
		});

		const manifest = await service.manifestFor(GALLERY);
		assert.strictEqual(manifest.version, 'v0.1');
		assert.deepStrictEqual(requests.urls, [
			`${GALLERY}/v0.1/servers?limit=1`,
			`${GALLERY}/v0/servers?limit=1`,
		]);
		assert.deepStrictEqual(log.errors, []);
		assert.deepStrictEqual(log.infos, [
			`The service at ${GALLERY} does not support version v0.1. Service returned status 404.`,
			`The service at ${GALLERY} does not support version v0. Service returned status 404.`,
		]);

		assert.strictEqual((await service.manifestFor(GALLERY)).version, 'v0.1');
		assert.strictEqual(requests.urls.length, 2);
	});

	test('a thrown probe still returns the fallback but the next read probes again', async () => {
		let fail = true;
		const { service, requests, log } = createService(options => {
			if (fail) {
				throw new Error(`offline ${options.url}`);
			}
			return response(options.url?.includes('/v0.1/') ? 404 : 200);
		});

		const first = service.manifestFor(GALLERY);
		const second = service.manifestFor(GALLERY);
		const failed = await first;
		assert.strictEqual((await second).version, failed.version);
		assert.strictEqual(failed.version, 'v0.1');
		assert.deepStrictEqual(requests.urls, [
			`${GALLERY}/v0.1/servers?limit=1`,
			`${GALLERY}/v0/servers?limit=1`,
		]);
		assert.strictEqual(log.errors.length, 2);

		fail = false;
		const recovered = await service.manifestFor(GALLERY);
		assert.strictEqual(recovered.version, 'v0');
		assert.ok(recovered.resources.some(resource => resource.id.endsWith('/{id}')));
		assert.deepStrictEqual(requests.urls.slice(2), [
			`${GALLERY}/v0.1/servers?limit=1`,
			`${GALLERY}/v0/servers?limit=1`,
		]);

		assert.strictEqual((await service.manifestFor(GALLERY)).version, 'v0');
		assert.strictEqual(requests.urls.length, 4);
	});

});
