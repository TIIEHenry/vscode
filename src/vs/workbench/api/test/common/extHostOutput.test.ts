/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ResourceMap } from '../../../../base/common/map.js';
import { URI } from '../../../../base/common/uri.js';
import { hasKey } from '../../../../base/common/types.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IExtensionDescription } from '../../../../platform/extensions/common/extensions.js';
import { ILogger, LogLevel, NullLogger, NullLoggerService, NullLogService } from '../../../../platform/log/common/log.js';
import { nullExtensionDescription } from '../../../services/extensions/common/extensions.js';
import { ExtHostOutputService } from '../../common/extHostOutput.js';
import { FileSystemError } from '../../common/extHostTypes.js';
import { IExtHostConsumerFileSystem } from '../../common/extHostFileSystemConsumer.js';
import { ExtHostFileSystemInfo } from '../../common/extHostFileSystemInfo.js';
import { IExtHostInitDataService } from '../../common/extHostInitDataService.js';
import { MainContext, MainThreadOutputServiceShape } from '../../common/extHost.protocol.js';
import { TestRPCProtocol } from './testRPCProtocol.js';
import type * as vscode from 'vscode';

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

function thenOnly<T>(promise: Promise<T>): PromiseLike<T> {
	return {
		then: (onfulfilled, onrejected) => thenOnly(promise.then(onfulfilled, onrejected)),
	};
}

class OutputLogger extends NullLogger {
	override readonly onDidChangeLogLevel = Event.None;
	readonly messages: string[] = [];
	disposed = false;
	writeError: Error | undefined;

	constructor(private readonly level: LogLevel) {
		super();
	}

	override getLevel(): LogLevel {
		return this.level;
	}

	override info(message: string): void {
		if (this.writeError) {
			throw this.writeError;
		}
		this.messages.push(message);
	}

	override dispose(): void {
		this.disposed = true;
	}
}

class OutputLoggerService extends NullLoggerService {
	readonly created: OutputLogger[] = [];

	constructor() {
		super();
		this.setLogLevel(LogLevel.Info);
	}

	protected override doCreateLogger(_resource: URI, logLevel: LogLevel): ILogger {
		const logger = new OutputLogger(logLevel);
		this.created.push(logger);
		return logger;
	}
}

class OutputProxy implements MainThreadOutputServiceShape {
	readonly registeredNames: string[] = [];
	readonly disposedChannelIds: string[] = [];
	readonly revealedChannelIds: string[] = [];
	registerResult: DeferredPromise<string> | undefined;

	async $register(name: string): Promise<string> {
		this.registeredNames.push(name);
		return this.registerResult?.p ?? `channel-${this.registeredNames.length}`;
	}

	async $update(): Promise<void> { }
	async $reveal(id: string): Promise<void> { this.revealedChannelIds.push(id); }
	async $close(): Promise<void> { }
	async $dispose(id: string): Promise<void> {
		this.disposedChannelIds.push(id);
	}
	dispose(): void { }
}

function createHarness(store: Pick<DisposableStore, 'add'>, useThenOnly = false) {
	const calls: IDirectoryCall[] = [];
	const fileSystemInfo = new ExtHostFileSystemInfo();
	const extHostFileSystem = new class extends mock<IExtHostConsumerFileSystem>() {
		override readonly value = new class extends mock<vscode.FileSystem>() {
			override createDirectory(uri: vscode.Uri): Thenable<void> {
				const result = new DeferredPromise<void>();
				calls.push({ uri: URI.from(uri), result });
				return useThenOnly ? thenOnly(result.p) : result.p;
			}
		};
	};
	const initData = new class extends mock<IExtHostInitDataService>() {
		override readonly logsLocation = URI.file('/logs');
		override readonly environment = new class extends mock<IExtHostInitDataService['environment']>() { };
	};
	const proxy = new OutputProxy();
	const rpc = store.add(new TestRPCProtocol());
	rpc.set(MainContext.MainThreadOutputService, proxy);
	const loggerService = store.add(new OutputLoggerService());
	const service = new ExtHostOutputService(rpc, initData, extHostFileSystem, fileSystemInfo, loggerService, new NullLogService());
	return { service, calls, fileSystemInfo, loggerService, proxy };
}

async function withReportedErrors(run: (errors: unknown[]) => Promise<void>): Promise<void> {
	const previousHandler = errorHandler.getUnexpectedErrorHandler();
	const errors: unknown[] = [];
	setUnexpectedErrorHandler(error => errors.push(error));
	try {
		await run(errors);
		// Leave a turn for the test runner to observe any detached unhandled rejections.
		await new Promise(resolve => setTimeout(resolve, 0));
	} finally {
		setUnexpectedErrorHandler(previousHandler);
	}
}

suite('ExtHostOutputService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('normalizes then-only directory creation before initializing an output channel', async () => {
		const { service, calls, proxy } = createHarness(store, true);
		const disposables = store.add(new DisposableStore());
		const created = doCreateOutputChannel(service, 'Then only', disposables);

		await calls[0].result.complete();
		store.add(await created);

		assert.deepStrictEqual(proxy.registeredNames, ['Then only']);
	});

	test('preserves a then-only directory rejection and retries the next channel', async () => {
		const { service, calls } = createHarness(store, true);
		const first = doCreateOutputChannel(service, 'Alpha', store.add(new DisposableStore()));
		const failure = new Error('then-only mkdir failed');
		const rejected = assert.rejects(first, error => error === failure);
		await calls[0].result.error(failure);
		await rejected;

		const second = doCreateOutputChannel(service, 'Beta', store.add(new DisposableStore()));
		assert.strictEqual(calls.length, 2);
		await calls[1].result.complete();
		store.add(await second);
	});

	test('reports a queued output creation failure once and permits a later channel to recover', async () => {
		await withReportedErrors(async errors => {
			const { service, calls, loggerService, proxy } = createHarness(store, true);
			const channel = store.add(service.createOutputChannel('Alpha', undefined, nullExtensionDescription));
			channel.append('append');
			channel.appendLine('line');
			channel.clear();
			channel.replace('replace');
			channel.show();
			channel.hide();
			const failure = new Error('output mkdir failed');

			await calls[0].result.error(failure);
			await until(() => errors.length > 0);
			assert.deepStrictEqual(errors, [failure]);
			assert.deepStrictEqual([loggerService.created.length, proxy.registeredNames.length, registeredChannelCount(service)], [0, 0, 0]);
			channel.dispose();

			const recovered = store.add(service.createOutputChannel('Alpha', undefined, nullExtensionDescription));
			await calls[1].result.complete();
			await until(() => registeredChannelCount(service) === 1);
			recovered.append('recovered');
			await until(() => loggerService.created[0].messages.length === 1);
			assert.deepStrictEqual(loggerService.created[0].messages, ['recovered']);
			assert.deepStrictEqual(errors, [failure]);
		});
	});

	test('reports a queued log creation failure once and disposes its cached facade before retry', async () => {
		await withReportedErrors(async errors => {
			const { service, calls, loggerService } = createHarness(store, true);
			const channel = store.add(service.createOutputChannel('Alpha', { log: true }, nullExtensionDescription));
			assert.ok(hasKey(channel, { info: true }));
			channel.trace('trace');
			channel.debug('debug');
			channel.info('info');
			channel.warn('warn');
			channel.error('error');
			channel.appendLine('line');
			channel.show();
			const failure = new Error('log mkdir failed');

			await calls[0].result.error(failure);
			await until(() => errors.length > 0);
			assert.deepStrictEqual(errors, [failure]);
			assert.deepStrictEqual([loggerService.created.length, registeredChannelCount(service)], [0, 0]);
			assert.strictEqual(service.createOutputChannel('Alpha', { log: true }, nullExtensionDescription), channel);
			channel.dispose();
			assert.throws(() => channel.info('closed'), /Channel has been closed/);

			const recovered = store.add(service.createOutputChannel('Alpha', { log: true }, nullExtensionDescription));
			assert.notStrictEqual(recovered, channel);
			assert.strictEqual(calls.length, 2);
			await calls[1].result.complete();
			await until(() => registeredChannelCount(service) === 1);
			recovered.append('recovered');
			await until(() => loggerService.created[0].messages.length === 1);
			assert.deepStrictEqual(loggerService.created[0].messages, ['recovered']);
			assert.deepStrictEqual(errors, [failure]);
		});
	});

	for (const log of [false, true]) {
		test(`releases late ${log ? 'log' : 'output'} initialization after its facade is disposed`, async () => {
			const { service, calls, loggerService, proxy } = createHarness(store, true);
			const options = log ? { log: true as const } : undefined;
			const channel = store.add(service.createOutputChannel('Alpha', options, nullExtensionDescription));
			channel.dispose();

			await calls[0].result.complete();
			await new Promise(resolve => setTimeout(resolve, 0));
			// A facade closed before mkdir finishes never allocates a logger or remote channel.
			assert.deepStrictEqual([loggerService.created.length, proxy.disposedChannelIds.length, registeredChannelCount(service)], [0, 0, 0]);
			assert.deepStrictEqual([...loggerService.getRegisteredLoggers()], []);

			const recovered = store.add(service.createOutputChannel('Alpha', options, nullExtensionDescription));
			assert.notStrictEqual(recovered, channel);
			await until(() => registeredChannelCount(service) === 1);
			assert.strictEqual(calls.length, 1);
		});

		test(`recreating a ${log ? 'log' : 'plain output'} facade while its disposed predecessor is still initializing keeps the new channel alive`, async () => {
			const { service, calls, loggerService, proxy } = createHarness(store, true);
			const options = log ? { log: true as const } : undefined;
			const previous = store.add(service.createOutputChannel('Alpha', options, nullExtensionDescription));
			previous.append('discarded');
			previous.show();
			previous.dispose();
			const current = store.add(service.createOutputChannel('Alpha', options, nullExtensionDescription));
			current.append('kept');
			assert.notStrictEqual(current, previous);
			assert.strictEqual(calls.length, 1, 'the successful in-flight mkdir stays shared');

			await calls[0].result.complete();
			await until(() => registeredChannelCount(service) === 1 && loggerService.created[0]?.messages.length === 1);
			if (log) {
				assert.strictEqual(service.createOutputChannel('Alpha', options, nullExtensionDescription), current);
			}
			assert.deepStrictEqual({
				created: loggerService.created.length,
				disposed: loggerService.created[0].disposed,
				messages: loggerService.created[0].messages,
				registeredLoggers: [...loggerService.getRegisteredLoggers()].length,
				disposedChannelIds: proxy.disposedChannelIds,
				revealedChannelIds: proxy.revealedChannelIds,
			}, { created: 1, disposed: false, messages: ['kept'], registeredLoggers: 1, disposedChannelIds: [], revealedChannelIds: [] });
		});

		test(`reports ${log ? 'log' : 'output'} operation errors after successful initialization`, async () => {
			await withReportedErrors(async errors => {
				const { service, calls, loggerService } = createHarness(store);
				const channel = store.add(service.createOutputChannel('Alpha', log ? { log: true } : undefined, nullExtensionDescription));
				await calls[0].result.complete();
				await until(() => registeredChannelCount(service) === 1);
				const failure = new Error('logger write failed');
				loggerService.created[0].writeError = failure;

				channel.append('message');
				await until(() => errors.length > 0);
				assert.deepStrictEqual(errors, [failure]);
			});
		});
	}

	test('disposal during remote registration releases the logger immediately and the late channel when its id arrives', async () => {
		const { service, calls, loggerService, proxy } = createHarness(store, true);
		const registration = new DeferredPromise<string>();
		proxy.registerResult = registration;
		const channel = store.add(service.createOutputChannel('Alpha', undefined, nullExtensionDescription));
		channel.append('discarded');
		channel.show();
		await calls[0].result.complete();
		await until(() => proxy.registeredNames.length === 1);
		const previousFile = [...loggerService.getRegisteredLoggers()][0].resource.toString();
		channel.dispose();
		assert.deepStrictEqual({ disposed: loggerService.created[0].disposed, loggers: [...loggerService.getRegisteredLoggers()] }, { disposed: true, loggers: [] });

		proxy.registerResult = undefined;
		const current = store.add(service.createOutputChannel('Alpha', undefined, nullExtensionDescription));
		current.append('new channel');
		await until(() => registeredChannelCount(service) === 1 && loggerService.created[1]?.messages.length === 1);
		assert.notStrictEqual([...loggerService.getRegisteredLoggers()][0].resource.toString(), previousFile);
		await registration.complete('channel-1');
		await until(() => proxy.disposedChannelIds.length === 1);
		assert.deepStrictEqual({
			channelIds: proxy.disposedChannelIds,
			registered: registeredChannelCount(service),
			messages: loggerService.created[0].messages,
			newMessages: loggerService.created[1].messages,
			revealed: proxy.revealedChannelIds,
		}, { channelIds: ['channel-1'], registered: 1, messages: [], newMessages: ['new channel'], revealed: [] });
		current.append('still live');
		await until(() => loggerService.created[1].messages.length === 2);
		current.dispose();
		await until(() => proxy.disposedChannelIds.length === 2);
		assert.deepStrictEqual({ ids: proxy.disposedChannelIds, registered: registeredChannelCount(service), loggers: [...loggerService.getRegisteredLoggers()] }, {
			ids: ['channel-1', 'channel-2'], registered: 0, loggers: [],
		});
	});

	test('creates the output directory again after the first attempt fails', async () => {
		const { service, calls } = createHarness(store);
		const firstDisposables = store.add(new DisposableStore());
		const first = doCreateOutputChannel(service, 'Alpha', firstDisposables);
		const failed = outputDirectoryPromise(service);
		assert.ok(failed);
		assert.strictEqual(calls.length, 1);

		await calls[0].result.error(new Error('create failed'));
		await assert.rejects(Promise.resolve(first), (error: unknown) => isError(error, 'create failed'));
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
		await assert.rejects(Promise.resolve(first), (error: unknown) => isError(error, 'stale'));
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
		await assert.rejects(Promise.resolve(first), (error: unknown) => isError(error, 'create failed'));
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
		await assert.rejects(Promise.resolve(first), (error: unknown) => isError(error, 'stale'));
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
