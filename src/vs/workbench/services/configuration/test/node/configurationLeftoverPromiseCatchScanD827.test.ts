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
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const SERVICE_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const NOTEBOOK_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const POLICY_REL = 'src/vs/workbench/contrib/policyExport/electron-browser/policyExport.contribution.ts';
const EMERGENCY_REL = 'src/vs/workbench/contrib/emergencyAlert/electron-browser/emergencyAlert.contribution.ts';
const ENCRYPTION_REL = 'src/vs/workbench/contrib/encryption/electron-browser/encryption.contribution.ts';
const IGNORED_REL = 'src/vs/workbench/services/extensionRecommendations/common/extensionIgnoredRecommendationsService.ts';
const UPDATE_REL = 'src/vs/workbench/services/update/browser/updateService.ts';
const REMOTE_PROFILE_REL = 'src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';

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

const updateCacheCall = 'this.updateCache()';
const updateCachedDefaultsCall = 'this.updateCachedConfigurationDefaultsOverrides()';
const waitAndInitializeCall = 'this.waitAndInitialize(this._workspaceIdentifier)';
const updatePolicyCall = 'this._updatePolicyDefinitions(this.policyDefinitions)';
const updateImplicitCall = 'this.updateImplicitContext()';
const affectedKeysCall = 'this.onConfigUpdate(e.affectedKeys)';
const autoUpdateCall = 'this.autoUpdateBuiltinExtensions()';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const applicationSchedulerThen = `this.loadConfiguration().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel))`;
const userSchedulerThen = `this.userConfiguration.value!.loadConfiguration().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel))`;
const remoteReloadSchedulerThen = `this.reload().then(configurationModel => this._onDidChangeConfiguration.fire(configurationModel))`;
const workspaceChangedThen = `this.onWorkspaceConfigurationChanged(fromCache).then(() => {
				this.workspace.initialized = this.workspaceConfiguration.initialized;
				this.checkAndMarkWorkspaceComplete(fromCache);
			})`;
const onDidWorkspaceChangeCall = 'this.onDidWorkspaceConfigurationChange(false, true)';
const onDidWorkspaceListenerCall = 'this.onDidWorkspaceConfigurationChange(true, false)';

const d827Calls: Array<[string, string, number]> = [
	[CONFIG_REL, updateCachedDefaultsCall, 2],
	[CONFIG_REL, updateCacheCall, 4],
	[CONFIG_REL, waitAndInitializeCall, 1],
];

suite('leftover remaining unused after D821 moved to configuration leftover remaining Promise fire-and-forget catch scan (D827)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D821 had fewer than four legal unused leftover sites so this knife moved', () => {
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const emergency = fs.readFileSync(resolveSource(EMERGENCY_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));
		assert.ok(settings.includes(`${affectedKeysCall}${doubleCatch}`));
		assert.ok(policy.includes(doubleCatch));
		assert.ok(emergency.includes(`this.fetchAlerts(emergencyAlertUrl)${doubleCatch}`));
		assert.ok(implicit.includes('\t\t\tthis.updateImplicitContext();\n') || implicit.includes('\t\tthis.updateImplicitContext();\n'));
		assert.ok(!implicit.includes(`${updateImplicitCall}${doubleCatch}`));
		assert.ok(account.includes(`${updatePolicyCall}${doubleCatch}`));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused after D821 legal leftover <4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!folding.includes('D827'));
		assert.ok(!inlayHints.includes('D827'));
		assert.ok(!languageStatus.includes('D827'));
		assert.ok(!settings.includes('D827'));
	});

	test('this knife covers seven leftover Promise double-chain sites after leftover remaining unused after D821 moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d827Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(CONFIG_REL) ?? ''), 12);
	});

	test('configuration leftover remaining updateCache / updateCachedConfigurationDefaultsOverrides / waitAndInitialize leftover void promises are Promise/async + double-chain', () => {
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(configuration, 'private async updateCachedConfigurationDefaultsOverrides(): Promise<void> {');
		assertPromiseSignature(configuration, 'private async updateCache(): Promise<void> {');
		assertPromiseSignature(configuration, 'private async waitAndInitialize(workspaceIdentifier: IWorkspaceIdentifier): Promise<void> {');
		assert.ok(configuration.includes("import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(configuration, updateCachedDefaultsCall);
		assertWrapped(configuration, updateCacheCall);
		assertWrapped(configuration, waitAndInitializeCall);
		assert.strictEqual(countIncludes(configuration, `${updateCachedDefaultsCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(configuration, `${updateCacheCall}${doubleCatch}`), 4);
		assert.strictEqual(countIncludes(configuration, `${waitAndInitializeCall}${doubleCatch}`), 1);
		assert.ok(!configuration.includes('\t\tthis.updateCachedConfigurationDefaultsOverrides();\n'));
		assert.ok(!configuration.includes('\t\t\tthis.updateCachedConfigurationDefaultsOverrides();\n'));
		assert.ok(!configuration.includes('\t\tthis.updateCache();\n'));
		assert.ok(!configuration.includes('\t\t\t\tthis.waitAndInitialize(this._workspaceIdentifier);\n'));
		assert.ok(configuration.includes(`${onDidWorkspaceChangeCall};\n`));
		assert.ok(!configuration.includes(`${onDidWorkspaceChangeCall}${doubleCatch}`));
		assert.ok(configuration.includes(`${onDidWorkspaceListenerCall}`));
		assert.ok(!configuration.includes(`${onDidWorkspaceListenerCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(configuration, 'private async updateCache(): Promise<void> {');

		assert.ok(!configuration.includes('openerService.open'));
		assert.ok(!configuration.includes('IOpenerService'));
		assert.ok(!configuration.includes('extends Action2'));
		assert.ok(!configuration.includes('registerAction2'));
		assert.ok(!configuration.includes('.then(undefined,'));
		assert.ok(configuration.includes('return jsonEditingService.write(this._workspaceIdentifier.configPath, [{ path: [\'folders\'], value: folders }], true)\n\t\t\t\t.then(() => this.reload());'));
		assert.ok(!configuration.includes('then(() => this.reload()).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.workspaceConfiguration.reload().then(() => this.onWorkspaceConfigurationChanged(false));'));
		assert.ok(!service.includes('reload().then(() => this.onWorkspaceConfigurationChanged(false)).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.reloadRemoteUserConfiguration().then(() => undefined);'));
		assert.ok(!service.includes('reloadRemoteUserConfiguration().then(() => undefined).catch(onUnexpectedError)'));
		assert.ok(configuration.includes(`${applicationSchedulerThen}${doubleCatch}`));
		assert.ok(configuration.includes(`${userSchedulerThen}${doubleCatch}`));
		assert.ok(configuration.includes(`${remoteReloadSchedulerThen}${doubleCatch}`));
		assert.ok(service.includes(`${workspaceChangedThen}${doubleCatch}`));
		assert.ok(!configuration.includes(`${doubleCatch}.catch(onUnexpectedError)`));

		for (const source of [configuration, service]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes('D827'));
		}
	});

	test('D821 accountPolicy already-double stays already-double; owned leftover modules stay untouched; leftover remaining unused leftover stays leftover remaining unused', () => {
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const emergency = fs.readFileSync(resolveSource(EMERGENCY_REL), 'utf8');
		const encryption = fs.readFileSync(resolveSource(ENCRYPTION_REL), 'utf8');
		const ignored = fs.readFileSync(resolveSource(IGNORED_REL), 'utf8');
		const update = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const remoteProfile = fs.readFileSync(resolveSource(REMOTE_PROFILE_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');

		assert.strictEqual(countIncludes(account, `${updatePolicyCall}${doubleCatch}`), 8);
		assert.ok(!account.includes('\t\tthis._updatePolicyDefinitions(this.policyDefinitions);\n'));
		assert.ok(implicit.includes('\t\t\tthis.updateImplicitContext();\n') || implicit.includes('\t\tthis.updateImplicitContext();\n'));
		assert.ok(!implicit.includes(`${updateImplicitCall}${doubleCatch}`));
		assert.ok(settings.includes(`${affectedKeysCall}${doubleCatch}`));
		assert.ok(workbench.includes(`${autoUpdateCall}${doubleCatch}`));
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));

		for (const [rel, source] of [
			[ACCOUNT_REL, account],
			[IMPLICIT_REL, implicit],
			[SETTINGS_REL, settings],
			[XTERM_REL, xterm],
			[PROGRESS_REL, progress],
			[NOTEBOOK_REL, notebook],
			[SECRETS_REL, secrets],
			[TASKS_REL, tasks],
			[GETTING_STARTED_REL, gettingStarted],
			[WORKBENCH_SVC_REL, workbench],
			[EMERGENCY_REL, emergency],
			[ENCRYPTION_REL, encryption],
			[IGNORED_REL, ignored],
			[UPDATE_REL, update],
			[REMOTE_PROFILE_REL, remoteProfile],
			[WELCOME_REL, welcome],
			[NOTIFICATION_REL, notification],
		] as const) {
			assert.ok(!source.includes('D827'), `${rel} should not mention D827`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/emergencyAlert/test/node/unusedLeftoverPromiseCatchScanD827.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/policyExport/test/node/unusedLeftoverPromiseCatchScanD827.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/policies/test/node/accountPolicyLeftoverPromiseCatchScanD827.test.ts')));
	});
});
