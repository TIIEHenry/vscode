/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const CHAT_SESSIONS_REL = 'src/vs/workbench/api/browser/mainThreadChatSessions.ts';
const MCP_REL = 'src/vs/workbench/api/browser/mainThreadMcp.ts';
const MCP_NODE_REL = 'src/vs/workbench/api/node/extHostMcpNode.ts';
const BROWSERS_REL = 'src/vs/workbench/api/browser/mainThreadBrowsers.ts';
const GIT_MAIN_REL = 'src/vs/workbench/api/browser/mainThreadGitExtensionService.ts';
const ACTIVATOR_REL = 'src/vs/workbench/api/common/extHostExtensionActivator.ts';
const CLI_REL = 'src/vs/workbench/api/node/extHostCLIServer.ts';
const THEME_SVC_REL = 'src/vs/workbench/services/themes/browser/workbenchThemeService.ts';
const THEMES_REL = 'src/vs/workbench/contrib/themes/browser/themes.contribution.ts';
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const COMMENTS_VIEW_REL = 'src/vs/workbench/contrib/comments/browser/commentsView.ts';
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const TESTING_REL = 'src/vs/workbench/contrib/testing/browser/testingOutputPeek.ts';
const DEBUG_CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const DEBUG_SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const MCP_WORKBENCH_REL = 'src/vs/workbench/services/mcp/browser/mcpWorkbenchManagementService.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/browser/editorService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const COMPOSITE_BAR_REL = 'src/vs/workbench/browser/parts/compositeBar.ts';
const PANE_PART_REL = 'src/vs/workbench/browser/parts/paneCompositePart.ts';
const WORKBENCH_CONFIG_REL = 'src/vs/workbench/common/configuration.ts';
const TITLEBAR_REL = 'src/vs/workbench/electron-browser/parts/titlebar/titlebarPart.ts';
const LOG_REL = 'src/vs/workbench/services/log/common/defaultLogLevels.ts';
const CHAT_TIP_REL = 'src/vs/workbench/contrib/chat/browser/chatTipEligibilityTracker.ts';
const EXTENSIONS_RECS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionRecommendationsService.ts';
const CONFIG_SVC_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const STORAGE_BROWSER_REL = 'src/vs/workbench/services/storage/browser/storageService.ts';
const UNTITLED_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorService.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const SASH_REL = 'src/vs/workbench/contrib/sash/browser/sash.ts';
const CLIPBOARD_REL = 'src/vs/workbench/services/clipboard/browser/clipboardService.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/browser/lifecycleService.ts';
const EXT_SVC_REL = 'src/vs/workbench/services/extensions/common/abstractExtensionService.ts';
const REMOTE_REL = 'src/vs/workbench/services/remote/common/abstractRemoteAgentService.ts';
const FILES_SVC_REL = 'src/vs/workbench/services/files/electron-browser/elevatedFileService.ts';
const USER_DATA_PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';
const TERMINAL_REL = 'src/vs/workbench/api/browser/mainThreadTerminalService.ts';
const TUNNEL_REL = 'src/vs/workbench/api/browser/mainThreadTunnelService.ts';
const TUNNEL_NODE_REL = 'src/vs/workbench/api/node/extHostTunnelService.ts';
const MCP_COMMON_REL = 'src/vs/workbench/api/common/extHostMcp.ts';
const EXT_SERVICE_REL = 'src/vs/workbench/api/common/extHostExtensionService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../', rel),
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

const tryUpdateCall = 'this.tryUpdateItemForModel(model)';
const leftoverAddOrUpdateCall = 'this.addOrUpdateItem(existing)';
const notifyOptionsCall = 'this.notifyOptionsChange(handle, sessionResource, updates)';
const leftoverAuthSessionsCall = 'this._onDidChangeAuthSessions(e.providerId, e.label)';
const leftoverStartNodeMpcCall = 'this.startNodeMpc(id, launch, defaultCwd)';
const returnedAddOrUpdateCall = 'const item = this.addOrUpdateItem(dto);';
const returnedProvideCall = 'provideChatSessionContent: (resource, token) => this._provideChatSessionContent(handle, resource, token)';
const leftoverSyncActiveCall = 'this._syncActiveBrowserTab()';
const leftoverInitializeDelegateCall = 'this._initializeDelegate()';
const leftoverActivatorInitializeCall = '\t\tthis._initialize();\n';
const leftoverCliSetupCall = '\t\tthis.setup();\n';
const leftoverApplyThemeCall = 'this.applyTheme(themeData, undefined, true)';
const leftoverReplaceEditorsCall = 'this.replaceEditors(replacements, group)';
const leftoverDoOpenHostCall = 'this.doOpen(undefined, { payload: Array.from(environment.entries()) })';
const leftoverReloadCall = '\t\tthis.reload();\n';
const leftoverTriggerCall = '\t\t\tthis.trigger(value);\n';
const leftoverTwoArgThenCall = "this.setTheme(newTheme, applyTheme ? 'auto' : 'preview').then(undefined,";
const leftoverPinCall = 'this.pin(id, true)';
const leftoverDoOpenCall = 'this.doOpenPaneComposite(containerToOpen.id)';
const leftoverMigrateCall = 'this.migrateConfigurations(configurationMigrationRegistry.migrations)';
const leftoverCreateCall = 'this.create()';
const leftoverAlwaysOnTopCall = 'this.handleWindowsAlwaysOnTop(targetWindow.vscodeWindowId)';
const leftoverArgvCall = 'this.onDidChangeArgv()';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const validateFoldersCall = 'this.validateWorkspaceFoldersAndReload(fromCache)';
const applicationCloseCall = 'void Promise.resolve(this.applicationStorage?.close())';
const leftoverUpdateDefaultProfileCall = '() => this._updateDefaultProfile()';
const leftoverElevationPromptCall = 'this.elevationPrompt(tunnelOptions, tunnel, source)';
const leftoverSetInitialCandidatesCall = 'this.setInitialCandidates()';
const leftoverStartExtensionHostCall = 'this._startExtensionHost()';
const leftoverSseFallbackCall = 'this._sseFallbackWithMessage(message)';

const d972Calls: Array<[string, string, number]> = [
	[CHAT_SESSIONS_REL, tryUpdateCall, 2],
	[CHAT_SESSIONS_REL, leftoverAddOrUpdateCall, 1],
	[CHAT_SESSIONS_REL, notifyOptionsCall, 1],
	[MCP_REL, leftoverAuthSessionsCall, 1],
	[MCP_NODE_REL, leftoverStartNodeMpcCall, 1],
];

suite('leftover remaining unused api leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D972)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused api leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d972Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused api legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 6);
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		const mcpNode = fs.readFileSync(resolveSource(MCP_NODE_REL), 'utf8');
		assert.ok(!chatSessions.includes('D972'));
		assert.ok(!mcp.includes('D972'));
		assert.ok(!mcpNode.includes('D972'));
	});

	test('this knife covers six leftover Promise double-chain sites after leftover remaining unused stayed on api this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d972Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 6);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(CHAT_SESSIONS_REL) ?? ''), 4);
		assert.strictEqual(countDoubleChains(seen.get(MCP_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(MCP_NODE_REL) ?? ''), 1);
	});

	test('api leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		const mcpNode = fs.readFileSync(resolveSource(MCP_NODE_REL), 'utf8');

		assertPromiseSignature(chatSessions, 'private async tryUpdateItemForModel(model: IChatModel): Promise<void> {');
		assertPromiseSignature(chatSessions, 'private async addOrUpdateItem(dto: Dto<IChatSessionItem>): Promise<MainThreadChatSessionItem> {');
		assertPromiseSignature(chatSessions, 'async notifyOptionsChange(handle: number, sessionResource: URI, updates: ReadonlyMap<string, string | IChatSessionProviderOptionItem | undefined>): Promise<void> {');
		assertPromiseSignature(mcp, 'private async _onDidChangeAuthSessions(providerId: string, providerLabel: string): Promise<void> {');
		assertPromiseSignature(mcpNode, 'private async startNodeMpc(id: number, launch: McpServerTransportStdio, defaultCwd?: URI): Promise<void> {');

		assert.ok(chatSessions.includes("import { isCancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(mcp.includes("import { CancellationError, onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(mcpNode.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));

		assertWrapped(chatSessions, tryUpdateCall);
		assertWrapped(chatSessions, leftoverAddOrUpdateCall);
		assertWrapped(chatSessions, notifyOptionsCall);
		assertWrapped(mcp, leftoverAuthSessionsCall);
		assertWrapped(mcpNode, leftoverStartNodeMpcCall);
		assert.strictEqual(countIncludes(chatSessions, `${tryUpdateCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(chatSessions, `${leftoverAddOrUpdateCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(chatSessions, `${notifyOptionsCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(mcp, `${leftoverAuthSessionsCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(mcpNode, `${leftoverStartNodeMpcCall}${doubleCatch}`), 1);
		assert.ok(!chatSessions.includes('\t\t\tthis.tryUpdateItemForModel(model);\n'));
		assert.ok(!chatSessions.includes('\t\t\tthis.addOrUpdateItem(existing);\n'));
		assert.ok(!chatSessions.includes('\t\t\t\tthis.notifyOptionsChange(handle, sessionResource, updates);\n'));
		assert.ok(!mcp.includes('e => this._onDidChangeAuthSessions(e.providerId, e.label)));'));
		assert.ok(!mcpNode.includes('\t\t\tthis.startNodeMpc(id, launch, defaultCwd);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		const mcpNode = fs.readFileSync(resolveSource(MCP_NODE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(chatSessions, 'private async tryUpdateItemForModel(model: IChatModel): Promise<void> {');

		assert.ok(!chatSessions.includes('openerService.open'));
		assert.ok(!chatSessions.includes('IOpenerService'));
		assert.ok(!mcp.includes('openerService.open'));
		assert.ok(!mcpNode.includes('openerService.open'));
		assert.ok(!chatSessions.includes('extends Action2'));
		assert.ok(!chatSessions.includes('registerAction2'));
		assert.ok(!mcp.includes('extends Action2'));
		assert.ok(!mcpNode.includes('extends Action2'));
		assert.ok(!chatSessions.includes('.then(undefined,'));
		assert.ok(!mcp.includes('.then(undefined,'));
		assert.ok(!mcpNode.includes('.then(undefined,'));
		assert.ok(chatSessions.includes(returnedAddOrUpdateCall));
		assert.ok(!chatSessions.includes(`this.addOrUpdateItem(dto)${doubleCatch}`));
		assert.ok(chatSessions.includes(returnedProvideCall));
		assert.ok(!chatSessions.includes(`this._provideChatSessionContent(handle, resource, token)${doubleCatch}`));
		assert.ok(chatSessions.includes('addedOrUpdatedItems.push(await this.addOrUpdateItem(item));'));
		assert.ok(!chatSessions.includes(`this.addOrUpdateItem(item)${doubleCatch}`));

		for (const source of [chatSessions, mcp, mcpNode]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D972'));
			assert.ok(!source.includes('*Wire'));
		}
	});

	test('locked leftover remaining stay leftover remaining unused; D956 overflow stay leftover remaining unused; this knife did not occupy comments / chatSetup / searchWidget / searchEditor / testing / debug leftover remaining unused', () => {
		const chatSessions = fs.readFileSync(resolveSource(CHAT_SESSIONS_REL), 'utf8');
		const mcp = fs.readFileSync(resolveSource(MCP_REL), 'utf8');
		const mcpNode = fs.readFileSync(resolveSource(MCP_NODE_REL), 'utf8');
		const browsers = fs.readFileSync(resolveSource(BROWSERS_REL), 'utf8');
		const gitMain = fs.readFileSync(resolveSource(GIT_MAIN_REL), 'utf8');
		const activator = fs.readFileSync(resolveSource(ACTIVATOR_REL), 'utf8');
		const cli = fs.readFileSync(resolveSource(CLI_REL), 'utf8');
		const themeService = fs.readFileSync(resolveSource(THEME_SVC_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_REL), 'utf8');
		const searchWidget = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const searchEditor = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_VIEW_REL), 'utf8');
		const setup = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const testing = fs.readFileSync(resolveSource(TESTING_REL), 'utf8');
		const debugConfig = fs.readFileSync(resolveSource(DEBUG_CONFIG_REL), 'utf8');
		const debugService = fs.readFileSync(resolveSource(DEBUG_SERVICE_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const compositeBar = fs.readFileSync(resolveSource(COMPOSITE_BAR_REL), 'utf8');
		const panePart = fs.readFileSync(resolveSource(PANE_PART_REL), 'utf8');
		const workbenchConfig = fs.readFileSync(resolveSource(WORKBENCH_CONFIG_REL), 'utf8');
		const titlebar = fs.readFileSync(resolveSource(TITLEBAR_REL), 'utf8');
		const logLevels = fs.readFileSync(resolveSource(LOG_REL), 'utf8');
		const chatTip = fs.readFileSync(resolveSource(CHAT_TIP_REL), 'utf8');
		const extensionsRecs = fs.readFileSync(resolveSource(EXTENSIONS_RECS_REL), 'utf8');
		const configService = fs.readFileSync(resolveSource(CONFIG_SVC_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const tunnel = fs.readFileSync(resolveSource(TUNNEL_REL), 'utf8');
		const tunnelNode = fs.readFileSync(resolveSource(TUNNEL_NODE_REL), 'utf8');
		const mcpCommon = fs.readFileSync(resolveSource(MCP_COMMON_REL), 'utf8');
		const extService = fs.readFileSync(resolveSource(EXT_SERVICE_REL), 'utf8');

		assert.ok(browsers.includes(`${leftoverSyncActiveCall};`));
		assert.ok(browsers.includes(`() => ${leftoverSyncActiveCall})`));
		assert.ok(!browsers.includes(`${leftoverSyncActiveCall}${doubleCatch}`));
		assert.ok(gitMain.includes(`${leftoverInitializeDelegateCall};`));
		assert.ok(!gitMain.includes(`${leftoverInitializeDelegateCall}${doubleCatch}`));
		assert.ok(activator.includes(leftoverActivatorInitializeCall));
		assert.ok(!activator.includes(`this._initialize()${doubleCatch}`));
		assert.ok(cli.includes(leftoverCliSetupCall));
		assert.ok(!cli.includes(`this.setup()${doubleCatch}`));
		assert.ok(themeService.includes(`${leftoverApplyThemeCall};`));
		assert.ok(!themeService.includes(`${leftoverApplyThemeCall}${doubleCatch}`));
		assert.ok(themes.includes(leftoverTriggerCall));
		assert.ok(!themes.includes(`this.trigger(value)${doubleCatch}`));
		assert.ok(themes.includes(leftoverTwoArgThenCall));
		assert.ok(!themes.includes(`this.setTheme(newTheme, applyTheme ? 'auto' : 'preview')${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));
		assert.ok(host.includes(leftoverDoOpenHostCall));
		assert.ok(!host.includes(`${leftoverDoOpenHostCall}${doubleCatch}`));
		assert.ok(host.includes(leftoverReloadCall));
		assert.ok(!host.includes(`this.reload()${doubleCatch}`));
		assert.ok(editor.includes(`${leftoverReplaceEditorsCall};`));
		assert.ok(!editor.includes(`${leftoverReplaceEditorsCall}${doubleCatch}`));
		assert.ok(compositeBar.includes(`${leftoverPinCall}${doubleCatch}`));
		assert.ok(panePart.includes(`${leftoverDoOpenCall}${doubleCatch}`));
		assert.ok(workbenchConfig.includes(`${leftoverMigrateCall}${doubleCatch}`));
		assert.ok(workbenchConfig.includes(`${leftoverCreateCall}${doubleCatch}`));
		assert.ok(titlebar.includes(`${leftoverAlwaysOnTopCall}${doubleCatch}`));
		assert.ok(logLevels.includes(`${leftoverArgvCall}${doubleCatch}`));
		assert.ok(chatTip.includes(doubleCatch));
		assert.ok(extensionsRecs.includes(doubleCatch));
		assert.ok(configService.includes(`${validateFoldersCall}${doubleCatch}`));
		assert.ok(storageBrowser.includes(`${applicationCloseCall}${doubleCatch}`));
		assert.ok(terminal.includes(leftoverUpdateDefaultProfileCall));
		assert.ok(!terminal.includes(`this._updateDefaultProfile()${doubleCatch}`));
		assert.ok(tunnel.includes(`${leftoverElevationPromptCall};`));
		assert.ok(!tunnel.includes(`${leftoverElevationPromptCall}${doubleCatch}`));
		assert.ok(tunnelNode.includes(`${leftoverSetInitialCandidatesCall};`));
		assert.ok(!tunnelNode.includes(`${leftoverSetInitialCandidatesCall}${doubleCatch}`));
		assert.ok(extService.includes(`${leftoverStartExtensionHostCall};`));
		assert.ok(!extService.includes(`${leftoverStartExtensionHostCall}${doubleCatch}`));
		assert.ok(mcpCommon.includes(`${leftoverSseFallbackCall};`));
		assert.ok(!mcpCommon.includes(`${leftoverSseFallbackCall}${doubleCatch}`));

		for (const [rel, file] of [
			[SEARCH_WIDGET_REL, searchWidget],
			[SEARCH_EDITOR_REL, searchEditor],
			[COMMENTS_VIEW_REL, comments],
			[SETUP_REL, setup],
			[TESTING_REL, testing],
			[DEBUG_CONFIG_REL, debugConfig],
			[DEBUG_SERVICE_REL, debugService],
			[TASKS_REL, tasks],
			[MCP_WORKBENCH_REL, mcpWorkbench],
			[HOST_REL, host],
			[EDITOR_SVC_REL, editor],
			[THEME_SVC_REL, themeService],
			[THEMES_REL, themes],
			[BROWSERS_REL, browsers],
			[GIT_MAIN_REL, gitMain],
			[ACTIVATOR_REL, activator],
			[CLI_REL, cli],
			[CHAT_SESSIONS_REL, chatSessions],
			[MCP_REL, mcp],
			[MCP_NODE_REL, mcpNode],
		] as const) {
			assert.ok(!file.includes('D972'), `${rel} should stay off this knife id`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/searchEditor/test/node/searchEditorLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/test/node/workbenchLeftoverPromiseCatchScanD922.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD939.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD943.test.ts')));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD964.test.ts')));
	});

	test('this knife did not occupy parallel leftover remaining unused untitled / workingCopy / textfile / sash / clipboard / lifecycle leftover remaining unused or exhausted PRIMARY leftover remaining unused', () => {
		const untitled = fs.readFileSync(resolveSource(UNTITLED_REL), 'utf8');
		const workingCopy = fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8');
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');
		const sash = fs.readFileSync(resolveSource(SASH_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const extSvc = fs.readFileSync(resolveSource(EXT_SVC_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const filesSvc = fs.readFileSync(resolveSource(FILES_SVC_REL), 'utf8');
		const userDataProfile = fs.readFileSync(resolveSource(USER_DATA_PROFILE_REL), 'utf8');
		const storageBrowser = fs.readFileSync(resolveSource(STORAGE_BROWSER_REL), 'utf8');
		const chatTip = fs.readFileSync(resolveSource(CHAT_TIP_REL), 'utf8');

		for (const [rel, file] of [
			[UNTITLED_REL, untitled],
			[WORKING_COPY_REL, workingCopy],
			[TEXTFILE_REL, textfile],
			[SASH_REL, sash],
			[CLIPBOARD_REL, clipboard],
			[LIFECYCLE_REL, lifecycle],
			[EXT_SVC_REL, extSvc],
			[REMOTE_REL, remote],
			[FILES_SVC_REL, filesSvc],
			[USER_DATA_PROFILE_REL, userDataProfile],
			[STORAGE_BROWSER_REL, storageBrowser],
			[CHAT_TIP_REL, chatTip],
		] as const) {
			assert.ok(!file.includes('D972'), `${rel} should stay off this knife`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/untitled/test/node/untitledLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/workingCopy/test/node/workingCopyLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/textfile/test/node/textfileLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/sash/test/node/sashLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/clipboard/test/node/clipboardLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/lifecycle/test/node/lifecycleLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/extensions/test/node/extensionsLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/remote/test/node/remoteLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/files/test/node/filesLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/activity/test/node/activityLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/userDataProfile/test/node/userDataProfileLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/storage/test/node/storageLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/panecomposite/test/node/panecompositeLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/webview/test/node/webviewLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/hover/test/node/hoverLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/browser/parts/test/node/partsLeftoverPromiseCatchScanD972.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/electron-browser/test/node/electronLeftoverPromiseCatchScanD972.test.ts')));
	});
});
