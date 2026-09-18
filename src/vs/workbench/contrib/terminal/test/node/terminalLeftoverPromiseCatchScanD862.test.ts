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
const MAIN_REL = 'src/vs/workbench/contrib/terminal/browser/terminalMainContribution.ts';
const RESOLVER_REL = 'src/vs/workbench/contrib/terminal/browser/terminalProfileResolverService.ts';
const PROFILE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalProfileService.ts';
const TABS_REL = 'src/vs/workbench/contrib/terminal/browser/terminalTabsList.ts';
const INSTANCE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalInstance.ts';
const SERVICE_REL = 'src/vs/workbench/contrib/terminal/browser/terminalService.ts';
const PROCESS_REL = 'src/vs/workbench/contrib/terminal/browser/terminalProcessManager.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const REMOTE_PTY_REL = 'src/vs/workbench/contrib/terminal/browser/remotePty.ts';
const HOST_PTY_REL = 'src/vs/workbench/contrib/terminal/browser/agentHostPty.ts';
const SUGGEST_CONTRIB_REL = 'src/vs/workbench/contrib/terminalContrib/suggest/browser/terminal.suggest.contribution.ts';
const FIND_REL = 'src/vs/workbench/contrib/terminalContrib/find/browser/terminalFindWidget.ts';
const STICKY_REL = 'src/vs/workbench/contrib/terminalContrib/stickyScroll/browser/terminalStickyScrollOverlay.ts';
const RESIZE_REL = 'src/vs/workbench/contrib/terminalContrib/resizeDimensionsOverlay/browser/terminal.resizeDimensionsOverlay.contribution.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const EXPLORER_VIEWER_REL = 'src/vs/workbench/contrib/files/browser/views/explorerViewer.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';
const STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts';
const OUTPUT_SERVICES_REL = 'src/vs/workbench/contrib/output/browser/outputServices.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const AGENT_SESSIONS_REL = 'src/vs/workbench/contrib/chat/browser/agentSessions/agentSessionsControl.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const UNIFICATION_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const RUNTIME_EXT_REL = 'src/vs/workbench/contrib/extensions/browser/abstractRuntimeExtensionsEditor.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const BULK_EDIT_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const SCM_HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const MCP_SERVER_REL = 'src/vs/workbench/contrib/mcp/common/mcpServer.ts';
const PROFILE_INTEGRATION_REL = 'src/vs/workbench/contrib/terminal/test/browser/terminalProfileService.integrationTest.ts';

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

const initCall = 'this._init(\n\t\t\teditorResolverService,\n\t\t\tembedderTerminalService,\n\t\t\tworkbenchEnvironmentService,\n\t\t\tlabelService,\n\t\t\tlifecycleService,\n\t\t\tterminalService,\n\t\t\tterminalEditorService,\n\t\t\tterminalGroupService,\n\t\t\tterminalInstanceService\n\t\t)';
const refreshDefaultCall = 'this._refreshDefaultProfileName()';
const refreshAvailableCall = 'this._refreshAvailableProfilesNow()';
const handleExternalDropCall = 'this._handleExternalDrop(targetInstance, originalEvent)';
const setupConfigCall = 'void this._setupConfigListener()';
const getEnvironmentThenCall = 'this._remoteAgentService.getEnvironment().then(env => this._primaryBackendOs = env?.os || OS)';
const leftoverResizeCall = 'this._resize();';
const leftoverResizeTrueCall = 'this._resize(true);';
const leftoverUnicodeCall = 'this._updateUnicodeVersion();';
const leftoverSendTextCall = 'this.sendText(e.command.command, e.noNewLine ? false : true);';
const leftoverShowBackgroundCall = 'this.showBackgroundTerminal(value);';
const leftoverRevealCall = 'this.revealTerminal(instance);';
const leftoverMoveCall = 'this.moveToTerminalView(sourceInstance, instance, e.side);';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const resolveCall = 'this.resolveEditorModel(resource, false /* do not create if missing */)';
const processIgnoreCall = 'this.processIgnoreFile(stat.root.resource.toString(), stat.resource, false)';
const researchCall = 'this.research()';
const updateCall = 'this._update()';
const submitSearchCall = 'this.submitSearch()';
const refreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
const launchCall = 'this.launchOrAttachToSession(session)';
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
const openAndShowCall = 'this.openAndShow(messageItReferenceToUri(m))';

const d862Calls: Array<[string, string, number]> = [
	[MAIN_REL, initCall, 1],
	[RESOLVER_REL, refreshDefaultCall, 2],
	[PROFILE_REL, refreshAvailableCall, 1],
	[TABS_REL, handleExternalDropCall, 1],
];

suite('leftover remaining unused terminal leftover remaining unused after D748 leftover remaining unused Promise fire-and-forget catch scan (D862)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused terminal leftover remaining unused after D748 already-double still had four or more legal unused leftover sites so this knife stayed', () => {
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		assertPromiseSignature(main, 'private async _init(');
		assertPromiseSignature(resolver, 'private async _refreshDefaultProfileName() {');
		assertPromiseSignature(profile, 'protected async _refreshAvailableProfilesNow(): Promise<void> {');
		assertPromiseSignature(tabs, 'private async _handleExternalDrop(instance: ITerminalInstance | undefined, e: DragEvent) {');
		let sites = 0;
		for (const [, , count] of d862Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused terminal legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(countIncludes(main, `${initCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(resolver, `${refreshDefaultCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(profile, `${refreshAvailableCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(tabs, `${handleExternalDropCall}${doubleCatch}`), 1);
		assert.ok(resolver.includes(`${getEnvironmentThenCall}${doubleCatch}`));
		assert.ok(profile.includes(`${setupConfigCall}${doubleCatch}`));
		assert.ok(!main.includes('D862'));
		assert.ok(!resolver.includes('D862'));
		assert.ok(!profile.includes('D862'));
		assert.ok(!tabs.includes('D862'));
	});

	test('this knife covers five leftover Promise double-chain sites after leftover remaining unused stayed on terminal leftover remaining unused', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d862Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(MAIN_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(RESOLVER_REL) ?? ''), 3);
		assert.strictEqual(countDoubleChains(seen.get(PROFILE_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(TABS_REL) ?? ''), 1);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		assertPromiseSignature(main, 'private async _init(');
		assertPromiseSignature(resolver, 'private async _refreshDefaultProfileName() {');
		assertPromiseSignature(profile, 'protected async _refreshAvailableProfilesNow(): Promise<void> {');
		assertPromiseSignature(tabs, 'private async _handleExternalDrop(instance: ITerminalInstance | undefined, e: DragEvent) {');
		assert.ok(main.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(resolver.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(profile.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(tabs.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(main, initCall);
		assertWrapped(resolver, refreshDefaultCall);
		assertWrapped(profile, refreshAvailableCall);
		assertWrapped(tabs, handleExternalDropCall);
		assert.ok(!main.includes('\t\tthis._init(\n\t\t\teditorResolverService,\n\t\t\tembedderTerminalService,\n\t\t\tworkbenchEnvironmentService,\n\t\t\tlabelService,\n\t\t\tlifecycleService,\n\t\t\tterminalService,\n\t\t\tterminalEditorService,\n\t\t\tterminalGroupService,\n\t\t\tterminalInstanceService\n\t\t);\n'));
		assert.ok(!resolver.includes('\t\t\t\tthis._refreshDefaultProfileName();\n'));
		assert.ok(!resolver.includes('() => this._refreshDefaultProfileName())'));
		assert.ok(!profile.includes('\t\tthis._refreshAvailableProfilesNow();\n'));
		assert.ok(!tabs.includes('\t\t\t\tthis._handleExternalDrop(targetInstance, originalEvent);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const processManager = fs.readFileSync(resolveSource(PROCESS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const resize = fs.readFileSync(resolveSource(RESIZE_REL), 'utf8');
		const remotePty = fs.readFileSync(resolveSource(REMOTE_PTY_REL), 'utf8');
		const hostPty = fs.readFileSync(resolveSource(HOST_PTY_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(profile, 'protected async _refreshAvailableProfilesNow(): Promise<void> {');

		assert.ok(!main.includes('openerService.open'));
		assert.ok(!main.includes('IOpenerService'));
		assert.ok(!main.includes('extends Action2'));
		assert.ok(!resolver.includes('openerService.open'));
		assert.ok(!resolver.includes('extends Action2'));
		assert.ok(!profile.includes('openerService.open'));
		assert.ok(!profile.includes('extends Action2'));
		assert.ok(!tabs.includes('openerService.open'));
		assert.ok(!tabs.includes('extends Action2'));
		assert.ok(instance.includes("this._openerService.open('https://code.visualstudio.com/docs/terminal/shell-integration?referrer=in-product');"));
		assert.ok(!instance.includes(`this._openerService.open('https://code.visualstudio.com/docs/terminal/shell-integration?referrer=in-product')${doubleCatch}`));
		const profileIntegration = fs.readFileSync(resolveSource(PROFILE_INTEGRATION_REL), 'utf8');
		assert.ok(profileIntegration.includes('this.hasRefreshedProfiles = this._refreshAvailableProfilesNow();'));
		assert.ok(!profileIntegration.includes(`this.hasRefreshedProfiles = this._refreshAvailableProfilesNow()${doubleCatch}`));
		assert.ok(processManager.includes('return this.ptyProcessReady.then(() => this._resize(cols, rows, pixelWidth, pixelHeight));'));
		assert.ok(!processManager.includes(`return this.ptyProcessReady.then(() => this._resize(cols, rows, pixelWidth, pixelHeight))${doubleCatch}`));
		assert.ok(resize.includes('this._ctx.processManager.ptyProcessReady.then(() => {'));
		assert.ok(!resize.includes(`ptyProcessReady.then(() => {${doubleCatch}`));
		assert.ok(remotePty.includes('this._startBarrier.wait().then(_ => {'));
		assert.ok(!remotePty.includes(`this._startBarrier.wait().then(_ => {}${doubleCatch}`));
		assert.ok(hostPty.includes('void this._connection.disposeTerminal(this._terminalUri).catch(err => this._logHostDisposalError(err));'));
		assert.ok(!hostPty.includes('void this._connection.disposeTerminal(this._terminalUri).catch(onUnexpectedError)'));
		assert.ok(profile.includes('return this._profilesReadyBarrier.wait().then(() => { });'));
		assert.ok(!profile.includes(`return this._profilesReadyBarrier.wait().then(() => { })${doubleCatch}`));

		for (const source of [main, resolver, profile, tabs]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D862'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; already-double stay already-double; this knife did not overflow into dirty leftover modules', () => {
		const main = fs.readFileSync(resolveSource(MAIN_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const profile = fs.readFileSync(resolveSource(PROFILE_REL), 'utf8');
		const tabs = fs.readFileSync(resolveSource(TABS_REL), 'utf8');
		const instance = fs.readFileSync(resolveSource(INSTANCE_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const suggestContrib = fs.readFileSync(resolveSource(SUGGEST_CONTRIB_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const viewer = fs.readFileSync(resolveSource(EXPLORER_VIEWER_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const agentSessions = fs.readFileSync(resolveSource(AGENT_SESSIONS_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const runtimeExt = fs.readFileSync(resolveSource(RUNTIME_EXT_REL), 'utf8');
		const simpleSuggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const markers = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		const bulkEdit = fs.readFileSync(resolveSource(BULK_EDIT_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const scmHistory = fs.readFileSync(resolveSource(SCM_HISTORY_REL), 'utf8');
		const mcpServer = fs.readFileSync(resolveSource(MCP_SERVER_REL), 'utf8');

		assert.ok(instance.includes(leftoverResizeCall));
		assert.ok(!instance.includes(`this._resize()${doubleCatch}`));
		assert.ok(instance.includes(leftoverResizeTrueCall));
		assert.ok(!instance.includes(`this._resize(true)${doubleCatch}`));
		assert.ok(instance.includes(leftoverUnicodeCall));
		assert.ok(!instance.includes(`this._updateUnicodeVersion()${doubleCatch}`));
		assert.ok(instance.includes(leftoverSendTextCall));
		assert.ok(!instance.includes(`${leftoverSendTextCall.slice(0, -1)}${doubleCatch}`));
		assert.ok(service.includes(leftoverShowBackgroundCall));
		assert.ok(!service.includes(`this.showBackgroundTerminal(value)${doubleCatch}`));
		assert.ok(service.includes(leftoverRevealCall));
		assert.ok(!service.includes(`this.revealTerminal(instance)${doubleCatch}`));
		assert.ok(service.includes(leftoverMoveCall));
		assert.ok(!service.includes(`this.moveToTerminalView(sourceInstance, instance, e.side)${doubleCatch}`));
		assert.ok(xterm.includes(`this._updateUnicodeVersion()${doubleCatch}`));

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
		assert.ok(testing.includes(`${openAndShowCall};`));
		assert.ok(!testing.includes(`${openAndShowCall}${doubleCatch}`));

		assert.ok(searchEditor.includes(leftoverNoArgIncludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgExcludesCall));
		assert.ok(searchEditor.includes(leftoverNoArgMessageCall));
		assert.ok(!searchEditor.includes(`this.triggerSearch()${doubleCatch}`));

		assert.ok(files.includes(`${resolveCall}${doubleCatch}`));
		assert.ok(viewer.includes(`${processIgnoreCall}${doubleCatch}`));
		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(findModel, `${researchCall}${doubleCatch}`), 4);
		assert.ok(status.includes(`${updateCall}${doubleCatch}`));
		assert.ok(output.includes(`this.onDidRegisterChannel(channelIdentifier.id)${doubleCatch}`));
		assert.ok(searchWidget.includes(`${submitSearchCall}${doubleCatch}`));
		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(find), 5);
		assert.strictEqual(countDoubleChains(sticky), 3);
		assert.ok(suggestContrib.includes('this._prepareAddonLayout(xterm)'));
		assert.ok(suggestContrib.includes(doubleCatch));

		for (const [rel, file] of [
			[FIND_MODEL_REL, findModel],
			[STATUS_REL, status],
			[OUTPUT_SERVICES_REL, output],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[PLAN_REVIEW_REL, planReview],
			[CHAT_WIDGET_REL, chatWidget],
			[AGENT_SESSIONS_REL, agentSessions],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[RUNTIME_EXT_REL, runtimeExt],
			[SUGGEST_REL, simpleSuggest],
			[SETTINGS_REL, settings],
			[TEXT_MODEL_REL, textModel],
			[PROFILE_MODEL_REL, profileModel],
			[TASKS_REL, tasks],
			[TESTING_REL, testing],
			[FIND_REL, find],
			[STICKY_REL, sticky],
			[SUGGEST_CONTRIB_REL, suggestContrib],
			[FILES_REL, files],
			[EXPLORER_VIEWER_REL, viewer],
			[MARKERS_REL, markers],
			[BULK_EDIT_REL, bulkEdit],
			[OUTLINE_REL, outline],
			[SCM_HISTORY_REL, scmHistory],
			[MCP_SERVER_REL, mcpServer],
			[INSTANCE_REL, instance],
			[SERVICE_REL, service],
			[XTERM_REL, xterm],
		] as const) {
			assert.ok(!file.includes('D862'), `${rel} should stay off this knife`);
		}
		assert.ok(!main.includes('D862'));
		assert.ok(!resolver.includes('D862'));
		assert.ok(!profile.includes('D862'));
		assert.ok(!tabs.includes('D862'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD862.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD862.test.ts')));
	});
});
