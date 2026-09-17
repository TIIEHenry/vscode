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
const LOCAL_REL = 'src/vs/workbench/services/extensions/electron-browser/localProcessExtensionHost.ts';
const REMOTE_REL = 'src/vs/workbench/services/extensions/common/remoteExtensionHost.ts';
const MANAGER_REL = 'src/vs/workbench/services/extensions/common/extensionHostManager.ts';
const ABSTRACT_REL = 'src/vs/workbench/services/extensions/common/abstractExtensionService.ts';
const CONTAINS_REL = 'src/vs/workbench/services/extensions/common/workspaceContains.ts';
const URL_REL = 'src/vs/workbench/services/extensions/browser/extensionUrlHandler.ts';
const ERRORS_REL = 'src/vs/base/common/errors.ts';

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

suite('workbench/services/extensions delta/crash leftover Promise fire-and-forget catch scan (D715)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites; D698 / D707 wraps stay', () => {
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(MANAGER_REL), 'utf8');
		const contains = fs.readFileSync(resolveSource(CONTAINS_REL), 'utf8');
		const d715 = [
			[abstract, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem(toAdd, toRemove))'],
			[abstract, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem(added, removed))'],
			[abstract, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem(extensions, []))'],
			[abstract, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem(extensions, toRemove))'],
			[abstract, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem([], [event.identifier.id]))'],
			[abstract, 'this._onRemoteExtensionHostCrashed(extensionHost, signal)'],
			[abstract, 'this._extensionHostManagers.stopOne(extensionHost)'],
			[abstract, 'this._onExtensionHostExit(code)'],
		] as const;
		assert.strictEqual(d715.length, 8);
		for (const [source, call] of d715) {
			assertDoubleThen(source, call);
		}
		assert.ok(native.includes(`lifecycleService.when(LifecyclePhase.Ready).then(() => {
			// reschedule to ensure this runs after restoring viewlets, panels, and editors
			runWhenWindowIdle(mainWindow, () => {
				this._initializeIfNeeded()?.catch(onUnexpectedError).catch(onUnexpectedError);
			}, 50 /*max delay*/);
		})${doubleCatch};`));
		assert.ok(browser.includes(`lifecycleService.when(LifecyclePhase.Ready).then(async () => {
			await this._initializeIfNeeded();
		})${doubleCatch};`));
		assert.ok(abstract.includes(`void this._initializeIfNeeded()?${doubleCatch};`));
		assert.ok(abstract.includes(`this._activateDeferredRemoteEvents()${doubleCatch};`));
		assert.ok(abstract.includes(`this._activateAddedExtensionIfNeeded(toAdd[i])${doubleCatch};`));
		assert.ok(abstract.includes(`if (extensionHost.kind === ExtensionHostKind.LocalProcess) {
			this._doStopExtensionHosts()${doubleCatch};`));
		assert.ok(local.includes(`portPromise.then((port) => {`));
		assert.ok(local.includes(`${doubleCatch};`));
		assert.ok(contains.includes(`Promise.all([fileNamePromise, globPatternPromise]).then(() => {
		// when all are done, resolve with undefined (relevant only if it was not activated so far)
		resolve(undefined);
	})${doubleCatch};`));
		assert.ok(manager.includes(`this.activateByEvent(activationEvent, ActivationKind.Normal)${doubleCatch};`));
		assert.ok(remote.includes(`this._createExtHostInitData(isExtensionDevelopmentDebug).then(data => {
								protocol.send(VSBuffer.fromString(JSON.stringify(data)));
							})${doubleCatch};`));
	});

	test('leftover _handleDeltaExtensions event leftovers are Promise double-chain; await startExtensionHosts stays', () => {
		const source = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		assertPromiseSignature(source, 'private async _handleDeltaExtensions(item: DeltaExtensionsQueueItem): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem(toAdd, toRemove))');
		assertDoubleThen(source, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem(added, removed))');
		assertDoubleThen(source, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem(extensions, []))');
		assertDoubleThen(source, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem(extensions, toRemove))');
		assertDoubleThen(source, 'this._handleDeltaExtensions(new DeltaExtensionsQueueItem([], [event.identifier.id]))');
		assert.ok(source.includes('await this._handleDeltaExtensions(new DeltaExtensionsQueueItem(updates.toAdd, updates.toRemove));'));
		assert.ok(!source.includes('await this._handleDeltaExtensions(new DeltaExtensionsQueueItem(updates.toAdd, updates.toRemove)).catch'));
	});

	test('leftover remote crash _onRemoteExtensionHostCrashed / stopOne are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		assertPromiseSignature(source, 'private async _onRemoteExtensionHostCrashed(extensionHost: IExtensionHostManager, reconnectionToken: string): Promise<void> {');
		assertPromiseSignature(source, 'public async stopOne(extensionHostManager: IExtensionHostManager): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._onRemoteExtensionHostCrashed(extensionHost, signal)');
		assertDoubleThen(source, 'this._extensionHostManagers.stopOne(extensionHost)');
		assert.ok(source.includes(`if (extensionHost.kind === ExtensionHostKind.LocalProcess) {
			this._doStopExtensionHosts()${doubleCatch};`));
	});

	test('leftover crash-or-exit _onExtensionHostExit is Promise double-chain; tests exitCode leftover stays', () => {
		const source = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		assertPromiseSignature(source, 'protected abstract _onExtensionHostExit(code: number): Promise<void>;');
		assertPromiseSignature(native, 'protected async _onExtensionHostExit(code: number): Promise<void> {');
		assertPromiseSignature(browser, 'protected async _onExtensionHostExit(code: number): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._onExtensionHostExit(code)');
		assert.ok(source.includes('this._onExtensionHostExit(exitCode);'));
		assert.ok(!source.includes('this._onExtensionHostExit(exitCode).catch'));
	});

	test('opener / D145 / two-arg then / assigned then / Resolve / Connect / Pty / already dual-chain stay skipped', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(MANAGER_REL), 'utf8');
		const contains = fs.readFileSync(resolveSource(CONTAINS_REL), 'utf8');
		const urlHandler = fs.readFileSync(resolveSource(URL_REL), 'utf8');
		assert.ok(native.includes("openerService.open('https://aka.ms/vscode-extension-bisect');"));
		assert.ok(!native.includes("openerService.open('https://aka.ms/vscode-extension-bisect').catch"));
		assert.ok(local.includes('this._extensionHostProcess.waitForExit(extensionHostGraceTimeMs).catch(() => { /* best-effort */ });'));
		assert.ok(!local.includes('waitForExit(extensionHostGraceTimeMs).catch(onUnexpectedError)'));
		assert.ok(remote.includes('return this.remoteAuthorityResolverService.resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {'));
		assert.ok(!remote.includes(`resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {}${doubleCatch}`));
		assert.ok(remote.includes('return connectRemoteAgentExtensionHost(options, startParams).then(result => {'));
		assert.ok(!remote.includes(`connectRemoteAgentExtensionHost(options, startParams).then(result => {}${doubleCatch}`));
		assert.ok(manager.includes('this._proxy = this._extensionHost.start().then('));
		assert.ok(!manager.includes(`this._extensionHost.start().then(${doubleCatch}`));
		assert.ok(contains.includes('return searchService.fileSearch(query, token).then('));
		assert.ok(!contains.includes(`fileSearch(query, token).then(${doubleCatch}`));
		assert.ok(abstract.includes('this._remoteAgentService.getExtensionHostExitInfo(reconnectionToken).then('));
		assert.ok(!abstract.includes(`getExtensionHostExitInfo(reconnectionToken).then(${doubleCatch}`));
		assert.ok(urlHandler.includes('this.handleURL(URI.revive(JSON.parse(urlToHandleValue)), { trusted: true });'));
		assert.ok(!urlHandler.includes('this.handleURL(URI.revive(JSON.parse(urlToHandleValue)), { trusted: true }).catch'));
		assert.ok(urlHandler.includes('this.handleURLByExtension(extensionId, handler, uri);'));
		assert.ok(!urlHandler.includes('this.handleURLByExtension(extensionId, handler, uri).catch'));
		assert.ok(native.includes('this.startExtensionHosts();'));
		assert.ok(!native.includes('this.startExtensionHosts().catch'));
		for (const source of [native, local, remote, abstract, manager]) {
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
