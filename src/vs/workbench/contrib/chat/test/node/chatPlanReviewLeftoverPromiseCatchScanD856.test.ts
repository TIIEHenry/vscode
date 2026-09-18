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
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';

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

const clearAllCall = 'this.clearAllInlineFeedback()';
const exitFeedbackCall = 'this.exitFeedbackMode()';
const revealCall = 'this.revealInlineComment(item)';
const submitRejectionCall = 'this.submitRejection()';
const submitApprovalActionCall = 'this.submitApproval(action)';
const submitApprovalPrimaryCall = 'this.submitApproval(primary)';
const leftoverEnterReviewCall = '() => void this.enterReviewMode()';
const leftoverSubmitFeedbackCall = 'submitFeedback: () => this.submitFeedback(),';
const returnedSubmitActionCall = 'submitAction: action => this.submitApproval(action),';
const returnedRejectCall = 'reject: () => this.submitRejection(),';
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
const updateCall = 'this._update()';
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

const d856Calls: Array<[string, string, number]> = [
	[PLAN_REVIEW_REL, clearAllCall, 1],
	[PLAN_REVIEW_REL, exitFeedbackCall, 1],
	[PLAN_REVIEW_REL, revealCall, 1],
	[PLAN_REVIEW_REL, submitRejectionCall, 2],
	[PLAN_REVIEW_REL, submitApprovalActionCall, 1],
	[PLAN_REVIEW_REL, submitApprovalPrimaryCall, 1],
];

suite('leftover remaining unused chatPlanReview leftover Promise fire-and-forget catch scan (D856)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused chatPlanReview leftover async this.foo() FOF still had four or more legal unused leftover sites so this knife stayed', () => {
		const source = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		assertPromiseSignature(source, 'private async clearAllInlineFeedback(): Promise<void> {');
		assertPromiseSignature(source, 'private async exitFeedbackMode(): Promise<void> {');
		assertPromiseSignature(source, 'private async revealInlineComment(item: IPlanReviewFeedbackItem): Promise<void> {');
		assertPromiseSignature(source, 'private async submitRejection(): Promise<void> {');
		assertPromiseSignature(source, 'private async submitApproval(action: IChatPlanApprovalAction): Promise<void> {');
		let sites = 0;
		for (const [, call, count] of d856Calls) {
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused chatPlanReview legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D856'));
	});

	test('this knife covers seven leftover Promise double-chain sites after leftover remaining unused stayed on chatPlanReview', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d856Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(PLAN_REVIEW_REL) ?? ''), 14);
	});

	test('chatPlanReview leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		assertPromiseSignature(source, 'private async clearAllInlineFeedback(): Promise<void> {');
		assertPromiseSignature(source, 'private async exitFeedbackMode(): Promise<void> {');
		assertPromiseSignature(source, 'private async revealInlineComment(item: IPlanReviewFeedbackItem): Promise<void> {');
		assertPromiseSignature(source, 'private async submitRejection(): Promise<void> {');
		assertPromiseSignature(source, 'private async submitApproval(action: IChatPlanApprovalAction): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assertWrapped(source, clearAllCall);
		assertWrapped(source, exitFeedbackCall);
		assertWrapped(source, revealCall);
		assertWrapped(source, submitRejectionCall);
		assertWrapped(source, submitApprovalActionCall);
		assertWrapped(source, submitApprovalPrimaryCall);
		assert.strictEqual(countIncludes(source, `${clearAllCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${exitFeedbackCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${revealCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${submitRejectionCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(source, `${submitApprovalActionCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${submitApprovalPrimaryCall}${doubleCatch}`), 1);
		assert.ok(!source.includes('\t\t\tthis._register(clearAllButton.onDidClick(() => this.clearAllInlineFeedback()));\n'));
		assert.ok(!source.includes('\t\t\tthis._register(closeButton.onDidClick(() => this.exitFeedbackMode()));\n'));
		assert.ok(!source.includes('\t\t\t\tthis.revealInlineComment(item);\n'));
		assert.ok(!source.includes('\t\t\t\tthis._buttonStore.add(rejectButton.onDidClick(() => this.submitRejection()));\n'));
		assert.ok(!source.includes('\t\t\t\t\t\t\tthis.submitApproval(action);\n'));
		assert.ok(!source.includes('\t\tthis._buttonStore.add(approveButton.onDidClick(() => this.submitApproval(primary)));\n'));
		assert.ok(source.includes(leftoverEnterReviewCall));
		assert.ok(!source.includes(`void this.enterReviewMode()${doubleCatch}`));
		assert.ok(source.includes(leftoverSubmitFeedbackCall));
		assert.ok(!source.includes(`submitFeedback: () => this.submitFeedback()${doubleCatch}`));
		assert.ok(source.includes(`${markUsedCall}${doubleCatch}`));
		assert.ok(source.includes(`${enterFeedbackCall}${doubleCatch}`));
		assert.ok(source.includes(`${submitFeedbackVoidCall}${doubleCatch}`));
		assert.ok(source.includes('await this.markUsed();'));
		assert.ok(!source.includes(`await this.markUsed()${doubleCatch}`));
		assert.ok(source.includes('await this.enterFeedbackMode({ focus: true });'));
		assert.ok(!source.includes(`await this.enterFeedbackMode({ focus: true })${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'private async submitApproval(action: IChatPlanApprovalAction): Promise<void> {');

		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('IOpenerService'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(!source.includes('registerAction2'));
		assert.ok(!source.includes('async run('));
		assert.ok(source.includes(returnedSubmitActionCall));
		assert.ok(!source.includes(`submitAction: action => this.submitApproval(action)${doubleCatch}`));
		assert.ok(source.includes(returnedRejectCall));
		assert.ok(!source.includes(`reject: () => this.submitRejection()${doubleCatch}`));
		assert.ok(source.includes('\t\t\t\t\t\t\treturn Promise.resolve();\n'));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(!source.includes('return this.submitApproval'));
		assert.ok(!source.includes('return this.submitRejection'));
		assert.ok(!source.includes('return this.clearAllInlineFeedback'));
		assert.ok(!source.includes('return this.exitFeedbackMode'));
		assert.ok(!source.includes('return this.revealInlineComment'));
		assert.ok(!source.includes('await this.clearAllInlineFeedback'));
		assert.ok(!source.includes('await this.exitFeedbackMode'));
		assert.ok(!source.includes('await this.revealInlineComment'));
		assert.ok(!source.includes('await this.submitRejection'));
		assert.ok(!source.includes('await this.submitApproval'));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D856'));
	});

	test('locked leftover remaining stay leftover remaining unused; D839/D840/D841/D843/D844/D847/D851/D834/D837 already-double stay already-double; this knife did not overflow', () => {
		const source = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
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
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');

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
		assert.ok(unification.includes(`${updateCall}${doubleCatch}`));
		assert.ok(mgmt.includes(`${switchProfileCall}${doubleCatch}`));

		assert.ok(source.includes(leftoverEnterReviewCall));
		assert.ok(source.includes(leftoverSubmitFeedbackCall));
		assert.ok(source.includes(returnedSubmitActionCall));
		assert.ok(source.includes(returnedRejectCall));
		assert.strictEqual(countIncludes(source, `${markUsedCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(source, `${enterFeedbackCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(source, `${submitFeedbackVoidCall}${doubleCatch}`), 2);

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
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TEXT_MODEL_REL, textModel],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[FIND_MODEL_REL, findModel],
			[PROFILE_MODEL_REL, profileModel],
		] as const) {
			assert.ok(!file.includes('D856'), `${rel} should stay off this knife`);
		}
		assert.ok(!source.includes('D856'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD856.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD856.test.ts')));
	});
});
