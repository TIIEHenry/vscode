/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');

suite('Sources - Changes git read - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Changes and Review lists read Git when connected; FileDiff is open-time only', () => {
		const changes = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		const open = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'), 'utf8');

		assert.ok(changes.includes('tryLoadSourcesGitChangeEntries'));
		assert.ok(changes.includes('hasSourcesGitReadEntries'));
		assert.ok(changes.includes('tryReadSourcesGitFileDiff'));
		assert.ok(changes.includes('collectSourcesChangeEntries'));
		assert.ok(changes.includes('IConversationRosterService'));
		assert.ok(changes.includes('getActiveSessionId'));
		assert.ok(review.includes('tryLoadSourcesGitChangeEntries'));
		assert.ok(review.includes('hasSourcesGitReadEntries'));
		assert.ok(review.includes('tryReadSourcesGitFileDiff'));
		assert.ok(review.includes('IConversationRosterService'));
		assert.ok(review.includes('getActiveSessionId'));
		assert.ok(review.includes('collectSourcesReviewEntries'));
		assert.ok(review.includes('sourcesGitReadFailureMessage'));
		assert.ok(review.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(review.includes('sources-review-status'));
		assert.ok(review.includes('gitReadError'));
		assert.ok(changes.includes('sourcesGitReadFailureMessage'));
		assert.ok(changes.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(open.includes('needsSourcesGitFileDiff'));
		assert.ok(open.includes('readGitFileDiff'));

		const loadStart = changes.indexOf('private async tryLoadGitEntries');
		const loadEnd = changes.indexOf('private getGitResourceRoot', loadStart);
		assert.ok(loadStart >= 0 && loadEnd > loadStart);
		assert.ok(!changes.slice(loadStart, loadEnd).includes('tryReadSourcesGitFileDiff'));
	});
});

suite('Sources - Changes git write - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Changes Stage / Commit write; Unstage stays on git.unstage', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		assert.ok(source.includes('tryWriteSourcesGitStagePaths'));
		assert.ok(source.includes('tryWriteSourcesGitCommit'));
		assert.ok(source.includes('getActiveSessionId'));
		assert.ok(source.includes('IConversationRosterService'));
		assert.ok(source.includes('isSourcesGitWriteAccepted'));
		assert.ok(source.includes('isSourcesGitWriteUnsupported'));
		assert.ok(source.includes('SOURCES_GIT_UNSTAGE_COMMAND'));
		assert.ok(source.includes('resolveSourcesChangesRowAction'));
		assert.ok(source.includes('sourcesGitUnstageUnavailableMessage'));
		assert.ok(source.includes('rowAction === \'unstageUnavailable\''));
		assert.ok(!source.includes('tryWriteSourcesGitApplyHunks'));
		assert.ok(!source.includes('writeGitUnstage'));
	});
	test('Changes list Stage / Unstage / Commit button clicks double-catch onUnexpectedError', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes(`this.stageSelectedButton.onDidClick(() => void this.runOnSelected('stage')${doubleCatch})`));
		assert.ok(source.includes(`this.unstageSelectedButton.onDidClick(() => void this.runOnSelected('unstage')${doubleCatch})`));
		assert.ok(source.includes(`this.commitButton.onDidClick(() => void this.runCommit()${doubleCatch})`));
		assert.ok(!source.includes("this.stageSelectedButton.onDidClick(() => this.runOnSelected('stage'));"));
		assert.ok(!source.includes("this.unstageSelectedButton.onDidClick(() => this.runOnSelected('unstage'));"));
		assert.ok(!source.includes('this.commitButton.onDidClick(() => this.runCommit());'));
	});
	test('Review Accept writes ApplyHunks only with payload; empty reject does not git.stage; Stage stays on Stage', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'), 'utf8');
		assert.ok(source.includes('tryWriteSourcesGitApplyHunks'));
		assert.ok(source.includes('tryWriteSourcesGitStagePaths'));
		assert.ok(source.includes('attemptSourcesGitWrite'));
		assert.ok(source.includes('resolveSourcesDiffWriteActions'));
		assert.ok(source.includes('hasSourcesGitApplyHunksPayload'));
		assert.ok(source.includes('isConversationPairingHold'));
		assert.ok(source.includes('getActiveSessionId'));
		assert.ok(source.includes('SOURCES_GIT_CLEAN_COMMAND'));
		assert.ok(source.includes('SOURCES_GIT_UNSTAGE_COMMAND'));
		assert.ok(source.includes('sourcesGitUnstageUnavailableMessage'));
		assert.ok(source.includes('runGitAction(SOURCES_GIT_STAGE_COMMAND)'));
		assert.ok(!source.includes('writeGitUnstage'));
		const runAcceptStart = source.indexOf('private async runAccept(');
		assert.ok(runAcceptStart >= 0);
		const runAcceptEnd = source.indexOf('\n\tprivate ', runAcceptStart + 1);
		const runAccept = source.slice(runAcceptStart, runAcceptEnd > runAcceptStart ? runAcceptEnd : undefined);
		assert.ok(runAccept.includes('isConversationPairingHold'));
		assert.ok(!runAccept.includes('SOURCES_GIT_STAGE_COMMAND'));
		assert.ok(!runAccept.includes('git.stage'));
		const runStageStart = source.indexOf('private async runStage(');
		assert.ok(runStageStart >= 0);
		const runStageEnd = source.indexOf('\n\tprivate ', runStageStart + 1);
		const runStage = source.slice(runStageStart, runStageEnd > runStageStart ? runStageEnd : undefined);
		assert.ok(runStage.includes('isConversationPairingHold'));
		const runGitActionStart = source.indexOf('private async runGitAction(');
		assert.ok(runGitActionStart >= 0);
		const runGitActionEnd = source.indexOf('\n\tprivate ', runGitActionStart + 1);
		const runGitAction = source.slice(runGitActionStart, runGitActionEnd > runGitActionStart ? runGitActionEnd : undefined);
		assert.ok(runGitAction.includes('catch'));
		assert.ok(runGitAction.includes('this.hideNotice()'));
		assert.ok(runGitAction.includes('this.showNotice(getErrorMessage(error))'));
		assert.ok(runGitAction.includes('finally'));
		assert.ok(runGitAction.includes('this.updateReviewActions()'));
	});
	test('Review pane fire-and-forget voids double-catch onUnexpectedError', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		assert.ok(source.includes(`void this.runGitAction(SOURCES_GIT_CLEAN_COMMAND)${doubleCatch}`));
		assert.ok(source.includes(`void this.runGitAction(SOURCES_GIT_UNSTAGE_COMMAND)${doubleCatch}`));
		assert.ok(source.includes(`void this.runStage()${doubleCatch}`));
		assert.ok(source.includes(`void this.runAccept()${doubleCatch}`));
		assert.ok(source.includes(`void this.commandService.executeCommand('sources.diff.moveToPreview')${doubleCatch}`));
		assert.ok(!source.includes('void this.runGitAction(SOURCES_GIT_CLEAN_COMMAND);'));
		assert.ok(!source.includes('void this.runGitAction(SOURCES_GIT_UNSTAGE_COMMAND);'));
		assert.ok(!source.includes('void this.runStage();'));
		assert.ok(!source.includes('void this.runAccept();'));
		assert.ok(!source.includes("void this.commandService.executeCommand('sources.diff.moveToPreview');"));
	});
	test('Panel Diff write actions share the Review write gate; Accept does not git.stage', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts'), 'utf8');
		assert.ok(source.includes('tryWriteSourcesGitStagePaths'));
		assert.ok(source.includes('tryWriteSourcesGitApplyHunks'));
		assert.ok(source.includes('attemptSourcesGitWrite'));
		assert.ok(source.includes('resolveSourcesDiffWriteActions'));
		assert.ok(source.includes('hasSourcesGitApplyHunksPayload'));
		assert.ok(source.includes('isConversationPairingHold'));
		assert.ok(source.includes('getActiveSessionId'));
		assert.ok(source.includes('SOURCES_GIT_CLEAN_COMMAND'));
		assert.ok(source.includes('SOURCES_GIT_UNSTAGE_COMMAND'));
		assert.ok(source.includes('sourcesGitUnstageUnavailableMessage'));
		assert.ok(source.includes('runGitAction(SOURCES_GIT_STAGE_COMMAND)'));
		assert.ok(!source.includes('writeGitUnstage'));
		const runAcceptStart = source.indexOf('private async runAccept(');
		assert.ok(runAcceptStart >= 0);
		const runAcceptEnd = source.indexOf('\n\tprivate ', runAcceptStart + 1);
		const runAccept = source.slice(runAcceptStart, runAcceptEnd > runAcceptStart ? runAcceptEnd : undefined);
		assert.ok(runAccept.includes('isConversationPairingHold'));
		assert.ok(!runAccept.includes('SOURCES_GIT_STAGE_COMMAND'));
		assert.ok(!runAccept.includes('git.stage'));
		const runStageStart = source.indexOf('private async runStage(');
		assert.ok(runStageStart >= 0);
		const runStageEnd = source.indexOf('\n\tprivate ', runStageStart + 1);
		const runStage = source.slice(runStageStart, runStageEnd > runStageStart ? runStageEnd : undefined);
		assert.ok(runStage.includes('isConversationPairingHold'));
	});
});

suite('Sources - review list model - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Review list surfaces git read failure on a status line instead of a silent catch', () => {
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		assert.ok(review.includes('sourcesGitReadFailureMessage'));
		assert.ok(review.includes('setStatusMessage'));
		assert.ok(review.includes('sources-review-status'));
		assert.ok(!review.includes('} catch {\n\t\t\tif (seq !== this.refreshSeq)'));
	});
	test('Review list surfaces open-diff failure on the same status line and does not mark reviewed', () => {
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		const openStart = review.indexOf('this._register(this.list.onDidOpen');
		const openEnd = review.indexOf('this._register(this.list.onContextMenu', openStart);
		assert.ok(openStart >= 0 && openEnd > openStart);
		const openHandler = review.slice(openStart, openEnd);
		assert.ok(openHandler.includes('markReviewedAfterSuccessfulOpen'));
		assert.ok(openHandler.includes('} catch (error)'));
		assert.ok(openHandler.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(openHandler.includes('setStatusMessage'));
		assert.ok(!openHandler.includes('} catch {'));
	});
	test('Changes list does not reference review progress service', () => {
		const changesListPath = path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts');
		const source = fs.readFileSync(changesListPath, 'utf8');
		assert.ok(!source.includes('ISourcesReviewProgressService'));
		assert.ok(!source.includes('sourcesReviewProgress'));
	});
});

suite('Sources - review progress service - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('does not import IStorageService', () => {
		const servicePath = path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts');
		const source = fs.readFileSync(servicePath, 'utf8');
		assert.ok(!source.includes('IStorageService'));
		assert.ok(!source.includes('platform/storage'));
	});
});

suite('Sources - files list leftover - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Files collect does not swallow fetchChildren throw as empty workspace', () => {
		const model = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/sourcesFilesModel.ts'), 'utf8');
		const list = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesFilesList.ts'), 'utf8');
		assert.ok(!model.includes('} catch {\n\t\t\treturn;'));
		assert.ok(model.includes('resolveSourcesFilesCollectResult'));
		assert.ok(list.includes('sourcesFilesListReadFailureMessage'));
		assert.ok(list.includes('lastGoodEntries'));
		assert.ok(list.includes('sources-files-status'));
		assert.ok(list.includes("classList.add('is-error')"));
		const filesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesFilesList.css'), 'utf8');
		assert.ok(filesCss.includes('.sources-files-empty.is-error'));
		assert.ok(filesCss.includes('.sources-files-status.is-error'));
	});
	test('Files list scheduler and onDidOpen use double catch', () => {
		const list = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesFilesList.ts'), 'utf8');
		const schedulerStart = list.indexOf('this.refreshScheduler = this._register(new RunOnceScheduler');
		const schedulerEnd = list.indexOf('this.scheduleRefresh();', schedulerStart);
		assert.ok(schedulerStart >= 0 && schedulerEnd > schedulerStart);
		const scheduler = list.slice(schedulerStart, schedulerEnd);
		assert.ok(scheduler.includes('void this.refresh()'));
		assert.ok(scheduler.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));

		const openStart = list.indexOf('this._register(this.list.onDidOpen');
		const openEnd = list.indexOf('return this.list;', openStart);
		assert.ok(openStart >= 0 && openEnd > openStart);
		const openHandler = list.slice(openStart, openEnd);
		assert.ok(openHandler.includes('openEditor'));
		assert.ok(openHandler.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!openHandler.includes('async e =>'));
	});
});

suite('Sources - review showForPaths - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Open Selected catch surfaces open-diff failure the same way as Review list', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewCommands.contribution.ts'), 'utf8');
		const openStart = source.indexOf('class SourcesReviewOpenSelectedAction');
		const openEnd = source.indexOf('class SourcesReviewToggleReviewedSelectedAction', openStart);
		assert.ok(openStart >= 0 && openEnd > openStart);
		const openAction = source.slice(openStart, openEnd);
		assert.ok(openAction.includes('markReviewedAfterSuccessfulOpen'));
		assert.ok(openAction.includes('} catch (error)'));
		assert.ok(openAction.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(openAction.includes('setStatusMessage'));
		assert.ok(openAction.includes('isSourcesGitFileDiffOpenSkipped'));
		assert.ok(openAction.includes('isSourcesGitWriteClosed'));
		assert.ok(openAction.includes('readGitFileDiff'));
		assert.ok(openAction.includes('tryReadSourcesGitFileDiff'));
		assert.ok(!openAction.includes('} catch {'));
	});
	test('Changes and Review leftover onDidOpen skip KEEP pairing-hold leftover as well as list-fail', () => {
		const changes = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		const changesOpenStart = changes.indexOf('this._register(this.list.onDidOpen');
		const changesOpenEnd = changes.indexOf('this._register(this.list.onDidChangeSelection', changesOpenStart);
		const reviewOpenStart = review.indexOf('this._register(this.list.onDidOpen');
		const reviewOpenEnd = review.indexOf('this._register(this.list.onContextMenu', reviewOpenStart);
		assert.ok(changesOpenStart >= 0 && changesOpenEnd > changesOpenStart);
		assert.ok(reviewOpenStart >= 0 && reviewOpenEnd > reviewOpenStart);
		const changesOpen = changes.slice(changesOpenStart, changesOpenEnd);
		const reviewOpen = review.slice(reviewOpenStart, reviewOpenEnd);
		assert.ok(changesOpen.includes('isSourcesGitFileDiffOpenSkipped'));
		assert.ok(reviewOpen.includes('isSourcesGitFileDiffOpenSkipped'));
		assert.ok(changes.includes('shouldSkipSourcesGitFileDiffOpen'));
		assert.ok(review.includes('shouldSkipSourcesGitFileDiffOpen'));
	});
});

suite('Sources - custom UI visual CSS - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Accept hover is not covered by secondary button hover', () => {
		const reviewPane = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/conversationDiffReviewPane.css'), 'utf8');
		const panel = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesDiffPanel.css'), 'utf8');
		assert.ok(reviewPane.includes('button:not(.conversation-diff-review-accept):hover:not(:disabled)'));
		assert.ok(reviewPane.includes('button.conversation-diff-review-accept:hover:not(:disabled)'));
		assert.ok(!reviewPane.includes('.conversation-diff-review-toolbar button:hover:not(:disabled)'));
		assert.ok(panel.includes('button:not(.sources-diff-panel-accept):hover:not(:disabled)'));
		assert.ok(panel.includes('button.sources-diff-panel-accept:hover:not(:disabled)'));
		assert.ok(!panel.includes('.sources-diff-panel-actions button:hover:not(:disabled)'));
	});

	test('Diff panel actions wrap; review status error tone is throw-only', () => {
		const panel = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesDiffPanel.css'), 'utf8');
		const reviewCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesReviewList.css'), 'utf8');
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		assert.ok(panel.includes('.sources-diff-panel-header {\n\tdisplay: flex;\n\tflex-wrap: wrap;'));
		assert.ok(panel.includes('flex: 1 1 auto;'));
		assert.ok(panel.includes('justify-content: flex-end;'));
		assert.ok(reviewCss.includes('.sources-review-status.is-error'));
		assert.ok(review.includes("classList.toggle('is-error'"));
		assert.ok(review.includes('this.setStatusMessage(gitReadError, true)'));
		assert.ok(review.includes('this.setStatusMessage(sourcesGitDiffOpenFailureMessage(error), true)'));
		assert.ok(!review.includes('this.setStatusMessage(sourcesGitReadPairingHoldMessage(), true)'));
		assert.ok(!review.includes('this.setStatusMessage(sourcesGitReadUnavailableNoHookMessage(), true)'));
		assert.ok(!review.includes('this.setStatusMessage(sourcesGitLocalOnlyMessage(), true)'));
	});

	test('Diff renderRef uses a generation gate; Changes status has error tone', () => {
		const diff = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts'), 'utf8');
		const changes = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		const changesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesChangesList.css'), 'utf8');
		assert.ok(diff.includes('renderGeneration'));
		assert.ok(diff.includes('generation !== this.renderGeneration'));
		assert.ok(changes.includes("classList.toggle('is-error'"));
		assert.ok(changes.includes("gitReadError && !hasAnyEntries"));
		assert.ok(changesCss.includes('.sources-changes-status.is-error'));
		assert.ok(!changes.includes('no git changes API'));
	});

	test('Sources hide control is a close glyph; Files leftover status and Diff notices use error tone', () => {
		const hide = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/partRegionHideControl.ts'), 'utf8');
		const files = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesFilesList.ts'), 'utf8');
		const filesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesFilesList.css'), 'utf8');
		const diff = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts'), 'utf8');
		const diffCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesDiffPanel.css'), 'utf8');
		const reviewPane = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'), 'utf8');
		const reviewCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/conversationDiffReviewPane.css'), 'utf8');
		assert.ok(hide.includes('Codicon.close'));
		assert.ok(hide.includes('actionBar.setFocusable(true)'));
		assert.ok(files.includes("classList.add('is-error')"));
		assert.ok(filesCss.includes('.sources-files-status.is-error'));
		assert.ok(diff.includes("actionNoticeElement.classList.add('is-error')"));
		assert.ok(diff.includes("newFileNoticeElement.classList.add('is-error')"));
		assert.ok(diffCss.includes('.sources-diff-panel-action-notice.is-error'));
		assert.ok(reviewPane.includes('classList.toggle(\'is-error\', isError)'));
		assert.ok(reviewPane.includes('renderGeneration'));
		assert.ok(reviewCss.includes('.conversation-diff-review-notice.is-error'));
	});

	test('Conversation Diff matches original+group and opens beside chat', () => {
		const open = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'), 'utf8');
		const helpers = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.ts'), 'utf8');
		const input = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewInput.ts'), 'utf8');
		const common = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/conversationDiffReviewInput.ts'), 'utf8');
		assert.ok(open.includes('CONVERSATION_SIDE_GROUP'));
		assert.ok(!open.includes('CONVERSATION_GROUP'));
		assert.ok(helpers.includes('CONVERSATION_SIDE_GROUP'));
		assert.ok(input.includes('this._groupId === other._groupId'));
		assert.ok(common.includes('/group/'));
	});
});
