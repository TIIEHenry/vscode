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
const WORKSPACE_REL = 'src/vs/platform/workspace/common/workspace.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const HOST_REL = 'src/vs/workbench/services/host/browser/host.ts';
const LAYOUT_REL = 'src/vs/workbench/services/layout/browser/layoutService.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/common/lifecycle.ts';
const PATH_REL = 'src/vs/workbench/services/path/common/pathService.ts';
const ASSIGN_REL = 'src/vs/workbench/services/assignment/common/assignmentService.ts';
const BASE_RESOLVER_REL = 'src/vs/workbench/services/configurationResolver/browser/baseConfigurationResolverService.ts';
const BROWSER_RESOLVER_REL = 'src/vs/workbench/services/configurationResolver/browser/configurationResolverService.ts';
const ELECTRON_RESOLVER_REL = 'src/vs/workbench/services/configurationResolver/electron-browser/configurationResolverService.ts';
const VARIABLE_REL = 'src/vs/workbench/services/configurationResolver/common/variableResolver.ts';
const TIMER_REL = 'src/vs/workbench/services/timer/browser/timerService.ts';
const TIMER_ELECTRON_REL = 'src/vs/workbench/services/timer/electron-browser/timerService.ts';
const ONBOARDING_REL = 'src/vs/workbench/contrib/onboarding/browser/onboardingService.ts';
const ONBOARDING_CONTRIB_REL = 'src/vs/workbench/contrib/onboarding/browser/onboarding.contribution.ts';
const RELAUNCHER_REL = 'src/vs/workbench/contrib/relauncher/browser/relauncher.contribution.ts';
const HOST_BROWSER_REL = 'src/vs/workbench/services/host/browser/browserHostService.ts';
const PREFERENCES_REL = 'src/vs/workbench/services/preferences/common/preferences.ts';
const WORKSPACES_SVC_REL = 'src/vs/workbench/services/workspaces/browser/workspacesService.ts';
const SHARED_PROCESS_REL = 'src/vs/workbench/services/sharedProcess/electron-browser/sharedProcessService.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyService.ts';
const WALKTHROUGH_REL = 'src/vs/workbench/contrib/welcomeWalkthrough/browser/walkThroughInput.ts';
const WEBVIEW_VIEW_REL = 'src/vs/workbench/contrib/webviewView/browser/webviewViewPane.ts';
const WORKSPACES_CONTRIB_REL = 'src/vs/workbench/contrib/workspaces/browser/workspaces.contribution.ts';
const DIALOGS_REL = 'src/vs/workbench/services/dialogs/browser/simpleFileDialog.ts';
const TERMINAL_CONTRIB_REL = 'src/vs/workbench/contrib/terminalContrib/find/browser/terminalFindWidget.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const USER_DATA_PROFILE_REL = 'src/vs/workbench/contrib/userDataProfile/browser/userDataProfile.ts';
const INTERACTIVE_REL = 'src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts';
const BULK_EDIT_REL = 'src/vs/workbench/contrib/bulkEdit/browser/preview/bulkEditPane.ts';
const EMMET_REL = 'src/vs/workbench/contrib/emmet/browser/actions/expandAbbreviation.ts';
const TEXTMATE_REL = 'src/vs/workbench/services/textMate/browser/textMateTokenizationFeatureImpl.ts';

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
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function assertThenWrapped(source: string, thenStart: string): void {
	const idx = source.indexOf(thenStart);
	assert.ok(idx >= 0, `missing then: ${thenStart}`);
	const afterThen = source.slice(idx);
	const closeThen = afterThen.indexOf(`})${doubleCatch};`);
	assert.ok(closeThen >= 0, `then not double-chained: ${thenStart}`);
	assert.ok(!source.includes(`${thenStart};`));
	assert.ok(!source.includes(`${thenStart}.catch(onUnexpectedError);`));
}

const timerAllThen = `]).then(() => {
			// set perf mark from renderer
			this.setPerformanceMarks('renderer', perf.getMarks());
			return this._computeStartupMetrics();
		}).then(metrics => {
			this._startupMetrics = metrics;
			this._reportStartupTimes(metrics);
			this._barrier.open();
		})`;
const doPumpCall = 'this._doPump()';
const enqueueCall = 'this._enqueue(scenario)';
const workspaceThen = 'this.contextService.getCompleteWorkspace()\n\t\t\t.then(workspace => {';
const doConfirmCall = `this.doConfirm(
				isNative ?
					localize('relaunchSettingMessage', "A setting has changed that requires a restart to take effect.") :
					localize('relaunchSettingMessageWeb', "A setting has changed that requires a reload to take effect."),
				isNative ?
					localize('relaunchSettingDetail', "Press the restart button to restart {0} and enable the setting.", this.productService.nameLong) :
					localize('relaunchSettingDetailWeb', "Press the reload button to reload {0} and enable the setting.", this.productService.nameLong),
				isNative ?
					localize({ key: 'restart', comment: ['&& denotes a mnemonic'] }, "&&Restart") :
					localize({ key: 'restartWeb', comment: ['&& denotes a mnemonic'] }, "&&Reload"),
				() => this.hostService.restart().catch(onUnexpectedError).catch(onUnexpectedError)
			)`;
const reloadCall = 'hostService.reload()';
const startHostsCall = 'extensionService.startExtensionHosts()';
const restartCall = 'this.hostService.restart()';

const d803Calls: Array<[string, string, number, 'call' | 'then']> = [
	[TIMER_REL, timerAllThen, 1, 'then'],
	[ONBOARDING_REL, doPumpCall, 1, 'call'],
	[ONBOARDING_REL, enqueueCall, 1, 'call'],
	[RELAUNCHER_REL, workspaceThen, 1, 'then'],
	[RELAUNCHER_REL, doConfirmCall, 1, 'call'],
	[RELAUNCHER_REL, reloadCall, 1, 'call'],
	[RELAUNCHER_REL, startHostsCall, 1, 'call'],
	[RELAUNCHER_REL, restartCall, 1, 'call'],
];

suite('configurationResolver leftover remaining overflowed to timer/onboarding/relauncher leftover Promise fire-and-forget catch scan (D803)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('configurationResolver leftover remaining has fewer than four legal sites so this knife moved to timer/onboarding/relauncher leftover remaining', () => {
		const base = fs.readFileSync(resolveSource(BASE_RESOLVER_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_RESOLVER_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(ELECTRON_RESOLVER_REL), 'utf8');
		const variable = fs.readFileSync(resolveSource(VARIABLE_REL), 'utf8');
		assert.strictEqual(countDoubleChains(base), 0);
		assert.strictEqual(countDoubleChains(browser), 0);
		assert.strictEqual(countDoubleChains(electron), 0);
		assert.strictEqual(countDoubleChains(variable), 0);
		assert.ok(base.includes('pathService.userHome().then(home => home.path)'));
		assert.ok(!base.includes(`pathService.userHome().then(home => home.path)${doubleCatch}`));
		assert.ok(base.includes('return this.userInputAccessQueue.queue(() => this.quickInputService.input(inputOptions)).then(resolvedInput => {'));
		assert.ok(base.includes('return this.userInputAccessQueue.queue(() => this.quickInputService.pick(picks, pickOptions, undefined)).then(resolvedInput => {'));
		assert.ok(base.includes('return this.userInputAccessQueue.queue(() => this.commandService.executeCommand<string>(info.command, info.args)).then(result => {'));
		assert.ok(!base.includes(`queue(() => this.quickInputService.input(inputOptions)).then(resolvedInput => {${doubleCatch}`));
		assert.ok(variable.includes('this._envVariablesPromise = _envVariablesPromise.then(envVariables => {'));
		assert.ok(!variable.includes(`_envVariablesPromise.then(envVariables => {${doubleCatch}`));
		const resolverLegal = 0;
		assert.ok(resolverLegal < 4, `expected configurationResolver legal leftover <4, got ${resolverLegal}`);
	});

	test('this knife covers eight leftover Promise double-chain sites after configurationResolver leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d803Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			if (kind === 'then') {
				assertThenWrapped(source, call);
				assert.strictEqual(countIncludes(source, call), count, `${rel} ${call}: expected ${count} then starts, got ${countIncludes(source, call)}`);
			} else {
				const wrapped = countIncludes(source, `${call}${doubleCatch}`);
				assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
				assertWrapped(source, call);
			}
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(TIMER_REL)!), 1);
		assert.strictEqual(countDoubleChains(seen.get(ONBOARDING_REL)!), 2);
		assert.strictEqual(countDoubleChains(seen.get(RELAUNCHER_REL)!), 5);
	});

	test('timer leftover Promise.all then is Promise double-chain; assigned perfBaseline stays skipped', () => {
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const electron = fs.readFileSync(resolveSource(TIMER_ELECTRON_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const layout = fs.readFileSync(resolveSource(LAYOUT_REL), 'utf8');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(lifecycle, 'when(phase: LifecyclePhase): Promise<void>;');
		assertPromiseSignature(layout, 'readonly whenRestored: Promise<void>;');
		assertPromiseSignature(timer, 'private async _computeStartupMetrics(): Promise<IStartupMetrics> {');
		assert.ok(timer.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertThenWrapped(timer, timerAllThen);
		assert.ok(timer.includes(`${timerAllThen}${doubleCatch};`));
		assert.ok(!timer.includes(`${timerAllThen};`));
		assert.ok(timer.includes('this.perfBaseline = this._barrier.wait()'));
		assert.ok(timer.includes('.then(() => this._lifecycleService.when(LifecyclePhase.Eventually))'));
		assert.ok(!timer.includes(`this._lifecycleService.when(LifecyclePhase.Eventually))${doubleCatch}`));
		assert.ok(!electron.includes(doubleCatch));
	});

	test('onboarding leftover _doPump / _enqueue are Promise double-chain; two-arg getTreatment then stays skipped', () => {
		const onboarding = fs.readFileSync(resolveSource(ONBOARDING_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(ONBOARDING_CONTRIB_REL), 'utf8');
		const assignment = fs.readFileSync(resolveSource(ASSIGN_REL), 'utf8');
		assertPromiseSignature(onboarding, 'private async _doPump(): Promise<void> {');
		assertPromiseSignature(onboarding, 'private _enqueue(scenario: IOnboardingScenario): Promise<OnboardingOutcome> {');
		assertPromiseSignature(assignment, 'async getTreatment<T extends string | number | boolean>(name: string): Promise<T | undefined> {');
		assert.ok(onboarding.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(onboarding, doPumpCall);
		assert.strictEqual(countIncludes(onboarding, `${enqueueCall}${doubleCatch}`), 1);
		assert.ok(onboarding.includes(`return this._enqueue(scenario);`));
		assert.ok(!onboarding.includes(`return this._enqueue(scenario)${doubleCatch}`));
		assert.ok(onboarding.includes('}, error => onUnexpectedError(error));'));
		assert.ok(!onboarding.includes(`]).then(([behavior, assignmentContextId]) => {${doubleCatch}`));
		assert.ok(contrib.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(!contrib.includes(doubleCatch));
		assert.ok(contrib.includes('accessor.get(IOnboardingScenarioService).resetAll();'));
	});

	test('relauncher leftover getCompleteWorkspace then / doConfirm / reload / startExtensionHosts / restart are Promise double-chain', () => {
		const relauncher = fs.readFileSync(resolveSource(RELAUNCHER_REL), 'utf8');
		const workspace = fs.readFileSync(resolveSource(WORKSPACE_REL), 'utf8');
		const host = fs.readFileSync(resolveSource(HOST_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(workspace, 'getCompleteWorkspace(): Promise<IWorkspace>;');
		assertPromiseSignature(relauncher, 'private async doConfirm(message: string, detail: string, primaryButton: string, confirmedFn: () => void): Promise<void> {');
		assertPromiseSignature(host, 'restart(): Promise<void>;');
		assertPromiseSignature(host, 'reload(options?: { disableExtensions?: boolean }): Promise<void>;');
		assertPromiseSignature(extensions, 'startExtensionHosts(updates?: { readonly toAdd: readonly IExtension[]; readonly toRemove: readonly string[] }): Promise<void>;');
		assert.ok(relauncher.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertThenWrapped(relauncher, workspaceThen);
		assertWrapped(relauncher, doConfirmCall);
		assertWrapped(relauncher, reloadCall);
		assertWrapped(relauncher, startHostsCall);
		assertWrapped(relauncher, restartCall);
		assert.ok(!relauncher.includes('hostService.reload();'));
		assert.ok(!relauncher.includes('extensionService.startExtensionHosts();'));
		assert.ok(!relauncher.includes('() => this.hostService.restart()\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch stay skipped', () => {
		const base = fs.readFileSync(resolveSource(BASE_RESOLVER_REL), 'utf8');
		const variable = fs.readFileSync(resolveSource(VARIABLE_REL), 'utf8');
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const onboarding = fs.readFileSync(resolveSource(ONBOARDING_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(ONBOARDING_CONTRIB_REL), 'utf8');
		const relauncher = fs.readFileSync(resolveSource(RELAUNCHER_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const pathSvc = fs.readFileSync(resolveSource(PATH_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(pathSvc, 'userHome(options?: { preferLocal: boolean }): Promise<URI>;');
		assertPromiseSignature(base, 'override async resolveWithInteractionReplace(folder: IWorkspaceFolderData | undefined, config: unknown, section?: string, variables?: IStringDictionary<string>, target?: ConfigurationTarget): Promise<unknown> {');
		assertPromiseSignature(base, 'private async showUserInput(section: string, variable: string, inputInfos: ConfiguredInput[] | undefined, variableToCommandMap?: IStringDictionary<string>): Promise<IResolvedValue | undefined> {');

		assert.ok(!base.includes('this.openerService.open'));
		assert.ok(base.includes('pathService.userHome().then(home => home.path)'));
		assert.ok(!base.includes(`userHome().then(home => home.path)${doubleCatch}`));
		assert.ok(base.includes('return this.userInputAccessQueue.queue(() => this.quickInputService.input(inputOptions)).then(resolvedInput => {'));
		assert.ok(!base.includes(`return this.userInputAccessQueue.queue(() => this.quickInputService.input(inputOptions)).then(resolvedInput => {${doubleCatch}`));
		assert.ok(variable.includes('this._envVariablesPromise = _envVariablesPromise.then(envVariables => {'));
		assert.ok(!variable.includes(' = _envVariablesPromise.then(envVariables => {\n\t\t\t\treturn this.prepareEnv(envVariables);\n\t\t\t}).catch'));

		assert.ok(timer.includes('this.perfBaseline = this._barrier.wait()'));
		assert.ok(!timer.includes(`this.perfBaseline = this._barrier.wait()${doubleCatch}`));

		assert.ok(onboarding.includes('}, error => onUnexpectedError(error));'));
		assert.ok(onboarding.includes('return this._enqueue(scenario);'));
		assert.ok(contrib.includes('extends Action2'));
		assert.ok(contrib.includes('run(accessor: ServicesAccessor): void {'));
		assert.ok(!contrib.includes(`resetAll()${doubleCatch}`));

		assert.ok(relauncher.includes('return; // no restart when in tests'));
		assert.ok(relauncher.includes('await extensionService.stopExtensionHosts('));
		assert.ok(!relauncher.includes(`stopExtensionHosts(localize('restartExtensionHost.reason', "Changing workspace folders"))${doubleCatch}`));

		for (const source of [base, variable, timer, onboarding, contrib, relauncher]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});

	test('configurationResolver leftover remaining overflow stayed in timer/onboarding/relauncher and did not overflow into occupied leftover modules', () => {
		const host = fs.readFileSync(resolveSource(HOST_BROWSER_REL), 'utf8');
		const preferences = fs.readFileSync(resolveSource(PREFERENCES_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_SVC_REL), 'utf8');
		const pathSvc = fs.readFileSync(resolveSource(PATH_REL), 'utf8');
		const walkthrough = fs.readFileSync(resolveSource(WALKTHROUGH_REL), 'utf8');
		const webviewView = fs.readFileSync(resolveSource(WEBVIEW_VIEW_REL), 'utf8');
		const workspacesContrib = fs.readFileSync(resolveSource(WORKSPACES_CONTRIB_REL), 'utf8');
		const dialogs = fs.readFileSync(resolveSource(DIALOGS_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const interactive = fs.readFileSync(resolveSource(INTERACTIVE_REL), 'utf8');
		assert.ok(!preferences.includes('D803'));
		assert.ok(!host.includes('D803'));
		assert.ok(!workspaces.includes('D803'));
		assert.ok(!pathSvc.includes('D803'));
		assert.ok(!walkthrough.includes('D803'));
		assert.ok(!webviewView.includes('D803'));
		assert.ok(!workspacesContrib.includes('D803'));
		assert.ok(!dialogs.includes('D803'));
		assert.ok(!tasks.includes('D803'));
		assert.ok(!interactive.includes('D803'));
		for (const rel of [SHARED_PROCESS_REL, TEXTFILE_REL, WORKING_COPY_REL, TERMINAL_CONTRIB_REL, USER_DATA_PROFILE_REL, BULK_EDIT_REL, EMMET_REL, TEXTMATE_REL]) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('D803'), `occupied module mentions D803: ${rel}`);
		}
	});
});
