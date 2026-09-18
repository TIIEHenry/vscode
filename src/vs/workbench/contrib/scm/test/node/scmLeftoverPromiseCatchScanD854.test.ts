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
const HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const REPOS_REL = 'src/vs/workbench/contrib/scm/browser/scmRepositoriesViewPane.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
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
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const EDITING_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedNotebookEntry.ts';
const AICUSTOM_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const CONFIGURATION_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const BULK_EDIT_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';

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

const loadMoreCall = 'this._loadMore()';
const addRepoCall = 'this.onDidAddRepository(repository)';
const updateBadgeCall = 'this.updateActivityBadge()';
const startStopCall = 'this.startStopCandidateListener()';
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
const researchCall = 'this.research()';
const submitCall = 'this.submitSearch()';
const refreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
const launchCall = 'this.launchOrAttachToSession(session)';
const toggleCall = 'this.toggleExceptionWidget()';
const assignedQuickDiffThenCall = 'this._quickDiffsPromise = this.getOriginalResource().then(async (quickDiffs) => {';

const d854Calls: Array<[string, string, number]> = [
	[HISTORY_REL, loadMoreCall, 2],
	[REPOS_REL, addRepoCall, 1],
	[EXPLORER_REL, updateBadgeCall, 3],
	[EXPLORER_REL, startStopCall, 1],
];

suite('leftover remaining unused after D781 overflow to leftover remaining unused remote leftover remaining unused Promise fire-and-forget catch scan (D854)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused scm leftover remaining unused after D781 after discarding already-double had fewer than four legal unused leftover sites so this knife overflowed', () => {
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const repos = fs.readFileSync(resolveSource(REPOS_REL), 'utf8');
		assertPromiseSignature(history, 'private async _loadMore(cursor?: string): Promise<void> {');
		assertPromiseSignature(repos, 'private async onDidAddRepository(repository: ISCMRepository): Promise<void> {');
		assert.ok(history.includes('void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.strictEqual((history.match(/void this\.refresh\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 3);
		let scmSites = 0;
		scmSites += countIncludes(history, `${loadMoreCall}${doubleCatch}`);
		scmSites += countIncludes(repos, `${addRepoCall}${doubleCatch}`);
		assert.strictEqual(scmSites, 3, `expected leftover remaining unused scm legal leftover 3, got ${scmSites}`);
		assert.ok(scmSites < 4, `expected leftover remaining unused scm legal leftover <4, got ${scmSites}`);
		assert.ok(!history.includes('D854'));
		assert.ok(!repos.includes('D854'));
	});

	test('this knife covers seven leftover Promise double-chain sites after leftover remaining unused after D781 overflowed', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d854Calls) {
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
		assert.strictEqual(countIncludes(seen.get(HISTORY_REL) ?? '', `${loadMoreCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(seen.get(REPOS_REL) ?? '', `${addRepoCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(seen.get(EXPLORER_REL) ?? '', `${updateBadgeCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(seen.get(EXPLORER_REL) ?? '', `${startStopCall}${doubleCatch}`), 1);
		assert.strictEqual(countDoubleChains(seen.get(HISTORY_REL) ?? ''), 5);
	});

	test('scm leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const repos = fs.readFileSync(resolveSource(REPOS_REL), 'utf8');
		assertPromiseSignature(history, 'private async _loadMore(cursor?: string): Promise<void> {');
		assertPromiseSignature(repos, 'private async onDidAddRepository(repository: ISCMRepository): Promise<void> {');
		assert.ok(history.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(repos.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(history, loadMoreCall);
		assertWrapped(repos, addRepoCall);
		assert.strictEqual(countIncludes(history, `${loadMoreCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(repos, `${addRepoCall}${doubleCatch}`), 1);
		assert.ok(!history.includes('\t\t\t\tthis._loadMore();\n'));
		assert.ok(!history.includes(', () => this._loadMore()),'));
		assert.ok(history.includes('await this._loadMore(historyItemRef.revision);'));
		assert.ok(!history.includes(`await this._loadMore(historyItemRef.revision)${doubleCatch}`));
		assert.ok(!repos.includes('\t\t\t\t\tthis.onDidAddRepository(repository);\n'));
	});

	test('overflow leftover remaining unused remote leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		assertPromiseSignature(explorer, 'private async updateActivityBadge() {');
		assertPromiseSignature(explorer, 'private async startStopCandidateListener() {');
		assert.ok(explorer.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(explorer, updateBadgeCall);
		assertWrapped(explorer, startStopCall);
		assert.strictEqual(countIncludes(explorer, `${updateBadgeCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(explorer, `${startStopCall}${doubleCatch}`), 1);
		assert.ok(!explorer.includes('\t\t\t\t\tthis.updateActivityBadge();\n'));
		assert.ok(!explorer.includes('\t\t\t\tthis.updateActivityBadge();\n'));
		assert.ok(!explorer.includes('\t\tthis.startStopCandidateListener();\n'));
		assert.ok(explorer.includes('await this.startStopCandidateListener();'));
		assert.ok(!explorer.includes(`await this.startStopCandidateListener()${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const repos = fs.readFileSync(resolveSource(REPOS_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const quickDiff = fs.readFileSync(resolveSource('src/vs/workbench/contrib/scm/browser/quickDiffModel.ts'), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(history, 'private async _loadMore(cursor?: string): Promise<void> {');

		assert.ok(history.includes('IOpenerService'));
		assert.ok(!history.includes(`openerService.open${doubleCatch}`));
		assert.ok(history.includes('async runInView(_: ServicesAccessor, view: SCMHistoryViewPane): Promise<void> {'));
		assert.ok(history.includes('\t\tview.refresh();'));
		assert.ok(!history.includes(`view.refresh()${doubleCatch}`));
		assert.ok(history.includes('\t\tview.pickRepository();'));
		assert.ok(!history.includes(`view.pickRepository()${doubleCatch}`));
		assert.ok(history.includes('\t\tview.pickHistoryItemRef();'));
		assert.ok(!history.includes(`view.pickHistoryItemRef()${doubleCatch}`));
		assert.ok(history.includes('\t\tview.revealCurrentHistoryItem();'));
		assert.ok(!history.includes(`view.revealCurrentHistoryItem()${doubleCatch}`));
		assert.ok(history.includes('return this._refreshThrottler.queue(token => this._refresh(token));'));
		assert.ok(!history.includes(`return this._refreshThrottler.queue(token => this._refresh(token))${doubleCatch}`));
		assert.ok(quickDiff.includes(assignedQuickDiffThenCall));
		assert.ok(!quickDiff.includes(`${assignedQuickDiffThenCall}${doubleCatch}`));
		assert.ok(history.includes('void this.refresh().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(explorer.includes('this.enableForwardedPortsFeatures().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(explorer.includes('this.restore().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(explorer.includes('this.initialize().catch(onUnexpectedError).catch(onUnexpectedError);'));

		for (const source of [history, repos, explorer]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D854'));
		}
	});

	test('D828 leftover remaining locks stay leftover remaining unused; loopCheck / openView / assigned _currentSuggestionDetails.then stay leftover remaining unused; already-double stay already-double; this knife did not overflow into dirty leftover modules', () => {
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');
		const repos = fs.readFileSync(resolveSource(REPOS_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
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
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const debugEditor = fs.readFileSync(resolveSource(DEBUG_EDITOR_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const aicustom = fs.readFileSync(resolveSource(AICUSTOM_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIGURATION_REL), 'utf8');
		const markers = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		const bulkEdit = fs.readFileSync(resolveSource(BULK_EDIT_REL), 'utf8');

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

		assert.ok(searchWidget.includes(`${submitCall}${doubleCatch}`));
		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));
		assert.ok(debugEditor.includes(`${toggleCall}${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));
		assert.ok(editing.includes(`this.initializeModelsFromDiff()${doubleCatch}`));
		assert.ok(aicustom.includes(`this.showEmbeddedMcpDetail(server)${doubleCatch}`) || aicustom.includes(`this.showPluginDetail(item)${doubleCatch}`));
		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(configuration.includes(`this.updateCache()${doubleCatch}`));

		for (const [rel, file] of [
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
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[DEBUG_EDITOR_REL, debugEditor],
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[FIND_MODEL_REL, findModel],
			[TASKS_REL, tasks],
			[EDITING_REL, editing],
			[AICUSTOM_REL, aicustom],
			[MCP_DISCOVERY_REL, discovery],
			[CONFIGURATION_REL, configuration],
			[MARKERS_REL, markers],
			[BULK_EDIT_REL, bulkEdit],
		] as const) {
			assert.ok(!file.includes('D854'), `${rel} should stay off this knife`);
		}
		assert.ok(!history.includes('D854'));
		assert.ok(!repos.includes('D854'));
		assert.ok(!explorer.includes('D854'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD854.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD781.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/remote/test/node/remoteLeftoverPromiseCatchScanD784.test.ts')));
	});
});
