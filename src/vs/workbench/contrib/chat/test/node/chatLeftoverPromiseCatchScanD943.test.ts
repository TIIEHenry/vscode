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
const TIP_REL = 'src/vs/workbench/contrib/chat/browser/chatTipEligibilityTracker.ts';
const LOCAL_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/localAgentSessionsController.ts';
const SHARED_REL = 'src/vs/workbench/contrib/chat/browser/chat.shared.contribution.ts';
const RECS_REL = 'src/vs/workbench/contrib/chat/browser/claudePluginRecommendations.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const CHAT_ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const AI_EDITOR_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const EXTENSIONS_WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const MCP_WORKBENCH_REL = 'src/vs/workbench/services/mcp/browser/mcpWorkbenchManagementService.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const CONFIG_REL = 'src/vs/workbench/common/configuration.ts';
const TITLEBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts';
const LOG_REL = 'src/vs/workbench/services/log/common/defaultLogLevels.ts';
const VIEWS_SVC_REL = 'src/vs/workbench/services/views/browser/viewsService.ts';
const EXTERNAL_OPENER_REL = 'src/vs/workbench/contrib/externalUriOpener/common/externalUriOpenerService.ts';
const SEARCH_SVC_REL = 'src/vs/workbench/services/search/common/searchService.ts';
const ISSUE_REL = 'src/vs/workbench/contrib/issue/browser/issueFormService.ts';
const PROCESS_EXPLORER_REL = 'src/vs/workbench/contrib/processExplorer/browser/processExplorerControl.ts';
const EXP_REL = 'src/vs/workbench/contrib/chat/browser/expNotification/chatExpNotificationContribution.ts';

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

const checkPromptCall = 'this._checkForPromptFiles(tip)';
const tryUpdateCall = 'this.tryUpdateLiveSessionItem(model)';
const updateAssocCall = 'this._updateAssociations()';
const checkRecsCall = 'this._checkForRecommendedPlugins()';
const implicitCall = 'this.updateImplicitContext()';
const implicitWidgetCall = 'this.updateImplicitContext(widget)';
const mcpDetailCall = 'this.showEmbeddedMcpDetail(server)';
const pluginDetailCall = 'this.showPluginDetail(item)';
const embeddedPluginCall = 'this.showEmbeddedPluginDetail(item)';
const toolDetailCall = 'this.showEmbeddedToolDetail(extension)';
const openSkillCall = 'this.openSkillFromPluginDetail(uri)';
const openPromptsCall = 'this.openPromptsItemFromPluginDetail(AICustomizationManagementSection.Agents, uri)';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const registerListenersCall = 'this.registerListeners()';
const maybeDisableCall = 'this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === \'boolean\' ? EnablementState.DisabledWorkspace : EnablementState.DisabledGlobally)';
const maybeEnableCall = 'this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === \'boolean\' ? EnablementState.EnabledWorkspace : EnablementState.EnabledGlobally)';
const clearAllCall = 'this.clearAllInlineFeedback()';
const exitFeedbackCall = 'this.exitFeedbackMode()';
const revealCall = 'this.revealInlineComment(item)';
const submitRejectionCall = 'this.submitRejection()';
const submitApprovalActionCall = 'this.submitApproval(action)';
const submitApprovalPrimaryCall = 'this.submitApproval(primary)';
const followupsCall = 'this.renderFollowups()';
const acceptMessageCall = 'this.acceptInput(item.message)';
const acceptMsgCall = 'this.acceptInput(msg)';
const renderEditingCall = 'this.renderChatEditingSessionState()';
const agentUpdateCall = 'this.update()';
const leftoverOpenSessionCall = 'list.onDidOpen(e => this.openAgentSession(e))';
const leftoverContextMenuCall = 'list.onContextMenu(e => this.showContextMenu(e))';
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';
const leftoverHandoffAcceptCall = "this.acceptInput().catch(e => this.logService.error(`[Handoff] Failed to submit delegated handoff to '@${agentId}'`, e));";
const leftoverHandoffSendCall = "this.acceptInput().catch(e => this.logService.error(`[Handoff] Failed to submit handoff to '${handoff.agent}'`, e));";
const leftoverResolveCall = 'void this._resolve();';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
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
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const leftoverPinCall = 'this.pin(id, true)';
const leftoverDoOpenCall = 'this.doOpenPaneComposite(containerToOpen.id)';
const leftoverMigrateCall = 'this.migrateConfigurations(configurationMigrationRegistry.migrations)';
const leftoverCreateCall = 'this.create()';
const leftoverAlwaysOnTopCall = 'this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId)';
const leftoverArgvCall = 'this.onDidChangeArgv()';
const delayMultiplierCall = 'this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier)';
const delayCall = 'this.triggerSearch({ delay })';
const resetCursorCall = 'this.triggerSearch({ resetCursor: false })';
const delayResetCall = 'this.triggerSearch({ resetCursor: false, delay: triggeredOnType ? this.searchConfig.searchOnTypeDebouncePeriod : 0 })';
const refreshCall = 'this.refresh()';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
const launchCall = 'this.launchOrAttachToSession(session)';

const d943Calls: Array<[string, string, number]> = [
	[TIP_REL, checkPromptCall, 3],
	[LOCAL_REL, tryUpdateCall, 2],
	[SHARED_REL, updateAssocCall, 2],
	[RECS_REL, checkRecsCall, 1],
];

const d823AlreadyDouble: Array<[string, number]> = [
	[implicitCall, 7],
	[implicitWidgetCall, 1],
];

const d835AlreadyDouble: Array<[string, number]> = [
	[mcpDetailCall, 1],
	[pluginDetailCall, 1],
	[embeddedPluginCall, 1],
	[toolDetailCall, 1],
	[openSkillCall, 1],
	[openPromptsCall, 1],
];

const d840AlreadyDouble: Array<[string, number]> = [
	[checkInstallCall, 1],
	[registerListenersCall, 1],
	[maybeDisableCall, 1],
	[maybeEnableCall, 1],
];

const d856AlreadyDouble: Array<[string, number]> = [
	[clearAllCall, 1],
	[exitFeedbackCall, 1],
	[revealCall, 1],
	[submitRejectionCall, 2],
	[submitApprovalActionCall, 1],
	[submitApprovalPrimaryCall, 1],
];

const d861AlreadyDouble: Array<[string, number]> = [
	[followupsCall, 2],
	[acceptMessageCall, 1],
	[acceptMsgCall, 1],
	[renderEditingCall, 3],
];

suite('leftover remaining unused chat leftover Promise fire-and-forget catch scan (D943)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused chat leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d943Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused chat legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		for (const source of seen.values()) {
			assert.ok(!source.includes('D943'));
		}
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on chat this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d943Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(TIP_REL) ?? ''), 3);
		assert.strictEqual(countDoubleChains(seen.get(LOCAL_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(SHARED_REL) ?? ''), 5);
		assert.strictEqual(countDoubleChains(seen.get(RECS_REL) ?? ''), 1);
	});

	test('chat leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const tip = fs.readFileSync(resolveSource(TIP_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const recs = fs.readFileSync(resolveSource(RECS_REL), 'utf8');

		assertPromiseSignature(tip, 'private async _checkForPromptFiles(tip: ITipExclusionConfig): Promise<void> {');
		assertPromiseSignature(local, 'private async tryUpdateLiveSessionItem(model: IChatModel): Promise<void> {');
		assertPromiseSignature(shared, 'private async _updateAssociations(): Promise<void> {');
		assertPromiseSignature(recs, 'private async _checkForRecommendedPlugins(): Promise<void> {');

		assert.ok(tip.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(local.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(shared.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(recs.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(tip, checkPromptCall);
		assertWrapped(local, tryUpdateCall);
		assertWrapped(shared, updateAssocCall);
		assertWrapped(recs, checkRecsCall);
		assert.strictEqual(countIncludes(tip, `${checkPromptCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(local, `${tryUpdateCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(shared, `${updateAssocCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(recs, `${checkRecsCall}${doubleCatch}`), 1);
		assert.ok(!tip.includes('\t\t\tthis._checkForPromptFiles(tip);\n'));
		assert.ok(!tip.includes('\t\t\t\t\tthis._checkForPromptFiles(tip);\n'));
		assert.ok(!local.includes('\t\t\tthis.tryUpdateLiveSessionItem(model);\n'));
		assert.ok(!local.includes('\t\t\t\tthis.tryUpdateLiveSessionItem(model);\n'));
		assert.ok(!shared.includes('\t\tthis._updateAssociations();\n'));
		assert.ok(!shared.includes('\t\t\t\tthis._updateAssociations();\n'));
		assert.ok(!recs.includes('\t\t\t\tthis._checkForRecommendedPlugins();\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const tip = fs.readFileSync(resolveSource(TIP_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const recs = fs.readFileSync(resolveSource(RECS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(tip, 'private async _checkForPromptFiles(tip: ITipExclusionConfig): Promise<void> {');
		assertPromiseSignature(planReview, 'private async submitApproval(action: IChatPlanApprovalAction): Promise<void> {');

		for (const source of [tip, local, recs]) {
			assert.ok(!source.includes('openerService.open'));
			assert.ok(!source.includes('IOpenerService'));
			assert.ok(!source.includes('extends Action2'));
			assert.ok(!source.includes('registerAction2'));
			assert.ok(!source.includes('async run('));
			assert.ok(!source.includes('.then(undefined,'));
			assert.ok(!source.includes('return this._checkForPromptFiles'));
			assert.ok(!source.includes('return this.tryUpdateLiveSessionItem'));
			assert.ok(!source.includes('return this._checkForRecommendedPlugins'));
			assert.ok(!source.includes('await this._checkForPromptFiles'));
			assert.ok(!source.includes('await this.tryUpdateLiveSessionItem'));
			assert.ok(!source.includes('await this._checkForRecommendedPlugins'));
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D943'));
		}
		assert.ok(planReview.includes(`${submitApprovalActionCall}${doubleCatch}`));
		assert.ok(!planReview.includes('return this.submitApproval(action)'));
	});

	test('locked leftover remaining stay leftover remaining unused; D823/D825/D835/D840/D856/D861/D866 already-double stay already-double; this knife did not overflow', () => {
		const tip = fs.readFileSync(resolveSource(TIP_REL), 'utf8');
		const local = fs.readFileSync(resolveSource(LOCAL_REL), 'utf8');
		const shared = fs.readFileSync(resolveSource(SHARED_REL), 'utf8');
		const recs = fs.readFileSync(resolveSource(RECS_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(CHAT_ENTITLEMENT_REL), 'utf8');
		const aiEditor = fs.readFileSync(resolveSource(AI_EDITOR_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const control = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(EXTENSIONS_WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
		const exp = fs.readFileSync(resolveSource(EXP_REL), 'utf8');

		for (const [call, count] of d823AlreadyDouble) {
			assert.strictEqual(countIncludes(implicit, `${call}${doubleCatch}`), count, `D823 already-double drifted: ${call}`);
		}
		assert.ok(entitlement.includes(doubleCatch));
		assert.ok(!entitlement.includes('D943'));
		for (const [call, count] of d835AlreadyDouble) {
			assert.strictEqual(countIncludes(aiEditor, `${call}${doubleCatch}`), count, `D835 already-double drifted: ${call}`);
		}
		for (const [call, count] of d840AlreadyDouble) {
			assert.strictEqual(countIncludes(setup, `${call}${doubleCatch}`), count, `D840 already-double drifted: ${call}`);
		}
		for (const [call, count] of d856AlreadyDouble) {
			assert.strictEqual(countIncludes(planReview, `${call}${doubleCatch}`), count, `D856 already-double drifted: ${call}`);
		}
		for (const [call, count] of d861AlreadyDouble) {
			assert.strictEqual(countIncludes(widget, `${call}${doubleCatch}`), count, `D861 already-double drifted: ${call}`);
		}
		assert.strictEqual(countIncludes(control, `${agentUpdateCall}${doubleCatch}`), 5);
		assert.ok(control.includes(leftoverOpenSessionCall));
		assert.ok(!control.includes(`this.openAgentSession(e)${doubleCatch}`));
		assert.ok(control.includes(leftoverContextMenuCall));
		assert.ok(!control.includes(`this.showContextMenu(e)${doubleCatch}`));

		assert.ok(planReview.includes(leftoverEnterReviewCall));
		assert.ok(!planReview.includes(`void this.enterReviewMode()${doubleCatch}`));
		assert.ok(planReview.includes(leftoverSubmitFeedbackCall));
		assert.ok(!planReview.includes(`submitFeedback: () => this.submitFeedback()${doubleCatch}`));
		assert.ok(widget.includes(leftoverHandoffAcceptCall));
		assert.ok(widget.includes(leftoverHandoffSendCall));
		assert.ok(!widget.includes(`this.acceptInput()${doubleCatch}`));
		assert.ok(exp.includes(leftoverResolveCall));
		assert.ok(!exp.includes(`void this._resolve()${doubleCatch}`));

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
		assert.ok(!gettingStarted.includes(`this.selectStep(id)${doubleCatch}`));
		assert.ok(gettingStarted.includes(assignedInProgressScroll));
		assert.ok(!gettingStarted.includes(`${assignedInProgressScroll}${doubleCatch}`));
		assert.ok(gettingStartedContrib.includes(leftoverSelectStepLooseCall));
		assert.ok(!gettingStartedContrib.includes(`editorPane.selectStepLoose(stepID)${doubleCatch}`));
		assert.ok(textModel.includes(`${updateDiffSeqCall};`) || textModel.includes('\t\t\tthis._updateDiffInfoSeq();\n'));
		assert.ok(!textModel.includes(`${updateDiffSeqCall}${doubleCatch}`));
		assert.ok(profileModel.includes(`${initializeCall};`));
		assert.ok(!profileModel.includes(`${initializeCall}${doubleCatch}`));
		assert.ok(themes.includes(leftoverTriggerCall));
		assert.ok(!themes.includes(`this.trigger(value)${doubleCatch}`));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(!themes.includes(`this.setTheme(newTheme, applyTheme ? 'auto' : 'preview')${doubleCatch}`));

		assert.ok(compositeBar.includes(`${leftoverPinCall}${doubleCatch}`));
		assert.ok(panePart.includes(`${leftoverDoOpenCall}${doubleCatch}`));
		assert.ok(configuration.includes(`${leftoverMigrateCall}${doubleCatch}`));
		assert.ok(configuration.includes(`${leftoverCreateCall}${doubleCatch}`));
		assert.ok(titlebar.includes(`${leftoverAlwaysOnTopCall}${doubleCatch}`));
		assert.ok(logLevels.includes(`${leftoverArgvCall}${doubleCatch}`));

		assert.ok(searchEditor.includes(leftoverNoArgIncludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgExcludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgMessageCall));
		assert.ok(!searchEditor.includes(`this.triggerSearch()${doubleCatch}`));
		assert.ok(searchEditor.includes(`${delayCall}${doubleCatch}`));
		assert.ok(searchEditor.includes(`${resetCursorCall}${doubleCatch}`));
		assert.ok(searchEditor.includes(`${delayResetCall}${doubleCatch}`));
		assert.ok(searchWidget.includes(`${delayMultiplierCall}${doubleCatch}`));
		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));

		for (const [rel, file] of [
			[IMPLICIT_REL, implicit],
			[CHAT_ENTITLEMENT_REL, entitlement],
			[AI_EDITOR_REL, aiEditor],
			[SETUP_REL, setup],
			[PLAN_REVIEW_REL, planReview],
			[CHAT_WIDGET_REL, widget],
			[AGENT_SESSIONS_REL, control],
			[TEXT_MODEL_REL, textModel],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[TESTING_REL, testing],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[VIEWLET_REL, viewlet],
			[EXTENSIONS_WIDGETS_REL, widgets],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[PROFILE_MODEL_REL, profileModel],
			[THEMES_REL, themes],
			[TASKS_REL, tasks],
			[MCP_WORKBENCH_REL, mcpWorkbench],
			[COMPOSITE_BAR_REL, compositeBar],
			[PANE_PART_REL, panePart],
			[CONFIG_REL, configuration],
			[TITLEBAR_REL, titlebar],
			[LOG_REL, logLevels],
			[EXP_REL, exp],
		] as const) {
			assert.ok(!file.includes('D943'), `${rel} should stay off this knife`);
		}
		assert.ok(!tip.includes('D943'));
		assert.ok(!local.includes('D943'));
		assert.ok(!shared.includes('D943'));
		assert.ok(!recs.includes('D943'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD943.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused views / externalUriOpener / services/search / issue / processExplorer leftover remaining unused', () => {
		const views = fs.readFileSync(resolveSource(VIEWS_SVC_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(EXTERNAL_OPENER_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_SVC_REL), 'utf8');
		const issue = fs.readFileSync(resolveSource(ISSUE_REL), 'utf8');
		const processExplorer = fs.readFileSync(resolveSource(PROCESS_EXPLORER_REL), 'utf8');
		assert.ok(!views.includes('D943'));
		assert.ok(!opener.includes('D943'));
		assert.ok(!search.includes('D943'));
		assert.ok(!issue.includes('D943'));
		assert.ok(!processExplorer.includes('D943'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/views/test/node/viewsLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/externalUriOpener/test/node/externalUriOpenerLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/search/test/node/searchLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/issue/test/node/issueLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/processExplorer/test/node/processExplorerLeftoverPromiseCatchScanD943.test.ts')));
	});
});
