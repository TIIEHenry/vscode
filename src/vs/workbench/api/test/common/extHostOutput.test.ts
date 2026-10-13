/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../base/common/async.js';
import { Event } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { URI } from '../../../../base/common/uri.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IExtensionDescription } from '../../../../platform/extensions/common/extensions.js';
import { ILogger, ILoggerService, ILogService, LogLevel } from '../../../../platform/log/common/log.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { ExtHostOutputService } from '../../common/extHostOutput.js';
import { FileSystemError } from '../../common/extHostTypes.js';
import { IExtHostConsumerFileSystem } from '../../common/extHostFileSystemConsumer.js';
import { ExtHostFileSystemInfo } from '../../common/extHostFileSystemInfo.js';
import { IExtHostInitDataService } from '../../common/extHostInitDataService.js';
import { IExtHostRpcService } from '../../common/extHostRpcService.js';

interface IDirectoryCall {
	readonly uri: URI;
	readonly result: DeferredPromise<void>;
}

function doCreateOutputChannel(service: ExtHostOutputService, name: string, channelDisposables: DisposableStore): Promise<{ dispose(): void }> {
	const create = Reflect.get(service, 'doCreateOutputChannel') as (
		name: string,
		languageId: string | undefined,
		extension: IExtensionDescription,
		channelDisposables: DisposableStore,
	) => Promise<{ dispose(): void }>;
	return create.call(service, name, undefined, nullExtensionDescription, channelDisposables);
}

function outputDirectoryPromise(service: ExtHostOutputService): Thenable<URI> | undefined {
	return Reflect.get(service, 'outputDirectoryPromise') as Thenable<URI> | undefined;
}

function setOutputDirectoryPromise(service: ExtHostOutputService, promise: Thenable<URI> | undefined): void {
	Reflect.set(service, 'outputDirectoryPromise', promise);
}

function createExtensionLogDirectory(service: ExtHostOutputService, file: URI): Thenable<void> {
	const create = Reflect.get(service, 'createExtensionLogDirectory') as (file: URI) => Thenable<void>;
	return create.call(service, file);
}

function extensionLogPromises(service: ExtHostOutputService): ResourceMap<Thenable<void>> {
	return Reflect.get(service, 'extensionLogDirectoryCreationPromise') as ResourceMap<Thenable<void>>;
}

function registeredChannelCount(service: ExtHostOutputService): number {
	return (Reflect.get(service, 'channels') as Map<string, unknown>).size;
}

function isError(error: unknown, message: string): boolean {
	return error instanceof Error && error.message === message;
}

async function until(predicate: () => boolean): Promise<void> {
	for (let i = 0; i < 10 && !predicate(); i++) {
		await new Promise(resolve => setTimeout(resolve, 0));
	}
	assert.ok(predicate());
}

function createHarness(store: Pick<DisposableStore, 'add'>): { service: ExtHostOutputService; calls: IDirectoryCall[]; fileSystemInfo: ExtHostFileSystemInfo } {
	const calls: IDirectoryCall[] = [];
	const fileSystemInfo = new ExtHostFileSystemInfo();
	const extHostFileSystem = {
		_serviceBrand: undefined,
		value: {
			createDirectory: (uri: URI) => {
				const result = new DeferredPromise<void>();
				calls.push({ uri, result });
				return result.p;
			},
		},
	} as IExtHostConsumerFileSystem;
	const initData = {
		logsLocation: URI.file('/logs'),
		environment: {},
	} as IExtHostInitDataService;
	let nextChannelId = 0;
	const rpc = {
		_serviceBrand: undefined,
		getProxy: () => ({
			$register: async () => `channel-${++nextChannelId}`,
			$update: async () => { },
			$reveal: async () => { },
			$close: async () => { },
			$dispose: async () => { },
			dispose() { },
		}),
		set: () => { throw new Error('unused'); },
		dispose() { },
		assertRegistered() { },
		drain: async () => { },
	} as IExtHostRpcService;
	const logger: ILogger = {
		onDidChangeLogLevel: Event.None,
		setLevel() { },
		getLevel: () => LogLevel.Info,
		trace() { },
		debug() { },
		info() { },
		warn() { },
		error() { },
		flush() { },
		dispose() { },
	};
	const loggerService = {
		_serviceBrand: undefined,
		createLogger: () => logger,
		getRegisteredLogger: () => undefined,
		deregisterLogger() { },
	} as ILoggerService;
	const logService = {
		_serviceBrand: undefined,
		onDidChangeLogLevel: Event.None,
		getLevel: () => LogLevel.Info,
		setLevel() { },
		trace() { },
		debug() { },
		info() { },
		warn() { },
		error() { },
		flush() { },
		dispose() { },
	} as ILogService;
	const service = new ExtHostOutputService(rpc, initData, extHostFileSystem, fileSystemInfo, loggerService, logService);
	return { service, calls, fileSystemInfo };
}

suite('ExtHostOutputService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('creates the output directory again after the first attempt fails', async () => {
		const { service, calls } = createHarness(store);
		const firstDisposables = store.add(new DisposableStore());
		const first = doCreateOutputChannel(service, 'Alpha', firstDisposables);
		const failed = outputDirectoryPromise(service);
		assert.ok(failed);
		assert.strictEqual(calls.length, 1);

		await calls[0].result.error(new Error('create failed'));
		await assert.rejects(first, (error: unknown) => isError(error, 'create failed'));
		assert.strictEqual(outputDirectoryPromise(service), undefined);

		const secondDisposables = store.add(new DisposableStore());
		const second = doCreateOutputChannel(service, 'Beta', secondDisposables);
		assert.strictEqual(calls.length, 2);
		assert.notStrictEqual(outputDirectoryPromise(service), failed);
		await calls[1].result.complete();
		store.add(await second);
	});

	test('in-flight output channels share one directory creation', async () => {
		const { service, calls } = createHarness(store);
		const firstDisposables = store.add(new DisposableStore());
		const secondDisposables = store.add(new DisposableStore());
		const first = doCreateOutputChannel(service, 'Alpha', firstDisposables);
		const second = doCreateOutputChannel(service, 'Beta', secondDisposables);
		const shared = outputDirectoryPromise(service);

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(outputDirectoryPromise(service), shared);

		await calls[0].result.complete();
		store.add(await first);
		store.add(await second);
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(outputDirectoryPromise(service), shared);
	});

	test('does not create the output directory again after it succeeds', async () => {
		const { service, calls } = createHarness(store);
		const firstDisposables = store.add(new DisposableStore());
		const first = doCreateOutputChannel(service, 'Alpha', firstDisposables);
		const cached = outputDirectoryPromise(service);
		assert.strictEqual(calls.length, 1);

		await calls[0].result.complete();
		store.add(await first);

		const secondDisposables = store.add(new DisposableStore());
		const second = doCreateOutputChannel(service, 'Beta', secondDisposables);
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(outputDirectoryPromise(service), cached);
		store.add(await second);
	});

	test('an older output directory rejection does not drop a newer attempt', async () => {
		const { service, calls } = createHarness(store);
		const firstDisposables = store.add(new DisposableStore());
		const first = doCreateOutputChannel(service, 'Alpha', firstDisposables);
		const attempt = outputDirectoryPromise(service);
		assert.ok(attempt);
		const replacement = Promise.resolve(URI.file('/logs/replacement'));
		setOutputDirectoryPromise(service, replacement);

		await calls[0].result.error(new Error('stale'));
		await assert.rejects(first, (error: unknown) => isError(error, 'stale'));
		assert.strictEqual(outputDirectoryPromise(service), replacement);

		const secondDisposables = store.add(new DisposableStore());
		const second = doCreateOutputChannel(service, 'Beta', secondDisposables);
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(outputDirectoryPromise(service), replacement);
		store.add(await second);
	});

	test('createOutputChannel shares one output directory and does not create it again after success', async () => {
		const { service, calls } = createHarness(store);
		const alpha = service.createOutputChannel('Alpha', undefined, nullExtensionDescription);
		const beta = service.createOutputChannel('Beta', undefined, nullExtensionDescription);
		assert.strictEqual(calls.length, 1);

		await calls[0].result.complete();
		await until(() => registeredChannelCount(service) === 2);

		const gamma = service.createOutputChannel('Gamma', undefined, nullExtensionDescription);
		assert.strictEqual(calls.length, 1);
		await until(() => registeredChannelCount(service) === 3);
		alpha.dispose();
		beta.dispose();
		gamma.dispose();
	});

	test('creates an extension log directory again after a non-FileExists failure', async () => {
		const { service, calls, fileSystemInfo } = createHarness(store);
		const alpha = URI.file('/logs/ext/alpha.log');
		const first = createExtensionLogDirectory(service, alpha);
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].uri.toString(), fileSystemInfo.extUri.dirname(alpha).toString());
		const failed = extensionLogPromises(service).get(calls[0].uri);
		assert.ok(failed);

		await calls[0].result.error(new Error('create failed'));
		await assert.rejects(first, (error: unknown) => isError(error, 'create failed'));
		assert.strictEqual(extensionLogPromises(service).get(calls[0].uri), undefined);

		const second = createExtensionLogDirectory(service, URI.file('/logs/ext/beta.log'));
		assert.strictEqual(calls.length, 2);
		assert.notStrictEqual(extensionLogPromises(service).get(calls[1].uri), failed);
		await calls[1].result.complete();
		await second;
	});

	test('in-flight extension log directories share one creation', async () => {
		const { service, calls } = createHarness(store);
		const first = createExtensionLogDirectory(service, URI.file('/logs/ext/alpha.log'));
		const second = createExtensionLogDirectory(service, URI.file('/logs/ext/beta.log'));
		const shared = extensionLogPromises(service).get(calls[0].uri);

		assert.strictEqual(calls.length, 1);
		assert.strictEqual(extensionLogPromises(service).get(calls[0].uri), shared);

		await calls[0].result.complete();
		await first;
		await second;
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(extensionLogPromises(service).get(calls[0].uri), shared);
	});

	test('does not create an extension log directory again after it succeeds', async () => {
		const { service, calls } = createHarness(store);
		const first = createExtensionLogDirectory(service, URI.file('/logs/ext/alpha.log'));
		const cached = extensionLogPromises(service).get(calls[0].uri);
		assert.strictEqual(calls.length, 1);

		await calls[0].result.complete();
		await first;

		const second = createExtensionLogDirectory(service, URI.file('/logs/ext/beta.log'));
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(extensionLogPromises(service).get(calls[0].uri), cached);
		await second;
	});

	test('treats FileExists as success and caches the extension log directory', async () => {
		const { service, calls, fileSystemInfo } = createHarness(store);
		const alpha = URI.file('/logs/ext/alpha.log');
		const first = createExtensionLogDirectory(service, alpha);
		const second = createExtensionLogDirectory(service, URI.file('/logs/ext/beta.log'));
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(calls[0].uri.toString(), fileSystemInfo.extUri.dirname(alpha).toString());
		const cached = extensionLogPromises(service).get(calls[0].uri);

		await calls[0].result.error(FileSystemError.FileExists(calls[0].uri));
		await first;
		await second;
		assert.strictEqual(extensionLogPromises(service).get(calls[0].uri), cached);

		const third = createExtensionLogDirectory(service, URI.file('/logs/ext/gamma.log'));
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(extensionLogPromises(service).get(calls[0].uri), cached);
		await third;
	});

	test('an older extension log directory rejection does not drop a newer attempt', async () => {
		const { service, calls } = createHarness(store);
		const first = createExtensionLogDirectory(service, URI.file('/logs/ext/alpha.log'));
		const directory = calls[0].uri;
		const attempt = extensionLogPromises(service).get(directory);
		assert.ok(attempt);
		const replacement = Promise.resolve();
		extensionLogPromises(service).set(directory, replacement);

		await calls[0].result.error(new Error('stale'));
		await assert.rejects(first, (error: unknown) => isError(error, 'stale'));
		assert.strictEqual(extensionLogPromises(service).get(directory), replacement);

		const second = createExtensionLogDirectory(service, URI.file('/logs/ext/beta.log'));
		assert.strictEqual(calls.length, 1);
		assert.strictEqual(extensionLogPromises(service).get(directory), replacement);
		await second;
	});

	test('createOutputChannel treats FileExists as a cached extension log directory', async () => {
		const { service, calls } = createHarness(store);
		const alpha = service.createOutputChannel('Alpha', { log: true }, nullExtensionDescription);
		const beta = service.createOutputChannel('Beta', { log: true }, nullExtensionDescription);
		assert.strictEqual(calls.length, 1);

		await calls[0].result.error(FileSystemError.FileExists(calls[0].uri));
		await until(() => registeredChannelCount(service) === 2);

		const gamma = service.createOutputChannel('Gamma', { log: true }, nullExtensionDescription);
		assert.strictEqual(calls.length, 1);
		await until(() => registeredChannelCount(service) === 3);
		alpha.dispose();
		beta.dispose();
		gamma.dispose();
	});
});
