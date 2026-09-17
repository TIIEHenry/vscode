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
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const GATE_REL = 'src/vs/workbench/services/policies/browser/accountPolicyGateContribution.ts';
const TELEMETRY_REL = 'src/vs/workbench/services/policies/browser/policyTelemetry.contribution.ts';
const GATE_CONTRIB_REL = 'src/vs/workbench/services/policies/browser/accountPolicyGate.contribution.ts';
const DEFAULT_ACCOUNT_REL = 'src/vs/platform/defaultAccount/common/defaultAccount.ts';
const EDIT_SESSIONS_REL = 'src/vs/workbench/contrib/editSessions/browser/editSessions.contribution.ts';
const STORAGE_REL = 'src/vs/workbench/contrib/editSessions/browser/editSessionsStorageService.ts';
const VIEWS_REL = 'src/vs/workbench/contrib/editSessions/browser/editSessionsViews.ts';
const WORKSPACE_STATE_REL = 'src/vs/workbench/contrib/editSessions/common/workspaceStateSync.ts';
const OUTPUT_REL = 'src/vs/workbench/services/output/common/output.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const MACHINES_REL = 'src/vs/platform/userDataSync/common/userDataSyncMachines.ts';
const EDIT_SESSIONS_IFACE_REL = 'src/vs/workbench/contrib/editSessions/common/editSessions.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const getDefaultAccountThenCall = `this.defaultAccountService.getDefaultAccount().then(() => {
			this._updatePolicyDefinitions(this.policyDefinitions);
		})`;
const showManagedSettingsDialogCall = `void this.showManagedSettingsDialog().finally(() => {
			this.managedSettingsDialogVisibleKey = undefined;
			this.managedSettingsDialogDismissedKey = key;
			this.maybeShowManagedSettingsDialog();
		})`;
const refreshCall = 'void this.defaultAccountService.refresh({ forceRefresh: true, retryManagedSettings: true })';
const showChannelCall = 'void outputChannel.showChannel(editSessionsLogId)';
const executeCommandCall = 'void this.commandService.executeCommand(installAdditionalContinueOnOptionsCommand.id)';

const d778Calls: Array<[string, string, number]> = [
	[ACCOUNT_REL, getDefaultAccountThenCall, 1],
	[GATE_REL, showManagedSettingsDialogCall, 1],
	[GATE_REL, refreshCall, 1],
	[EDIT_SESSIONS_REL, showChannelCall, 1],
	[EDIT_SESSIONS_REL, executeCommandCall, 1],
];

suite('policies leftover Promise fire-and-forget overflowed to editSessions leftover remaining catch scan (D778)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('policies leftover has fewer than four legal sites so this knife moved to editSessions leftover remaining', () => {
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const gate = fs.readFileSync(resolveSource(GATE_REL), 'utf8');
		const telemetry = fs.readFileSync(resolveSource(TELEMETRY_REL), 'utf8');
		const gateContrib = fs.readFileSync(resolveSource(GATE_CONTRIB_REL), 'utf8');
		const policiesLegal =
			countIncludes(account, `${getDefaultAccountThenCall}${doubleCatch}`) +
			countIncludes(gate, `${showManagedSettingsDialogCall}${doubleCatch}`) +
			countIncludes(gate, `${refreshCall}${doubleCatch}`);
		assert.ok(policiesLegal < 4, `expected policies legal leftover <4, got ${policiesLegal}`);
		assert.strictEqual(policiesLegal, 3);
		assert.ok(account.includes('this._updatePolicyDefinitions(this.policyDefinitions);'));
		assert.ok(!account.includes(`this._updatePolicyDefinitions(this.policyDefinitions)${doubleCatch}`));
		assert.ok(!telemetry.includes('.then('));
		assert.ok(!telemetry.includes(doubleCatch));
		assert.ok(!gateContrib.includes('.then('));
		assert.ok(!gateContrib.includes(doubleCatch));
	});

	test('this knife covers five leftover Promise double-chain sites after policies leftover overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d778Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
	});

	test('policies leftover getDefaultAccount then / showManagedSettingsDialog / refresh are Promise double-chain', () => {
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const gate = fs.readFileSync(resolveSource(GATE_REL), 'utf8');
		const defaultAccount = fs.readFileSync(resolveSource(DEFAULT_ACCOUNT_REL), 'utf8');
		assertPromiseSignature(defaultAccount, 'getDefaultAccount(): Promise<IDefaultAccount | null>;');
		assertPromiseSignature(defaultAccount, 'refresh(options?: IDefaultAccountRefreshOptions): Promise<IDefaultAccount | null>;');
		assertPromiseSignature(gate, 'private showManagedSettingsDialog(): Promise<unknown> {');
		assert.ok(account.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(gate.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(account, getDefaultAccountThenCall);
		assertWrapped(gate, showManagedSettingsDialogCall);
		assertWrapped(gate, refreshCall);
		assert.ok(!account.includes(`this.defaultAccountService.getDefaultAccount().then(() => {
			this._updatePolicyDefinitions(this.policyDefinitions);
		});`));
		assert.ok(!gate.includes(`void this.showManagedSettingsDialog().finally(() => {
			this.managedSettingsDialogVisibleKey = undefined;
			this.managedSettingsDialogDismissedKey = key;
			this.maybeShowManagedSettingsDialog();
		});`));
		assert.ok(!gate.includes('void this.defaultAccountService.refresh({ forceRefresh: true, retryManagedSettings: true });'));
	});

	test('editSessions leftover remaining showChannel / executeCommand voids are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(EDIT_SESSIONS_REL), 'utf8');
		const output = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(output, 'showChannel(id: string, preserveFocus?: boolean): Promise<void>;');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(source.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, showChannelCall);
		assertWrapped(source, executeCommandCall);
		assert.ok(!source.includes('void outputChannel.showChannel(editSessionsLogId);'));
		assert.ok(!source.includes('void this.commandService.executeCommand(installAdditionalContinueOnOptionsCommand.id);'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / D145 stay skipped', () => {
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const gate = fs.readFileSync(resolveSource(GATE_REL), 'utf8');
		const editSessions = fs.readFileSync(resolveSource(EDIT_SESSIONS_REL), 'utf8');
		const storage = fs.readFileSync(resolveSource(STORAGE_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const workspaceState = fs.readFileSync(resolveSource(WORKSPACE_STATE_REL), 'utf8');
		const machines = fs.readFileSync(resolveSource(MACHINES_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(EDIT_SESSIONS_IFACE_REL), 'utf8');

		assertPromiseSignature(machines, 'getMachines(manifest?: IUserDataManifest): Promise<IUserDataSyncMachine[]>;');
		assert.ok(storage.includes('const currentMachineId = await this.machineClient!.getMachines().then((machines) => machines.find((m) => m.isCurrent)?.id);'));
		assert.ok(!storage.includes(`this.machineClient!.getMachines().then((machines) => machines.find((m) => m.isCurrent)?.id)${doubleCatch}`));
		assert.ok(storage.includes('return await this.machineClient!.getMachines().then((machines) => machines.find((m) => m.isCurrent)!.id);'));
		assert.ok(!storage.includes(`return await this.machineClient!.getMachines().then((machines) => machines.find((m) => m.isCurrent)!.id)${doubleCatch}`));

		assert.ok(gate.includes('run: () => this.commandService.executeCommand(DEFAULT_ACCOUNT_SIGN_IN_COMMAND),'));
		assert.ok(!gate.includes(`run: () => this.commandService.executeCommand(DEFAULT_ACCOUNT_SIGN_IN_COMMAND)${doubleCatch}`));
		assert.ok(gate.includes("run: () => this.openerService.open(URI.parse('https://code.visualstudio.com/docs/enterprise/overview')),"));
		assert.ok(!gate.includes(`run: () => this.openerService.open(URI.parse('https://code.visualstudio.com/docs/enterprise/overview'))${doubleCatch}`));
		assert.ok(gate.includes("run: () => this.commandService.executeCommand('update.checkForUpdate'),"));
		assert.ok(!gate.includes(`run: () => this.commandService.executeCommand('update.checkForUpdate')${doubleCatch}`));

		assert.ok(editSessions.includes('void this.openerService.open(uri, { openExternal: true });'));
		assert.ok(!editSessions.includes(`void this.openerService.open(uri, { openExternal: true })${doubleCatch}`));
		assert.ok(editSessions.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
		assert.ok(editSessions.includes("return accessor.get(IExtensionsWorkbenchService).openSearch('@tag:continueOn');"));
		assert.ok(!editSessions.includes(`return accessor.get(IExtensionsWorkbenchService).openSearch('@tag:continueOn')${doubleCatch}`));
		assert.ok(editSessions.includes('this.autoResumeEditSession();'));
		assert.ok(!editSessions.includes(`this.autoResumeEditSession()${doubleCatch}`));
		assert.ok(editSessions.includes('uri = destination ? await that.resolveDestination(destination) : uri;'));
		assert.ok(!editSessions.includes(`that.resolveDestination(destination)${doubleCatch}`));
		assert.ok(editSessions.includes('[{ label: localize(\'resume\', \'Resume\'), run: () => this.resumeEditSession(ref, false, undefined, true) }]'));
		assert.ok(!editSessions.includes(`run: () => this.resumeEditSession(ref, false, undefined, true)${doubleCatch}`));

		assertPromiseSignature(iface, 'delete(resource: SyncResource, ref: string | null): Promise<void>;');
		assert.ok(workspaceState.includes('this.editSessionsStorageService.delete(\'workspaceState\', resource.ref);'));
		assert.ok(!workspaceState.includes(`this.editSessionsStorageService.delete('workspaceState', resource.ref)${doubleCatch}`));

		assert.ok(views.includes('async run(accessor: ServicesAccessor, handle: TreeViewItemHandleArg): Promise<void> {'));
		assert.ok(views.includes('await treeView.refresh();'));
		assert.ok(!views.includes(`treeView.refresh()${doubleCatch}`));

		for (const source of [account, gate, editSessions, storage, views, workspaceState]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
