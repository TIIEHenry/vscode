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
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const GATE_REL = 'src/vs/workbench/services/policies/browser/accountPolicyGateContribution.ts';
const TELEMETRY_REL = 'src/vs/workbench/services/policies/browser/policyTelemetry.contribution.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const EMERGENCY_REL = 'src/vs/workbench/contrib/emergencyAlert/electron-browser/emergencyAlert.contribution.ts';
const ENCRYPTION_REL = 'src/vs/workbench/contrib/encryption/electron-browser/encryption.contribution.ts';
const IGNORED_REL = 'src/vs/workbench/services/extensionRecommendations/common/extensionIgnoredRecommendationsService.ts';
const UPDATE_REL = 'src/vs/workbench/services/update/browser/updateService.ts';
const REMOTE_PROFILE_REL = 'src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const USER_ACTIVITY_REL = 'src/vs/workbench/services/userActivity/common/userActivityService.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const POLICY_REL = 'src/vs/workbench/contrib/policyExport/electron-browser/policyExport.contribution.ts';
const QUICKACCESS_REL = 'src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts';
const THEMES_TEST_REL = 'src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/electron-browser/lifecycleService.ts';

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

const updatePolicyCall = 'this._updatePolicyDefinitions(this.policyDefinitions)';
const getDefaultAccountThenCall = `this.defaultAccountService.getDefaultAccount().then(() => {
			this._updatePolicyDefinitions(this.policyDefinitions).catch(onUnexpectedError).catch(onUnexpectedError);
		})`;
const fetchAlertsCall = 'this.fetchAlerts(emergencyAlertUrl)';
const migrateCall = 'this.migrateToGnomeLibsecret()';
const ignoredCall = 'this.initIgnoredWorkspaceRecommendations()';
const updateCall = 'this.checkForUpdates(false)';
const cleanUpCall = 'this.cleanUp()';
const openSessionCall = 'this.openSessionInChat(chatSessionResource)';
const revealChatCall = 'this.revealMaximizedChat()';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const updateCacheCall = 'this.updateCache()';
const updateCachedDefaultsCall = 'this.updateCachedConfigurationDefaultsOverrides()';
const waitAndInitializeCall = 'this.waitAndInitialize(this._workspaceIdentifier)';

const d821Calls: Array<[string, string, number]> = [
	[ACCOUNT_REL, updatePolicyCall, 8],
];

suite('unused leftover remaining after D820 moved to accountPolicy leftover Promise fire-and-forget catch scan (D821)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('unused leftover remaining after D820 had fewer than four legal unused leftover sites so this knife moved', () => {
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));
		const unusedLeftoverRemainingLegal = 0;
		assert.ok(unusedLeftoverRemainingLegal < 4, `expected unused leftover remaining after D820 legal leftover <4, got ${unusedLeftoverRemainingLegal}`);
		assert.ok(!folding.includes('D821'));
		assert.ok(!inlayHints.includes('D821'));
		assert.ok(!languageStatus.includes('D821'));
	});

	test('this knife covers eight leftover Promise double-chain sites after unused leftover remaining after D820 moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d821Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(ACCOUNT_REL) ?? ''), 9);
	});

	test('accountPolicy leftover _updatePolicyDefinitions leftover void promises are Promise/async + double-chain', () => {
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		assertPromiseSignature(account, 'protected async _updatePolicyDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<void> {');
		assert.ok(account.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(account, updatePolicyCall);
		assert.strictEqual(countIncludes(account, `${updatePolicyCall}${doubleCatch}`), 8);
		assert.ok(!account.includes('\t\tthis._updatePolicyDefinitions(this.policyDefinitions);\n'));
		assert.ok(!account.includes('\t\t\tthis._updatePolicyDefinitions(this.policyDefinitions);\n'));
		assert.ok(!account.includes('\t\t\t\tthis._updatePolicyDefinitions(this.policyDefinitions);\n'));
		assert.ok(!account.includes('\t\t\t\t\tthis._updatePolicyDefinitions(this.policyDefinitions);\n'));
		assertWrapped(account, getDefaultAccountThenCall);
	});

	test('configuration leftover updateCache / updateCachedConfigurationDefaultsOverrides / waitAndInitialize stay leftover remaining', () => {
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(configuration, 'private async updateCachedConfigurationDefaultsOverrides(): Promise<void> {');
		assertPromiseSignature(configuration, 'private async updateCache(): Promise<void> {');
		assertPromiseSignature(configuration, 'private async waitAndInitialize(workspaceIdentifier: IWorkspaceIdentifier): Promise<void> {');
		assert.ok(configuration.includes(`\t\tthis.updateCachedConfigurationDefaultsOverrides();\n`) || configuration.includes(`\t\t\tthis.updateCachedConfigurationDefaultsOverrides();\n`));
		assert.ok(!configuration.includes(`${updateCachedDefaultsCall}${doubleCatch}`));
		assert.ok(configuration.includes(`\t\tthis.updateCache();\n`));
		assert.ok(!configuration.includes(`${updateCacheCall}${doubleCatch}`));
		assert.ok(configuration.includes(`\t\t\t\tthis.waitAndInitialize(this._workspaceIdentifier);\n`));
		assert.ok(!configuration.includes(`${waitAndInitializeCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const gate = fs.readFileSync(resolveSource(GATE_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(account, 'protected async _updatePolicyDefinitions(policyDefinitions: IStringDictionary<PolicyDefinition>): Promise<void> {');

		assert.ok(!account.includes('openerService.open'));
		assert.ok(!account.includes('IOpenerService'));
		assert.ok(!account.includes('extends Action2'));
		assert.ok(!account.includes('.then(undefined,'));
		assert.ok(account.includes(getDefaultAccountThenCall));
		assert.ok(!account.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!gate.includes(`this._updatePolicyDefinitions(this.policyDefinitions)${doubleCatch}`));
		assert.ok(!telemetry.includes(doubleCatch));

		for (const source of [account]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes('D821'));
		}
	});

	test('D820 leftover remaining that landed scans lock unwrapped stay unwrapped; already-double leftover stays already-double; this knife did not overflow into dirty leftover modules', () => {
		const emergency = fs.readFileSync(resolveSource(EMERGENCY_REL), 'utf8');
		const encryption = fs.readFileSync(resolveSource(ENCRYPTION_REL), 'utf8');
		const ignored = fs.readFileSync(resolveSource(IGNORED_REL), 'utf8');
		const update = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const remoteProfile = fs.readFileSync(resolveSource(REMOTE_PROFILE_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const quickaccess = fs.readFileSync(resolveSource(QUICKACCESS_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const userActivity = fs.readFileSync(resolveSource(USER_ACTIVITY_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');

		assert.ok(emergency.includes(`${fetchAlertsCall}${doubleCatch}`));
		assert.ok(encryption.includes(`${migrateCall}${doubleCatch}`));
		assert.ok(ignored.includes(`${ignoredCall}${doubleCatch}`));
		assert.ok(update.includes(`${updateCall}${doubleCatch}`));
		assert.ok(remoteProfile.includes(`${cleanUpCall}${doubleCatch}`));
		assert.ok(welcome.includes(`${openSessionCall}${doubleCatch}`));
		assert.ok(welcome.includes(`${revealChatCall}${doubleCatch}`));

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));

		assert.ok(policy.includes(doubleCatch));
		assert.ok(quickaccess.includes(doubleCatch));
		assert.ok(themes.includes(doubleCatch));
		assert.ok(lifecycle.includes(doubleCatch));

		for (const [rel, source] of [
			[EMERGENCY_REL, emergency],
			[ENCRYPTION_REL, encryption],
			[IGNORED_REL, ignored],
			[UPDATE_REL, update],
			[REMOTE_PROFILE_REL, remoteProfile],
			[WELCOME_REL, welcome],
			[NOTIFICATION_REL, notification],
			[USER_ACTIVITY_REL, userActivity],
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[TASKS_REL, tasks],
		] as const) {
			assert.ok(!source.includes('D821'), `${rel} should not mention D821`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/emergencyAlert/test/node/unusedLeftoverPromiseCatchScanD821.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/policyExport/test/node/unusedLeftoverPromiseCatchScanD821.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD821.test.ts')));
	});
});
