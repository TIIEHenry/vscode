/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const METERED_REL = 'src/vs/platform/meteredConnection/common/meteredConnectionIpc.ts';
const SYNC_IPC_REL = 'src/vs/platform/userDataSync/common/userDataSyncIpc.ts';
const SYNC_SERVICE_REL = 'src/vs/platform/userDataSync/common/userDataSyncServiceIpc.ts';
const LOG_IPC_REL = 'src/vs/platform/log/common/logIpc.ts';
const FILE_LOG_REL = 'src/vs/platform/log/common/fileLog.ts';
const SPDLOG_REL = 'src/vs/platform/log/node/spdlogLog.ts';
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const FILES_REL = 'src/vs/platform/files/common/files.ts';
const LOG_REL = 'src/vs/platform/log/common/log.ts';
const SYNC_REL = 'src/vs/platform/userDataSync/common/userDataSync.ts';
const TELEMETRY_REL = 'src/vs/platform/telemetry/common/telemetryIpc.ts';
const MANAGED_REL = 'src/vs/platform/policy/common/fileManagedSettingsIpc.ts';
const UPDATE_IPC_REL = 'src/vs/platform/update/common/updateIpc.ts';
const LIFECYCLE_REL = 'src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts';
const WINDOW_REL = 'src/vs/platform/windows/electron-main/windowImpl.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertDoubleThen(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('platform ipc / log leftover remaining Promise fire-and-forget catch scan (D705)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers leftover Promise double-chain sites', () => {
		const files = [METERED_REL, SYNC_IPC_REL, SYNC_SERVICE_REL, LOG_IPC_REL, FILE_LOG_REL, SPDLOG_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(files.length, 6);
		assert.strictEqual(sites, 9);
	});

	test('meteredConnectionIpc leftover constructor then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(METERED_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		assertPromiseSignature(ipc, 'call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `channel.call<boolean>(MeteredConnectionCommand.IsConnectionMetered).then(value => {
			this._isConnectionMetered = value;
			if (value) {
				this._onDidChangeIsConnectionMetered.fire(value);
			}
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('userDataSyncIpc leftover constructor then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SYNC_IPC_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		assertPromiseSignature(ipc, 'call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this.channel.call<IUserDataSyncAccount | undefined>('_getInitialData').then(account => {
			this._account = account;
			this._register(this.channel.listen<IUserDataSyncAccount | undefined>('onDidChangeAccount')(account => {
				this._account = account;
				this._onDidChangeAccount.fire(account);
			}));
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('userDataSyncServiceIpc leftover constructor then is Promise double-chain; returned apply then and two-arg then stay skipped', () => {
		const source = fs.readFileSync(resolveSource(SYNC_SERVICE_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const sync = fs.readFileSync(resolveSource(SYNC_REL), 'utf8');
		assertPromiseSignature(ipc, 'call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;');
		assertPromiseSignature(sync, 'apply(): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const thenCall = `this.channel.call<[SyncStatus, IUserDataSyncResourceConflicts[], number | undefined]>('_getInitialData').then(([status, conflicts, lastSyncTime]) => {
			this.updateStatus(status);
			this.updateConflicts(conflicts);
			if (lastSyncTime) {
				this.updateLastSyncTime(lastSyncTime);
			}
			this._register(this.channel.listen<SyncStatus>('onDidChangeStatus')(status => this.updateStatus(status)));
			this._register(this.channel.listen<number>('onDidChangeLastSyncTime')(lastSyncTime => this.updateLastSyncTime(lastSyncTime)));
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
		assert.ok(source.includes('return manualSyncTask.apply().then(() => this.manualSyncTasks.delete(this.createKey(manualSyncTask.id)));'));
		assert.ok(!source.includes(`return manualSyncTask.apply().then(() => this.manualSyncTasks.delete(this.createKey(manualSyncTask.id)))${doubleCatch}`));
		assert.ok(source.includes('.then(null, error => { throw UserDataSyncError.toUserDataSyncError(error); });'));
		assert.ok(source.includes("this.channel.call('dispose');"));
		assert.ok(!source.includes(`this.channel.call('dispose')${doubleCatch}`));
	});

	test('logIpc leftover createLogger / getRegisteredLoggers / bare setLogLevel are Promise double-chain; listener and instance setLogLevel stay skipped', () => {
		const source = fs.readFileSync(resolveSource(LOG_IPC_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const log = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
		assertPromiseSignature(ipc, 'call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;');
		assertPromiseSignature(source, 'public static setLogLevel(channel: IChannel, level: LogLevel): Promise<void>;');
		assert.ok(log.includes('getRegisteredLoggers(): Iterable<ILoggerResource>;'));
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const createThen = `this.channel.call('createLogger', [file, loggerOptions, windowId])
			.then(() => {
				this.doLog(this.buffer);
				this.isLoggerCreated = true;
			})`;
		assert.ok(source.includes(`${createThen}${doubleCatch};`));
		assert.ok(!source.includes(`${createThen};`));
		assert.ok(!source.includes(`${createThen}.catch(onUnexpectedError);`));
		assertDoubleThen(source, `channel.call<ILoggerResource[]>('getRegisteredLoggers').then(loggers => {
			for (const loggerResource of loggers) {
				loggerService.registerLogger({ ...loggerResource, resource: URI.revive(loggerResource.resource) });
			}
		})`);
		assertDoubleThen(source, "channel.call('setLogLevel', [loggerService.getLogLevel()])");
		assert.ok(source.includes('this._register(loggerService.onDidChangeLogLevel(arg => channel.call(\'setLogLevel\', [arg])));'));
		assert.ok(!source.includes(`arg => channel.call('setLogLevel', [arg])${doubleCatch}`));
		assert.ok(source.includes('this.channel.call(\'setLogLevel\', [arg1, arg2]);'));
		assert.ok(!source.includes(`this.channel.call('setLogLevel', [arg1, arg2])${doubleCatch}`));
	});

	test('fileLog leftover whenProviderRegistered then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(FILE_LOG_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		assertPromiseSignature(files, 'export async function whenProviderRegistered(file: URI, fileService: IFileService): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'whenProviderRegistered(resource, this.fileService).then(() => logger.logger = new FileLogger(resource, logger.getLevel(), !!options?.donotUseFormatters, this.fileService))');
	});

	test('spdlog leftover loggerCreationPromise thens are Promise double-chain; sync flushLogger stays skipped', () => {
		const source = fs.readFileSync(resolveSource(SPDLOG_REL), 'utf8');
		assertPromiseSignature(source, 'private readonly _loggerCreationPromise: Promise<void>;');
		assertPromiseSignature(source, 'private async _createSpdLogLogger(name: string, filepath: string, rotating: boolean, donotUseFormatters: boolean): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._loggerCreationPromise.then(() => this.flushLogger())');
		assertDoubleThen(source, 'this._loggerCreationPromise.then(() => this.disposeLogger())');
		assert.ok(source.includes('private flushLogger(): void {'));
		assert.ok(!source.includes('this.flushLogger().catch'));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / assigned then / already-done stay skipped', () => {
		const metered = fs.readFileSync(resolveSource(METERED_REL), 'utf8');
		const syncIpc = fs.readFileSync(resolveSource(SYNC_IPC_REL), 'utf8');
		const syncService = fs.readFileSync(resolveSource(SYNC_SERVICE_REL), 'utf8');
		const logIpc = fs.readFileSync(resolveSource(LOG_IPC_REL), 'utf8');
		const fileLog = fs.readFileSync(resolveSource(FILE_LOG_REL), 'utf8');
		const spdlog = fs.readFileSync(resolveSource(SPDLOG_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const managed = fs.readFileSync(resolveSource(MANAGED_REL), 'utf8');
		const updateIpc = fs.readFileSync(resolveSource(UPDATE_IPC_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		assert.ok(telemetry.includes('.then(undefined, err => `Failed to log telemetry: ${console.warn(err)}`);'));
		assert.ok(!telemetry.includes(doubleCatch));
		assert.ok(managed.includes('const rawSnapshot = channel.call<RawManagedSettingsData>(\'getRawManagedSettings\').then(managedSettings => {'));
		assert.ok(!managed.includes(doubleCatch));
		assert.ok(updateIpc.includes(`this.channel.call<State>('_getInitialState').then(state => this.state = state)${doubleCatch};`));
		assert.ok(lifecycle.includes(`this.when(LifecycleMainPhase.Ready).then(() => this.registerListeners())${doubleCatch};`));
		assert.ok(lifecycle.includes('private registerListeners(): void {'));
		assert.ok(!lifecycle.includes('this.registerListeners().catch'));
		assert.ok(windowImpl.includes('export class CodeWindow extends BaseWindow implements ICodeWindow'));
		for (const source of [metered, syncIpc, syncService, logIpc, fileLog, spdlog]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('openerService.open'));
			assert.ok(!source.includes('IOpenerService'));
			assert.ok(!source.includes('then(clear,clear)'));
			assert.ok(!source.includes('githubTransport'));
		}
	});
});
