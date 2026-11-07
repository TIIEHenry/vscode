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
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const SERVICE_REL = 'src/vs/workbench/services/configuration/browser/configurationService.ts';
const EDITING_REL = 'src/vs/workbench/services/configuration/common/configurationEditing.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const MCP_WORKBENCH_REL = 'src/vs/workbench/services/mcp/browser/mcpWorkbenchManagementService.ts';
const EXT_MGMT_REL = 'src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts';
const VIEWS_SVC_REL = 'src/vs/workbench/services/views/browser/viewsService.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const KEYBINDING_REL = 'src/vs/workbench/services/keybinding/browser/keybindingService.ts';
const CLIPBOARD_REL = 'src/vs/workbench/services/clipboard/browser/clipboardService.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/browser/lifecycleService.ts';
const EDITOR_SVC_REL = 'src/vs/workbench/services/editor/browser/editorService.ts';
const THEME_SVC_REL = 'src/vs/workbench/services/themes/browser/workbenchThemeService.ts';
const BROWSERS_REL = 'src/vs/workbench/api/browser/mainThreadBrowsers.ts';
const FILES_REL = 'src/vs/workbench/contrib/files/browser/views/explorerView.ts';
const SCM_REL = 'src/vs/workbench/contrib/scm/browser/scmViewPane.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const TERMINAL_REL = 'src/vs/workbench/contrib/terminal/browser/terminalService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const SEARCH_SVC_REL = 'src/vs/workbench/services/search/common/searchService.ts';
const ISSUE_REL = 'src/vs/workbench/contrib/issue/browser/issueFormService.ts';
const EXTERNAL_OPENER_REL = 'src/vs/workbench/contrib/externalUriOpener/common/externalUriOpenerService.ts';
const PROCESS_EXPLORER_REL = 'src/vs/workbench/contrib/processExplorer/browser/processExplorerControl.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const singleCatch = '.catch(onUnexpectedError)';
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
	assert.ok(source.includes(`${call}${singleCatch}`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call}${doubleCatch}`), `double catch remains: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${singleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
}

const validateFoldersCall = 'this.validateWorkspaceFoldersAndReload(fromCache)';
const reloadLocalIdleCall = 'this.reloadLocalUserConfiguration(false, this._configuration.localUserConfiguration)';
const processExperimentalCall = 'this.processExperimentalSettings(properties, false)';
const folderChangeListenerCall = 'this.onWorkspaceFolderConfigurationChanged(folder)';
const writeStandaloneCall = 'this.writeConfiguration(operation.target, { key, value: operation.value }, { handleDirtyFile: \'save\', scopes })';
const writeSettingsCall = 'this.writeConfiguration(operation.target, { key: operation.key, value: operation.value }, { handleDirtyFile: \'save\', scopes })';
const leftoverDoOpenHostCall = 'this.doOpen(undefined, { payload: Array.from(environment.entries()) })';
const leftoverReloadCall = '\t\tthis.reload();\n';
const leftoverApplyThemeCall = 'this.applyTheme(themeData, undefined, true)';
const leftoverReplaceEditorsCall = 'this.replaceEditors(replacements, group)';
const leftoverSyncActiveCall = 'this._syncActiveBrowserTab()';

const d955Calls: Array<[string, string, number]> = [
	[SERVICE_REL, validateFoldersCall, 1],
	[SERVICE_REL, reloadLocalIdleCall, 1],
	[SERVICE_REL, processExperimentalCall, 1],
	[SERVICE_REL, folderChangeListenerCall, 1],
	[EDITING_REL, writeStandaloneCall, 1],
	[EDITING_REL, writeSettingsCall, 1],
];

suite('leftover remaining unused configuration leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D955)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused configuration leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d955Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused configuration legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 6);
		for (const source of seen.values()) {
			assert.ok(!source.includes('D955'));
		}
	});

	test('this knife covers six leftover Promise single-chain sites after leftover remaining unused stayed on configuration this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d955Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 6);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(SERVICE_REL) ?? ''), 0);
		assert.strictEqual(countDoubleChains(seen.get(EDITING_REL) ?? ''), 0);
	});

	test('configuration leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + single-chain', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');

		assertPromiseSignature(service, 'private async validateWorkspaceFoldersAndReload(fromCache: boolean): Promise<void> {');
		assertPromiseSignature(service, 'async reloadLocalUserConfiguration(donotTrigger?: boolean, settingsConfiguration?: ConfigurationModel): Promise<ConfigurationModel> {');
		assertPromiseSignature(service, 'private async processExperimentalSettings(properties: Iterable<string>, autoRefetch: boolean): Promise<void> {');
		assertPromiseSignature(service, 'private async onWorkspaceFolderConfigurationChanged(folder: IWorkspaceFolder): Promise<void> {');
		assertPromiseSignature(editing, 'async writeConfiguration(target: EditableConfigurationTarget, value: IConfigurationValue, options: IConfigurationEditingOptions = {}): Promise<void> {');

		assert.ok(service.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(editing.includes("import { ErrorNoTelemetry, onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(service, validateFoldersCall);
		assertWrapped(service, reloadLocalIdleCall);
		assertWrapped(service, processExperimentalCall);
		assertWrapped(service, folderChangeListenerCall);
		assertWrapped(editing, writeStandaloneCall);
		assertWrapped(editing, writeSettingsCall);
		assert.strictEqual(countIncludes(service, `${validateFoldersCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(service, `${reloadLocalIdleCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(service, `${processExperimentalCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(service, `${folderChangeListenerCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(editing, `${writeStandaloneCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(editing, `${writeSettingsCall}${singleCatch}`), 1);
		assert.ok(!service.includes('\t\t\tthis.validateWorkspaceFoldersAndReload(fromCache);\n'));
		assert.ok(!service.includes('() => this.reloadLocalUserConfiguration(false, this._configuration.localUserConfiguration)));'));
		assert.ok(!service.includes('({ properties }) => this.processExperimentalSettings(properties, false)));'));
		assert.ok(!service.includes('onDidChange(() => this.onWorkspaceFolderConfigurationChanged(folder)));'));
		assert.ok(!editing.includes('\t\t\t\t\t\tthis.writeConfiguration(operation.target, { key, value: operation.value }, { handleDirtyFile: \'save\', scopes });\n'));
		assert.ok(!editing.includes('run: () => this.writeConfiguration(operation.target, { key: operation.key, value: operation.value }, { handleDirtyFile: \'save\', scopes })\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(service, 'private async validateWorkspaceFoldersAndReload(fromCache: boolean): Promise<void> {');

		assert.ok(!configuration.includes('openerService.open'));
		assert.ok(!configuration.includes('IOpenerService'));
		assert.ok(!service.includes('openerService.open'));
		assert.ok(!editing.includes('extends Action2'));
		assert.ok(!editing.includes('registerAction2'));
		assert.ok(!service.includes('.then(undefined,'));
		assert.ok(configuration.includes('return jsonEditingService.write(this._workspaceIdentifier.configPath, [{ path: [\'folders\'], value: folders }], true)\n\t\t\t\t.then(() => this.reload());'));
		assert.ok(!configuration.includes('then(() => this.reload()).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.workspaceConfiguration.reload().then(() => this.onWorkspaceConfigurationChanged(false));'));
		assert.ok(!service.includes('reload().then(() => this.onWorkspaceConfigurationChanged(false)).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.reloadRemoteUserConfiguration().then(() => undefined);'));
		assert.ok(!service.includes('reloadRemoteUserConfiguration().then(() => undefined).catch(onUnexpectedError)'));
		assert.ok(service.includes('return this.onWorkspaceFolderConfigurationChanged(folder);'));
		assert.ok(!service.includes(`return this.onWorkspaceFolderConfigurationChanged(folder)${doubleCatch}`));
		assert.ok(service.includes('this.throttler.queue(() => this.updateDefaults());'));
		assert.ok(!service.includes(`this.updateDefaults()${doubleCatch}`));
		assert.ok(service.includes('this.throttler.queue(() => this.processExperimentalSettings(this.autoExperimentalSettings, true))'));
		assert.ok(!service.includes(`this.processExperimentalSettings(this.autoExperimentalSettings, true)${doubleCatch}`));

		for (const source of [configuration, service, editing]) {
			assert.ok(!source.includes(doubleCatch));
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D955'));
		}
	});

	test('this knife did not occupy parallel leftover remaining unused views / host / keybinding / clipboard / lifecycle / editor leftover remaining unused or discarded collision overflow leftover remaining unused', () => {
		const views = fs.readFileSync(resolveSource(VIEWS_SVC_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const keybinding = fs.readFileSync(resolveSource(KEYBINDING_REL), 'utf8');
		const clipboard = fs.readFileSync(resolveSource(CLIPBOARD_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		const files = fs.readFileSync(resolveSource(FILES_REL), 'utf8');
		const scm = fs.readFileSync(resolveSource(SCM_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const terminal = fs.readFileSync(resolveSource(TERMINAL_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const search = fs.readFileSync(resolveSource(SEARCH_SVC_REL), 'utf8');
		const issue = fs.readFileSync(resolveSource(ISSUE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(EXTERNAL_OPENER_REL), 'utf8');
		const processExplorer = fs.readFileSync(resolveSource(PROCESS_EXPLORER_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const extMgmt = fs.readFileSync(resolveSource(EXT_MGMT_REL), 'utf8');
		const themeService = fs.readFileSync(resolveSource(THEME_SVC_REL), 'utf8');
		const browsers = fs.readFileSync(resolveSource(BROWSERS_REL), 'utf8');

		for (const [rel, file] of [
			[VIEWS_SVC_REL, views],
			[HOST_REL, host],
			[KEYBINDING_REL, keybinding],
			[CLIPBOARD_REL, clipboard],
			[LIFECYCLE_REL, lifecycle],
			[EDITOR_SVC_REL, editor],
			[FILES_REL, files],
			[SCM_REL, scm],
			[INTEGRITY_REL, integrity],
			[LANGUAGE_STATUS_REL, languageStatus],
			[TERMINAL_REL, terminal],
			[SETTINGS_REL, settings],
			[SEARCH_SVC_REL, search],
			[ISSUE_REL, issue],
			[EXTERNAL_OPENER_REL, opener],
			[PROCESS_EXPLORER_REL, processExplorer],
			[MCP_WORKBENCH_REL, mcpWorkbench],
			[TASKS_REL, tasks],
			[EXT_MGMT_REL, extMgmt],
			[THEME_SVC_REL, themeService],
			[BROWSERS_REL, browsers],
		] as const) {
			assert.ok(!file.includes('D955'), `${rel} should stay off this knife`);
		}
		assert.ok(host.includes(leftoverDoOpenHostCall));
		assert.ok(!host.includes(`${leftoverDoOpenHostCall}${doubleCatch}`));
		assert.ok(host.includes(leftoverReloadCall));
		assert.ok(!host.includes(`this.reload()${doubleCatch}`));
		assert.ok(editor.includes(`${leftoverReplaceEditorsCall};`));
		assert.ok(!editor.includes(`${leftoverReplaceEditorsCall}${doubleCatch}`));
		assert.ok(themeService.includes(`${leftoverApplyThemeCall};`));
		assert.ok(!themeService.includes(`${leftoverApplyThemeCall}${doubleCatch}`));
		assert.ok(browsers.includes(`${leftoverSyncActiveCall};`));
		assert.ok(!browsers.includes(`${leftoverSyncActiveCall}${doubleCatch}`));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/views/test/node/viewsLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/host/test/node/hostLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/keybinding/test/node/keybindingLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/clipboard/test/node/clipboardLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/lifecycle/test/node/lifecycleLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/editor/test/node/editorLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/files/test/node/filesLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/integrity/test/node/integrityLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/languageStatus/test/node/languageStatusLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/terminal/test/node/terminalLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/preferencesLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/search/test/node/searchLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/issue/test/node/issueLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/externalUriOpener/test/node/externalUriOpenerLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/processExplorer/test/node/processExplorerLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/themes/test/node/themesLeftoverPromiseCatchScanD955.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/api/test/node/mainThreadBrowsersLeftoverPromiseCatchScanD955.test.ts')));
	});
});
