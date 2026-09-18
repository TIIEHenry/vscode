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
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const DEBUG_EDITOR_REL = 'src/vs/workbench/contrib/debug/browser/debugEditorContribution.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';
const UNIFICATION_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const EXTENSIONS_WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const EXTENSIONS_RUNTIME_REL = 'src/vs/workbench/contrib/extensions/browser/abstractRuntimeExtensionsEditor.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const OUTPUT_REL = 'src/vs/workbench/contrib/output/browser/outputView.ts';
const BULK_EDIT_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const MCP_REL = 'src/vs/workbench/contrib/mcp/common/mcpServerRequestHandler.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const NOTEBOOK_STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts';
const SCM_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const REMOTE_EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const STATUSBAR_REL = 'src/vs/workbench/browser/parts/statusbar/statusbarItem.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const MCP_MIGRATION_REL = 'src/vs/workbench/contrib/mcp/browser/mcpMigration.ts';
const MCP_WORKBENCH_REL = 'src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const SUGGEST_CONTRIB_REL = 'src/vs/workbench/contrib/terminalContrib/suggest/browser/terminal.suggest.contribution.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const LOGS_REL = 'src/vs/workbench/contrib/logs/common/logsActions.ts';

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

const updateCall = 'this.update()';
const leftoverOpenSessionCall = 'list.onDidOpen(e => this.openAgentSession(e))';
const leftoverContextMenuCall = 'list.onContextMenu(e => this.showContextMenu(e))';
const followupsCall = 'this.renderFollowups()';
const acceptMessageCall = 'this.acceptInput(item.message)';
const acceptMsgCall = 'this.acceptInput(msg)';
const renderEditingCall = 'this.renderChatEditingSessionState()';
const leftoverHandoffAcceptCall = "this.acceptInput().catch(e => this.logService.error(`[Handoff] Failed to submit delegated handoff to '@${agentId}'`, e));";
const leftoverHandoffSendCall = "this.acceptInput().catch(e => this.logService.error(`[Handoff] Failed to submit handoff to '${handoff.agent}'`, e));";
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';
const returnedSubmitActionCall = 'submitAction: action => this.submitApproval(action),';
const returnedRejectCall = 'reject: () => this.submitRejection(),';
const actionRunResolveCall = '\t\t\t\t\t\t\treturn Promise.resolve();\n';
const clearAllCall = 'this.clearAllInlineFeedback()';
const exitFeedbackCall = 'this.exitFeedbackMode()';
const revealCall = 'this.revealInlineComment(item)';
const submitRejectionCall = 'this.submitRejection()';
const submitApprovalActionCall = 'this.submitApproval(action)';
const submitApprovalPrimaryCall = 'this.submitApproval(primary)';
const markUsedCall = 'void this.markUsed()';
const enterFeedbackCall = 'void this.enterFeedbackMode({ focus: false })';
const submitFeedbackVoidCall = 'void this.submitFeedback()';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const delayCall = 'this.triggerSearch({ delay })';
const resetCursorCall = 'this.triggerSearch({ resetCursor: false })';
const delayResetCall = 'this.triggerSearch({ resetCursor: false, delay: triggeredOnType ? this.searchConfig.searchOnTypeDebouncePeriod : 0 })';
const delayMultiplierCall = 'this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier)';
const refreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
const launchCall = 'this.launchOrAttachToSession(session)';
const researchCall = 'this.research()';
const notebookUpdateCall = 'this._update()';
const switchProfileCall = 'this.switchProfile(profileToUse)';
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
const leftoverRefreshCall = '() => this.refresh())';
const leftoverDoSearchCall = '\t\tthis.doSearch(true);\n';
const leftoverAutoUpdateCall = '\t\t\tthis.autoUpdateExtensions();\n';
const leftoverCheckFileCall = 'this.checkForMcpConfigInFile(file, isRemote)';
const leftoverProfileCall = 'e => this.onDidChangeProfile()';
const executeCommandCall = 'this.executeCommand(command)';
const resolveCall = 'this.resolveEditorModel(resource, false /* do not create if missing */)';
const prepareXtermRawCall = 'this._prepareAddonLayout(xtermRaw)';
const loadMoreCall = 'this._loadMore()';
const updateBadgeCall = 'this.updateActivityBadge()';

const d866Calls: Array<[string, string, number]> = [
	[AGENT_SESSIONS_REL, updateCall, 5],
];

const d861AlreadyDouble: Array<[string, number]> = [
	[followupsCall, 2],
	[acceptMessageCall, 1],
	[acceptMsgCall, 1],
	[renderEditingCall, 3],
];

const d856AlreadyDouble: Array<[string, number]> = [
	[clearAllCall, 1],
	[exitFeedbackCall, 1],
	[revealCall, 1],
	[submitRejectionCall, 2],
	[submitApprovalActionCall, 1],
	[submitApprovalPrimaryCall, 1],
];

suite('leftover remaining unused agentSessionsControl leftover Promise fire-and-forget catch scan (D866)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused agentSessionsControl leftover async this.foo() FOF still had four or more legal unused leftover sites so this knife stayed', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d866Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			assertPromiseSignature(source, 'async update(): Promise<boolean> {');
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused agentSessionsControl legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!(seen.get(AGENT_SESSIONS_REL) ?? '').includes('D866'));
	});

	test('this knife covers five leftover Promise double-chain sites after leftover remaining unused stayed on agentSessionsControl', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d866Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(AGENT_SESSIONS_REL) ?? ''), 5);
	});

	test('agentSessionsControl leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		assertPromiseSignature(source, 'async update(): Promise<boolean> {');
		assertPromiseSignature(source, 'private async openAgentSession(e: IOpenEvent<AgentSessionListItem | undefined>): Promise<void> {');
		assertPromiseSignature(source, 'private async showContextMenu({ element, anchor, browserEvent }: ITreeContextMenuEvent<AgentSessionListItem>): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(source, updateCall);
		assert.strictEqual(countIncludes(source, `${updateCall}${doubleCatch}`), 5);
		assert.ok(!source.includes('\t\t\tthis.update();\n'));
		assert.ok(!source.includes('\t\t\t\tthis.update();\n'));
		assert.ok(!source.includes('\t\t\tthis.update();\n'));
		assert.ok(source.includes(leftoverOpenSessionCall));
		assert.ok(!source.includes(`this.openAgentSession(e)${doubleCatch}`));
		assert.ok(source.includes(leftoverContextMenuCall));
		assert.ok(!source.includes(`this.showContextMenu(e)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'async update(): Promise<boolean> {');
		assertPromiseSignature(planReview, 'private async submitApproval(action: IChatPlanApprovalAction): Promise<void> {');

		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('IOpenerService'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(!source.includes('registerAction2'));
		assert.ok(!source.includes('async run('));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(!source.includes('return this.update()'));
		assert.ok(!source.includes('await this.update()'));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D866'));
		assert.ok(planReview.includes(actionRunResolveCall));
		assert.ok(planReview.includes(`${submitApprovalActionCall}${doubleCatch}`));
		assert.ok(planReview.includes(actionRunResolveCall) && !planReview.includes(`return this.submitApproval(action)`));
	});

	test('locked leftover remaining stay leftover remaining unused; D861 already-double stay already-double; D585 leftover stay leftover; this knife did not overflow', () => {
		const source = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const debugEditor = fs.readFileSync(resolveSource(DEBUG_EDITOR_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(EXTENSIONS_WIDGETS_REL), 'utf8');
		const runtime = fs.readFileSync(resolveSource(EXTENSIONS_RUNTIME_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const bulkEdit = fs.readFileSync(resolveSource(BULK_EDIT_REL), 'utf8');
		const markers = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const notebookStatus = fs.readFileSync(resolveSource(NOTEBOOK_STATUS_REL), 'utf8');
		const scm = fs.readFileSync(resolveSource(SCM_REL), 'utf8');
		const remoteExplorer = fs.readFileSync(resolveSource(REMOTE_EXPLORER_REL), 'utf8');
		const statusbar = fs.readFileSync(resolveSource(STATUSBAR_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const mcpMigration = fs.readFileSync(resolveSource(MCP_MIGRATION_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const suggestContrib = fs.readFileSync(resolveSource(SUGGEST_CONTRIB_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const logs = fs.readFileSync(resolveSource(LOGS_REL), 'utf8');

		for (const [call, count] of d861AlreadyDouble) {
			assert.strictEqual(countIncludes(widget, `${call}${doubleCatch}`), count, `D861 already-double drifted: ${call}`);
		}
		assert.ok(widget.includes(leftoverHandoffAcceptCall));
		assert.ok(widget.includes(leftoverHandoffSendCall));
		assert.ok(!widget.includes(`this.acceptInput()${doubleCatch}`));

		assert.ok(source.includes(leftoverOpenSessionCall));
		assert.ok(!source.includes(`this.openAgentSession(e)${doubleCatch}`));
		assert.ok(source.includes(leftoverContextMenuCall));
		assert.ok(!source.includes(`this.showContextMenu(e)${doubleCatch}`));

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));

		assert.ok(gettingStarted.includes(leftoverScrollPrevCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepIdCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepToSelectCall));
		assert.ok(gettingStarted.includes(leftoverSelectStepUndefinedCall));
		assert.ok(gettingStarted.includes('\t\tthis.selectStep(selectedStep ?? toExpand.id, !selectedStep, preserveFocus);\n'));
		assert.ok(!gettingStarted.includes(`this.selectStep(id)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(toSelect)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(undefined)${doubleCatch}`));
		assert.ok(!gettingStarted.includes(`this.selectStep(selectedStep ?? toExpand.id, !selectedStep, preserveFocus)${doubleCatch}`));
		assert.strictEqual(countIncludes(gettingStarted, leftoverScrollPrevCall), 2);
		assert.ok(gettingStarted.includes(assignedInProgressScroll));
		assert.ok(!gettingStarted.includes(`${assignedInProgressScroll}${doubleCatch}`));
		assert.ok(gettingStartedContrib.includes(leftoverSelectStepLooseCall));
		assert.ok(!gettingStartedContrib.includes(`editorPane.selectStepLoose(stepID)${doubleCatch}`));

		assert.ok(textModel.includes(`${updateDiffSeqCall};`) || textModel.includes(`\t\t\tthis._updateDiffInfoSeq();\n`));
		assert.ok(!textModel.includes(`${updateDiffSeqCall}${doubleCatch}`));
		assert.ok(profileModel.includes(`${initializeCall};`));
		assert.ok(!profileModel.includes(`${initializeCall}${doubleCatch}`));

		assert.ok(searchEditor.includes(leftoverNoArgIncludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgExcludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgMessageCall));
		assert.ok(!searchEditor.includes(`this.triggerSearch()${doubleCatch}`));
		assert.ok(searchEditor.includes(`${delayCall}${doubleCatch}`));
		assert.ok(searchEditor.includes(`${resetCursorCall}${doubleCatch}`));
		assert.ok(searchEditor.includes(`${delayResetCall}${doubleCatch}`));

		assert.ok(searchWidget.includes(`${delayMultiplierCall}${doubleCatch}`));
		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(comments, `${refreshCall}${doubleCatch}`), 5);
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));
		assert.ok(debugEditor.includes(`this.toggleExceptionWidget()${doubleCatch}`));
		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.ok(unification.includes(`${notebookUpdateCall}${doubleCatch}`));
		assert.ok(mgmt.includes(`${switchProfileCall}${doubleCatch}`));
		assert.ok(notebookStatus.includes(`${notebookUpdateCall}${doubleCatch}`));
		assert.ok(scm.includes(`${loadMoreCall}${doubleCatch}`));
		assert.ok(remoteExplorer.includes(`${updateBadgeCall}${doubleCatch}`));
		assert.ok(statusbar.includes(`${executeCommandCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(statusbar, `${executeCommandCall}${doubleCatch}`), 4);
		assert.ok(files.includes(`${resolveCall}${doubleCatch}`));
		assert.ok(suggestContrib.includes(`${prepareXtermRawCall}${doubleCatch}`));

		assert.ok(viewlet.includes(leftoverRefreshCall));
		assert.ok(!viewlet.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(viewlet.includes(leftoverDoSearchCall));
		assert.ok(!viewlet.includes(`this.doSearch(true)${doubleCatch}`));
		assert.ok(workbench.includes(leftoverAutoUpdateCall));
		assert.ok(!workbench.includes(`this.autoUpdateExtensions()${doubleCatch}`));
		assert.ok(mcpMigration.includes(`${leftoverCheckFileCall};`));
		assert.ok(!mcpMigration.includes(`${leftoverCheckFileCall}${doubleCatch}`));
		assert.ok(mcpWorkbench.includes(`${leftoverProfileCall})`));
		assert.ok(!mcpWorkbench.includes(`${leftoverProfileCall}${doubleCatch}`));

		assert.ok(planReview.includes(leftoverEnterReviewCall));
		assert.ok(!planReview.includes(`void this.enterReviewMode()${doubleCatch}`));
		assert.ok(planReview.includes(leftoverSubmitFeedbackCall));
		assert.ok(!planReview.includes(`submitFeedback: () => this.submitFeedback()${doubleCatch}`));
		assert.ok(planReview.includes(returnedSubmitActionCall));
		assert.ok(!planReview.includes(`submitAction: action => this.submitApproval(action)${doubleCatch}`));
		assert.ok(planReview.includes(returnedRejectCall));
		assert.ok(!planReview.includes(`reject: () => this.submitRejection()${doubleCatch}`));
		assert.ok(planReview.includes(actionRunResolveCall));
		assert.strictEqual(countIncludes(planReview, `${markUsedCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(planReview, `${enterFeedbackCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(planReview, `${submitFeedbackVoidCall}${doubleCatch}`), 2);
		for (const [call, count] of d856AlreadyDouble) {
			assert.strictEqual(countIncludes(planReview, `${call}${doubleCatch}`), count, `D856 already-double drifted: ${call}`);
		}

		for (const [rel, file] of [
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[DEBUG_EDITOR_REL, debugEditor],
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[EXTENSIONS_WIDGETS_REL, widgets],
			[EXTENSIONS_RUNTIME_REL, runtime],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TEXT_MODEL_REL, textModel],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[FIND_MODEL_REL, findModel],
			[PROFILE_MODEL_REL, profileModel],
			[OUTPUT_REL, output],
			[BULK_EDIT_REL, bulkEdit],
			[MARKERS_REL, markers],
			[MCP_REL, mcp],
			[TASKS_REL, tasks],
			[NOTEBOOK_STATUS_REL, notebookStatus],
			[SCM_REL, scm],
			[REMOTE_EXPLORER_REL, remoteExplorer],
			[CHAT_WIDGET_REL, widget],
			[PLAN_REVIEW_REL, planReview],
			[STATUSBAR_REL, statusbar],
			[WORKBENCH_SVC_REL, workbench],
			[MCP_MIGRATION_REL, mcpMigration],
			[MCP_WORKBENCH_REL, mcpWorkbench],
			[FILES_REL, files],
			[SUGGEST_CONTRIB_REL, suggestContrib],
			[OUTLINE_REL, outline],
			[LOGS_REL, logs],
		] as const) {
			assert.ok(!file.includes('D866'), `${rel} should stay off this knife`);
		}
		assert.ok(!source.includes('D866'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatPlanReviewLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/outline/test/node/outlineLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/preferencesLeftoverPromiseCatchScanD866.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/logs/test/node/logsLeftoverPromiseCatchScanD866.test.ts')));
	});
});
