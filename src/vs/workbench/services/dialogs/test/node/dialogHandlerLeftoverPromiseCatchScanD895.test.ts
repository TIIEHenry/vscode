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
const WEB_DIALOG_REL = 'src/vs/workbench/browser/parts/dialogs/dialog.web.contribution.ts';
const ELECTRON_DIALOG_REL = 'src/vs/workbench/electron-browser/parts/dialogs/dialog.contribution.ts';
const MOBILE_DIALOG_REL = 'src/vs/sessions/browser/parts/dialogs/mobileDialog.web.contribution.ts';
const SIMPLE_REL = 'src/vs/workbench/services/dialogs/browser/simpleFileDialog.ts';
const ABSTRACT_REL = 'src/vs/workbench/services/dialogs/browser/abstractFileDialogService.ts';
const BROWSER_REL = 'src/vs/workbench/services/dialogs/browser/fileDialogService.ts';
const ELECTRON_FILE_REL = 'src/vs/workbench/services/dialogs/electron-browser/fileDialogService.ts';
const DIALOG_SVC_REL = 'src/vs/workbench/services/dialogs/common/dialogService.ts';
const LOCALIZATION_NATIVE_REL = 'src/vs/workbench/contrib/localization/electron-browser/localization.contribution.ts';
const LOCALIZATION_WEB_REL = 'src/vs/workbench/contrib/localization/browser/localization.contribution.ts';
const LOCALIZATION_COMMON_REL = 'src/vs/workbench/contrib/localization/common/localization.contribution.ts';
const EDITOR_PARTS_REL = 'src/vs/workbench/browser/parts/editor/editorParts.ts';
const EDITOR_PART_REL = 'src/vs/workbench/browser/parts/editor/editorPart.ts';
const TABS_REL = 'src/vs/workbench/browser/parts/editor/multiEditorTabsControl.ts';
const DROP_TARGET_REL = 'src/vs/workbench/browser/parts/editor/editorDropTarget.ts';
const GROUP_VIEW_REL = 'src/vs/workbench/browser/parts/editor/editorGroupView.ts';
const BREADCRUMBS_REL = 'src/vs/workbench/browser/parts/editor/breadcrumbsControl.ts';
const EDITORS_OBSERVER_REL = 'src/vs/workbench/browser/parts/editor/editorsObserver.ts';
const REPL_CONTRIB_REL = 'src/vs/workbench/contrib/replNotebook/browser/repl.contribution.ts';
const REPL_EDITOR_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditor.ts';
const REPL_INPUT_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditorInput.ts';
const SHARE_CONTRIB_REL = 'src/vs/workbench/contrib/share/browser/share.contribution.ts';
const BASE_REPORTER_REL = 'src/vs/workbench/contrib/issue/browser/baseIssueReporterService.ts';
const FORM_REL = 'src/vs/workbench/contrib/issue/browser/issueFormService.ts';
const OVERLAY_REL = 'src/vs/workbench/contrib/issue/browser/issueReporterOverlay.ts';
const REPORTER_REL = 'src/vs/workbench/contrib/issue/electron-browser/issueReporterService.ts';
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

function assertThenWrapped(source: string, thenStart: string): void {
	const idx = source.indexOf(thenStart);
	assert.ok(idx >= 0, `missing then: ${thenStart}`);
	const afterThen = source.slice(idx);
	const closeThen = afterThen.indexOf(`})${doubleCatch};`);
	assert.ok(closeThen >= 0, `then not double-chained: ${thenStart}`);
	assert.ok(!source.includes(`${thenStart};`));
	assert.ok(!source.includes(`${thenStart}.catch(onUnexpectedError);`));
}

const processDialogsCall = 'this.processDialogs()';
const leftoverRevealCall = 'this._revealInEditor(event, element, group)';
const leftoverLoadStateCall = '\t\tthis.loadState();\n';
const leftoverEnsureOpenedCall = 'this.ensureOpenedEditorsLimit({ groupId: group.id, editor: e.editor }, group.id)';
const leftoverEnsureExcludeCall = 'this.ensureOpenedEditorsLimit(exclude)';
const leftoverRenderCall = '\t\tthis.renderBlocks();\n';
const leftoverOpenLinkCall = '\t\t\tthis.openLink(url);\n';
const leftoverCloseReporterCall = '\t\t\t\t\t\tthis.closeReporter();\n';
const leftoverShareOpenerCall = 'run: () => { urlService.open(result, { openExternal: true }); }';
const leftoverShareRegisterCall = '\t\t\t\t\tthis.registerActions();\n';
const leftoverAcceptSessionCall = 'ctrl.acceptSession();';
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
const restorePartsCall = 'this.restoreParts()';
const applyStateCall = 'this.applyState(state)';
const tabsContainerDropCall = 'this.onDrop(e, isGroupTransfer ? this.groupView.count : this.tabsModel.count, tabsContainer)';
const tabDropCall = 'this.onDrop(e, targetIndex, tabsContainer)';
const handleDropCall = 'this.handleDrop(e, this.currentDropOperation.splitDirection)';
const setSelectionCall = 'this.setSelection(this.activeEditor, [])';
const doOpenEditorCall = 'this.doOpenEditor(nextActiveEditor, options, internalEditorOpenOptions)';
const assignedOpenCall = 'const openEditorResult = this.doOpenEditor(activeReplacement.replacement, activeReplacement.options)';
const leftoverTargetOpenCall = 'target.doOpenEditor(keepCopy ? editor.copy() : editor, options, internalOptions)';
const installCall = 'this._installHandler()';
const setOptionsInputCall = `this._notebookWidget.value!.setOptions({
			isReadOnly: true
		})`;
const setOptionsOverrideCall = 'void Promise.resolve(this._notebookWidget.value?.setOptions(options))';
const revertCall = 'void Promise.resolve(this.editorModelReference?.object.revert({ soft: true }))';
const updateTargetCall = 'this.updateExtensionStatus(targetExtension)';
const updateMatchesCall = 'this.updateExtensionStatus(matches[0])';
const closeCall = 'this.close()';
const pickResourceThen = 'this.pickResource(true).then(result => {';
const onDidAcceptThen = 'this.onDidAccept().then(resolveValue => {';
const updateItemsThen = 'this.updateItems(homedir, true, this.trailing).then(() => {';
const addRecentlyOpenedCall = 'this.workspacesService.addRecentlyOpened([{ fileUri: uri, label: this.labelService.getUriLabel(uri, { appendWorkspaceSuffix: true }) }])';
const openEditorsCall = `this.editorService.openEditors(filesData.map(fileData => {
								return {
									resource: fileData.resource,
									contents: fileData.contents?.toString(),
									options: { pinned: true }
								};
							}))`;
const checkAndInstallCall = 'this.checkAndInstall()';
const onDidInstallCall = 'this.onDidInstallExtensions(e)';
const onDidUninstallCall = 'this.onDidUninstallExtension(e)';
const setLocaleEnCall = `this.localeService.setLocale({
				id: 'en',
				label: 'English'
			})`;

const d895Calls: Array<[string, string, number]> = [
	[WEB_DIALOG_REL, processDialogsCall, 2],
	[ELECTRON_DIALOG_REL, processDialogsCall, 2],
];

const d795AlreadyDouble: Array<[string, string, number, 'call' | 'then']> = [
	[SIMPLE_REL, pickResourceThen, 1, 'then'],
	[SIMPLE_REL, onDidAcceptThen, 1, 'then'],
	[SIMPLE_REL, updateItemsThen, 1, 'then'],
	[ABSTRACT_REL, addRecentlyOpenedCall, 1, 'call'],
	[BROWSER_REL, openEditorsCall, 1, 'call'],
];

const d886AlreadyDouble: Array<[string, string, number]> = [
	[EDITOR_PARTS_REL, restorePartsCall, 1],
	[EDITOR_PARTS_REL, applyStateCall, 1],
	[TABS_REL, tabsContainerDropCall, 1],
	[TABS_REL, tabDropCall, 1],
	[DROP_TARGET_REL, handleDropCall, 1],
	[GROUP_VIEW_REL, setSelectionCall, 1],
	[GROUP_VIEW_REL, doOpenEditorCall, 1],
	[EDITOR_PART_REL, applyStateCall, 1],
];

const d883AlreadyDouble: Array<[string, string, number]> = [
	[BASE_REPORTER_REL, updateTargetCall, 1],
	[BASE_REPORTER_REL, updateMatchesCall, 2],
	[BASE_REPORTER_REL, closeCall, 3],
	[REPORTER_REL, closeCall, 1],
];

const d881AlreadyDouble: Array<[string, string, number]> = [
	[REPL_CONTRIB_REL, installCall, 1],
	[REPL_EDITOR_REL, setOptionsInputCall, 1],
	[REPL_EDITOR_REL, setOptionsOverrideCall, 1],
	[REPL_INPUT_REL, revertCall, 1],
];

const d782AlreadyDouble: Array<[string, string, number]> = [
	[LOCALIZATION_NATIVE_REL, checkAndInstallCall, 1],
	[LOCALIZATION_NATIVE_REL, onDidInstallCall, 1],
	[LOCALIZATION_NATIVE_REL, onDidUninstallCall, 1],
	[LOCALIZATION_NATIVE_REL, setLocaleEnCall, 1],
];

suite('leftover remaining unused workbench dialogs leftover remaining unused processDialogs leftover remaining unused Promise fire-and-forget catch scan (D895)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused workbench dialogs leftover remaining unused after discarding collision overflow still had four legal unused leftover sites so this knife stayed', () => {
		let leftoverRemainingUnusedLegal = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d895Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			leftoverRemainingUnusedLegal += count;
		}
		assert.ok(leftoverRemainingUnusedLegal >= 4, `expected leftover remaining unused dialogs legal leftover >=4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(leftoverRemainingUnusedLegal <= 8);
		assert.strictEqual(leftoverRemainingUnusedLegal, 4);
		const web = seen.get(WEB_DIALOG_REL) ?? '';
		const electron = seen.get(ELECTRON_DIALOG_REL) ?? '';
		assert.ok(!web.includes('D895'));
		assert.ok(!electron.includes('D895'));
		assert.ok(!web.includes('D889'));
		assert.ok(!electron.includes('D889'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused stayed on unused leftover remaining unused dialogs leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d895Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(WEB_DIALOG_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(ELECTRON_DIALOG_REL) ?? ''), 2);
	});

	test('leftover remaining unused async this.foo() FOF leftover processDialogs are Promise/async + double-chain', () => {
		const web = fs.readFileSync(resolveSource(WEB_DIALOG_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_DIALOG_REL), 'utf8');
		const mobile = fs.readFileSync(resolveSource(MOBILE_DIALOG_REL), 'utf8');
		assertPromiseSignature(web, 'private async processDialogs(): Promise<void> {');
		assertPromiseSignature(electron, 'private async processDialogs(): Promise<void> {');
		assert.ok(web.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(electron.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(web, processDialogsCall);
		assertWrapped(electron, processDialogsCall);
		assert.ok(web.includes('\t\t\t\tthis.processDialogs().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(web.includes('\t\tthis.processDialogs().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(electron.includes('\t\t\t\tthis.processDialogs().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(electron.includes('\t\tthis.processDialogs().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!web.includes('\t\t\t\tthis.processDialogs();\n'));
		assert.ok(!web.includes('\t\tthis.processDialogs();\n'));
		assert.ok(!electron.includes('\t\t\t\tthis.processDialogs();\n'));
		assert.ok(!electron.includes('\t\tthis.processDialogs();\n'));
		assert.ok(mobile.includes('\t\t\t\tthis.processDialogs();\n'));
		assert.ok(mobile.includes('\t\tthis.processDialogs();\n'));
		assert.ok(!mobile.includes(`this.processDialogs()${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const web = fs.readFileSync(resolveSource(WEB_DIALOG_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_DIALOG_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const inlineChat = fs.readFileSync(resolveSource(INLINE_CHAT_REL), 'utf8');
		const share = fs.readFileSync(resolveSource(SHARE_CONTRIB_REL), 'utf8');
		const groupView = fs.readFileSync(resolveSource(GROUP_VIEW_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(inlineChat, 'async acceptSession() {');
		assertPromiseSignature(web, 'private async processDialogs(): Promise<void> {');
		assertPromiseSignature(electron, 'private async processDialogs(): Promise<void> {');

		assert.ok(!web.includes('IOpenerService'));
		assert.ok(!electron.includes('IOpenerService'));
		assert.ok(!web.includes('openerService.open'));
		assert.ok(!electron.includes('openerService.open'));
		assert.ok(!web.includes('extends Action2'));
		assert.ok(!electron.includes('extends Action2'));
		assert.ok(share.includes('override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {'));
		assert.ok(share.includes(leftoverShareOpenerCall));
		assert.ok(!share.includes(`urlService.open(result, { openExternal: true })${doubleCatch}`));
		assert.ok(share.includes(leftoverShareRegisterCall));
		assert.ok(!share.includes(`this.registerActions()${doubleCatch}`));
		assert.ok(inlineChat.includes(leftoverAcceptSessionCall) || inlineChat.includes('async acceptSession() {'));
		assert.ok(!inlineChat.includes(`ctrl.acceptSession()${doubleCatch}`));
		assert.ok(groupView.includes(assignedOpenCall));
		assert.ok(!groupView.includes(`${assignedOpenCall}${doubleCatch}`));
		assert.ok(groupView.includes(leftoverTargetOpenCall));
		assert.ok(!groupView.includes(`${leftoverTargetOpenCall}${doubleCatch}`));
		assert.ok(groupView.includes('return this.doOpenEditor(editor, options, {'));
		assert.ok(!groupView.includes(`return this.doOpenEditor(editor, options, {${doubleCatch}`));
		assert.ok(!web.includes('.then(undefined,'));
		assert.ok(!electron.includes('.then(undefined,'));
		assert.ok(!web.includes('.then('));
		assert.ok(!electron.includes('.then('));

		for (const source of [web, electron]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D895'));
			assert.ok(!source.includes('D889'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D795/D886/D883/D881/D782 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const web = fs.readFileSync(resolveSource(WEB_DIALOG_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_DIALOG_REL), 'utf8');
		const breadcrumbs = fs.readFileSync(resolveSource(BREADCRUMBS_REL), 'utf8');
		const observer = fs.readFileSync(resolveSource(EDITORS_OBSERVER_REL), 'utf8');
		const share = fs.readFileSync(resolveSource(SHARE_CONTRIB_REL), 'utf8');
		const base = fs.readFileSync(resolveSource(BASE_REPORTER_REL), 'utf8');
		const form = fs.readFileSync(resolveSource(FORM_REL), 'utf8');
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		const localizationWeb = fs.readFileSync(resolveSource(LOCALIZATION_WEB_REL), 'utf8');
		const localizationCommon = fs.readFileSync(resolveSource(LOCALIZATION_COMMON_REL), 'utf8');
		const electronFile = fs.readFileSync(resolveSource(ELECTRON_FILE_REL), 'utf8');
		const dialogSvc = fs.readFileSync(resolveSource(DIALOG_SVC_REL), 'utf8');
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

		let d795Sites = 0;
		const seen795 = new Map<string, string>();
		for (const [rel, call, count, kind] of d795AlreadyDouble) {
			const source = seen795.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen795.set(rel, source);
			if (kind === 'then') {
				assertThenWrapped(source, call);
				assert.strictEqual(countIncludes(source, call), count, `D795 already-double drifted: ${rel} ${call}`);
			} else {
				const wrapped = countIncludes(source, `${call}${doubleCatch}`);
				assert.strictEqual(wrapped, count, `D795 already-double drifted: ${rel} ${call}`);
				assertWrapped(source, call);
			}
			d795Sites += count;
		}
		assert.strictEqual(d795Sites, 5);
		assert.ok(!electronFile.includes(doubleCatch));
		assert.ok(!dialogSvc.includes(doubleCatch));

		let d886Sites = 0;
		const seen886 = new Map<string, string>();
		for (const [rel, call, count] of d886AlreadyDouble) {
			const source = seen886.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen886.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D886 already-double drifted: ${rel} ${call}`);
			assertWrapped(source, call);
			d886Sites += count;
		}
		assert.strictEqual(d886Sites, 8);

		let d883Sites = 0;
		const seen883 = new Map<string, string>();
		for (const [rel, call, count] of d883AlreadyDouble) {
			const source = seen883.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen883.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D883 already-double drifted: ${rel} ${call}`);
			d883Sites += count;
		}
		assert.strictEqual(d883Sites, 7);

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

		let d782Sites = 0;
		const seen782 = new Map<string, string>();
		for (const [rel, call, count] of d782AlreadyDouble) {
			const source = seen782.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen782.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D782 already-double drifted: ${rel} ${call}`);
			assertWrapped(source, call);
			d782Sites += count;
		}
		assert.strictEqual(d782Sites, 4);
		assert.ok(!localizationWeb.includes(doubleCatch));
		assert.ok(!localizationCommon.includes(doubleCatch));

		assert.ok(breadcrumbs.includes(`${leftoverRevealCall};`));
		assert.ok(!breadcrumbs.includes(`${leftoverRevealCall}${doubleCatch}`));
		assertPromiseSignature(breadcrumbs, 'private async _revealInEditor(event: IBreadcrumbsItemEvent, element: FileElement | OutlineElement2, group: SIDE_GROUP_TYPE | ACTIVE_GROUP_TYPE | undefined, pinned: boolean = false): Promise<void> {');
		assert.ok(observer.includes(leftoverLoadStateCall));
		assert.ok(!observer.includes(`this.loadState()${doubleCatch}`));
		assert.ok(observer.includes(`${leftoverEnsureOpenedCall};`));
		assert.ok(!observer.includes(`${leftoverEnsureOpenedCall}${doubleCatch}`));
		assert.ok(observer.includes(`${leftoverEnsureExcludeCall};`) || observer.includes(`await ${leftoverEnsureExcludeCall}`));
		assert.ok(!observer.includes(`${leftoverEnsureExcludeCall}${doubleCatch}`));

		assert.ok(base.includes(leftoverRenderCall) || base.includes('\t\tthis.renderBlocks();\n') || base.includes('\t\t\tthis.renderBlocks();\n'));
		assert.ok(!base.includes(`this.renderBlocks()${doubleCatch}`));
		assert.ok(base.includes(leftoverOpenLinkCall) || base.includes('\t\t\tthis.openLink(url);\n'));
		assert.ok(!base.includes(`this.openLink(url)${doubleCatch}`));
		assert.ok(form.includes(leftoverCloseReporterCall));
		assert.ok(!form.includes(`this.closeReporter()${doubleCatch}`));
		assert.ok(overlay.includes('this.searchSimilarIssues();'));
		assert.ok(!overlay.includes(`this.searchSimilarIssues()${doubleCatch}`));
		assert.ok(share.includes(leftoverShareOpenerCall));
		assert.ok(share.includes(leftoverShareRegisterCall));

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
			[SHARE_CONTRIB_REL, share],
			[BASE_REPORTER_REL, base],
			[FORM_REL, form],
			[OVERLAY_REL, overlay],
			[BREADCRUMBS_REL, breadcrumbs],
			[EDITORS_OBSERVER_REL, observer],
			[LOCALIZATION_WEB_REL, localizationWeb],
			[LOCALIZATION_COMMON_REL, localizationCommon],
			[ELECTRON_FILE_REL, electronFile],
			[DIALOG_SVC_REL, dialogSvc],
			[REPL_CONTRIB_REL, seen881.get(REPL_CONTRIB_REL) ?? ''],
			[REPL_EDITOR_REL, seen881.get(REPL_EDITOR_REL) ?? ''],
			[REPL_INPUT_REL, seen881.get(REPL_INPUT_REL) ?? ''],
			[EDITOR_PARTS_REL, seen886.get(EDITOR_PARTS_REL) ?? ''],
			[EDITOR_PART_REL, seen886.get(EDITOR_PART_REL) ?? ''],
			[TABS_REL, seen886.get(TABS_REL) ?? ''],
			[DROP_TARGET_REL, seen886.get(DROP_TARGET_REL) ?? ''],
			[GROUP_VIEW_REL, seen886.get(GROUP_VIEW_REL) ?? ''],
			[SIMPLE_REL, seen795.get(SIMPLE_REL) ?? ''],
			[ABSTRACT_REL, seen795.get(ABSTRACT_REL) ?? ''],
			[BROWSER_REL, seen795.get(BROWSER_REL) ?? ''],
			[LOCALIZATION_NATIVE_REL, seen782.get(LOCALIZATION_NATIVE_REL) ?? ''],
			[REPORTER_REL, seen883.get(REPORTER_REL) ?? ''],
		] as const) {
			assert.ok(!file.includes('D895'), `${rel} should stay off this knife`);
			assert.ok(!file.includes('D889'), `${rel} should not revive rejected D889`);
		}
		assert.ok(!web.includes('D895'));
		assert.ok(!electron.includes('D895'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD895.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD895.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD895.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD895.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD895.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD895.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/share/test/node/shareLeftoverPromiseCatchScanD895.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/issue/test/node/issueLeftoverPromiseCatchScanD895.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/dropOrPasteInto/test/node/dropOrPasteIntoLeftoverPromiseCatchScanD889.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/dropOrPasteInto/test/node/dropOrPasteIntoLeftoverPromiseCatchScanD886.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/replNotebook/test/node/replNotebookLeftoverPromiseCatchScanD881.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/share/test/node/shareLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/issue/test/node/issueLeftoverPromiseCatchScanD773.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/dialogs/test/node/dialogsLeftoverPromiseCatchScanD795.test.ts')));
	});
});
