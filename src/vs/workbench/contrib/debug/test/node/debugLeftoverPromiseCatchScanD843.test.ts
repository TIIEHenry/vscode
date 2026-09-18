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
const CONFIG_REL = 'src/vs/workbench/contrib/debug/browser/debugConfigurationManager.ts';
const UNIFICATION_REL = 'src/vs/workbench/services/inlineCompletions/common/inlineCompletionsUnification.ts';
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const AICUSTOM_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const CONFIGURATION_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
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

const selectPrevLaunchCall = 'this.selectConfiguration(previousSelectedLaunch, previousSelectedName, undefined, dynamicConfig)';
const selectPrevNameCall = 'this.selectConfiguration(undefined, previousSelectedName, undefined, dynamicConfig)';
const selectUndefinedUndefinedCall = 'this.selectConfiguration(undefined, undefined)';
const selectUndefinedCall = 'this.selectConfiguration(undefined)';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const assignedThenCall = 'this._currentSuggestionDetails.then(() => {';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';
const twoArgThenCall = 'this.remoteAgentService.getEnvironment().then(environment => {';

const d843Calls: Array<[string, string, number]> = [
	[CONFIG_REL, selectPrevLaunchCall, 1],
	[CONFIG_REL, selectPrevNameCall, 1],
	[CONFIG_REL, selectUndefinedUndefinedCall, 1],
	[CONFIG_REL, selectUndefinedCall, 2],
];

suite('leftover remaining unused after D834 moved to debug leftover remaining unused Promise fire-and-forget catch scan (D843)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused debugConfigurationManager.selectConfiguration async this.foo() FOF still has four or more legal unused leftover sites so this knife stayed', () => {
		const source = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(source, 'async selectConfiguration(launch: ILaunch | undefined, name?: string, config?: IConfig, dynamicConfig?: { type?: string }): Promise<void> {');
		let sites = 0;
		for (const [, call, count] of d843Calls) {
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused debug legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D843'));
	});

	test('this knife covers five leftover Promise double-chain sites after leftover remaining unused stayed on debugConfigurationManager', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d843Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(CONFIG_REL) ?? ''), 5);
	});

	test('debug leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		assertPromiseSignature(source, 'async selectConfiguration(launch: ILaunch | undefined, name?: string, config?: IConfig, dynamicConfig?: { type?: string }): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, selectPrevLaunchCall);
		assertWrapped(source, selectPrevNameCall);
		assertWrapped(source, selectUndefinedUndefinedCall);
		assertWrapped(source, selectUndefinedCall);
		assert.strictEqual(countIncludes(source, `${selectPrevLaunchCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${selectPrevNameCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${selectUndefinedUndefinedCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${selectUndefinedCall}${doubleCatch}`), 2);
		assert.ok(!source.includes('\t\t\tthis.selectConfiguration(previousSelectedLaunch, previousSelectedName, undefined, dynamicConfig);\n'));
		assert.ok(!source.includes('\t\t\tthis.selectConfiguration(undefined, previousSelectedName, undefined, dynamicConfig);\n'));
		assert.ok(!source.includes('\t\t\tthis.selectConfiguration(undefined, undefined);\n'));
		assert.ok(source.includes('await this.selectConfiguration(launch, config.name);'));
		assert.ok(!source.includes(`await this.selectConfiguration(launch, config.name)${doubleCatch}`));
		assert.ok(source.includes('await this.selectConfiguration(undefined);'));
		assert.ok(!source.includes(`await this.selectConfiguration(undefined)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'async selectConfiguration(launch: ILaunch | undefined, name?: string, config?: IConfig, dynamicConfig?: { type?: string }): Promise<void> {');

		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('IOpenerService'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(!source.includes('async run('));
		assert.ok(source.includes(twoArgThenCall));
		assert.ok(source.includes('}, () => {'));
		assert.ok(!source.includes(`${twoArgThenCall}${doubleCatch}`));
		assert.ok(source.includes('picks.push(provider.provideDebugConfigurations!(launch.workspace?.uri, token).then(configurations => configurations.map(config => ({'));
		assert.ok(!source.includes(`picks.push(provider.provideDebugConfigurations!(launch.workspace?.uri, token).then(configurations => configurations.map(config => ({${doubleCatch}`));
		assert.ok(source.includes('await this.selectConfiguration(launch, config.name);'));
		assert.ok(!source.includes(`return this.selectConfiguration(launch, config.name)${doubleCatch}`));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D843'));
	});

	test('D834/D837/D828/D835/D824/D827/D829/D823/D825/D826 leftover remaining that landed scans lock already-double stay already-double; locked leftover remaining stay leftover remaining; this knife did not overflow into dirty leftover modules', () => {
		const source = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const unification = fs.readFileSync(resolveSource(UNIFICATION_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const aicustom = fs.readFileSync(resolveSource(AICUSTOM_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIGURATION_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
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

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));

		assert.ok(unification.includes(`this._update()${doubleCatch}`));
		assert.ok(mgmt.includes(`this.switchProfile(profileToUse)${doubleCatch}`));
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
			[UNIFICATION_REL, unification],
			[MGMT_REL, mgmt],
			[GETTING_STARTED_REL, gettingStarted],
			[AICUSTOM_REL, aicustom],
			[MCP_DISCOVERY_REL, discovery],
			[CONFIGURATION_REL, configuration],
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
		] as const) {
			assert.ok(!file.includes('D843'), `${rel} should stay off this knife`);
		}
		assert.ok(!source.includes('D843'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/inlineCompletions/test/node/inlineCompletionsLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/userDataProfile/test/node/userDataProfileManagementLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/aiCustomizationLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/configuration/test/node/configurationLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/comments/test/node/commentsLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/chatSetupLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/search/test/node/searchLeftoverPromiseCatchScanD843.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/testing/test/node/testingLeftoverPromiseCatchScanD843.test.ts')));
	});
});
