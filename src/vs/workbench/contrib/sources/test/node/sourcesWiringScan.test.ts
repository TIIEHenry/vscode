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
		assert.ok(changes.includes('tryReadSourcesGitFileDiff'));
		assert.ok(changes.includes('collectSourcesChangeEntries'));
		assert.ok(changes.includes('IConversationRosterService'));
		assert.ok(changes.includes('getActiveSessionId'));
		assert.ok(review.includes('tryLoadSourcesGitChangeEntries'));
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
	test('Review Accept writes ApplyHunks only with payload; empty reject does not git.stage; Stage stays on Stage', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/conversationDiffReviewPane.ts'), 'utf8');
		assert.ok(source.includes('tryWriteSourcesGitApplyHunks'));
		assert.ok(source.includes('tryWriteSourcesGitStagePaths'));
		assert.ok(source.includes('attemptSourcesGitWrite'));
		assert.ok(source.includes('resolveSourcesDiffWriteActions'));
		assert.ok(source.includes('hasSourcesGitApplyHunksPayload'));
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
		assert.ok(!runAccept.includes('SOURCES_GIT_STAGE_COMMAND'));
		assert.ok(!runAccept.includes('git.stage'));
		const runStageStart = source.indexOf('private async runStage(');
		assert.ok(runStageStart >= 0);
		const runGitActionStart = source.indexOf('private async runGitAction(');
		assert.ok(runGitActionStart >= 0);
		const runGitActionEnd = source.indexOf('\n\tprivate ', runGitActionStart + 1);
		const runGitAction = source.slice(runGitActionStart, runGitActionEnd > runGitActionStart ? runGitActionEnd : undefined);
		assert.ok(runGitAction.includes('catch'));
		assert.ok(runGitAction.includes('this.showNotice(getErrorMessage(error))'));
		assert.ok(runGitAction.includes('finally'));
		assert.ok(runGitAction.includes('this.updateReviewActions()'));
	});
	test('Panel Diff write actions share the Review write gate; Accept does not git.stage', () => {
		const source = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesDiffPanelView.ts'), 'utf8');
		assert.ok(source.includes('tryWriteSourcesGitStagePaths'));
		assert.ok(source.includes('tryWriteSourcesGitApplyHunks'));
		assert.ok(source.includes('attemptSourcesGitWrite'));
		assert.ok(source.includes('resolveSourcesDiffWriteActions'));
		assert.ok(source.includes('hasSourcesGitApplyHunksPayload'));
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
		assert.ok(!runAccept.includes('SOURCES_GIT_STAGE_COMMAND'));
		assert.ok(!runAccept.includes('git.stage'));
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
		assert.ok(!openAction.includes('} catch {'));
	});
});
