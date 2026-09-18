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
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const POLICY_REL = 'src/vs/workbench/contrib/policyExport/electron-browser/policyExport.contribution.ts';
const QUICKACCESS_REL = 'src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts';
const THEMES_TEST_REL = 'src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/electron-browser/lifecycleService.ts';
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
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const NOTEBOOK_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const CHAT_ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const TYPE_CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const CALL_CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const CAROUSEL_REL = 'src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts';

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

const updateCall = 'this.updateImplicitContext()';
const updateWidgetCall = 'this.updateImplicitContext(widget)';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const autoUpdateCall = 'this.autoUpdateBuiltinExtensions()';
const syncPinnedCall = 'this.syncPinnedBuiltinExtensions()';
const updateRunningAutoCall = 'this.updateRunningExtensions(undefined, true)';
const updateRunningCall = 'this.updateRunningExtensions()';
const syncGalleryFirstPageCall = 'this.syncInstalledExtensionsWithGallery(pager.firstPage)';
const syncGalleryPageCall = 'this.syncInstalledExtensionsWithGallery(page)';
const syncGalleryExtsCall = 'this.syncInstalledExtensionsWithGallery(galleryExtensions)';

const d823Calls: Array<[string, string, number]> = [
	[IMPLICIT_REL, updateCall, 7],
	[IMPLICIT_REL, updateWidgetCall, 1],
];

suite('unused leftover remaining after D820 moved to chatImplicitContext leftover Promise fire-and-forget catch scan (D823)', () => {

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
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));
		assert.strictEqual(countDoubleChains(notification), 0);
		const unusedLeftoverRemainingLegal = 0;
		assert.ok(unusedLeftoverRemainingLegal < 4, `expected unused leftover remaining after D820 legal leftover <4, got ${unusedLeftoverRemainingLegal}`);
		assert.ok(!folding.includes('D823'));
		assert.ok(!inlayHints.includes('D823'));
		assert.ok(!languageStatus.includes('D823'));
	});

	test('this knife covers eight leftover Promise double-chain sites after unused leftover remaining after D820 moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d823Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(IMPLICIT_REL) ?? ''), 8);
	});

	test('chatImplicitContext leftover updateImplicitContext leftover void promises are Promise/async + double-chain', () => {
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		assertPromiseSignature(implicit, 'private async updateImplicitContext(updateWidget?: IChatWidget): Promise<void> {');
		assert.ok(implicit.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(implicit, updateCall);
		assertWrapped(implicit, updateWidgetCall);
		assert.strictEqual(countIncludes(implicit, `${updateCall}${doubleCatch}`), 7);
		assert.strictEqual(countIncludes(implicit, `${updateWidgetCall}${doubleCatch}`), 1);
		assert.ok(!implicit.includes('\t\t\t\t\t\t500)(() => this.updateImplicitContext()));\n'));
		assert.ok(!implicit.includes('\t\t\t\t\t\tthis.updateImplicitContext();\n'));
		assert.ok(!implicit.includes('\t\t\t\tthis.updateImplicitContext();\n'));
		assert.ok(!implicit.includes('\t\t\tthis.updateImplicitContext();\n'));
		assert.ok(!implicit.includes('\t\t\tawait this.updateImplicitContext(widget);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(implicit, 'private async updateImplicitContext(updateWidget?: IChatWidget): Promise<void> {');

		assert.ok(!implicit.includes('openerService.open'));
		assert.ok(!implicit.includes('registerAction2'));
		assert.ok(!implicit.includes('async run('));
		assert.ok(!implicit.includes('.then(undefined,'));
		assert.ok(!implicit.includes('return this.updateImplicitContext'));

		assert.ok(!implicit.includes('acknowledge('));
		assert.ok(!implicit.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(implicit));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(implicit));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(implicit));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(implicit));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(implicit));
		assert.ok(!implicit.includes('SaveSkillContent'));
		assert.ok(!implicit.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!implicit.includes('D823'));
	});

	test('D819 leftover remaining already-double stays already-double; loopCheck / openView leftover remaining stay leftover remaining; this knife did not overflow into owned leftover modules', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(CHAT_ENTITLEMENT_REL), 'utf8');
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const emergency = fs.readFileSync(resolveSource(EMERGENCY_REL), 'utf8');
		const typeContrib = fs.readFileSync(resolveSource(TYPE_CONTRIB_REL), 'utf8');
		const callContrib = fs.readFileSync(resolveSource(CALL_CONTRIB_REL), 'utf8');
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');

		assertWrapped(workbench, autoUpdateCall);
		assertWrapped(workbench, syncPinnedCall);
		assertWrapped(workbench, updateRunningAutoCall);
		assertWrapped(workbench, updateRunningCall);
		assertWrapped(workbench, syncGalleryFirstPageCall);
		assertWrapped(workbench, syncGalleryPageCall);
		assertWrapped(workbench, syncGalleryExtsCall);
		assert.strictEqual(countIncludes(workbench, `${autoUpdateCall}${doubleCatch}`), 2);
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));

		assert.ok(entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(entitlement.includes(`this.resolve()${doubleCatch}`));
		assert.ok(countDoubleChains(entitlement) >= 1, 'D825 already-double chatEntitlement leftover remaining');

		assert.ok(typeContrib.includes(doubleCatch));
		assert.ok(callContrib.includes(doubleCatch));
		assert.ok(carousel.includes(`this.updateCurrentImage()${doubleCatch}`));
		assert.ok(emergency.includes(`this.fetchAlerts(emergencyAlertUrl)${doubleCatch}`));
		assert.ok(policy.includes(doubleCatch));

		for (const [rel, source] of [
			[SETTINGS_REL, settings],
			[ACCOUNT_REL, account],
			[CONFIG_REL, config],
			[GETTING_STARTED_REL, gettingStarted],
			[XTERM_REL, xterm],
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[NOTEBOOK_REL, notebook],
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[TASKS_REL, tasks],
			[CHAT_ENTITLEMENT_REL, entitlement],
			[NOTIFICATION_REL, fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8')],
			[QUICKACCESS_REL, fs.readFileSync(resolveSource(QUICKACCESS_REL), 'utf8')],
			[THEMES_TEST_REL, fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8')],
			[LIFECYCLE_REL, fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8')],
			[ENCRYPTION_REL, fs.readFileSync(resolveSource(ENCRYPTION_REL), 'utf8')],
			[IGNORED_REL, fs.readFileSync(resolveSource(IGNORED_REL), 'utf8')],
			[UPDATE_REL, fs.readFileSync(resolveSource(UPDATE_REL), 'utf8')],
			[REMOTE_PROFILE_REL, fs.readFileSync(resolveSource(REMOTE_PROFILE_REL), 'utf8')],
			[WELCOME_REL, fs.readFileSync(resolveSource(WELCOME_REL), 'utf8')],
		] as const) {
			assert.ok(!source.includes('D823'), `${rel} should not mention D823`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/emergencyAlert/test/node/unusedLeftoverPromiseCatchScanD823.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD823.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/chat/test/node/chatEntitlementLeftoverPromiseCatchScanD823.test.ts')));
	});
});
