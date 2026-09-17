/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const NATIVE_REL = 'src/vs/workbench/services/extensions/electron-browser/nativeExtensionService.ts';
const BROWSER_REL = 'src/vs/workbench/services/extensions/browser/extensionService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const SCANNER_REL = 'src/vs/workbench/services/extensions/electron-browser/cachedExtensionScanner.ts';
const WEB_WORKER_REL = 'src/vs/workbench/services/extensions/browser/webWorkerExtensionHost.ts';
const LOCAL_REL = 'src/vs/workbench/services/extensions/electron-browser/localProcessExtensionHost.ts';
const REMOTE_REL = 'src/vs/workbench/services/extensions/common/remoteExtensionHost.ts';
const MANAGER_REL = 'src/vs/workbench/services/extensions/common/extensionHostManager.ts';
const ABSTRACT_REL = 'src/vs/workbench/services/extensions/common/abstractExtensionService.ts';
const CONTAINS_REL = 'src/vs/workbench/services/extensions/common/workspaceContains.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
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

suite('workbench/services/extensions leftover Promise fire-and-forget catch scan (D698)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const webWorker = fs.readFileSync(resolveSource(WEB_WORKER_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(MANAGER_REL), 'utf8');
		const calls = [
			[native, `lifecycleService.when(LifecyclePhase.Ready).then(() => {
			// reschedule to ensure this runs after restoring viewlets, panels, and editors
			runWhenWindowIdle(mainWindow, () => {
				this._initializeIfNeeded()?.catch(onUnexpectedError).catch(onUnexpectedError);
			}, 50 /*max delay*/);
		})`],
			[browser, `lifecycleService.when(LifecyclePhase.Ready).then(async () => {
			await this._initializeIfNeeded();
		})`],
			[enablement, `this.lifecycleService.when(LifecyclePhase.Eventually).then(() => {
				this.notificationService.prompt(Severity.Info, localize('extensionsDisabled', "All installed extensions are temporarily disabled."), [{
					label: localize('Reload', "Reload and Enable Extensions"),
					run: () => hostService.reload({ disableExtensions: false })
				}], {
					sticky: true,
					priority: NotificationPriority.URGENT
				});
			})`],
			[scanner, 'timeout(5000).then(() => disposable.dispose())'],
			[webWorker, 'this._protocolPromise.then(protocol => this._protocol = protocol)'],
			[local, `this._createExtHostInitData().then(data => {

						// Wait 60s for the initialized message
						installTimeoutCheck();

						protocol.send(VSBuffer.fromString(JSON.stringify(data)));
					})`],
			[remote, `this._createExtHostInitData(isExtensionDevelopmentDebug).then(data => {
								protocol.send(VSBuffer.fromString(JSON.stringify(data)));
							})`],
			[manager, `this._proxy.then(() => {
			this._hasStarted = true;
			initialActivationEvents.forEach((activationEvent) => {
				this.activateByEvent(activationEvent, ActivationKind.Normal).catch(onUnexpectedError).catch(onUnexpectedError);
			});
			this._register(registerLatencyTestProvider({
				measure: () => this.measure()
			}));
		})`],
		] as const;
		assert.strictEqual(calls.length, 8);
		for (const [source, call] of calls) {
			assertDoubleThen(source, call);
		}
	});

	test('nativeExtensionService leftover when Ready then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(abstract, 'protected _initializeIfNeeded(): Promise<void> | null {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `lifecycleService.when(LifecyclePhase.Ready).then(() => {
			// reschedule to ensure this runs after restoring viewlets, panels, and editors
			runWhenWindowIdle(mainWindow, () => {
				this._initializeIfNeeded()?.catch(onUnexpectedError).catch(onUnexpectedError);
			}, 50 /*max delay*/);
		})`);
	});

	test('extensionService leftover when Ready then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(abstract, 'protected _initializeIfNeeded(): Promise<void> | null {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `lifecycleService.when(LifecyclePhase.Ready).then(async () => {
			await this._initializeIfNeeded();
		})`);
	});

	test('extensionEnablement leftover when Eventually then is Promise double-chain; D696 whenInitialized stays; loop leftover stays skipped', () => {
		const source = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `this.lifecycleService.when(LifecyclePhase.Eventually).then(() => {
				this.notificationService.prompt(Severity.Info, localize('extensionsDisabled', "All installed extensions are temporarily disabled."), [{
					label: localize('Reload', "Reload and Enable Extensions"),
					run: () => hostService.reload({ disableExtensions: false })
				}], {
					sticky: true,
					priority: NotificationPriority.URGENT
				});
			})`);
		assert.ok(source.includes(`this.extensionsManager.whenInitialized().then(() => {
			if (!isDisposed) {
				uninstallDisposable.dispose();
				this._onDidChangeExtensions([], [], false);
				this._register(this.extensionsManager.onDidChangeExtensions(({ added, removed, isProfileSwitch }) => this._onDidChangeExtensions(added, removed, isProfileSwitch)));
				this.loopCheckForMaliciousExtensions();
			}
		})${doubleCatch};`));
		assert.ok(source.includes('.then(() => this.loopCheckForMaliciousExtensions());'));
		assert.ok(!source.includes(`.then(() => this.loopCheckForMaliciousExtensions())${doubleCatch}`));
	});

	test('cachedExtensionScanner leftover timeout then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const asyncSrc = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSrc, 'export function timeout(millis: number): CancelablePromise<void>;');
		assert.ok(source.includes("import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'timeout(5000).then(() => disposable.dispose())');
	});

	test('webWorkerExtensionHost leftover protocol then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WEB_WORKER_REL), 'utf8');
		assertPromiseSignature(source, 'public async start(): Promise<IMessagePassingProtocol> {');
		assert.ok(source.includes('private _protocolPromise: Promise<IMessagePassingProtocol> | null;'));
		assert.ok(source.includes("import { canceled, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._protocolPromise.then(protocol => this._protocol = protocol)');
	});

	test('localProcessExtensionHost leftover _createExtHostInitData then is Promise double-chain; two-arg start / disconnect race stay skipped', () => {
		const source = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		assertPromiseSignature(source, 'private async _createExtHostInitData(): Promise<IExtensionHostInitData> {');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `this._createExtHostInitData().then(data => {

						// Wait 60s for the initialized message
						installTimeoutCheck();

						protocol.send(VSBuffer.fromString(JSON.stringify(data)));
					})`);
		assert.ok(source.includes('this._messageProtocol.then(protocol => protocol, () => undefined)'));
		assert.ok(!source.includes('this._messageProtocol.then(protocol => protocol, () => undefined).catch(onUnexpectedError)'));
		assert.ok(source.includes('extensionHostProcess.start(opts).then(({ pid }) => {'));
		assert.ok(!source.includes(`extensionHostProcess.start(opts).then(({ pid }) => {}${doubleCatch}`));
		assert.ok(source.includes('this._extensionHostProcess.waitForExit(extensionHostGraceTimeMs).catch(() => { /* best-effort */ });'));
		assert.ok(!source.includes('waitForExit(extensionHostGraceTimeMs).catch(onUnexpectedError)'));
	});

	test('remoteExtensionHost leftover _createExtHostInitData then is Promise double-chain; resolve/connect returns stay skipped', () => {
		const source = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		assertPromiseSignature(source, 'private async _createExtHostInitData(isExtensionDevelopmentDebug: boolean): Promise<IExtensionHostInitData> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `this._createExtHostInitData(isExtensionDevelopmentDebug).then(data => {
								protocol.send(VSBuffer.fromString(JSON.stringify(data)));
							})`);
		assert.ok(source.includes('return this.remoteAuthorityResolverService.resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {'));
		assert.ok(!source.includes(`resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {}${doubleCatch}`));
		assert.ok(source.includes('return connectRemoteAgentExtensionHost(options, startParams).then(result => {'));
		assert.ok(!source.includes(`connectRemoteAgentExtensionHost(options, startParams).then(result => {}${doubleCatch}`));
	});

	test('extensionHostManager leftover _proxy then is Promise double-chain; start two-arg stays skipped', () => {
		const source = fs.readFileSync(resolveSource(MANAGER_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(extensions, 'start(): Promise<IMessagePassingProtocol>;');
		assertPromiseSignature(source, 'public activateByEvent(activationEvent: string, activationKind: ActivationKind): Promise<void> {');
		assert.ok(source.includes('private _proxy: Promise<IExtensionHostProxy | null> | null;'));
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `this._proxy.then(() => {
			this._hasStarted = true;
			initialActivationEvents.forEach((activationEvent) => {
				this.activateByEvent(activationEvent, ActivationKind.Normal).catch(onUnexpectedError).catch(onUnexpectedError);
			});
			this._register(registerLatencyTestProvider({
				measure: () => this.measure()
			}));
		})`);
		assert.ok(source.includes('this._proxy = this._extensionHost.start().then('));
		assert.ok(!source.includes(`this._extensionHost.start().then(${doubleCatch}`));
	});

	test('opener / D145 / sync void / grpc Wire / Connect / Watch / Resolve / Pty stay skipped', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const webWorker = fs.readFileSync(resolveSource(WEB_WORKER_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(MANAGER_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const contains = fs.readFileSync(resolveSource(CONTAINS_REL), 'utf8');
		assert.ok(native.includes("openerService.open('https://aka.ms/vscode-extension-bisect');"));
		assert.ok(!native.includes("openerService.open('https://aka.ms/vscode-extension-bisect').catch"));
		assert.ok(local.includes('this._extensionHostProcess.waitForExit(extensionHostGraceTimeMs).catch(() => { /* best-effort */ });'));
		assert.ok(abstract.includes('void this._initializeIfNeeded()?.catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(abstract.includes('this._activateDeferredRemoteEvents().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(contains.includes(`Promise.all([fileNamePromise, globPatternPromise]).then(() => {
		// when all are done, resolve with undefined (relevant only if it was not activated so far)
		resolve(undefined);
	})${doubleCatch};`));
		for (const source of [native, browser, enablement, scanner, webWorker, local, remote, manager]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
