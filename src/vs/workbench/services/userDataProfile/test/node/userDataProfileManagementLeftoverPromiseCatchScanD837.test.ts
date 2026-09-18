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
const MGMT_REL = 'src/vs/workbench/services/userDataProfile/browser/userDataProfileManagement.ts';
const REMOTE_PROFILE_REL = 'src/vs/workbench/services/userDataProfile/common/remoteUserDataProfiles.ts';
const PROFILE_CONTRIB_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const AICUSTOM_REL = 'src/vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationManagementEditor.ts';
const MCP_DISCOVERY_REL = 'src/vs/workbench/contrib/mcp/common/discovery/installedMcpServersDiscovery.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const EDITING_REL = 'src/vs/workbench/contrib/chat/browser/chatEditing/chatEditingModifiedNotebookEntry.ts';
const IMPLICIT_REL = 'src/vs/workbench/contrib/chat/browser/attachments/chatImplicitContext.ts';
const ENTITLEMENT_REL = 'src/vs/workbench/services/chat/common/chatEntitlementService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const HISTORY_REL = 'src/vs/workbench/services/history/browser/historyService.ts';

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

const switchProfileCall = 'this.switchProfile(profileToUse)';
const changeRemovedCall = 'this.changeCurrentProfile(profileToUse, localize(\'reload message when removed\', "The current profile has been removed. Please reload to switch back to default profile"))';
const changeSwitchedCall = 'this.changeCurrentProfile(profileToUse, localize(\'reload message when switched\', "The current workspace has been removed from the current profile. Please reload to switch back to the updated profile"))';
const changeUpdatedCall = 'this.changeCurrentProfile(updatedCurrentProfile, localize(\'reload message when updated\', "The current profile has been updated. Please reload to switch back to the updated profile"))';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const assignedThenCall = 'this._currentSuggestionDetails.then(() => {';
const d794LockedCall = 'this.onConfigUpdate(undefined, true, true)';

const d837Calls: Array<[string, string, number]> = [
	[MGMT_REL, switchProfileCall, 2],
	[MGMT_REL, changeRemovedCall, 1],
	[MGMT_REL, changeSwitchedCall, 1],
	[MGMT_REL, changeUpdatedCall, 1],
];

suite('leftover remaining unused after D828 collision overflow moved to leftover remaining unused userDataProfileManagement leftover Promise fire-and-forget catch scan (D837)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused after discarding gettingStarted collision overflow still has four or more legal unused leftover sites so this knife stayed on userDataProfileManagement', () => {
		const source = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		assertPromiseSignature(source, 'async switchProfile(profile: IUserDataProfile): Promise<void> {');
		assertPromiseSignature(source, 'private async changeCurrentProfile(profile: IUserDataProfile, reloadMessage?: string): Promise<void> {');
		assert.ok(source.includes('private async onDidChangeCurrentProfile(e: DidChangeUserDataProfileEvent): Promise<void> {'));
		assert.ok(source.includes('this._register(userDataProfileService.onDidChangeCurrentProfile(e => this.onDidChangeCurrentProfile(e)));'));
		assert.ok(!source.includes(`this.onDidChangeCurrentProfile(e)${doubleCatch}`));
		let sites = 0;
		for (const [, call, count] of d837Calls) {
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused userDataProfileManagement legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D837'));
	});

	test('this knife covers five leftover Promise double-chain sites after leftover remaining unused stayed on userDataProfileManagement', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d837Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(MGMT_REL) ?? ''), 5);
	});

	test('userDataProfileManagement leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		assertPromiseSignature(source, 'async switchProfile(profile: IUserDataProfile): Promise<void> {');
		assertPromiseSignature(source, 'private async changeCurrentProfile(profile: IUserDataProfile, reloadMessage?: string): Promise<void> {');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, switchProfileCall);
		assertWrapped(source, changeRemovedCall);
		assertWrapped(source, changeSwitchedCall);
		assertWrapped(source, changeUpdatedCall);
		assert.strictEqual(countIncludes(source, `${switchProfileCall}${doubleCatch}`), 2);
		assert.strictEqual(countIncludes(source, `${changeRemovedCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${changeSwitchedCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${changeUpdatedCall}${doubleCatch}`), 1);
		assert.ok(!source.includes('\t\t\t\tthis.switchProfile(profileToUse);\n'));
		assert.ok(!source.includes('\t\t\t\t\tthis.switchProfile(profileToUse);\n'));
		assert.ok(source.includes('await this.changeCurrentProfile(profile);'));
		assert.ok(!source.includes(`await this.changeCurrentProfile(profile)${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(PROFILE_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'async switchProfile(profile: IUserDataProfile): Promise<void> {');

		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('IOpenerService'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(!source.includes('async run('));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(source.includes('this._register(userDataProfileService.onDidChangeCurrentProfile(e => this.onDidChangeCurrentProfile(e)));'));
		assert.ok(!source.includes(`e => this.onDidChangeCurrentProfile(e)${doubleCatch}`));
		assert.ok(contrib.includes('return that.userDataProfileManagementService.switchProfile(profile);'));
		assert.ok(!contrib.includes(`switchProfile(profile)${doubleCatch}`));
		assert.ok(source.includes('await this.changeCurrentProfile(profile);'));
		assert.ok(!source.includes(`return this.changeCurrentProfile(profile)${doubleCatch}`));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D837'));
	});

	test('D828/D835/D824/D827/D829/D823/D825/D826 leftover remaining that landed scans lock already-double stay already-double; locked leftover remaining stay leftover remaining; this knife did not overflow into dirty leftover modules', () => {
		const source = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_PROFILE_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(PROFILE_CONTRIB_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const aicustom = fs.readFileSync(resolveSource(AICUSTOM_REL), 'utf8');
		const discovery = fs.readFileSync(resolveSource(MCP_DISCOVERY_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const editing = fs.readFileSync(resolveSource(EDITING_REL), 'utf8');
		const implicit = fs.readFileSync(resolveSource(IMPLICIT_REL), 'utf8');
		const entitlement = fs.readFileSync(resolveSource(ENTITLEMENT_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const history = fs.readFileSync(resolveSource(HISTORY_REL), 'utf8');

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
		assert.ok(suggest.includes(assignedThenCall));
		assert.ok(!suggest.includes(`${assignedThenCall}${doubleCatch}`));
		assert.ok(settings.includes(`${d794LockedCall};`));
		assert.ok(!settings.includes(`${d794LockedCall}${doubleCatch}`));

		assert.ok(remote.includes(`this.cleanUp()${doubleCatch}`) || remote.includes(`this.cleanUp()${doubleCatch};`));
		assert.ok(aicustom.includes(`this.showEmbeddedMcpDetail(server)${doubleCatch}`) || aicustom.includes(`this.showPluginDetail(item)${doubleCatch}`));
		assert.ok(discovery.includes(`this.sync()${doubleCatch}`));
		assert.ok(configuration.includes(`this.updateCache()${doubleCatch}`));
		assert.ok(editing.includes(`this.initializeModelsFromDiff()${doubleCatch}`));
		assert.ok(implicit.includes(`this.updateImplicitContext()${doubleCatch}`));
		assert.ok(entitlement.includes(`this.update(cts.value.token)${doubleCatch}`));
		assert.ok(enablement.includes(`this._enableExtension(extension.identifier)${doubleCatch}`));
		assert.ok(gettingStarted.includes(`this.scrollToCategory(categoryID, stepId)${doubleCatch}`) || gettingStarted.includes(`this.scrollToCategory(categoryID, stepId)${doubleCatch};`));

		for (const [rel, file] of [
			[REMOTE_PROFILE_REL, remote],
			[PROFILE_CONTRIB_REL, contrib],
			[VIEWLET_REL, viewlet],
			[WIDGETS_REL, widgets],
			[SUGGEST_REL, suggest],
			[SETTINGS_REL, settings],
			[TASKS_REL, tasks],
			[GETTING_STARTED_REL, gettingStarted],
			[AICUSTOM_REL, aicustom],
			[MCP_DISCOVERY_REL, discovery],
			[CONFIG_REL, configuration],
			[EDITING_REL, editing],
			[IMPLICIT_REL, implicit],
			[ENTITLEMENT_REL, entitlement],
			[ENABLEMENT_REL, enablement],
			[ACCOUNT_REL, account],
			[WORKBENCH_SVC_REL, workbench],
			[HISTORY_REL, history],
		] as const) {
			assert.ok(!file.includes('D837'), `${rel} should stay off this knife`);
		}
		assert.ok(!source.includes('D837'));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD837.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/chat/test/node/aiCustomizationLeftoverPromiseCatchScanD837.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/history/test/node/historyLeftoverPromiseCatchScanD837.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/mcp/test/node/mcpLeftoverPromiseCatchScanD837.test.ts')));
	});
});
