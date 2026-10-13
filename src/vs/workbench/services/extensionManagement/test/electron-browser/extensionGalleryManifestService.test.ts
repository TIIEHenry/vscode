/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as sinon from 'sinon';
import { IDefaultAccount } from '../../../../../base/common/defaultAccount.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { ExtensionGalleryManifestStatus, ExtensionGalleryServiceUrlConfigKey, IExtensionGalleryManifest } from '../../../../../platform/extensionManagement/common/extensionGalleryManifest.js';
import { ExtensionGalleryManifestService } from '../../../../../platform/extensionManagement/common/extensionGalleryManifestService.js';
import { NullTelemetryService } from '../../../../../platform/telemetry/common/telemetryUtils.js';
import { WorkbenchExtensionGalleryManifestService } from '../../electron-browser/extensionGalleryManifestService.js';

function galleryManifest(version: string): IExtensionGalleryManifest {
	return {
		version,
		resources: [],
		capabilities: { extensionQuery: {} },
	};
}

const enterpriseAccount: IDefaultAccount = {
	authenticationProvider: { id: 'github', name: 'GitHub', enterprise: true },
	accountName: 'octocat',
	sessionId: 'session',
	enterprise: true,
};

function createService(store: Pick<ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>, 'add'>, options: {
	serviceUrl?: string;
	configuredServiceUrl?: string;
	account?: IDefaultAccount | null;
	request?: () => Promise<unknown>;
}) {
	let configListeners = 0;
	let accountListeners = 0;
	let accountReads = 0;
	let requests = 0;

	const service = store.add(new WorkbenchExtensionGalleryManifestService(
		{
			version: '1.99.0',
			nameShort: 'Code',
			nameLong: 'Code - OSS',
			enableTelemetry: false,
			extensionsGallery: options.serviceUrl ? {
				serviceUrl: options.serviceUrl,
				controlUrl: '',
				extensionUrlTemplate: '',
				resourceUrlTemplate: '',
				nlsBaseUrl: '',
			} : undefined,
		} as never,
		{ isBuilt: true, disableTelemetry: true } as never,
		{} as never,
		NullTelemetryService,
		{} as never,
		{ getConnection: () => null } as never,
		{ getChannel: () => ({ call: () => Promise.resolve(undefined) }) } as never,
		{
			getValue: (key?: string) => key === ExtensionGalleryServiceUrlConfigKey ? options.configuredServiceUrl : undefined,
			onDidChangeConfiguration: () => {
				configListeners++;
				return { dispose() { configListeners--; } };
			},
		} as never,
		{
			request: async () => {
				requests++;
				if (!options.request) {
					throw new Error('unexpected gallery manifest request');
				}
				return options.request();
			},
		} as never,
		{
			getDefaultAccount: async () => {
				accountReads++;
				return options.account ?? null;
			},
			onDidChangeDefaultAccount: () => {
				accountListeners++;
				return { dispose() { accountListeners--; } };
			},
		} as never,
		{ trace() { }, debug() { }, info() { }, warn() { }, error() { } } as never,
		{} as never,
		{} as never,
	));

	return {
		service,
		configListeners: () => configListeners,
		accountListeners: () => accountListeners,
		accountReads: () => accountReads,
		requests: () => requests,
	};
}

suite('WorkbenchExtensionGalleryManifestService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	setup(() => {
		store.add(toDisposable(() => sinon.restore()));
	});

	test('retries the default gallery manifest after super.getExtensionGalleryManifest rejects', async () => {
		let reads = 0;
		let rejectFirst!: (error: Error) => void;
		const manifest = galleryManifest('1');
		sinon.stub(ExtensionGalleryManifestService.prototype, 'getExtensionGalleryManifest').callsFake(() => {
			reads++;
			if (reads === 1) {
				return new Promise<IExtensionGalleryManifest>((_resolve, reject) => { rejectFirst = reject; });
			}
			return Promise.resolve(manifest);
		});

		const seen = createService(store, { serviceUrl: 'https://marketplace.example' });
		const first = seen.service.getExtensionGalleryManifest();
		assert.strictEqual(reads, 1);
		assert.strictEqual(seen.configListeners(), 0);
		assert.strictEqual(seen.accountListeners(), 0);

		// The constructor reports the rejected first read through onUnexpectedError.
		const originalUnexpectedErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(() => { });
		try {
			rejectFirst(new Error('gallery offline'));
			await assert.rejects(first, (error: unknown) => error instanceof Error && error.message === 'gallery offline');
			await Promise.resolve();
		} finally {
			setUnexpectedErrorHandler(originalUnexpectedErrorHandler);
		}

		assert.strictEqual(reads, 1);
		assert.strictEqual(seen.configListeners(), 0);
		assert.strictEqual(seen.accountListeners(), 0);
		assert.strictEqual(seen.service.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.Unavailable);

		const retryA = seen.service.getExtensionGalleryManifest();
		const retryB = seen.service.getExtensionGalleryManifest();
		assert.strictEqual(reads, 2);
		assert.strictEqual(await retryA, manifest);
		assert.strictEqual(await retryB, manifest);
		assert.strictEqual(reads, 2);
		assert.strictEqual(seen.configListeners(), 1);
		assert.strictEqual(seen.accountListeners(), 0);
		assert.strictEqual(seen.service.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.Available);

		assert.strictEqual(await seen.service.getExtensionGalleryManifest(), manifest);
		assert.strictEqual(reads, 2);
		assert.strictEqual(seen.configListeners(), 1);
		assert.strictEqual(seen.accountListeners(), 0);
	});

	test('keeps AccessDenied when the enterprise manifest fetch is caught and does not request again', async () => {
		let rejectRequest!: (error: Error) => void;
		let markStarted!: () => void;
		const started = new Promise<void>(resolve => { markStarted = resolve; });
		sinon.stub(ExtensionGalleryManifestService.prototype, 'getExtensionGalleryManifest').callsFake(() => {
			throw new Error('default gallery should not be read');
		});

		const seen = createService(store, {
			serviceUrl: 'https://marketplace.example',
			configuredServiceUrl: 'https://enterprise.example/gallery',
			account: enterpriseAccount,
			request: () => new Promise((_resolve, reject) => {
				rejectRequest = reject;
				markStarted();
			}),
		});

		const first = seen.service.getExtensionGalleryManifest();
		await started;
		assert.strictEqual(seen.requests(), 1);
		assert.strictEqual(seen.accountReads(), 1);
		assert.strictEqual(seen.configListeners(), 0);
		assert.strictEqual(seen.accountListeners(), 0);

		rejectRequest(new Error('enterprise manifest failed'));
		assert.strictEqual(await first, null);
		assert.strictEqual(seen.service.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.AccessDenied);
		assert.strictEqual(seen.requests(), 1);
		assert.strictEqual(seen.accountReads(), 1);
		assert.strictEqual(seen.configListeners(), 1);
		assert.strictEqual(seen.accountListeners(), 1);

		assert.strictEqual(await seen.service.getExtensionGalleryManifest(), null);
		assert.strictEqual(seen.service.extensionGalleryManifestStatus, ExtensionGalleryManifestStatus.AccessDenied);
		assert.strictEqual(seen.requests(), 1);
		assert.strictEqual(seen.accountReads(), 1);
		assert.strictEqual(seen.configListeners(), 1);
		assert.strictEqual(seen.accountListeners(), 1);
	});

	test('shares one in-flight default gallery manifest read', async () => {
		let reads = 0;
		let resolveRead!: (manifest: IExtensionGalleryManifest) => void;
		const manifest = galleryManifest('2');
		sinon.stub(ExtensionGalleryManifestService.prototype, 'getExtensionGalleryManifest').callsFake(() => {
			reads++;
			return new Promise(resolve => { resolveRead = resolve; });
		});

		const seen = createService(store, { serviceUrl: 'https://marketplace.example' });
		const first = seen.service.getExtensionGalleryManifest();
		const second = seen.service.getExtensionGalleryManifest();
		assert.strictEqual(reads, 1);
		assert.strictEqual(seen.configListeners(), 0);
		assert.strictEqual(seen.accountListeners(), 0);

		resolveRead(manifest);
		assert.strictEqual(await first, manifest);
		assert.strictEqual(await second, manifest);
		assert.strictEqual(reads, 1);
		assert.strictEqual(seen.configListeners(), 1);
		assert.strictEqual(seen.accountListeners(), 0);

		assert.strictEqual(await seen.service.getExtensionGalleryManifest(), manifest);
		assert.strictEqual(reads, 1);
		assert.strictEqual(seen.configListeners(), 1);
		assert.strictEqual(seen.accountListeners(), 0);
	});

});
