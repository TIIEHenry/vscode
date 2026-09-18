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
const TYPES_REL = 'src/vs/workbench/contrib/mcp/common/mcpTypes.ts';
const QUICK_REL = 'src/vs/workbench/contrib/mcp/browser/mcpResourceQuickAccess.ts';
const HANDLER_REL = 'src/vs/workbench/contrib/mcp/common/mcpServerRequestHandler.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/mcp/browser/mcpServerEditor.ts';
const STDIO_REL = 'src/vs/workbench/contrib/mcp/node/mcpStdioStateHandler.ts';
const SERVERS_VIEW_REL = 'src/vs/workbench/contrib/mcp/browser/mcpServersView.ts';
const SERVER_REL = 'src/vs/workbench/contrib/mcp/common/mcpServer.ts';
const DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const MIGRATION_REL = 'src/vs/workbench/contrib/mcp/browser/mcpMigration.ts';
const WORKBENCH_REL = 'src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts';
const HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const REPOS_REL = 'src/vs/workbench/contrib/scm/browser/scmRepositoriesViewPane.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const SUGGEST_CONTRIB_REL = 'src/vs/workbench/contrib/terminalContrib/suggest/browser/terminal.suggest.contribution.ts';
const STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const PLAN_REVIEW_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatContentParts/chatPlanReviewPart.ts';
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
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const BULK_EDIT_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const OUTPUT_REL = 'src/vs/workbench/contrib/output/browser/outputServices.ts';
const LOGS_REL = 'src/vs/workbench/contrib/logs/common/logsActions.ts';

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

const checkDirCall = 'this.checkIfDirectoryAndPopulate(resource, server)';
const sendLogCall = 'this._sendLogLevelToServer(logLevel)';
const renderResourcesCall = 'this.renderExtensionResources(this.container, extension)';
const killForcefulCall = 'this.killForceful()';
const killPoliteCall = 'this.killPolite()';
const showCall = 'this.show()';
const showOutputCall = 'this.showOutput()';
const leftoverCheckFileCall = 'this.checkForMcpConfigInFile(file, isRemote)';
const leftoverProfileCall = 'e => this.onDidChangeProfile()';
const leftoverMcpSendLogCall = 'mcp._sendLogLevelToServer(opts.logger.getLevel())';
const returnedShowOutputCall = 'run: () => this.showOutput(),';
const loadMoreCall = 'this._loadMore()';
const addRepoCall = 'this.onDidAddRepository(repository)';
const updateBadgeCall = 'this.updateActivityBadge()';
const startStopCall = 'this.startStopCandidateListener()';
const resolveCall = 'this.resolveEditorModel(resource, false /* do not create if missing */)';
const prepareXtermRawCall = 'this._prepareAddonLayout(xtermRaw)';
const notebookUpdateCall = 'this._update()';
const researchCall = 'this.research()';
const submitCall = 'this.submitSearch()';
const refreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
const launchCall = 'this.launchOrAttachToSession(session)';
const toggleCall = 'this.toggleExceptionWidget()';
const leftoverClearAllCall = 'this.clearAllInlineFeedback()';
const leftoverExitFeedbackCall = 'this.exitFeedbackMode()';
const leftoverSubmitRejectionCall = 'this.submitRejection()';
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
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';

const d860Calls: Array<[string, string, number]> = [
	[QUICK_REL, checkDirCall, 1],
	[HANDLER_REL, sendLogCall, 1],
	[EDITOR_REL, renderResourcesCall, 1],
	[STDIO_REL, killForcefulCall, 2],
	[STDIO_REL, killPoliteCall, 1],
	[SERVERS_VIEW_REL, showCall, 1],
	[SERVER_REL, showOutputCall, 1],
];

suite('leftover remaining unused after D824 leftover remaining unused mcp leftover remaining unused Promise fire-and-forget catch scan (D860)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused mcp leftover remaining unused after D772/D824 already-double after discarding collision overflow still has four or more legal unused leftover sites so this knife stayed', () => {
		const discovery = fs.readFileSync(resolveSource(DISCOVERY_REL), 'utf8');
		const migration = fs.readFileSync(resolveSource(MIGRATION_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_REL), 'utf8');
		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(migration.includes(`this.migrateMcpConfig()${doubleCatch}`));
		assert.ok(workbench.includes(`this.open(local)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(discovery), 1);
		assert.strictEqual(countDoubleChains(migration), 1);
		assert.strictEqual(countDoubleChains(workbench), 5);
		assert.ok(migration.includes(`${leftoverCheckFileCall};`));
		assert.ok(!migration.includes(`${leftoverCheckFileCall}${doubleCatch}`));
		assert.ok(workbench.includes(`${leftoverProfileCall})`));
		assert.ok(!workbench.includes(`${leftoverProfileCall}${doubleCatch}`));
		assert.ok(!discovery.includes('D860'));
		assert.ok(!migration.includes('D860'));
		assert.ok(!workbench.includes('D860'));
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d860Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			sites += countIncludes(source, `${call}${doubleCatch}`);
		}
		assert.ok(sites >= 4, `expected leftover remaining unused mcp legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused after D824 stayed on mcp leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d860Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countIncludes(seen.get(QUICK_REL) ?? '', `${checkDirCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(HANDLER_REL) ?? '', `${sendLogCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(EDITOR_REL) ?? '', `${renderResourcesCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(STDIO_REL) ?? '', `${killForcefulCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(seen.get(STDIO_REL) ?? '', `${killPoliteCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(SERVERS_VIEW_REL) ?? '', `${showCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(SERVER_REL) ?? '', `${showOutputCall}${doubleCatch}`), 1);
		assert.strictEqual(countDoubleChains(seen.get(QUICK_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(STDIO_REL) ?? ''), 3);
		assert.strictEqual(countDoubleChains(seen.get(SERVERS_VIEW_REL) ?? ''), 1);
	});

	test('mcp leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const quick = fs.readFileSync(resolveSource(QUICK_REL), 'utf8');
		const handler = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const stdio = fs.readFileSync(resolveSource(STDIO_REL), 'utf8');
		const serversView = fs.readFileSync(resolveSource(SERVERS_VIEW_REL), 'utf8');
		const server = fs.readFileSync(resolveSource(SERVER_REL), 'utf8');
		const types = fs.readFileSync(resolveSource(TYPES_REL), 'utf8');
		assertPromiseSignature(quick, 'public async checkIfDirectoryAndPopulate(resource: IMcpResource | IMcpResourceTemplate, server: IMcpServer): Promise<boolean> {');
		assertPromiseSignature(handler, 'private async _sendLogLevelToServer(logLevel: LogLevel): Promise<void> {');
		assertPromiseSignature(editor, 'private async renderExtensionResources(container: HTMLElement, extension: IWorkbenchMcpServer): Promise<void> {');
		assertPromiseSignature(stdio, 'private async killForceful() {');
		assertPromiseSignature(stdio, 'private async killPolite() {');
		assertPromiseSignature(serversView, 'override async show(): Promise<IPagedModel<IWorkbenchMcpServer>> {');
		assertPromiseSignature(types, 'showOutput(preserveFocus?: boolean): Promise<void>;');
		assert.ok(quick.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(handler.includes('import { CancellationError, onUnexpectedError } from \'../../../../base/common/errors.js\';'));
		assert.ok(editor.includes('import { isCancellationError, onUnexpectedError } from \'../../../../base/common/errors.js\';'));
		assert.ok(stdio.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(serversView.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(server.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(quick, checkDirCall);
		assertWrapped(handler, sendLogCall);
		assertWrapped(editor, renderResourcesCall);
		assertWrapped(stdio, killForcefulCall);
		assertWrapped(stdio, killPoliteCall);
		assertWrapped(serversView, showCall);
		assertWrapped(server, showOutputCall);
		assert.ok(!quick.includes('\t\t\tthis.checkIfDirectoryAndPopulate(resource, server);\n'));
		assert.ok(!handler.includes('\t\t\tthis._sendLogLevelToServer(logLevel);\n'));
		assert.ok(!editor.includes('\t\tthis.renderExtensionResources(this.container, extension);\n'));
		assert.ok(!stdio.includes('\t\t\tthis.killForceful();\n'));
		assert.ok(!stdio.includes('() => this.killForceful(),'));
		assert.ok(!stdio.includes('() => this.killPolite(),'));
		assert.ok(!serversView.includes('() => this.show())'));
		assert.ok(!server.includes('\t\t\t\t\tthis.showOutput();\n'));
		assert.ok(handler.includes(`${leftoverMcpSendLogCall};`));
		assert.ok(!handler.includes(`${leftoverMcpSendLogCall}${doubleCatch}`));
		assert.ok(server.includes(returnedShowOutputCall));
		assert.ok(!server.includes(`run: () => this.showOutput()${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const quick = fs.readFileSync(resolveSource(QUICK_REL), 'utf8');
		const handler = fs.readFileSync(resolveSource(HANDLER_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const stdio = fs.readFileSync(resolveSource(STDIO_REL), 'utf8');
		const serversView = fs.readFileSync(resolveSource(SERVERS_VIEW_REL), 'utf8');
		const server = fs.readFileSync(resolveSource(SERVER_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const types = fs.readFileSync(resolveSource(TYPES_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(types, 'showOutput(preserveFocus?: boolean): Promise<void>;');

		assert.ok(editor.includes('() => this.openerService.open(uri)'));
		assert.ok(!editor.includes(`this.openerService.open(uri)${doubleCatch}`));
		assert.ok(serversView.includes('IOpenerService'));
		assert.ok(!serversView.includes(`openerService.open${doubleCatch}`));
		assert.ok(quick.includes('return this._resourceToAttachment(resource).then(val => val || noop);'));
		assert.ok(!quick.includes(`return this._resourceToAttachment(resource).then(val => val || noop)${doubleCatch}`));
		assert.ok(quick.includes('return this._resourceTemplateToAttachment(resource).then(val => val || noop);'));
		assert.ok(!quick.includes(`return this._resourceTemplateToAttachment(resource).then(val => val || noop)${doubleCatch}`));
		assert.ok(handler.includes('void this._rpc.handleMessage(message).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(editor.includes(`this.open(id, extension, template, cts.token)
				.then(activeElement => {`));
		assert.ok(server.includes(returnedShowOutputCall));
		assert.ok(!server.includes(`run: () => this.showOutput()${doubleCatch}`));
		assert.ok(!stdio.includes('extends Action2'));
		assert.ok(!stdio.includes('.then(undefined,'));

		for (const source of [quick, handler, editor, stdio, serversView, server]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D860'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; loopCheck / openView / assigned _currentSuggestionDetails.then stay leftover remaining unused; already-double stay already-double; this knife did not overflow into dirty leftover modules', () => {
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const repos = fs.readFileSync(resolveSource(REPOS_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const suggestContrib = fs.readFileSync(resolveSource(SUGGEST_CONTRIB_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const planReview = fs.readFileSync(resolveSource(PLAN_REVIEW_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const debugEditor = fs.readFileSync(resolveSource(DEBUG_EDITOR_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const markers = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		const bulkEdit = fs.readFileSync(resolveSource(BULK_EDIT_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const logs = fs.readFileSync(resolveSource(LOGS_REL), 'utf8');

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
		assert.ok(testing.includes(`${openAndShowCall};`));
		assert.ok(!testing.includes(`${openAndShowCall}${doubleCatch}`));
		assert.ok(searchEditor.includes(leftoverNoArgIncludesCall));
		assert.ok(!searchEditor.includes(`() => this.triggerSearch()${doubleCatch}`));

		assert.ok(planReview.includes(`${leftoverClearAllCall}${doubleCatch}`));
		assert.ok(planReview.includes(`${leftoverExitFeedbackCall}${doubleCatch}`));
		assert.ok(planReview.includes(`${leftoverSubmitRejectionCall}${doubleCatch}`));
		assert.ok(!planReview.includes('\t\t\tthis._register(clearAllButton.onDidClick(() => this.clearAllInlineFeedback()));\n'));

		assert.ok(history.includes(`${loadMoreCall}${doubleCatch}`));
		assert.ok(repos.includes(`${addRepoCall}${doubleCatch}`));
		assert.ok(explorer.includes(`${updateBadgeCall}${doubleCatch}`));
		assert.ok(explorer.includes(`${startStopCall}${doubleCatch}`));
		assert.ok(files.includes(`${resolveCall}${doubleCatch}`));
		assert.ok(suggestContrib.includes(`${prepareXtermRawCall}${doubleCatch}`));
		assert.ok(status.includes(`${notebookUpdateCall}${doubleCatch}`));
		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.ok(searchWidget.includes(`${submitCall}${doubleCatch}`));
		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));
		assert.ok(debugEditor.includes(`${toggleCall}${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));

		for (const [rel, file] of [
			[HISTORY_REL, history],
			[REPOS_REL, repos],
			[EXPLORER_REL, explorer],
			[FILES_REL, files],
			[SUGGEST_CONTRIB_REL, suggestContrib],
			[STATUS_REL, status],
			[FIND_MODEL_REL, findModel],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TEXT_MODEL_REL, textModel],
			[PROFILE_MODEL_REL, profileModel],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[PLAN_REVIEW_REL, planReview],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[DEBUG_EDITOR_REL, debugEditor],
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[TASKS_REL, tasks],
			[TESTING_REL, testing],
			[MARKERS_REL, markers],
			[BULK_EDIT_REL, bulkEdit],
			[OUTLINE_REL, outline],
			[OUTPUT_REL, output],
			[LOGS_REL, logs],
		] as const) {
			assert.ok(!file.includes('D860'), `${rel} should stay off this knife`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/outline/test/node/outlineLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/logs/test/node/logsLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD860.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD772.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD824.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD854.test.ts')));
	});
});
