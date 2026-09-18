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
const VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const CONTROLLER_REL = 'src/vs/workbench/contrib/comments/browser/commentsController.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/comments/browser/comments.contribution.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const INLINE_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const AICUSTOM_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const EDITING_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedNotebookEntry.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';

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

const refreshCall = 'this.refresh()';
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
const leftoverAddOrToggleCall = 'this.addOrToggleCommentAtLine(range, e);';

const d839Calls: Array<[string, string, number]> = [
	[VIEW_REL, refreshCall, 5],
];

suite('leftover remaining unused comments leftover remaining unused Promise fire-and-forget catch scan (D839)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused comments leftover remaining unused still has four or more legal unused leftover sites so this knife stayed', () => {
		const source = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		assertPromiseSignature(source, 'private async refresh(): Promise<void> {');
		assert.ok(source.includes('private updateFilter() {'));
		assert.ok(!source.includes(`this.updateFilter()${doubleCatch}`));
		assert.ok(source.includes('private renderComments(): void {'));
		assert.ok(!source.includes(`this.renderComments()${doubleCatch}`));
		let sites = 0;
		for (const [, call, count] of d839Calls) {
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused comments legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D839'));
	});

	test('this knife covers five leftover Promise double-chain sites after leftover remaining unused stayed on comments', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d839Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(VIEW_REL) ?? ''), 5);
	});

	test('comments leftover remaining unused async this.foo() FOF (refresh) leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		assertPromiseSignature(source, 'private async refresh(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, refreshCall);
		assert.strictEqual(countIncludes(source, `${refreshCall}${doubleCatch}`), 5);
		assert.ok(!source.includes('\t\t\t\tthis.refresh();\n'));
		assert.ok(!source.includes('\t\tthis.refresh();\n'));
		assert.ok(!source.includes('await this.refresh();'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'private async refresh(): Promise<void> {');

		assert.ok(source.includes('@IOpenerService openerService: IOpenerService,'));
		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(source.includes('return revealCommentThread(this.commentService, this.editorService, this.uriIdentityService, threadToReveal, commentToReveal, false, pinned, preserveFocus, sideBySide);'));
		assert.ok(!source.includes(`revealCommentThread(this.commentService, this.editorService, this.uriIdentityService, threadToReveal, commentToReveal, false, pinned, preserveFocus, sideBySide)${doubleCatch}`));
		assert.ok(contrib.includes('registerAction2(class Collapse extends ViewAction<CommentsPanel>'));
		assert.ok(!contrib.includes(`view.collapseAll()${doubleCatch}`));
		assert.ok(!contrib.includes(`revealCommentThread(commentService, editorService, uriIdentityService, marshalledCommentThread.thread, marshalledCommentThread.thread.comments![marshalledCommentThread.thread.comments!.length - 1], true)${doubleCatch}`));
		assert.ok(controller.includes(`void this.beginCompute()${doubleCatch}`));
		assert.ok(controller.includes(leftoverAddOrToggleCall));
		assert.ok(!controller.includes(`${leftoverAddOrToggleCall}${doubleCatch}`));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D839'));
		assert.ok(!controller.includes('D839'));
		assert.ok(!contrib.includes('D839'));
	});

	test('D828 leftover remaining locks stay leftover remaining unused; loopCheck / openView / assigned _currentSuggestionDetails.then stay leftover remaining unused; this knife did not overflow into dirty leftover modules', () => {
		const source = fs.readFileSync(resolveSource(VIEW_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(INLINE_REL), 'utf8');
		const aicustom = fs.readFileSync(resolveSource(AICUSTOM_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(ENTITLEMENT_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');

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
		assert.ok(gettingStarted.includes(`this.scrollToCategory(categoryID, stepId)${doubleCatch}`) || gettingStarted.includes(`this.scrollToCategory(categoryID, stepId)${doubleCatch};`));

		assert.ok(controller.includes(`void this.beginCompute()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(aicustom.includes(`this.showEmbeddedMcpDetail(server)${doubleCatch}`) || aicustom.includes(`this.showPluginDetail(item)${doubleCatch}`));
		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(configuration.includes(`this.updateCache()${doubleCatch}`));
		assert.ok(editing.includes(`this.initializeModelsFromDiff()${doubleCatch}`));
		assert.ok(implicit.includes(`this.updateImplicitContext()${doubleCatch}`));
		assert.ok(entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(enablement.includes(`this._enableExtension(extension.identifier)${doubleCatch}`));

		for (const [rel, file] of [
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[MGMT_REL, mgmt],
			[INLINE_REL, unification],
			[AICUSTOM_REL, aicustom],
			[MCP_DISCOVERY_REL, discovery],
			[CONFIG_REL, configuration],
			[EDITING_REL, editing],
			[IMPLICIT_REL, implicit],
			[ENTITLEMENT_REL, entitlement],
			[ENABLEMENT_REL, enablement],
			[ACCOUNT_REL, account],
			[WORKBENCH_SVC_REL, workbench],
			[SETTINGS_REL, settings],
			[TASKS_REL, tasks],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[SUGGEST_REL, suggest],
			[CONTROLLER_REL, controller],
		] as const) {
			assert.ok(!file.includes('D839'), `${rel} should stay off this knife`);
		}
		assert.ok(!source.includes('D839'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD839.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/userDataProfile/test/node/userDataProfileManagementLeftoverPromiseCatchScanD839.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/inlineCompletions/test/node/inlineCompletionsLeftoverPromiseCatchScanD839.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/aiCustomizationLeftoverPromiseCatchScanD839.test.ts')));
	});
});
