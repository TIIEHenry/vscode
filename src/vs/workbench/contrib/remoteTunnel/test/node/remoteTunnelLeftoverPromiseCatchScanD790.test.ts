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
const CLIPBOARD_REL = 'src/vs/platform/clipboard/common/clipboardService.ts';
const TUNNEL_REL = 'src/vs/platform/remoteTunnel/common/remoteTunnel.ts';
const OUTPUT_REL = 'src/vs/workbench/services/output/common/output.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/remoteTunnel/electron-browser/remoteTunnel.contribution.ts';
const SPEECH_REL = 'src/vs/workbench/contrib/speech/browser/speechService.ts';
const SPEECH_SIGNAL_REL = 'src/vs/workbench/contrib/speech/browser/speechAccessibilitySignal.ts';

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

function assertThenWrapped(source: string, thenStart: string): void {
	const idx = source.indexOf(thenStart);
	assert.ok(idx >= 0, `missing then: ${thenStart}`);
	const rest = source.slice(idx + thenStart.length);
	const closeThen = rest.search(/\}\)/);
	assert.ok(closeThen >= 0, `missing then close after: ${thenStart}`);
	const afterClose = rest.slice(closeThen + 2);
	assert.ok(afterClose.startsWith(doubleCatch), `then not double-chained: ${thenStart}`);
	assert.ok(!afterClose.startsWith('.catch(onUnexpectedError);') || afterClose.startsWith(doubleCatch));
	assert.ok(!source.includes(`${thenStart};`));
}

const initializeCall = 'this.initialize()';
const recommendCall = 'this.recommendRemoteExtensionIfNeeded()';
const discoveryCall = 'doInitialStateDiscovery(undefined)';
const startTunnelThen = 'this.remoteTunnelService.startTunnel({ active: true, asService, session: account }).then(status => {';
const executeCommandCall = 'this.commandService.executeCommand(quickPick.selectedItems[0].id)';

const d790Calls: Array<[string, string, number, 'call' | 'then']> = [
	[CONTRIB_REL, initializeCall, 1, 'call'],
	[CONTRIB_REL, recommendCall, 1, 'call'],
	[CONTRIB_REL, discoveryCall, 1, 'call'],
	[CONTRIB_REL, startTunnelThen, 1, 'then'],
	[CONTRIB_REL, executeCommandCall, 1, 'call'],
];

suite('remoteTunnel leftover Promise fire-and-forget catch scan (D790)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers five leftover Promise double-chain sites in remoteTunnel only', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d790Calls) {
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
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		const contrib = seen.get(CONTRIB_REL) ?? fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		assert.strictEqual(countIncludes(contrib, doubleCatch), 5);
	});

	test('remoteTunnel leftover initialize / recommendRemoteExtensionIfNeeded / doInitialStateDiscovery fire-and-forgets are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		assertPromiseSignature(source, 'private async initialize(): Promise<void> {');
		assertPromiseSignature(source, 'private async recommendRemoteExtensionIfNeeded() {');
		assertPromiseSignature(source, 'const doInitialStateDiscovery = async (progress?: IProgress<IProgressStep>) => {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, initializeCall);
		assertWrapped(source, recommendCall);
		assertWrapped(source, discoveryCall);
		assert.ok(!source.includes('\t\tthis.initialize();\n'));
		assert.ok(!source.includes('\t\tthis.recommendRemoteExtensionIfNeeded();\n'));
		assert.ok(!source.includes('\t\t\tdoInitialStateDiscovery(undefined);\n'));
		assert.ok(source.includes('await this.progressService.withProgress('));
		assert.ok(!source.includes(`await this.progressService.withProgress(${doubleCatch}`));
	});

	test('remoteTunnel leftover startTunnel then and manage executeCommand fire-and-forgets are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(tunnel, 'startTunnel(mode: ActiveTunnelMode): Promise<TunnelStatus>;');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assertThenWrapped(source, startTunnelThen);
		assertWrapped(source, executeCommandCall);
		assert.ok(/startTunnel\(\{ active: true, asService, session: account \}\)\.then\(status => \{[\s\S]*?\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/.test(source));
		assert.ok(!source.includes('this.commandService.executeCommand(quickPick.selectedItems[0].id);'));
	});

	test('speech leftover remaining stays unwrapped because remoteTunnel already has five legal sites', () => {
		const speech = fs.readFileSync(resolveSource(SPEECH_REL), 'utf8');
		const signal = fs.readFileSync(resolveSource(SPEECH_SIGNAL_REL), 'utf8');
		assert.ok(!speech.includes(doubleCatch));
		assert.ok(speech.includes('activeRecognizeKeywordSession = this.doRecognizeKeyword(cts.token).then(status => {'));
		assert.ok(speech.includes(', error => {'));
		assert.ok(!signal.includes(doubleCatch));
		assert.ok(signal.includes('this._accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStarted)'));
		assert.ok(signal.includes('this._accessibilitySignalService.playSignal(AccessibilitySignal.voiceRecordingStopped)'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(tunnel, 'stopTunnel(): Promise<void>;');
		assertPromiseSignature(output, 'showChannel(id: string, preserveFocus?: boolean): Promise<void>;');
		assertPromiseSignature(preferences, 'openSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(clipboard, 'writeText(text: string, type?: string): Promise<void>;');
		assertPromiseSignature(source, 'private async showManageOptions() {');

		assert.ok(source.includes("await openerService.open('https://aka.ms/vscode-server-doc');"));
		assert.ok(!source.includes(`openerService.open('https://aka.ms/vscode-server-doc')${doubleCatch}`));

		assert.ok(source.includes('that.remoteTunnelService.stopTunnel();'));
		assert.ok(!source.includes(`that.remoteTunnelService.stopTunnel()${doubleCatch}`));
		assert.ok(source.includes('outputService.showChannel(LOG_ID);'));
		assert.ok(!source.includes(`outputService.showChannel(LOG_ID)${doubleCatch}`));
		assert.ok(source.includes('preferencesService.openSettings({ query: CONFIGURATION_KEY_PREFIX });'));
		assert.ok(!source.includes(`preferencesService.openSettings({ query: CONFIGURATION_KEY_PREFIX })${doubleCatch}`));
		assert.ok(source.includes('clipboardService.writeText(linkToOpen.toString(true));'));
		assert.ok(!source.includes(`clipboardService.writeText(linkToOpen.toString(true))${doubleCatch}`));
		assert.ok(source.includes('that.showManageOptions();'));
		assert.ok(!source.includes(`that.showManageOptions()${doubleCatch}`));

		assert.ok(source.includes("return this.commandService.executeCommand('workbench.extensions.action.showExtensionsWithIds', [remoteExtension.extensionId]);"));
		assert.ok(!source.includes(`return this.commandService.executeCommand('workbench.extensions.action.showExtensionsWithIds', [remoteExtension.extensionId])${doubleCatch}`));
		assert.ok(source.includes("return commandService.executeCommand('workbench.extensions.action.showExtensionsWithIds', [remoteExtension.extensionId]);"));
		assert.ok(!source.includes(`return commandService.executeCommand('workbench.extensions.action.showExtensionsWithIds', [remoteExtension.extensionId])${doubleCatch}`));
		assert.ok(source.includes('run: () => clipboardService.writeText(linkToOpen.toString(true))'));
		assert.ok(!source.includes(`run: () => clipboardService.writeText(linkToOpen.toString(true))${doubleCatch}`));
		assert.ok(source.includes('await commandService.executeCommand(RemoteTunnelCommandIds.showLog);'));
		assert.ok(!source.includes(`commandService.executeCommand(RemoteTunnelCommandIds.showLog)${doubleCatch}`));

		assert.ok(source.includes('async run(accessor: ServicesAccessor) {'));
		assert.ok(source.includes('async run() {'));
		assert.ok(!source.includes(`async run(accessor: ServicesAccessor) {${doubleCatch}`));
		assert.ok(!source.includes(`async run() {${doubleCatch}`));

		assert.ok(source.includes('this.registerCommands();'));
		assert.ok(!source.includes(`this.registerCommands()${doubleCatch}`));
		assert.ok(source.includes('this.handleTunnelStatusUpdate(status);'));
		assert.ok(!source.includes(`this.handleTunnelStatusUpdate(status)${doubleCatch}`));

		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
	});
});
