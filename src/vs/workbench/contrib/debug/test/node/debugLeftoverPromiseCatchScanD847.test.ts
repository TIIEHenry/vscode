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
const SERVICE_REL = 'src/vs/workbench/contrib/debug/browser/debugService.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/debug/browser/debugEditorContribution.ts';
const CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
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
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const PROFILE_MODEL_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfilesEditorModel.ts';

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

const launchCall = 'this.launchOrAttachToSession(session)';
const showErrorCall = 'this.showError(err.message, undefined, !!launch?.getConfiguration(config.name))';
const toggleCall = 'this.toggleExceptionWidget()';
const selectPrevLaunchCall = 'this.selectConfiguration(previousSelectedLaunch, previousSelectedName, undefined, dynamicConfig)';
const selectPrevNameCall = 'this.selectConfiguration(undefined, previousSelectedName, undefined, dynamicConfig)';
const selectUndefinedUndefinedCall = 'this.selectConfiguration(undefined, undefined)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const assignedThenCall = 'this._currentSuggestionDetails.then(() => {';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const twoArgThenCall = 'this.remoteAgentService.getEnvironment().then(environment => {';
const leftoverScrollPrevCall = '\t\t\tthis.scrollPrev();\n';
const leftoverSelectStepIdCall = '\t\t\tthis.selectStep(id);\n';
const leftoverSelectStepToSelectCall = '\t\t\tthis.selectStep(toSelect);\n';
const leftoverSelectStepUndefinedCall = '\t\t\t\tthis.selectStep(undefined);\n';
const leftoverSelectStepLooseCall = '\t\t\teditorPane.selectStepLoose(stepID);\n';
const assignedInProgressScroll = 'this.inProgressScroll = this.inProgressScroll.then(async () => {';
const updateDiffSeqCall = 'this._updateDiffInfoSeq()';
const initializeCall = 'this.initialize()';
const inlineValuesThenCall = 'Promise.resolve(provider.provideInlineValues(model, range, ctx, cts.token)).then(async (result) => {';

const d847Calls: Array<[string, string, number]> = [
	[SERVICE_REL, launchCall, 1],
	[SERVICE_REL, showErrorCall, 1],
	[EDITOR_REL, toggleCall, 3],
];

const d843AlreadyDouble: Array<[string, number]> = [
	[selectPrevLaunchCall, 1],
	[selectPrevNameCall, 1],
	[selectUndefinedUndefinedCall, 1],
	[selectUndefinedCall, 2],
];

suite('leftover remaining unused after D843 moved to debug leftover remaining unused Promise fire-and-forget catch scan (D847)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused debug async this.foo() FOF still has four or more legal unused leftover sites so this knife stayed', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assertPromiseSignature(service, 'private async launchOrAttachToSession(session: IDebugSession, forceFocus = false): Promise<void> {');
		assertPromiseSignature(service, 'private async showError(message: string, errorActions: ReadonlyArray<IAction> = [], promptLaunchJson = true): Promise<void> {');
		assertPromiseSignature(editor, 'private async toggleExceptionWidget(): Promise<void> {');
		let sites = 0;
		const seen = new Map<string, string>([[SERVICE_REL, service], [EDITOR_REL, editor]]);
		for (const [rel, call, count] of d847Calls) {
			const source = seen.get(rel) ?? '';
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused debug legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!service.includes('D847'));
		assert.ok(!editor.includes('D847'));
	});

	test('this knife covers five leftover Promise double-chain sites after leftover remaining unused stayed on debug launch/showError/toggleExceptionWidget', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d847Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(SERVICE_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(EDITOR_REL) ?? ''), 3);
	});

	test('debug leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assertPromiseSignature(service, 'private async launchOrAttachToSession(session: IDebugSession, forceFocus = false): Promise<void> {');
		assertPromiseSignature(service, 'private async showError(message: string, errorActions: ReadonlyArray<IAction> = [], promptLaunchJson = true): Promise<void> {');
		assertPromiseSignature(editor, 'private async toggleExceptionWidget(): Promise<void> {');
		assert.ok(service.includes("import { canceledName, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(editor.includes("import { illegalArgument, onUnexpectedError, onUnexpectedExternalError } from '../../../../base/common/errors.js';"));
		assertWrapped(service, launchCall);
		assertWrapped(service, showErrorCall);
		assertWrapped(editor, toggleCall);
		assert.strictEqual(countIncludes(service, `${launchCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(service, `${showErrorCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(editor, `${toggleCall}${doubleCatch}`), 3);
		assert.ok(!service.includes('\t\t\t\tthis.launchOrAttachToSession(session);\n'));
		assert.ok(service.includes('await this.launchOrAttachToSession(session);'));
		assert.ok(!service.includes(`await this.launchOrAttachToSession(session)${doubleCatch}`));
		assert.ok(service.includes('await this.launchOrAttachToSession(session, shouldFocus);'));
		assert.ok(!service.includes(`await this.launchOrAttachToSession(session, shouldFocus)${doubleCatch}`));
		assert.ok(service.includes('await this.showError(message, actionList);'));
		assert.ok(!service.includes(`await this.showError(message, actionList)${doubleCatch}`));
		assert.ok(service.includes('await this.showError(debuggerDisabledMessage(dbg.type), []);'));
		assert.ok(service.includes('await this.showError(err.message);'));
		assert.ok(service.includes('await this.showError(errorMessage, isErrorWithActions(error) ? error.actions : []);'));
		assert.ok(!editor.includes('\t\tthis.toggleExceptionWidget();\n'));
		assert.ok(!editor.includes('\t\t\tthis.toggleExceptionWidget();\n'));
		assert.ok(!editor.includes('\t\t\t\tthis.toggleExceptionWidget();\n'));
		assert.ok(editor.includes('await this.toggleExceptionWidget();'));
		assert.ok(!editor.includes(`await this.toggleExceptionWidget()${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(service, 'private async launchOrAttachToSession(session: IDebugSession, forceFocus = false): Promise<void> {');
		assertPromiseSignature(editor, 'private async toggleExceptionWidget(): Promise<void> {');

		assert.ok(!service.includes('openerService.open'));
		assert.ok(!service.includes('IOpenerService'));
		assert.ok(!service.includes('extends Action2'));
		assert.ok(!editor.includes('openerService.open'));
		assert.ok(!editor.includes('IOpenerService'));
		assert.ok(!editor.includes('extends Action2'));
		assert.ok(!editor.includes('async run('));
		assert.ok(config.includes(twoArgThenCall));
		assert.ok(config.includes('}, () => {'));
		assert.ok(!config.includes(`${twoArgThenCall}${doubleCatch}`));
		assert.ok(editor.includes(inlineValuesThenCall));
		assert.ok(!editor.includes(`${inlineValuesThenCall}${doubleCatch}`));
		assert.ok(service.includes('await this.launchOrAttachToSession(session);'));
		assert.ok(!service.includes(`return this.launchOrAttachToSession(session)${doubleCatch}`));
		assert.ok(editor.includes('await this.toggleExceptionWidget();'));
		assert.ok(!editor.includes(`return this.toggleExceptionWidget()${doubleCatch}`));

		assert.ok(!service.includes('acknowledge('));
		assert.ok(!service.includes('releaseLease('));
		assert.ok(!editor.includes('acknowledge('));
		assert.ok(!editor.includes('releaseLease('));
		for (const source of [service, editor]) {
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D847'));
		}
	});

	test('D843 already-double selectConfiguration collision stays already-double; D834/D837/D828 leftover remaining that landed scans lock already-double stay already-double; locked leftover remaining stay leftover remaining; this knife did not overflow into dirty leftover modules', () => {
		const service = fs.readFileSync(resolveSource(SERVICE_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const gettingStartedContrib = fs.readFileSync(resolveSource(GETTING_STARTED_CONTRIB_REL), 'utf8');
		const aicustom = fs.readFileSync(resolveSource(AICUSTOM_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIGURATION_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const textModel = fs.readFileSync(resolveSource(TEXTMODEL_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(ENTITLEMENT_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const profileModel = fs.readFileSync(resolveSource(PROFILE_MODEL_REL), 'utf8');

		let alreadyDouble = 0;
		for (const [call, count] of d843AlreadyDouble) {
			const wrapped = countIncludes(config, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `D843 collision ${call}: expected ${count} already-double, got ${wrapped}`);
			alreadyDouble += wrapped;
		}
		assert.strictEqual(alreadyDouble, 5);
		assert.strictEqual(countDoubleChains(config), 5);
		assert.ok(!config.includes('D847'));

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

		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));
		assert.ok(mgmt.includes(`this.changeCurrentProfile(profileToUse, localize('reload message when removed', "The current profile has been removed. Please reload to switch back to default profile"))${doubleCatch}`));
		assert.ok(gettingStarted.includes(`this.scrollToCategory(categoryID, stepId)${doubleCatch}`) || gettingStarted.includes(`this.scrollToCategory(categoryID, stepId)${doubleCatch};`));
		assert.ok(aicustom.includes(`this.showEmbeddedMcpDetail(server)${doubleCatch}`) || aicustom.includes(`this.showPluginDetail(item)${doubleCatch}`));
		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(configuration.includes(`this.updateCache()${doubleCatch}`));
		assert.ok(editing.includes(`this.initializeModelsFromDiff()${doubleCatch}`));
		assert.ok(implicit.includes(`this.updateImplicitContext()${doubleCatch}`));
		assert.ok(entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(enablement.includes(`this._enableExtension(extension.identifier)${doubleCatch}`));
		assert.ok(account.includes(`this._updatePolicyDefinitions(this.policyDefinitions)${doubleCatch}`) || account.includes(doubleCatch));
		assert.ok(workbench.includes(`this.autoUpdateBuiltinExtensions()${doubleCatch}`));

		for (const [rel, file] of [
			[CONFIG_REL, config],
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[GETTING_STARTED_REL, gettingStarted],
			[GETTING_STARTED_CONTRIB_REL, gettingStartedContrib],
			[AICUSTOM_REL, aicustom],
			[MCP_DISCOVERY_REL, discovery],
			[CONFIGURATION_REL, configuration],
			[EDITING_REL, editing],
			[TEXTMODEL_REL, textModel],
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
			[PROFILE_MODEL_REL, profileModel],
		] as const) {
			assert.ok(!file.includes('D847'), `${rel} should stay off this knife`);
		}
		assert.ok(!service.includes('D847'));
		assert.ok(!editor.includes('D847'));
		assert.ok(fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/debug/test/node/debugLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/inlineCompletions/test/node/inlineCompletionsLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/userDataProfile/test/node/userDataProfileManagementLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/aiCustomizationLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/output/test/node/outputLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/markers/test/node/markersLeftoverPromiseCatchScanD847.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/scm/test/node/scmLeftoverPromiseCatchScanD847.test.ts')));
	});
});
