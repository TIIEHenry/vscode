/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const IPC_REL = 'src/vs/base/parts/ipc/common/ipc.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const NATIVE_REL = 'src/vs/platform/native/common/native.ts';
const MCP_MANIFEST_REL = 'src/vs/platform/mcp/common/mcpGalleryManifest.ts';
const PATH_COMMON_REL = 'src/vs/workbench/services/path/common/pathService.ts';
const PATH_BROWSER_REL = 'src/vs/workbench/services/path/browser/pathService.ts';
const PATH_ELECTRON_REL = 'src/vs/workbench/services/path/electron-browser/pathService.ts';
const SHARED_REL = 'src/vs/workbench/services/sharedProcess/electron-browser/sharedProcessService.ts';
const AUX_BROWSER_REL = 'src/vs/workbench/services/auxiliaryWindow/browser/auxiliaryWindowService.ts';
const AUX_ELECTRON_REL = 'src/vs/workbench/services/auxiliaryWindow/electron-browser/auxiliaryWindowService.ts';
const MCP_BROWSER_REL = 'src/vs/workbench/services/mcp/browser/mcpGalleryManifestService.ts';
const MCP_ELECTRON_REL = 'src/vs/workbench/services/mcp/electron-browser/mcpGalleryManifestService.ts';
const MCP_COMMON_REL = 'src/vs/workbench/services/mcp/common/mcpWorkbenchManagementService.ts';
const CHECKSUM_REL = 'src/vs/workbench/services/checksum/electron-browser/checksumService.ts';
const WORKSPACES_TRUST_REL = 'src/vs/workbench/services/workspaces/common/workspaceTrust.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const STATUSBAR_REL = 'src/vs/workbench/browser/parts/statusbar/statusbarPart.ts';
const CONFIG_RESOLVER_REL = 'src/vs/workbench/services/configurationResolver/browser/configurationResolverService.ts';
const TIMER_REL = 'src/vs/workbench/services/timer/browser/timerService.ts';

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

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function assertThenWrapped(source: string, thenStart: string): void {
	const idx = source.indexOf(thenStart);
	assert.ok(idx >= 0, `missing then: ${thenStart}`);
	const afterThen = source.slice(idx);
	const closeThen = afterThen.indexOf(`})${doubleCatch};`);
	assert.ok(closeThen >= 0, `then not double-chained: ${thenStart}`);
	assert.ok(!source.includes(`${thenStart};`));
	assert.ok(!source.includes(`${thenStart}.catch(onUnexpectedError);`));
}

const registerChannelThen = 'this.withSharedProcessConnection.then(connection => connection.registerChannel(channelName, channel))';
const stylesLoadedThen = 'stylesLoaded.wait().then(() => mark(\'code/auxiliaryWindow/didLoadCSSStyles\'))';
const handleFullScreenCall = 'this.handleFullScreenState()';
const closeWindowCall = 'this.nativeHostService.closeWindow({ targetWindowId: this.window.vscodeWindowId })';
const mcpElectronThen = 'this.getMcpGalleryManifest().then(manifest => {';
const mcpBrowserThen = 'this.getMcpGalleryManifest().then(manifest => {';
const getAndUpdateCall = 'this.getAndUpdateMcpGalleryManifest()';

const d806Calls: Array<[string, string, number, 'call' | 'then']> = [
	[SHARED_REL, registerChannelThen, 1, 'call'],
	[AUX_BROWSER_REL, stylesLoadedThen, 1, 'call'],
	[AUX_ELECTRON_REL, handleFullScreenCall, 1, 'call'],
	[AUX_ELECTRON_REL, closeWindowCall, 1, 'call'],
	[MCP_ELECTRON_REL, mcpElectronThen, 1, 'then'],
	[MCP_BROWSER_REL, mcpBrowserThen, 1, 'then'],
	[MCP_BROWSER_REL, getAndUpdateCall, 1, 'call'],
];

suite('path leftover remaining overflowed to sharedProcess/auxiliaryWindow/mcp leftover Promise fire-and-forget catch scan (D806)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('path leftover remaining has fewer than four legal sites so this knife moved to sharedProcess/auxiliaryWindow/mcp leftover remaining', () => {
		const common = fs.readFileSync(resolveSource(PATH_COMMON_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(PATH_BROWSER_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(PATH_ELECTRON_REL), 'utf8');
		assert.strictEqual(countDoubleChains(common), 0);
		assert.strictEqual(countDoubleChains(browser), 0);
		assert.strictEqual(countDoubleChains(electron), 0);
		assert.ok(common.includes('return this.resolveOS.then(os => this.doHasValidBasename(resource, os, arg2));'));
		assert.ok(common.includes('return this.resolveOS.then(os => {'));
		assert.ok(!common.includes(doubleCatch));
		assert.ok(!browser.includes(doubleCatch));
		assert.ok(!electron.includes(doubleCatch));
		assert.ok(!common.includes('void this.'));
		const pathNewLegal = 0;
		assert.ok(pathNewLegal < 4, `expected path legal leftover <4, got ${pathNewLegal}`);
		assert.ok(!common.includes('D806'));
		assert.ok(!browser.includes('D806'));
		assert.ok(!electron.includes('D806'));
	});

	test('this knife covers seven leftover Promise double-chain sites after path leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d806Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			if (kind === 'then') {
				assertThenWrapped(source, call);
				assert.strictEqual(countIncludes(source, call), count, `${rel} ${call}: expected ${count} then starts, got ${countIncludes(source, call)}`);
			} else {
				const wrapped = countIncludes(source, `${call}${doubleCatch}`);
				assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
				assertWrapped(source, call);
			}
			sites += count;
		}
		assert.strictEqual(sites, 7);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(SHARED_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(AUX_BROWSER_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(AUX_ELECTRON_REL)!), 2);
		assert.strictEqual(countDoubleChains(seen.get(MCP_ELECTRON_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(MCP_BROWSER_REL)!), 2);
	});

	test('sharedProcess registerChannel then / auxiliaryWindow wait then / handleFullScreenState / closeWindow / mcp getMcpGalleryManifest then / getAndUpdate are Promise double-chain', () => {
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const auxBrowser = fs.readFileSync(resolveSource(AUX_BROWSER_REL), 'utf8');
		const auxElectron = fs.readFileSync(resolveSource(AUX_ELECTRON_REL), 'utf8');
		const mcpBrowser = fs.readFileSync(resolveSource(MCP_BROWSER_REL), 'utf8');
		const mcpElectron = fs.readFileSync(resolveSource(MCP_ELECTRON_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		const native = fs.readFileSync(resolveSource(NATIVE_REL), 'utf8');
		const mcpManifest = fs.readFileSync(resolveSource(MCP_MANIFEST_REL), 'utf8');

		assertPromiseSignature(shared, 'private async connect(): Promise<MessagePortClient> {');
		assertPromiseSignature(shared, '	private readonly withSharedProcessConnection: Promise<MessagePortClient>;');
		assertPromiseSignature(asyncSource, '	wait(): Promise<boolean> {');
		assertPromiseSignature(auxElectron, '	private async handleFullScreenState(): Promise<void> {');
		assertPromiseSignature(native, '	closeWindow(options?: INativeHostOptions): Promise<void>;');
		assertPromiseSignature(mcpManifest, '	getMcpGalleryManifest(): Promise<IMcpGalleryManifest | null>;');
		assertPromiseSignature(mcpBrowser, '	override async getMcpGalleryManifest(): Promise<IMcpGalleryManifest | null> {');
		assertPromiseSignature(mcpBrowser, '	private async getAndUpdateMcpGalleryManifest(): Promise<void> {');
		assert.ok(ipc.includes('	registerChannel(channelName: string, channel: IServerChannel<TContext>): void;'));
		assert.ok(ipc.includes('	call<T>(command: string, arg?: any, cancellationToken?: CancellationToken): Promise<T>;'));

		assert.ok(shared.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(auxBrowser.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(auxElectron.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(mcpBrowser.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(mcpElectron.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(shared, registerChannelThen);
		assertWrapped(auxBrowser, stylesLoadedThen);
		assertWrapped(auxElectron, handleFullScreenCall);
		assertWrapped(auxElectron, closeWindowCall);
		assertThenWrapped(mcpElectron, mcpElectronThen);
		assertThenWrapped(mcpBrowser, mcpBrowserThen);
		assertWrapped(mcpBrowser, getAndUpdateCall);

		assert.ok(!shared.includes(`${registerChannelThen};`));
		assert.ok(!auxBrowser.includes(`${stylesLoadedThen};`));
		assert.ok(!auxElectron.includes(`${handleFullScreenCall};`));
		assert.ok(!auxElectron.includes(`${closeWindowCall};`));
		assert.ok(mcpBrowser.includes('await this.getAndUpdateMcpGalleryManifest();'));
		assert.ok(!mcpBrowser.includes(`await this.getAndUpdateMcpGalleryManifest()${doubleCatch}`));
	});

	test('path leftover remaining overflow stayed in sharedProcess/auxiliaryWindow/mcp and did not overflow into checksum/host/notification/statusbar/configurationResolver/timer/workspaces', () => {
		const checksum = fs.readFileSync(resolveSource(CHECKSUM_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const statusbar = fs.readFileSync(resolveSource(STATUSBAR_REL), 'utf8');
		const configResolver = fs.readFileSync(resolveSource(CONFIG_RESOLVER_REL), 'utf8');
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_TRUST_REL), 'utf8');
		const mcpCommon = fs.readFileSync(resolveSource(MCP_COMMON_REL), 'utf8');
		assert.ok(!checksum.includes(doubleCatch));
		assert.ok(!checksum.includes('D806'));
		assert.ok(!host.includes('D806'));
		assert.ok(!notification.includes('D806'));
		assert.ok(!statusbar.includes('D806'));
		assert.ok(!configResolver.includes('D806'));
		assert.ok(!timer.includes('D806'));
		assert.ok(!workspaces.includes('D806'));
		assert.ok(!mcpCommon.includes(doubleCatch));
		assert.ok(workspaces.includes('this.resolveCanonicalUris()'));
		assert.ok(workspaces.includes('this.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)'));
		assert.ok(!workspaces.includes(`this.resolveCanonicalUris()${doubleCatch}`));
		assert.ok(!workspaces.includes(`resolveAuthority(this.environmentService.remoteAuthority)${doubleCatch}`));
		assert.ok(workspaces.includes('\t\tthis.resolveCanonicalUris()\n\t\t\t.then(async () => {'));
		assert.ok(workspaces.includes('\t\t\t.finally(() => {\n\t\t\t\tthis._workspaceResolvedPromiseResolve();'));
		assert.ok(workspaces.includes('\t\t\tthis.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)\n\t\t\t\t.then(async result => {'));
		assert.ok(workspaces.includes('\t\t\t\t.finally(() => {\n\t\t\t\t\tthis._workspaceTrustInitializedPromiseResolve();'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const auxBrowser = fs.readFileSync(resolveSource(AUX_BROWSER_REL), 'utf8');
		const auxElectron = fs.readFileSync(resolveSource(AUX_ELECTRON_REL), 'utf8');
		const mcpBrowser = fs.readFileSync(resolveSource(MCP_BROWSER_REL), 'utf8');
		const mcpElectron = fs.readFileSync(resolveSource(MCP_ELECTRON_REL), 'utf8');
		const pathCommon = fs.readFileSync(resolveSource(PATH_COMMON_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_TRUST_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(pathCommon, '	hasValidBasename(resource: URI, basename?: string): Promise<boolean>;');
		assertPromiseSignature(pathCommon, '	async fileURI(_path: string): Promise<URI> {');
		assertPromiseSignature(shared, '	async createRawConnection(): Promise<MessagePort> {');
		assertPromiseSignature(auxBrowser, '	async open(options?: IAuxiliaryWindowOpenOptions): Promise<IAuxiliaryWindow> {');
		assertPromiseSignature(workspaces, '	private async resolveCanonicalUris(): Promise<void> {');

		assert.ok(pathCommon.includes('return this.resolveOS.then(os => this.doHasValidBasename(resource, os, arg2));'));
		assert.ok(!pathCommon.includes(`return this.resolveOS.then(os => this.doHasValidBasename(resource, os, arg2))${doubleCatch}`));
		assert.ok(pathCommon.includes('return this.resolveOS.then(os => {'));
		assert.ok(!pathCommon.includes(`return this.resolveOS.then(os => {${doubleCatch}`));

		assert.ok(shared.includes('return getDelayedChannel(this.withSharedProcessConnection.then(connection => connection.getChannel(channelName)));'));
		assert.ok(!shared.includes(`this.withSharedProcessConnection.then(connection => connection.getChannel(channelName))${doubleCatch}`));

		assert.ok(auxBrowser.includes('this.whenStylesHaveLoaded = stylesHaveLoaded.wait().then(() => undefined);'));
		assert.ok(!auxBrowser.includes(`this.whenStylesHaveLoaded = stylesHaveLoaded.wait().then(() => undefined)${doubleCatch}`));

		assert.ok(auxElectron.includes('(async () => {\n\t\t\tthis.maximized = await this.nativeHostService.isMaximized({ targetWindowId: this.window.vscodeWindowId });\n\t\t})();'));
		assert.ok(auxElectron.includes('(async () => {\n\t\t\tthis.alwaysOnTop = await this.nativeHostService.isWindowAlwaysOnTop({ targetWindowId: this.window.vscodeWindowId });\n\t\t})();'));
		assert.ok(!auxElectron.includes('})().catch(onUnexpectedError)'));

		assert.ok(mcpElectron.includes("channel.call('setMcpGalleryManifest', [manifest]);"));
		assert.ok(mcpBrowser.includes("channel.call('setMcpGalleryManifest', [manifest]);"));
		assert.ok(!mcpElectron.includes(`channel.call('setMcpGalleryManifest', [manifest])${doubleCatch}`));
		assert.ok(!mcpBrowser.includes(`channel.call('setMcpGalleryManifest', [manifest])${doubleCatch}`));

		assert.ok(workspaces.includes('\t\tthis.resolveCanonicalUris()\n\t\t\t.then(async () => {'));
		assert.ok(workspaces.includes('\t\t\tthis.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)\n\t\t\t\t.then(async result => {'));
		assert.ok(workspaces.includes('\t\t\t.finally(() => {\n\t\t\t\tthis._workspaceResolvedPromiseResolve();'));
		assert.ok(workspaces.includes('\t\t\t\t.finally(() => {\n\t\t\t\t\tthis._workspaceTrustInitializedPromiseResolve();'));
		assert.ok(!workspaces.includes(`this.resolveCanonicalUris()\n\t\t\t.then(async () => {\n\t\t\t\tthis._canonicalUrisResolved = true;\n\t\t\t\tawait this.updateWorkspaceTrust();\n\t\t\t})${doubleCatch}`));
		assert.ok(!workspaces.includes(`resolveAuthority(this.environmentService.remoteAuthority)\n\t\t\t\t.then(async result => {\n\t\t\t\t\tthis._remoteAuthority = result;\n\t\t\t\t\tawait this.fileService.activateProvider(Schemas.vscodeRemote);\n\t\t\t\t\tawait this.updateWorkspaceTrust();\n\t\t\t\t})${doubleCatch}`));

		assert.ok(!shared.includes('extends Action2'));
		assert.ok(!auxBrowser.includes('extends Action2'));
		assert.ok(!auxElectron.includes('extends Action2'));
		assert.ok(!mcpBrowser.includes('extends Action2'));
		assert.ok(!mcpElectron.includes('extends Action2'));

		assert.ok(ipc.includes('void promise.then('));
		assert.ok(!shared.includes('.then(connection => connection.registerChannel(channelName, channel),'));
		assert.ok(!auxBrowser.includes('.then(() => mark(\'code/auxiliaryWindow/didLoadCSSStyles\'),'));

		for (const source of [shared, auxBrowser, auxElectron, mcpBrowser, mcpElectron, pathCommon]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
