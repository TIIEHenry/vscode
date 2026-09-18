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
const BULK_PANE_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const BULK_PREVIEW_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPreview.ts';
const BULK_CONTRIB_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEdit.contribution.ts';
const OUTLINE_PANE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const STATUSBAR_REL = 'src/vs/workbench/browser/parts/statusbar/statusbarItem.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';
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
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXTMODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const SCM_HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
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

const executeCommandCall = 'this.executeCommand(command)';
const setTreeInputCall = 'this._setTreeInput(input)';
const applyPreviewCall = 'this._applyTextEditsToPreviewModel(uri)';
const previewEditCall = 'this._previewEdit(edits)';
const handleEditorControlCall = 'this._handleEditorControlChanged(pane)';
const updateCall = 'this._update()';
const researchCall = 'this.research()';
const launchCall = 'this.launchOrAttachToSession(session)';
const showErrorCall = 'this.showError(err.message, undefined, !!launch?.getConfiguration(config.name))';
const toggleCall = 'this.toggleExceptionWidget()';
const submitCall = 'this.submitSearch()';
const refreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
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
const leftoverNoArgTriggerCall = '() => this.triggerSearch()';
const leftoverOpenAndShowCall = 'this.openAndShow(messageItReferenceToUri(m))';
const leftoverResolveEditorCall = 'this.resolveEditorModel(resource, false /* do not create if missing */)';
const leftoverLoadMoreCall = 'this._loadMore()';
const leftoverSyncCall = 'this.sync()';
const leftoverShowChannelCall = 'this.showChannel(';

const d857Calls: Array<[string, string, number]> = [
	[STATUSBAR_REL, executeCommandCall, 4],
];

suite('leftover remaining unused after bulkEdit leftover remaining unused overflowed through leftover remaining unused outline leftover remaining unused Promise fire-and-forget catch scan (D857)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused bulkEdit leftover remaining unused after discarding already-double had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const pane = fs.readFileSync(resolveSource(BULK_PANE_REL), 'utf8');
		const preview = fs.readFileSync(resolveSource(BULK_PREVIEW_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(BULK_CONTRIB_REL), 'utf8');
		assertPromiseSignature(pane, 'private async _setTreeInput(input: BulkFileOperations) {');
		assertPromiseSignature(preview, 'private async _applyTextEditsToPreviewModel(uri: URI) {');
		assertPromiseSignature(contrib, 'private async _previewEdit(edits: ResourceEdit[]): Promise<ResourceEdit[]> {');
		assert.ok(pane.includes(`${setTreeInputCall}${doubleCatch}`));
		assert.ok(preview.includes(`${applyPreviewCall}${doubleCatch}`));
		assert.ok(contrib.includes(`bulkEditService.setPreviewHandler(edits => ${previewEditCall})`));
		assert.ok(!contrib.includes(`${previewEditCall}${doubleCatch}`));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused bulkEdit legal leftover <4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!pane.includes('D857'));
		assert.ok(!preview.includes('D857'));
		assert.ok(!contrib.includes('D857'));
	});

	test('leftover remaining unused outline leftover remaining unused after discarding assigned handleEditor / already-double had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const pane = fs.readFileSync(resolveSource(OUTLINE_PANE_REL), 'utf8');
		assertPromiseSignature(pane, 'private async _handleEditorControlChanged(pane: IEditorPane | undefined): Promise<void> {');
		assert.ok(pane.includes(`${handleEditorControlCall};`));
		assert.ok(!pane.includes(`${handleEditorControlCall}${doubleCatch}`));
		assert.ok(pane.includes(`void Promise.resolve((async () => {`));
		assert.ok(pane.includes(`})())${doubleCatch};`));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused outline legal leftover <4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!pane.includes('D857'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused overflowed to leftover remaining unused statusbar leftover remaining unused executeCommand', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d857Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(STATUSBAR_REL) ?? ''), 4);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(STATUSBAR_REL), 'utf8');
		assertPromiseSignature(source, 'private async executeCommand(command: string | Command): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, executeCommandCall);
		assert.strictEqual(countIncludes(source, `${executeCommandCall}${doubleCatch}`), 4);
		assert.ok(!source.includes('\t\t\t\t\t\tthis.executeCommand(command);\n'));
		assert.ok(!source.includes('() => this.executeCommand(command));'));
		assert.ok(!source.includes('() => this.executeCommand(command)\n'));
		assert.ok(!source.includes(`await this.executeCommand(command)${doubleCatch}`));
		assert.ok(source.includes('await this.commandService.executeCommand(id, ...args);'));
		assert.ok(!source.includes(`await this.commandService.executeCommand(id, ...args)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(STATUSBAR_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(BULK_PANE_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_PANE_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'private async executeCommand(command: string | Command): Promise<void> {');

		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('IOpenerService'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(!source.includes('async run('));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(!source.includes('return this.executeCommand('));
		assert.ok(!source.includes('await this.executeCommand('));

		assert.ok(pane.includes(`${setTreeInputCall}${doubleCatch}`));
		assert.ok(outline.includes(`${handleEditorControlCall};`));
		assert.ok(!outline.includes(`${handleEditorControlCall}${doubleCatch}`));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D857'));
	});

	test('locked leftover remaining stay leftover remaining unused; already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const source = fs.readFileSync(resolveSource(STATUSBAR_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
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
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const markers = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const scmHistory = fs.readFileSync(resolveSource(SCM_HISTORY_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');

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

		assert.ok(searchEditor.includes(leftoverNoArgTriggerCall));
		assert.ok(!searchEditor.includes(`${leftoverNoArgTriggerCall}${doubleCatch}`));
		assert.ok(testing.includes(leftoverOpenAndShowCall) || testing.includes('this.openAndShow('));
		assert.ok(!testing.includes(`${leftoverOpenAndShowCall}${doubleCatch}`));
		assert.ok(files.includes(leftoverResolveEditorCall) || files.includes(`${leftoverResolveEditorCall}${doubleCatch}`));
		assert.ok(scmHistory.includes(`${leftoverLoadMoreCall}${doubleCatch}`) || scmHistory.includes('this._loadMore()'));
		assert.ok(discovery.includes(`${leftoverSyncCall}${doubleCatch}`) || discovery.includes('this.sync()'));
		assert.ok(output.includes(leftoverShowChannelCall));

		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.ok(status.includes(`${updateCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${showErrorCall}${doubleCatch}`));
		assert.ok(debugEditor.includes(`${toggleCall}${doubleCatch}`));
		assert.ok(searchWidget.includes(`${submitCall}${doubleCatch}`));
		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));

		for (const [rel, file] of [
			[FIND_MODEL_REL, findModel],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
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
			[STATUS_REL, status],
			[TESTING_REL, testing],
			[MARKERS_REL, markers],
			[FILES_REL, files],
			[SCM_HISTORY_REL, scmHistory],
			[MCP_DISCOVERY_REL, discovery],
			[OUTPUT_SERVICES_REL, output],
		] as const) {
			assert.ok(!file.includes('D857'), `${rel} should stay off this knife`);
		}
		assert.ok(!source.includes('D857'));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD855.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD857.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD857.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD857.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD857.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD857.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD857.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/outline/test/node/outlineLeftoverPromiseCatchScanD857.test.ts')));
	});
});
