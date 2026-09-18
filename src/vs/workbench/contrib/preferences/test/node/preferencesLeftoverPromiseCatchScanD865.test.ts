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
const CONTRIB_REL = 'src/vs/workbench/contrib/preferences/browser/preferences.contribution.ts';
const KEYBINDINGS_REL = 'src/vs/workbench/contrib/preferences/browser/keybindingsEditor.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/preferences/browser/preferencesWidgets.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TREE_REL = 'src/vs/workbench/contrib/preferences/browser/settingsTree.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/preferences/browser/preferencesActions.ts';
const KEYBINDINGS_CONTRIB_REL = 'src/vs/workbench/contrib/preferences/browser/keybindingsEditorContribution.ts';
const STATUSBAR_REL = 'src/vs/workbench/browser/parts/statusbar/statusbarItem.ts';
const BULK_PANE_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const OUTLINE_PANE_REL = 'src/vs/workbench/contrib/outline/browser/outlinePane.ts';
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
const EXTENSIONS_WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const TEXTMODEL_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingTextModelChangeService.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const STATUS_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/cellStatusBar/executionStatusBarItemController.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersView.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/common/files.ts';
const SCM_HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const OUTPUT_SERVICES_REL = 'src/vs/workbench/contrib/output/browser/outputServices.ts';
const CHAT_WIDGET_REL = 'src/vs/workbench/contrib/chat/browser/widget/chatWidget.ts';
const TERMINAL_BROWSER_REL = 'src/vs/workbench/contrib/terminal/browser/terminalActions.ts';

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

const createRendererCall = 'this._createPreferencesRenderer()';
const defineCall = 'this.defineKeybinding(activeKeybindingEntry, false)';
const renderCall = 'this.render(!!this.keybindingFocusContextKey.get())';
const updateCall = 'this.update()';
const leftoverActionDefineCall = 'run: () => this.defineKeybinding(keybindingItemEntry, false)';
const leftoverSetInputThenCall = '.then(() => this.render(!!(options && options.preserveFocus)))';
const leftoverUpdateTargetCall = 'this.updateTarget(ConfigurationTarget.USER_LOCAL)';
const leftoverFolderUpdateCall = '\t\tthis._folder = folder;\n\t\tthis.update();\n';
const leftoverSyncSettingUpdateCall = '\t\tthis._register(Event.filter(configService.onDidChangeConfiguration, e => e.affectsConfiguration(\'settingsSync.ignoredSettings\'))(() => this.update()));\n';
const executeCommandCall = 'this.executeCommand(command)';
const setTreeInputCall = 'this._setTreeInput(input)';
const handleEditorControlCall = 'this._handleEditorControlChanged(pane)';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const openSettingsFileCall = 'this.openSettingsFile({ revealSetting: { key: settingKey, edit: true } })';
const updateChangedSettingCall = 'this.updateChangedSetting(key, value, manualReset, languageFilter, scope)';
const onConfigTrueCall = 'this.onConfigUpdate(undefined, true)';
const refreshCall = 'this.refreshInstalledExtensionsList()';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const assignedThenCall = 'this._currentSuggestionDetails.then(() => {';
const leftoverScrollPrevCall = '\t\t\tthis.scrollPrev();\n';
const leftoverSelectStepIdCall = '\t\t\tthis.selectStep(id);\n';
const leftoverSelectStepToSelectCall = '\t\t\tthis.selectStep(toSelect);\n';
const leftoverSelectStepUndefinedCall = '\t\t\t\tthis.selectStep(undefined);\n';
const leftoverSelectStepLooseCall = '\t\t\teditorPane.selectStepLoose(stepID);\n';
const assignedInProgressScroll = 'this.inProgressScroll = this.inProgressScroll.then(async () => {';
const updateDiffSeqCall = 'this._updateDiffInfoSeq()';
const initializeCall = 'this.initialize()';
const leftoverNoArgTriggerCall = '() => this.triggerSearch()';
const leftoverOpenAndShowCall = 'this.openAndShow(messageItReferenceToUri(m))';
const leftoverResolveEditorCall = 'this.resolveEditorModel(resource, false /* do not create if missing */)';
const leftoverLoadMoreCall = 'this._loadMore()';
const leftoverSyncCall = 'this.sync()';
const leftoverShowChannelCall = 'this.showChannel(';
const notebookUpdateCall = 'this._update()';
const researchCall = 'this.research()';
const launchCall = 'this.launchOrAttachToSession(session)';
const showErrorCall = 'this.showError(err.message, undefined, !!launch?.getConfiguration(config.name))';
const toggleCall = 'this.toggleExceptionWidget()';
const submitCall = 'this.submitSearch()';
const commentsRefreshCall = 'this.refresh()';
const checkInstallCall = 'this.checkExtensionInstallation(context)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';

const d865Calls: Array<[string, string, number]> = [
	[CONTRIB_REL, createRendererCall, 3],
	[KEYBINDINGS_REL, defineCall, 1],
	[KEYBINDINGS_REL, renderCall, 1],
	[WIDGETS_REL, updateCall, 3],
];

suite('leftover remaining unused after D794/D817 leftover remaining unused preferences leftover remaining unused Promise fire-and-forget catch scan (D865)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D794/D817 already-double after discarding collision overflow still had four or more legal unused leftover sites so this knife stayed on preferences leftover remaining unused', () => {
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');

		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));
		assert.ok(settings.includes(`${openSettingsFileCall};`));
		assert.ok(!settings.includes(`${openSettingsFileCall}${doubleCatch}`));
		assert.ok(settings.includes(`${updateChangedSettingCall};`));
		assert.ok(!settings.includes(`${updateChangedSettingCall}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(settings), 10);
		assert.ok(tree.includes('this._openerService.open(content, { allowCommands: true }).catch(onUnexpectedError);'));
		assert.ok(!tree.includes(`this._openerService.open(content, { allowCommands: true })${doubleCatch}`));
		assert.ok(tree.includes(leftoverSyncSettingUpdateCall));
		assert.ok(!tree.includes(`() => this.update()${doubleCatch}`));
		assert.ok(keybindings.includes(`${leftoverActionDefineCall}`));
		assert.ok(!keybindings.includes(`${leftoverActionDefineCall}${doubleCatch}`));
		assert.ok(keybindings.includes(`${leftoverSetInputThenCall};`));
		assert.ok(!keybindings.includes(`${leftoverSetInputThenCall}${doubleCatch}`));

		assertPromiseSignature(contrib, 'private async _createPreferencesRenderer(): Promise<void> {');
		assertPromiseSignature(keybindings, 'async defineKeybinding(keybindingEntry: IKeybindingItemEntry, add: boolean): Promise<void> {');
		assertPromiseSignature(keybindings, 'private async render(preserveFocus: boolean): Promise<void> {');
		assertPromiseSignature(widgets, 'private async update(): Promise<void> {');

		let sites = 0;
		for (const [rel, call, count] of d865Calls) {
			const source = rel === CONTRIB_REL ? contrib
				: rel === KEYBINDINGS_REL ? keybindings
					: widgets;
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused preferences legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!settings.includes('D865'));
		assert.ok(!contrib.includes('D865'));
		assert.ok(!keybindings.includes('D865'));
		assert.ok(!widgets.includes('D865'));
		assert.ok(!tree.includes('D865'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on preferences leftover remaining unused this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d865Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(CONTRIB_REL) ?? ''), 4);
		assert.strictEqual(countDoubleChains(seen.get(KEYBINDINGS_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(WIDGETS_REL) ?? ''), 3);
	});

	test('preferences leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');

		assertPromiseSignature(contrib, 'private async _createPreferencesRenderer(): Promise<void> {');
		assertPromiseSignature(keybindings, 'async defineKeybinding(keybindingEntry: IKeybindingItemEntry, add: boolean): Promise<void> {');
		assertPromiseSignature(keybindings, 'private async render(preserveFocus: boolean): Promise<void> {');
		assertPromiseSignature(widgets, 'private async update(): Promise<void> {');
		assert.ok(contrib.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(keybindings.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(widgets.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(contrib, createRendererCall);
		assertWrapped(keybindings, defineCall);
		assertWrapped(keybindings, renderCall);
		assertWrapped(widgets, updateCall);
		assert.strictEqual(countIncludes(contrib, `${createRendererCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(keybindings, `${defineCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(keybindings, `${renderCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(widgets, `${updateCall}${doubleCatch}`), 3);
		assert.ok(!contrib.includes('\t\tthis._createPreferencesRenderer();\n'));
		assert.ok(!keybindings.includes('\t\t\t\tthis.defineKeybinding(activeKeybindingEntry, false);\n'));
		assert.ok(!keybindings.includes('() => this.render(!!this.keybindingFocusContextKey.get()));'));
		assert.ok(!widgets.includes('() => this.update()));'));
		assert.ok(widgets.includes(leftoverFolderUpdateCall));
		assert.ok(!widgets.includes(`this._folder = folder;\n\t\tthis.update()${doubleCatch}`));
		assert.ok(widgets.includes(`${leftoverUpdateTargetCall};`));
		assert.ok(!widgets.includes(`${leftoverUpdateTargetCall}${doubleCatch}`));
		assert.ok(keybindings.includes(`${leftoverActionDefineCall}`));
		assert.ok(!keybindings.includes(`${leftoverActionDefineCall}${doubleCatch}`));
		assert.ok(!contrib.includes(`await ${createRendererCall}${doubleCatch}`));
		assert.ok(!keybindings.includes(`await ${defineCall}${doubleCatch}`));
		assert.ok(!widgets.includes(`await ${updateCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const tree = fs.readFileSync(resolveSource(TREE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const keybindingsContrib = fs.readFileSync(resolveSource(KEYBINDINGS_CONTRIB_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(contrib, 'private async _createPreferencesRenderer(): Promise<void> {');

		assert.ok(tree.includes('this._openerService.open(content, { allowCommands: true }).catch(onUnexpectedError);'));
		assert.ok(tree.includes('this._openerService.open(content).catch(onUnexpectedError);'));
		assert.ok(!tree.includes(`this._openerService.open(content, { allowCommands: true })${doubleCatch}`));
		assert.ok(!tree.includes(`this._openerService.open(content)${doubleCatch}`));

		assert.ok(contrib.includes('run(accessor: ServicesAccessor, args?: IOpenSettingsActionOptions) {'));
		assert.ok(contrib.includes('return accessor.get(IPreferencesService).openRemoteSettings(args);'));
		assert.ok(!contrib.includes(`return accessor.get(IPreferencesService).openRemoteSettings(args)${doubleCatch}`));
		assert.ok(!actions.includes(doubleCatch));
		assert.ok(keybindings.includes(`${leftoverActionDefineCall}`));
		assert.ok(!keybindings.includes(`${leftoverActionDefineCall}${doubleCatch}`));
		assert.ok(keybindings.includes('run: () => this.defineKeybinding(keybindingItemEntry, true)'));
		assert.ok(!keybindings.includes(`run: () => this.defineKeybinding(keybindingItemEntry, true)${doubleCatch}`));
		assert.ok(keybindings.includes(`${leftoverSetInputThenCall};`));
		assert.ok(!keybindings.includes(`${leftoverSetInputThenCall}${doubleCatch}`));
		assert.ok(!keybindings.includes('.then(undefined,'));
		assert.ok(widgets.includes('() => this.updateTarget(ConfigurationTarget.USER_LOCAL)'));
		assert.ok(!widgets.includes(`() => this.updateTarget(ConfigurationTarget.USER_LOCAL)${doubleCatch}`));
		assert.ok(settings.includes('const p = this.triggerSearch(idQuery, true);'));
		assert.ok(!settings.includes(`const p = this.triggerSearch(idQuery, true)${doubleCatch}`));
		assert.ok(settings.includes('return this.openSettingsFile({ query });'));
		assert.ok(!settings.includes(`return this.openSettingsFile({ query })${doubleCatch}`));
		assert.ok(keybindingsContrib.includes('this._defineWidget.start().then(keybinding => this._onAccepted(keybinding)).catch(onUnexpectedError).catch(onUnexpectedError);'));

		for (const source of [contrib, keybindings, widgets, settings, actions]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D865'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; already-double stay already-double; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const keybindings = fs.readFileSync(resolveSource(KEYBINDINGS_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const source = fs.readFileSync(resolveSource(STATUSBAR_REL), 'utf8');
		const findModel = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const extensionsWidgets = fs.readFileSync(resolveSource(EXTENSIONS_WIDGETS_REL), 'utf8');
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
		const status = fs.readFileSync(resolveSource(STATUS_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const markers = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const scmHistory = fs.readFileSync(resolveSource(SCM_HISTORY_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		const pane = fs.readFileSync(resolveSource(BULK_PANE_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_PANE_REL), 'utf8');
		const chatWidget = fs.readFileSync(resolveSource(CHAT_WIDGET_REL), 'utf8');
		const terminalBrowser = fs.readFileSync(resolveSource(TERMINAL_BROWSER_REL), 'utf8');

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(extensionsWidgets.includes(`${openViewThenCall};`));
		assert.ok(!extensionsWidgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));
		assert.ok(settings.includes(`${onConfigTrueCall}${doubleCatch}`));
		assert.ok(settings.includes(`${refreshCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(settings, `${onConfigTrueCall}${doubleCatch}`), 3);
		assert.strictEqual(countIncludes(settings, `${refreshCall}${doubleCatch}`), 2);
		assert.strictEqual(countDoubleChains(settings), 10);

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

		assert.ok(searchEditor.includes(leftoverNoArgTriggerCall));
		assert.ok(!searchEditor.includes(`${leftoverNoArgTriggerCall}${doubleCatch}`));
		assert.ok(testing.includes(leftoverOpenAndShowCall) || testing.includes('this.openAndShow('));
		assert.ok(!testing.includes(`${leftoverOpenAndShowCall}${doubleCatch}`));
		assert.ok(files.includes(leftoverResolveEditorCall) || files.includes(`${leftoverResolveEditorCall}${doubleCatch}`));
		assert.ok(scmHistory.includes(`${leftoverLoadMoreCall}${doubleCatch}`) || scmHistory.includes('this._loadMore()'));
		assert.ok(discovery.includes(`${leftoverSyncCall}${doubleCatch}`) || discovery.includes('this.sync()'));
		assert.ok(output.includes(leftoverShowChannelCall));

		assert.ok(source.includes(`${executeCommandCall}${doubleCatch}`));
		assert.strictEqual(countIncludes(source, `${executeCommandCall}${doubleCatch}`), 4);
		assert.ok(pane.includes(`${setTreeInputCall}${doubleCatch}`));
		assert.ok(outline.includes(`${handleEditorControlCall};`));
		assert.ok(!outline.includes(`${handleEditorControlCall}${doubleCatch}`));

		assert.ok(findModel.includes(`${researchCall}${doubleCatch}`));
		assert.ok(status.includes(`${notebookUpdateCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${launchCall}${doubleCatch}`));
		assert.ok(debugService.includes(`${showErrorCall}${doubleCatch}`));
		assert.ok(debugEditor.includes(`${toggleCall}${doubleCatch}`));
		assert.ok(searchWidget.includes(`${submitCall}${doubleCatch}`));
		assert.ok(comments.includes(`${commentsRefreshCall}${doubleCatch}`));
		assert.ok(setup.includes(`${checkInstallCall}${doubleCatch}`));
		assert.ok(debugConfig.includes(`${selectUndefinedCall}${doubleCatch}`));
		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));

		for (const [rel, file] of [
			[FIND_MODEL_REL, findModel],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[VIEWLET_REL, viewlet],
			[EXTENSIONS_WIDGETS_REL, extensionsWidgets],
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
			[STATUS_REL, status],
			[TESTING_REL, testing],
			[MARKERS_REL, markers],
			[FILES_REL, files],
			[SCM_HISTORY_REL, scmHistory],
			[MCP_DISCOVERY_REL, discovery],
			[OUTPUT_SERVICES_REL, output],
			[BULK_PANE_REL, pane],
			[OUTLINE_PANE_REL, outline],
			[STATUSBAR_REL, source],
			[CHAT_WIDGET_REL, chatWidget],
			[TERMINAL_BROWSER_REL, terminalBrowser],
		] as const) {
			assert.ok(!file.includes('D865'), `${rel} should stay off this knife`);
		}
		assert.ok(!contrib.includes('D865'));
		assert.ok(!keybindings.includes('D865'));
		assert.ok(!widgets.includes('D865'));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/preferencesLeftoverPromiseCatchScanD794.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/settingsEditor2LeftoverPromiseCatchScanD817.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/bulkEdit/test/node/bulkEditLeftoverPromiseCatchScanD857.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatWidgetLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/notebook/test/node/notebookLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD865.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD865.test.ts')));
	});
});
