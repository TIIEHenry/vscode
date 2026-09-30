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

function sliceSourcesPrivate(source: string, signature: string): string {
	const start = source.indexOf(signature);
	assert.ok(start >= 0, signature);
	const end = source.indexOf('\n\tprivate ', start + signature.length);
	return source.slice(start, end > start ? end : undefined);
}

function assertAcceptClickContract(source: string): void {
	const runAccept = sliceSourcesPrivate(source, 'private async runAccept(');
	assert.ok(runAccept.includes('readGitFileDiff'));
	assert.ok(runAccept.includes('SOURCES_GIT_APPLY_CACHED_ARGV'));
	assert.ok(runAccept.includes('SOURCES_GIT_ACCEPT_FILE_DIFF_INDEX_STATE'));
	assert.ok(runAccept.includes('sourcesGitHunkPatchAtCursor'));
	assert.ok(runAccept.includes('scheduleRefresh'));
	assert.ok(runAccept.includes('isPairingHold'));
	assert.ok(runAccept.includes('hasSourcesGitApplyHunksPayload'));
	assert.ok(!runAccept.includes('sourcesGitApplyHunksPatches'));
	assert.ok(!runAccept.includes('parseSourcesGitUnifiedDiff'));
	assert.ok(!runAccept.includes('getLineContent'));
	assert.ok(!runAccept.includes('getValue'));
	assert.ok(!runAccept.includes('git.stage'));
	assert.ok(!runAccept.includes('SOURCES_GIT_STAGE_COMMAND'));
	assert.ok(!runAccept.includes('-R'));
	const readCursor = sliceSourcesPrivate(source, 'private readAcceptCursor(');
	assert.ok(readCursor.includes('getPosition'));
	assert.ok(!readCursor.includes('getLineContent'));
	assert.ok(!readCursor.includes('getValue'));
	assert.ok(!readCursor.includes('.getModel('));
	const bindCursor = sliceSourcesPrivate(source, 'private bindAcceptCursor(');
	assert.ok(!bindCursor.includes('getLineContent'));
	assert.ok(!bindCursor.includes('getValue'));
	assert.ok(!bindCursor.includes('.getModel('));
}

suite('Sources - Changes git read - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Changes and Review lists read Git when connected; FileDiff is open-time only', () => {
		const changes = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		const readModel = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/sourcesChangesReadModel.ts'), 'utf8');
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		const open = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'), 'utf8');
		const sourcesContribution = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sources.contribution.ts'), 'utf8');
		const conversationContribution = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversation.contribution.ts'), 'utf8');
		const sessionContext = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/agentSessionContext.ts'), 'utf8');

		assert.ok(readModel.includes('tryLoadSourcesGitChangeEntries'));
		assert.ok(readModel.includes('sourcesGitReadFailureMessage'));
		assert.ok(readModel.includes('IAgentSessionContext'));
		assert.ok(!readModel.includes('IConversationRosterService'));
		assert.ok(!readModel.includes('conversationStubService'));
		assert.ok(!readModel.includes('tryReadSourcesGitFileDiff'));
		assert.ok(sourcesContribution.includes("import '../common/sourcesChangesReadModel.js'"));
		assert.ok(conversationContribution.includes('registerSingleton(IAgentSessionContext, new SyncDescriptor(AgentSessionContext, [], true))'));
		assert.ok(sessionContext.includes('acquireSessionView'));
		assert.ok(sessionContext.includes('onDidChangeActiveSession'));
		assert.ok(sessionContext.includes('onDidChangeSession'));
		assert.ok(!sessionContext.includes('registerSingleton'));

		assert.ok(changes.includes('IAgentSessionContext'));
		assert.ok(changes.includes('ISourcesChangesModel'));
		assert.ok(changes.includes('getActiveSessionId'));
		assert.ok(changes.includes('tryReadSourcesGitFileDiff'));
		assert.ok(changes.includes('isSourcesGitFileDiffOpenSkipped'));
		assert.ok(changes.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(changes.includes('gitReadError && !hasAnyEntries'));
		assert.ok(!changes.includes('IConversationRosterService'));
		assert.ok(!changes.includes('conversationStubService'));
		assert.ok(!changes.includes('isConversationPairingHold'));
		assert.ok(!changes.includes('tryLoadSourcesGitChangeEntries'));
		assert.ok(!review.includes('tryLoadSourcesGitChangeEntries'));
		assert.ok(!review.includes('hasSourcesGitReadEntries'));
		assert.ok(review.includes('tryReadSourcesGitFileDiff'));
		assert.ok(!review.includes('IConversationRosterService'));
		assert.ok(!review.includes('conversationStubService'));
		assert.ok(review.includes('ISourcesChangesModel'));
		assert.ok(review.includes('IAgentSessionContext'));
		assert.ok(review.includes('getActiveSessionId'));
		assert.ok(!review.includes('collectSourcesReviewEntries'));
		assert.ok(review.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(review.includes('sources-review-status'));
		assert.ok(review.includes('gitReadError'));
		assert.ok(review.includes('const gitReadError = snapshot.failureMessage'));
		assert.ok(open.includes('needsSourcesGitFileDiff'));
		assert.ok(open.includes('readGitFileDiff'));

		assert.ok(changes.includes('flushScheduledRefresh'));
		assert.ok(!changes.includes('private async refresh()'));
		assert.ok(!changes.includes('tryLoadSourcesGitChangeEntries'));
	});
});

suite('Sources - Changes git write - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Changes Stage / Commit write; Unstage stays on git.unstage', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		assert.ok(source.includes('tryWriteSourcesGitStagePaths'));
		assert.ok(source.includes('tryWriteSourcesGitCommit'));
		assert.ok(source.includes('getActiveSessionId'));
		assert.ok(source.includes('IAgentSessionContext'));
		assert.ok(!source.includes('IConversationRosterService'));
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
		assert.ok(source.includes('resolveSourcesDiffWriteControllerChrome'));
		assert.ok(source.includes('hasSourcesGitApplyHunksPayload'));
		assert.ok(source.includes('isPairingHold'));
		assert.ok(!source.includes('isConversationPairingHold'));
		assert.ok(!source.includes('IConversationRosterService'));
		assert.ok(source.includes('IAgentSessionContext'));
		assert.ok(source.includes('ISourcesChangesModel'));
		assert.ok(source.includes('isWriteClosed'));
		assert.ok(source.includes('isSourcesChangesReadFailed'));
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
		assert.ok(runAccept.includes('isPairingHold'));
		assert.ok(!runAccept.includes('SOURCES_GIT_STAGE_COMMAND'));
		assert.ok(!runAccept.includes('git.stage'));
		assertAcceptClickContract(source);
		const runStageStart = source.indexOf('private async runStage(');
		assert.ok(runStageStart >= 0);
		const runStageEnd = source.indexOf('\n\tprivate ', runStageStart + 1);
		const runStage = source.slice(runStageStart, runStageEnd > runStageStart ? runStageEnd : undefined);
		assert.ok(runStage.includes('isPairingHold'));
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
		assert.ok(source.includes('resolveSourcesDiffWriteControllerChrome'));
		assert.ok(source.includes('hasSourcesGitApplyHunksPayload'));
		assert.ok(source.includes('isPairingHold'));
		assert.ok(!source.includes('isConversationPairingHold'));
		assert.ok(!source.includes('IConversationRosterService'));
		assert.ok(source.includes('IAgentSessionContext'));
		assert.ok(source.includes('ISourcesChangesModel'));
		assert.ok(source.includes('isWriteClosed'));
		assert.ok(source.includes('isSourcesChangesReadFailed'));
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
		assert.ok(runAccept.includes('isPairingHold'));
		assert.ok(!runAccept.includes('SOURCES_GIT_STAGE_COMMAND'));
		assert.ok(!runAccept.includes('git.stage'));
		assertAcceptClickContract(source);
		const runStageStart = source.indexOf('private async runStage(');
		assert.ok(runStageStart >= 0);
		const runStageEnd = source.indexOf('\n\tprivate ', runStageStart + 1);
		const runStage = source.slice(runStageStart, runStageEnd > runStageStart ? runStageEnd : undefined);
		assert.ok(runStage.includes('isPairingHold'));
	});

	test('Accept patch builder does not read monaco text or a carried unified diff parse', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/sourcesGitHunkPatch.ts'), 'utf8');
		assert.ok(source.includes('sourcesGitHunkPatchAtCursor'));
		assert.ok(source.includes("'--cached'"));
		assert.ok(source.includes("'--whitespace=nowarn'"));
		assert.ok(!source.includes('parseSourcesGitUnifiedDiff'));
		assert.ok(!source.includes('getLineContent'));
		assert.ok(!source.includes('getValue'));
		assert.ok(!source.includes('git.stage'));
		assert.ok(!source.includes('-R'));
	});
});

suite('Sources - review list model - 源码接线扫描', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('Review list surfaces git read failure on a status line instead of a silent catch', () => {
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		assert.ok(review.includes('const gitReadError = snapshot.failureMessage'));
		assert.ok(review.includes('this.setStatusMessage(gitReadError, true)'));
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
		assert.ok(openHandler.includes('settleSourcesOpenStatus'));
		assert.ok(openHandler.includes('opened !== undefined'));
		assert.ok(!openHandler.includes('if (result)'));
		assert.ok(!openHandler.includes('if (opened) {'));
		assert.ok(!openHandler.includes('onDidSourcesDiffLoad'));
		assert.ok(openHandler.includes('} catch (error)'));
		assert.ok(openHandler.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(openHandler.includes('setStatusMessage'));
		assert.ok(!openHandler.includes('} catch {'));
	});
	test('review open consumes true false and stale at the call site generation', () => {
		const model = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/sourcesReviewListModel.ts'), 'utf8');
		const status = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesOpenStatus.ts'), 'utf8');
		const open = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'), 'utf8');
		const panelService = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffPanelService.ts'), 'utf8');
		const panelView = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts'), 'utf8');
		const pane = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'), 'utf8');
		const review = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts'), 'utf8');
		const commands = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewCommands.contribution.ts'), 'utf8');
		assert.ok(model.includes('opened !== true'));
		assert.ok(!model.includes('if (result)'));
		assert.ok(!model.includes('onDidSourcesDiffLoad'));
		assert.ok(status.includes("opened === 'stale'"));
		assert.ok(status.includes('opened === false'));
		assert.ok(status.includes('opened === true'));
		assert.ok(!review.includes('onDidSourcesDiffLoad'));
		assert.ok(!commands.includes('onDidSourcesDiffLoad'));
		const entryStart = open.indexOf('export async function openSourcesChangeEntry');
		const entryEnd = open.indexOf('async function applySourcesGitFileDiffIfNeeded');
		assert.ok(entryStart >= 0 && entryEnd > entryStart);
		const entryFn = open.slice(entryStart, entryEnd);
		assert.ok(entryFn.includes('Promise<boolean | \'stale\'>'));
		assert.ok(entryFn.includes("return 'stale'"));
		assert.ok(entryFn.includes('return true'));
		assert.ok(entryFn.includes('sourcesDiffPanelService.show(ref)'));
		const showStart = panelService.indexOf('async show(');
		assert.ok(showStart >= 0);
		const showFn = panelService.slice(showStart, panelService.indexOf('\n\tclear(', showStart));
		assert.ok(showFn.includes('allocateSourcesDiffLoadGeneration'));
		assert.ok(showFn.includes('onDidSourcesDiffLoad'));
		assert.ok(showFn.includes('await pending'));
		assert.ok(showFn.includes('loaded?.ok === true'));
		assert.ok(!showFn.includes('Event.toPromise'));
		assert.ok(!showFn.includes('return true'));
		assert.ok(!panelView.includes('void this.renderRef'));
		assert.ok(!panelView.includes('++this.renderGeneration'));
		assert.ok(!pane.includes('++this.renderGeneration'));
		assert.ok(panelView.includes('fireSourcesDiffLoad({ resource: ref.modified, generation, ok: false })'));
		assert.ok(panelView.includes('fireSourcesDiffLoad({ resource: ref.modified, generation, ok: true })'));
		assert.ok(panelView.includes('this.updateWriteActions()'));
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
		assert.ok(!model.includes('fetchChildren'));
		assert.ok(!model.includes('_isDirectoryResolved'));
		assert.ok(model.includes('resolveSourcesFilesCollectResult'));
		assert.ok(model.includes('Promise.allSettled'));
		assert.ok(model.includes('disregardIgnoreFiles: false'));
		assert.ok(model.includes('disregardParentIgnoreFiles: false'));
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
		assert.ok(openAction.includes('settleSourcesOpenStatus'));
		assert.ok(openAction.includes('opened !== undefined'));
		assert.ok(!openAction.includes('if (result)'));
		assert.ok(!openAction.includes('if (opened) {'));
		assert.ok(!openAction.includes('onDidSourcesDiffLoad'));
		assert.ok(openAction.includes('} catch (error)'));
		assert.ok(openAction.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(openAction.includes('setStatusMessage'));
		assert.ok(openAction.includes('isFileDiffOpenSkipped'));
		assert.ok(openAction.includes('isWriteClosed'));
		assert.ok(openAction.includes('readGitFileDiff'));
		assert.ok(openAction.includes('tryReadSourcesGitFileDiff'));
		assert.ok(!openAction.includes('IConversationRosterService'));
		assert.ok(!openAction.includes('conversationStubService'));
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
		assert.ok(changes.includes('isSourcesGitFileDiffOpenSkipped'));
		assert.ok(review.includes('isFileDiffOpenSkipped'));
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

	test('Changes status has error tone', () => {
		const changes = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts'), 'utf8');
		const changesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesChangesList.css'), 'utf8');
		assert.ok(changes.includes("classList.toggle('is-error'"));
		assert.ok(changes.includes("gitReadError && !hasAnyEntries"));
		assert.ok(changesCss.includes('.sources-changes-status.is-error'));
		assert.ok(!changes.includes('no git changes API'));
	});

	test('Sources hide control is a remove glyph; Files leftover status and Diff notices use error tone', () => {
		const hide = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/conversation/partRegionHideControl.ts'), 'utf8');
		const files = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesFilesList.ts'), 'utf8');
		const filesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesFilesList.css'), 'utf8');
		const diff = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts'), 'utf8');
		const diffCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesDiffPanel.css'), 'utf8');
		const reviewPane = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'), 'utf8');
		const reviewCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/conversationDiffReviewPane.css'), 'utf8');
		assert.ok(hide.includes('Codicon.remove'));
		assert.ok(hide.includes('actionBar.setFocusable(true)'));
		assert.ok(files.includes("classList.add('is-error')"));
		assert.ok(filesCss.includes('.sources-files-status.is-error'));
		assert.ok(diff.includes("actionNoticeElement.classList.add('is-error')"));
		assert.ok(diff.includes("newFileNoticeElement.classList.add('is-error')"));
		assert.ok(diffCss.includes('.sources-diff-panel-action-notice.is-error'));
		assert.ok(reviewPane.includes('classList.toggle(\'is-error\', isError)'));
		assert.ok(reviewCss.includes('.conversation-diff-review-notice.is-error'));
	});

	test('Conversation Diff matches original+group and opens beside chat', () => {
		const open = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'), 'utf8');
		const helpers = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffRefHelpers.ts'), 'utf8');
		const input = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewInput.ts'), 'utf8');
		const common = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/conversationDiffReviewInput.ts'), 'utf8');
		const controller = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/sourcesDiffWriteController.ts'), 'utf8');
		assert.ok(!open.includes('CONVERSATION_SIDE_GROUP'));
		assert.ok(!open.includes('CONVERSATION_GROUP'));
		assert.ok(!helpers.includes('CONVERSATION_SIDE_GROUP'));
		assert.ok(helpers.includes('openSourcesChangeEntry'));
		assert.ok(!helpers.includes('openSourcesChangeRefInPreview'));
		assert.ok(!helpers.includes('openSourcesChangeRefInConversation'));
		assert.ok(!helpers.includes('attachCarriedSourcesGitApplyHunksPatch'));
		assert.ok(!helpers.includes('withCarriedSourcesGitApplyHunksPatch'));
		assert.ok(controller.includes('resolveSourcesDiffWriteActions'));
		const conversationStart = open.indexOf('export async function openSourcesChangeInConversation');
		assert.ok(conversationStart >= 0);
		const conversationFn = open.slice(conversationStart);
		assert.ok(!conversationFn.includes('editorService.openEditor'));
		assert.ok(!conversationFn.includes('CONVERSATION_SIDE_GROUP'));
		assert.ok(conversationFn.includes('conversationParts.find'));
		assert.ok(conversationFn.includes('candidate.sessionKey === sessionId'));
		assert.ok(conversationFn.includes('throw new Error(sourcesConversationLeafMissingMessage())'));
		assert.ok(!conversationFn.includes('conversationDiffComparisonLoadFailedMessage'));
		assert.ok(conversationFn.includes('allocateSourcesDiffLoadGeneration'));
		assert.ok(conversationFn.includes('onDidSourcesDiffLoad'));
		assert.ok(conversationFn.includes('assignLoadGeneration'));
		assert.ok(conversationFn.includes('pane === undefined'));
		assert.ok(conversationFn.includes('readOpenedSourcesConversationComparison'));
		assert.ok(!conversationFn.includes('comparisonLoadFailed'));
		assert.ok(!conversationFn.includes('Event.toPromise'));
		assert.ok(conversationFn.includes('targetGroup.openEditor'));
		assert.ok(conversationFn.includes('editor.isDefaultRoot'));
		assert.ok(conversationFn.includes('part.findGroup({ direction }, chatRoot, false)'));
		assert.ok(conversationFn.includes('part.setGroupHidden(candidate, false)'));
		assert.ok(conversationFn.includes('part.addGroup(chatRoot, direction)'));
		assert.ok(!conversationFn.includes('getActiveConversationEditorPart'));
		assert.ok(!conversationFn.includes('groups.at(0)'));
		assert.ok(!conversationFn.includes('.sideGroup'));
		assert.ok(!conversationFn.includes('showSplitColumn'));
		assert.ok(!conversationFn.includes('activeGroup'));
		assert.ok(!conversationFn.includes('editorGroupFinder'));
		assert.ok(!helpers.includes('editorService.openEditor'));
		assert.ok(!helpers.includes('getActiveConversationEditorPart'));
		assert.ok(helpers.includes('sourcesConversationLeafMissingMessage'));
		const actions = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffActions.ts'), 'utf8');
		assert.ok(actions.includes('notificationService.error(sourcesGitDiffOpenFailureMessage(error))'));
		assert.ok(actions.includes('sourcesConversationLeafMissingMessage()'));
		const firstOpenStart = open.indexOf('async function openSourcesChangeInPreview');
		const firstOpenEnd = open.indexOf('export async function openSourcesChangeInConversation');
		assert.ok(firstOpenStart >= 0 && firstOpenEnd > firstOpenStart);
		assert.ok(!open.slice(firstOpenStart, firstOpenEnd).includes('attachCarriedSourcesGitApplyHunksPatch'));
		assert.ok(!open.includes('disposeSourcesGitDiffModels'));
		assert.ok(!open.includes('destroyModel'));
		assert.ok(open.includes('sourcesGitDiffContentStore'));
		assert.ok(open.includes("return 'stale'"));
		assert.ok(input.includes('this._groupId === other._groupId'));
		assert.ok(!input.includes('loadGeneration') || input.includes('assignLoadGeneration'));
		assert.ok(common.includes('/group/'));
		assert.ok(common.includes('serializeConversationDiffReviewInput'));
		assert.ok(!common.includes('unifiedDiff'));
	});

	test('P7 command id, diff guard, and attribution index stay on their own side of the boundary', () => {
		const readingColumn = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationLensReadingColumn.ts'), 'utf8');
		const finder = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/services/editor/common/editorGroupFinder.ts'), 'utf8');
		const routing = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/common/conversationEditorRouting.ts'), 'utf8');
		const navigation = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/conversation/browser/conversationNavigationService.ts'), 'utf8');
		const attribution = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/sourcesReviewAttribution.ts'), 'utf8');
		const attributionService = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesReviewAttributionService.ts'), 'utf8');
		const eslint = fs.readFileSync(path.join(repoRoot, 'eslint.config.js'), 'utf8');
		const guard = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/common/editor/conversationDiffReviewInput.ts'), 'utf8');
		const sourcesInput = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/conversationDiffReviewInput.ts'), 'utf8');
		const pane = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'), 'utf8');
		const actions = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffActions.ts'), 'utf8');
		const open = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesChangeEntryOpen.ts'), 'utf8');

		assert.ok(!readingColumn.includes('sourcesReview.contribution'));
		assert.ok(readingColumn.includes('sources/common/sourcesReviewCommands'));
		assert.ok(!finder.includes('contrib/sources'));
		assert.ok(finder.includes('common/editor/conversationDiffReviewInput'));
		assert.ok(finder.includes('conversationEditorRouting'));
		assert.ok(!routing.includes('contrib/sources'));
		assert.ok(routing.includes('common/editor/conversationDiffReviewInput'));
		assert.ok(navigation.includes('common/editor/conversationDiffReviewInput'));
		assert.ok(!attribution.includes('export interface IFileMutationRecord'));
		assert.ok(attribution.includes('universeAgentTypes'));
		assert.ok(!attributionService.includes('onDidFileMutation as unknown as'));
		assert.ok(!attributionService.includes('filterRecordsForResource'));
		assert.ok(attributionService.includes('byPath.get'));
		assert.ok(attributionService.includes('SOURCES_REVIEW_SESSION_MUTATION_LIMIT = 500'));
		assert.ok(eslint.includes('conversationEditorRouting.js'));
		assert.ok(!eslint.includes('conversationDiffReviewInput.js'));
		assert.ok(guard.includes('input.typeId === ConversationDiffReviewInputTypeId'));
		assert.ok(guard.includes('input.resource.scheme === ConversationDiffReviewInputScheme'));
		assert.ok(!guard.includes('instanceof ConversationDiffReviewInput'));
		assert.ok(sourcesInput.includes('serializeConversationDiffReviewInput'));
		assert.ok(!sourcesInput.includes('export function isConversationDiffReviewInput'));
		assert.ok(pane.includes('common/editor/conversationDiffReviewInput'));
		assert.ok(actions.includes('common/editor/conversationDiffReviewInput'));
		assert.ok(open.includes("return 'stale'"));
		assert.ok(open.includes('boolean | \'stale\'') || open.includes('Promise<boolean | \'stale\'>'));
	});
});
