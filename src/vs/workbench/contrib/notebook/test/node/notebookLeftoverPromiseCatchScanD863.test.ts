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
const INLINE_DIFF_REL = 'src/vs/workbench/contrib/notebook/browser/diff/inlineDiff/notebookInlineDiff.ts';
const CELL_MODEL_REL = 'src/vs/workbench/contrib/notebook/common/model/notebookCellTextModel.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/notebook/browser/notebook.contribution.ts';
const STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';
const CONTEXT_KEYS_REL = 'src/vs/workbench/contrib/notebook/browser/viewParts/notebookEditorWidgetContextKeys.ts';
const CELL_COMMENTS_REL = 'src/vs/workbench/contrib/notebook/browser/view/cellParts/cellComments.ts';
const PAUSING_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/debug/notebookCellPausing.ts';
const DIFF_COMPONENTS_REL = 'src/vs/workbench/contrib/notebook/browser/diff/diffComponents.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const DEBUG_EDITOR_REL = 'src/vs/workbench/contrib/debug/browser/debugEditorContribution.ts';
const UNIFICATION_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const AICUSTOM_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const CONFIGURATION_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const EDITING_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedNotebookEntry.ts';
const TEXTMODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const BULK_EDIT_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const SCM_HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const CHAT_BROWSER_REL = 'src/vs/workbench/contrib/chat/browser/chat.contribution.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const TERMINAL_INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
const EXTENSIONS_CONTRIB_REL = 'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts';
const ABSTRACT_REL = 'src/vs/workbench/contrib/extensions/browser/abstractRuntimeExtensionsEditor.ts';
const ELECTRON_RUNTIME_REL = 'src/vs/workbench/contrib/extensions/electron-browser/runtimeExtensionsEditor.ts';
const REMOTE_INIT_REL = 'src/vs/workbench/contrib/extensions/electron-browser/remoteExtensionsInit.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts';

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

const updateCall = 'this._update()';
const autoDetectCall = 'this.autoDetectLanguage()';
const installHandlerCall = 'this._installHandler()';
const leftoverDoAutoDetectCall = 'this.autoDetectLanguageThrottler.trigger(() => this._doAutoDetectLanguage());';
const leftoverInstallExtCall = '\t\tthis._updateForInstalledExtension();\n';
const leftoverCellInitCall = '\t\tthis.initialize(element);\n';
const leftoverPausingCall = '\t\t\tthis.onDidChangeCallStack(true);\n';
const leftoverSchedulerPausingCall = '() => this.onDidChangeCallStack(false)';
const leftoverInitSourceCall = '\t\t\tthis._initializeSourceDiffEditor();\n';
const leftoverSyncInitializeCall = '\t\t\t\t\tthis.initialize();\n';
const leftoverArrowInitializeCall = '() => this.initialize())';
const leftoverRefreshCall = '() => this.refresh())';
const leftoverDoSearchCall = '\t\tthis.doSearch(true);\n';
const leftoverAutoUpdateCall = '\t\t\tthis.autoUpdateExtensions();\n';
const leftoverInstallLocalCall = '\t\tthis.installExtensionsIfInstalledLocallyInRemote();\n';
const leftoverInstallFailedCall = '\t\tthis.installFailedRemoteExtensions();\n';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const leftoverAgentUpdateCall = '\t\t\tthis.update();\n';
const leftoverChatRenderCall = 'this.renderChatEditingSessionState().catch(onUnexpectedError).catch(onUnexpectedError); // this is necessary to make sure we dispose previous buttons, etc.';
const leftoverHandleDelegationCall = 'this.handleDelegationExitIfNeeded(this._lockedAgent, sent.data.agent);';
const leftoverTerminalUnicodeCall = '\t\t\t\tthis._updateUnicodeVersion();\n';
const statusCall = 'this.updateExtensionGalleryStatusContexts()';
const galleryCall = 'this.updateGalleryCapabilitiesContexts(extensionGalleryManifest)';
const updateExtCall = 'this._updateExtensions()';
const initCall = 'this.initializeRemoteExtensions()';
const enabledAutoCheckCall = 'this.checkForUpdates(`Enabled auto check updates`)';
const autoUpdateCall = 'this.autoUpdateBuiltinExtensions()';
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
const researchCall = 'this.research()';
const launchCall = 'this.launchOrAttachToSession(session)';
const showErrorCall = 'this.showError(err.message, undefined, !!launch?.getConfiguration(config.name))';
const toggleCall = 'this.toggleExceptionWidget()';
const submitCall = 'this.submitSearch()';
const refreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';

const d863Calls: Array<[string, string, number]> = [
	[INLINE_DIFF_REL, updateCall, 5],
	[CELL_MODEL_REL, autoDetectCall, 2],
	[CONTRIB_REL, installHandlerCall, 1],
];

suite('leftover remaining unused after D844/D855 leftover remaining unused notebook leftover remaining unused Promise fire-and-forget catch scan (D863)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D844 research already-double and D855 _update already-double still had four or more legal unused leftover sites so this knife stayed on notebook leftover remaining unused', () => {
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const inlineDiff = fs.readFileSync(resolveSource(INLINE_DIFF_REL), 'utf8');
		const cellModel = fs.readFileSync(resolveSource(CELL_MODEL_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');

		assertPromiseSignature(findModel, 'async research() {');
		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(findModel, `${researchCall}${doubleCatch}`), 4);
		assertPromiseSignature(status, 'private async _update() {');
		assert.ok(status.includes(`${updateCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(status, `${updateCall}${doubleCatch}`), 8);

		assertPromiseSignature(inlineDiff, 'private async _update() {');
		assertPromiseSignature(cellModel, 'async autoDetectLanguage(): Promise<void> {');
		assertPromiseSignature(contrib, 'private async _installHandler(): Promise<void> {');

		let sites = 0;
		for (const [rel, call, count] of d863Calls) {
			const source = rel === INLINE_DIFF_REL ? inlineDiff
				: rel === CELL_MODEL_REL ? cellModel
					: contrib;
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused notebook legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!findModel.includes('D863'));
		assert.ok(!status.includes('D863'));
		assert.ok(!inlineDiff.includes('D863'));
		assert.ok(!cellModel.includes('D863'));
		assert.ok(!contrib.includes('D863'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on notebook leftover remaining unused this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d863Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(INLINE_DIFF_REL) ?? ''), 5);
		assert.strictEqual(countDoubleChains(seen.get(CELL_MODEL_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(CONTRIB_REL) ?? ''), 1);
	});

	test('notebook leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const inlineDiff = fs.readFileSync(resolveSource(INLINE_DIFF_REL), 'utf8');
		const cellModel = fs.readFileSync(resolveSource(CELL_MODEL_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');

		assertPromiseSignature(inlineDiff, 'private async _update() {');
		assertPromiseSignature(cellModel, 'async autoDetectLanguage(): Promise<void> {');
		assertPromiseSignature(contrib, 'private async _installHandler(): Promise<void> {');
		assert.ok(inlineDiff.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(cellModel.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(inlineDiff, updateCall);
		assertWrapped(cellModel, autoDetectCall);
		assertWrapped(contrib, installHandlerCall);
		assert.strictEqual(countIncludes(inlineDiff, `${updateCall}${doubleCatch}`), 5);
		assert.strictEqual(countIncludes(cellModel, `${autoDetectCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(contrib, `${installHandlerCall}${doubleCatch}`), 1);
		assert.ok(!inlineDiff.includes('\t\tthis._update();\n'));
		assert.ok(!inlineDiff.includes('() => this._update())'));
		assert.ok(!inlineDiff.includes('() => this._update(),'));
		assert.ok(!cellModel.includes('\t\tthis.autoDetectLanguage();\n'));
		assert.ok(!cellModel.includes('\t\t\tthis.autoDetectLanguage();\n'));
		assert.ok(!contrib.includes('\t\tthis._installHandler();\n'));
		assert.ok(cellModel.includes(leftoverDoAutoDetectCall));
		assert.ok(!cellModel.includes(`this._doAutoDetectLanguage()${doubleCatch}`));
		assert.ok(inlineDiff.includes(leftoverSyncInitializeCall));
		assert.ok(inlineDiff.includes(leftoverArrowInitializeCall));
		assert.ok(!inlineDiff.includes(`this.initialize()${doubleCatch}`));
		assert.ok(!inlineDiff.includes(`await ${updateCall}${doubleCatch}`));
		assert.ok(!cellModel.includes(`await ${autoDetectCall}${doubleCatch}`));
		assert.ok(!contrib.includes(`await ${installHandlerCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const inlineDiff = fs.readFileSync(resolveSource(INLINE_DIFF_REL), 'utf8');
		const cellModel = fs.readFileSync(resolveSource(CELL_MODEL_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(inlineDiff, 'private async _update() {');

		assert.ok(!inlineDiff.includes('openerService.open'));
		assert.ok(!inlineDiff.includes('IOpenerService'));
		assert.ok(!inlineDiff.includes('extends Action2'));
		assert.ok(!inlineDiff.includes('async run('));
		assert.ok(!cellModel.includes('openerService.open'));
		assert.ok(!cellModel.includes('extends Action2'));
		assert.ok(contrib.includes('registerAction2') || contrib.includes('WorkbenchPhase') || contrib.includes('IWorkbenchContribution'));
		assert.ok(!contrib.includes(`async run(accessor: ServicesAccessor): Promise<any> {${doubleCatch}`));
		assert.ok(!inlineDiff.includes('return this._update()'));
		assert.ok(!inlineDiff.includes('await this._update()'));
		assert.ok(!cellModel.includes('return this.autoDetectLanguage()'));
		assert.ok(!cellModel.includes('await this.autoDetectLanguage()'));
		assert.ok(!contrib.includes('return this._installHandler()'));
		assert.ok(!contrib.includes('await this._installHandler()'));
		assert.ok(!inlineDiff.includes('.then(undefined,'));
		assert.ok(!cellModel.includes('.then(undefined,'));
		assert.ok(actions.includes("run: () => this.openerService.open(downloadUrl).then(() => {"));
		assert.ok(!actions.includes(`this.openerService.open(downloadUrl)${doubleCatch}`));

		for (const source of [inlineDiff, cellModel, contrib, actions]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D863'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D815/D819/D844/D847/D843/D841/D839/D840/D855/D858 already-double stay already-double; this knife did not overflow into sibling leftover modules', () => {
		const inlineDiff = fs.readFileSync(resolveSource(INLINE_DIFF_REL), 'utf8');
		const cellModel = fs.readFileSync(resolveSource(CELL_MODEL_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const contextKeys = fs.readFileSync(resolveSource(CONTEXT_KEYS_REL), 'utf8');
		const cellComments = fs.readFileSync(resolveSource(CELL_COMMENTS_REL), 'utf8');
		const pausing = fs.readFileSync(resolveSource(PAUSING_REL), 'utf8');
		const diffComponents = fs.readFileSync(resolveSource(DIFF_COMPONENTS_REL), 'utf8');
		const extensionsContrib = fs.readFileSync(resolveSource(EXTENSIONS_CONTRIB_REL), 'utf8');
		const abstractRuntime = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const electronRuntime = fs.readFileSync(resolveSource(ELECTRON_RUNTIME_REL), 'utf8');
		const remoteInit = fs.readFileSync(resolveSource(REMOTE_INIT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const findingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXTMODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const debugEditor = fs.readFileSync(resolveSource(DEBUG_EDITOR_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const aicustom = fs.readFileSync(resolveSource(AICUSTOM_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIGURATION_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(ENTITLEMENT_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const markers = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		const bulkEdit = fs.readFileSync(resolveSource(BULK_EDIT_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const scmHistory = fs.readFileSync(resolveSource(SCM_HISTORY_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		const chatBrowser = fs.readFileSync(resolveSource(CHAT_BROWSER_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const agentSessions = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const terminalInstance = fs.readFileSync(resolveSource(TERMINAL_INSTANCE_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));

		assert.ok(findingStarted.includes(leftoverScrollPrevCall));
		assert.ok(findingStarted.includes(leftoverSelectStepIdCall));
		assert.ok(findingStarted.includes(leftoverSelectStepToSelectCall));
		assert.ok(findingStarted.includes(leftoverSelectStepUndefinedCall));
		assert.ok(!findingStarted.includes(`this.selectStep(id)${doubleCatch}`));
		assert.ok(!findingStarted.includes(`this.selectStep(toSelect)${doubleCatch}`));
		assert.ok(!findingStarted.includes(`this.selectStep(undefined)${doubleCatch}`));
		assert.ok(findingStarted.includes(assignedInProgressScroll));
		assert.ok(!findingStarted.includes(`${assignedInProgressScroll}${doubleCatch}`));
		assert.ok(gettingStartedContrib.includes(leftoverSelectStepLooseCall));
		assert.ok(!gettingStartedContrib.includes(`editorPane.selectStepLoose(stepID)${doubleCatch}`));

		assert.ok(textModel.includes(`${updateDiffSeqCall};`) || textModel.includes('\t\t\tthis._updateDiffInfoSeq();\n'));
		assert.ok(!textModel.includes(`${updateDiffSeqCall}${doubleCatch}`));
		assert.ok(profileModel.includes(`${initializeCall};`));
		assert.ok(!profileModel.includes(`${initializeCall}${doubleCatch}`));

		assert.ok(workbench.includes(`${enabledAutoCheckCall}${doubleCatch}`));
		assert.ok(workbench.includes(`${autoUpdateCall}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(workbench), 13);
		assert.strictEqual(countDoubleChains(viewlet), 2);
		assert.strictEqual(countDoubleChains(widgets), 1);
		assert.ok(viewlet.includes(leftoverRefreshCall));
		assert.ok(!viewlet.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(viewlet.includes(leftoverDoSearchCall));
		assert.ok(!viewlet.includes(`this.doSearch(true)${doubleCatch}`));
		assert.ok(workbench.includes(leftoverAutoUpdateCall));
		assert.ok(!workbench.includes(`this.autoUpdateExtensions()${doubleCatch}`));
		assert.ok(extensionsContrib.includes(`${statusCall}${doubleCatch}`));
		assert.ok(extensionsContrib.includes(`${galleryCall}${doubleCatch}`));
		assert.ok(abstractRuntime.includes(`${updateExtCall}${doubleCatch}`));
		assert.ok(electronRuntime.includes(`${updateExtCall}${doubleCatch}`));
		assert.ok(remoteInit.includes(`${initCall}${doubleCatch}`));
		assert.ok(remoteInit.includes(leftoverInstallLocalCall));
		assert.ok(!remoteInit.includes(`this.installExtensionsIfInstalledLocallyInRemote()${doubleCatch}`));
		assert.ok(remoteInit.includes(leftoverInstallFailedCall));
		assert.ok(!remoteInit.includes(`this.installFailedRemoteExtensions()${doubleCatch}`));

		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.ok(status.includes(`${updateCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(status, `${updateCall}${doubleCatch}`), 8);
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${showErrorCall}${doubleCatch}`));
		assert.ok(debugEditor.includes(`${toggleCall}${doubleCatch}`));
		assert.ok(searchWidget.includes(`${submitCall}${doubleCatch}`));
		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));
		assert.ok(editing.includes(`this.initializeModelsFromDiff()${doubleCatch}`));
		assert.ok(aicustom.includes(`this.showEmbeddedMcpDetail(server)${doubleCatch}`) || aicustom.includes(`this.showPluginDetail(item)${doubleCatch}`));
		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(configuration.includes(`this.updateCache()${doubleCatch}`));
		assert.ok(implicit.includes(`this.updateImplicitContext()${doubleCatch}`));
		assert.ok(entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(enablement.includes(`this._enableExtension(extension.identifier)${doubleCatch}`));
		assert.ok(account.includes(`this._updatePolicyDefinitions(this.policyDefinitions)${doubleCatch}`) || account.includes(doubleCatch));

		assert.ok(contextKeys.includes(leftoverInstallExtCall));
		assert.ok(!contextKeys.includes(`this._updateForInstalledExtension()${doubleCatch}`));
		assert.ok(cellComments.includes(leftoverCellInitCall));
		assert.ok(!cellComments.includes(`this.initialize(element)${doubleCatch}`));
		assert.ok(pausing.includes(leftoverPausingCall));
		assert.ok(pausing.includes(leftoverSchedulerPausingCall));
		assert.ok(!pausing.includes(`this.onDidChangeCallStack(true)${doubleCatch}`));
		assert.ok(!pausing.includes(`this.onDidChangeCallStack(false)${doubleCatch}`));
		assert.ok(diffComponents.includes(leftoverInitSourceCall));
		assert.ok(!diffComponents.includes(`this._initializeSourceDiffEditor()${doubleCatch}`));
		assert.ok(searchEditor.includes(leftoverNoArgIncludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgExcludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgMessageCall));
		assert.ok(!searchEditor.includes(`this.triggerSearch()${doubleCatch}`));
		assert.ok(agentSessions.includes(leftoverAgentUpdateCall));
		assert.ok(!agentSessions.includes(`this.update()${doubleCatch}`));
		assert.ok(chatWidget.includes(leftoverChatRenderCall));
		assert.ok(chatWidget.includes(leftoverHandleDelegationCall));
		assert.ok(!chatWidget.includes(`this.handleDelegationExitIfNeeded(this._lockedAgent, sent.data.agent)${doubleCatch}`));
		assert.ok(terminalInstance.includes(leftoverTerminalUnicodeCall));
		assert.ok(!terminalInstance.includes(`this._updateUnicodeVersion()${doubleCatch}`));
		assert.ok(planReview.includes('this.clearAllInlineFeedback()') || planReview.includes(doubleCatch));

		for (const [rel, file] of [
			[FIND_MODEL_REL, findModel],
			[STATUS_REL, status],
			[CONTEXT_KEYS_REL, contextKeys],
			[CELL_COMMENTS_REL, cellComments],
			[PAUSING_REL, pausing],
			[DIFF_COMPONENTS_REL, diffComponents],
			[GETTING_STARTED_REL, findingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[WORKBENCH_SVC_REL, workbench],
			[EXTENSIONS_CONTRIB_REL, extensionsContrib],
			[ABSTRACT_REL, abstractRuntime],
			[ELECTRON_RUNTIME_REL, electronRuntime],
			[REMOTE_INIT_REL, remoteInit],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TEXTMODEL_REL, textModel],
			[PROFILE_MODEL_REL, profileModel],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[DEBUG_EDITOR_REL, debugEditor],
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[TASKS_REL, tasks],
			[EDITING_REL, editing],
			[AICUSTOM_REL, aicustom],
			[MCP_DISCOVERY_REL, discovery],
			[CONFIGURATION_REL, configuration],
			[IMPLICIT_REL, implicit],
			[ENTITLEMENT_REL, entitlement],
			[ENABLEMENT_REL, enablement],
			[ACCOUNT_REL, account],
			[TESTING_REL, testing],
			[MARKERS_REL, markers],
			[BULK_EDIT_REL, bulkEdit],
			[OUTLINE_REL, outline],
			[FILES_REL, files],
			[SCM_HISTORY_REL, scmHistory],
			[EXPLORER_REL, explorer],
			[CHAT_BROWSER_REL, chatBrowser],
			[CHAT_WIDGET_REL, chatWidget],
			[AGENT_SESSIONS_REL, agentSessions],
			[TERMINAL_INSTANCE_REL, terminalInstance],
			[PLAN_REVIEW_REL, planReview],
		] as const) {
			assert.ok(!file.includes('D863'), `${rel} should stay off this knife`);
		}
		assert.ok(!inlineDiff.includes('D863'));
		assert.ok(!cellModel.includes('D863'));
		assert.ok(!contrib.includes('D863'));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD855.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD844.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/outline/test/node/outlineLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatWidgetLeftoverPromiseCatchScanD863.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD863.test.ts')));
	});
});
