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
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const ACTIONS_REL = 'src/vs/base/common/actions.ts';
const UTILITY_IFACE_REL = 'src/vs/platform/utilityProcess/common/utilityProcessWorkerService.ts';
const ADDRESS_REL = 'src/vs/platform/remote/common/remoteAgentConnection.ts';
const SHARED_TUNNEL_REL = 'src/vs/platform/remote/common/sharedProcessTunnelService.ts';
const TUNNEL_IFACE_REL = 'src/vs/platform/tunnel/common/tunnel.ts';
const DECORATIONS_REL = 'src/vs/workbench/services/decorations/browser/decorationsService.ts';
const CLIPBOARD_BROWSER_REL = 'src/vs/workbench/services/clipboard/browser/clipboardService.ts';
const CLIPBOARD_NATIVE_REL = 'src/vs/workbench/services/clipboard/electron-browser/clipboardService.ts';
const CONTEXTMENU_REL = 'src/vs/workbench/services/contextmenu/electron-browser/contextmenuService.ts';
const DRIVER_REL = 'src/vs/workbench/services/driver/browser/driver.ts';
const CHECKSUM_REL = 'src/vs/workbench/services/checksum/electron-browser/checksumService.ts';
const WATCHER_REL = 'src/vs/workbench/services/files/electron-browser/watcherClient.ts';
const UTILITY_REL = 'src/vs/workbench/services/utilityProcess/electron-browser/utilityProcessWorkerWorkbenchService.ts';
const TUNNEL_REL = 'src/vs/workbench/services/tunnel/electron-browser/tunnelService.ts';
const TUNNEL_MODEL_REL = 'src/vs/workbench/services/remote/common/tunnelModel.ts';
const REMOTE_ABS_REL = 'src/vs/workbench/services/remote/common/abstractRemoteAgentService.ts';
const SHARED_REL = 'src/vs/workbench/services/sharedProcess/electron-browser/sharedProcessService.ts';
const AUX_REL = 'src/vs/workbench/services/auxiliaryWindow/browser/auxiliaryWindowService.ts';
const MCP_BROWSER_REL = 'src/vs/workbench/services/mcp/browser/mcpGalleryManifestService.ts';
const PATH_REL = 'src/vs/workbench/services/path/common/pathService.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const UNTITLED_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const USER_ACTIVITY_REL = 'src/vs/workbench/services/userActivity/common/userActivityService.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/browser/secretStorageService.ts';
const TYPE_HIERARCHY_REL = 'src/vs/workbench/contrib/typeHierarchy/common/typeHierarchy.ts';
const CALL_HIERARCHY_REL = 'src/vs/workbench/contrib/callHierarchy/common/callHierarchy.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const DATA_CHANNEL_REL = 'src/vs/workbench/services/dataChannel/browser/dataChannelService.ts';

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

const runActionCall = 'this.runAction(entry, delegate, event)';
const watcherThen = 'onDidTerminate.then(({ reason }) => {';
const utilityThen = 'onDidTerminate.then(({ reason }) => {';
const disposeWorkerCall = `this.utilityProcessWorkerService.disposeWorker({
				process,
				reply: { windowId: this.windowId }
			})`;
const getAddressThen = 'this._addressProvider.getAddress().then((address) => {';
const destroyTunnelCall = 'this._sharedProcessTunnelService.destroyTunnel(id)';
const tunnelsThen = 'this.tunnelService.tunnels.then(async (tunnels) => {';

const d810Calls: Array<[string, string, number, 'call' | 'then']> = [
	[CONTEXTMENU_REL, runActionCall, 1, 'call'],
	[WATCHER_REL, watcherThen, 1, 'then'],
	[UTILITY_REL, utilityThen, 1, 'then'],
	[UTILITY_REL, disposeWorkerCall, 1, 'call'],
	[TUNNEL_REL, getAddressThen, 1, 'then'],
	[TUNNEL_REL, destroyTunnelCall, 1, 'call'],
	[TUNNEL_MODEL_REL, tunnelsThen, 1, 'then'],
];

suite('decorations leftover remaining overflowed to contextmenu leftover Promise fire-and-forget catch scan (D810)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('decorations leftover remaining has fewer than four legal sites so this knife moved through clipboard/driver/checksum to contextmenu leftover remaining', () => {
		const decorations = fs.readFileSync(resolveSource(DECORATIONS_REL), 'utf8');
		const clipboardBrowser = fs.readFileSync(resolveSource(CLIPBOARD_BROWSER_REL), 'utf8');
		const clipboardNative = fs.readFileSync(resolveSource(CLIPBOARD_NATIVE_REL), 'utf8');
		const driver = fs.readFileSync(resolveSource(DRIVER_REL), 'utf8');
		const checksum = fs.readFileSync(resolveSource(CHECKSUM_REL), 'utf8');
		assert.strictEqual(countDoubleChains(decorations), 0);
		assert.ok(decorations.includes('const request = new DecorationDataRequest(cts, Promise.resolve(dataOrThenable).then(data => {'));
		assert.ok(!decorations.includes(doubleCatch));
		assert.strictEqual(countDoubleChains(clipboardBrowser), 0);
		assert.strictEqual(countDoubleChains(clipboardNative), 0);
		assert.ok(!clipboardBrowser.includes('.then('));
		assert.ok(!clipboardNative.includes('.then('));
		assert.strictEqual(countDoubleChains(driver), 0);
		assert.ok(!driver.includes('.then('));
		assert.strictEqual(countDoubleChains(checksum), 0);
		assert.ok(!checksum.includes('.then('));
		const decorationsLegal = 0;
		const clipboardLegal = 0;
		const driverLegal = 0;
		const checksumLegal = 0;
		assert.ok(decorationsLegal < 4, `expected decorations legal leftover <4, got ${decorationsLegal}`);
		assert.ok(clipboardLegal < 4, `expected clipboard legal leftover <4, got ${clipboardLegal}`);
		assert.ok(driverLegal < 4, `expected driver legal leftover <4, got ${driverLegal}`);
		assert.ok(checksumLegal < 4, `expected checksum legal leftover <4, got ${checksumLegal}`);
		assert.ok(!decorations.includes('D810'));
		assert.ok(!clipboardBrowser.includes('D810'));
		assert.ok(!driver.includes('D810'));
		assert.ok(!checksum.includes('D810'));
	});

	test('this knife covers seven leftover Promise double-chain sites after decorations leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d810Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(CONTEXTMENU_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(WATCHER_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(UTILITY_REL)!), 2);
		assert.strictEqual(countDoubleChains(seen.get(TUNNEL_REL)!), 2);
		assert.strictEqual(countDoubleChains(seen.get(TUNNEL_MODEL_REL)!), 1);
	});

	test('contextmenu leftover runAction and files/utilityProcess leftover onDidTerminate then / disposeWorker are Promise double-chain', () => {
		const contextmenu = fs.readFileSync(resolveSource(CONTEXTMENU_REL), 'utf8');
		const watcher = fs.readFileSync(resolveSource(WATCHER_REL), 'utf8');
		const utility = fs.readFileSync(resolveSource(UTILITY_REL), 'utf8');
		const utilityIface = fs.readFileSync(resolveSource(UTILITY_IFACE_REL), 'utf8');
		assertPromiseSignature(contextmenu, 'private async runAction(actionToRun: IAction, delegate: IContextMenuDelegate, event: IContextMenuEvent): Promise<void> {');
		assertPromiseSignature(utility, '	onDidTerminate: Promise<IOnDidTerminateUtilityrocessWorkerProcess>;');
		assertPromiseSignature(utilityIface, '	createWorker(configuration: IUtilityProcessWorkerCreateConfiguration): Promise<IOnDidTerminateUtilityrocessWorkerProcess>;');
		assertPromiseSignature(utilityIface, '	disposeWorker(configuration: IUtilityProcessWorkerConfiguration): Promise<void>;');
		assert.ok(contextmenu.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(watcher.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(utility.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(contextmenu, runActionCall);
		assertThenWrapped(watcher, watcherThen);
		assertThenWrapped(utility, utilityThen);
		assertWrapped(utility, disposeWorkerCall);
		assert.ok(!contextmenu.includes(`${runActionCall};`));
		assert.ok(!watcher.includes('onDidTerminate.then(({ reason }) => {\n\t\t\t\tif (reason?.code === 0) {\n\t\t\t\t\tthis.trace(`terminated by itself with code ${reason.code}, signal: ${reason.signal}`);\n\t\t\t\t} else {\n\t\t\t\t\tthis.onError(`terminated by itself unexpectedly with code ${reason?.code}, signal: ${reason?.signal} (ETERM)`);\n\t\t\t\t}\n\t\t\t});'));
		assert.ok(!utility.includes(`${disposeWorkerCall};`));
	});

	test('tunnel leftover getAddress then / destroyTunnel and remote leftover tunnels then are Promise double-chain', () => {
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const tunnelModel = fs.readFileSync(resolveSource(TUNNEL_MODEL_REL), 'utf8');
		const address = fs.readFileSync(resolveSource(ADDRESS_REL), 'utf8');
		const sharedTunnel = fs.readFileSync(resolveSource(SHARED_TUNNEL_REL), 'utf8');
		const tunnelIface = fs.readFileSync(resolveSource(TUNNEL_IFACE_REL), 'utf8');
		assertPromiseSignature(address, '	getAddress(): Promise<IAddress<T>>;');
		assertPromiseSignature(sharedTunnel, '	destroyTunnel(id: string): Promise<void>;');
		assertPromiseSignature(tunnelIface, '	public get tunnels(): Promise<readonly RemoteTunnel[]> {');
		assert.ok(tunnel.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(tunnelModel.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertThenWrapped(tunnel, getAddressThen);
		assertWrapped(tunnel, destroyTunnelCall);
		assertThenWrapped(tunnelModel, tunnelsThen);
		assert.ok(!tunnel.includes('this._addressProvider.getAddress().then((address) => {\n\t\t\tthis._sharedProcessTunnelService.setAddress(this._id, address);\n\t\t});'));
		assert.ok(!tunnel.includes(`${destroyTunnelCall};`));
		assert.ok(tunnel.includes('await this._sharedProcessTunnelService.destroyTunnel(this._id);'));
		assert.ok(!tunnel.includes(`await this._sharedProcessTunnelService.destroyTunnel(this._id)${doubleCatch}`));
	});

	test('decorations leftover remaining overflow stayed off occupied modules and D806 path/sharedProcess/auxiliaryWindow/mcp', () => {
		const workingCopy = fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8');
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');
		const untitled = fs.readFileSync(resolveSource(UNTITLED_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const userActivity = fs.readFileSync(resolveSource(USER_ACTIVITY_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const typeHierarchy = fs.readFileSync(resolveSource(TYPE_HIERARCHY_REL), 'utf8');
		const callHierarchy = fs.readFileSync(resolveSource(CALL_HIERARCHY_REL), 'utf8');
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const aux = fs.readFileSync(resolveSource(AUX_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_BROWSER_REL), 'utf8');
		const pathSrc = fs.readFileSync(resolveSource(PATH_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		for (const source of [workingCopy, textfile, untitled, views, notification, progress, userData, userActivity, secrets, typeHierarchy, callHierarchy, shared, aux, mcp, pathSrc, host]) {
			assert.ok(!source.includes('D810'));
		}
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const decorations = fs.readFileSync(resolveSource(DECORATIONS_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_BROWSER_REL), 'utf8');
		const contextmenu = fs.readFileSync(resolveSource(CONTEXTMENU_REL), 'utf8');
		const watcher = fs.readFileSync(resolveSource(WATCHER_REL), 'utf8');
		const utility = fs.readFileSync(resolveSource(UTILITY_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const tunnelModel = fs.readFileSync(resolveSource(TUNNEL_MODEL_REL), 'utf8');
		const remoteAbs = fs.readFileSync(resolveSource(REMOTE_ABS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const dataChannel = fs.readFileSync(resolveSource(DATA_CHANNEL_REL), 'utf8');
		const sharedTunnel = fs.readFileSync(resolveSource(SHARED_TUNNEL_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_BROWSER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(sharedTunnel, '	setAddress(id: string, address: IAddress): Promise<void>;');
		assertPromiseSignature(remoteAbs, '	private _getOrCreateConnection(): Promise<Client<RemoteAgentConnectionContext>> {');
		assert.ok(actions.includes('	run(...args: unknown[]): unknown;'));

		assert.ok(clipboard.includes("run: () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2151362')"));
		assert.ok(!clipboard.includes(`this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2151362')${doubleCatch}`));
		assert.ok(!contextmenu.includes('IOpenerService'));
		assert.ok(!contextmenu.includes('openerService.open'));

		assert.ok(decorations.includes('const request = new DecorationDataRequest(cts, Promise.resolve(dataOrThenable).then(data => {'));
		assert.ok(!decorations.includes(`Promise.resolve(dataOrThenable).then(data => {${doubleCatch}`));

		assert.ok(contextmenu.includes('await actionToRun.run(context);'));
		assert.ok(!contextmenu.includes(`await actionToRun.run(context)${doubleCatch}`));
		assert.ok(contextmenu.includes('await delegate.actionRunner.run(actionToRun, context);'));
		assert.ok(!contextmenu.includes(`await delegate.actionRunner.run(actionToRun, context)${doubleCatch}`));
		assert.ok(!contextmenu.includes('extends Action2'));

		assert.ok(tunnel.includes('this._sharedProcessTunnelService.setAddress(this._id, address);'));
		assert.ok(!tunnel.includes(`this._sharedProcessTunnelService.setAddress(this._id, address)${doubleCatch}`));
		assert.ok(tunnel.includes('await this._sharedProcessTunnelService.destroyTunnel(this._id);'));

		assert.ok(remoteAbs.includes('this._getOrCreateConnection().then(client => client.registerChannel(channelName, channel));'));
		assert.ok(!remoteAbs.includes(`this._getOrCreateConnection().then(client => client.registerChannel(channelName, channel))${doubleCatch}`));
		assert.ok(remoteAbs.includes('return this.getRawEnvironment().then(undefined, () => null);'));
		assert.ok(!remoteAbs.includes(`return this.getRawEnvironment().then(undefined, () => null)${doubleCatch}`));

		assert.ok(dataChannel.includes('void this._activateExtensionProvider(entry, provider, generation);'));
		assert.ok(!dataChannel.includes(`void this._activateExtensionProvider(entry, provider, generation)${doubleCatch}`));

		assert.ok(mcp.includes("channel.call('setMcpGalleryManifest', [manifest]);"));
		assert.ok(!mcp.includes(`channel.call('setMcpGalleryManifest', [manifest])${doubleCatch}`));

		for (const source of [decorations, clipboard, contextmenu, watcher, utility, tunnel, tunnelModel]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes(`resolveCanonicalUris()${doubleCatch}`));
			assert.ok(!source.includes(`resolveAuthority${doubleCatch}`));
		}

		assert.ok(!contextmenu.includes(', error => {'));
		assert.ok(!watcher.includes(', error => {'));
		assert.ok(!utility.includes(', error => {'));
		assert.ok(!tunnel.includes(', error => {'));
		assert.ok(!tunnelModel.includes(' = this.tunnelService.tunnels.then'));
		assert.ok(!utility.includes(' = onDidTerminate.then'));
	});
});
