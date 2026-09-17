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
const SCANNER_REL = 'src/vs/workbench/services/extensions/electron-browser/cachedExtensionScanner.ts';
const HOST_MANAGERS_REL = 'src/vs/workbench/services/extensions/common/extensionHostManagers.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const NATIVE_HOST_REL = 'src/vs/platform/native/common/native.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/common/extensionManagement.ts';
const GALLERY_REL = 'src/vs/platform/extensionManagement/common/extensionManagement.ts';
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
	assert.ok(source.includes(`${call}${doubleCatch};`) || source.includes(`${call}${doubleCatch})`) || source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('workbench/services/extensions start/exit/reload leftover Promise fire-and-forget catch scan (D729)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eight leftover Promise double-chain sites; D698 / D707 / D715 / D723 wraps stay', () => {
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const urlHandler = fs.readFileSync(resolveSource(URL_REL), 'utf8');
		const d729 = [
			[abstract, 'extHostManager.start(snapshot.versionId, snapshot.extensions, extensions.map(extension => extension.identifier))'],
			[native, 'this._nativeHostService.exit(code)'],
			[native, 'this._nativeHostService.closeWindow()'],
			[local, 'this._nativeHostService.closeWindow()'],
			[local, 'this._hostService.reload()'],
			[local, 'run: () => this._hostService.reload()'],
			[native, `run: () => (async () => {
							await this._extensionEnablementService.setEnablement([toExtension(extension)], EnablementState.EnabledGlobally);
							await this._hostService.reload();
						})()`],
			[native, `run: () => (async () => {
						const [galleryExtension] = await this._extensionGalleryService.getExtensions([{ id: resolverExtensionId }], CancellationToken.None);
						if (galleryExtension) {
							await this._extensionManagementService.installFromGallery(galleryExtension);
							await this._hostService.reload();
						} else {
							this._notificationService.error(nls.localize('resolverExtensionNotFound', "\`{0}\` not found on marketplace"));
						}

					})()`],
		] as const;
		assert.strictEqual(d729.length, 8);
		for (const [source, call] of d729) {
			assertDoubleThen(source, call);
		}
		assert.ok(urlHandler.includes(`this.handleURL(URI.revive(JSON.parse(urlToHandleValue)), { trusted: true })${doubleCatch};`));
		assert.ok(urlHandler.includes(`this.handleURLByExtension(extensionId, handler, uri)${doubleCatch};`));
		assert.ok(native.includes(`this.startExtensionHosts()${doubleCatch};`));
		assert.ok(abstract.includes(`this._handleDeltaExtensions(new DeltaExtensionsQueueItem(toAdd, toRemove))${doubleCatch};`));
		assert.ok(abstract.includes(`this._onRemoteExtensionHostCrashed(extensionHost, signal)${doubleCatch};`));
		assert.ok(browser.includes(`lifecycleService.when(LifecyclePhase.Ready).then(async () => {
			await this._initializeIfNeeded();
		})${doubleCatch};`));
		assert.ok(local.includes(`this._createExtHostInitData().then(data => {`));
		assert.ok(local.includes(`${doubleCatch};`));
	});

	test('leftover on-demand extHostManager.start is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const managers = fs.readFileSync(resolveSource(HOST_MANAGERS_REL), 'utf8');
		assertPromiseSignature(managers, 'start(extensionRegistryVersionId: number, allExtensions: readonly IExtensionDescription[], myExtensions: ExtensionIdentifier[]): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'extHostManager.start(snapshot.versionId, snapshot.extensions, extensions.map(extension => extension.identifier))');
	});

	test('leftover native exit / closeWindow leftovers are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const nativeHost = fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8');
		assertPromiseSignature(nativeHost, 'exit(code: number): Promise<void>;');
		assertPromiseSignature(nativeHost, 'closeWindow(options?: INativeHostOptions): Promise<void>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._nativeHostService.exit(code)');
		assertDoubleThen(source, 'this._nativeHostService.closeWindow()');
	});

	test('leftover localProcess closeWindow / reload leftovers are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const nativeHost = fs.readFileSync(resolveSource(NATIVE_HOST_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		assertPromiseSignature(nativeHost, 'closeWindow(options?: INativeHostOptions): Promise<void>;');
		assertPromiseSignature(host, 'reload(options?: { disableExtensions?: boolean }): Promise<void>;');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, 'this._nativeHostService.closeWindow()');
		assertDoubleThen(source, 'this._hostService.reload()');
		assertDoubleThen(source, 'run: () => this._hostService.reload()');
	});

	test('leftover native no-resolver Enable/Install and Reload leftovers are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const gallery = fs.readFileSync(resolveSource(GALLERY_REL), 'utf8');
		assertPromiseSignature(enablement, 'setEnablement(extensions: IExtension[], state: EnablementState): Promise<boolean[]>;');
		assertPromiseSignature(gallery, 'installFromGallery(extension: IGalleryExtension, options?: InstallOptions): Promise<ILocalExtension>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleThen(source, `run: () => (async () => {
							await this._extensionEnablementService.setEnablement([toExtension(extension)], EnablementState.EnabledGlobally);
							await this._hostService.reload();
						})()`);
		assertDoubleThen(source, `run: () => (async () => {
						const [galleryExtension] = await this._extensionGalleryService.getExtensions([{ id: resolverExtensionId }], CancellationToken.None);
						if (galleryExtension) {
							await this._extensionManagementService.installFromGallery(galleryExtension);
							await this._hostService.reload();
						} else {
							this._notificationService.error(nls.localize('resolverExtensionNotFound', "\`{0}\` not found on marketplace"));
						}

					})()`);
		assert.ok(source.includes('await this._hostService.reload();'));
		assert.ok(!source.includes('await this._hostService.reload().catch'));
	});

	test('opener / D145 / two-arg then / assigned then / Resolve / Connect / Pty / already dual-chain stay skipped', () => {
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const manager = fs.readFileSync(resolveSource(MANAGER_REL), 'utf8');
		const contains = fs.readFileSync(resolveSource(CONTAINS_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		assert.ok(native.includes("openerService.open('https://aka.ms/vscode-extension-bisect');"));
		assert.ok(!native.includes("openerService.open('https://aka.ms/vscode-extension-bisect').catch"));
		assert.ok(native.includes("commandService.executeCommand('extension.bisect.start');"));
		assert.ok(!native.includes("commandService.executeCommand('extension.bisect.start').catch"));
		assert.ok(native.includes('run: () => this._nativeHostService.openDevTools()'));
		assert.ok(!native.includes('openDevTools().catch(onUnexpectedError)'));
		assert.ok(scanner.includes('run: () => this._hostService.reload()'));
		assert.ok(!scanner.includes('this._hostService.reload().catch(onUnexpectedError)'));
		assert.ok(local.includes('this._extensionHostProcess.waitForExit(extensionHostGraceTimeMs).catch(() => { /* best-effort */ });'));
		assert.ok(!local.includes('waitForExit(extensionHostGraceTimeMs).catch(onUnexpectedError)'));
		assert.ok(remote.includes('return this.remoteAuthorityResolverService.resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {'));
		assert.ok(!remote.includes(`resolveAuthority(this._initDataProvider.remoteAuthority).then((resolverResult) => {}${doubleCatch}`));
		assert.ok(remote.includes('return connectRemoteAgentExtensionHost(options, startParams).then(result => {'));
		assert.ok(!remote.includes(`connectRemoteAgentExtensionHost(options, startParams).then(result => {}${doubleCatch}`));
		assert.ok(remote.includes('this.disconnect();'));
		assert.ok(!remote.includes('this.disconnect().catch'));
		assert.ok(manager.includes('this._proxy = this._extensionHost.start().then('));
		assert.ok(!manager.includes(`this._extensionHost.start().then(${doubleCatch}`));
		assert.ok(contains.includes('return searchService.fileSearch(query, token).then('));
		assert.ok(!contains.includes(`fileSearch(query, token).then(${doubleCatch}`));
		assert.ok(abstract.includes('this._remoteAgentService.getExtensionHostExitInfo(reconnectionToken).then('));
		assert.ok(!abstract.includes(`getExtensionHostExitInfo(reconnectionToken).then(${doubleCatch}`));
		assert.ok(native.includes('this._register(connection.onReconnecting(() => this._resolveAuthorityAgain()));'));
		assert.ok(!native.includes('_resolveAuthorityAgain().catch(onUnexpectedError)'));
		assert.ok(abstract.includes('manager.extensionHost.disconnect();'));
		assert.ok(!abstract.includes('manager.extensionHost.disconnect().catch'));
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
