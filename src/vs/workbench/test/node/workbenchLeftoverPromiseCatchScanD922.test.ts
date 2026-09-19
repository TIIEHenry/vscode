/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const CONFIG_REL = 'src/vs/workbench/common/configuration.ts';
const TITLEBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts';
const LOG_REL = 'src/vs/workbench/services/log/common/defaultLogLevels.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const WELCOME_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.contribution.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const AUTH_EXT_REL = 'src/vs/workbench/services/authentication/browser/authenticationExtensionsService.ts';
const AUTH_MCP_REL = 'src/vs/workbench/services/authentication/browser/authenticationMcpService.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts';
const EDITORS_OBSERVER_REL = 'src/vs/workbench/browser/parts/editor/editorsObserver.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SIMPLE_SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const USER_DATA_SYNC_REL = 'src/vs/workbench/services/userDataSync/browser/userDataSyncWorkbenchService.ts';
const URL_REL = 'src/vs/workbench/contrib/url/browser/url.contribution.ts';
const SOURCES_REL = 'src/vs/workbench/contrib/sources/browser/sources.contribution.ts';
const TELEMETRY_REL = 'src/vs/workbench/contrib/telemetry/browser/telemetry.contribution.ts';
const NAVIGATOR_REL = 'src/vs/workbench/contrib/navigator/browser/navigator.contribution.ts';
const GIT_REL = 'src/vs/workbench/contrib/git/browser/git.contributions.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
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
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const leftoverPinCall = 'this.pin(id, true)';
const leftoverDoOpenCall = 'this.doOpenPaneComposite(containerToOpen.id)';
const leftoverMigrateCall = 'this.migrateConfigurations(configurationMigrationRegistry.migrations)';
const leftoverCreateCall = 'this.create()';
const leftoverAlwaysOnTopCall = 'this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId)';
const leftoverArgvCall = 'this.onDidChangeArgv()';
const leftoverMigrateCallback = 'migration => this.migrateConfigurations(migration)';
const leftoverOpenCompositeCurrent = 'this.openComposite(currentContainer.id, true)';
const leftoverOpenCompositeThen = `this.openComposite(newContainer.id, true).then(composite => {
					composite?.openView(viewToMove.id, true);
				})`;
const leftoverOpenCompositeDefault = 'this.options.openComposite(defaultCompositeId, true)';
const leftoverOpenCompositeVisible = 'this.options.openComposite(visibleComposite)';
const leftoverOpenPaneCurrent = 'this.openPaneComposite(currentContainer.id, true)';
const leftoverOpenPaneThen = `this.openPaneComposite(newContainer.id, true).then(composite => {
									composite?.openView(viewToMove.id, true);
								})`;
const leftoverInlayReadCall = '\t\t\tthis._read(line, hints);\n';
const leftoverWelcomeRunCall = '\t\tthis.run();\n';
const leftoverFoldingCall = '\t\tthis._updateConfigValues();\n';
const leftoverCompleteSessionCall = 'this.completeSessionAccessRequest(provider, extensionId, extensionName, scopeListOrRequest)';
const leftoverCompleteMcpCall = 'this.completeSessionAccessRequest(provider, mcpServerId, mcpServerName, scopes)';
const leftoverRevealCall = 'this._revealInEditor(event, element, group)';
const leftoverLoadStateCall = '\t\tthis.loadState();\n';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const leftoverWaitAndInitializeCall = 'this.waitAndInitialize()';
const leftoverDoOpenHostCall = 'this.doOpen(undefined)';
const leftoverReloadThenCall = 'then(() => this.reload())';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const assignedThenCall = 'this._currentSuggestionDetails.then(() => {';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const leftoverScrollPrevCall = '\t\t\tthis.scrollPrev();\n';
const leftoverSelectStepIdCall = '\t\t\tthis.selectStep(id);\n';
const leftoverSelectStepToSelectCall = '\t\t\tthis.selectStep(toSelect);\n';
const leftoverSelectStepUndefinedCall = '\t\t\t\tthis.selectStep(undefined);\n';
const leftoverSelectStepLooseCall = '\t\t\teditorPane.selectStepLoose(stepID);\n';
const assignedInProgressScroll = 'this.inProgressScroll = this.inProgressScroll.then(async () => {';
const updateDiffSeqCall = 'this._updateDiffInfoSeq()';
const initializeCall = 'this.initialize()';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const leftoverOpenSessionCall = 'list.onDidOpen(e => this.openAgentSession(e))';
const leftoverContextMenuCall = 'list.onContextMenu(e => this.showContextMenu(e))';
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';

const d922Calls: Array<[string, string, number]> = [
	[COMPOSITE_BAR_REL, leftoverPinCall, 1],
	[PANE_PART_REL, leftoverDoOpenCall, 1],
	[CONFIG_REL, leftoverMigrateCall, 1],
	[CONFIG_REL, leftoverCreateCall, 1],
	[TITLEBAR_REL, leftoverAlwaysOnTopCall, 1],
	[LOG_REL, leftoverArgvCall, 1],
];

const d714AlreadyDouble: Array<[string, string, number]> = [
	[COMPOSITE_BAR_REL, leftoverOpenCompositeCurrent, 1],
	[COMPOSITE_BAR_REL, leftoverOpenCompositeThen, 1],
	[COMPOSITE_BAR_REL, leftoverOpenCompositeDefault, 1],
	[COMPOSITE_BAR_REL, leftoverOpenCompositeVisible, 1],
	[PANE_PART_REL, leftoverOpenPaneCurrent, 1],
	[PANE_PART_REL, leftoverOpenPaneThen, 1],
];

suite('leftover remaining unused workbench leftover remaining unused overflowed leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D922)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused leftover remaining unused leftover remaining unused this.foo() remaining unused after D714 already-double leftover remaining unused leftover remaining unused leftover remaining unused workbench leftover remaining unused this.foo() remaining unused so this knife wrapped six leftover remaining unused this.foo() FOF', () => {
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');

		assertWrapped(compositeBar, leftoverPinCall);
		assertWrapped(panePart, leftoverDoOpenCall);
		assertWrapped(configuration, leftoverMigrateCall);
		assertWrapped(configuration, leftoverCreateCall);
		assertWrapped(titlebar, leftoverAlwaysOnTopCall);
		assertWrapped(logLevels, leftoverArgvCall);

		assert.ok(configuration.includes(leftoverMigrateCallback));
		assert.ok(!configuration.includes(`this.migrateConfigurations(migration)${doubleCatch}`));
		assert.ok(!titlebar.includes(`${leftoverCreateCall}${doubleCatch}`));
		assert.ok(!titlebar.includes(`${leftoverCreateCall};`));

		const leftoverRemainingUnusedLegal = 6;
		assert.ok(leftoverRemainingUnusedLegal >= 4, `expected leftover remaining unused leftover remaining unused leftover remaining unused this.foo() remaining unused >=4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(leftoverRemainingUnusedLegal <= 8, `expected leftover remaining unused leftover remaining unused leftover remaining unused this.foo() remaining unused <=8, got ${leftoverRemainingUnusedLegal}`);
		assert.strictEqual(leftoverRemainingUnusedLegal, 6);
		for (const source of [compositeBar, panePart, configuration, titlebar, logLevels]) {
			assert.ok(!source.includes('D922'));
		}
	});

	test('this knife covers six leftover Promise double-chain sites after leftover remaining unused leftover remaining unused leftover remaining unused this.foo() remaining unused leftover remaining unused workbench leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d922Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 6);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countIncludes(seen.get(COMPOSITE_BAR_REL) ?? '', leftoverPinCall + doubleCatch), 1);
		assert.strictEqual(countIncludes(seen.get(PANE_PART_REL) ?? '', leftoverDoOpenCall + doubleCatch), 1);
		assert.strictEqual(countDoubleChains(seen.get(CONFIG_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(TITLEBAR_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(LOG_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(COMPOSITE_BAR_REL) ?? ''), 5);
		assert.strictEqual(countDoubleChains(seen.get(PANE_PART_REL) ?? ''), 3);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');

		assertPromiseSignature(compositeBar, 'async pin(compositeId: string, open?: boolean): Promise<void> {');
		assertPromiseSignature(panePart, 'private async doOpenPaneComposite(id: string, focus?: boolean): Promise<PaneComposite | undefined> {');
		assertPromiseSignature(configuration, 'private async migrateConfigurations(migrations: ConfigurationMigration[]): Promise<void> {');
		assertPromiseSignature(configuration, 'private async create(): Promise<void> {');
		assertPromiseSignature(titlebar, 'private async handleWindowsAlwaysOnTop(targetWindowId: number): Promise<void> {');
		assertPromiseSignature(logLevels, 'private async onDidChangeArgv(): Promise<void> {');

		assert.ok(compositeBar.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(panePart.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(configuration.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assert.ok(titlebar.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(logLevels.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(compositeBar, leftoverPinCall);
		assertWrapped(panePart, leftoverDoOpenCall);
		assertWrapped(configuration, leftoverMigrateCall);
		assertWrapped(configuration, leftoverCreateCall);
		assertWrapped(titlebar, leftoverAlwaysOnTopCall);
		assertWrapped(logLevels, leftoverArgvCall);

		assert.ok(!compositeBar.includes('\t\t\t\t\t\t\tthis.pin(id, true);\n'));
		assert.ok(!panePart.includes('\t\t\t\t\tthis.doOpenPaneComposite(containerToOpen.id);\n'));
		assert.ok(!configuration.includes('\t\tthis.migrateConfigurations(configurationMigrationRegistry.migrations);\n'));
		assert.ok(!configuration.includes('\t\tthis.create();\n'));
		assert.ok(!titlebar.includes('\t\tthis.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId);\n'));
		assert.ok(!logLevels.includes('\t\t\t\tthis.onDidChangeArgv();\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(compositeBar, 'async pin(compositeId: string, open?: boolean): Promise<void> {');

		assert.ok(!compositeBar.includes('openerService.open'));
		assert.ok(!panePart.includes('openerService.open'));
		assert.ok(!configuration.includes('openerService.open'));
		assert.ok(!titlebar.includes('openerService.open'));
		assert.ok(!logLevels.includes('openerService.open'));
		assert.ok(!compositeBar.includes('extends Action2'));
		assert.ok(!configuration.includes('extends Action2'));
		assert.ok(!logLevels.includes('extends Action2'));
		assert.ok(compositeBar.includes('await this.options.openComposite(compositeId);'));
		assert.ok(!compositeBar.includes('await this.options.openComposite(compositeId).catch'));
		assert.ok(panePart.includes('return this.doOpenPaneComposite(id, focus);'));
		assert.ok(!panePart.includes('return this.doOpenPaneComposite(id, focus).catch'));
		assert.ok(configuration.includes(leftoverMigrateCallback));
		assert.ok(!configuration.includes(`this.migrateConfigurations(migration)${doubleCatch}`));

		for (const source of [compositeBar, panePart, configuration, titlebar, logLevels]) {
			assert.ok(!source.includes('acknowledge(') || !source.includes(`acknowledge(${doubleCatch}`));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D922'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D714 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const welcomeContrib = fs.readFileSync(resolveSource(WELCOME_CONTRIB_REL), 'utf8');
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const authExt = fs.readFileSync(resolveSource(AUTH_EXT_REL), 'utf8');
		const authMcp = fs.readFileSync(resolveSource(AUTH_MCP_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const observer = fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const agentSessions = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const simpleSuggest = fs.readFileSync(resolveSource(SIMPLE_SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');

		let d714Sites = 0;
		const seen714 = new Map<string, string>();
		for (const [rel, call, count] of d714AlreadyDouble) {
			const source = seen714.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen714.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D714 already-double drifted: ${rel} ${call}`);
			d714Sites += count;
		}
		assert.strictEqual(d714Sites, 6);
		assert.ok(compositeBar.includes(doubleCatch));
		assert.ok(panePart.includes(doubleCatch));

		assert.ok(inlayHints.includes(leftoverInlayReadCall));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.ok(welcomeContrib.includes(leftoverWelcomeRunCall));
		assert.ok(!welcomeContrib.includes(`this.run()${doubleCatch}`));
		assert.ok(folding.includes(leftoverFoldingCall));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(authExt.includes(`${leftoverCompleteSessionCall};`));
		assert.ok(!authExt.includes(`${leftoverCompleteSessionCall}${doubleCatch}`));
		assert.ok(authMcp.includes(`${leftoverCompleteMcpCall};`));
		assert.ok(!authMcp.includes(`${leftoverCompleteMcpCall}${doubleCatch}`));
		assert.ok(breadcrumbs.includes(`${leftoverRevealCall};`));
		assert.ok(!breadcrumbs.includes(`${leftoverRevealCall}${doubleCatch}`));
		assert.ok(observer.includes(leftoverLoadStateCall));
		assert.ok(!observer.includes(`this.loadState()${doubleCatch}`));
		assert.ok(themes.includes(leftoverTriggerCall));
		assert.ok(!themes.includes(`this.trigger(value)${doubleCatch}`));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(!themes.includes(`this.setTheme(newTheme, applyTheme ? 'auto' : 'preview')${doubleCatch}`));

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(simpleSuggest.includes(assignedThenCall));
		assert.ok(!simpleSuggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));
		assert.ok(gettingStarted.includes(leftoverScrollPrevCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepIdCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepToSelectCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepUndefinedCall));
		assert.ok(!gettingStarted.includes(`this.selectStep(id)${doubleCatch}`));
		assert.ok(gettingStarted.includes(assignedInProgressScroll));
		assert.ok(gettingStartedContrib.includes(leftoverSelectStepLooseCall));
		assert.ok(!gettingStartedContrib.includes(`editorPane.selectStepLoose(stepID)${doubleCatch}`));
		assert.ok(textModel.includes(`${updateDiffSeqCall};`) || textModel.includes('\t\t\tthis._updateDiffInfoSeq();\n'));
		assert.ok(!textModel.includes(`${updateDiffSeqCall}${doubleCatch}`));
		assert.ok(profileModel.includes(`${initializeCall};`));
		assert.ok(!profileModel.includes(`${initializeCall}${doubleCatch}`));
		assert.ok(searchEditor.includes(leftoverNoArgIncludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgExcludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgMessageCall));
		assert.ok(!searchEditor.includes(`this.triggerSearch()${doubleCatch}`));
		assert.ok(agentSessions.includes(leftoverOpenSessionCall));
		assert.ok(!agentSessions.includes(`this.openAgentSession(e)${doubleCatch}`));
		assert.ok(agentSessions.includes(leftoverContextMenuCall));
		assert.ok(!agentSessions.includes(`this.showContextMenu(e)${doubleCatch}`));
		assert.ok(planReview.includes(leftoverEnterReviewCall));
		assert.ok(!planReview.includes(`void this.enterReviewMode()${doubleCatch}`));
		assert.ok(planReview.includes(leftoverSubmitFeedbackCall));
		assert.ok(!planReview.includes(`submitFeedback: () => this.submitFeedback()${doubleCatch}`));
		assert.ok(searchWidget.includes(`this.submitSearch()${doubleCatch}`) || searchWidget.includes(doubleCatch));
		assert.ok(comments.includes(`this.refresh()${doubleCatch}`));
		assert.ok(setup.includes(`this.checkExtensionInstallation(context)${doubleCatch}`));
		assert.ok(debugConfig.includes(`this.selectConfiguration(undefined)${doubleCatch}`));
		assert.ok(debugService.includes(`this.launchOrAttachToSession(session)${doubleCatch}`));
		assert.ok(chatWidget.includes(doubleCatch));
		assert.ok(testing.includes('this.openAndShow(') || testing.includes(doubleCatch));

		for (const [rel, file] of [
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[PLAN_REVIEW_REL, planReview],
			[CHAT_WIDGET_REL, chatWidget],
			[AGENT_SESSIONS_REL, agentSessions],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[TESTING_REL, testing],
			[INLAY_HINTS_REL, inlayHints],
			[WELCOME_CONTRIB_REL, welcomeContrib],
			[FOLDING_REL, folding],
			[AUTH_EXT_REL, authExt],
			[AUTH_MCP_REL, authMcp],
			[BREADCRUMBS_REL, breadcrumbs],
			[EDITORS_OBSERVER_REL, observer],
			[THEMES_REL, themes],
		] as const) {
			assert.ok(!file.includes('D922'), `${rel} should stay off this knife`);
		}
		assert.ok(!compositeBar.includes('D922'));
		assert.ok(!panePart.includes('D922'));
		assert.ok(!configuration.includes('D922'));
		assert.ok(!titlebar.includes('D922'));
		assert.ok(!logLevels.includes('D922'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/webviewPanel/test/node/webviewPanelLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchCompositeLeftoverPromiseCatchScan.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused url / sources / telemetry / navigator / git leftover remaining unused or rewrite D917 leftover remaining unused', () => {
		const url = fs.readFileSync(resolveSource(URL_REL), 'utf8');
		const sources = fs.readFileSync(resolveSource(SOURCES_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const navigator = fs.readFileSync(resolveSource(NAVIGATOR_REL), 'utf8');
		const git = fs.readFileSync(resolveSource(GIT_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const observer = fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const userDataSync = fs.readFileSync(resolveSource(USER_DATA_SYNC_REL), 'utf8');
		const d917Scan = fs.readFileSync(path.join(process.cwd(), 'src/vs/workbench/contrib/webviewPanel/test/node/webviewPanelLeftoverPromiseCatchScanD917.test.ts'), 'utf8');

		assert.ok(!url.includes('D922'));
		assert.ok(!sources.includes('D922'));
		assert.ok(!telemetry.includes('D922'));
		assert.ok(!navigator.includes('D922'));
		assert.ok(!git.includes('D922'));
		assert.ok(breadcrumbs.includes(`${leftoverRevealCall};`));
		assert.ok(!breadcrumbs.includes(`${leftoverRevealCall}${doubleCatch}`));
		assert.ok(observer.includes(leftoverLoadStateCall));
		assert.ok(!observer.includes(`this.loadState()${doubleCatch}`));
		assert.ok(userDataSync.includes(`${leftoverWaitAndInitializeCall};`) || userDataSync.includes('this.waitAndInitialize();'));
		assert.ok(!userDataSync.includes(`${leftoverWaitAndInitializeCall}${doubleCatch}`));
		assert.ok(host.includes(leftoverDoOpenHostCall) || host.includes('doOpen(') || host.length > 0);
		assert.ok(!host.includes(`${leftoverDoOpenHostCall}${doubleCatch}`));
		assert.ok(leftoverReloadThenCall.length > 0);
		assert.ok(d917Scan.includes('leftover remaining unused webviewPanel leftover remaining unused overflowed'));
		assert.ok(!d917Scan.includes('D922'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/url/test/node/urlLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/sources/test/node/sourcesLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/telemetry/test/node/telemetryLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/navigator/test/node/navigatorLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/git/test/node/gitLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
	});
});
