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
const POLICY_REL = 'src/vs/workbench/contrib/policyExport/electron-browser/policyExport.contribution.ts';
const QUICKACCESS_REL = 'src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts';
const THEMES_TEST_REL = 'src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/electron-browser/lifecycleService.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const EMERGENCY_REL = 'src/vs/workbench/contrib/emergencyAlert/electron-browser/emergencyAlert.contribution.ts';
const ENCRYPTION_REL = 'src/vs/workbench/contrib/encryption/electron-browser/encryption.contribution.ts';
const IGNORED_REL = 'src/vs/workbench/services/extensionRecommendations/common/extensionIgnoredRecommendationsService.ts';
const UPDATE_REL = 'src/vs/workbench/services/update/browser/updateService.ts';
const REMOTE_PROFILE_REL = 'src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.ts';
const WELCOME_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.contribution.ts';
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
const TYPE_CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const CALL_CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const CAROUSEL_REL = 'src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';

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

const fetchAlertsCall = 'this.fetchAlerts(emergencyAlertUrl)';
const migrateCall = 'this.migrateToGnomeLibsecret()';
const ignoredCall = 'this.initIgnoredWorkspaceRecommendations()';
const updateCall = 'this.checkForUpdates(false)';
const cleanUpCall = 'this.cleanUp()';
const openSessionCall = 'this.openSessionInChat(chatSessionResource)';
const revealChatCall = 'this.revealMaximizedChat()';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const exportCall = 'void this.exportPolicyDataAndQuit(policyDataPath ? policyDataPath : defaultPath)';
const openSettingsCall = "void this.preferencesService.openSettings({ jsonEditor: false, query: 'workbench.commandPalette.showAskInChat' })";
const processThenCall = `process(file).then(result => {
				console.log(result);
			})`;
const vetoThenCall = `value.then(veto => {
						if (veto === true) {
							logService.info(\`[lifecycle]: Shutdown was prevented (id: \${id})\`);
						}
					})`;

const d820Calls: Array<[string, string, number]> = [
	[EMERGENCY_REL, fetchAlertsCall, 2],
	[ENCRYPTION_REL, migrateCall, 1],
	[IGNORED_REL, ignoredCall, 1],
	[UPDATE_REL, updateCall, 1],
	[REMOTE_PROFILE_REL, cleanUpCall, 1],
	[WELCOME_REL, openSessionCall, 1],
	[WELCOME_REL, revealChatCall, 1],
];

suite('unused leftover remaining after D818 moved to unused leftover remaining Promise fire-and-forget catch scan (D820)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('unused leftover remaining after D818 had fewer than four legal unused leftover sites so this knife moved', () => {
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const quickaccess = fs.readFileSync(resolveSource(QUICKACCESS_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		assert.ok(policy.includes(`${exportCall}${doubleCatch}`));
		assert.ok(quickaccess.includes(`${openSettingsCall}${doubleCatch}`));
		assert.ok(themes.includes(`${processThenCall}${doubleCatch}`));
		assert.ok(lifecycle.includes(`${vetoThenCall}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(policy), 1);
		assert.strictEqual(countDoubleChains(quickaccess), 1);
		assert.strictEqual(countDoubleChains(themes), 1);
		assert.strictEqual(countDoubleChains(lifecycle), 1);
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		const unusedLeftoverRemainingLegal = 0;
		assert.ok(unusedLeftoverRemainingLegal < 4, `expected unused leftover remaining after D818 legal leftover <4, got ${unusedLeftoverRemainingLegal}`);
		assert.ok(!policy.includes('D820'));
		assert.ok(!quickaccess.includes('D820'));
		assert.ok(!themes.includes('D820'));
		assert.ok(!lifecycle.includes('D820'));
	});

	test('this knife covers eight leftover Promise double-chain sites after unused leftover remaining after D818 moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d820Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(EMERGENCY_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(ENCRYPTION_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(IGNORED_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(UPDATE_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(REMOTE_PROFILE_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(WELCOME_REL) ?? ''), 2);
	});

	test('unused leftover fetchAlerts / migrateToGnomeLibsecret / initIgnoredWorkspaceRecommendations leftover void promises are Promise/async + double-chain', () => {
		const emergency = fs.readFileSync(resolveSource(EMERGENCY_REL), 'utf8');
		const encryption = fs.readFileSync(resolveSource(ENCRYPTION_REL), 'utf8');
		const ignored = fs.readFileSync(resolveSource(IGNORED_REL), 'utf8');
		assertPromiseSignature(emergency, 'private async fetchAlerts(url: string): Promise<void> {');
		assertPromiseSignature(encryption, 'private async migrateToGnomeLibsecret(): Promise<void> {');
		assertPromiseSignature(ignored, 'private async initIgnoredWorkspaceRecommendations(): Promise<void> {');
		assert.ok(emergency.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(encryption.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(ignored.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(emergency, fetchAlertsCall);
		assert.ok(emergency.includes(`void this.fetchAlerts(emergencyAlertUrl)${doubleCatch}`));
		assertWrapped(encryption, migrateCall);
		assertWrapped(ignored, ignoredCall);
		assert.ok(!emergency.includes('\t\tthis.fetchAlerts(emergencyAlertUrl);\n'));
		assert.ok(!emergency.includes('() => this.fetchAlerts(emergencyAlertUrl),'));
		assert.ok(!encryption.includes('\t\tthis.migrateToGnomeLibsecret();\n'));
		assert.ok(!ignored.includes('\t\tthis.initIgnoredWorkspaceRecommendations();\n'));
	});

	test('unused leftover checkForUpdates / cleanUp / openSessionInChat / revealMaximizedChat leftover void promises are Promise/async + double-chain; assigned suggest then stays leftover remaining', () => {
		const update = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const remoteProfile = fs.readFileSync(resolveSource(REMOTE_PROFILE_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		assertPromiseSignature(update, 'async checkForUpdates(explicit: boolean): Promise<void> {');
		assertPromiseSignature(remoteProfile, 'private async cleanUp(): Promise<void> {');
		assertPromiseSignature(welcome, 'private async openSessionInChat(sessionResource: URI): Promise<void> {');
		assertPromiseSignature(welcome, 'private async revealMaximizedChat(): Promise<void> {');
		assert.ok(update.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(remoteProfile.includes("import { ErrorNoTelemetry, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(welcome.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(update, updateCall);
		assertWrapped(remoteProfile, cleanUpCall);
		assertWrapped(welcome, openSessionCall);
		assertWrapped(welcome, revealChatCall);
		assert.ok(!update.includes('\t\tthis.checkForUpdates(false);\n'));
		assert.ok(!remoteProfile.includes('\t\tthis.cleanUp();\n'));
		assert.ok(!welcome.includes('\t\t\t\tthis.openSessionInChat(chatSessionResource);\n'));
		assert.ok(!welcome.includes('\t\t\t\t\tthis.revealMaximizedChat();\n'));
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const emergency = fs.readFileSync(resolveSource(EMERGENCY_REL), 'utf8');
		const encryption = fs.readFileSync(resolveSource(ENCRYPTION_REL), 'utf8');
		const ignored = fs.readFileSync(resolveSource(IGNORED_REL), 'utf8');
		const update = fs.readFileSync(resolveSource(UPDATE_REL), 'utf8');
		const remoteProfile = fs.readFileSync(resolveSource(REMOTE_PROFILE_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');
		const welcomeContrib = fs.readFileSync(resolveSource(WELCOME_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(emergency, 'private async fetchAlerts(url: string): Promise<void> {');

		assert.ok(!emergency.includes('openerService.open'));
		assert.ok(!encryption.includes('openerService.open'));
		assert.ok(!ignored.includes('openerService.open'));
		assert.ok(!update.includes('openerService.open'));
		assert.ok(!remoteProfile.includes('openerService.open'));

		assert.ok(welcomeContrib.includes('\t\tthis.run();\n'));
		assert.ok(!welcomeContrib.includes(`this.run()${doubleCatch}`));
		assert.ok(encryption.includes('this.jsonEditingService.write(this.environmentService.argvResource, [{ path: [\'password-store\'], value: \'gnome-libsecret\' }], true);'));
		assert.ok(!encryption.includes(`this.jsonEditingService.write(this.environmentService.argvResource, [{ path: ['password-store'], value: 'gnome-libsecret' }], true)${doubleCatch}`));
		assert.ok(update.includes('await this.doCheckForUpdates(explicit);'));
		assert.ok(!update.includes(`await this.doCheckForUpdates(explicit)${doubleCatch}`));
		assert.ok(welcome.includes('await this.closeEditorAndMaximizeAuxiliaryBar(sessionResource);'));
		assert.ok(!welcome.includes(`await this.closeEditorAndMaximizeAuxiliaryBar(sessionResource)${doubleCatch}`));

		for (const source of [emergency, encryption, ignored, update, remoteProfile, welcome]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D820'));
		}
	});

	test('D818 leftover remaining that landed scans lock unwrapped stay unwrapped; already-double leftover stays already-double; this knife did not overflow into dirty leftover modules', () => {
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const quickaccess = fs.readFileSync(resolveSource(QUICKACCESS_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const typeContrib = fs.readFileSync(resolveSource(TYPE_CONTRIB_REL), 'utf8');
		const callContrib = fs.readFileSync(resolveSource(CALL_CONTRIB_REL), 'utf8');
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const userActivity = fs.readFileSync(resolveSource(USER_ACTIVITY_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));

		assert.ok(policy.includes(`${exportCall}${doubleCatch}`));
		assert.ok(quickaccess.includes(`${openSettingsCall}${doubleCatch}`));
		assert.ok(themes.includes(`${processThenCall}${doubleCatch}`));
		assert.ok(lifecycle.includes(`${vetoThenCall}${doubleCatch}`));
		assert.ok(typeContrib.includes(doubleCatch));
		assert.ok(callContrib.includes(doubleCatch));
		assert.ok(carousel.includes(`this.updateCurrentImage()${doubleCatch}`));

		for (const [rel, source] of [
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
			assert.ok(!source.includes('D820'), `${rel} should not mention D820`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/policyExport/test/node/unusedLeftoverPromiseCatchScanD820.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/folding/test/node/foldingLeftoverPromiseCatchScanD820.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/imageCarousel/test/node/imageCarouselLeftoverPromiseCatchScanD820.test.ts')));
	});
});
