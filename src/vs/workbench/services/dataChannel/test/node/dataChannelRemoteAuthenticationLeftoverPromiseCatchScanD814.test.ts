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
const ACTIONS_REL = 'src/vs/base/common/actions.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const DATA_CHANNEL_REL = 'src/vs/workbench/services/dataChannel/browser/dataChannelService.ts';
const REMOTE_ABS_REL = 'src/vs/workbench/services/remote/common/abstractRemoteAgentService.ts';
const REMOTE_ELECTRON_REL = 'src/vs/workbench/services/remote/electron-browser/remoteAgentService.ts';
const REMOTE_BROWSER_REL = 'src/vs/workbench/services/remote/browser/remoteAgentService.ts';
const DYNAMIC_AUTH_REL = 'src/vs/workbench/services/authentication/browser/dynamicAuthenticationProviderStorageService.ts';
const AUTH_USAGE_REL = 'src/vs/workbench/services/authentication/browser/authenticationUsageService.ts';
const AUTH_MCP_USAGE_REL = 'src/vs/workbench/services/authentication/browser/authenticationMcpUsageService.ts';
const AUTH_EXT_REL = 'src/vs/workbench/services/authentication/browser/authenticationExtensionsService.ts';
const AUTH_MCP_REL = 'src/vs/workbench/services/authentication/browser/authenticationMcpService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const GATE_REL = 'src/vs/workbench/services/policies/browser/accountPolicyGateContribution.ts';
const TELEMETRY_REL = 'src/vs/workbench/services/policies/browser/policyTelemetry.contribution.ts';
const DECORATIONS_REL = 'src/vs/workbench/services/decorations/browser/decorationsService.ts';
const CLIPBOARD_BROWSER_REL = 'src/vs/workbench/services/clipboard/browser/clipboardService.ts';
const TUNNEL_REL = 'src/vs/workbench/services/tunnel/electron-browser/tunnelService.ts';
const TUNNEL_MODEL_REL = 'src/vs/workbench/services/remote/common/tunnelModel.ts';
const SHARED_REL = 'src/vs/workbench/services/sharedProcess/electron-browser/sharedProcessService.ts';
const AUX_BROWSER_REL = 'src/vs/workbench/services/auxiliaryWindow/browser/auxiliaryWindowService.ts';
const AUX_ELECTRON_REL = 'src/vs/workbench/services/auxiliaryWindow/electron-browser/auxiliaryWindowService.ts';
const MCP_BROWSER_REL = 'src/vs/workbench/services/mcp/browser/mcpGalleryManifestService.ts';
const MCP_ELECTRON_REL = 'src/vs/workbench/services/mcp/electron-browser/mcpGalleryManifestService.ts';
const WORKSPACES_TRUST_REL = 'src/vs/workbench/services/workspaces/common/workspaceTrust.ts';
const UNTITLED_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/browser/secretStorageService.ts';
const CALL_HIERARCHY_REL = 'src/vs/workbench/contrib/callHierarchy/common/callHierarchy.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const CONTEXTMENU_REL = 'src/vs/workbench/services/contextmenu/electron-browser/contextmenuService.ts';

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

const activateCall = 'void this._activateExtensionProvider(entry, provider, generation)';
const registerChannelThen = 'this._getOrCreateConnection().then(client => client.registerChannel(channelName, channel))';
const voidQueueCall = `void queue.queue(async () => {
					const tokens = await this.getSessionsForDynamicAuthProvider(payload.authProviderId, payload.clientId);
					this._onDidChangeTokens.fire({
						authProviderId: payload.authProviderId,
						clientId: payload.clientId,
						tokens
					});
				})`;
const usageQueueCall = `this._queue.queue(
				() => this._addExtensionsToCache(provider.id)
			)`;
const mcpQueueCall = `this._queue.queue(
				() => this._addToCache(provider.id)
			)`;
const getDefaultAccountThenCall = `this.defaultAccountService.getDefaultAccount().then(() => {
			this._updatePolicyDefinitions(this.policyDefinitions).catch(onUnexpectedError).catch(onUnexpectedError);
		})`;
const showManagedSettingsDialogCall = `void this.showManagedSettingsDialog().finally(() => {
			this.managedSettingsDialogVisibleKey = undefined;
			this.managedSettingsDialogDismissedKey = key;
			this.maybeShowManagedSettingsDialog();
		})`;
const refreshCall = 'void this.defaultAccountService.refresh({ forceRefresh: true, retryManagedSettings: true })';

const d814Calls: Array<[string, string, number]> = [
	[DATA_CHANNEL_REL, activateCall, 1],
	[REMOTE_ABS_REL, registerChannelThen, 1],
	[DYNAMIC_AUTH_REL, voidQueueCall, 1],
	[AUTH_USAGE_REL, usageQueueCall, 1],
	[AUTH_MCP_USAGE_REL, mcpQueueCall, 1],
];

suite('dataChannel leftover Promise fire-and-forget overflowed to remote/authentication leftover remaining catch scan (D814)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('dataChannel leftover has fewer than four legal sites so this knife moved to remote registerChannel and authentication leftover queue.queue', () => {
		const dataChannel = fs.readFileSync(resolveSource(DATA_CHANNEL_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const gate = fs.readFileSync(resolveSource(GATE_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const dataChannelLegal = countIncludes(dataChannel, `${activateCall}${doubleCatch}`);
		assert.ok(dataChannelLegal < 4, `expected dataChannel legal leftover <4, got ${dataChannelLegal}`);
		assert.strictEqual(dataChannelLegal, 1);
		assert.strictEqual(countDoubleChains(dataChannel), 1);
		const policiesAlreadyDouble =
			countIncludes(account, `${getDefaultAccountThenCall}${doubleCatch}`) +
			countIncludes(gate, `${showManagedSettingsDialogCall}${doubleCatch}`) +
			countIncludes(gate, `${refreshCall}${doubleCatch}`);
		assert.strictEqual(policiesAlreadyDouble, 3);
		assert.ok(account.includes(`this._updatePolicyDefinitions(this.policyDefinitions)${doubleCatch}`));
		assert.ok(!account.includes('\t\tthis._updatePolicyDefinitions(this.policyDefinitions);\n'));
		assert.ok(!telemetry.includes('.then('));
		assert.ok(!telemetry.includes(doubleCatch));
		assert.ok(!dataChannel.includes('D814'));
	});

	test('this knife covers five leftover Promise double-chain sites after dataChannel leftover overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d814Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(DATA_CHANNEL_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(REMOTE_ABS_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(DYNAMIC_AUTH_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(AUTH_USAGE_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(AUTH_MCP_USAGE_REL) ?? ''), 1);
	});

	test('dataChannel leftover _activateExtensionProvider is Promise double-chain', () => {
		const dataChannel = fs.readFileSync(resolveSource(DATA_CHANNEL_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(dataChannel, 'private async _activateExtensionProvider(entry: SharedLinkPresentationEntry, provider: ISelectedLinkPresentationProvider, generation: number): Promise<void> {');
		assertPromiseSignature(extensions, 'activateByEvent(activationEvent: string, activationKind?: ActivationKind): Promise<void>;');
		assert.ok(dataChannel.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(dataChannel, activateCall);
		assert.ok(!dataChannel.includes(`${activateCall};`));
	});

	test('remote leftover registerChannel then is Promise double-chain and was not already-double from D784', () => {
		const remoteAbs = fs.readFileSync(resolveSource(REMOTE_ABS_REL), 'utf8');
		const ipc = fs.readFileSync(resolveSource(IPC_REL), 'utf8');
		assertPromiseSignature(remoteAbs, '	private _getOrCreateConnection(): Promise<Client<RemoteAgentConnectionContext>> {');
		assertPromiseSignature(remoteAbs, '	private async _createConnection(): Promise<Client<RemoteAgentConnectionContext>> {');
		assert.ok(ipc.includes('	registerChannel(channelName: string, channel: IServerChannel<TContext>): void;'));
		assert.ok(remoteAbs.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(remoteAbs, registerChannelThen);
		assert.ok(!remoteAbs.includes(`${registerChannelThen};`));
	});

	test('authentication leftover void queue.queue / leftover _queue.queue are Promise double-chain', () => {
		const dynamic = fs.readFileSync(resolveSource(DYNAMIC_AUTH_REL), 'utf8');
		const usage = fs.readFileSync(resolveSource(AUTH_USAGE_REL), 'utf8');
		const mcpUsage = fs.readFileSync(resolveSource(AUTH_MCP_USAGE_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		assertPromiseSignature(asyncSource, '	queue(factory: ITask<Promise<T>>): Promise<T>;');
		assertPromiseSignature(dynamic, '	async getSessionsForDynamicAuthProvider(authProviderId: string, clientId: string): Promise<(IAuthorizationTokenResponse & { created_at: number })[] | undefined> {');
		assertPromiseSignature(usage, '	private async _addExtensionsToCache(providerId: string) {');
		assertPromiseSignature(mcpUsage, '	private async _addToCache(providerId: string) {');
		assert.ok(dynamic.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(usage.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(mcpUsage.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(dynamic, voidQueueCall);
		assertWrapped(usage, usageQueueCall);
		assertWrapped(mcpUsage, mcpQueueCall);
		assert.ok(!dynamic.includes(`${voidQueueCall};`));
		assert.ok(usage.includes('await this._queue.queue(() => Promise.all(this._authenticationService.getProviderIds().map(providerId => this._addExtensionsToCache(providerId))));'));
		assert.ok(!usage.includes(`await this._queue.queue(() => Promise.all(this._authenticationService.getProviderIds().map(providerId => this._addExtensionsToCache(providerId))))${doubleCatch}`));
		assert.ok(mcpUsage.includes('await this._queue.queue(() => Promise.all(this._authenticationService.getProviderIds().map(providerId => this._addToCache(providerId))));'));
		assert.ok(!mcpUsage.includes(`await this._queue.queue(() => Promise.all(this._authenticationService.getProviderIds().map(providerId => this._addToCache(providerId))))${doubleCatch}`));
	});

	test('policies leftover remaining already-double stays already-double; leftover remaining completeSessionAccessRequest / D810 remaining leftover stay skipped', () => {
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const gate = fs.readFileSync(resolveSource(GATE_REL), 'utf8');
		const authExt = fs.readFileSync(resolveSource(AUTH_EXT_REL), 'utf8');
		const authMcp = fs.readFileSync(resolveSource(AUTH_MCP_REL), 'utf8');
		const decorations = fs.readFileSync(resolveSource(DECORATIONS_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_BROWSER_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const mcpBrowser = fs.readFileSync(resolveSource(MCP_BROWSER_REL), 'utf8');
		const mcpElectron = fs.readFileSync(resolveSource(MCP_ELECTRON_REL), 'utf8');
		const auxElectron = fs.readFileSync(resolveSource(AUX_ELECTRON_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_TRUST_REL), 'utf8');
		assertWrapped(account, getDefaultAccountThenCall);
		assertWrapped(gate, showManagedSettingsDialogCall);
		assertWrapped(gate, refreshCall);
		assert.ok(account.includes(`this._updatePolicyDefinitions(this.policyDefinitions)${doubleCatch}`));
		assert.ok(!account.includes('\t\tthis._updatePolicyDefinitions(this.policyDefinitions);\n'));
		assert.ok(authExt.includes('this.completeSessionAccessRequest(provider, extensionId, extensionName, scopeListOrRequest);'));
		assert.ok(!authExt.includes(`this.completeSessionAccessRequest(provider, extensionId, extensionName, scopeListOrRequest)${doubleCatch}`));
		assert.ok(authMcp.includes('this.completeSessionAccessRequest(provider, mcpServerId, mcpServerName, scopes);'));
		assert.ok(!authMcp.includes(`this.completeSessionAccessRequest(provider, mcpServerId, mcpServerName, scopes)${doubleCatch}`));
		assert.ok(decorations.includes('const request = new DecorationDataRequest(cts, Promise.resolve(dataOrThenable).then(data => {'));
		assert.ok(!decorations.includes(`Promise.resolve(dataOrThenable).then(data => {${doubleCatch}`));
		assert.ok(clipboard.includes("run: () => this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2151362')"));
		assert.ok(!clipboard.includes(`this.openerService.open('https://go.microsoft.com/fwlink/?linkid=2151362')${doubleCatch}`));
		assert.ok(tunnel.includes('this._sharedProcessTunnelService.setAddress(this._id, address);'));
		assert.ok(!tunnel.includes(`this._sharedProcessTunnelService.setAddress(this._id, address)${doubleCatch}`));
		assert.ok(mcpElectron.includes("channel.call('setMcpGalleryManifest', [manifest]);"));
		assert.ok(mcpBrowser.includes("channel.call('setMcpGalleryManifest', [manifest]);"));
		assert.ok(!mcpElectron.includes(`channel.call('setMcpGalleryManifest', [manifest])${doubleCatch}`));
		assert.ok(!mcpBrowser.includes(`channel.call('setMcpGalleryManifest', [manifest])${doubleCatch}`));
		assert.ok(auxElectron.includes('(async () => {\n\t\t\tthis.maximized = await this.nativeHostService.isMaximized({ targetWindowId: this.window.vscodeWindowId });\n\t\t})();'));
		assert.ok(auxElectron.includes('(async () => {\n\t\t\tthis.alwaysOnTop = await this.nativeHostService.isWindowAlwaysOnTop({ targetWindowId: this.window.vscodeWindowId });\n\t\t})();'));
		assert.ok(!auxElectron.includes('})().catch(onUnexpectedError)'));
		assert.ok(workspaces.includes('\t\tthis.resolveCanonicalUris()\n\t\t\t.then(async () => {'));
		assert.ok(workspaces.includes('\t\t\tthis.remoteAuthorityResolverService.resolveAuthority(this.environmentService.remoteAuthority)\n\t\t\t\t.then(async result => {'));
		assert.ok(!workspaces.includes(`this.resolveCanonicalUris()\n\t\t\t.then(async () => {\n\t\t\t\tthis._canonicalUrisResolved = true;\n\t\t\t\tawait this.updateWorkspaceTrust();\n\t\t\t})${doubleCatch}`));
		assert.ok(!workspaces.includes(`resolveAuthority(this.environmentService.remoteAuthority)\n\t\t\t\t.then(async result => {\n\t\t\t\t\tthis._remoteAuthority = result;\n\t\t\t\t\tawait this.fileService.activateProvider(Schemas.vscodeRemote);\n\t\t\t\t\tawait this.updateWorkspaceTrust();\n\t\t\t\t})${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const dataChannel = fs.readFileSync(resolveSource(DATA_CHANNEL_REL), 'utf8');
		const remoteAbs = fs.readFileSync(resolveSource(REMOTE_ABS_REL), 'utf8');
		const remoteElectron = fs.readFileSync(resolveSource(REMOTE_ELECTRON_REL), 'utf8');
		const remoteBrowser = fs.readFileSync(resolveSource(REMOTE_BROWSER_REL), 'utf8');
		const dynamic = fs.readFileSync(resolveSource(DYNAMIC_AUTH_REL), 'utf8');
		const usage = fs.readFileSync(resolveSource(AUTH_USAGE_REL), 'utf8');
		const mcpUsage = fs.readFileSync(resolveSource(AUTH_MCP_USAGE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const untitled = fs.readFileSync(resolveSource(UNTITLED_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const callHierarchy = fs.readFileSync(resolveSource(CALL_HIERARCHY_REL), 'utf8');
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');
		const workingCopy = fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const contextmenu = fs.readFileSync(resolveSource(CONTEXTMENU_REL), 'utf8');
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const auxBrowser = fs.readFileSync(resolveSource(AUX_BROWSER_REL), 'utf8');
		const tunnelModel = fs.readFileSync(resolveSource(TUNNEL_MODEL_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(actions.includes('	run(...args: unknown[]): unknown;'));
		assertPromiseSignature(remoteAbs, '	private _getOrCreateConnection(): Promise<Client<RemoteAgentConnectionContext>> {');

		assert.ok(!dataChannel.includes('IOpenerService'));
		assert.ok(!dataChannel.includes('openerService.open'));
		assert.ok(!usage.includes('IOpenerService'));
		assert.ok(!mcpUsage.includes('IOpenerService'));
		assert.ok(!dynamic.includes('extends Action2'));
		assert.ok(!dataChannel.includes('extends Action2'));
		assert.ok(!remoteAbs.includes('extends Action2'));

		assert.ok(remoteAbs.includes('return this.getRawEnvironment().then(undefined, () => null);'));
		assert.ok(!remoteAbs.includes(`return this.getRawEnvironment().then(undefined, () => null)${doubleCatch}`));
		assert.ok(remoteAbs.includes('return <T>getDelayedChannel(this._getOrCreateConnection().then(c => c.getChannel(channelName)));'));
		assert.ok(!remoteAbs.includes(`this._getOrCreateConnection().then(c => c.getChannel(channelName))${doubleCatch}`));
		assert.ok(remoteElectron.includes('.then(undefined, err => {'));
		assert.ok(!remoteElectron.includes(doubleCatch));
		assert.ok(remoteBrowser.includes('.then(undefined, (err) => {'));
		assert.ok(!remoteBrowser.includes(doubleCatch));

		assert.ok(!dataChannel.includes('.then('));
		assert.ok(!usage.includes('.then('));
		assert.ok(!mcpUsage.includes('.then('));
		assert.ok(!dynamic.includes('.then('));
		assert.ok(!remoteAbs.includes('.then(client => client.registerChannel(channelName, channel),'));

		for (const source of [untitled, views, progress, userData, secrets, callHierarchy, textfile, workingCopy, host, contextmenu]) {
			assert.ok(!source.includes('D814'));
		}
		assert.ok(!shared.includes('D814'));
		assert.ok(!auxBrowser.includes('D814'));
		assert.ok(!tunnelModel.includes('D814'));

		for (const source of [dataChannel, remoteAbs, dynamic, usage, mcpUsage]) {
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
	});
});
