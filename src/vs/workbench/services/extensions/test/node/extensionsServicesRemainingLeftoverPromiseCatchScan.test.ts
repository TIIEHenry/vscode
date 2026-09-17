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
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const IPC_MP_REL = 'src/vs/base/parts/ipc/electron-browser/ipc.mp.ts';

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

suite('workbench/services/extensions remaining leftover Promise fire-and-forget catch scan (D707)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight remaining leftover Promise double-chain sites; D698 eight stay wrapped', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const contains = fs.readFileSync(resolveSource(CONTAINS_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(MANAGER_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const webWorker = fs.readFileSync(resolveSource(WEB_WORKER_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const remaining = [
			[native, 'this._initializeIfNeeded()?'],
			[abstract, 'void this._initializeIfNeeded()?'],
			[local, `portPromise.then((port) => {
				this._register(toDisposable(() => {
					// Close the message port when the extension host is disposed
					port.close();
					port.onmessage = null;
				}));
				clearTimeout(handle);

				const onMessage = new BufferedEmitter<VSBuffer>();
				port.onmessage = ((e) => {
					if (e.data) {
						onMessage.fire(VSBuffer.wrap(e.data));
					}
				});
				port.start();

				resolve({
					onMessage: onMessage.event,
					send: message => port.postMessage(message.buffer),
				});
			})`],
			[contains, `Promise.all([fileNamePromise, globPatternPromise]).then(() => {
		// when all are done, resolve with undefined (relevant only if it was not activated so far)
		resolve(undefined);
	})`],
			[manager, 'this.activateByEvent(activationEvent, ActivationKind.Normal)'],
			[abstract, 'this._activateDeferredRemoteEvents()'],
			[abstract, 'this._activateAddedExtensionIfNeeded(toAdd[i])'],
			[abstract, `if (extensionHost.kind === ExtensionHostKind.LocalProcess) {
			this._doStopExtensionHosts()`],
		] as const;
		assert.strictEqual(remaining.length, 8);
		for (const [source, call] of remaining) {
			assertDoubleThen(source, call);
		}
		const d698 = [
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
		assert.strictEqual(d698.length, 8);
		for (const [source, call] of d698) {
			assertDoubleThen(source, call);
		}
	});

	test('native idle discarded _initializeIfNeeded leftover is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		assertPromiseSignature(abstract, 'protected _initializeIfNeeded(): Promise<void> | null {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._initializeIfNeeded()?');
	});

	test('abstract Immediate activate discarded void _initializeIfNeeded leftover is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		assertPromiseSignature(source, 'protected _initializeIfNeeded(): Promise<void> | null {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'void this._initializeIfNeeded()?');
	});

	test('localProcessExtensionHost leftover portPromise then is Promise double-chain; two-arg start / disconnect race stay skipped', () => {
		const source = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_MP_REL), 'utf8');
		assertPromiseSignature(ipc, 'export async function acquirePort');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `portPromise.then((port) => {
				this._register(toDisposable(() => {
					// Close the message port when the extension host is disposed
					port.close();
					port.onmessage = null;
				}));
				clearTimeout(handle);

				const onMessage = new BufferedEmitter<VSBuffer>();
				port.onmessage = ((e) => {
					if (e.data) {
						onMessage.fire(VSBuffer.wrap(e.data));
					}
				});
				port.start();

				resolve({
					onMessage: onMessage.event,
					send: message => port.postMessage(message.buffer),
				});
			})`);
		assert.ok(source.includes('this._messageProtocol.then(protocol => protocol, () => undefined)'));
		assert.ok(!source.includes('this._messageProtocol.then(protocol => protocol, () => undefined).catch(onUnexpectedError)'));
		assert.ok(source.includes('extensionHostProcess.start(opts).then(({ pid }) => {'));
		assert.ok(!source.includes(`extensionHostProcess.start(opts).then(({ pid }) => {}${doubleCatch}`));
	});

	test('workspaceContains leftover Promise.all then is Promise double-chain; two-arg fileSearch stays skipped', () => {
		const source = fs.readFileSync(resolveSource(CONTAINS_REL), 'utf8');
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `Promise.all([fileNamePromise, globPatternPromise]).then(() => {
		// when all are done, resolve with undefined (relevant only if it was not activated so far)
		resolve(undefined);
	})`);
		assert.ok(source.includes('return searchService.fileSearch(query, token).then('));
		assert.ok(!source.includes(`fileSearch(query, token).then(${doubleCatch}`));
	});

	test('extensionHostManager leftover activateByEvent forEach is Promise double-chain; start two-arg stays skipped', () => {
		const source = fs.readFileSync(resolveSource(MANAGER_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(source, 'public activateByEvent(activationEvent: string, activationKind: ActivationKind): Promise<void> {');
		assertPromiseSignature(extensions, 'start(): Promise<IMessagePassingProtocol>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this.activateByEvent(activationEvent, ActivationKind.Normal)');
		assert.ok(source.includes('this._proxy = this._extensionHost.start().then('));
		assert.ok(!source.includes(`this._extensionHost.start().then(${doubleCatch}`));
	});

	test('abstract leftover _activateDeferredRemoteEvents / _activateAddedExtensionIfNeeded / crash _doStopExtensionHosts are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		assertPromiseSignature(source, 'private async _activateDeferredRemoteEvents(): Promise<void> {');
		assertPromiseSignature(source, 'private async _activateAddedExtensionIfNeeded(extensionDescription: IExtensionDescription): Promise<void> {');
		assertPromiseSignature(source, 'protected async _doStopExtensionHosts(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._activateDeferredRemoteEvents()');
		assertDoubleThen(source, 'this._activateAddedExtensionIfNeeded(toAdd[i])');
		assertDoubleThen(source, `if (extensionHost.kind === ExtensionHostKind.LocalProcess) {
			this._doStopExtensionHosts()`);
		assert.ok(source.includes('await this._doStopExtensionHosts();'));
		assert.ok(!source.includes('await this._doStopExtensionHosts().catch'));
	});

	test('opener / D145 / grpc Wire / Connect / Watch / Resolve / Pty / returned resolveAuthority/connect stay skipped', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		assert.ok(native.includes("openerService.open('https://aka.ms/vscode-extension-bisect');"));
		assert.ok(!native.includes("openerService.open('https://aka.ms/vscode-extension-bisect').catch"));
		assert.ok(local.includes('this._extensionHostProcess.waitForExit(extensionHostGraceTimeMs).catch(() => { /* best-effort */ });'));
		assert.ok(!local.includes('waitForExit(extensionHostGraceTimeMs).catch(onUnexpectedError)'));
		assert.ok(remote.includes('return this.remoteAuthorityResolverService.resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {'));
		assert.ok(!remote.includes(`resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {}${doubleCatch}`));
		assert.ok(remote.includes('return connectRemoteAgentExtensionHost(options, startParams).then(result => {'));
		assert.ok(!remote.includes(`connectRemoteAgentExtensionHost(options, startParams).then(result => {}${doubleCatch}`));
		assert.ok(abstract.includes('this._handleDeltaExtensions(new DeltaExtensionsQueueItem(toAdd, toRemove));'));
		assert.ok(!abstract.includes('this._handleDeltaExtensions(new DeltaExtensionsQueueItem(toAdd, toRemove)).catch'));
		assert.ok(abstract.includes('this._onRemoteExtensionHostCrashed(extensionHost, signal);'));
		assert.ok(!abstract.includes('this._onRemoteExtensionHostCrashed(extensionHost, signal).catch'));
		assert.ok(abstract.includes('this._extensionHostManagers.stopOne(extensionHost);'));
		assert.ok(!abstract.includes('this._extensionHostManagers.stopOne(extensionHost).catch'));
		for (const source of [native, local, remote, abstract]) {
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
