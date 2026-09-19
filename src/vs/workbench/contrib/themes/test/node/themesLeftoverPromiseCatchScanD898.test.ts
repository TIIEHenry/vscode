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
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const THEMES_TEST_REL = 'src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts';
const NAV_REL = 'src/vs/workbench/browser/actions/navigationActions.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const WELCOME_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.contribution.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const AUTH_EXT_REL = 'src/vs/workbench/services/authentication/browser/authenticationExtensionsService.ts';
const AUTH_MCP_REL = 'src/vs/workbench/services/authentication/browser/authenticationMcpService.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts';
const EDITORS_OBSERVER_REL = 'src/vs/workbench/browser/parts/editor/editorsObserver.ts';
const REPL_CONTRIB_REL = 'src/vs/workbench/contrib/replNotebook/browser/repl.contribution.ts';
const REPL_EDITOR_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditor.ts';
const REPL_INPUT_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditorInput.ts';
const TAGS_REL = 'src/vs/workbench/contrib/tags/electron-browser/workspaceTags.ts';
const HISTORY_REL = 'src/vs/workbench/services/history/browser/historyService.ts';
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
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';

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
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const leftoverSetThemeCall = 'this.setTheme(currentTheme, undefined)';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const leftoverMarketplaceThenCall = 'await marketplaceThemePicker.openQuickPick(\'\', themeService.getColorTheme(), selectTheme).then(undefined, onUnexpectedError)';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverSidebarCall = 'this.navigateToSidebar(layoutService, paneCompositeService)';
const leftoverPanelCall = 'this.navigateToPanel(layoutService, paneCompositeService)';
const leftoverAuxCall = 'this.navigateToAuxiliaryBar(layoutService, paneCompositeService)';
const leftoverInlayReadCall = '\t\t\tthis._read(line, hints);\n';
const leftoverWelcomeRunCall = '\t\tthis.run();\n';
const leftoverFoldingCall = '\t\tthis._updateConfigValues();\n';
const leftoverCompleteSessionCall = 'this.completeSessionAccessRequest(provider, extensionId, extensionName, scopeListOrRequest)';
const leftoverCompleteMcpCall = 'this.completeSessionAccessRequest(provider, mcpServerId, mcpServerName, scopes)';
const leftoverRevealCall = 'this._revealInEditor(event, element, group)';
const leftoverLoadStateCall = '\t\tthis.loadState();\n';
const leftoverProcessThenCall = `process(file).then(result => {
				console.log(result);
			})`;
const installCall = 'this._installHandler()';
const setOptionsInputCall = `this._notebookWidget.value!.setOptions({
			isReadOnly: true
		})`;
const setOptionsOverrideCall = 'void Promise.resolve(this._notebookWidget.value?.setOptions(options))';
const revertCall = 'void Promise.resolve(this.editorModelReference?.object.revert({ soft: true }))';
const reportCall = 'this.report()';
const reportWindowsCall = 'this.reportWindowsEdition()';
const goBackCall = 'this.goBack()';
const goForwardCall = 'this.goForward()';
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
const leftoverReloadThenCall = 'then(() => this.reload())';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const leftoverOpenSessionCall = 'list.onDidOpen(e => this.openAgentSession(e))';
const leftoverContextMenuCall = 'list.onContextMenu(e => this.showContextMenu(e))';
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';

const d898Calls: Array<[string, string, number]> = [
	[THEMES_REL, leftoverSetThemeCall, 1],
	[NAV_REL, leftoverSidebarCall, 1],
	[NAV_REL, leftoverPanelCall, 1],
	[NAV_REL, leftoverAuxCall, 1],
];

const d881AlreadyDouble: Array<[string, string, number]> = [
	[REPL_CONTRIB_REL, installCall, 1],
	[REPL_EDITOR_REL, setOptionsInputCall, 1],
	[REPL_EDITOR_REL, setOptionsOverrideCall, 1],
	[REPL_INPUT_REL, revertCall, 1],
];

const d876AlreadyDouble: Array<[string, string, number]> = [
	[TAGS_REL, reportCall, 1],
	[TAGS_REL, reportWindowsCall, 1],
	[HISTORY_REL, goBackCall, 1],
	[HISTORY_REL, goForwardCall, 1],
];

suite('leftover remaining unused themes leftover remaining unused overflowed to unused leftover remaining unused navigation leftover remaining unused Promise fire-and-forget catch scan (D898)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused themes leftover remaining unused after discarding collision overflow had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const themesTest = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');
		assertPromiseSignature(themes, 'private readonly setTheme: (theme: IWorkbenchTheme | undefined, settingsTarget: ThemeSettingTarget) => Promise<unknown>,');
		assert.ok(themes.includes('public trigger(value: string) {'));
		assert.ok(themes.includes(leftoverTriggerCall));
		assert.ok(!themes.includes(`this.trigger(value)${doubleCatch}`));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(!themes.includes(`this.setTheme(newTheme, applyTheme ? 'auto' : 'preview')${doubleCatch}`));
		assert.ok(themes.includes(leftoverMarketplaceThenCall));
		assert.ok(!themes.includes(`selectTheme)${doubleCatch}`));
		assert.ok(themes.includes('override async run(accessor: ServicesAccessor) {'));
		assert.ok(themes.includes('return editorService.openEditor({ resource: undefined, contents, languageId: \'jsonc\', options: { pinned: true } });'));
		assert.ok(!themes.includes(`openEditor({ resource: undefined, contents, languageId: 'jsonc', options: { pinned: true } })${doubleCatch}`));
		assert.ok(themesTest.includes(`${leftoverProcessThenCall}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(themesTest), 1);
		assertWrapped(themes, leftoverSetThemeCall);
		const leftoverRemainingUnusedLegal = countIncludes(themes, `${leftoverSetThemeCall}${doubleCatch}`);
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused themes legal leftover <4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.strictEqual(leftoverRemainingUnusedLegal, 1);
		assert.ok(!themes.includes('D898'));
		assert.ok(!themesTest.includes('D898'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused overflowed to unused leftover remaining unused navigation leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d898Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(THEMES_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(NAV_REL) ?? ''), 3);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const nav = fs.readFileSync(resolveSource(NAV_REL), 'utf8');
		assertPromiseSignature(themes, 'private readonly setTheme: (theme: IWorkbenchTheme | undefined, settingsTarget: ThemeSettingTarget) => Promise<unknown>,');
		assertPromiseSignature(nav, 'private async navigateToPanel(layoutService: IWorkbenchLayoutService, paneCompositeService: IPaneCompositePartService): Promise<IComposite | boolean> {');
		assertPromiseSignature(nav, 'private async navigateToSidebar(layoutService: IWorkbenchLayoutService, paneCompositeService: IPaneCompositePartService): Promise<IPaneComposite | boolean> {');
		assertPromiseSignature(nav, 'private async navigateToAuxiliaryBar(layoutService: IWorkbenchLayoutService, paneCompositeService: IPaneCompositePartService): Promise<IComposite | boolean> {');
		assert.ok(themes.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(nav.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertWrapped(themes, leftoverSetThemeCall);
		assertWrapped(nav, leftoverSidebarCall);
		assertWrapped(nav, leftoverPanelCall);
		assertWrapped(nav, leftoverAuxCall);
		assert.ok(!themes.includes('\t\t\t\t\t\tthis.setTheme(currentTheme, undefined);\n'));
		assert.ok(!nav.includes('\t\t\tthis.navigateToSidebar(layoutService, paneCompositeService);\n'));
		assert.ok(!nav.includes('\t\t\tthis.navigateToPanel(layoutService, paneCompositeService);\n'));
		assert.ok(!nav.includes('\t\t\tthis.navigateToAuxiliaryBar(layoutService, paneCompositeService);\n'));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(themes.includes(leftoverMarketplaceThenCall));
		assert.ok(themes.includes(leftoverTriggerCall));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const nav = fs.readFileSync(resolveSource(NAV_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const themesTest = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(themes, 'private readonly setTheme: (theme: IWorkbenchTheme | undefined, settingsTarget: ThemeSettingTarget) => Promise<unknown>,');
		assertPromiseSignature(nav, 'private async navigateToSidebar(layoutService: IWorkbenchLayoutService, paneCompositeService: IPaneCompositePartService): Promise<IPaneComposite | boolean> {');

		assert.ok(!themes.includes('openerService.open'));
		assert.ok(!nav.includes('openerService.open'));
		assert.ok(themes.includes('override async run(accessor: ServicesAccessor) {'));
		assert.ok(nav.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(!nav.includes('return this.navigateToSidebar'));
		assert.ok(themes.includes('return editorService.openEditor({ resource: undefined, contents, languageId: \'jsonc\', options: { pinned: true } });'));
		assert.ok(!themes.includes(`openEditor({ resource: undefined, contents, languageId: 'jsonc', options: { pinned: true } })${doubleCatch}`));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(!themes.includes(`this.setTheme(newTheme, applyTheme ? 'auto' : 'preview')${doubleCatch}`));
		assert.ok(themes.includes(leftoverMarketplaceThenCall));
		assert.ok(themesTest.includes(`${leftoverProcessThenCall}${doubleCatch}`));

		for (const source of [themes, nav]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D898'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D881/D876 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const nav = fs.readFileSync(resolveSource(NAV_REL), 'utf8');
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
		const simpleSuggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');

		let d881Sites = 0;
		const seen881 = new Map<string, string>();
		for (const [rel, call, count] of d881AlreadyDouble) {
			const source = seen881.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen881.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D881 already-double drifted: ${rel} ${call}`);
			d881Sites += count;
		}
		assert.strictEqual(d881Sites, 4);

		let d876Sites = 0;
		const seen876 = new Map<string, string>();
		for (const [rel, call, count] of d876AlreadyDouble) {
			const source = seen876.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen876.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D876 already-double drifted: ${rel} ${call}`);
			d876Sites += count;
		}
		assert.strictEqual(d876Sites, 4);

		assert.ok(inlayHints.includes(leftoverInlayReadCall));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(inlayHints), 0);
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
		assert.ok(!gettingStarted.includes(`this.selectStep(toSelect)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(undefined)${doubleCatch}`));
		assert.ok(gettingStarted.includes(assignedInProgressScroll));
		assert.ok(!gettingStarted.includes(`${assignedInProgressScroll}${doubleCatch}`));
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
		assert.ok(configuration.includes(leftoverReloadThenCall));
		assert.ok(!configuration.includes(`${leftoverReloadThenCall}${doubleCatch}`));
		assert.ok(searchWidget.includes(`this.submitSearch()${doubleCatch}`) || searchWidget.includes(doubleCatch));
		assert.ok(comments.includes(`this.refresh()${doubleCatch}`));
		assert.ok(setup.includes(`this.checkExtensionInstallation(context)${doubleCatch}`));
		assert.ok(debugConfig.includes(`this.selectConfiguration(undefined)${doubleCatch}`));
		assert.ok(debugService.includes(`this.launchOrAttachToSession(session)${doubleCatch}`));
		assert.ok(chatWidget.includes(doubleCatch));
		assert.ok(testing.includes('this.openAndShow(') || testing.includes(doubleCatch));
		assert.ok(tasks.includes('this.') || tasks.length > 0);

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
		] as const) {
			assert.ok(!file.includes('D898'), `${rel} should stay off this knife`);
		}
		assert.ok(!themes.includes('D898'));
		assert.ok(!nav.includes('D898'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD898.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD898.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD898.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD898.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD898.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD898.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/dropOrPasteInto/test/node/dropOrPasteIntoLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/share/test/node/shareLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/replNotebook/test/node/replNotebookLeftoverPromiseCatchScanD881.test.ts')));
	});
});
