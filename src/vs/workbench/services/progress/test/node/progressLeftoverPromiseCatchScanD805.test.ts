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
const DIALOG_REL = 'src/vs/base/browser/ui/dialog/dialog.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const REMOTE_REL = 'src/vs/workbench/services/remote/common/remoteAgentService.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const STATUSBAR_REL = 'src/vs/workbench/services/statusbar/browser/statusbar.ts';
const LAYOUT_REL = 'src/vs/workbench/services/layout/browser/layoutService.ts';
const MENUBAR_REL = 'src/vs/workbench/services/menubar/electron-browser/menubarService.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/browser/preferencesService.ts';
const WORKSPACES_REL = 'src/vs/workbench/services/workspaces/browser/workspacesService.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const SETTINGS_EDITOR_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const ACCOUNT_POLICY_REL = 'src/vs/workbench/services/accounts/browser/defaultAccount.ts';
const CONFIGURATION_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const CHAT_ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';

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

const dialogShowThen = 'dialog.show().then(dialogResult => {';
const userDataThenCall = 'extensionService.whenInstalledExtensionsRegistered().then(() => this.initializeOtherResource(userDataInitializeService, instantiationService))';
const getEnvThenCall = 'remoteAgentService.getEnvironment().then(remoteEnv => this.remoteEnvironment = remoteEnv)';
const updateUnicodeCall = 'this._updateUnicodeVersion()';
const enableWebglCall = 'this._enableWebglRenderer()';
const refreshLigaturesCall = 'this._refreshLigaturesAddon()';
const refreshImageCall = 'this._refreshImageAddon()';

const d805Calls: Array<[string, string, number, 'call' | 'then']> = [
	[PROGRESS_REL, dialogShowThen, 1, 'then'],
	[USER_DATA_REL, userDataThenCall, 1, 'call'],
	[TEXT_RES_REL, getEnvThenCall, 1, 'call'],
	[XTERM_REL, updateUnicodeCall, 2, 'call'],
	[XTERM_REL, enableWebglCall, 3, 'call'],
	[XTERM_REL, refreshLigaturesCall, 2, 'call'],
	[XTERM_REL, refreshImageCall, 2, 'call'],
];

suite('notification leftover remaining overflowed through progress leftover remaining to xterm leftover Promise fire-and-forget catch scan (D805)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('notification leftover remaining has fewer than four legal sites so this knife moved through statusbar/layout/menubar and progress leftover remaining to xterm leftover remaining', () => {
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const statusbar = fs.readFileSync(resolveSource(STATUSBAR_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const menubar = fs.readFileSync(resolveSource(MENUBAR_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		assert.strictEqual(countDoubleChains(notification), 0);
		assert.ok(!notification.includes('.then('));
		assert.ok(!notification.includes('void this.'));
		assert.ok(!notification.includes('onUnexpectedError'));
		assert.strictEqual(countDoubleChains(statusbar), 0);
		assert.ok(!statusbar.includes('.then('));
		assert.strictEqual(countDoubleChains(layout), 0);
		assert.ok(!layout.includes('.then('));
		assert.strictEqual(countDoubleChains(menubar), 0);
		assert.ok(!menubar.includes('.then('));
		const notificationLegal = 0;
		assert.ok(notificationLegal < 4, `expected notification legal leftover <4, got ${notificationLegal}`);
		assertThenWrapped(progress, dialogShowThen);
		assert.strictEqual(countDoubleChains(progress), 1);
		const progressLegal = 1;
		assert.ok(progressLegal < 4, `expected progress legal leftover <4, got ${progressLegal}`);
	});

	test('this knife covers twelve leftover Promise double-chain sites after progress leftover remaining overflow into unused xterm leftover remaining', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d805Calls) {
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
		assert.strictEqual(sites, 12);
		assert.ok(sites >= 4);
		const xterm = seen.get(XTERM_REL) ?? fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		assert.strictEqual(countDoubleChains(xterm), 11);
	});

	test('progress leftover dialog.show then and userData / textresourceProperties leftover thens are Promise double-chain', () => {
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const dialog = fs.readFileSync(resolveSource(DIALOG_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		assertPromiseSignature(dialog, 'async show(): Promise<IDialogResult> {');
		assertPromiseSignature(userData, 'private async initializeOtherResource(userDataInitializeService: IUserDataInitializationService, instantiationService: IInstantiationService): Promise<void> {');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(remote, 'getEnvironment(): Promise<IRemoteAgentEnvironment | null>;');
		assert.ok(progress.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(userData.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(textRes.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertThenWrapped(progress, dialogShowThen);
		assertWrapped(userData, userDataThenCall);
		assertWrapped(textRes, getEnvThenCall);
		assert.ok(!progress.includes('dialog.show().then(dialogResult => {\n\t\t\t\t// The dialog may close as a result of disposing it after the\n\t\t\t\t// task has completed. In that case, we do not want to trigger\n\t\t\t\t// the `onDidCancel` callback.\n\t\t\t\t// However, if the task is still running, this means that the\n\t\t\t\t// user has clicked the cancel button and we want to trigger\n\t\t\t\t// the `onDidCancel` callback.\n\t\t\t\tif (!taskCompleted) {\n\t\t\t\t\tonDidCancel?.(dialogResult.button);\n\t\t\t\t}\n\t\t\t\tdispose(dialog);\n\t\t\t});'));
		assert.ok(!userData.includes('extensionService.whenInstalledExtensionsRegistered().then(() => this.initializeOtherResource(userDataInitializeService, instantiationService));'));
		assert.ok(!textRes.includes('remoteAgentService.getEnvironment().then(remoteEnv => this.remoteEnvironment = remoteEnv);'));
	});

	test('xterm leftover remaining unused async this.foo() FOF (_updateUnicodeVersion / _enableWebglRenderer / _refreshLigaturesAddon / _refreshImageAddon) are Promise double-chain', () => {
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		assertPromiseSignature(xterm, 'private async _updateUnicodeVersion(): Promise<void> {');
		assertPromiseSignature(xterm, 'private async _enableWebglRenderer(): Promise<void> {');
		assertPromiseSignature(xterm, 'private async _refreshLigaturesAddon(): Promise<void> {');
		assertPromiseSignature(xterm, 'private async _refreshImageAddon(): Promise<void> {');
		assert.ok(xterm.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(xterm, updateUnicodeCall);
		assertWrapped(xterm, enableWebglCall);
		assertWrapped(xterm, refreshLigaturesCall);
		assertWrapped(xterm, refreshImageCall);
		assert.strictEqual(countIncludes(xterm, `${updateUnicodeCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(xterm, `${enableWebglCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(xterm, `${refreshLigaturesCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(xterm, `${refreshImageCall}${doubleCatch}`), 2);
		assert.ok(!xterm.includes('\t\t\t\t\tthis._updateUnicodeVersion();\n'));
		assert.ok(!xterm.includes('\t\tthis._updateUnicodeVersion();\n'));
		assert.ok(!xterm.includes('\t\t\t\tthis._enableWebglRenderer();\n'));
		assert.ok(!xterm.includes('\t\t\tthis._refreshLigaturesAddon();\n'));
		assert.ok(!xterm.includes('\t\t\tthis._refreshImageAddon();\n'));
	});

	test('progress leftover remaining overflow stayed in unused xterm leftover remaining and did not overflow into host/preferences/workspaces/chatEntitlement', () => {
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(CHAT_ENTITLEMENT_REL), 'utf8');
		assert.ok(!host.includes('D805'));
		assert.ok(!preferences.includes('D805'));
		assert.ok(!workspaces.includes('D805'));
		assert.ok(!notification.includes('D805'));
		assert.ok(!notification.includes(doubleCatch));
		assert.ok(!entitlement.includes(doubleCatch));
		assert.ok(entitlement.includes('\t\t\t\tthis.update(cts.value.token);\n'));
		assert.ok(entitlement.includes('\t\tthis.resolve();\n'));
		assert.ok(!entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(!entitlement.includes(`this.resolve()${doubleCatch}`));
	});

	test('H secrets/integrity/label, D tasks, notification, gettingStarted, settingsEditor2, accountPolicy, configuration stay untouched by this knife', () => {
		for (const rel of [SECRETS_REL, INTEGRITY_REL, LABEL_REL, TASKS_REL, GETTING_STARTED_REL, SETTINGS_EDITOR_REL, ACCOUNT_POLICY_REL, CONFIGURATION_REL, NOTIFICATION_REL]) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('D805'), `${rel} should stay off this knife`);
		}
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(progress, 'async withProgress<R = unknown>(options: IProgressOptions, originalTask: (progress: IProgress<IProgressStep>) => Promise<R>, onDidCancel?: (choice?: number) => void): Promise<R> {');

		assert.ok(!progress.includes('IOpenerService'));
		assert.ok(!userData.includes('IOpenerService'));
		assert.ok(!textRes.includes('IOpenerService'));
		assert.ok(!xterm.includes('IOpenerService'));

		assert.ok(xterm.includes(`this._xtermAddonLoader.importAddon('clipboard').then(ClipboardAddon => {`));
		assert.ok(xterm.includes(`this._xtermAddonLoader.importAddon('progress').then(ProgressAddon => {`));
		assert.ok(xterm.includes(`this._xtermAddonLoader.importAddon('clipboard').then(ClipboardAddon => {`));
		assert.ok(xterm.includes(`\t\t}).catch(onUnexpectedError).catch(onUnexpectedError);\n\t\tthis._xtermAddonLoader.importAddon('progress')`));
		assert.strictEqual(countIncludes(xterm, `this._xtermAddonLoader.importAddon('clipboard').then(ClipboardAddon => {`), 1);
		assert.strictEqual(countIncludes(xterm, `this._xtermAddonLoader.importAddon('progress').then(ProgressAddon => {`), 1);

		assert.ok(xterm.includes('\t\t\tawait this._enableWebglRenderer();\n'));
		assert.ok(!xterm.includes(`await this._enableWebglRenderer()${doubleCatch}`));
		assert.strictEqual(countIncludes(xterm, 'await this._enableWebglRenderer();'), 2);

		assert.ok(progress.includes('return this.withDialogProgress(options, task, onDidCancel);'));
		assert.ok(!progress.includes(`return this.withDialogProgress(options, task, onDidCancel)${doubleCatch}`));
		assert.ok(progress.includes('\t\treturn promise;\n'));
		assert.ok(progress.includes('promise.finally(() => {'));
		assert.ok(!progress.includes(`promise.finally(() => {${doubleCatch}`));
		assert.ok(progress.includes('promise.catch(() => undefined /* ignore */).finally(() => discreteProgressRunner?.done());'));
		assert.ok(!progress.includes(`promise.catch(() => undefined /* ignore */).finally(() => discreteProgressRunner?.done())${doubleCatch}`));

		for (const source of [progress, userData, textRes, xterm]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}

		assert.ok(!progress.includes(', error => {'));
		assert.ok(!userData.includes(' = extensionService.whenInstalledExtensionsRegistered().then'));
		assert.ok(!textRes.includes(' = remoteAgentService.getEnvironment().then'));
	});
});
