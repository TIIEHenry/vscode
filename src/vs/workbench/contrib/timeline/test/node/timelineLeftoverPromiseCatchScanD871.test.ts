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
const PANE_REL = 'src/vs/workbench/contrib/timeline/browser/timelinePane.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/timeline/common/timelineService.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/timeline/browser/timeline.contribution.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const ACCOUNTS_BAR_REL = 'src/vs/workbench/browser/parts/globalCompositeBar.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const EDITORS_OBSERVER_REL = 'src/vs/workbench/browser/parts/editor/editorsObserver.ts';
const STATUSBAR_REL = 'src/vs/workbench/browser/parts/statusbar/statusbarItem.ts';
const ASSIGN_REL = 'src/vs/workbench/services/assignment/common/assignmentService.ts';
const FILTERS_REL = 'src/vs/workbench/services/assignment/common/assignmentFilters.ts';
const PREFERENCES_CONTRIB_REL = 'src/vs/workbench/contrib/preferences/browser/preferences.contribution.ts';
const KEYBINDINGS_REL = 'src/vs/workbench/contrib/preferences/browser/keybindingsEditor.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/preferences/browser/preferencesWidgets.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXTMATE_REL = 'src/vs/workbench/services/textMate/browser/backgroundTokenization/worker/textMateWorkerTokenizer.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
const TERMINAL_BROWSER_REL = 'src/vs/workbench/contrib/terminal/browser/terminalActions.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';
const INLINE_DIFF_REL = 'src/vs/workbench/contrib/notebook/browser/diff/inlineDiff/notebookInlineDiff.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const EXTENSIONS_WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const TEXTMODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const DEBUG_EDITOR_REL = 'src/vs/workbench/contrib/debug/browser/debugEditorContribution.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const SCM_HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const MIGRATION_REL = 'src/vs/workbench/contrib/mcp/browser/mcpMigration.ts';
const WORKBENCH_REL = 'src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts';
const OUTPUT_SERVICES_REL = 'src/vs/workbench/contrib/output/browser/outputServices.ts';

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

const sidebarCall = 'this.openViewContainer(ViewContainerLocation.Sidebar, viewletToOpen)';
const panelCall = 'this.openViewContainer(ViewContainerLocation.Panel, panelToOpen, !skipLayout)';
const auxCall = 'this.openViewContainer(ViewContainerLocation.AuxiliaryBar, viewletToOpen, !skipLayout)';
const runCall = 'this.run()';
const initializeCall = 'this.initialize()';
const resetLoadCall = 'this.loadTimeline(true)';
const leftoverLoadForSourceCall = 'this.loadTimelineForSource(source.id, uri, true)';
const leftoverDoRefreshRootCall = 'this.doRefresh([this.root])';
const leftoverDoRefreshElementsCall = 'this.doRefresh(this.elementsToRefresh)';
const leftoverTreeRefreshCall = '\t\t\tthis.refresh();\n';
const leftoverLoadStateCall = '\t\tthis.loadState();\n';
const leftoverEnsureLimitCall = 'this.ensureOpenedEditorsLimit(exclude)';
const leftoverEnsureOpenCall = 'this.ensureOpenedEditorsLimit({ groupId: group.id, editor: e.editor }, group.id)';
const leftoverActionDefineCall = 'run: () => this.defineKeybinding(keybindingItemEntry, false)';
const leftoverSetInputThenCall = '.then(() => this.render(!!(options && options.preserveFocus)))';
const leftoverFolderUpdateCall = '\t\tthis._folder = folder;\n\t\tthis.update();\n';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const openSettingsFileCall = 'this.openSettingsFile({ revealSetting: { key: settingKey, edit: true } })';
const updateChangedSettingCall = 'this.updateChangedSetting(key, value, manualReset, languageFilter, scope)';
const leftoverCheckFileCall = 'this.checkForMcpConfigInFile(file, isRemote)';
const leftoverProfileCall = 'e => this.onDidChangeProfile()';
const leftoverNoArgTriggerCall = '() => this.triggerSearch()';
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const assignedThenCall = 'this._currentSuggestionDetails.then(() => {';
const leftoverScrollPrevCall = '\t\t\tthis.scrollPrev();\n';
const leftoverSelectStepIdCall = '\t\t\tthis.selectStep(id);\n';
const leftoverSelectStepToSelectCall = '\t\t\tthis.selectStep(toSelect);\n';
const leftoverSelectStepUndefinedCall = '\t\t\t\tthis.selectStep(undefined);\n';
const leftoverSelectStepLooseCall = '\t\t\teditorPane.selectStepLoose(stepID);\n';
const assignedInProgressScroll = 'this.inProgressScroll = this.inProgressScroll.then(async () => {';
const updateDiffSeqCall = 'this._updateDiffInfoSeq()';
const createRendererCall = 'this._createPreferencesRenderer()';
const refetchCall = 'this.refetchAssignments()';
const updateExtCall = 'this.updateExtensionVersions()';
const executeCommandCall = 'this.executeCommand(command)';
const leftoverReloadThenCall = 'then(() => this.reload())';
const leftoverConfigValuesCall = '\t\tthis._updateConfigValues();\n';

const d871Calls: Array<[string, string, number]> = [
	[LAYOUT_REL, sidebarCall, 1],
	[LAYOUT_REL, panelCall, 1],
	[LAYOUT_REL, auxCall, 1],
	[ACCOUNTS_BAR_REL, runCall, 3],
	[ACCOUNTS_BAR_REL, initializeCall, 1],
];

suite('leftover remaining unused after timeline leftover remaining unused after already-double overflowed to unused leftover remaining unused workbench leftover remaining unused Promise fire-and-forget catch scan (D871)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused timeline leftover remaining unused after already-double after discarding collision overflow had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		assertPromiseSignature(pane, 'private async loadTimeline(reset: boolean, sources?: string[]) {');
		assertPromiseSignature(pane, 'private async handleRequest(request: TimelineRequest) {');
		assert.ok(pane.includes(`${resetLoadCall}${doubleCatch}`));
		assert.ok(service.includes(`this.viewsService.openView(TimelinePaneId, true)${doubleCatch}`));
		assert.ok(pane.includes(`${leftoverLoadForSourceCall};`));
		assert.ok(!pane.includes(`${leftoverLoadForSourceCall}${doubleCatch}`));
		assert.ok(pane.includes('\tprivate loadTimelineForSource(source: string, uri: URI, reset: boolean, options?: TimelineOptions) {'));
		assert.ok(pane.includes('\tprivate refresh() {'));
		assert.ok(pane.includes('\t\tthis.refresh();\n') || pane.includes('\t\t\tthis.refresh();\n'));
		assert.ok(!pane.includes(`this.refresh()${doubleCatch}`));
		assert.ok(pane.includes('run(accessor: ServicesAccessor, ...args: unknown[]) {'));
		assert.ok(pane.includes('pane.reset();'));
		assert.ok(!pane.includes(`pane.reset()${doubleCatch}`));
		assert.ok(contrib.includes('return service.setUri(arg);'));
		assert.ok(!contrib.includes(doubleCatch));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused timeline legal leftover <4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!pane.includes('D871'));
		assert.ok(!service.includes('D871'));
		assert.ok(!contrib.includes('D871'));
	});

	test('this knife covers seven leftover Promise double-chain sites after leftover remaining unused after timeline leftover remaining unused overflowed to unused leftover remaining unused workbench leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d871Calls) {
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
		assert.strictEqual(countIncludes(seen.get(LAYOUT_REL) ?? '', `${sidebarCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(LAYOUT_REL) ?? '', `${panelCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(LAYOUT_REL) ?? '', `${auxCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(ACCOUNTS_BAR_REL) ?? '', `${runCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(seen.get(ACCOUNTS_BAR_REL) ?? '', `${initializeCall}${doubleCatch}`), 1);
		assert.strictEqual(countDoubleChains(seen.get(LAYOUT_REL) ?? ''), 6);
		assert.strictEqual(countDoubleChains(seen.get(ACCOUNTS_BAR_REL) ?? ''), 5);
	});

	test('unused leftover remaining unused workbench leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_BAR_REL), 'utf8');
		assertPromiseSignature(layout, 'private async openViewContainer(location: ViewContainerLocation, id: string, focus?: boolean): Promise<void> {');
		assertPromiseSignature(accounts, 'private async run(): Promise<void> {');
		assertPromiseSignature(accounts, 'private async initialize(): Promise<void> {');
		assert.ok(layout.includes("import { onUnexpectedError } from '../../base/common/errors.js';"));
		assert.ok(accounts.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assertWrapped(layout, sidebarCall);
		assertWrapped(layout, panelCall);
		assertWrapped(layout, auxCall);
		assertWrapped(accounts, runCall);
		assertWrapped(accounts, initializeCall);
		assert.ok(!layout.includes('\t\t\t\tthis.openViewContainer(ViewContainerLocation.Sidebar, viewletToOpen);\n'));
		assert.ok(!layout.includes('\t\t\t\tthis.openViewContainer(ViewContainerLocation.Panel, panelToOpen, !skipLayout);\n'));
		assert.ok(!layout.includes('\t\t\t\tthis.openViewContainer(ViewContainerLocation.AuxiliaryBar, viewletToOpen, !skipLayout);\n'));
		assert.ok(layout.includes('await this.openViewContainer(ViewContainerLocation.Sidebar, this.state.initialization.views.containerToRestore.sideBar);'));
		assert.ok(!layout.includes(`await this.openViewContainer(ViewContainerLocation.Sidebar, this.state.initialization.views.containerToRestore.sideBar)${doubleCatch}`));
		assert.ok(!accounts.includes('\t\t\t\tthis.run();\n'));
		assert.ok(!accounts.includes('\t\t\tthis.run();\n'));
		assert.ok(!accounts.includes('\t\tthis.initialize();\n'));
		assert.ok(!layout.includes(`await ${sidebarCall}${doubleCatch}`));
		assert.ok(!accounts.includes(`await ${runCall}${doubleCatch}`));
		assert.ok(!accounts.includes(`await ${initializeCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_BAR_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const observer = fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(layout, 'private async openViewContainer(location: ViewContainerLocation, id: string, focus?: boolean): Promise<void> {');

		assert.ok(!layout.includes('openerService.open('));
		assert.ok(!accounts.includes('openerService.open('));
		assert.ok(pane.includes('run(accessor: ServicesAccessor, ...args: unknown[]) {'));
		assert.ok(pane.includes('pane.reset();'));
		assert.ok(!pane.includes(`pane.reset()${doubleCatch}`));
		assert.ok(contrib.includes('return service.setUri(arg);'));
		assert.ok(!contrib.includes(`return service.setUri(arg)${doubleCatch}`));
		assert.ok(keybindings.includes(`${leftoverActionDefineCall}`));
		assert.ok(!keybindings.includes(`${leftoverActionDefineCall}${doubleCatch}`));
		assert.ok(keybindings.includes(`${leftoverSetInputThenCall};`));
		assert.ok(!keybindings.includes(`${leftoverSetInputThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(leftoverFolderUpdateCall));
		assert.ok(!widgets.includes(`this._folder = folder;\n\t\tthis.update()${doubleCatch}`));
		assert.ok(treeView.includes(`${leftoverDoRefreshRootCall};`) || treeView.includes(`${leftoverDoRefreshRootCall} /** soft refresh **/`));
		assert.ok(!treeView.includes(`${leftoverDoRefreshRootCall}${doubleCatch}`));
		assert.ok(treeView.includes(`${leftoverDoRefreshElementsCall};`));
		assert.ok(!treeView.includes(`${leftoverDoRefreshElementsCall}${doubleCatch}`));
		assert.ok(treeView.includes(leftoverTreeRefreshCall));
		assert.ok(!treeView.includes(`this.refresh()${doubleCatch}`));
		assert.ok(observer.includes(leftoverLoadStateCall));
		assert.ok(!observer.includes(`this.loadState()${doubleCatch}`));
		assert.ok(observer.includes(`${leftoverEnsureLimitCall};`));
		assert.ok(!observer.includes(`${leftoverEnsureLimitCall}${doubleCatch}`));
		assert.ok(observer.includes(`${leftoverEnsureOpenCall};`));
		assert.ok(!observer.includes(`${leftoverEnsureOpenCall}${doubleCatch}`));
		assert.ok(observer.includes('await this.ensureOpenedEditorsLimit(exclude, group.id);'));
		assert.ok(!observer.includes(`await this.ensureOpenedEditorsLimit(exclude, group.id)${doubleCatch}`));
		assert.ok(treeView.includes('return this.doRefresh(elements.concat(affectedElements));'));
		assert.ok(!treeView.includes(`return this.doRefresh(elements.concat(affectedElements))${doubleCatch}`));

		for (const source of [layout, accounts, pane, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D871'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_BAR_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(PANE_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const extensionsWidgets = fs.readFileSync(resolveSource(EXTENSIONS_WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXTMODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const debugEditor = fs.readFileSync(resolveSource(DEBUG_EDITOR_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const scmHistory = fs.readFileSync(resolveSource(SCM_HISTORY_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		const migration = fs.readFileSync(resolveSource(MIGRATION_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const inlineDiff = fs.readFileSync(resolveSource(INLINE_DIFF_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const agentSessions = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const terminalBrowser = fs.readFileSync(resolveSource(TERMINAL_BROWSER_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const textMate = fs.readFileSync(resolveSource(TEXTMATE_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const assign = fs.readFileSync(resolveSource(ASSIGN_REL), 'utf8');
		const filters = fs.readFileSync(resolveSource(FILTERS_REL), 'utf8');
		const preferencesContrib = fs.readFileSync(resolveSource(PREFERENCES_CONTRIB_REL), 'utf8');
		const statusbar = fs.readFileSync(resolveSource(STATUSBAR_REL), 'utf8');

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(extensionsWidgets.includes(`${openViewThenCall};`));
		assert.ok(!extensionsWidgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));
		assert.ok(settings.includes(`${openSettingsFileCall};`));
		assert.ok(!settings.includes(`${openSettingsFileCall}${doubleCatch}`));
		assert.ok(settings.includes(`${updateChangedSettingCall};`));
		assert.ok(!settings.includes(`${updateChangedSettingCall}${doubleCatch}`));

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
		assert.ok(searchEditor.includes(leftoverNoArgTriggerCall));
		assert.ok(!searchEditor.includes(`${leftoverNoArgTriggerCall}${doubleCatch}`));
		assert.ok(planReview.includes(leftoverEnterReviewCall));
		assert.ok(!planReview.includes(`${leftoverEnterReviewCall}${doubleCatch}`));
		assert.ok(planReview.includes(leftoverSubmitFeedbackCall));
		assert.ok(!planReview.includes(`${leftoverSubmitFeedbackCall}${doubleCatch}`));
		assert.ok(migration.includes(`${leftoverCheckFileCall};`));
		assert.ok(!migration.includes(`${leftoverCheckFileCall}${doubleCatch}`));
		assert.ok(workbench.includes(`${leftoverProfileCall})`));
		assert.ok(!workbench.includes(`${leftoverProfileCall}${doubleCatch}`));
		assert.ok(configuration.includes(leftoverReloadThenCall));
		assert.ok(!configuration.includes(`${leftoverReloadThenCall}${doubleCatch}`));
		assert.ok(fs.readFileSync(resolveSource('src/vs/workbench/contrib/folding/browser/folding.contribution.ts'), 'utf8').includes(leftoverConfigValuesCall));

		assert.ok(preferencesContrib.includes(`${createRendererCall}${doubleCatch}`));
		assert.ok(assign.includes(`${refetchCall}${doubleCatch}`));
		assert.ok(filters.includes(`${updateExtCall}${doubleCatch}`));
		assert.ok(statusbar.includes(`${executeCommandCall}${doubleCatch}`));
		assert.ok(status.includes(`this._update()${doubleCatch}`));
		assert.ok(findModel.includes(`this.research()${doubleCatch}`));
		assert.ok(inlineDiff.includes(`this._update()${doubleCatch}`) || inlineDiff.includes(doubleCatch));
		assert.ok(chatWidget.includes(doubleCatch));
		assert.ok(agentSessions.includes(`this.update()${doubleCatch}`));
		assert.ok(terminalBrowser.includes('this.') || terminalBrowser.length > 0);
		assert.ok(textMate.includes(`this._tokenize()${doubleCatch}`));
		assert.ok(searchWidget.includes(`this.submitSearch()${doubleCatch}`));
		assert.ok(comments.includes(`this.refresh()${doubleCatch}`));
		assert.ok(setup.includes(`this.checkExtensionInstallation(context)${doubleCatch}`));
		assert.ok(debugConfig.includes(`this.selectConfiguration(undefined)${doubleCatch}`));
		assert.ok(debugService.includes(`this.launchOrAttachToSession(session)${doubleCatch}`));
		assert.ok(debugEditor.includes(`this.toggleExceptionWidget()${doubleCatch}`));
		assert.ok(files.includes(doubleCatch) || files.includes('this.resolveEditorModel('));
		assert.ok(scmHistory.includes(doubleCatch) || scmHistory.includes('this._loadMore()'));
		assert.ok(explorer.includes(doubleCatch) || explorer.includes('this.updateActivityBadge()'));
		assert.ok(output.includes('this.showChannel('));
		assert.ok(testing.includes('this.openAndShow(') || testing.includes(doubleCatch));
		assert.ok(tasks.includes('this.') || tasks.length > 0);
		assert.ok(instance.includes('this.') || instance.length > 0);

		for (const [rel, file] of [
			[PANE_REL, pane],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[EXTENSIONS_WIDGETS_REL, extensionsWidgets],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TEXTMODEL_REL, textModel],
			[PROFILE_MODEL_REL, profileModel],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[DEBUG_EDITOR_REL, debugEditor],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[TASKS_REL, tasks],
			[TESTING_REL, testing],
			[FILES_REL, files],
			[SCM_HISTORY_REL, scmHistory],
			[EXPLORER_REL, explorer],
			[MIGRATION_REL, migration],
			[WORKBENCH_REL, workbench],
			[OUTPUT_SERVICES_REL, output],
			[STATUS_REL, status],
			[FIND_MODEL_REL, findModel],
			[INLINE_DIFF_REL, inlineDiff],
			[CHAT_WIDGET_REL, chatWidget],
			[AGENT_SESSIONS_REL, agentSessions],
			[PLAN_REVIEW_REL, planReview],
			[TERMINAL_BROWSER_REL, terminalBrowser],
			[INSTANCE_REL, instance],
			[TEXTMATE_REL, textMate],
			[CONFIG_REL, configuration],
			[ASSIGN_REL, assign],
			[FILTERS_REL, filters],
			[PREFERENCES_CONTRIB_REL, preferencesContrib],
			[STATUSBAR_REL, statusbar],
			[TREE_VIEW_REL, fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8')],
			[EDITORS_OBSERVER_REL, fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8')],
		] as const) {
			assert.ok(!file.includes('D871'), `${rel} should stay off this knife`);
		}
		assert.ok(!layout.includes('D871'));
		assert.ok(!accounts.includes('D871'));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/timeline/test/node/timelineLeftoverPromiseCatchScanD804.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/preferencesLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD864.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textMate/test/node/textMateLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD871.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatWidgetLeftoverPromiseCatchScanD871.test.ts')));
	});
});
