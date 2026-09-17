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
const AUTH_REL = 'src/vs/workbench/services/authentication/common/authentication.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const PROVIDER_REL = 'src/vs/platform/defaultAccount/common/defaultAccount.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/accounts/browser/defaultAccount.ts';
const MANAGED_REL = 'src/vs/workbench/services/accounts/browser/managedSettings.ts';
const AGENT_HOST_SERVICE_REL = 'src/vs/workbench/services/agentHost/electron-browser/agentHostService.ts';
const AGENT_SDK_REL = 'src/vs/workbench/services/agentHost/browser/agentSdkSetupService.ts';
const CODEX_REL = 'src/vs/workbench/services/agentHost/browser/codexAccountService.ts';
const REMOTE_REL = 'src/vs/workbench/services/agentHost/browser/editorRemoteAgentHostServiceClient.ts';
const RESOURCE_REL = 'src/vs/workbench/services/agentHost/common/agentHostResourceService.ts';
const FS_REL = 'src/vs/workbench/services/agentHost/common/agentHostFileSystemService.ts';
const WEB_REL = 'src/vs/workbench/services/agentHost/browser/webAgentHostEnablementService.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const executeCommandCall = 'void this._commandService.executeCommand(CHAT_SETUP_COMMAND_ID)';
const refreshThenCall = `provider.refresh().then(account => {
			this.defaultAccount = account;
		}).finally(() => {
			this.initBarrier.open();
			this._register(provider.onDidChangeDefaultAccount(account => this.setDefaultAccount(account)));
			this._register(provider.onDidChangePolicyData(policyData => this._onDidChangePolicyData.fire(policyData)));
			this._register(provider.onDidChangeCopilotTokenInfo(tokenInfo => this._onDidChangeCopilotTokenInfo.fire(tokenInfo)));
		})`;
const schedulerCall = 'new RunOnceScheduler(() => this.refetchDefaultAccount()';
const sessionsUpdateCall = `this.logService.debug('[DefaultAccount] Sessions changed for default account provider, updating default account');
				this.updateDefaultAccount()`;
const preferenceUpdateCall = `this.logService.debug('[DefaultAccount] Account preference changed for default account provider, updating default account');
			this.updateDefaultAccount()`;
const registerUpdateCall = `this.logService.debug('[DefaultAccount] Default account provider registered, updating default account');
			this.updateDefaultAccount()`;
const unregisterUpdateCall = `this.logService.debug('[DefaultAccount] Default account provider unregistered, updating default account');
			this.updateDefaultAccount()`;
const focusRefetchCall = `if (focused) {
				this.refetchDefaultAccount()`;
const getSessionsCall = 'void this.authenticationService.getSessions(provider.id, undefined, {}, true)';
const forceRefreshCall = 'void this.updateDefaultAccount({ forceRefresh: true })';

const d774Calls: Array<[string, string, number]> = [
	[ACCOUNT_REL, refreshThenCall, 1],
	[ACCOUNT_REL, schedulerCall, 1],
	[ACCOUNT_REL, sessionsUpdateCall, 1],
	[ACCOUNT_REL, preferenceUpdateCall, 1],
	[ACCOUNT_REL, registerUpdateCall, 1],
	[ACCOUNT_REL, unregisterUpdateCall, 1],
	[ACCOUNT_REL, focusRefetchCall, 1],
	[ACCOUNT_REL, getSessionsCall, 1],
	[ACCOUNT_REL, forceRefreshCall, 1],
];

suite('agentHost leftover remaining overflowed to accounts leftover Promise fire-and-forget catch scan (D774)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('agentHost leftover remaining has fewer than four legal sites so this knife moved to accounts leftover', () => {
		const setup = fs.readFileSync(resolveSource(AGENT_SDK_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(AGENT_HOST_SERVICE_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const resource = fs.readFileSync(resolveSource(RESOURCE_REL), 'utf8');
		const codex = fs.readFileSync(resolveSource(CODEX_REL), 'utf8');
		const agentHostLegal = countIncludes(setup, executeCommandCall);
		assert.ok(agentHostLegal < 4, `expected agentHost legal leftover <4, got ${agentHostLegal}`);
		assert.strictEqual(agentHostLegal, 1);
		assert.ok(setup.includes(`${executeCommandCall};`));
		assert.ok(!setup.includes(`${executeCommandCall}.catch`));
		assert.ok(host.includes('void this.doUpdateAssignmentContext().catch(error => this.logService.error(\'Failed to forward Agent Host assignment context\', error));'));
		assert.ok(!host.includes(`void this.doUpdateAssignmentContext()${doubleCatch}`));
		assert.ok(remote.includes('this._connect().catch(err => this._logService.warn(`${LOG_PREFIX} Connect failed`, err));'));
		assert.ok(!remote.includes(`this._connect()${doubleCatch}`));
		assert.ok(resource.includes('void this._persistGrant(request.address, request.uri, request.lexicalUri, request.mode).catch(err => {'));
		assert.ok(!resource.includes(`void this._persistGrant(request.address, request.uri, request.lexicalUri, request.mode)${doubleCatch}`));
		assert.ok(codex.includes('void openCodexAuthUrl(this._openerService, account.authUrl).catch(onUnexpectedError);'));
		assert.ok(!codex.includes('void openCodexAuthUrl(this._openerService, account.authUrl).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(codex.includes('void readCodexProfileImageDataUri(this._agentHostService, reference).then(profileImageDataUri => {'));
		assert.ok(codex.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
	});

	test('this knife covers nine leftover Promise double-chain sites after agentHost leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d774Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 9);
		assert.ok(sites >= 4);
	});

	test('accounts leftover refresh then / getSessions / updateDefaultAccount / refetchDefaultAccount are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const auth = fs.readFileSync(resolveSource(AUTH_REL), 'utf8');
		const provider = fs.readFileSync(resolveSource(PROVIDER_REL), 'utf8');
		assertPromiseSignature(provider, 'refresh(options?: IDefaultAccountRefreshOptions): Promise<IDefaultAccount | null>;');
		assertPromiseSignature(source, 'private async updateDefaultAccount(options?: IDefaultAccountRefreshOptions): Promise<void> {');
		assertPromiseSignature(source, 'private async refetchDefaultAccount(): Promise<void> {');
		assertPromiseSignature(auth, 'getSessions(id: string, scopeListOrRequest?: ReadonlyArray<string> | IAuthenticationWwwAuthenticateRequest, options?: IAuthenticationGetSessionsOptions, activateImmediate?: boolean): Promise<ReadonlyArray<AuthenticationSession>>;');
		assert.ok(source.includes("import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, refreshThenCall);
		assertWrapped(source, schedulerCall);
		assertWrapped(source, sessionsUpdateCall);
		assertWrapped(source, preferenceUpdateCall);
		assertWrapped(source, registerUpdateCall);
		assertWrapped(source, unregisterUpdateCall);
		assertWrapped(source, focusRefetchCall);
		assertWrapped(source, getSessionsCall);
		assertWrapped(source, forceRefreshCall);
		assert.ok(source.includes('await this.updateDefaultAccount(options);'));
		assert.ok(!source.includes(`await this.updateDefaultAccount(options)${doubleCatch}`));
		assert.ok(source.includes('await this.updateDefaultAccount();'));
		assert.ok(!source.includes(`await this.updateDefaultAccount()${doubleCatch}`));
		assert.ok(!source.includes('void this.updateDefaultAccount({ forceRefresh: true });'));
		assert.ok(!source.includes('void this.authenticationService.getSessions(provider.id, undefined, {}, true);'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const managed = fs.readFileSync(resolveSource(MANAGED_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(AGENT_SDK_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(AGENT_HOST_SERVICE_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const resource = fs.readFileSync(resolveSource(RESOURCE_REL), 'utf8');
		const fsSource = fs.readFileSync(resolveSource(FS_REL), 'utf8');
		const web = fs.readFileSync(resolveSource(WEB_REL), 'utf8');
		const codex = fs.readFileSync(resolveSource(CODEX_REL), 'utf8');

		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(source.includes('this.extensionService.whenInstalledExtensionsRegistered().then(() => {'));
		assert.ok(source.includes('}, error => {'));
		assert.ok(!source.includes(`this.extensionService.whenInstalledExtensionsRegistered().then(() => {${doubleCatch}`));
		assert.ok(source.includes('this.initPromise = this.init()'));
		assert.ok(!source.includes(`this.initPromise = this.init()${doubleCatch}`));
		assert.ok(source.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(source.includes('await defaultAccountService.signIn();'));
		assert.ok(!source.includes(`await defaultAccountService.signIn()${doubleCatch}`));
		assert.ok(!source.includes(`async run(accessor: ServicesAccessor): Promise<void> {${doubleCatch}`));
		assert.ok(source.includes('resolveGitHubUrl(path: string): string {'));
		assert.ok(!source.includes(`resolveGitHubUrl(path)${doubleCatch}`));
		assert.ok(resource.includes('const realpath = this._fileService.realpath(lexical).then('));
		assert.ok(resource.includes('() => lexical,'));
		assert.ok(!resource.includes(`this._fileService.realpath(lexical).then(${doubleCatch}`));
		assert.ok(host.includes('this.agentHostService.startAgentHost();'));
		assert.ok(!host.includes(`this.agentHostService.startAgentHost()${doubleCatch}`));
		assert.ok(setup.includes('void this._openerService.open(url, { openExternal: true });'));
		assert.ok(!setup.includes(`void this._openerService.open(url, { openExternal: true })${doubleCatch}`));
		assert.ok(codex.includes('void openCodexAuthUrl(this._openerService, account.authUrl).catch(onUnexpectedError);'));
		assert.ok(!codex.includes(`void openCodexAuthUrl(this._openerService, account.authUrl)${doubleCatch}`));
		assert.ok(remote.includes('this._connect().catch(err => this._logService.warn(`${LOG_PREFIX} Connect failed`, err));'));
		assert.ok(!remote.includes(`this._connect()${doubleCatch}`));
		assert.ok(!managed.includes('.then('));
		assert.ok(!managed.includes(doubleCatch));
		assert.ok(!fsSource.includes(doubleCatch));
		assert.ok(!web.includes(doubleCatch));

		for (const file of [source, managed, setup, host, remote, resource, fsSource, web, codex]) {
			assert.ok(!file.includes('acknowledge('));
			assert.ok(!file.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(file));
		}
	});
});
