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
const CONTRIB_REL = 'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts';
const ABSTRACT_REL = 'src/vs/workbench/contrib/extensions/browser/abstractRuntimeExtensionsEditor.ts';
const ELECTRON_RUNTIME_REL = 'src/vs/workbench/contrib/extensions/electron-browser/runtimeExtensionsEditor.ts';
const REMOTE_INIT_REL = 'src/vs/workbench/contrib/extensions/electron-browser/remoteExtensionsInit.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts';
const STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts';
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
const AICUSTOM_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const CONFIGURATION_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const EDITING_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedNotebookEntry.ts';
const TEXTMODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const BULK_EDIT_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const SCM_HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const CHAT_BROWSER_REL = 'src/vs/workbench/contrib/chat/browser/chat.contribution.ts';

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

const statusCall = 'this.updateExtensionGalleryStatusContexts()';
const galleryCall = 'this.updateGalleryCapabilitiesContexts(extensionGalleryManifest)';
const updateExtCall = 'this._updateExtensions()';
const initCall = 'this.initializeRemoteExtensions()';
const enabledAutoCheckCall = 'this.checkForUpdates(`Enabled auto check updates`)';
const autoUpdateCall = 'this.autoUpdateBuiltinExtensions()';
const leftoverRefreshCall = '() => this.refresh())';
const leftoverDoSearchCall = '\t\tthis.doSearch(true);\n';
const leftoverAutoUpdateCall = '\t\t\tthis.autoUpdateExtensions();\n';
const leftoverInstallLocalCall = '\t\tthis.installExtensionsIfInstalledLocallyInRemote();\n';
const leftoverInstallFailedCall = '\t\tthis.installFailedRemoteExtensions();\n';
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
const updateCall = 'this._update()';
const researchCall = 'this.research()';
const launchCall = 'this.launchOrAttachToSession(session)';
const showErrorCall = 'this.showError(err.message, undefined, !!launch?.getConfiguration(config.name))';
const toggleCall = 'this.toggleExceptionWidget()';
const submitCall = 'this.submitSearch()';
const refreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';

const d858Calls: Array<[string, string, number]> = [
	[CONTRIB_REL, statusCall, 2],
	[CONTRIB_REL, galleryCall, 2],
	[ABSTRACT_REL, updateExtCall, 2],
	[ELECTRON_RUNTIME_REL, updateExtCall, 1],
	[REMOTE_INIT_REL, initCall, 1],
];

suite('leftover remaining unused after D815/D819 leftover remaining unused extensions leftover remaining unused Promise fire-and-forget catch scan (D858)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D815/D819 already-double after discarding collision overflow still had four or more legal unused leftover sites so this knife stayed on extensions leftover remaining unused', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const abstractRuntime = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const electronRuntime = fs.readFileSync(resolveSource(ELECTRON_RUNTIME_REL), 'utf8');
		const remoteInit = fs.readFileSync(resolveSource(REMOTE_INIT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');

		assert.ok(workbench.includes(`${enabledAutoCheckCall}${doubleCatch}`));
		assert.ok(workbench.includes(`${autoUpdateCall}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(workbench), 13);
		assert.strictEqual(countDoubleChains(viewlet), 2);
		assert.strictEqual(countDoubleChains(widgets), 1);
		assert.ok(viewlet.includes(leftoverRefreshCall));
		assert.ok(!viewlet.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(viewlet.includes(leftoverDoSearchCall));
		assert.ok(!viewlet.includes(`this.doSearch(true)${doubleCatch}`));
		assert.ok(workbench.includes(leftoverAutoUpdateCall));
		assert.ok(!workbench.includes(`this.autoUpdateExtensions()${doubleCatch}`));

		assertPromiseSignature(contrib, 'private async updateExtensionGalleryStatusContexts(): Promise<void> {');
		assertPromiseSignature(contrib, 'private async updateGalleryCapabilitiesContexts(extensionGalleryManifest: IExtensionGalleryManifest | null): Promise<void> {');
		assertPromiseSignature(abstractRuntime, 'protected async _updateExtensions(): Promise<void> {');
		assertPromiseSignature(remoteInit, 'private async initializeRemoteExtensions(): Promise<void> {');

		let sites = 0;
		for (const [rel, call, count] of d858Calls) {
			const source = rel === CONTRIB_REL ? contrib
				: rel === ABSTRACT_REL ? abstractRuntime
					: rel === ELECTRON_RUNTIME_REL ? electronRuntime
						: remoteInit;
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused extensions legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!contrib.includes('D858'));
		assert.ok(!abstractRuntime.includes('D858'));
		assert.ok(!electronRuntime.includes('D858'));
		assert.ok(!remoteInit.includes('D858'));
		assert.ok(!workbench.includes('D858'));
		assert.ok(!viewlet.includes('D858'));
		assert.ok(!widgets.includes('D858'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on extensions leftover remaining unused this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d858Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(CONTRIB_REL) ?? ''), 5);
		assert.strictEqual(countDoubleChains(seen.get(ABSTRACT_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(ELECTRON_RUNTIME_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(REMOTE_INIT_REL) ?? ''), 1);
	});

	test('extensions leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const abstractRuntime = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const electronRuntime = fs.readFileSync(resolveSource(ELECTRON_RUNTIME_REL), 'utf8');
		const remoteInit = fs.readFileSync(resolveSource(REMOTE_INIT_REL), 'utf8');

		assertPromiseSignature(contrib, 'private async updateExtensionGalleryStatusContexts(): Promise<void> {');
		assertPromiseSignature(contrib, 'private async updateGalleryCapabilitiesContexts(extensionGalleryManifest: IExtensionGalleryManifest | null): Promise<void> {');
		assertPromiseSignature(abstractRuntime, 'protected async _updateExtensions(): Promise<void> {');
		assertPromiseSignature(remoteInit, 'private async initializeRemoteExtensions(): Promise<void> {');
		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(abstractRuntime.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(electronRuntime.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(remoteInit.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(contrib, statusCall);
		assertWrapped(contrib, galleryCall);
		assertWrapped(abstractRuntime, updateExtCall);
		assertWrapped(electronRuntime, updateExtCall);
		assertWrapped(remoteInit, initCall);
		assert.strictEqual(countIncludes(contrib, `${statusCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(contrib, `${galleryCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(abstractRuntime, `${updateExtCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(electronRuntime, `${updateExtCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(remoteInit, `${initCall}${doubleCatch}`), 1);
		assert.ok(!contrib.includes('\t\tthis.updateExtensionGalleryStatusContexts();\n'));
		assert.ok(!contrib.includes('\t\t\t\tthis.updateGalleryCapabilitiesContexts(extensionGalleryManifest);\n'));
		assert.ok(!abstractRuntime.includes('\t\tthis._updateExtensions();\n'));
		assert.ok(!electronRuntime.includes('\t\t\tthis._updateExtensions();\n'));
		assert.ok(!remoteInit.includes('\t\tthis.initializeRemoteExtensions();\n'));
		assert.ok(remoteInit.includes(leftoverInstallLocalCall));
		assert.ok(!remoteInit.includes(`this.installExtensionsIfInstalledLocallyInRemote()${doubleCatch}`));
		assert.ok(remoteInit.includes(leftoverInstallFailedCall));
		assert.ok(!remoteInit.includes(`this.installFailedRemoteExtensions()${doubleCatch}`));
		assert.ok(!contrib.includes(`await ${statusCall}${doubleCatch}`));
		assert.ok(!abstractRuntime.includes(`await ${updateExtCall}${doubleCatch}`));
		assert.ok(!remoteInit.includes(`await ${initCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const abstractRuntime = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const electronRuntime = fs.readFileSync(resolveSource(ELECTRON_RUNTIME_REL), 'utf8');
		const remoteInit = fs.readFileSync(resolveSource(REMOTE_INIT_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(contrib, 'private async updateExtensionGalleryStatusContexts(): Promise<void> {');

		assert.ok(actions.includes("run: () => this.openerService.open(downloadUrl).then(() => {"));
		assert.ok(!actions.includes(`this.openerService.open(downloadUrl)${doubleCatch}`));

		assert.ok(contrib.includes('registerAction2'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<any> {'));
		assert.ok(!contrib.includes(`async run(accessor: ServicesAccessor): Promise<any> {${doubleCatch}`));
		assert.ok(contrib.includes('extensionManagementService.getInstalled(ExtensionType.User, profile.extensionsResource)'));
		assert.ok(contrib.includes('.then(async extensions => {'));
		assert.ok(!contrib.includes(`.then(async extensions => {${doubleCatch}`));

		assert.ok(workbench.includes('this.queryLocal().then(async local => {'));
		assert.ok(workbench.includes('}).then(undefined, error => this.onError(error));'));
		assert.ok(!workbench.includes(`this.queryLocal().then(async local => {${doubleCatch}`));
		assert.ok(!workbench.includes(`}).then(undefined, error => this.onError(error))${doubleCatch}`));

		assert.ok(abstractRuntime.includes('extends Action2'));
		assert.ok(abstractRuntime.includes('async run('));
		assert.ok(!abstractRuntime.includes(`async run(accessor: ServicesAccessor)${doubleCatch}`));
		assert.ok(electronRuntime.includes('extends Action2'));
		assert.ok(!remoteInit.includes('return this.initializeRemoteExtensions()'));
		assert.ok(!contrib.includes(`return ${statusCall}`));
		assert.ok(!contrib.includes(`await ${statusCall}`));
		assert.ok(!abstractRuntime.includes(`return ${updateExtCall}`));
		assert.ok(!abstractRuntime.includes(`await ${updateExtCall}`));

		for (const source of [contrib, abstractRuntime, electronRuntime, remoteInit, actions]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D858'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D815/D819/D844/D847/D843/D841/D839/D840/D855 already-double stay already-double; this knife did not overflow into sibling leftover modules', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const abstractRuntime = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const electronRuntime = fs.readFileSync(resolveSource(ELECTRON_RUNTIME_REL), 'utf8');
		const remoteInit = fs.readFileSync(resolveSource(REMOTE_INIT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXTMODEL_REL), 'utf8');
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
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const aicustom = fs.readFileSync(resolveSource(AICUSTOM_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIGURATION_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(ENTITLEMENT_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const markers = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		const bulkEdit = fs.readFileSync(resolveSource(BULK_EDIT_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const scmHistory = fs.readFileSync(resolveSource(SCM_HISTORY_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		const chatBrowser = fs.readFileSync(resolveSource(CHAT_BROWSER_REL), 'utf8');

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

		assert.ok(workbench.includes(`${enabledAutoCheckCall}${doubleCatch}`));
		assert.ok(workbench.includes(`${autoUpdateCall}${doubleCatch}`));
		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.ok(status.includes(`${updateCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(status, `${updateCall}${doubleCatch}`), 8);
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${showErrorCall}${doubleCatch}`));
		assert.ok(debugEditor.includes(`${toggleCall}${doubleCatch}`));
		assert.ok(searchWidget.includes(`${submitCall}${doubleCatch}`));
		assert.ok(comments.includes(`${refreshCall}${doubleCatch}`));
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));
		assert.ok(editing.includes(`this.initializeModelsFromDiff()${doubleCatch}`));
		assert.ok(aicustom.includes(`this.showEmbeddedMcpDetail(server)${doubleCatch}`) || aicustom.includes(`this.showPluginDetail(item)${doubleCatch}`));
		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(configuration.includes(`this.updateCache()${doubleCatch}`));
		assert.ok(implicit.includes(`this.updateImplicitContext()${doubleCatch}`));
		assert.ok(entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(enablement.includes(`this._enableExtension(extension.identifier)${doubleCatch}`));
		assert.ok(account.includes(`this._updatePolicyDefinitions(this.policyDefinitions)${doubleCatch}`) || account.includes(doubleCatch));

		for (const [rel, file] of [
			[FIND_MODEL_REL, findModel],
			[STATUS_REL, status],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[WORKBENCH_SVC_REL, workbench],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TEXTMODEL_REL, textModel],
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
			[TASKS_REL, tasks],
			[EDITING_REL, editing],
			[AICUSTOM_REL, aicustom],
			[MCP_DISCOVERY_REL, discovery],
			[CONFIGURATION_REL, configuration],
			[IMPLICIT_REL, implicit],
			[ENTITLEMENT_REL, entitlement],
			[ENABLEMENT_REL, enablement],
			[ACCOUNT_REL, account],
			[TESTING_REL, testing],
			[MARKERS_REL, markers],
			[BULK_EDIT_REL, bulkEdit],
			[OUTLINE_REL, outline],
			[FILES_REL, files],
			[SCM_HISTORY_REL, scmHistory],
			[EXPLORER_REL, explorer],
			[CHAT_BROWSER_REL, chatBrowser],
		] as const) {
			assert.ok(!file.includes('D858'), `${rel} should stay off this knife`);
		}
		assert.ok(!contrib.includes('D858'));
		assert.ok(!abstractRuntime.includes('D858'));
		assert.ok(!electronRuntime.includes('D858'));
		assert.ok(!remoteInit.includes('D858'));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD815.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD819.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD855.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/outline/test/node/outlineLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD858.test.ts')));
	});
});
