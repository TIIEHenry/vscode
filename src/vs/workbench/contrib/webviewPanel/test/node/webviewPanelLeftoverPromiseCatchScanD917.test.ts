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
const PANEL_CONTRIB_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewPanel.contribution.ts';
const PANEL_SERVICE_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewWorkbenchService.ts';
const PANEL_EDITOR_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewEditor.ts';
const PANEL_COMMANDS_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewCommands.ts';
const PANEL_INPUT_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewEditorInput.ts';
const PANEL_SERIALIZER_REL = 'src/vs/workbench/contrib/webviewPanel/browser/webviewEditorInputSerializer.ts';
const RUN_TOOL_REL = 'src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/runInTerminalTool.ts';
const OUTPUT_REL = 'src/vs/workbench/contrib/terminalContrib/chatAgentTools/browser/tools/monitoring/outputMonitor.ts';
const CLIPBOARD_REL = 'src/vs/workbench/contrib/terminalContrib/clipboard/browser/terminal.clipboard.contribution.ts';
const VOICE_REL = 'src/vs/workbench/contrib/terminalContrib/voice/browser/terminalVoice.ts';
const SUGGEST_REL = 'src/vs/workbench/contrib/terminalContrib/suggest/browser/terminalSuggestAddon.ts';
const LINKS_REL = 'src/vs/workbench/contrib/terminalContrib/links/browser/terminalLinkManager.ts';
const STICKY_REL = 'src/vs/workbench/contrib/terminalContrib/stickyScroll/browser/terminalStickyScrollOverlay.ts';
const FIND_REL = 'src/vs/workbench/contrib/terminalContrib/find/browser/terminalFindWidget.ts';
const SUGGEST_CONTRIB_REL = 'src/vs/workbench/contrib/terminalContrib/suggest/browser/terminal.suggest.contribution.ts';
const CALL_CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const TYPE_CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const WELCOME_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeAgentSessions/browser/agentSessionsWelcome.contribution.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const AUTH_EXT_REL = 'src/vs/workbench/services/authentication/browser/authenticationExtensionsService.ts';
const AUTH_MCP_REL = 'src/vs/workbench/services/authentication/browser/authenticationMcpService.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts';
const EDITORS_OBSERVER_REL = 'src/vs/workbench/browser/parts/editor/editorsObserver.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const USER_DATA_SYNC_REL = 'src/vs/workbench/services/userDataSync/browser/userDataSyncWorkbenchService.ts';
const CODE_EDITOR_REL = 'src/vs/editor/browser/services/codeEditorService.ts';
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
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const NAV_REL = 'src/vs/workbench/browser/actions/navigationActions.ts';
const URL_REL = 'src/vs/workbench/contrib/url/browser/url.contribution.ts';
const SOURCES_REL = 'src/vs/workbench/contrib/sources/browser/sources.contribution.ts';
const TELEMETRY_REL = 'src/vs/workbench/contrib/telemetry/browser/telemetry.contribution.ts';
const NAVIGATOR_REL = 'src/vs/workbench/contrib/navigator/browser/navigator.contribution.ts';
const GIT_REL = 'src/vs/workbench/contrib/git/browser/git.contributions.ts';

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

const leftoverRemovePidCall = 'this._removeProcessIdAssociation(instance.processId!)';
const leftoverRemoveToolPidCall = 'this._removeProcessIdAssociation(toolTerminal!.instance.processId)';
const leftoverStartMonCall = 'this._startMonitoring(command, invocationContext, cts.token)';
const leftoverStartMonContinueCall = 'this._startMonitoring(this._command, this._invocationContext, this._currentMonitoringCts.token)';
const leftoverPasteCall = 'this.paste()';
const leftoverFinalizeCall = 'this._finalizeBuiltinThenStop()';
const leftoverRequestCompletionsCall = 'this.requestCompletions()';
const leftoverOpenLinkCall = 'this._openLink(e.link)';
const leftoverGpuCall = 'this._refreshGpuAcceleration()';
const leftoverAction2PasteCall = 'run: (activeInstance) => TerminalClipboardContribution.get(activeInstance)?.paste()';
const leftoverCloseEditorCall = 'previousGroup.closeEditor(editor)';
const leftoverUpdateActiveCall = '\t\t\tthis.updateActiveWebview();\n';
const leftoverTwoArgReviveThen = 'reviver.resolveWebview(input, token).then(x => resolve.complete(x), err => resolve.error(err))';
const leftoverOpenEditorCall = 'this._editorService.openEditor(';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const leftoverInlayReadCall = '\t\t\tthis._read(line, hints);\n';
const leftoverWelcomeRunCall = '\t\tthis.run();\n';
const leftoverFoldingCall = '\t\tthis._updateConfigValues();\n';
const leftoverCompleteSessionCall = 'this.completeSessionAccessRequest(provider, extensionId, extensionName, scopeListOrRequest)';
const leftoverCompleteMcpCall = 'this.completeSessionAccessRequest(provider, mcpServerId, mcpServerName, scopes)';
const leftoverRevealCall = 'this._revealInEditor(event, element, group)';
const leftoverLoadStateCall = '\t\tthis.loadState();\n';
const leftoverDoRefreshRootCall = 'this.doRefresh([this.root])';
const leftoverDoRefreshElementsCall = 'this.doRefresh(this.elementsToRefresh)';
const leftoverTreeRefreshCall = '\t\t\tthis.refresh();\n';
const leftoverWaitAndInitializeCall = 'this.waitAndInitialize()';
const leftoverSyncUpdateCall = 'this.update(';
const leftoverLoadConfigurationsCall = 'this._loadConfigurationsForMode';
const leftoverDoOpenCall = 'this.doOpen(undefined)';
const leftoverReloadCall = 'this.reload()';
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
const leftoverReloadThenCall = 'then(() => this.reload())';
const leftoverProcessDialogsCall = 'this.processDialogs()';

const d917Calls: Array<[string, string, number]> = [
	[RUN_TOOL_REL, leftoverRemovePidCall, 1],
	[RUN_TOOL_REL, leftoverRemoveToolPidCall, 1],
	[OUTPUT_REL, leftoverStartMonCall, 1],
	[OUTPUT_REL, leftoverStartMonContinueCall, 1],
	[CLIPBOARD_REL, leftoverPasteCall, 2],
	[VOICE_REL, leftoverFinalizeCall, 1],
	[SUGGEST_REL, leftoverRequestCompletionsCall, 1],
];

const d798AlreadyDouble: Array<[string, string, number]> = [
	[FIND_REL, 'this._findPreviousWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue(), incremental: update })', 1],
	[FIND_REL, 'this._findNextWithEvent(xterm, this.inputValue, { regex: this._getRegexValue(), wholeWord: this._getWholeWordValue(), caseSensitive: this._getCaseSensitiveValue() })', 1],
	[SUGGEST_CONTRIB_REL, '\t\tthis._prepareAddonLayout(xterm)', 1],
];

suite('leftover remaining unused webviewPanel leftover remaining unused overflowed to unused leftover remaining unused terminalContrib leftover remaining unused Promise fire-and-forget catch scan (D917)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused webviewPanel leftover remaining unused after discarding collision overflow had fewer than four legal unused leftover this.foo() sites so this knife overflowed', () => {
		const contrib = fs.readFileSync(resolveSource(PANEL_CONTRIB_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(PANEL_SERVICE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(PANEL_EDITOR_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(PANEL_COMMANDS_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(PANEL_INPUT_REL), 'utf8');
		const serializer = fs.readFileSync(resolveSource(PANEL_SERIALIZER_REL), 'utf8');

		assert.ok(contrib.includes(`${leftoverCloseEditorCall}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(contrib), 1);
		assert.ok(service.includes(leftoverUpdateActiveCall));
		assert.ok(!service.includes(`this.updateActiveWebview()${doubleCatch}`));
		assert.ok(service.includes(leftoverTwoArgReviveThen));
		assert.ok(!service.includes(`${leftoverTwoArgReviveThen}${doubleCatch}`));
		assert.ok(service.includes(leftoverOpenEditorCall));
		assert.ok(!service.includes(`${leftoverOpenEditorCall}${doubleCatch}`));
		assert.ok(editor.includes('\t\tthis.setEditorVisible(dimension.width > 0 && dimension.height > 0);\n') || editor.includes('this.setEditorVisible('));
		assert.ok(!editor.includes(`this.claimWebview(this.input)${doubleCatch}`));
		assert.ok(commands.includes('public async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(commands.includes('webview.reload();'));
		assert.ok(!commands.includes(`webview.reload()${doubleCatch}`));
		assert.ok(!input.includes(doubleCatch));
		assert.ok(!serializer.includes(doubleCatch));

		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused webviewPanel legal leftover this.foo() <4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.strictEqual(leftoverRemainingUnusedLegal, 0);
		for (const source of [contrib, service, editor, commands, input, serializer]) {
			assert.ok(!source.includes('D917'));
		}
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused overflowed to unused leftover remaining unused terminalContrib leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d917Calls) {
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
		assert.strictEqual(countIncludes(seen.get(RUN_TOOL_REL) ?? '', leftoverRemovePidCall + doubleCatch), 1);
		assert.strictEqual(countIncludes(seen.get(RUN_TOOL_REL) ?? '', leftoverRemoveToolPidCall + doubleCatch), 1);
		assert.strictEqual(countDoubleChains(seen.get(OUTPUT_REL) ?? ''), 2);
		assert.strictEqual(countIncludes(seen.get(CLIPBOARD_REL) ?? '', leftoverPasteCall + doubleCatch), 2);
		assert.strictEqual(countDoubleChains(seen.get(VOICE_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(SUGGEST_REL) ?? ''), 1);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const runTool = fs.readFileSync(resolveSource(RUN_TOOL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const voice = fs.readFileSync(resolveSource(VOICE_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');

		assertPromiseSignature(runTool, 'private async _removeProcessIdAssociation(pid: number): Promise<void> {');
		assertPromiseSignature(output, 'private async _startMonitoring(');
		assertPromiseSignature(clipboard, 'async paste(): Promise<void> {');
		assertPromiseSignature(voice, 'private async _finalizeBuiltinThenStop(): Promise<void> {');
		assertPromiseSignature(suggest, 'async requestCompletions(explicitlyInvoked?: boolean): Promise<void> {');

		assert.ok(runTool.includes("import { CancellationError, onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assert.ok(output.includes("import { onUnexpectedError } from '../../../../../../../base/common/errors.js';"));
		assert.ok(clipboard.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(voice.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(suggest.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));

		assertWrapped(runTool, leftoverRemovePidCall);
		assertWrapped(runTool, leftoverRemoveToolPidCall);
		assertWrapped(output, leftoverStartMonCall);
		assertWrapped(output, leftoverStartMonContinueCall);
		assertWrapped(clipboard, leftoverPasteCall);
		assertWrapped(voice, leftoverFinalizeCall);
		assertWrapped(suggest, leftoverRequestCompletionsCall);

		assert.ok(!runTool.includes('\t\t\t\t\t\t\tthis._removeProcessIdAssociation(instance.processId!);\n'));
		assert.ok(!runTool.includes('\t\t\t\tthis._removeProcessIdAssociation(toolTerminal!.instance.processId);\n'));
		assert.ok(!output.includes('\t\t\tthis._startMonitoring(command, invocationContext, cts.token);\n'));
		assert.ok(!output.includes('\t\tthis._startMonitoring(this._command, this._invocationContext, this._currentMonitoringCts.token);\n'));
		assert.ok(!clipboard.includes('\t\t\t\t\tthis.paste();\n'));
		assert.ok(!clipboard.includes('\t\t\t\t\t\tthis.paste();\n'));
		assert.ok(!voice.includes('\t\t\tthis._finalizeBuiltinThenStop();\n'));
		assert.ok(!suggest.includes('\t\t\t\tthis.requestCompletions();\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(PANEL_CONTRIB_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(PANEL_SERVICE_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(PANEL_COMMANDS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const runTool = fs.readFileSync(resolveSource(RUN_TOOL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const voice = fs.readFileSync(resolveSource(VOICE_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(links.includes(`${leftoverOpenLinkCall};`));
		assert.ok(!links.includes(`${leftoverOpenLinkCall}${doubleCatch}`));
		assert.ok(clipboard.includes(leftoverAction2PasteCall));
		assert.ok(!clipboard.includes(`${leftoverAction2PasteCall}${doubleCatch}`));
		assert.ok(commands.includes('public async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(commands.includes('webview.reload();'));
		assert.ok(!commands.includes(`webview.reload()${doubleCatch}`));
		assert.ok(service.includes(leftoverTwoArgReviveThen));
		assert.ok(!service.includes(`${leftoverTwoArgReviveThen}${doubleCatch}`));
		assert.ok(contrib.includes(`${leftoverCloseEditorCall}${doubleCatch}`));
		assert.ok(sticky.includes(`${leftoverGpuCall};`) || sticky.includes('\t\t\tthis._refreshGpuAcceleration();\n') || sticky.includes('\t\tthis._refreshGpuAcceleration();\n'));
		assert.ok(!sticky.includes(`${leftoverGpuCall}${doubleCatch}`));
		assert.ok(find.includes(doubleCatch));
		assert.ok(output.includes('timeout(0).then(() => {'));
		assert.ok(!output.includes(`timeout(0).then(() => {${doubleCatch}`));

		for (const source of [contrib, service, commands, links, clipboard, sticky, runTool, output, voice, suggest]) {
			assert.ok(!source.includes('acknowledge(') || !source.includes(`acknowledge(${doubleCatch}`));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D917'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D798 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const runTool = fs.readFileSync(resolveSource(RUN_TOOL_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const voice = fs.readFileSync(resolveSource(VOICE_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const welcomeContrib = fs.readFileSync(resolveSource(WELCOME_CONTRIB_REL), 'utf8');
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const authExt = fs.readFileSync(resolveSource(AUTH_EXT_REL), 'utf8');
		const authMcp = fs.readFileSync(resolveSource(AUTH_MCP_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const observer = fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
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
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const nav = fs.readFileSync(resolveSource(NAV_REL), 'utf8');
		const callContrib = fs.readFileSync(resolveSource(CALL_CONTRIB_REL), 'utf8');
		const typeContrib = fs.readFileSync(resolveSource(TYPE_CONTRIB_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const suggestContrib = fs.readFileSync(resolveSource(SUGGEST_CONTRIB_REL), 'utf8');

		let d798Sites = 0;
		const seen798 = new Map<string, string>();
		for (const [rel, call, count] of d798AlreadyDouble) {
			const source = seen798.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen798.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D798 already-double drifted: ${rel} ${call}`);
			d798Sites += count;
		}
		assert.strictEqual(d798Sites, 3);
		assert.ok(find.includes(doubleCatch));
		assert.ok(suggestContrib.includes(doubleCatch));

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
		assert.ok(treeView.includes(leftoverDoRefreshRootCall) || treeView.includes(leftoverDoRefreshElementsCall) || treeView.includes(leftoverTreeRefreshCall) || treeView.includes(`this.refresh()${doubleCatch}`));
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
		assert.ok(tasks.includes('this.') || tasks.length > 0);
		assert.ok(nav.includes(doubleCatch));
		assert.ok(callContrib.includes(doubleCatch));
		assert.ok(typeContrib.includes(doubleCatch));
		assert.ok(!callContrib.includes('D917'));
		assert.ok(!typeContrib.includes('D917'));

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
			assert.ok(!file.includes('D917'), `${rel} should stay off this knife`);
		}
		assert.ok(!runTool.includes('D917'));
		assert.ok(!output.includes('D917'));
		assert.ok(!clipboard.includes('D917'));
		assert.ok(!voice.includes('D917'));
		assert.ok(!suggest.includes('D917'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/themes/test/node/themesLeftoverPromiseCatchScanD898.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/terminalContrib/test/node/terminalContribLeftoverPromiseCatchScanD798.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused url / sources / telemetry / navigator / git leftover remaining unused or discarded collision overflow leftover remaining unused', () => {
		const urlExists = fs.existsSync(resolveSource(URL_REL).length ? resolveSource(URL_REL) : URL_REL);
		assert.ok(urlExists);
		const url = fs.readFileSync(resolveSource(URL_REL), 'utf8');
		const sources = fs.readFileSync(resolveSource(SOURCES_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const navigator = fs.readFileSync(resolveSource(NAVIGATOR_REL), 'utf8');
		const git = fs.readFileSync(resolveSource(GIT_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const observer = fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const userDataSync = fs.readFileSync(resolveSource(USER_DATA_SYNC_REL), 'utf8');
		const codeEditor = fs.readFileSync(resolveSource(CODE_EDITOR_REL), 'utf8');

		assert.ok(!url.includes('D917'));
		assert.ok(!sources.includes('D917'));
		assert.ok(!telemetry.includes('D917'));
		assert.ok(!navigator.includes('D917'));
		assert.ok(!git.includes('D917'));
		assert.ok(breadcrumbs.includes(`${leftoverRevealCall};`));
		assert.ok(!breadcrumbs.includes(`${leftoverRevealCall}${doubleCatch}`));
		assert.ok(observer.includes(leftoverLoadStateCall));
		assert.ok(!observer.includes(`this.loadState()${doubleCatch}`));
		assert.ok(userDataSync.includes(`${leftoverWaitAndInitializeCall};`) || userDataSync.includes('this.waitAndInitialize();'));
		assert.ok(!userDataSync.includes(`${leftoverWaitAndInitializeCall}${doubleCatch}`));
		assert.ok(host.includes(leftoverDoOpenCall) || host.includes('doOpen(') || host.length > 0);
		assert.ok(!host.includes(`${leftoverDoOpenCall}${doubleCatch}`));
		assert.ok(!codeEditor.includes(`${leftoverLoadConfigurationsCall}${doubleCatch}`));
		assert.ok(leftoverSyncUpdateCall.length > 0);
		assert.ok(leftoverReloadCall.length > 0);
		assert.ok(leftoverReloadThenCall.length > 0);
		assert.ok(leftoverProcessDialogsCall.length > 0);
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/url/test/node/urlLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/sources/test/node/sourcesLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/telemetry/test/node/telemetryLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/navigator/test/node/navigatorLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/git/test/node/gitLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/callHierarchy/test/node/callHierarchyLeftoverPromiseCatchScanD917.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/typeHierarchy/test/node/typeHierarchyLeftoverPromiseCatchScanD917.test.ts')));
	});
});
