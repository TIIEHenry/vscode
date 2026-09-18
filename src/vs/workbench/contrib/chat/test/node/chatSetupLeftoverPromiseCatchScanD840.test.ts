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
const SETUP_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts';
const CONTROLLER_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupController.ts';
const GROWTH_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupGrowthSession.ts';
const RUNNER_REL = 'src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupRunner.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const GETTING_STARTED_CONTRIB_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.contribution.ts';
const INLINE_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const AICUSTOM_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const EDITING_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedNotebookEntry.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const COMMENTS_REL = 'src/vs/workbench/contrib/comments/browser/commentsController.ts';

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

const checkInstallCall = 'this.checkExtensionInstallation(context)';
const registerListenersCall = 'this.registerListeners()';
const maybeDisableCall = 'this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === \'boolean\' ? EnablementState.DisabledWorkspace : EnablementState.DisabledGlobally)';
const maybeEnableCall = 'this.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === \'boolean\' ? EnablementState.EnabledWorkspace : EnablementState.EnabledGlobally)';
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

const d840Calls: Array<[string, string, number]> = [
	[SETUP_REL, checkInstallCall, 1],
	[SETUP_REL, registerListenersCall, 1],
	[SETUP_REL, maybeDisableCall, 1],
	[SETUP_REL, maybeEnableCall, 1],
];

suite('leftover remaining unused chatSetup leftover Promise fire-and-forget catch scan (D840)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused chatSetup leftover async this.foo() FOF still had four or more legal unused leftover sites so this knife stayed', () => {
		const source = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		assertPromiseSignature(source, 'private async checkExtensionInstallation(context: ChatEntitlementContext): Promise<void> {');
		assertPromiseSignature(source, 'private async registerListeners(): Promise<void> {');
		assertPromiseSignature(source, 'private async maybeEnableOrDisableExtension(state: EnablementState.EnabledGlobally | EnablementState.EnabledWorkspace | EnablementState.DisabledGlobally | EnablementState.DisabledWorkspace): Promise<void> {');
		let sites = 0;
		for (const [, call, count] of d840Calls) {
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused chatSetup legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D840'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused stayed on chatSetup', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d840Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(SETUP_REL) ?? ''), 4);
	});

	test('chatSetup leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		assertPromiseSignature(source, 'private async checkExtensionInstallation(context: ChatEntitlementContext): Promise<void> {');
		assertPromiseSignature(source, 'private async registerListeners(): Promise<void> {');
		assertPromiseSignature(source, 'private async maybeEnableOrDisableExtension(state: EnablementState.EnabledGlobally | EnablementState.EnabledWorkspace | EnablementState.DisabledGlobally | EnablementState.DisabledWorkspace): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertWrapped(source, checkInstallCall);
		assertWrapped(source, registerListenersCall);
		assertWrapped(source, maybeDisableCall);
		assertWrapped(source, maybeEnableCall);
		assert.ok(!source.includes('\t\tthis.checkExtensionInstallation(context);\n'));
		assert.ok(!source.includes('\t\tthis.registerListeners();\n'));
		assert.ok(!source.includes('\t\t\tthis.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === \'boolean\' ? EnablementState.DisabledWorkspace : EnablementState.DisabledGlobally);\n'));
		assert.ok(!source.includes('\t\t\tthis.maybeEnableOrDisableExtension(typeof chatDisabled.workspaceValue === \'boolean\' ? EnablementState.EnabledWorkspace : EnablementState.EnabledGlobally);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'private async checkExtensionInstallation(context: ChatEntitlementContext): Promise<void> {');

		assert.ok(source.includes('openerService.open(upgradeUrl);'));
		assert.ok(!source.includes(`openerService.open(upgradeUrl)${doubleCatch}`));
		assert.ok(source.includes('openerService.open(URI.parse(defaultAccountService.resolveGitHubUrl(GitHubPaths.billingBudgets)));'));
		assert.ok(!source.includes(`openerService.open(URI.parse(defaultAccountService.resolveGitHubUrl(GitHubPaths.billingBudgets)))${doubleCatch}`));

		assert.ok(source.includes('class ChatSetupTriggerAction extends Action2'));
		assert.ok(source.includes('override async run(accessor: ServicesAccessor, mode?: ChatModeKind | string, options?: IChatSetupCommandOptions): Promise<boolean | IChatSetupResult>'));
		assert.ok(source.includes('\t\t\t\tconfigurationService.updateValue(ChatAIDisabledSettingId, false);\n'));
		assert.ok(!source.includes('\t\t\t\tconfigurationService.updateValue(ChatAIDisabledSettingId, false).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(!source.includes(`async run(${doubleCatch}`));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(controller.includes('this.registerListeners();'));
		assert.ok(controller.includes('private registerListeners(): void {'));
		assert.ok(!controller.includes(`this.registerListeners()${doubleCatch}`));
		assert.ok(!source.includes(`return this.maybeEnableOrDisableExtension`));
		assert.ok(!source.includes(`await this.checkExtensionInstallation`));
		assert.ok(!source.includes(`await this.registerListeners`));
		assert.ok(!source.includes(`await this.maybeEnableOrDisableExtension`));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D840'));
	});

	test('D828 leftover selectStep / scrollPrev / selectStepLoose / inProgressScroll stay leftover remaining unused; locked leftover remaining stay leftover remaining; owned leftover modules stay unedited', () => {
		const source = fs.readFileSync(resolveSource(SETUP_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const growth = fs.readFileSync(resolveSource(GROWTH_REL), 'utf8');
		const runner = fs.readFileSync(resolveSource(RUNNER_REL), 'utf8');
		const aicustom = fs.readFileSync(resolveSource(AICUSTOM_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(ENTITLEMENT_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const comments = fs.readFileSync(resolveSource(COMMENTS_REL), 'utf8');
		const inline = fs.readFileSync(resolveSource(INLINE_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');

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

		assert.ok(growth.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError)`));
		assert.ok(runner.includes('void Promise.resolve(this.extensionService.whenInstalledExtensionsRegistered()).then(check).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(aicustom.includes(`this.showEmbeddedMcpDetail(server)${doubleCatch}`) || aicustom.includes(`this.showPluginDetail(item)${doubleCatch}`));
		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(configuration.includes(`this.updateCache()${doubleCatch}`));
		assert.ok(editing.includes(`this.initializeModelsFromDiff()${doubleCatch}`));
		assert.ok(implicit.includes(`this.updateImplicitContext()${doubleCatch}`));
		assert.ok(entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(enablement.includes(`this._enableExtension(extension.identifier)${doubleCatch}`));

		for (const [rel, file] of [
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[INLINE_REL, inline],
			[MGMT_REL, mgmt],
			[AICUSTOM_REL, aicustom],
			[MCP_DISCOVERY_REL, discovery],
			[CONFIG_REL, configuration],
			[EDITING_REL, editing],
			[IMPLICIT_REL, implicit],
			[ENTITLEMENT_REL, entitlement],
			[ENABLEMENT_REL, enablement],
			[ACCOUNT_REL, account],
			[WORKBENCH_SVC_REL, workbench],
			[SETTINGS_REL, settings],
			[TASKS_REL, tasks],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[SUGGEST_REL, suggest],
			[COMMENTS_REL, comments],
			[GROWTH_REL, growth],
			[RUNNER_REL, runner],
			[CONTROLLER_REL, fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8')],
		] as const) {
			assert.ok(!file.includes('D840'), `${rel} should stay off this knife`);
		}
		assert.ok(!source.includes('D840'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD840.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD840.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/inlineCompletions/test/node/inlineCompletionsLeftoverPromiseCatchScanD840.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/userDataProfile/test/node/userDataProfileManagementLeftoverPromiseCatchScanD840.test.ts')));
	});
});
