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
const NATIVE_REL = 'src/vs/platform/policy/common/nativeManagedSettingsIpc.ts';
const METERED_REL = 'src/vs/platform/meteredConnection/electron-browser/meteredConnectionService.ts';
const TIPS_REL = 'src/vs/platform/extensionManagement/common/extensionTipsService.ts';
const WORKER_REL = 'src/vs/platform/webWorker/browser/webWorkerServiceImpl.ts';
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const METERED_IPC_REL = 'src/vs/platform/meteredConnection/common/meteredConnectionIpc.ts';
const FILE_MANAGED_REL = 'src/vs/platform/policy/common/fileManagedSettingsIpc.ts';
const FILE_MANAGED_SERVICE_REL = 'src/vs/platform/policy/common/fileManagedSettingsService.ts';
const TELEMETRY_REL = 'src/vs/platform/telemetry/common/telemetryIpc.ts';
const WATCHER_REL = 'src/vs/platform/extensionManagement/node/extensionsWatcher.ts';
const LANGUAGE_REL = 'src/vs/platform/languagePacks/node/languagePacks.ts';
const KEYBOARD_REL = 'src/vs/platform/keyboardLayout/electron-main/keyboardLayoutMainService.ts';
const HISTORY_REL = 'src/vs/platform/workspaces/electron-main/workspacesHistoryMainService.ts';
const LIFECYCLE_REL = 'src/vs/platform/lifecycle/electron-main/lifecycleMainService.ts';
const UPDATE_IPC_REL = 'src/vs/platform/update/common/updateIpc.ts';
const LOG_IPC_REL = 'src/vs/platform/log/common/logIpc.ts';
const WINDOW_REL = 'src/vs/platform/windows/electron-main/windowImpl.ts';
const WINDOWS_REL = 'src/vs/platform/windows/electron-main/windowsMainService.ts';
const LAUNCH_REL = 'src/vs/platform/launch/electron-main/launchMainService.ts';

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

suite('platform remaining leftover Promise fire-and-forget catch scan (D711)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const files = [NATIVE_REL, METERED_REL, TIPS_REL, WORKER_REL];
		let sites = 0;
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			sites += (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		}
		assert.strictEqual(files.length, 4);
		assert.strictEqual(sites, 8);
	});

	test('nativeManagedSettings leftover void initializeInBackground is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		assertPromiseSignature(source, 'private async initializeInBackground(): Promise<void> {');
		assert.ok(source.includes("import { getErrorMessage, onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this.initializeInBackground()');
	});

	test('metered leftover ctor void and onChange channel.call are Promise double-chain; D705 ipc constructor then stays already-done', () => {
		const source = fs.readFileSync(resolveSource(METERED_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const meteredIpc = fs.readFileSync(resolveSource(METERED_IPC_REL), 'utf8');
		assertPromiseSignature(ipc, 'call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this._channel.call(MeteredConnectionCommand.SetIsBrowserConnectionMetered, this.isBrowserConnectionMetered)');
		assertDoubleThen(source, 'this._channel.call(MeteredConnectionCommand.SetIsBrowserConnectionMetered, this.isBrowserConnectionMetered)');
		assert.ok(meteredIpc.includes(`channel.call<boolean>(MeteredConnectionCommand.IsConnectionMetered).then(value => {
			this._isConnectionMetered = value;
			if (value) {
				this._onDidChangeIsConnectionMetered.fire(value);
			}
		})${doubleCatch};`));
	});

	test('extensionTips leftover high / medium prompt then are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(TIPS_REL), 'utf8');
		assertPromiseSignature(source, 'private async promptExeRecommendations(tips: IExecutableBasedExtensionTip[]): Promise<RecommendationsNotificationResult> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		const highThen = `this.promptExeRecommendations(tips)
			.then(result => {
				switch (result) {
					case RecommendationsNotificationResult.Accepted:
						this.addToRecommendedExecutables(tips[0].exeName, tips);
						break;
					case RecommendationsNotificationResult.Ignored:
						this.highImportanceTipsByExe.delete(exeName);
						break;
					case RecommendationsNotificationResult.IncompatibleWindow: {
						// Recommended in incompatible window. Schedule the prompt after active window change
						const onActiveWindowChange = Event.once(Event.latch(Event.any(this.windowEvents.onDidOpenMainWindow, this.windowEvents.onDidFocusMainWindow)));
						this._register(onActiveWindowChange(() => this.promptHighImportanceExeBasedTip()));
						break;
					}
					case RecommendationsNotificationResult.TooMany: {
						// Too many notifications. Schedule the prompt after one hour
						const disposable = this._register(new MutableDisposable());
						disposable.value = disposableTimeout(() => { disposable.dispose(); this.promptHighImportanceExeBasedTip(); }, 60 * 60 * 1000 /* 1 hour */);
						break;
					}
				}
			})`;
		assert.ok(source.includes(`${highThen}${doubleCatch};`));
		assert.ok(!source.includes(`${highThen};`));
		assert.ok(!source.includes(`${highThen}.catch(onUnexpectedError);`));
		const mediumThen = `this.promptExeRecommendations(tips)
			.then(result => {
				switch (result) {
					case RecommendationsNotificationResult.Accepted: {
						// Accepted: Update the last prompted time and caches.
						this.updateLastPromptedMediumExeTime(Date.now());
						this.mediumImportanceTipsByExe.delete(exeName);
						this.addToRecommendedExecutables(tips[0].exeName, tips);

						// Schedule the next recommendation for next internval
						const disposable1 = this._register(new MutableDisposable());
						disposable1.value = disposableTimeout(() => { disposable1.dispose(); this.promptMediumImportanceExeBasedTip(); }, promptInterval);
						break;
					}
					case RecommendationsNotificationResult.Ignored:
						// Ignored: Remove from the cache and prompt next recommendation
						this.mediumImportanceTipsByExe.delete(exeName);
						this.promptMediumImportanceExeBasedTip();
						break;

					case RecommendationsNotificationResult.IncompatibleWindow: {
						// Recommended in incompatible window. Schedule the prompt after active window change
						const onActiveWindowChange = Event.once(Event.latch(Event.any(this.windowEvents.onDidOpenMainWindow, this.windowEvents.onDidFocusMainWindow)));
						this._register(onActiveWindowChange(() => this.promptMediumImportanceExeBasedTip()));
						break;
					}
					case RecommendationsNotificationResult.TooMany: {
						// Too many notifications. Schedule the prompt after one hour
						const disposable2 = this._register(new MutableDisposable());
						disposable2.value = disposableTimeout(() => { disposable2.dispose(); this.promptMediumImportanceExeBasedTip(); }, 60 * 60 * 1000 /* 1 hour */);
						break;
					}
				}
			})`;
		assert.ok(source.includes(`${mediumThen}${doubleCatch};`));
		assert.ok(!source.includes(`${mediumThen};`));
		assert.ok(!source.includes(`${mediumThen}.catch(onUnexpectedError);`));
	});

	test('webWorker leftover ctor / dispose / postMessage then are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		assertPromiseSignature(source, 'constructor(worker: Promise<Worker>, id: number) {');
		assertPromiseSignature(source, 'private worker: Promise<Worker> | null;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertDoubleThen(source, `this.worker.then((w) => {
			w.onmessage = (ev) => {
				this._onMessage.fire(ev.data);
			};
			w.onmessageerror = (ev) => {
				this._onError.fire(ev);
			};
			if (typeof w.addEventListener === 'function') {
				w.addEventListener('error', errorHandler);
			}
		})`);
		assertDoubleThen(source, `this.worker?.then(w => {
				w.onmessage = null;
				w.onmessageerror = null;
				w.removeEventListener('error', errorHandler);
				w.terminate();
			})`);
		assertDoubleThen(source, `this.worker?.then(w => {
			try {
				w.postMessage(message, transfer);
			} catch (err) {
				onUnexpectedError(err);
				onUnexpectedError(new Error(\`FAILED to post message to worker\`, { cause: err }));
			}
		})`);
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty / two-arg then / assigned then / already-done / windows electron-main stay skipped', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const metered = fs.readFileSync(resolveSource(METERED_REL), 'utf8');
		const tips = fs.readFileSync(resolveSource(TIPS_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(WORKER_REL), 'utf8');
		const fileManaged = fs.readFileSync(resolveSource(FILE_MANAGED_REL), 'utf8');
		const fileManagedService = fs.readFileSync(resolveSource(FILE_MANAGED_SERVICE_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const watcher = fs.readFileSync(resolveSource(WATCHER_REL), 'utf8');
		const language = fs.readFileSync(resolveSource(LANGUAGE_REL), 'utf8');
		const keyboard = fs.readFileSync(resolveSource(KEYBOARD_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const updateIpc = fs.readFileSync(resolveSource(UPDATE_IPC_REL), 'utf8');
		const logIpc = fs.readFileSync(resolveSource(LOG_IPC_REL), 'utf8');
		const windowImpl = fs.readFileSync(resolveSource(WINDOW_REL), 'utf8');
		const windows = fs.readFileSync(resolveSource(WINDOWS_REL), 'utf8');
		const launch = fs.readFileSync(resolveSource(LAUNCH_REL), 'utf8');
		assert.ok(fileManaged.includes('const rawSnapshot = channel.call<RawManagedSettingsData>(\'getRawManagedSettings\').then(managedSettings => {'));
		assert.ok(!fileManaged.includes(doubleCatch));
		assert.ok(fileManagedService.includes('void this.throttledDelayer.trigger(() => this.refresh(), delay).then(() => {'));
		assert.ok(fileManagedService.includes('}, error => {'));
		assert.ok(!fileManagedService.includes(doubleCatch));
		assert.ok(telemetry.includes('.then(undefined, err => `Failed to log telemetry: ${console.warn(err)}`);'));
		assert.ok(!telemetry.includes(doubleCatch));
		assert.ok(watcher.includes('this.initialize().then(null, error => logService.error(\'Error while initializing Extensions Watcher\', getErrorMessage(error)));'));
		assert.ok(!watcher.includes(doubleCatch));
		assert.ok(language.includes('.then(() => this.languagePacks);'));
		assert.ok(!language.includes(doubleCatch));
		assert.ok(keyboard.includes(`lifecycleMainService.when(LifecycleMainPhase.AfterWindowOpen).then(() => this._initialize())${doubleCatch};`));
		assert.ok(history.includes(`this.lifecycleMainService.when(LifecycleMainPhase.Eventually).then(() => this.handleWindowsJumpList())${doubleCatch};`));
		assert.ok(lifecycle.includes(`this.when(LifecycleMainPhase.Ready).then(() => this.registerListeners())${doubleCatch};`));
		assert.ok(lifecycle.includes('private registerListeners(): void {'));
		assert.ok(!lifecycle.includes('this.registerListeners().catch'));
		assert.ok(updateIpc.includes(`this.channel.call<State>('_getInitialState').then(state => this.state = state)${doubleCatch};`));
		assert.ok(logIpc.includes("channel.call('setLogLevel', [loggerService.getLogLevel()]).catch(onUnexpectedError).catch(onUnexpectedError);"));
		assert.ok(windowImpl.includes('export class CodeWindow extends BaseWindow implements ICodeWindow'));
		assert.ok(windows.includes('this.lifecycleMainService.unload(window, UnloadReason.LOAD).then(async veto => {'));
		assert.ok(launch.includes('whenWindowReady.then(() => {'));
		assert.ok(windowImpl.includes(doubleCatch));
		assert.ok(windows.includes(doubleCatch));
		assert.ok(launch.includes(doubleCatch));
		for (const source of [native, metered, tips, worker]) {
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
