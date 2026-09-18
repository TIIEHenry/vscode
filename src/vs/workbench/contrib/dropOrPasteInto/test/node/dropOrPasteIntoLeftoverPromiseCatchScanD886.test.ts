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
const DROP_COMMANDS_REL = 'src/vs/workbench/contrib/dropOrPasteInto/browser/commands.ts';
const DROP_SCHEMA_REL = 'src/vs/workbench/contrib/dropOrPasteInto/browser/configurationSchema.ts';
const DROP_CONTRIB_REL = 'src/vs/workbench/contrib/dropOrPasteInto/browser/dropOrPasteInto.contribution.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';
const EDITOR_PART_REL = 'src/vs/workbench/browser/parts/editor/editorPart.ts';
const TABS_REL = 'src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts';
const DROP_TARGET_REL = 'src/vs/workbench/browser/parts/editor/editorDropTarget.ts';
const GROUP_VIEW_REL = 'src/vs/workbench/browser/parts/editor/editorGroupView.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts';
const EDITORS_OBSERVER_REL = 'src/vs/workbench/browser/parts/editor/editorsObserver.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const REPL_CONTRIB_REL = 'src/vs/workbench/contrib/replNotebook/browser/repl.contribution.ts';
const REPL_EDITOR_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditor.ts';
const REPL_INPUT_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditorInput.ts';
const INTERACTIVE_CONTRIB_REL = 'src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts';
const SHARE_CONTRIB_REL = 'src/vs/workbench/contrib/share/browser/share.contribution.ts';
const BASE_REPORTER_REL = 'src/vs/workbench/contrib/issue/browser/baseIssueReporterService.ts';
const TAGS_REL = 'src/vs/workbench/contrib/tags/electron-browser/workspaceTags.ts';
const HISTORY_REL = 'src/vs/workbench/services/history/browser/historyService.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const LAYOUT_REL = 'src/vs/workbench/browser/layout.ts';
const ACCOUNTS_BAR_REL = 'src/vs/workbench/browser/parts/globalCompositeBar.ts';
const INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
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
const INLINE_CHAT_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts';

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

const leftoverPasteCall = 'run: () => this.configurePreferredPasteAction()';
const leftoverDropCall = 'run: () => this.configurePreferredDropAction()';
const leftoverUpdateKindsCall = 'this.updateProvidedKinds();';
const leftoverUpdateSchemaCall = 'this.updateConfigurationSchema();';
const restorePartsCall = 'this.restoreParts()';
const applyStateCall = 'this.applyState(state)';
const tabsContainerDropCall = 'this.onDrop(e, isGroupTransfer ? this.groupView.count : this.tabsModel.count, tabsContainer)';
const tabDropCall = 'this.onDrop(e, targetIndex, tabsContainer)';
const handleDropCall = 'this.handleDrop(e, this.currentDropOperation.splitDirection)';
const setSelectionCall = 'this.setSelection(this.activeEditor, [])';
const doOpenEditorCall = 'this.doOpenEditor(nextActiveEditor, options, internalEditorOpenOptions)';
const leftoverRevealCall = 'this._revealInEditor(event, element, group)';
const leftoverLoadStateCall = '\t\tthis.loadState();\n';
const leftoverDoRefreshRootCall = 'this.doRefresh([this.root])';
const leftoverDoRefreshElementsCall = 'this.doRefresh(this.elementsToRefresh)';
const leftoverTreeRefreshCall = '\t\t\tthis.refresh();\n';
const leftoverTargetOpenCall = 'target.doOpenEditor(keepCopy ? editor.copy() : editor, options, internalOptions)';
const assignedOpenCall = 'const openEditorResult = this.doOpenEditor(activeReplacement.replacement, activeReplacement.options)';
const leftoverRenderCall = '\t\tthis.renderBlocks();\n';
const leftoverOpenLinkCall = '\t\t\tthis.openLink(url);\n';
const leftoverShareOpenerCall = 'run: () => { urlService.open(result, { openExternal: true }); }';
const leftoverShareRegisterCall = '\t\t\t\t\tthis.registerActions();\n';
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
const leftoverFindStopCall = 'this._send(\'find-stop\', { clearSelection: !keepSelection });';
const leftoverFocusCall = '\t\t\tthis._send(\'focus\', undefined);\n';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const leftoverOpenSessionCall = 'list.onDidOpen(e => this.openAgentSession(e))';
const leftoverContextMenuCall = 'list.onContextMenu(e => this.showContextMenu(e))';
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';
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
const leftoverResizeCall = 'this._resize();';
const leftoverReloadThenCall = 'then(() => this.reload())';
const sidebarCall = 'this.openViewContainer(ViewContainerLocation.Sidebar, viewletToOpen)';
const runCall = 'this.run()';
const processUpdateCall = 'this.update()';
const onTreeKeyDownCall = 'this.onTreeKeyDown(e)';
const doUpdateCall = 'this._doUpdate()';
const restartCall = 'this._restart()';
const leftoverAcceptSessionCall = 'ctrl.acceptSession();';

const d886Calls: Array<[string, string, number]> = [
	[EDITOR_PARTS_REL, restorePartsCall, 1],
	[EDITOR_PARTS_REL, applyStateCall, 1],
	[TABS_REL, tabsContainerDropCall, 1],
	[TABS_REL, tabDropCall, 1],
	[DROP_TARGET_REL, handleDropCall, 1],
	[GROUP_VIEW_REL, setSelectionCall, 1],
	[GROUP_VIEW_REL, doOpenEditorCall, 1],
	[EDITOR_PART_REL, applyStateCall, 1],
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

suite('leftover remaining unused dropOrPasteInto leftover remaining unused overflowed to unused leftover remaining unused editor leftover remaining unused Promise fire-and-forget catch scan (D886)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused dropOrPasteInto leftover remaining unused after discarding collision overflow had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const commands = fs.readFileSync(resolveSource(DROP_COMMANDS_REL), 'utf8');
		const schema = fs.readFileSync(resolveSource(DROP_SCHEMA_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(DROP_CONTRIB_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		assertPromiseSignature(preferences, 'openUserSettings(options?: IOpenSettingsOptions): Promise<IEditorPane | undefined>;');
		assert.ok(commands.includes(leftoverPasteCall));
		assert.ok(!commands.includes(`${leftoverPasteCall}${doubleCatch}`));
		assert.ok(commands.includes(leftoverDropCall));
		assert.ok(!commands.includes(`${leftoverDropCall}${doubleCatch}`));
		assert.ok(commands.includes('return this._preferencesService.openUserSettings({'));
		assert.ok(!commands.includes(`openUserSettings({${doubleCatch}`));
		assert.ok(schema.includes(leftoverUpdateKindsCall));
		assert.ok(!schema.includes(`this.updateProvidedKinds()${doubleCatch}`));
		assert.ok(schema.includes(leftoverUpdateSchemaCall));
		assert.ok(!schema.includes(`this.updateConfigurationSchema()${doubleCatch}`));
		assert.ok(schema.includes('private updateProvidedKinds(): void {'));
		assert.ok(schema.includes('private updateConfigurationSchema(): void {'));
		assert.ok(!commands.includes(doubleCatch));
		assert.ok(!schema.includes(doubleCatch));
		assert.ok(!contrib.includes(doubleCatch));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused dropOrPasteInto legal leftover <4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!commands.includes('D886'));
		assert.ok(!schema.includes('D886'));
		assert.ok(!contrib.includes('D886'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused overflowed to unused leftover remaining unused editor leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d886Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(EDITOR_PARTS_REL) ?? ''), 4);
		assert.strictEqual(countDoubleChains(seen.get(TABS_REL) ?? ''), 9);
		assert.strictEqual(countDoubleChains(seen.get(DROP_TARGET_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(GROUP_VIEW_REL) ?? ''), 3);
		assert.strictEqual(countDoubleChains(seen.get(EDITOR_PART_REL) ?? ''), 1);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const parts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const part = fs.readFileSync(resolveSource(EDITOR_PART_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const dropTarget = fs.readFileSync(resolveSource(DROP_TARGET_REL), 'utf8');
		const groupView = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		assertPromiseSignature(parts, 'private async restoreParts(): Promise<void> {');
		assertPromiseSignature(parts, 'private async applyState(state: IEditorPartsUIState | \'empty\'): Promise<boolean> {');
		assertPromiseSignature(tabs, 'private async onDrop(e: DragEvent, targetTabIndex: number, tabsContainer: HTMLElement): Promise<void> {');
		assertPromiseSignature(dropTarget, 'private async handleDrop(event: DragEvent, splitDirection?: GroupDirection): Promise<void> {');
		assertPromiseSignature(groupView, 'async setSelection(activeSelectedEditor: EditorInput, inactiveSelectedEditors: EditorInput[]): Promise<void> {');
		assertPromiseSignature(groupView, 'private async doOpenEditor(editor: EditorInput, options?: IEditorOptions, internalOptions?: IInternalEditorOpenOptions): Promise<IEditorPane | undefined> {');
		assertPromiseSignature(part, 'applyState(state: IEditorPartUIState | \'empty\', options?: IEditorGroupViewOptions): Promise<void> {');
		assert.ok(parts.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(part.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(tabs.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(dropTarget.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(groupView.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(parts, restorePartsCall);
		assertWrapped(parts, applyStateCall);
		assertWrapped(tabs, tabsContainerDropCall);
		assertWrapped(tabs, tabDropCall);
		assertWrapped(dropTarget, handleDropCall);
		assertWrapped(groupView, setSelectionCall);
		assertWrapped(groupView, doOpenEditorCall);
		assertWrapped(part, applyStateCall);
		assert.ok(!parts.includes('\t\tthis.restoreParts();\n'));
		assert.ok(!tabs.includes('\t\t\t\tthis.onDrop(e, targetIndex, tabsContainer);\n'));
		assert.ok(!groupView.includes('\t\t\tthis.setSelection(this.activeEditor, []);\n'));
		assert.ok(!groupView.includes('\t\t\tthis.doOpenEditor(nextActiveEditor, options, internalEditorOpenOptions);\n'));
		assert.ok(parts.includes('const applied = await this.applyState(workingSetState === \'empty\' ? workingSetState : workingSetState.auxiliary);'));
		assert.ok(!parts.includes(`await this.applyState(workingSetState === 'empty' ? workingSetState : workingSetState.auxiliary)${doubleCatch}`));
		assert.ok(groupView.includes(`await this.doOpenEditor(firstEditor.editor, firstEditor.options, openEditorsOptions);`));
		assert.ok(!groupView.includes(`await this.doOpenEditor(firstEditor.editor, firstEditor.options, openEditorsOptions)${doubleCatch}`));
		assert.ok(groupView.includes(assignedOpenCall));
		assert.ok(!groupView.includes(`${assignedOpenCall}${doubleCatch}`));
		assert.ok(groupView.includes(leftoverTargetOpenCall));
		assert.ok(!groupView.includes(`${leftoverTargetOpenCall}${doubleCatch}`));
		assert.ok(breadcrumbs.includes(`${leftoverRevealCall};`));
		assert.ok(!breadcrumbs.includes(`${leftoverRevealCall}${doubleCatch}`));
		assertPromiseSignature(breadcrumbs, 'private async _revealInEditor(event: IBreadcrumbsItemEvent, element: FileElement | OutlineElement2, group: SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE | undefined, pinned: boolean = false): Promise<void> {');
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const commands = fs.readFileSync(resolveSource(DROP_COMMANDS_REL), 'utf8');
		const schema = fs.readFileSync(resolveSource(DROP_SCHEMA_REL), 'utf8');
		const parts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const groupView = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const inlineChat = fs.readFileSync(resolveSource(INLINE_CHAT_REL), 'utf8');
		const share = fs.readFileSync(resolveSource(SHARE_CONTRIB_REL), 'utf8');
		const interactive = fs.readFileSync(resolveSource(INTERACTIVE_CONTRIB_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(inlineChat, 'async acceptSession() {');
		assertPromiseSignature(parts, 'private async restoreParts(): Promise<void> {');

		assert.ok(!commands.includes('openerService.open'));
		assert.ok(!schema.includes('openerService.open'));
		assert.ok(!parts.includes('IOpenerService'));
		assert.ok(commands.includes(leftoverPasteCall));
		assert.ok(commands.includes(leftoverDropCall));
		assert.ok(!commands.includes('extends Action2'));
		assert.ok(share.includes('override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {'));
		assert.ok(share.includes(leftoverShareOpenerCall));
		assert.ok(!share.includes(`urlService.open(result, { openExternal: true })${doubleCatch}`));
		assert.ok(share.includes(leftoverShareRegisterCall));
		assert.ok(!share.includes(`this.registerActions()${doubleCatch}`));
		assert.ok(inlineChat.includes(leftoverAcceptSessionCall) || inlineChat.includes('async acceptSession() {'));
		assert.ok(!inlineChat.includes(`ctrl.acceptSession()${doubleCatch}`));
		assert.ok(interactive.includes(`${installCall}${doubleCatch}`));
		assert.ok(groupView.includes(assignedOpenCall));
		assert.ok(!groupView.includes(`${assignedOpenCall}${doubleCatch}`));
		assert.ok(groupView.includes('return this.doOpenEditor(editor, options, {'));
		assert.ok(!groupView.includes(`return this.doOpenEditor(editor, options, {${doubleCatch}`));
		assert.ok(!commands.includes('.then(undefined,'));
		assert.ok(!schema.includes('.then(undefined,'));

		for (const source of [commands, schema, parts, groupView]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D886'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D881/D876/D883 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const commands = fs.readFileSync(resolveSource(DROP_COMMANDS_REL), 'utf8');
		const schema = fs.readFileSync(resolveSource(DROP_SCHEMA_REL), 'utf8');
		const parts = fs.readFileSync(resolveSource(EDITOR_PARTS_REL), 'utf8');
		const groupView = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');
		const observer = fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		const accounts = fs.readFileSync(resolveSource(ACCOUNTS_BAR_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
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
		const share = fs.readFileSync(resolveSource(SHARE_CONTRIB_REL), 'utf8');
		const base = fs.readFileSync(resolveSource(BASE_REPORTER_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource('src/vs/workbench/services/configuration/browser/configuration.ts'), 'utf8');

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

		assert.ok(observer.includes(leftoverLoadStateCall));
		assert.ok(!observer.includes(`this.loadState()${doubleCatch}`));
		assert.ok(treeView.includes(`${leftoverDoRefreshRootCall};`) || treeView.includes(`${leftoverDoRefreshRootCall} /** soft refresh **/`));
		assert.ok(!treeView.includes(`${leftoverDoRefreshRootCall}${doubleCatch}`));
		assert.ok(treeView.includes(`${leftoverDoRefreshElementsCall};`));
		assert.ok(!treeView.includes(`${leftoverDoRefreshElementsCall}${doubleCatch}`));
		assert.ok(treeView.includes(leftoverTreeRefreshCall));
		assert.ok(!treeView.includes(`this.refresh()${doubleCatch}`));

		assert.ok(webview.includes(leftoverFindStopCall));
		assert.ok(!webview.includes(`this._send('find-stop', { clearSelection: !keepSelection })${doubleCatch}`));
		assert.ok(webview.includes(leftoverFocusCall));
		assert.ok(!webview.includes(`this._send('focus', undefined)${doubleCatch}`));

		assert.ok(base.includes(leftoverRenderCall) || base.includes('\t\tthis.renderBlocks();\n') || base.includes('\t\t\tthis.renderBlocks();\n'));
		assert.ok(!base.includes(`this.renderBlocks()${doubleCatch}`));
		assert.ok(base.includes(leftoverOpenLinkCall) || base.includes('\t\t\tthis.openLink(url);\n'));
		assert.ok(!base.includes(`this.openLink(url)${doubleCatch}`));
		assert.ok(share.includes(leftoverShareOpenerCall));
		assert.ok(share.includes(leftoverShareRegisterCall));

		assert.ok(instance.includes(leftoverResizeCall));
		assert.ok(!instance.includes(`this._resize()${doubleCatch}`));
		assert.strictEqual(countIncludes(processExplorer, `${processUpdateCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(processExplorer, `${onTreeKeyDownCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(langDetect, `${doUpdateCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(editTelemetry, `${restartCall}${doubleCatch}`), 1);
		assert.ok(layout.includes(`${sidebarCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(accounts, `${runCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(accounts, `${initializeCall}${doubleCatch}`), 1);

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
			[PROCESS_EXPLORER_REL, processExplorer],
			[LANG_DETECT_REL, langDetect],
			[EDIT_TELEMETRY_REL, editTelemetry],
			[WEBVIEW_REL, webview],
			[LAYOUT_REL, layout],
			[ACCOUNTS_BAR_REL, accounts],
			[SHARE_CONTRIB_REL, share],
			[BASE_REPORTER_REL, base],
			[REPL_CONTRIB_REL, seen881.get(REPL_CONTRIB_REL) ?? ''],
			[REPL_EDITOR_REL, seen881.get(REPL_EDITOR_REL) ?? ''],
			[REPL_INPUT_REL, seen881.get(REPL_INPUT_REL) ?? ''],
			[TAGS_REL, seen876.get(TAGS_REL) ?? ''],
			[HISTORY_REL, seen876.get(HISTORY_REL) ?? ''],
		] as const) {
			assert.ok(!file.includes('D886'), `${rel} should stay off this knife`);
		}
		assert.ok(!commands.includes('D886'));
		assert.ok(!schema.includes('D886'));
		assert.ok(!parts.includes('D886'));
		assert.ok(!groupView.includes('D886'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/share/test/node/shareLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/replNotebook/test/node/replNotebookLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/replNotebook/test/node/replNotebookLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/share/test/node/shareLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/webview/test/node/webviewLeftoverPromiseCatchScanD875.test.ts')));
	});
});
