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
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const INDICATOR_REL = 'src/vs/workbench/contrib/remote/browser/remoteIndicator.ts';
const START_REL = 'src/vs/workbench/contrib/remote/browser/remoteStartEntry.ts';
const HEALTH_REL = 'src/vs/workbench/contrib/remote/browser/remoteConnectionHealth.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const REMOTE_REL = 'src/vs/workbench/contrib/remote/browser/remote.ts';
const TUNNEL_REL = 'src/vs/workbench/contrib/remote/browser/tunnelView.ts';
const ELECTRON_REL = 'src/vs/workbench/contrib/remote/electron-browser/remote.contribution.ts';
const COMMON_REL = 'src/vs/workbench/contrib/remote/common/remote.contribution.ts';
const BROWSER_CONTRIB_REL = 'src/vs/workbench/contrib/remote/browser/remote.contribution.ts';

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

const updateWhenCall = 'this.updateWhenInstalledExtensionsRegistered()';
const initializeMetadataCall = 'this.initializeRemoteMetadata()';
const startCommandCall = 'this.commandService.executeCommand(startCommand)';
const commandIdCall = 'this.commandService.executeCommand(commandId)';
const initCall = 'this._init()';
const startEntryCommandCall = 'this.commandService.executeCommand(this.startCommand)';
const healthCall = 'this._checkInitialRemoteConnectionHealth()';
const enableFeaturesCall = 'this.enableForwardedPortsFeatures()';
const restoreCall = 'this.restore()';
const initializeCall = 'this.initialize()';

const d784Calls: Array<[string, string, number]> = [
	[INDICATOR_REL, updateWhenCall, 1],
	[INDICATOR_REL, initializeMetadataCall, 1],
	[INDICATOR_REL, startCommandCall, 1],
	[INDICATOR_REL, commandIdCall, 1],
	[START_REL, initCall, 1],
	[START_REL, startEntryCommandCall, 1],
	[HEALTH_REL, healthCall, 1],
	[EXPLORER_REL, enableFeaturesCall, 2],
	[EXPLORER_REL, restoreCall, 1],
	[EXPLORER_REL, initializeCall, 1],
];

suite('remote leftover remaining Promise fire-and-forget catch scan (D784)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers eleven leftover Promise double-chain sites in remote only', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d784Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 11);
		assert.ok(sites >= 4);
	});

	test('remote leftover updateWhenInstalledExtensionsRegistered / initializeRemoteMetadata / executeCommand fire-and-forgets are Promise double-chain', () => {
		const indicator = fs.readFileSync(resolveSource(INDICATOR_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(indicator, 'private async updateWhenInstalledExtensionsRegistered(): Promise<void> {');
		assertPromiseSignature(indicator, 'private async initializeRemoteMetadata(): Promise<void> {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(indicator.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(indicator, updateWhenCall);
		assertWrapped(indicator, initializeMetadataCall);
		assertWrapped(indicator, startCommandCall);
		assertWrapped(indicator, commandIdCall);
		assert.ok(!indicator.includes('this.updateWhenInstalledExtensionsRegistered();'));
		assert.ok(!indicator.includes('this.initializeRemoteMetadata();'));
		assert.ok(!indicator.includes('this.commandService.executeCommand(startCommand);'));
		assert.ok(!indicator.includes('\t\t\t\t\tthis.commandService.executeCommand(commandId);'));
	});

	test('remote leftover _init / startCommand / _checkInitialRemoteConnectionHealth fire-and-forgets are Promise double-chain', () => {
		const start = fs.readFileSync(resolveSource(START_REL), 'utf8');
		const health = fs.readFileSync(resolveSource(HEALTH_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(start, 'private async _init(): Promise<void> {');
		assertPromiseSignature(health, 'private async _checkInitialRemoteConnectionHealth(): Promise<void> {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(start.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(health.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(start, initCall);
		assertWrapped(start, startEntryCommandCall);
		assertWrapped(health, healthCall);
		assert.ok(!start.includes('\t\tthis._init();\n'));
		assert.ok(!start.includes('this.commandService.executeCommand(this.startCommand);'));
		assert.ok(!health.includes('this._checkInitialRemoteConnectionHealth();'));
	});

	test('remote leftover enableForwardedPortsFeatures / restore / initialize fire-and-forgets are Promise double-chain', () => {
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		assertPromiseSignature(explorer, 'private async enableForwardedPortsFeatures() {');
		assertPromiseSignature(explorer, 'private async restore() {');
		assertPromiseSignature(explorer, 'private async initialize() {');
		assert.ok(explorer.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(explorer, enableFeaturesCall);
		assertWrapped(explorer, restoreCall);
		assertWrapped(explorer, initializeCall);
		assert.strictEqual(countIncludes(explorer, `${enableFeaturesCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(explorer, `${restoreCall}${doubleCatch}`), 1);
		assert.ok(explorer.includes('await this.restore();'));
		assert.ok(!explorer.includes(`await this.restore()${doubleCatch}`));
		assert.ok(!explorer.includes('\t\tthis.enableForwardedPortsFeatures();\n'));
		assert.ok(!explorer.includes('\t\tthis.initialize();\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const indicator = fs.readFileSync(resolveSource(INDICATOR_REL), 'utf8');
		const start = fs.readFileSync(resolveSource(START_REL), 'utf8');
		const health = fs.readFileSync(resolveSource(HEALTH_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_REL), 'utf8');
		const common = fs.readFileSync(resolveSource(COMMON_REL), 'utf8');
		const browserContrib = fs.readFileSync(resolveSource(BROWSER_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(host, 'openWindow(options?: IOpenEmptyWindowOptions): Promise<void>;');

		assert.ok(remote.includes('this.openerService.open(urlOrWalkthroughId, { allowCommands: true });'));
		assert.ok(!remote.includes('this.openerService.open(urlOrWalkthroughId, { allowCommands: true }).catch'));
		assert.ok(remote.includes('await this.openerService.open(URI.parse(url), { allowCommands: true });'));
		assert.ok(!remote.includes(`this.openerService.open(URI.parse(url), { allowCommands: true })${doubleCatch}`));
		assert.ok(tunnel.includes('return openerService.open(tunnel.localUri, { allowContributedOpeners: false });'));
		assert.ok(!tunnel.includes('return openerService.open(tunnel.localUri, { allowContributedOpeners: false }).catch'));
		assert.ok(health.includes("await this.openerService.open('https://aka.ms/vscode-remote/faq/old-linux');"));
		assert.ok(!health.includes(`openerService.open('https://aka.ms/vscode-remote/faq/old-linux')${doubleCatch}`));
		assert.ok(indicator.includes('await this.openerService.open(URI.parse(remoteExtension.helpLink));'));
		assert.ok(!indicator.includes(`this.openerService.open(URI.parse(remoteExtension.helpLink))${doubleCatch}`));

		assert.ok(remote.includes('return this.getUrl().then(() => this._description);'));
		assert.ok(!remote.includes(`return this.getUrl().then(() => this._description)${doubleCatch}`));
		assert.ok(remote.includes('const urlCommand = this.commandService.executeCommand<string>(this.urlOrCommandOrId).then((result) => {'));
		assert.ok(!remote.includes(`const urlCommand = this.commandService.executeCommand<string>(this.urlOrCommandOrId).then((result) => {${doubleCatch}`));

		assert.ok(electron.includes('remoteAuthorityResolverService.resolveAuthority(remoteAuthority).then(() => {'));
		assert.ok(!electron.includes(`remoteAuthorityResolverService.resolveAuthority(remoteAuthority).then(() => {${doubleCatch}`));
		assert.ok(electron.includes('commandService.executeCommand(\'workbench.view.explorer\');'));
		assert.ok(!electron.includes(`commandService.executeCommand('workbench.view.explorer')${doubleCatch}`));
		assert.ok(electron.includes('.then(info => {'));
		assert.ok(electron.includes('.catch(e => {'));
		assert.ok(!electron.includes('.then(undefined,'));

		assert.ok(indicator.includes('run = () => that.hostService.openWindow({ forceReuseWindow: true, remoteAuthority: null });'));
		assert.ok(!indicator.includes(`run = () => that.hostService.openWindow({ forceReuseWindow: true, remoteAuthority: null })${doubleCatch}`));
		assert.ok(health.includes('this.hostService.openWindow({ forceReuseWindow: true, remoteAuthority: null });'));
		assert.ok(!health.includes(`this.hostService.openWindow({ forceReuseWindow: true, remoteAuthority: null })${doubleCatch}`));

		assert.ok(start.includes('async run(): Promise<void> {'));
		assert.ok(!start.includes(`async run(): Promise<void> {${doubleCatch}`));
		assert.ok(browserContrib.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(!browserContrib.includes(doubleCatch));

		assert.ok(explorer.includes('await this.restore();'));
		assert.ok(!explorer.includes(`await this.restore()${doubleCatch}`));
		assert.ok(explorer.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(remote.includes(`remoteAgentService.getEnvironment().then(remoteEnv => {
			if (remoteEnv) {
				timerService.setPerformanceMarks('server', remoteEnv.marks);
			}
		})${doubleCatch};`));
		assert.ok(common.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));

		assert.ok(indicator.includes('this.updateRemoteStatusIndicator();'));
		assert.ok(!indicator.includes(`this.updateRemoteStatusIndicator()${doubleCatch}`));

		for (const source of [indicator, start, health, explorer, remote, tunnel, electron, common, browserContrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
