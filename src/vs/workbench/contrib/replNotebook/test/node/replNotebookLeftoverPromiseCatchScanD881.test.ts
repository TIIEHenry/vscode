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
const REPL_CONTRIB_REL = 'src/vs/workbench/contrib/replNotebook/browser/repl.contribution.ts';
const REPL_EDITOR_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditor.ts';
const REPL_INPUT_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditorInput.ts';
const REPL_A11Y_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditorAccessibilityHelp.ts';
const INTERACTIVE_CONTRIB_REL = 'src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts';
const INTERACTIVE_EDITOR_REL = 'src/vs/workbench/contrib/interactive/browser/interactiveEditor.ts';
const INTERACTIVE_INPUT_REL = 'src/vs/workbench/contrib/interactive/browser/interactiveEditorInput.ts';
const NOTEBOOK_COMMON_REL = 'src/vs/workbench/contrib/notebook/common/notebookCommon.ts';
const NOTEBOOK_BROWSER_REL = 'src/vs/workbench/contrib/notebook/browser/notebookBrowser.ts';
const NOTEBOOK_WIDGET_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const NOTEBOOK_MODEL_REL = 'src/vs/workbench/contrib/notebook/common/notebookEditorModel.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const INLINE_CHAT_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const ACCOUNTS_BAR_REL = 'src/vs/workbench/browser/parts/globalCompositeBar.ts';
const INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalService.ts';
const PROCESS_EXPLORER_REL = 'src/vs/workbench/contrib/processExplorer/browser/processExplorerControl.ts';
const LANG_DETECT_REL = 'src/vs/workbench/contrib/languageDetection/browser/languageDetection.contribution.ts';
const EDIT_TELEMETRY_REL = 'src/vs/workbench/contrib/editTelemetry/browser/helpers/documentWithAnnotatedEdits.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const CODE_EDITOR_REL = 'src/vs/workbench/contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts';

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

const installCall = 'this._installHandler()';
const setOptionsInputCall = `this._notebookWidget.value!.setOptions({
			isReadOnly: true
		})`;
const setOptionsOverrideCall = 'void Promise.resolve(this._notebookWidget.value?.setOptions(options))';
const revertCall = 'void Promise.resolve(this.editorModelReference?.object.revert({ soft: true }))';
const interactiveRevertCall = 'void Promise.resolve(this._editorModelReference?.revert({ soft: true }))';
const leftoverHandlesCall = 'if (!this.handles(workingCopy)) {';
const leftoverAcceptSessionCall = 'ctrl.acceptSession();';
const leftoverExecuteCall = 'executeReplInput(bulkEditService, historyService, notebookEditorService, editorControl);';
const leftoverOnWillHideCall = 'this._notebookWidget.value?.onWillHide();';
const leftoverOnShowCall = 'this._notebookWidget.value?.onShow();';
const leftoverFocusCellCall = 'notebookWidget.focusNotebookCell(cell, \'container\');';
const leftoverFindStopCall = 'this._send(\'find-stop\', { clearSelection: !keepSelection });';
const leftoverFocusCall = '\t\t\tthis._send(\'focus\', undefined);\n';
const leftoverStylesCall = 'this._send(\'styles\', { styles, activeTheme, themeId, themeLabel, reduceMotion, screenReader });';
const leftoverChunkCall = 'this._send(\'did-load-resource-chunk\', { id, data }, [data.buffer]);';
const leftoverEndErrorCall = 'this._send(\'did-load-resource-end\', { id, error: true });';
const leftoverEndCall = 'this._send(\'did-load-resource-end\', { id });';
const leftoverResizeCall = 'this._resize();';
const leftoverShowBackgroundCall = 'this.showBackgroundTerminal(value);';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
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
const initializeCall = 'this.initialize()';
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';
const codeEditorRevealCall = 'void Promise.resolve(outline.reveal(element.element, {}, false, false))';
const sidebarCall = 'this.openViewContainer(ViewContainerLocation.Sidebar, viewletToOpen)';
const panelCall = 'this.openViewContainer(ViewContainerLocation.Panel, panelToOpen, !skipLayout)';
const auxCall = 'this.openViewContainer(ViewContainerLocation.AuxiliaryBar, viewletToOpen, !skipLayout)';
const runCall = 'this.run()';
const processUpdateCall = 'this.update()';
const onTreeKeyDownCall = 'this.onTreeKeyDown(e)';
const doUpdateCall = 'this._doUpdate()';
const restartCall = 'this._restart()';

const d881Calls: Array<[string, string, number]> = [
	[REPL_CONTRIB_REL, installCall, 1],
	[REPL_EDITOR_REL, setOptionsInputCall, 1],
	[REPL_EDITOR_REL, setOptionsOverrideCall, 1],
	[REPL_INPUT_REL, revertCall, 1],
];

const d792AlreadyDouble: Array<[string, string, number]> = [
	[INTERACTIVE_CONTRIB_REL, installCall, 1],
	[INTERACTIVE_INPUT_REL, interactiveRevertCall, 1],
	[INTERACTIVE_EDITOR_REL, setOptionsInputCall, 1],
	[INTERACTIVE_EDITOR_REL, setOptionsOverrideCall, 1],
];

suite('leftover remaining unused after D792 leftover remaining unused replNotebook leftover remaining unused Promise fire-and-forget catch scan (D881)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D792 leftover remaining unused replNotebook leftover remaining unused after discarding collision overflow still had four or more legal unused leftover sites so this knife stayed on replNotebook leftover remaining unused', () => {
		const contrib = fs.readFileSync(resolveSource(REPL_CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(REPL_EDITOR_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(REPL_INPUT_REL), 'utf8');
		const a11y = fs.readFileSync(resolveSource(REPL_A11Y_REL), 'utf8');
		assert.ok(contrib.includes(`${installCall}${doubleCatch}`));
		assert.ok(editor.includes(`${setOptionsInputCall}${doubleCatch}`));
		assert.ok(editor.includes(`${setOptionsOverrideCall}${doubleCatch}`));
		assert.ok(input.includes(`${revertCall}${doubleCatch}`));
		assert.ok(!a11y.includes(doubleCatch));
		let leftoverRemainingUnusedLegal = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d881Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			leftoverRemainingUnusedLegal += count;
		}
		assert.ok(leftoverRemainingUnusedLegal >= 4, `expected leftover remaining unused replNotebook legal leftover >=4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(leftoverRemainingUnusedLegal <= 8);
		assert.ok(!contrib.includes('D881'));
		assert.ok(!editor.includes('D881'));
		assert.ok(!input.includes('D881'));
		assert.ok(!a11y.includes('D881'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused stayed on replNotebook leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d881Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(REPL_CONTRIB_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(REPL_EDITOR_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(REPL_INPUT_REL) ?? ''), 1);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const contrib = fs.readFileSync(resolveSource(REPL_CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(REPL_EDITOR_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(REPL_INPUT_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(NOTEBOOK_BROWSER_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(NOTEBOOK_WIDGET_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_COMMON_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(NOTEBOOK_MODEL_REL), 'utf8');
		assertPromiseSignature(contrib, 'private async _installHandler(): Promise<void> {');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(browser, 'setOptions(options: INotebookEditorOptions | undefined): Promise<void>;');
		assertPromiseSignature(widget, 'async setOptions(options: INotebookEditorOptions | undefined) {');
		assertPromiseSignature(notebook, 'revert(options?: IRevertOptions): Promise<void>;');
		assertPromiseSignature(model, 'async revert(options?: IRevertOptions): Promise<void> {');
		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(editor.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(input.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(contrib, installCall);
		assertWrapped(editor, setOptionsInputCall);
		assertWrapped(editor, setOptionsOverrideCall);
		assertWrapped(input, revertCall);
		assert.ok(!contrib.includes('\t\tthis._installHandler();\n'));
		assert.ok(!editor.includes('\t\tthis._notebookWidget.value!.setOptions({\n\t\t\tisReadOnly: true\n\t\t});\n'));
		assert.ok(!editor.includes('\t\tthis._notebookWidget.value?.setOptions(options);\n'));
		assert.ok(!input.includes('this.editorModelReference?.object.revert({ soft: true });'));
		assert.ok(contrib.includes('await this.extensionService.whenInstalledExtensionsRegistered();'));
		assert.ok(!contrib.includes(`whenInstalledExtensionsRegistered()${doubleCatch}`));
		assert.ok(editor.includes('await this._notebookWidget.value!.setModel(model.notebook, viewState?.notebook, undefined, \'repl\');'));
		assert.ok(!editor.includes(`setModel(model.notebook, viewState?.notebook, undefined, 'repl')${doubleCatch}`));
		assert.ok(!editor.includes(`await ${setOptionsInputCall}${doubleCatch}`));
		assert.ok(!editor.includes(`await ${setOptionsOverrideCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(REPL_CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(REPL_EDITOR_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(REPL_INPUT_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const inlineChat = fs.readFileSync(resolveSource(INLINE_CHAT_REL), 'utf8');
		const a11y = fs.readFileSync(resolveSource(REPL_A11Y_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(inlineChat, 'async acceptSession() {');
		assertPromiseSignature(contrib, 'private async _installHandler(): Promise<void> {');

		assert.ok(!contrib.includes('openerService.open'));
		assert.ok(!contrib.includes('IOpenerService'));
		assert.ok(!editor.includes('IOpenerService'));
		assert.ok(!input.includes('IOpenerService'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor, context?: UriComponents): Promise<void> {'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(contrib.includes(leftoverAcceptSessionCall));
		assert.ok(!contrib.includes(`ctrl.acceptSession()${doubleCatch}`));
		assert.ok(contrib.includes(leftoverExecuteCall));
		assert.ok(!contrib.includes(`executeReplInput(bulkEditService, historyService, notebookEditorService, editorControl)${doubleCatch}`));
		assert.ok(contrib.includes(leftoverHandlesCall));
		assert.ok(!contrib.includes(`this.handles(workingCopy)${doubleCatch}`));
		assert.ok(editor.includes(leftoverOnWillHideCall));
		assert.ok(!editor.includes(`this._notebookWidget.value?.onWillHide()${doubleCatch}`));
		assert.ok(editor.includes(leftoverOnShowCall));
		assert.ok(!editor.includes(`this._notebookWidget.value?.onShow()${doubleCatch}`));
		assert.ok(editor.includes(leftoverFocusCellCall));
		assert.ok(!editor.includes(`notebookWidget.focusNotebookCell(cell, 'container')${doubleCatch}`));
		assert.ok(input.includes('return this.inputModelRef.object.textEditorModel;'));
		assert.ok(!input.includes(`return this.inputModelRef.object.textEditorModel${doubleCatch}`));
		assert.ok(input.includes('await super.resolve();'));
		assert.ok(!input.includes(`await super.resolve()${doubleCatch}`));
		assert.ok(!contrib.includes('.then(undefined,'));
		assert.ok(!editor.includes('.then(undefined,'));
		assert.ok(!input.includes('.then(undefined,'));
		assert.ok(!a11y.includes(doubleCatch));

		for (const source of [contrib, editor, input, a11y]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D881'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D792 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const contrib = fs.readFileSync(resolveSource(REPL_CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(REPL_EDITOR_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(REPL_INPUT_REL), 'utf8');
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_BAR_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const processExplorer = fs.readFileSync(resolveSource(PROCESS_EXPLORER_REL), 'utf8');
		const langDetect = fs.readFileSync(resolveSource(LANG_DETECT_REL), 'utf8');
		const editTelemetry = fs.readFileSync(resolveSource(EDIT_TELEMETRY_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const agentSessions = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const simpleSuggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const codeEditor = fs.readFileSync(resolveSource(CODE_EDITOR_REL), 'utf8');

		let d792Sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d792AlreadyDouble) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D792 already-double drifted: ${rel} ${call}`);
			d792Sites += count;
		}
		assert.strictEqual(d792Sites, 4);

		assert.ok(webview.includes(leftoverFindStopCall));
		assert.ok(!webview.includes(`this._send('find-stop', { clearSelection: !keepSelection })${doubleCatch}`));
		assert.ok(webview.includes(leftoverFocusCall));
		assert.ok(!webview.includes(`this._send('focus', undefined)${doubleCatch}`));
		assert.ok(webview.includes(leftoverStylesCall));
		assert.ok(!webview.includes(`this._send('styles', { styles, activeTheme, themeId, themeLabel, reduceMotion, screenReader })${doubleCatch}`));
		assert.ok(webview.includes(leftoverChunkCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-chunk', { id, data }, [data.buffer])${doubleCatch}`));
		assert.ok(webview.includes(leftoverEndErrorCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-end', { id, error: true })${doubleCatch}`));
		assert.ok(webview.includes(leftoverEndCall));
		assert.ok(!webview.includes(`this._send('did-load-resource-end', { id })${doubleCatch}`));

		assert.ok(instance.includes(leftoverResizeCall));
		assert.ok(!instance.includes(`this._resize()${doubleCatch}`));
		assert.ok(service.includes(leftoverShowBackgroundCall));
		assert.ok(!service.includes(`this.showBackgroundTerminal(value)${doubleCatch}`));

		assert.strictEqual(countIncludes(processExplorer, `${processUpdateCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(processExplorer, `${onTreeKeyDownCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(langDetect, `${doUpdateCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(editTelemetry, `${restartCall}${doubleCatch}`), 1);

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
		assert.ok(!agentSessions.includes(`${leftoverOpenSessionCall}${doubleCatch}`));
		assert.ok(agentSessions.includes(leftoverContextMenuCall));
		assert.ok(!agentSessions.includes(`${leftoverContextMenuCall}${doubleCatch}`));
		assert.ok(planReview.includes(leftoverEnterReviewCall));
		assert.ok(!planReview.includes(`${leftoverEnterReviewCall}${doubleCatch}`));
		assert.ok(planReview.includes(leftoverSubmitFeedbackCall));
		assert.ok(!planReview.includes(`${leftoverSubmitFeedbackCall}${doubleCatch}`));

		assert.strictEqual(countIncludes(layout, `${sidebarCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(layout, `${panelCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(layout, `${auxCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(accounts, `${runCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(accounts, `${initializeCall}${doubleCatch}`), 1);
		assert.ok(codeEditor.includes(`${codeEditorRevealCall}${doubleCatch}`));

		assert.ok(contrib.includes(leftoverHandlesCall));
		assert.ok(contrib.includes(leftoverAcceptSessionCall));
		assert.ok(contrib.includes(leftoverExecuteCall));
		assert.ok(editor.includes(leftoverOnWillHideCall));
		assert.ok(editor.includes(leftoverOnShowCall));
		assert.ok(editor.includes(leftoverFocusCellCall));
		assert.ok(input.includes(`${revertCall}${doubleCatch}`));

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
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[SUGGEST_REL, simpleSuggest],
			[SETTINGS_REL, settings],
			[TEXT_MODEL_REL, textModel],
			[PROFILE_MODEL_REL, profileModel],
			[TASKS_REL, tasks],
			[TESTING_REL, testing],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[INSTANCE_REL, instance],
			[SERVICE_REL, service],
			[PROCESS_EXPLORER_REL, processExplorer],
			[LANG_DETECT_REL, langDetect],
			[EDIT_TELEMETRY_REL, editTelemetry],
			[WEBVIEW_REL, webview],
			[LAYOUT_REL, layout],
			[ACCOUNTS_BAR_REL, accounts],
			[CODE_EDITOR_REL, codeEditor],
			[INTERACTIVE_CONTRIB_REL, seen.get(INTERACTIVE_CONTRIB_REL) ?? ''],
			[INTERACTIVE_EDITOR_REL, seen.get(INTERACTIVE_EDITOR_REL) ?? ''],
			[INTERACTIVE_INPUT_REL, seen.get(INTERACTIVE_INPUT_REL) ?? ''],
		] as const) {
			assert.ok(!file.includes('D881'), `${rel} should stay off this knife`);
		}
		assert.ok(!contrib.includes('D881'));
		assert.ok(!editor.includes('D881'));
		assert.ok(!input.includes('D881'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/preferencesLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/codeEditor/test/node/codeEditorLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/interactive/test/node/interactiveLeftoverPromiseCatchScanD792.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/webview/test/node/webviewLeftoverPromiseCatchScanD875.test.ts')));
	});
});
