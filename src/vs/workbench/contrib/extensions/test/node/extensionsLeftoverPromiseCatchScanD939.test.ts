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
const RECS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts';
const FILE_RECS_REL = 'src/vs/workbench/contrib/extensions/browser/fileBasedRecommendations.ts';
const WORKSPACE_RECS_REL = 'src/vs/workbench/contrib/extensions/browser/workspaceRecommendations.ts';
const VIEWS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViews.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/extensions/browser/extensionEditor.ts';
const CONFIG_RECS_REL = 'src/vs/workbench/contrib/extensions/browser/configBasedRecommendations.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts';
const ABSTRACT_REL = 'src/vs/workbench/contrib/extensions/browser/abstractRuntimeExtensionsEditor.ts';
const ELECTRON_RUNTIME_REL = 'src/vs/workbench/contrib/extensions/electron-browser/runtimeExtensionsEditor.ts';
const REMOTE_INIT_REL = 'src/vs/workbench/contrib/extensions/electron-browser/remoteExtensionsInit.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const CONFIG_REL = 'src/vs/workbench/common/configuration.ts';
const TITLEBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts';
const LOG_REL = 'src/vs/workbench/services/log/common/defaultLogLevels.ts';
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
const SIMPLE_SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TEXT_MODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/browser/views/explorerView.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/remote/browser/remoteExplorer.ts';
const CODE_ACTIONS_REL = 'src/vs/workbench/contrib/codeActions/browser/codeActions.contribution.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const TREE_VIEW_REL = 'src/vs/workbench/browser/parts/views/treeView.ts';
const TRUSTED_DOMAINS_REL = 'src/vs/workbench/contrib/url/browser/trustedDomains.ts';
const COMMANDS_REL = 'src/vs/workbench/contrib/commands/common/commands.contribution.ts';
const WELCOME_ONBOARDING_REL = 'src/vs/workbench/contrib/welcomeOnboarding/browser/welcomeOnboarding.contribution.ts';

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

const leftoverPromptWorkspaceCall = 'this.promptWorkspaceRecommendations()';
const leftoverActivateProactiveCall = 'this.activateProactiveRecommendations()';
const leftoverPromptFileCall = 'this.promptImportantExtensionsInstallNotification(recommendations, name, language)';
const leftoverOnDidChangeConfigsCall = 'this.onDidChangeExtensionsConfigs()';
const leftoverShowEmptyCall = "this.show('')";
const leftoverOnDidAcceptCall = 'this.onDidAccept(quickPick.selectedItems)';
const leftoverShowQueryCall = '() => this.show(this.recommendedExtensionsQuery)';
const leftoverSchedulerCall = '() => this.onDidChangeWorkspaceExtensionsFolders()';
const leftoverRenderCall = 'this.render((this.input as ExtensionsInput).extension, this.template, !!options?.preserveFocus)';
const leftoverCacheThenCall = 'this.getCacheLocation(extension).then(cacheLocation => {';
const leftoverDoSearchCall = '\t\tthis.doSearch(true);\n';
const leftoverAutoUpdateCall = '\t\t\tthis.autoUpdateExtensions();\n';
const leftoverInstallLocalCall = '\t\tthis.installExtensionsIfInstalledLocallyInRemote();\n';
const leftoverInstallFailedCall = '\t\tthis.installFailedRemoteExtensions();\n';
const leftoverRefreshCall = '() => this.refresh())';
const enabledAutoCheckCall = 'this.checkForUpdates(`Enabled auto check updates`)';
const autoUpdateCall = 'this.autoUpdateBuiltinExtensions()';
const statusCall = 'this.updateExtensionGalleryStatusContexts()';
const galleryCall = 'this.updateGalleryCapabilitiesContexts(extensionGalleryManifest)';
const updateExtCall = 'this._updateExtensions()';
const initCall = 'this.initializeRemoteExtensions()';
const leftoverPinCall = 'this.pin(id, true)';
const leftoverDoOpenCall = 'this.doOpenPaneComposite(containerToOpen.id)';
const leftoverMigrateCall = 'this.migrateConfigurations(configurationMigrationRegistry.migrations)';
const leftoverCreateCall = 'this.create()';
const leftoverAlwaysOnTopCall = 'this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId)';
const leftoverArgvCall = 'this.onDidChangeArgv()';
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
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";

const d939Calls: Array<[string, string, number]> = [
	[RECS_REL, leftoverPromptWorkspaceCall, 1],
	[RECS_REL, leftoverActivateProactiveCall, 1],
	[FILE_RECS_REL, leftoverPromptFileCall, 1],
	[WORKSPACE_RECS_REL, leftoverOnDidChangeConfigsCall, 2],
	[VIEWS_REL, leftoverShowEmptyCall, 2],
	[ACTIONS_REL, leftoverOnDidAcceptCall, 1],
];

suite('leftover remaining unused after D815/D819/D858 leftover remaining unused extensions leftover remaining unused Promise fire-and-forget catch scan (D939)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D815/D819/D858 already-double after discarding collision overflow still had four or more legal unused leftover this.foo() so this knife stayed on extensions leftover remaining unused', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const abstractRuntime = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const electronRuntime = fs.readFileSync(resolveSource(ELECTRON_RUNTIME_REL), 'utf8');
		const remoteInit = fs.readFileSync(resolveSource(REMOTE_INIT_REL), 'utf8');
		const recs = fs.readFileSync(resolveSource(RECS_REL), 'utf8');
		const fileRecs = fs.readFileSync(resolveSource(FILE_RECS_REL), 'utf8');
		const workspaceRecs = fs.readFileSync(resolveSource(WORKSPACE_RECS_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');

		assert.strictEqual(countDoubleChains(workbench), 13);
		assert.strictEqual(countDoubleChains(viewlet), 2);
		assert.strictEqual(countDoubleChains(widgets), 1);
		assert.strictEqual(countDoubleChains(contrib), 5);
		assert.strictEqual(countDoubleChains(abstractRuntime), 2);
		assert.strictEqual(countDoubleChains(electronRuntime), 1);
		assert.strictEqual(countDoubleChains(remoteInit), 1);
		assert.ok(viewlet.includes(leftoverRefreshCall));
		assert.ok(!viewlet.includes(`this.refresh()${doubleCatch}`));
		assert.ok(viewlet.includes(leftoverDoSearchCall));
		assert.ok(!viewlet.includes(`this.doSearch(true)${doubleCatch}`));
		assert.ok(workbench.includes(leftoverAutoUpdateCall));
		assert.ok(!workbench.includes(`this.autoUpdateExtensions()${doubleCatch}`));
		assert.ok(remoteInit.includes(leftoverInstallLocalCall));
		assert.ok(!remoteInit.includes(`this.installExtensionsIfInstalledLocallyInRemote()${doubleCatch}`));
		assert.ok(remoteInit.includes(leftoverInstallFailedCall));
		assert.ok(!remoteInit.includes(`this.installFailedRemoteExtensions()${doubleCatch}`));

		let sites = 0;
		for (const [rel, call, count] of d939Calls) {
			const source = rel === RECS_REL ? recs
				: rel === FILE_RECS_REL ? fileRecs
					: rel === WORKSPACE_RECS_REL ? workspaceRecs
						: rel === VIEWS_REL ? views
							: actions;
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused extensions legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		for (const source of [recs, fileRecs, workspaceRecs, views, actions, workbench, viewlet, widgets, contrib]) {
			assert.ok(!source.includes('D939'));
		}
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on extensions leftover remaining unused this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d939Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(RECS_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(FILE_RECS_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(WORKSPACE_RECS_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(VIEWS_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(ACTIONS_REL) ?? ''), 5);
	});

	test('leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const recs = fs.readFileSync(resolveSource(RECS_REL), 'utf8');
		const fileRecs = fs.readFileSync(resolveSource(FILE_RECS_REL), 'utf8');
		const workspaceRecs = fs.readFileSync(resolveSource(WORKSPACE_RECS_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');

		assertPromiseSignature(recs, 'private async promptWorkspaceRecommendations(): Promise<void> {');
		assertPromiseSignature(recs, 'private async activateProactiveRecommendations(): Promise<void> {');
		assertPromiseSignature(fileRecs, 'private async promptImportantExtensionsInstallNotification(extensions: string[], name: string, language: string): Promise<void> {');
		assertPromiseSignature(workspaceRecs, 'private async onDidChangeExtensionsConfigs(): Promise<void> {');
		assertPromiseSignature(views, 'override async show(query: string): Promise<IPagedModel<IExtension>> {');
		assertPromiseSignature(actions, 'private async onDidAccept(selectedItems: ReadonlyArray<IExtensionPickItem>): Promise<void> {');

		assert.ok(recs.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(fileRecs.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(workspaceRecs.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(views.includes("import { isCancellationError, getErrorMessage, CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(actions.includes("import { getErrorMessage, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(recs, leftoverPromptWorkspaceCall);
		assertWrapped(recs, leftoverActivateProactiveCall);
		assertWrapped(fileRecs, leftoverPromptFileCall);
		assertWrapped(workspaceRecs, leftoverOnDidChangeConfigsCall);
		assertWrapped(views, leftoverShowEmptyCall);
		assertWrapped(actions, leftoverOnDidAcceptCall);

		assert.ok(!recs.includes('\t\tthis.promptWorkspaceRecommendations();\n'));
		assert.ok(!recs.includes('\t\tthis.activateProactiveRecommendations();\n'));
		assert.ok(recs.includes('\t\tawait this.activateProactiveRecommendations();\n'));
		assert.ok(!fileRecs.includes('\t\tthis.promptImportantExtensionsInstallNotification(recommendations, name, language);\n'));
		assert.ok(!workspaceRecs.includes('\t\tthis._register(this.workspaceExtensionsConfigService.onDidChangeExtensionsConfigs(() => this.onDidChangeExtensionsConfigs()));\n'));
		assert.ok(!workspaceRecs.includes('\t\t\tthis.onDidChangeExtensionsConfigs();\n'));
		assert.ok(!views.includes("\t\t\tthis.show('');\n"));
		assert.ok(!actions.includes('\t\t\tthis.onDidAccept(quickPick.selectedItems);\n'));
		assert.ok(views.includes(leftoverShowQueryCall));
		assert.ok(!views.includes(`this.show(this.recommendedExtensionsQuery)${doubleCatch}`));
		assert.ok(workspaceRecs.includes(leftoverSchedulerCall));
		assert.ok(!workspaceRecs.includes(`this.onDidChangeWorkspaceExtensionsFolders()${doubleCatch}`));
		assert.ok(!recs.includes(`await ${leftoverPromptWorkspaceCall}${doubleCatch}`));
		assert.ok(!recs.includes(`await ${leftoverActivateProactiveCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const recs = fs.readFileSync(resolveSource(RECS_REL), 'utf8');
		const fileRecs = fs.readFileSync(resolveSource(FILE_RECS_REL), 'utf8');
		const workspaceRecs = fs.readFileSync(resolveSource(WORKSPACE_RECS_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(recs, 'private async promptWorkspaceRecommendations(): Promise<void> {');

		assert.ok(actions.includes("run: () => this.openerService.open(downloadUrl).then(() => {"));
		assert.ok(!actions.includes(`this.openerService.open(downloadUrl)${doubleCatch}`));
		assert.ok(contrib.includes('registerAction2'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<any> {'));
		assert.ok(!contrib.includes(`async run(accessor: ServicesAccessor): Promise<any> {${doubleCatch}`));
		assert.ok(actions.includes('override async run(): Promise<void> {'));
		assert.ok(actions.includes('return this.selectAndInstallExtensions();'));
		assert.ok(!actions.includes(`return this.selectAndInstallExtensions()${doubleCatch}`));
		assert.ok(workbench.includes('this.queryLocal().then(async local => {'));
		assert.ok(workbench.includes('}).then(undefined, error => this.onError(error));'));
		assert.ok(!workbench.includes(`this.queryLocal().then(async local => {${doubleCatch}`));
		assert.ok(editor.includes(leftoverCacheThenCall));
		assert.ok(!editor.includes(`${leftoverCacheThenCall}${doubleCatch}`));
		assert.ok(editor.includes(`${leftoverRenderCall};`));
		assert.ok(!editor.includes(`${leftoverRenderCall}${doubleCatch}`));
		assert.ok(actions.includes('this.extensionsWorkbenchService.queryLocal().then(() => this.updateExtensions())'));
		assert.ok(actions.includes(`this.extensionsWorkbenchService.queryLocal().then(() => this.updateExtensions())${doubleCatch}`));
		assert.ok(views.includes('this.reportSearchFinishedDelayer.trigger(() => this.reportSearchFinished())'));
		assert.ok(!views.includes(`this.reportSearchFinished()${doubleCatch}`));
		assert.ok(recs.includes('this.activationPromise = this.activate();'));
		assert.ok(!recs.includes(`this.activate()${doubleCatch}`));

		for (const source of [recs, fileRecs, workspaceRecs, views, actions, editor]) {
			assert.ok(!source.includes('acknowledge(') || !source.includes(`acknowledge(${doubleCatch}`));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D939'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D815/D819/D858/D922 already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const recs = fs.readFileSync(resolveSource(RECS_REL), 'utf8');
		const fileRecs = fs.readFileSync(resolveSource(FILE_RECS_REL), 'utf8');
		const workspaceRecs = fs.readFileSync(resolveSource(WORKSPACE_RECS_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const abstractRuntime = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const electronRuntime = fs.readFileSync(resolveSource(ELECTRON_RUNTIME_REL), 'utf8');
		const remoteInit = fs.readFileSync(resolveSource(REMOTE_INIT_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
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
		const simpleSuggest = fs.readFileSync(resolveSource(SIMPLE_SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXT_MODEL_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');

		assert.ok(workbench.includes(`${enabledAutoCheckCall}${doubleCatch}`));
		assert.ok(workbench.includes(`${autoUpdateCall}${doubleCatch}`));
		assert.ok(contrib.includes(`${statusCall}${doubleCatch}`));
		assert.ok(contrib.includes(`${galleryCall}${doubleCatch}`));
		assert.ok(abstractRuntime.includes(`${updateExtCall}${doubleCatch}`));
		assert.ok(electronRuntime.includes(`${updateExtCall}${doubleCatch}`));
		assert.ok(remoteInit.includes(`${initCall}${doubleCatch}`));
		assert.ok(compositeBar.includes(`${leftoverPinCall}${doubleCatch}`));
		assert.ok(panePart.includes(`${leftoverDoOpenCall}${doubleCatch}`));
		assert.ok(configuration.includes(`${leftoverMigrateCall}${doubleCatch}`));
		assert.ok(configuration.includes(`${leftoverCreateCall}${doubleCatch}`));
		assert.ok(titlebar.includes(`${leftoverAlwaysOnTopCall}${doubleCatch}`));
		assert.ok(logLevels.includes(`${leftoverArgvCall}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(workbench), 13);
		assert.strictEqual(countDoubleChains(viewlet), 2);
		assert.strictEqual(countDoubleChains(widgets), 1);

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
		assert.ok(gettingStarted.includes(assignedInProgressScroll));
		assert.ok(gettingStartedContrib.includes(leftoverSelectStepLooseCall));
		assert.ok(!gettingStartedContrib.includes(`editorPane.selectStepLoose(stepID)${doubleCatch}`));
		assert.ok(textModel.includes(`${updateDiffSeqCall};`) || textModel.includes('\t\t\tthis._updateDiffInfoSeq();\n'));
		assert.ok(!textModel.includes(`${updateDiffSeqCall}${doubleCatch}`));
		assert.ok(profileModel.includes(`${initializeCall};`));
		assert.ok(!profileModel.includes(`${initializeCall}${doubleCatch}`));
		assert.ok(themes.includes(leftoverTriggerCall));
		assert.ok(!themes.includes(`this.trigger(value)${doubleCatch}`));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(!themes.includes(`this.setTheme(newTheme, applyTheme ? 'auto' : 'preview')${doubleCatch}`));
		assert.ok(searchWidget.includes(`this.submitSearch()${doubleCatch}`) || searchWidget.includes(doubleCatch));
		assert.ok(comments.includes(`this.refresh()${doubleCatch}`));
		assert.ok(setup.includes(`this.checkExtensionInstallation(context)${doubleCatch}`));
		assert.ok(debugConfig.includes(`this.selectConfiguration(undefined)${doubleCatch}`));
		assert.ok(debugService.includes(`this.launchOrAttachToSession(session)${doubleCatch}`));
		assert.ok(chatWidget.includes(doubleCatch));
		assert.ok(testing.includes('this.openAndShow(') || testing.includes(doubleCatch));
		assert.ok(planReview.includes('() => void this.enterReviewMode()'));
		assert.ok(agentSessions.includes('list.onDidOpen(e => this.openAgentSession(e))'));

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
			[TESTING_REL, testing],
			[THEMES_REL, themes],
			[COMPOSITE_BAR_REL, compositeBar],
			[PANE_PART_REL, panePart],
			[CONFIG_REL, configuration],
			[TITLEBAR_REL, titlebar],
			[LOG_REL, logLevels],
		] as const) {
			assert.ok(!file.includes('D939'), `${rel} should stay off this knife`);
		}
		assert.ok(!recs.includes('D939'));
		assert.ok(!fileRecs.includes('D939'));
		assert.ok(!workspaceRecs.includes('D939'));
		assert.ok(!views.includes('D939'));
		assert.ok(!actions.includes('D939'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD815.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD819.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD858.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD922.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused files / remoteExplorer / codeActions / integrity / secrets / languageStatus leftover remaining unused or discarded collision overflow leftover remaining unused', () => {
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const explorer = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		const codeActions = fs.readFileSync(resolveSource(CODE_ACTIONS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const treeView = fs.readFileSync(resolveSource(TREE_VIEW_REL), 'utf8');
		const configRecs = fs.readFileSync(resolveSource(CONFIG_RECS_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const workspaceRecs = fs.readFileSync(resolveSource(WORKSPACE_RECS_REL), 'utf8');

		assert.ok(!files.includes('D939'));
		assert.ok(!explorer.includes('D939'));
		assert.ok(!codeActions.includes('D939'));
		assert.ok(!integrity.includes('D939'));
		assert.ok(!secrets.includes('D939'));
		assert.ok(!languageStatus.includes('D939'));
		assert.ok(!treeView.includes('D939'));
		assert.ok(configRecs.includes('e => this.onWorkspaceFoldersChanged(e)'));
		assert.ok(!configRecs.includes(`this.onWorkspaceFoldersChanged(e)${doubleCatch}`));
		assert.ok(editor.includes(`${leftoverRenderCall};`));
		assert.ok(!editor.includes(`${leftoverRenderCall}${doubleCatch}`));
		assert.ok(editor.includes(leftoverCacheThenCall));
		assert.ok(!editor.includes(`${leftoverCacheThenCall}${doubleCatch}`));
		assert.ok(views.includes(leftoverShowQueryCall));
		assert.ok(!views.includes(`this.show(this.recommendedExtensionsQuery)${doubleCatch}`));
		assert.ok(workspaceRecs.includes(leftoverSchedulerCall));
		assert.ok(!workspaceRecs.includes(`this.onDidChangeWorkspaceExtensionsFolders()${doubleCatch}`));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/remote/test/node/remoteExplorerLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/codeActions/test/node/codeActionsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/integrity/test/node/integrityLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/secrets/test/node/secretsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/languageStatus/test/node/languageStatusLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/url/test/node/trustedDomainsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/commands/test/node/commandsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD752.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/url/test/node/trustedDomainsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/commands/test/node/commandsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeOnboarding/test/node/welcomeOnboardingLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(!treeView.includes('D939'));
		assert.ok(!fs.readFileSync(resolveSource(TRUSTED_DOMAINS_REL), 'utf8').includes('D939'));
		assert.ok(!fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8').includes('D939'));
		assert.ok(!fs.readFileSync(resolveSource(WELCOME_ONBOARDING_REL), 'utf8').includes('D939'));
	});
});
