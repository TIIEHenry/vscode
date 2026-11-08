/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const ts = createRequire(import.meta.url)('typescript') as typeof import('typescript');
type TSNode = import('typescript').Node;
type TSExpression = import('typescript').Expression;
type TSVariableDeclaration = import('typescript').VariableDeclaration;

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
	assert.ok(readCursor.includes('sourcesGitAcceptCursorFromEditors'));
	assert.ok(readCursor.includes('hasTextFocus'));
	assert.ok(!readCursor.includes('getLineContent'));
	assert.ok(!readCursor.includes('getValue'));
	assert.ok(!readCursor.includes('.getModel('));
	const bindCursor = sliceSourcesPrivate(source, 'private bindAcceptCursor(');
	assert.ok(bindCursor.includes('rememberSourcesGitAcceptCursor'));
	assert.ok(bindCursor.includes('hasTextFocus'));
	assert.ok(bindCursor.includes('onDidFocusEditorText'));
	assert.ok(!bindCursor.includes('getLineContent'));
	assert.ok(!bindCursor.includes('getValue'));
	assert.ok(!bindCursor.includes('.getModel('));
}

/** Only the hunk builder's static dependencies, calls and exported argv are in this source gate. */
function assertAcceptPatchBuilderContract(source: string): void {
	const file = ts.createSourceFile('sourcesGitHunkPatch.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const forbiddenCalls = new Set(['parseSourcesGitUnifiedDiff', 'getValue', 'getLineContent']);
	const violations: string[] = [];
	const argv: TSVariableDeclaration[] = [];
	let patchBuilders = 0;
	const memberName = (expression: TSExpression): string | undefined => {
		if (ts.isIdentifier(expression)) {
			return expression.text;
		}
		if (ts.isPropertyAccessExpression(expression)) {
			return expression.name.text;
		}
		if (ts.isElementAccessExpression(expression) && ts.isStringLiteral(expression.argumentExpression)) {
			return expression.argumentExpression.text;
		}
		return undefined;
	};
	const inspect = (node: TSNode): void => {
		if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
			if (ts.isStringLiteral(node.moduleSpecifier) && /(?:sourcesChangesGitRead|parseSourcesGitUnifiedDiff)(?:\.[cm]?[jt]s)?$/.test(node.moduleSpecifier.text)) {
				violations.push('parser module import');
			}
			const bindings = node.importClause?.namedBindings;
			if (bindings && ts.isNamedImports(bindings)) {
				for (const specifier of bindings.elements) {
					if (!specifier.isTypeOnly && [specifier.propertyName?.text, specifier.name.text].includes('parseSourcesGitUnifiedDiff')) {
						violations.push('parser import or alias');
					}
				}
			}
		}
		if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
			if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && /(?:sourcesChangesGitRead|parseSourcesGitUnifiedDiff)(?:\.[cm]?[jt]s)?$/.test(node.moduleSpecifier.text)) {
				violations.push('parser module export');
			}
			if (node.exportClause && ts.isNamedExports(node.exportClause)) {
				for (const specifier of node.exportClause.elements) {
					if (!specifier.isTypeOnly && [specifier.propertyName?.text, specifier.name.text].includes('parseSourcesGitUnifiedDiff')) {
						violations.push('parser export or alias');
					}
				}
			}
		}
		if (ts.isPropertyAccessExpression(node) && node.name.text === 'parseSourcesGitUnifiedDiff') {
			violations.push('parser member reference');
		}
		if (ts.isElementAccessExpression(node) && ts.isStringLiteral(node.argumentExpression) && node.argumentExpression.text === 'parseSourcesGitUnifiedDiff') {
			violations.push('parser element reference');
		}
		if (ts.isCallExpression(node)) {
			const name = memberName(node.expression);
			if (name && forbiddenCalls.has(name)) {
				violations.push(`forbidden call ${name}`);
			}
			if (node.arguments.some(argument => ts.isStringLiteral(argument) && argument.text === 'git.stage')) {
				violations.push('git.stage call');
			}
		}
		if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'SOURCES_GIT_APPLY_CACHED_ARGV') {
			argv.push(node);
		}
		if (ts.isFunctionDeclaration(node) && node.name?.text === 'sourcesGitHunkPatchAtCursor') {
			patchBuilders++;
		}
		ts.forEachChild(node, inspect);
	};
	inspect(file);
	assert.strictEqual(patchBuilders, 1, 'check the actual hunk patch builder');
	assert.deepStrictEqual(violations, [], 'Accept builder must not depend on parser, editor text or local staging');
	assert.strictEqual(argv.length, 1, 'check the actual exported cached argv');
	let initializer = argv[0].initializer;
	assert.ok(initializer);
	while (ts.isAsExpression(initializer) || ts.isParenthesizedExpression(initializer)) {
		initializer = initializer.expression;
	}
	assert.ok(ts.isArrayLiteralExpression(initializer), 'cached argv must be a literal array');
	const values = initializer.elements.map(element => {
		assert.ok(ts.isStringLiteral(element), 'cached argv must contain literal strings');
		return element.text;
	});
	assert.deepStrictEqual(values, ['git', 'apply', '--cached', '--whitespace=nowarn'], 'Accept argv must stay cached and must not reverse the patch');
}

const acceptBuilderFixture = `
export const SOURCES_GIT_APPLY_CACHED_ARGV = ['git', 'apply', '--cached', '--whitespace=nowarn'] as const;
export function sourcesGitHunkPatchAtCursor(diff: string) { return diff; }
`;

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
		assert.ok(source.includes(`void this.runMoveToPreview()${doubleCatch}`));
		const runMove = sliceSourcesPrivate(source, 'private async runMoveToPreview(');
		assert.ok(runMove.includes('const input = this.input;'));
		assert.ok(runMove.includes('if (!(input instanceof ConversationDiffReviewInput))'));
		assert.ok(runMove.includes(`const source: ISourcesConversationDiffMoveSource = { kind: 'conversationPane', editor: input, group: this.group, pane: this };`));
		assert.ok(runMove.includes(`await this.commandService.executeCommand<SourcesDiffMoveResult>('sources.diff.moveToPreview', source)`));
		assert.ok(!source.includes('void this.runGitAction(SOURCES_GIT_CLEAN_COMMAND);'));
		assert.ok(!source.includes('void this.runGitAction(SOURCES_GIT_UNSTAGE_COMMAND);'));
		assert.ok(!source.includes('void this.runStage();'));
		assert.ok(!source.includes('void this.runAccept();'));
		assert.ok(!source.includes('void this.runMoveToPreview();'));
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
		assertAcceptPatchBuilderContract(source);
	});

	test('Accept source gate permits comments and harmless text mentioning forbidden APIs', () => {
		assertAcceptPatchBuilderContract(`${acceptBuilderFixture}
// parseSourcesGitUnifiedDiff(diff); model.getValue(); editor.getLineContent(1); git.stage; -R
/* import { parseSourcesGitUnifiedDiff as parse } from './sourcesChangesGitRead.js'; */
const documentation = 'parseSourcesGitUnifiedDiff getValue getLineContent git.stage -R';
`);
	});

	for (const [name, violation] of [
		['direct parser import and call', 'import { parseSourcesGitUnifiedDiff } from \'./sourcesChangesGitRead.js\'; parseSourcesGitUnifiedDiff(diff);'],
		['aliased parser import and call', 'import { parseSourcesGitUnifiedDiff as parse } from \'./sourcesChangesGitRead.js\'; parse(diff);'],
		['parser module re-export', 'export * from \'./sourcesChangesGitRead.js\';'],
		['parser member call', 'gitRead.parseSourcesGitUnifiedDiff(diff);'],
		['parser element call', 'gitRead[\'parseSourcesGitUnifiedDiff\'](diff);'],
		['direct editor value call', 'getValue();'],
		['editor member value call', 'model.getValue();'],
		['editor element line call', 'model[\'getLineContent\'](1);'],
		['local staging call', 'commands.executeCommand(\'git.stage\', resource);'],
	] as const) {
		test(`Accept source gate rejects ${name}`, () => {
			assert.throws(() => assertAcceptPatchBuilderContract(`${acceptBuilderFixture}\n${violation}`), /Accept builder must not depend/);
		});
	}

	test('Accept source gate still rejects a real reverse argv string', () => {
		assert.throws(() => assertAcceptPatchBuilderContract(acceptBuilderFixture.replace('\'--cached\'', '\'-R\'')), /Accept argv must stay cached/);
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
		assert.ok(openHandler.includes('openReviewEntryMarkingReviewed'));
		assert.ok(openHandler.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));

		const helperStart = review.indexOf('private async openReviewEntryMarkingReviewed');
		const helperEnd = review.indexOf('this.listViewport =', helperStart);
		assert.ok(helperStart >= 0 && helperEnd > helperStart);
		const helperBody = review.slice(helperStart, helperEnd);
		assert.ok(helperBody.includes('markReviewedAfterSuccessfulOpen'));
		assert.ok(helperBody.includes('settleSourcesOpenStatus'));
		assert.ok(helperBody.includes('opened !== undefined'));
		assert.ok(!helperBody.includes('if (result)'));
		assert.ok(!helperBody.includes('if (opened) {'));
		assert.ok(!helperBody.includes('onDidSourcesDiffLoad'));
		assert.ok(helperBody.includes('} catch (error)'));
		assert.ok(helperBody.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(helperBody.includes('setStatusMessage'));
		assert.ok(!helperBody.includes('} catch {'));
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
		assert.ok(entryFn.includes('runSuppressingExplorerAutoReveal'));
		assert.ok(entryFn.includes("return 'stale'"));
		assert.ok(entryFn.includes('return openSourcesChangeInPreview(ref, deps, options)'));
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
		assert.ok(list.includes('sourcesFilesListReadFailureSummaryFor'));
		assert.ok(list.includes('lastGoodEntries'));
		assert.ok(list.includes('sources-files-status'));
		assert.ok(list.includes("classList.add('is-error')"));
		const filesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesFilesList.css'), 'utf8');
		assert.ok(filesCss.includes('.sources-files-empty.is-error'));
		assert.ok(filesCss.includes('.sources-files-status.is-error'));
	});
	test('Files rows honor reduced motion without overriding explicit motion opt-in', () => {
		const filesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesFilesList.css'), 'utf8');
		assert.match(filesCss, /\.sources-file-row\s*\{[\s\S]*?transition:\s*background-color 0\.08s ease;/);
		assert.match(filesCss, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.sources-file-row\s*\{[\s\S]*?transition:\s*none;/);
		assert.match(filesCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.monaco-workbench:not\(\.monaco-enable-motion\)[\s\S]*?\.sources-file-row\s*\{[\s\S]*?transition:\s*none;/);
	});
	test('Files mode focus follows product treatment while HC keeps a contrast ring', () => {
		const filesCss = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesFilesList.css'), 'utf8');
		assert.match(filesCss, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.part\.sources \.sources-files-mode:focus-visible\s*\{[\s\S]*?outline:\s*none\s*!important[\s\S]*?background-color:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.match(filesCss, /\.monaco-workbench\.hc-black \.part\.sources \.sources-files-mode:focus-visible[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder/);
		assert.match(filesCss, /\.monaco-workbench\.hc-light \.part\.sources \.sources-files-mode:focus-visible[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder/);
	});
	test('Files list scheduler and onDidOpen use single catch', () => {
		const list = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesFilesList.ts'), 'utf8');
		const schedulerStart = list.indexOf('this.refreshScheduler = this._register(new RunOnceScheduler');
		const schedulerEnd = list.indexOf('this.scheduleRefresh();', schedulerStart);
		assert.ok(schedulerStart >= 0 && schedulerEnd > schedulerStart);
		const scheduler = list.slice(schedulerStart, schedulerEnd);
		assert.ok(scheduler.includes('void this.refresh()'));
		assert.ok(scheduler.includes('.catch(onUnexpectedError)'));
		assert.ok(!scheduler.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));

		const openStart = list.indexOf('this._register(this.list.onDidOpen');
		const openEnd = list.indexOf('return this.list;', openStart);
		assert.ok(openStart >= 0 && openEnd > openStart);
		const openHandler = list.slice(openStart, openEnd);
		assert.ok(openHandler.includes('openEditor'));
		assert.ok(openHandler.includes('.catch(onUnexpectedError)'));
		assert.ok(!openHandler.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(!openHandler.includes('async e =>'));
	});

	test('Files tab hosts the explorer and does not register a view container', () => {
		const tabs = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesTabsHost.ts'), 'utf8');
		const explorer = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesFilesExplorer.ts'), 'utf8');
		const listMode = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/sourcesFilesListMode.ts'), 'utf8');
		const config = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/common/sourcesDiffConfiguration.ts'), 'utf8');
		assert.ok(tabs.includes('SourcesFilesExplorerHost'));
		assert.ok(tabs.includes("filesPanel.classList.add('show-file-icons')"));
		assert.ok(tabs.includes('this.filesExplorer?.setFilesTabActive(selected)'));
		assert.ok(!tabs.includes('SourcesFilesList'));
		assert.ok(explorer.includes('resolveSourcesFilesListSource'));
		assert.ok(explorer.includes('createInstance(SourcesFilesList'));
		assert.ok(explorer.includes('listsEngineDirectory'));
		assert.ok(tabs.includes('sources-title-filter'));
		assert.ok(tabs.includes('sourcesFilterFitsOnBar'));
		assert.ok(explorer.includes('runSuppressingExplorerAutoReveal'));
		assert.ok(explorer.includes('class SourcesFilesExplorer extends ExplorerView'));
		assert.ok(explorer.includes("return 'SourcesFilesExplorer'"));
		assert.ok(explorer.includes('sources.files.explorer.treeViewState'));
		assert.ok(explorer.includes('setListMode'));
		assert.ok(explorer.includes('resolveFlatListRoot'));
		assert.ok(explorer.includes('SOURCES_FILES_LIST_MODE_STORAGE_KEY'));
		assert.ok(listMode.includes("sources.files.listMode"));
		assert.ok(listMode.includes('sourcesFilterFitsOnBar'));
		assert.ok(!explorer.includes('ViewContainersRegistry'));
		assert.ok(!explorer.includes('registerViewContainer'));
		assert.ok(!explorer.includes('viewsService.openView'));
		assert.ok(!config.includes('sources.files.viewMode'));
		assert.ok(!explorer.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
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
		const helperStart = review.indexOf('private async openReviewEntryMarkingReviewed');
		const helperEnd = review.indexOf('this.listViewport =', helperStart);
		assert.ok(helperStart >= 0 && helperEnd > helperStart);
		const helperBody = review.slice(helperStart, helperEnd);
		assert.ok(changesOpen.includes('isSourcesGitFileDiffOpenSkipped'));
		assert.ok(changesOpen.includes('openChangeEntry'));
		assert.ok(reviewOpen.includes('openReviewEntryMarkingReviewed'));
		const changesMenuStart = changes.indexOf('this._register(this.list.onContextMenu');
		const changesMenuEnd = changes.indexOf('this.listViewport = this._register(new SourcesListViewport', changesMenuStart);
		assert.ok(changesMenuStart >= 0 && changesMenuEnd > changesMenuStart);
		const changesMenu = changes.slice(changesMenuStart, changesMenuEnd);
		assert.ok(changesMenu.includes('openChangeEntry'));
		assert.ok(!changesMenu.includes('openSourcesChangeEntry('));
		const changesHelperStart = changes.indexOf('private async openChangeEntry');
		const changesHelperEnd = changes.indexOf('private ensureList', changesHelperStart);
		assert.ok(changesHelperStart >= 0 && changesHelperEnd > changesHelperStart);
		const changesHelper = changes.slice(changesHelperStart, changesHelperEnd);
		assert.ok(changesHelper.includes('settleSourcesOpenStatus'));
		assert.ok(changesHelper.includes('sourcesGitDiffOpenFailureMessage'));
		assert.ok(changesHelper.includes('isSourcesGitFileDiffOpenSkipped'));
		assert.ok(!changesHelper.includes('markReviewed'));
		assert.ok(helperBody.includes('isSourcesGitFileDiffOpenSkipped'));
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
		// Behavioral coverage: Review alternate API rejection / public Open Selected recovery.
		assert.ok(review.includes('this.setStatusMessage(sourcesGitDiffOpenFailureMessage(error), true, \'open\')'));
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

	test('Files empty state has a compact text action with an honest folder command gate', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesFilesExplorer.css'), 'utf8');
		const explorer = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/sourcesFilesExplorer.ts'), 'utf8');
		assert.match(css, /\.sources-files-explorer-empty\s*\{[\s\S]*?flex-direction:\s*column;/);
		assert.match(css, /\.sources-files-explorer-empty\s*\{[\s\S]*?font-size:\s*var\(--vscode-fontSize-label1/);
		assert.match(css, /\.sources-files-explorer-open-folder\s*\{[\s\S]*?background:\s*transparent;/);
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.part\.sources \.sources-files-explorer-open-folder:focus-visible\s*\{[\s\S]*?outline:\s*none;/);
		assert.match(css, /\.sources-files-explorer-open-folder:focus-visible\s*\{[\s\S]*?background-color:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.sources \.sources-files-explorer-open-folder:focus-visible[\s\S]*?outline-color:\s*var\(--vscode-contrastActiveBorder/);
		assert.ok(explorer.includes('workbench.action.files.openFolder'));
		assert.ok(explorer.includes('OpenFolderWorkspaceSupportContext'));
		assert.ok(explorer.includes('sources-files-explorer-open-folder'));
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

	test('Sources review rows honor reduced-motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesReviewList.css'), 'utf8');
		assert.ok(css.includes('transition: background-color 0.08s ease;'));
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .part.sources .sources-review-row'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .part.sources .sources-review-row'));
		assert.ok(css.includes('transition: none;'));
	});

	test('Sources review rows keep the hit target while pressing an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesReviewList.css'), 'utf8');
		assert.match(css, /\.sources-review-row\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /\.sources-review-row::before\s*\{[^}]*inset:\s*1px 4px[^}]*border-radius:\s*var\(--vscode-cornerRadius-small/s);
		assert.match(css, /\.sources-review-list \.monaco-list-row:active \.sources-review-row\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /\.sources-review-list \.monaco-list-row:active \.sources-review-row::before\s*\{[^}]*background-color:\s*var\(--vscode-list-activeSelectionBackground\)/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.sources-review-row::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.sources-review-row::before[\s\S]*?transition:\s*none/);
	});

	test('Sources changes rows honor reduced-motion opt-in', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesChangesList.css'), 'utf8');
		assert.ok(css.includes('.sources-change-folder-row'));
		assert.ok(css.includes('.sources-change-file'));
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .part.sources .sources-change-folder-row'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .part.sources .sources-change-file'));
		assert.ok(css.includes('transition: none;'));
	});

	test('Sources change folder rows keep the hit target while pressing an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesChangesList.css'), 'utf8');
		assert.match(css, /\.sources-change-folder-row\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /\.sources-change-folder-row::before\s*\{[^}]*inset:\s*1px 4px[^}]*border-radius:\s*var\(--vscode-cornerRadius-small/s);
		assert.match(css, /\.sources-change-folder-row:hover,[\s\S]*?background-color:\s*transparent/s);
		assert.match(css, /\.sources-change-folder-row:hover::before,[\s\S]*?background-color:\s*var\(--vscode-list-hoverBackground\)/s);
		assert.match(css, /\.monaco-list-row:active \.sources-change-folder-row::before\s*\{[^}]*toolbar-activeBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.sources-change-folder-row::before[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.sources-change-folder-row::before[\s\S]*?transition:\s*none/);
	});

	test('Sources changes toolbar motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesChangesList.css'), 'utf8');
		assert.ok(css.includes('transition: background-color 100ms ease;'));
		assert.doesNotMatch(css, /sources-changes-toolbar[\s\S]*transition:\s*background-color\s+0\.12s/);
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .part.sources .sources-changes-toolbar .monaco-button'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .part.sources .sources-changes-toolbar .monaco-button'));
	});

	test('Sources changes inline actions and commit motion stay within the 100ms contract and honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesChangesList.css'), 'utf8');
		assert.ok(css.includes('transition: background-color 0.1s ease, color 0.1s ease;'));
		assert.ok(css.includes('transition: background-color 0.1s ease;'));
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .part.sources .sources-change-action'));
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .part.sources .sources-change-group-action'));
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .part.sources .sources-changes-commit .monaco-button'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .part.sources .sources-change-action'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .part.sources .sources-change-group-action'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .part.sources .sources-changes-commit .monaco-button'));
		assert.ok(css.includes('transition: none;'));
	});

	test('Sources changes inline actions keep the hit target while painting an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesChangesList.css'), 'utf8');
		assert.match(css, /\.sources-change-action,\s*\n\.monaco-workbench \.part\.sources \.sources-change-group-action\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /\.sources-change-action::after,\s*\n\.monaco-workbench \.part\.sources \.sources-change-group-action::after\s*\{[^}]*inset:\s*1px 2px[^}]*border-radius:\s*var\(--vscode-cornerRadius-xSmall/s);
		assert.match(css, /\.sources-change-action:hover:not\(\.disabled\),[\s\S]*?background-color:\s*transparent\s*!important/s);
		assert.match(css, /\.sources-change-action:hover:not\(\.disabled\)::after,[\s\S]*?background-color:\s*var\(--vscode-toolbar-hoverBackground/s);
		assert.match(css, /\.sources-change-action:active:not\(\.disabled\)::after,[\s\S]*?background-color:\s*var\(--vscode-toolbar-activeBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.sources-change-action::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.sources-change-action::after[\s\S]*?transition:\s*none/);
	});

	test('Sources title actions keep the hit target while painting an inset face', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/browser/parts/sources/media/sourcesPart.css'), 'utf8');
		assert.match(css, /\.part\.sources > \.title > \.title-actions \.action-label\s*\{[^}]*position:\s*relative[^}]*isolation:\s*isolate/s);
		assert.match(css, /\.part\.sources > \.title > \.title-actions \.action-label::after\s*\{[^}]*inset:\s*1px 2px[^}]*border-radius:\s*var\(--vscode-cornerRadius-xSmall/s);
		assert.match(css, /\.part\.sources > \.title > \.title-actions \.action-label:hover\s*\{[^}]*background-color:\s*transparent/s);
		assert.match(css, /\.part\.sources > \.title > \.title-actions \.action-label:hover::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-hoverBackground\)/s);
		assert.match(css, /\.part\.sources > \.title > \.title-actions \.action-label:active::after\s*\{[^}]*background-color:\s*var\(--vscode-toolbar-activeBackground/s);
		assert.match(css, /\.monaco-workbench\.monaco-reduce-motion[\s\S]*?\.part\.sources > \.title > \.title-actions \.action-label::after[\s\S]*?transition:\s*none/);
		assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.part\.sources > \.title > \.title-actions \.action-label::after[\s\S]*?transition:\s*none/);
	});

	test('Sources list filter motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesListFilter.css'), 'utf8');
		assert.ok(css.includes('transition: border-color 100ms ease;'));
		assert.ok(css.includes('transition: background-color 100ms ease, color 100ms ease;'));
		assert.doesNotMatch(css, /transition:\s*[^;]*0\.12s/);
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .part.sources .sources-list-filter-input'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .part.sources .sources-list-filter-clear'));
		assert.ok(css.includes('transition: none;'));
	});

	test('Sources diff panel actions stay within the 100ms contract and honor reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesDiffPanel.css'), 'utf8');
		assert.ok(css.includes('transition: background-color 100ms ease;'));
		assert.doesNotMatch(css, /transition:\s*background-color\s+0\.12s/);
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .sources-diff-panel .sources-diff-panel-actions button'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .sources-diff-panel .sources-diff-panel-actions button'));
		assert.ok(css.includes('transition: none;'));
	});

	test('Conversation diff review toolbar motion stays within the 100ms contract and honors reduced motion', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/conversationDiffReviewPane.css'), 'utf8');
		assert.ok(css.includes('transition: background-color 100ms ease;'));
		assert.doesNotMatch(css, /transition:\s*background-color\s+0\.12s/);
		assert.ok(css.includes('.monaco-workbench.monaco-reduce-motion .conversation-diff-review-pane .conversation-diff-review-toolbar button'));
		assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
		assert.ok(css.includes('.monaco-workbench:not(.monaco-enable-motion) .conversation-diff-review-pane .conversation-diff-review-toolbar button'));
		assert.ok(css.includes('transition: none;'));
	});

	test('Sources review state focus follows product treatment while HC keeps a contrast ring', () => {
		const css = fs.readFileSync(path.join(repoRoot, 'src/vs/workbench/contrib/sources/browser/media/sourcesReviewList.css'), 'utf8');
		assert.match(css, /\.monaco-workbench:not\(\.hc-black\):not\(\.hc-light\) \.part\.sources \.sources-review-state:focus-visible\s*\{[\s\S]*?outline:\s*none\s*!important[\s\S]*?background-color:\s*var\(--vscode-toolbar-hoverBackground\)/);
		assert.match(css, /\.monaco-workbench\.hc-black \.part\.sources \.sources-review-state:focus-visible[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder/);
		assert.match(css, /\.monaco-workbench\.hc-light \.part\.sources \.sources-review-state:focus-visible[\s\S]*?outline:\s*1px solid var\(--vscode-contrastActiveBorder/);
	});
});
