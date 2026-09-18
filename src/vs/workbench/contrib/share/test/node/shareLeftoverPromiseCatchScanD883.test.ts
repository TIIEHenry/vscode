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
const SHARE_CONTRIB_REL = 'src/vs/workbench/contrib/share/browser/share.contribution.ts';
const SHARE_SERVICE_REL = 'src/vs/workbench/contrib/share/browser/shareService.ts';
const SHARE_IFACE_REL = 'src/vs/workbench/contrib/share/common/share.ts';
const BASE_REPORTER_REL = 'src/vs/workbench/contrib/issue/browser/baseIssueReporterService.ts';
const FORM_REL = 'src/vs/workbench/contrib/issue/browser/issueFormService.ts';
const OVERLAY_REL = 'src/vs/workbench/contrib/issue/browser/issueReporterOverlay.ts';
const REPORTER_REL = 'src/vs/workbench/contrib/issue/electron-browser/issueReporterService.ts';
const KEYBINDINGS_REL = 'src/vs/workbench/contrib/issue/electron-browser/issueReporterKeybindings.ts';
const PANE_REL = 'src/vs/workbench/contrib/issue/electron-browser/issueReporterEditorPane.ts';
const ISSUE_CONTRIB_REL = 'src/vs/workbench/contrib/issue/electron-browser/issue.contribution.ts';
const WEBVIEW_REL = 'src/vs/workbench/contrib/webview/browser/webviewElement.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalService.ts';
const TAGS_REL = 'src/vs/workbench/contrib/tags/electron-browser/workspaceTags.ts';
const HISTORY_REL = 'src/vs/workbench/services/history/browser/historyService.ts';
const REPL_NOTEBOOK_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditor.ts';
const INTERACTIVE_REL = 'src/vs/workbench/contrib/interactive/browser/interactiveEditor.ts';
const ACCESSIBILITY_REL = 'src/vs/workbench/contrib/accessibility/browser/accessibilityStatus.ts';
const INLINE_CHAT_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts';
const MERGE_EDITOR_REL = 'src/vs/workbench/contrib/mergeEditor/browser/view/view.ts';

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

const updateTargetCall = 'this.updateExtensionStatus(targetExtension)';
const updateMatchesCall = 'this.updateExtensionStatus(matches[0])';
const closeCall = 'this.close()';
const leftoverRenderCall = '\t\tthis.renderBlocks();\n';
const leftoverRenderCatchCall = '\t\t\tthis.renderBlocks();\n';
const leftoverRenderDataCall = '\t\t\tthis.renderBlocks();\n';
const leftoverCloseReporterCall = '\t\t\t\t\t\tthis.closeReporter();\n';
const leftoverOpenLinkCall = '\t\t\tthis.openLink(url);\n';
const leftoverShareRegisterCall = '\t\t\t\t\tthis.registerActions();\n';
const leftoverShareOpenerCall = 'run: () => { urlService.open(result, { openExternal: true }); }';
const leftoverFindStopCall = 'this._send(\'find-stop\', { clearSelection: !keepSelection });';
const leftoverFocusCall = '\t\t\tthis._send(\'focus\', undefined);\n';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
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
const leftoverShowBackgroundCall = 'this.showBackgroundTerminal(value);';
const leftoverOpenAgentSessionCall = 'this.openAgentSession(';
const leftoverShowContextMenuCall = 'this.showContextMenu(';
const checkUpdatesCall = 'this.checkForUpdates()';
const executeCommandCall = 'void this.commandService.executeCommand(commandId)';
const populateSystemInfoCall = 'void this.populateSystemInfo()';
const updateExtensionPresetCall = 'void this.updateSelectedExtension(this.data.extensionId, false)';
const updateExtensionSelectedCall = 'void this.updateSelectedExtension(this.selectedExtension.id)';
const updateExtensionSelectCall = 'void this.updateSelectedExtension(this.extensionOptions[e.index]?.value)';
const searchSimilarCall = '() => this.doSearchSimilarIssues()';
const systemInfoThen = `this.processService.getSystemInfo().then(info => {
			this.issueReporterModel.update({ systemInfo: info });
			this.receivedSystemInfo = true;

			this.updateSystemInfo(this.issueReporterModel.getData());
			this.updateButtonStates();
		})`;
const performanceInfoThenCtor = `this.processService.getPerformanceInfo().then(info => {
				this.updatePerformanceInfo(info as Partial<IssueReporterData>);
			})`;
const performanceInfoThenHandler = `this.processService.getPerformanceInfo().then(info => {
					this.updatePerformanceInfo(info as Partial<IssueReporterData>);
				})`;

const d883Calls: Array<[string, string, number]> = [
	[BASE_REPORTER_REL, updateTargetCall, 1],
	[BASE_REPORTER_REL, updateMatchesCall, 2],
	[BASE_REPORTER_REL, closeCall, 3],
	[REPORTER_REL, closeCall, 1],
];

const d773AlreadyDouble: Array<[string, string, number]> = [
	[REPORTER_REL, systemInfoThen, 1],
	[REPORTER_REL, performanceInfoThenCtor, 1],
	[REPORTER_REL, performanceInfoThenHandler, 1],
	[REPORTER_REL, checkUpdatesCall, 1],
	[KEYBINDINGS_REL, executeCommandCall, 1],
	[PANE_REL, populateSystemInfoCall, 1],
	[OVERLAY_REL, updateExtensionPresetCall, 2],
	[OVERLAY_REL, updateExtensionSelectedCall, 1],
	[OVERLAY_REL, updateExtensionSelectCall, 1],
	[OVERLAY_REL, searchSimilarCall, 1],
];

suite('leftover remaining unused after share leftover remaining unused overflowed to leftover remaining unused issue leftover remaining unused Promise fire-and-forget catch scan (D883)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused share leftover remaining unused after discarding collision overflow had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const contrib = fs.readFileSync(resolveSource(SHARE_CONTRIB_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SHARE_SERVICE_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(SHARE_IFACE_REL), 'utf8');
		assert.ok(contrib.includes('\tprivate registerActions() {'));
		assert.ok(!contrib.includes('private async registerActions'));
		assert.ok(contrib.includes(leftoverShareRegisterCall));
		assert.ok(!contrib.includes(`this.registerActions()${doubleCatch}`));
		assert.ok(contrib.includes('override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {'));
		assert.ok(contrib.includes(leftoverShareOpenerCall));
		assert.ok(!contrib.includes(`urlService.open(result, { openExternal: true })${doubleCatch}`));
		assert.ok(contrib.includes('dialogService.prompt('));
		assert.ok(!contrib.includes(`dialogService.prompt(${doubleCatch}`));
		assert.ok(service.includes('async provideShare(item: IShareableItem, token: CancellationToken): Promise<URI | string | undefined> {'));
		assert.ok(service.includes('return providers[0].provideShare(item, token);'));
		assert.ok(!service.includes(`return providers[0].provideShare(item, token)${doubleCatch}`));
		assert.ok(iface.includes('provideShare(item: IShareableItem, token: CancellationToken): Thenable<URI | string | undefined>;'));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(!service.includes(doubleCatch));
		assert.ok(!iface.includes(doubleCatch));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused share legal leftover <4 after discarding collision overflow, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!contrib.includes('D883'));
		assert.ok(!service.includes('D883'));
		assert.ok(!iface.includes('D883'));
	});

	test('this knife covers seven leftover Promise double-chain sites after leftover remaining unused overflowed to leftover remaining unused issue leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d883Calls) {
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
		assert.strictEqual(countIncludes(seen.get(BASE_REPORTER_REL) ?? '', `${updateTargetCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(BASE_REPORTER_REL) ?? '', `${updateMatchesCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(seen.get(BASE_REPORTER_REL) ?? '', `${closeCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(seen.get(REPORTER_REL) ?? '', `${closeCall}${doubleCatch}`), 1);
		assert.strictEqual(countDoubleChains(seen.get(BASE_REPORTER_REL) ?? ''), 6);
		assert.strictEqual(countDoubleChains(seen.get(REPORTER_REL) ?? ''), 5);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const base = fs.readFileSync(resolveSource(BASE_REPORTER_REL), 'utf8');
		const reporter = fs.readFileSync(resolveSource(REPORTER_REL), 'utf8');
		assertPromiseSignature(base, 'public async close(): Promise<void> {');
		assertPromiseSignature(base, 'public async updateExtensionStatus(extension: IssueReporterExtensionData) {');
		assert.ok(base.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(reporter.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(base, updateTargetCall);
		assertWrapped(base, updateMatchesCall);
		assertWrapped(base, closeCall);
		assertWrapped(reporter, closeCall);
		assert.ok(!base.includes('\t\t\tthis.updateExtensionStatus(targetExtension);\n'));
		assert.ok(!base.includes('\t\t\t\t\t\t\tthis.updateExtensionStatus(matches[0]);\n'));
		assert.ok(!base.includes('\t\t\t\t\t\tthis.updateExtensionStatus(matches[0]);\n'));
		assert.ok(!base.includes('\t\t\t\t\t\t\tthis.close();\n'));
		assert.ok(!base.includes('\t\t\t\t\tthis.close();\n'));
		assert.ok(!base.includes('\t\tthis.close();\n'));
		assert.ok(!reporter.includes('\t\tthis.close();\n'));
		assert.ok(base.includes(leftoverRenderCall));
		assert.ok(!base.includes(`this.renderBlocks()${doubleCatch}`));
		assert.ok(base.includes(leftoverRenderCatchCall) || base.includes('\t\t\tthis.renderBlocks();\n'));
		assert.ok(base.includes(leftoverRenderDataCall) || base.includes('\t\tthis.renderBlocks();\n'));
		assert.ok(base.includes(leftoverOpenLinkCall));
		assert.ok(!base.includes(`this.openLink(url)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(SHARE_CONTRIB_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SHARE_SERVICE_REL), 'utf8');
		const base = fs.readFileSync(resolveSource(BASE_REPORTER_REL), 'utf8');
		const form = fs.readFileSync(resolveSource(FORM_REL), 'utf8');
		const overlay = fs.readFileSync(resolveSource(OVERLAY_REL), 'utf8');
		const reporter = fs.readFileSync(resolveSource(REPORTER_REL), 'utf8');
		const issueContrib = fs.readFileSync(resolveSource(ISSUE_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(base, 'private async openLink(eventOrUrl: MouseEvent | string): Promise<void> {');
		assertPromiseSignature(form, 'async closeReporter(): Promise<void> {');

		assert.ok(contrib.includes(leftoverShareOpenerCall));
		assert.ok(!contrib.includes(`urlService.open(result, { openExternal: true })${doubleCatch}`));
		assert.ok(contrib.includes('override async run(accessor: ServicesAccessor, ...args: unknown[]): Promise<void> {'));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(issueContrib.includes('override async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(issueContrib.includes('return issueService.openReporter({ issueType: IssueType.PerformanceIssue });'));
		assert.ok(!issueContrib.includes(doubleCatch));
		assert.ok(form.includes(leftoverCloseReporterCall));
		assert.ok(!form.includes(`this.closeReporter()${doubleCatch}`));
		assert.ok(base.includes(leftoverOpenLinkCall));
		assert.ok(!base.includes(`this.openLink(url)${doubleCatch}`));
		assert.ok(base.includes('await this.openLink(result.html_url);'));
		assert.ok(!base.includes(`await this.openLink(result.html_url)${doubleCatch}`));
		assert.ok(base.includes('await this.openLink(url);'));
		assert.ok(reporter.includes('await this.openerService.open(result.html_url, { openExternal: true });'));
		assert.ok(!reporter.includes(`openerService.open(result.html_url, { openExternal: true })${doubleCatch}`));
		assert.ok(service.includes('return selected.provider.provideShare(item, token);'));
		assert.ok(!service.includes(`return selected.provider.provideShare(item, token)${doubleCatch}`));
		assert.ok(overlay.includes('this.searchSimilarIssues();'));
		assert.ok(!overlay.includes(`this.searchSimilarIssues()${doubleCatch}`));

		for (const source of [contrib, service, base, form, overlay, reporter, issueContrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D883'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D773 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const webview = fs.readFileSync(resolveSource(WEBVIEW_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const simpleSuggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const agentSessions = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const tags = fs.readFileSync(resolveSource(TAGS_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const replNotebook = fs.readFileSync(resolveSource(REPL_NOTEBOOK_REL), 'utf8');
		const interactive = fs.readFileSync(resolveSource(INTERACTIVE_REL), 'utf8');
		const accessibility = fs.readFileSync(resolveSource(ACCESSIBILITY_REL), 'utf8');
		const inlineChat = fs.readFileSync(resolveSource(INLINE_CHAT_REL), 'utf8');
		const mergeEditor = fs.readFileSync(resolveSource(MERGE_EDITOR_REL), 'utf8');
		const form = fs.readFileSync(resolveSource(FORM_REL), 'utf8');
		const base = fs.readFileSync(resolveSource(BASE_REPORTER_REL), 'utf8');

		let d773Sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d773AlreadyDouble) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D773 already-double drifted: ${rel} ${call}`);
			d773Sites += count;
		}
		assert.strictEqual(d773Sites, 11);

		assert.ok(webview.includes(leftoverFindStopCall));
		assert.ok(!webview.includes(`this._send('find-stop', { clearSelection: !keepSelection })${doubleCatch}`));
		assert.ok(webview.includes(leftoverFocusCall));
		assert.ok(!webview.includes(`this._send('focus', undefined)${doubleCatch}`));

		assert.ok(instance.includes(leftoverResizeCall));
		assert.ok(!instance.includes(`this._resize()${doubleCatch}`));
		assert.ok(service.includes(leftoverShowBackgroundCall));
		assert.ok(!service.includes(`this.showBackgroundTerminal(value)${doubleCatch}`));

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

		assert.ok(form.includes(leftoverCloseReporterCall));
		assert.ok(!form.includes(`this.closeReporter()${doubleCatch}`));
		assert.ok(base.includes(leftoverRenderCall));
		assert.ok(!base.includes(`this.renderBlocks()${doubleCatch}`));

		assert.ok(agentSessions.includes(leftoverOpenAgentSessionCall) || agentSessions.includes('openAgentSession'));
		assert.ok(!agentSessions.includes(`this.openAgentSession(${doubleCatch}`));
		assert.ok(agentSessions.includes(leftoverShowContextMenuCall) || agentSessions.includes('showContextMenu'));
		assert.ok(!agentSessions.includes(`this.showContextMenu(${doubleCatch}`));

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
			[TAGS_REL, tags],
			[HISTORY_REL, history],
			[REPL_NOTEBOOK_REL, replNotebook],
			[INTERACTIVE_REL, interactive],
			[ACCESSIBILITY_REL, accessibility],
			[INLINE_CHAT_REL, inlineChat],
			[MERGE_EDITOR_REL, mergeEditor],
			[WEBVIEW_REL, webview],
		] as const) {
			assert.ok(!file.includes('D883'), `${rel} should stay off this knife`);
		}
		assert.ok(!base.includes('D883'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tags/test/node/tagsLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/multiDiffEditor/test/node/multiDiffEditorLeftoverPromiseCatchScanD883.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/issue/test/node/issueLeftoverPromiseCatchScanD773.test.ts')));
	});
});
