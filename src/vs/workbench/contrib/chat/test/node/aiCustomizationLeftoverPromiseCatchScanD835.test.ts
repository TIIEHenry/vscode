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
const EDITOR_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const WELCOME_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationWelcomePagePromptLaunchers.ts';
const DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const MIGRATION_REL = 'src/vs/workbench/contrib/mcp/browser/mcpMigration.ts';
const MCP_WORKBENCH_REL = 'src/vs/workbench/contrib/mcp/browser/mcpWorkbenchService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const CHAT_ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const EDITING_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedNotebookEntry.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
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

const mcpDetailCall = 'this.showEmbeddedMcpDetail(server)';
const pluginDetailCall = 'this.showPluginDetail(item)';
const embeddedPluginCall = 'this.showEmbeddedPluginDetail(item)';
const toolDetailCall = 'this.showEmbeddedToolDetail(extension)';
const openSkillCall = 'this.openSkillFromPluginDetail(uri)';
const openPromptsCall = 'this.openPromptsItemFromPluginDetail(AICustomizationManagementSection.Agents, uri)';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';

const d835Calls: Array<[string, string, number]> = [
	[EDITOR_REL, mcpDetailCall, 1],
	[EDITOR_REL, pluginDetailCall, 1],
	[EDITOR_REL, embeddedPluginCall, 1],
	[EDITOR_REL, toolDetailCall, 1],
	[EDITOR_REL, openSkillCall, 1],
	[EDITOR_REL, openPromptsCall, 1],
];

suite('leftover remaining unused after D824 moved to leftover remaining unused aiCustomization leftover Promise fire-and-forget catch scan (D835)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after D824 still has four legal unused leftover sites so this knife stayed on aiCustomization', () => {
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assertPromiseSignature(editor, 'private async showEmbeddedMcpDetail(server: IMcpServerDetailInput): Promise<void> {');
		assertPromiseSignature(editor, 'public async showPluginDetail(item: IAgentPluginItem): Promise<void> {');
		assertPromiseSignature(editor, 'private async showEmbeddedPluginDetail(item: IAgentPluginItem): Promise<void> {');
		assertPromiseSignature(editor, 'private async showEmbeddedToolDetail(extension: IExtension): Promise<void> {');
		assertPromiseSignature(editor, 'private async openSkillFromPluginDetail(uri: URI): Promise<void> {');
		assertPromiseSignature(editor, 'private async openPromptsItemFromPluginDetail(section: AICustomizationManagementSection, uri: URI): Promise<void> {');
		assert.ok(editor.includes('private layoutSidebar(width: number, height: number): void {'));
		assert.ok(editor.includes('public showCustomizationMigrationPage(categoryId: CustomizationMigrationCategoryId): void {'));
		assert.ok(editor.includes('private updateContentVisibility(): void {'));
		assert.ok(editor.includes('private goBackFromMcpDetail(): void {'));
		assert.ok(editor.includes('private goBackFromPluginDetail(): void {'));
		assert.ok(editor.includes('private goBackFromToolDetail(): void {'));
		assert.ok(!editor.includes(`this.layoutSidebar(width, height)${doubleCatch}`));
		assert.ok(!editor.includes(`this.showCustomizationMigrationPage(category.id)${doubleCatch}`));
		assert.ok(!editor.includes(`this.updateContentVisibility()${doubleCatch}`));
		assert.ok(!editor.includes(`this.goBackFromMcpDetail()${doubleCatch}`));
		assert.ok(!editor.includes(`this.goBackFromPluginDetail()${doubleCatch}`));
		assert.ok(!editor.includes(`this.goBackFromToolDetail()${doubleCatch}`));
		let sites = 0;
		for (const [, call] of d835Calls) {
			sites += countIncludes(editor, `${call}${doubleCatch}`);
		}
		assert.ok(sites >= 4, `expected leftover remaining unused aiCustomization legal leftover >=4, got ${sites}`);
		assert.ok(!editor.includes('D835'));
	});

	test('this knife covers six leftover Promise double-chain sites after leftover remaining unused stayed on aiCustomization', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d835Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(EDITOR_REL) ?? ''), 25);
	});

	test('aiCustomization leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assertPromiseSignature(editor, 'private async showEmbeddedMcpDetail(server: IMcpServerDetailInput): Promise<void> {');
		assertPromiseSignature(editor, 'public async showPluginDetail(item: IAgentPluginItem): Promise<void> {');
		assertPromiseSignature(editor, 'private async showEmbeddedPluginDetail(item: IAgentPluginItem): Promise<void> {');
		assertPromiseSignature(editor, 'private async showEmbeddedToolDetail(extension: IExtension): Promise<void> {');
		assertPromiseSignature(editor, 'private async openSkillFromPluginDetail(uri: URI): Promise<void> {');
		assertPromiseSignature(editor, 'private async openPromptsItemFromPluginDetail(section: AICustomizationManagementSection, uri: URI): Promise<void> {');
		assert.ok(editor.includes("import { getErrorMessage, onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(editor, mcpDetailCall);
		assertWrapped(editor, pluginDetailCall);
		assertWrapped(editor, embeddedPluginCall);
		assertWrapped(editor, toolDetailCall);
		assertWrapped(editor, openSkillCall);
		assertWrapped(editor, openPromptsCall);
		assert.ok(!editor.includes('\t\t\t\tthis.showEmbeddedMcpDetail(server);\n'));
		assert.ok(!editor.includes('\t\t\t\tthis.showPluginDetail(item);\n'));
		assert.ok(!editor.includes('\t\t\t\tthis.showEmbeddedPluginDetail(item);\n'));
		assert.ok(!editor.includes('\t\t\t\tthis.showEmbeddedToolDetail(extension);\n'));
		assert.ok(!editor.includes('\t\t\tthis.openSkillFromPluginDetail(uri);\n'));
		assert.ok(!editor.includes('\t\t\tthis.openPromptsItemFromPluginDetail(AICustomizationManagementSection.Agents, uri);\n'));
		assert.ok(editor.includes('\t\tawait this.showEmbeddedPluginDetail(item);\n'));
		assert.ok(!editor.includes(`await this.showEmbeddedPluginDetail(item)${doubleCatch}`));
		assert.ok(editor.includes('await this.openPromptsItemFromPluginDetail(AICustomizationManagementSection.Skills, uri);'));
		assert.ok(!editor.includes(`await this.openPromptsItemFromPluginDetail(AICustomizationManagementSection.Skills, uri)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(editor, 'private async showEmbeddedMcpDetail(server: IMcpServerDetailInput): Promise<void> {');

		assert.ok(editor.includes('this.openerService.open(URI.parse(modelsLink.href));'));
		assert.ok(!editor.includes(`this.openerService.open(URI.parse(modelsLink.href))${doubleCatch}`));
		assert.ok(!editor.includes('extends Action2'));
		assert.ok(!editor.includes('.then(undefined,'));
		assert.ok(editor.includes('void this.listWidget?.refresh();'));
		assert.ok(!editor.includes(`void this.listWidget?.refresh()${doubleCatch}`));
		assert.ok(editor.includes('await this.showEmbeddedPluginDetail(item);'));
		assert.ok(!editor.includes(`return this.showEmbeddedPluginDetail(item)${doubleCatch}`));
		assert.ok(editor.includes(`void this.refreshCustomizationMigrationInfo()${doubleCatch}`));
		assert.ok(editor.includes(`void this.showEmbeddedEditor(item.uri, item.name, item.promptType, source ?? AICustomizationSources.builtin, isWorkspaceFile, isReadOnly)${doubleCatch}`));
		assert.ok(editor.includes(`void this.listWidget.setSection(this.selectedSection)${doubleCatch}`));

		assert.ok(!editor.includes('acknowledge('));
		assert.ok(!editor.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(editor));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(editor));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(editor));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(editor));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(editor));
		assert.ok(!editor.includes('SaveSkillContent'));
		assert.ok(!editor.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!editor.includes('D835'));
	});

	test('D824/D817/D819/D821/D823/D825/D826 leftover remaining that landed scans lock already-double stay already-double; locked leftover remaining stay leftover remaining; this knife did not overflow into dirty leftover modules', () => {
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const welcome = fs.readFileSync(resolveSource(WELCOME_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(DISCOVERY_REL), 'utf8');
		const migration = fs.readFileSync(resolveSource(MIGRATION_REL), 'utf8');
		const mcpWorkbench = fs.readFileSync(resolveSource(MCP_WORKBENCH_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const workbenchSvc = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(CHAT_ENTITLEMENT_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));

		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(migration.includes(`this.migrateMcpConfig()${doubleCatch}`));
		assert.ok(mcpWorkbench.includes(`this.open(local)${doubleCatch}`));
		assert.ok(implicit.includes(`this.updateImplicitContext()${doubleCatch}`));
		assert.ok(entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(enablement.includes(`this._enableExtension(extension.identifier)${doubleCatch}`));

		assert.ok(welcome.includes('void this.commandService.executeCommand(customization.commandId);') || welcome.includes(`void this.commandService.executeCommand(customization.commandId)${doubleCatch}`));
		assert.ok(editing.includes('this.initializeModelsFromDiff();') || editing.includes(`this.initializeModelsFromDiff()${doubleCatch}`));
		assert.ok(configuration.includes('\t\tthis.updateCache();\n') || configuration.includes(`this.updateCache()${doubleCatch}`));

		for (const [rel, source] of [
			[DISCOVERY_REL, discovery],
			[MIGRATION_REL, migration],
			[MCP_WORKBENCH_REL, mcpWorkbench],
			[SETTINGS_REL, settings],
			[WORKBENCH_SVC_REL, workbenchSvc],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[ACCOUNT_REL, account],
			[CONFIG_REL, configuration],
			[IMPLICIT_REL, implicit],
			[CHAT_ENTITLEMENT_REL, entitlement],
			[ENABLEMENT_REL, enablement],
			[EDITING_REL, editing],
			[TASKS_REL, tasks],
			[SUGGEST_REL, suggest],
			[WELCOME_REL, welcome],
		] as const) {
			assert.ok(!source.includes('D835'), `${rel} should not mention D835`);
		}
		assert.ok(!editor.includes('D835'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD835.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD835.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatEditingLeftoverPromiseCatchScanD835.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatImplicitContextLeftoverPromiseCatchScanD835.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/chat/test/node/chatEntitlementLeftoverPromiseCatchScanD835.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/extensionManagement/test/node/extensionEnablementLeftoverPromiseCatchScanD835.test.ts')));
	});
});
