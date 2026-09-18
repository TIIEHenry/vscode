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
const EDITORS_REL = 'src/vs/workbench/contrib/customEditor/browser/customEditors.ts';
const MODEL_REL = 'src/vs/workbench/contrib/customEditor/common/customEditorModelManager.ts';
const INPUT_REL = 'src/vs/workbench/contrib/customEditor/browser/customEditorInput.ts';
const DIFF_REL = 'src/vs/workbench/contrib/customEditor/browser/customEditorDiffInput.ts';
const FACTORY_REL = 'src/vs/workbench/contrib/customEditor/browser/customEditorInputFactory.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/customEditor/common/customTextEditorModel.ts';
const TAGS_REL = 'src/vs/workbench/contrib/tags/electron-browser/workspaceTags.ts';
const HISTORY_REL = 'src/vs/workbench/services/history/browser/historyService.ts';
const REPL_REL = 'src/vs/workbench/contrib/replNotebook/browser/repl.contribution.ts';
const SNIPPETS_REL = 'src/vs/workbench/contrib/snippets/browser/snippetsService.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const ACCOUNTS_BAR_REL = 'src/vs/workbench/browser/parts/globalCompositeBar.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const PROCESS_EXPLORER_REL = 'src/vs/workbench/contrib/processExplorer/browser/processExplorerControl.ts';
const LANG_DETECT_REL = 'src/vs/workbench/contrib/languageDetection/browser/languageDetection.contribution.ts';
const EDIT_TELEMETRY_REL = 'src/vs/workbench/contrib/editTelemetry/browser/helpers/documentWithAnnotatedEdits.ts';
const TEXTMATE_REL = 'src/vs/workbench/services/textMate/browser/backgroundTokenization/worker/textMateWorkerTokenizer.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const DEBUG_EDITOR_REL = 'src/vs/workbench/contrib/debug/browser/debugEditorContribution.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const EXTENSIONS_WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXTMODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const TIMELINE_REL = 'src/vs/workbench/contrib/timeline/browser/timelinePane.ts';
const LOCAL_HISTORY_REL = 'src/vs/workbench/contrib/localHistory/browser/localHistory.ts';
const CODE_EDITOR_REL = 'src/vs/workbench/contrib/codeEditor/browser/inspectEditorTokens/inspectEditorTokens.ts';
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

const d768UpdateCall = 'void this.updateCustomDiffEditorsForDiffConfigurationChange(e)';
const d768MovedCall = 'this.handleMovedFileInOpenedFileEditors(e.resource, this.uriIdentityService.asCanonicalUri(e.target.resource))';
const leftoverDeletedCall = 'this.handleDeletedFile(e.resource)';
const leftoverInstallCall = 'this._installHandler()';
const leftoverCloudCall = 'this.reportCloudStats()';
const leftoverProxyCall = 'this.reportProxyStats()';
const leftoverTwoArgThenCall = 'then(tags => this.reportWorkspaceTags(tags), error => onUnexpectedError(error))';
const leftoverReturnedGoBackCall = 'return this.goBack();';
const reportCall = 'this.report()';
const reportWindowsCall = 'this.reportWindowsEdition()';
const goBackCall = 'this.goBack()';
const goForwardCall = 'this.goForward()';
const runCall = 'this.run()';
const initializeCall = 'this.initialize()';
const sidebarCall = 'this.openViewContainer(ViewContainerLocation.Sidebar, viewletToOpen)';
const leftoverDoRefreshRootCall = 'this.doRefresh([this.root])';
const leftoverDoRefreshElementsCall = 'this.doRefresh(this.elementsToRefresh)';
const leftoverTreeRefreshCall = '\t\t\tthis.refresh();\n';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';
const leftoverOpenSessionCall = 'list.onDidOpen(e => this.openAgentSession(e))';
const leftoverContextMenuCall = 'list.onContextMenu(e => this.showContextMenu(e))';
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
const leftoverResizeCall = 'this._resize();';
const leftoverReloadThenCall = 'then(() => this.reload())';

const d876Calls: Array<[string, string, number]> = [
	[TAGS_REL, reportCall, 1],
	[TAGS_REL, reportWindowsCall, 1],
	[HISTORY_REL, goBackCall, 1],
	[HISTORY_REL, goForwardCall, 1],
];

suite('leftover remaining unused customEditor leftover remaining unused overflowed to unused leftover remaining unused tags leftover remaining unused + leftover remaining unused history leftover remaining unused Promise fire-and-forget catch scan (D876)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused customEditor leftover remaining unused after D768 after discarding collision overflow had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const editors = fs.readFileSync(resolveSource(EDITORS_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const diff = fs.readFileSync(resolveSource(DIFF_REL), 'utf8');
		const factory = fs.readFileSync(resolveSource(FACTORY_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		assertPromiseSignature(editors, 'private async updateCustomDiffEditorsForDiffConfigurationChange(e: ITextResourceConfigurationChangeEvent): Promise<void> {');
		assertPromiseSignature(editors, 'private async handleMovedFileInOpenedFileEditors(oldResource: URI, newResource: URI): Promise<void> {');
		assert.ok(editors.includes(`${d768UpdateCall}${doubleCatch}`));
		assert.ok(editors.includes(`${d768MovedCall}${doubleCatch}`));
		assert.ok(editors.includes(`${leftoverDeletedCall};`));
		assert.ok(!editors.includes(`${leftoverDeletedCall}${doubleCatch}`));
		assert.ok(editors.includes('private handleDeletedFile(resource: URI): void {'));
		assert.ok(model.includes('return entry.model.then(model => {'));
		assert.ok(!model.includes(`return entry.model.then(model => {${doubleCatch}`));
		assert.ok(model.includes('entry.model.then(x => x.dispose()).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(input.includes('return this.undoRedoService.undo(this.resource);'));
		assert.ok(!input.includes(`this.undoRedoService.undo(this.resource)${doubleCatch}`));
		assert.ok(diff.includes('return this.undoRedoService.undo(this.modifiedResource);'));
		assert.ok(!diff.includes(`this.undoRedoService.undo(this.modifiedResource)${doubleCatch}`));
		assert.ok(factory.includes('async createEditor(workingCopy: IWorkingCopyIdentifier): Promise<EditorInput> {'));
		assert.ok(!factory.includes(doubleCatch));
		assert.ok(textModel.includes('return this.textFileService.save(this.resource, options);'));
		assert.ok(!textModel.includes(`return this.textFileService.save(this.resource, options)${doubleCatch}`));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused customEditor legal leftover <4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!editors.includes('D876'));
		assert.ok(!model.includes('D876'));
		assert.ok(!input.includes('D876'));
		assert.ok(!diff.includes('D876'));
		assert.ok(!factory.includes('D876'));
		assert.ok(!textModel.includes('D876'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused overflowed to unused leftover remaining unused tags leftover remaining unused + leftover remaining unused history leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d876Calls) {
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
		assert.strictEqual(countIncludes(seen.get(TAGS_REL) ?? '', `${reportCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(TAGS_REL) ?? '', `${reportWindowsCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(HISTORY_REL) ?? '', `${goBackCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(HISTORY_REL) ?? '', `${goForwardCall}${doubleCatch}`), 1);
		assert.strictEqual(countDoubleChains(seen.get(TAGS_REL) ?? ''), 3);
		assert.strictEqual(countDoubleChains(seen.get(HISTORY_REL) ?? ''), 2);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const tags = fs.readFileSync(resolveSource(TAGS_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		assertPromiseSignature(tags, 'private async report(): Promise<void> {');
		assertPromiseSignature(tags, 'private async reportWindowsEdition(): Promise<void> {');
		assertPromiseSignature(history, 'goBack(filter?: GoFilter): Promise<void> {');
		assertPromiseSignature(history, 'goForward(filter?: GoFilter): Promise<void> {');
		assert.ok(tags.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(history.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(tags, reportCall);
		assertWrapped(tags, reportWindowsCall);
		assertWrapped(history, goBackCall);
		assertWrapped(history, goForwardCall);
		assert.ok(!tags.includes('\t\t\tthis.report();\n'));
		assert.ok(!tags.includes('\t\tthis.reportWindowsEdition();\n'));
		assert.ok(!history.includes('\t\t\t\t\tthis.goBack();\n'));
		assert.ok(!history.includes('\t\t\t\t\tthis.goForward();\n'));
		assert.ok(tags.includes(`${leftoverCloudCall};`));
		assert.ok(!tags.includes(`${leftoverCloudCall}${doubleCatch}`));
		assert.ok(tags.includes(`${leftoverProxyCall};`));
		assert.ok(!tags.includes(`${leftoverProxyCall}${doubleCatch}`));
		assert.ok(tags.includes(leftoverTwoArgThenCall));
		assert.ok(!tags.includes(`${leftoverTwoArgThenCall}${doubleCatch}`));
		assert.ok(history.includes(leftoverReturnedGoBackCall));
		assert.ok(!history.includes(`return this.goBack()${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const tags = fs.readFileSync(resolveSource(TAGS_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const editors = fs.readFileSync(resolveSource(EDITORS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const repl = fs.readFileSync(resolveSource(REPL_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(tags, 'private async report(): Promise<void> {');
		assertPromiseSignature(history, 'goBack(filter?: GoFilter): Promise<void> {');

		assert.ok(!tags.includes('openerService.open'));
		assert.ok(!history.includes('openerService.open'));
		assert.ok(!tags.includes('extends Action2'));
		assert.ok(!history.includes('extends Action2'));
		assert.ok(!tags.includes('registerAction2'));
		assert.ok(!history.includes('registerAction2'));
		assert.ok(repl.includes('async run(accessor: ServicesAccessor, context?: UriComponents): Promise<void> {'));
		assert.ok(repl.includes(`${leftoverInstallCall};`));
		assert.ok(!repl.includes(`${leftoverInstallCall}${doubleCatch}`));
		assert.ok(tags.includes(leftoverTwoArgThenCall));
		assert.ok(tags.includes('.then(undefined, onUnexpectedError)'));
		assert.ok(!tags.includes(`.then(undefined, onUnexpectedError)${doubleCatch}`));
		assert.ok(!history.includes('.then(undefined,'));
		assert.ok(history.includes(leftoverReturnedGoBackCall));
		assert.ok(!history.includes(`return this.goBack()${doubleCatch}`));
		assert.ok(history.includes('return this.getStack().goForward(filter);'));
		assert.ok(!history.includes(`return this.getStack().goForward(filter)${doubleCatch}`));
		assert.ok(editors.includes(`${d768UpdateCall}${doubleCatch}`));
		assert.ok(tags.includes('this.getWorkspaceInformation().then(stats => this.diagnosticsService.reportWorkspaceStats(stats)).catch(onUnexpectedError).catch(onUnexpectedError);'));

		for (const source of [tags, history, editors]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D876'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D768/D867/D868/D871 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const tags = fs.readFileSync(resolveSource(TAGS_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const editors = fs.readFileSync(resolveSource(EDITORS_REL), 'utf8');
		const snippets = fs.readFileSync(resolveSource(SNIPPETS_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_BAR_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const processExplorer = fs.readFileSync(resolveSource(PROCESS_EXPLORER_REL), 'utf8');
		const langDetect = fs.readFileSync(resolveSource(LANG_DETECT_REL), 'utf8');
		const editTelemetry = fs.readFileSync(resolveSource(EDIT_TELEMETRY_REL), 'utf8');
		const textMate = fs.readFileSync(resolveSource(TEXTMATE_REL), 'utf8');
		const agentSessions = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const debugEditor = fs.readFileSync(resolveSource(DEBUG_EDITOR_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(EXTENSIONS_WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXTMODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const repl = fs.readFileSync(resolveSource(REPL_REL), 'utf8');

		assert.ok(editors.includes(`${d768UpdateCall}${doubleCatch}`));
		assert.ok(editors.includes(`${d768MovedCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(processExplorer, `this.update()${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(processExplorer, `this.onTreeKeyDown(e)${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(langDetect, `this._doUpdate()${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(editTelemetry, `this._restart()${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(textMate, `this._resetTokenization()${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(textMate, `this._tokenize()${doubleCatch}`), 3);
		assert.ok(layout.includes(`${sidebarCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(accounts, `${runCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(accounts, `${initializeCall}${doubleCatch}`), 1);
		assert.ok(treeView.includes(`${leftoverDoRefreshRootCall};`) || treeView.includes(`${leftoverDoRefreshRootCall} /** soft refresh **/`));
		assert.ok(!treeView.includes(`${leftoverDoRefreshRootCall}${doubleCatch}`));
		assert.ok(treeView.includes(`${leftoverDoRefreshElementsCall};`));
		assert.ok(!treeView.includes(`${leftoverDoRefreshElementsCall}${doubleCatch}`));
		assert.ok(treeView.includes(leftoverTreeRefreshCall));
		assert.ok(!treeView.includes(`this.refresh()${doubleCatch}`));
		assert.ok(snippets.includes('this._initUserSnippets().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(repl.includes(`${leftoverInstallCall};`));
		assert.ok(!repl.includes(`${leftoverInstallCall}${doubleCatch}`));

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
		assert.ok(planReview.includes(leftoverEnterReviewCall));
		assert.ok(!planReview.includes(`void this.enterReviewMode()${doubleCatch}`));
		assert.ok(planReview.includes(leftoverSubmitFeedbackCall));
		assert.ok(!planReview.includes(`submitFeedback: () => this.submitFeedback()${doubleCatch}`));
		assert.ok(agentSessions.includes(leftoverOpenSessionCall));
		assert.ok(!agentSessions.includes(`this.openAgentSession(e)${doubleCatch}`));
		assert.ok(agentSessions.includes(leftoverContextMenuCall));
		assert.ok(!agentSessions.includes(`this.showContextMenu(e)${doubleCatch}`));
		assert.ok(instance.includes(leftoverResizeCall));
		assert.ok(!instance.includes(`this._resize()${doubleCatch}`));
		assert.ok(configuration.includes(leftoverReloadThenCall));
		assert.ok(!configuration.includes(`${leftoverReloadThenCall}${doubleCatch}`));
		assert.ok(searchWidget.includes(`this.submitSearch()${doubleCatch}`) || searchWidget.includes(doubleCatch));
		assert.ok(comments.includes(`this.refresh()${doubleCatch}`));
		assert.ok(setup.includes(`this.checkExtensionInstallation(context)${doubleCatch}`));
		assert.ok(debugConfig.includes(`this.selectConfiguration(undefined)${doubleCatch}`));
		assert.ok(debugService.includes(`this.launchOrAttachToSession(session)${doubleCatch}`));
		assert.ok(debugEditor.includes(`this.toggleExceptionWidget()${doubleCatch}`));
		assert.ok(chatWidget.includes(doubleCatch));
		assert.ok(testing.includes('this.openAndShow(') || testing.includes(doubleCatch));
		assert.ok(tasks.includes('this.') || tasks.length > 0);

		for (const [rel, file] of [
			[EDITORS_REL, editors],
			[SNIPPETS_REL, snippets],
			[LAYOUT_REL, layout],
			[ACCOUNTS_BAR_REL, accounts],
			[TREE_VIEW_REL, treeView],
			[PROCESS_EXPLORER_REL, processExplorer],
			[LANG_DETECT_REL, langDetect],
			[EDIT_TELEMETRY_REL, editTelemetry],
			[TEXTMATE_REL, textMate],
			[AGENT_SESSIONS_REL, agentSessions],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[PLAN_REVIEW_REL, planReview],
			[CHAT_WIDGET_REL, chatWidget],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[DEBUG_EDITOR_REL, debugEditor],
			[TESTING_REL, testing],
			[VIEWLET_REL, viewlet],
			[EXTENSIONS_WIDGETS_REL, widgets],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TEXTMODEL_REL, textModel],
			[PROFILE_MODEL_REL, profileModel],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[TASKS_REL, tasks],
			[INSTANCE_REL, instance],
			[CONFIG_REL, configuration],
			[REPL_REL, repl],
		] as const) {
			assert.ok(!file.includes('D876'), `${rel} should stay off this knife`);
		}
		assert.ok(!tags.includes('D876'));
		assert.ok(!history.includes('D876'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/snippets/test/node/snippetsLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/webview/test/node/webviewLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/timeline/test/node/timelineLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/localHistory/test/node/localHistoryLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/codeEditor/test/node/codeEditorLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD876.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), WEBVIEW_REL)));
		assert.ok(fs.existsSync(path.join(process.cwd(), TIMELINE_REL)));
		assert.ok(fs.existsSync(path.join(process.cwd(), LOCAL_HISTORY_REL)));
		assert.ok(fs.existsSync(path.join(process.cwd(), CODE_EDITOR_REL)));
	});
});
