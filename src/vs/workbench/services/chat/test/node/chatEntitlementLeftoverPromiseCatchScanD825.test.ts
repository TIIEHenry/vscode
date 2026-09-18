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
const CHAT_ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const NOTEBOOK_WIDGET_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const SETTINGS_EDITOR_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const ACCOUNT_POLICY_REL = 'src/vs/workbench/services/accounts/browser/defaultAccount.ts';
const CONFIGURATION_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';

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

const updateTokenCall = 'this.update(cts.value.token)';
const completedUpdateCall = 'this.context?.value.update({ completed: true })?';
const resolveCall = 'this.resolve()';
const contextEntitlementUpdateCall = 'this.context.update({ entitlement: this.state.entitlement, organisations: this.state.organisations, isStaff: this.state.isStaff, sku: this.state.sku, copilotTrackingId: this.state.copilotTrackingId })';
const configUpdateContextCall = 'if (e.affectsConfiguration(ChatAIDisabledSettingId)) {\n\t\t\t\tthis.updateContext()';
const forceHiddenUpdateContextCall = 'this._forceHidden = hidden;\n\t\t\tthis.updateContext()';

const d825Calls: Array<[string, string, number]> = [
	[CHAT_ENTITLEMENT_REL, updateTokenCall, 1],
	[CHAT_ENTITLEMENT_REL, completedUpdateCall, 1],
	[CHAT_ENTITLEMENT_REL, resolveCall, 2],
	[CHAT_ENTITLEMENT_REL, contextEntitlementUpdateCall, 1],
	[CHAT_ENTITLEMENT_REL, configUpdateContextCall, 1],
	[CHAT_ENTITLEMENT_REL, forceHiddenUpdateContextCall, 1],
];

suite('chatEntitlement leftover remaining unused leftover Promise fire-and-forget catch scan (D825)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('chatEntitlement leftover remaining unused still had four-plus legal unused sites so this knife did not move module', () => {
		const entitlement = fs.readFileSync(resolveSource(CHAT_ENTITLEMENT_REL), 'utf8');
		assert.strictEqual(countDoubleChains(entitlement), 7);
		const chatEntitlementLegal = 7;
		assert.ok(chatEntitlementLegal >= 4, `expected chatEntitlement legal leftover ≥4, got ${chatEntitlementLegal}`);
		assert.ok(!entitlement.includes('D825'));
	});

	test('this knife covers seven leftover Promise double-chain sites in chatEntitlement leftover remaining unused', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d825Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 7);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(CHAT_ENTITLEMENT_REL) ?? ''), 7);
	});

	test('chatEntitlement leftover remaining unused async this.foo() FOF (update/resolve) are Promise double-chain', () => {
		const entitlement = fs.readFileSync(resolveSource(CHAT_ENTITLEMENT_REL), 'utf8');
		assertPromiseSignature(entitlement, 'async update(token: CancellationToken): Promise<void> {');
		assertPromiseSignature(entitlement, 'private async resolve(): Promise<void> {');
		assertPromiseSignature(entitlement, 'async update(context: { completed?: boolean; installed?: boolean; disabled?: boolean; untrusted?: boolean; disabledInWorkspace?: boolean; hidden?: false; later?: boolean; entitlement?: ChatEntitlement; organisations?: string[]; isStaff?: boolean; sku?: string; copilotTrackingId?: string }): Promise<void> {');
		assertPromiseSignature(entitlement, 'private async updateContext(): Promise<void> {');
		assert.ok(entitlement.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(entitlement, updateTokenCall);
		assertWrapped(entitlement, completedUpdateCall);
		assertWrapped(entitlement, resolveCall);
		assertWrapped(entitlement, contextEntitlementUpdateCall);
		assertWrapped(entitlement, configUpdateContextCall);
		assertWrapped(entitlement, forceHiddenUpdateContextCall);
		assert.strictEqual(countIncludes(entitlement, `${resolveCall}${doubleCatch}`), 2);
		assert.ok(!entitlement.includes('\t\t\t\tthis.update(cts.value.token);\n'));
		assert.ok(!entitlement.includes('\t\tthis.resolve();\n'));
		assert.ok(!entitlement.includes('() => this.resolve())'));
		assert.ok(!entitlement.includes('\t\tthis.context?.value.update({ completed: true });\n'));
		assert.ok(!entitlement.includes('if (e.affectsConfiguration(ChatAIDisabledSettingId)) {\n\t\t\t\tthis.updateContext();\n'));
		assert.ok(!entitlement.includes('this._forceHidden = hidden;\n\t\t\tthis.updateContext();\n'));
	});

	test('D805 progress/userData/textresource/xterm sites stay untouched by this knife', () => {
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		assert.ok(!progress.includes('D825'));
		assert.ok(!userData.includes('D825'));
		assert.ok(!textRes.includes('D825'));
		assert.ok(!xterm.includes('D825'));
		assert.ok(progress.includes('dialog.show().then(dialogResult => {'));
		assert.ok(userData.includes('extensionService.whenInstalledExtensionsRegistered().then(() => this.initializeOtherResource(userDataInitializeService, instantiationService))'));
		assert.ok(textRes.includes('remoteAgentService.getEnvironment().then(remoteEnv => this.remoteEnvironment = remoteEnv)'));
		assert.ok(xterm.includes(`this._updateUnicodeVersion()${doubleCatch}`));
		assert.ok(xterm.includes(`this._enableWebglRenderer()${doubleCatch}`));
		assert.ok(xterm.includes(`this._refreshLigaturesAddon()${doubleCatch}`));
		assert.ok(xterm.includes(`this._refreshImageAddon()${doubleCatch}`));
	});

	test('H notebook/secrets/integrity/label, I settingsEditor2, F extensionsWorkbench, D tasks, J accountPolicy/configuration, A welcomeGettingStarted stay untouched by this knife', () => {
		for (const rel of [NOTEBOOK_WIDGET_REL, SECRETS_REL, INTEGRITY_REL, LABEL_REL, SETTINGS_EDITOR_REL, WORKBENCH_SVC_REL, TASKS_REL, ACCOUNT_POLICY_REL, CONFIGURATION_REL, GETTING_STARTED_REL]) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('D825'), `${rel} should stay off this knife`);
		}
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const entitlement = fs.readFileSync(resolveSource(CHAT_ENTITLEMENT_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(entitlement, 'private async resolve(): Promise<void> {');

		assert.ok(entitlement.includes('run: () => this.openerService.open(URI.parse(defaultChatAgent.upgradePlanUrl))'));
		assert.ok(!entitlement.includes(`this.openerService.open(URI.parse(defaultChatAgent.upgradePlanUrl))${doubleCatch}`));

		assert.ok(!entitlement.includes('extends Action2'));
		assert.ok(entitlement.includes('return this.updateContext();'));
		assert.ok(!entitlement.includes(`return this.updateContext()${doubleCatch}`));
		assert.ok(entitlement.includes('\t\tthis.update(state);\n'));
		assert.ok(!entitlement.includes(`this.update(state)${doubleCatch}`));
		assert.ok(entitlement.includes('\t\t\tthis.update(entitlements);\n'));
		assert.ok(!entitlement.includes(`this.update(entitlements)${doubleCatch}`));
		assert.ok(entitlement.includes('\t\tthis.update({ entitlement: ChatEntitlement.Free });\n'));
		assert.ok(!entitlement.includes(`this.update({ entitlement: ChatEntitlement.Free })${doubleCatch}`));
		assert.ok(entitlement.includes('return this.resolveEntitlement(defaultAccount, token);'));
		assert.ok(!entitlement.includes(`return this.resolveEntitlement(defaultAccount, token)${doubleCatch}`));
		assert.ok(entitlement.includes('await this.resolveEntitlement(defaultAccount, cts.token);'));
		assert.ok(!entitlement.includes(`await this.resolveEntitlement(defaultAccount, cts.token)${doubleCatch}`));

		assert.ok(!entitlement.includes(' = this.resolve()'));
		assert.ok(!entitlement.includes('.then('));
		assert.ok(!entitlement.includes(', error => {'));
		assert.ok(!entitlement.includes(`${doubleCatch}.catch(onUnexpectedError)`));

		assert.ok(!entitlement.includes('acknowledge('));
		assert.ok(!entitlement.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(entitlement));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(entitlement));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(entitlement));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(entitlement));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(entitlement));
		assert.ok(!entitlement.includes('SaveSkillContent'));
		assert.ok(!entitlement.includes('D825'));
	});
});
