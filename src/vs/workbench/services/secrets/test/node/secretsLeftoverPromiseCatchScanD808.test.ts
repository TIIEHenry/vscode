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
const ASYNC_REL = 'src/vs/base/common/async.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const REMOTE_REL = 'src/vs/workbench/services/remote/common/remoteAgentService.ts';
const PATH_REL = 'src/vs/workbench/services/path/common/pathService.ts';
const VIEWS_IFACE_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const USER_ACTIVITY_SERVICE_REL = 'src/vs/workbench/services/userActivity/common/userActivityService.ts';
const USER_ACTIVITY_REGISTRY_REL = 'src/vs/workbench/services/userActivity/common/userActivityRegistry.ts';
const USER_ACTIVITY_DOM_REL = 'src/vs/workbench/services/userActivity/browser/domActivityTracker.ts';
const USER_ACTIVITY_BROWSER_REL = 'src/vs/workbench/services/userActivity/browser/userActivityBrowser.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const SECRETS_BROWSER_REL = 'src/vs/workbench/services/secrets/browser/secretStorageService.ts';
const REQUEST_BROWSER_REL = 'src/vs/workbench/services/request/browser/requestService.ts';
const REQUEST_NATIVE_REL = 'src/vs/workbench/services/request/electron-browser/requestService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const INTEGRITY_BROWSER_REL = 'src/vs/workbench/services/integrity/browser/integrityService.ts';
const INTEGRITY_IFACE_REL = 'src/vs/workbench/services/integrity/common/integrity.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const VIEWS_REL = 'src/vs/workbench/services/views/browser/viewDescriptorService.ts';
const NOTEBOOK_WIDGET_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const NOTEBOOK_BROWSER_REL = 'src/vs/workbench/contrib/notebook/browser/notebookBrowser.ts';
const TIMER_REL = 'src/vs/workbench/services/timer/browser/timerService.ts';
const RESOLVER_REL = 'src/vs/workbench/services/configurationResolver/browser/baseConfigurationResolverService.ts';
const VARIABLE_REL = 'src/vs/workbench/services/configurationResolver/common/variableResolver.ts';
const ONBOARDING_REL = 'src/vs/workbench/contrib/onboarding/browser/onboardingService.ts';
const WORKING_COPY_REL = 'src/vs/workbench/services/workingCopy/common/workingCopyBackupTracker.ts';
const TEXTFILE_REL = 'src/vs/workbench/services/textfile/browser/textFileService.ts';
const AUTH_REL = 'src/vs/workbench/services/authentication/browser/dynamicAuthenticationProviderStorageService.ts';
const DATA_CHANNEL_REL = 'src/vs/workbench/services/dataChannel/browser/dataChannelService.ts';
const POLICIES_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';

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

const secretsQueueCall = `		this._sequencer.queue(key, async () => {
			await this.resolvedStorageService;

			if (this.type !== 'persisted' && !this._environmentService.useInMemorySecretStorage) {
				this._logService.trace('[NativeSecretStorageService] Notifying user that secrets are not being stored on disk.');
				await this.notifyOfNoEncryptionOnce();
			}

		})`;
const integrityComputeCall = 'this._compute()';
const labelResolveCall = 'this.resolveRemoteEnvironment()';
const viewsThenCall = 'this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered())';
const loadKernelPreloadsCall = 'this._loadKernelPreloads()';
const updateSelectedMarkdownPreviewsCall = 'this.updateSelectedMarkdownPreviews()';
const revealFocusedCellCall = 'this.revealInCenterIfOutsideViewport(focusedCell)';
const revealCellCall = 'this.revealInCenterIfOutsideViewport(cell)';
const createOutputCall = 'this.createOutput(viewCell, result, 0, false)';

const d808Calls: Array<[string, string, number]> = [
	[SECRETS_REL, secretsQueueCall, 1],
	[INTEGRITY_REL, integrityComputeCall, 1],
	[LABEL_REL, labelResolveCall, 1],
	[NOTEBOOK_WIDGET_REL, loadKernelPreloadsCall, 2],
	[NOTEBOOK_WIDGET_REL, updateSelectedMarkdownPreviewsCall, 1],
	[NOTEBOOK_WIDGET_REL, revealFocusedCellCall, 1],
	[NOTEBOOK_WIDGET_REL, revealCellCall, 1],
];

suite('userActivity leftover remaining overflowed to secrets/integrity/label/notebookEditorWidget leftover Promise fire-and-forget catch scan (D808)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('userActivity leftover remaining has fewer than four legal sites so this knife moved to secrets then integrity then label then notebookEditorWidget leftover remaining', () => {
		const service = fs.readFileSync(resolveSource(USER_ACTIVITY_SERVICE_REL), 'utf8');
		const registry = fs.readFileSync(resolveSource(USER_ACTIVITY_REGISTRY_REL), 'utf8');
		const dom = fs.readFileSync(resolveSource(USER_ACTIVITY_DOM_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(USER_ACTIVITY_BROWSER_REL), 'utf8');
		const requestBrowser = fs.readFileSync(resolveSource(REQUEST_BROWSER_REL), 'utf8');
		const requestNative = fs.readFileSync(resolveSource(REQUEST_NATIVE_REL), 'utf8');
		assert.strictEqual(countDoubleChains(service) + countDoubleChains(registry) + countDoubleChains(dom) + countDoubleChains(browser), 0);
		assert.ok(!service.includes('.then('));
		assert.ok(!registry.includes('.then('));
		assert.ok(!dom.includes('.then('));
		assert.ok(!browser.includes('.then('));
		assert.strictEqual(countDoubleChains(requestBrowser) + countDoubleChains(requestNative), 0);
		assert.ok(!requestBrowser.includes('.then('));
		assert.ok(!requestNative.includes('.then('));
	});

	test('this knife covers eight leftover Promise double-chain sites after userActivity leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d808Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(SECRETS_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(INTEGRITY_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(LABEL_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(NOTEBOOK_WIDGET_REL) ?? ''), 12);
		assert.strictEqual(countDoubleChains(fs.readFileSync(resolveSource(SECRETS_BROWSER_REL), 'utf8')), 0);
		assert.strictEqual(countDoubleChains(fs.readFileSync(resolveSource(INTEGRITY_BROWSER_REL), 'utf8')), 0);
		assert.ok(countDoubleChains(fs.readFileSync(resolveSource(VIEWS_REL), 'utf8')) >= 1, 'D813 already-double views leftover remaining');
	});

	test('secrets leftover sequencer queue / integrity leftover _compute / label leftover resolveRemoteEnvironment / notebook leftover remaining this.foo() FOF are Promise double-chain', () => {
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const integrityIface = fs.readFileSync(resolveSource(INTEGRITY_IFACE_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(NOTEBOOK_WIDGET_REL), 'utf8');
		const notebookBrowser = fs.readFileSync(resolveSource(NOTEBOOK_BROWSER_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const remote = fs.readFileSync(resolveSource(REMOTE_REL), 'utf8');
		const pathService = fs.readFileSync(resolveSource(PATH_REL), 'utf8');
		assertPromiseSignature(asyncSource, 'queue<T>(key: TKey, promiseTask: ITask<Promise<T>>): Promise<T> {');
		assertPromiseSignature(integrity, 'private async _compute(): Promise<void> {');
		assertPromiseSignature(integrityIface, 'isPure(): Promise<IntegrityTestResult>;');
		assertPromiseSignature(label, 'private async resolveRemoteEnvironment(): Promise<void> {');
		assertPromiseSignature(remote, 'getEnvironment(): Promise<IRemoteAgentEnvironment | null>;');
		assertPromiseSignature(pathService, 'userHome(options?: { preferLocal: boolean }): Promise<URI>;');
		assertPromiseSignature(widget, 'private async _loadKernelPreloads(): Promise<void> {');
		assertPromiseSignature(widget, 'private async updateSelectedMarkdownPreviews(): Promise<void> {');
		assertPromiseSignature(notebookBrowser, 'revealInCenterIfOutsideViewport(cell: ICellViewModel): Promise<void>;');
		assert.ok(secrets.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(integrity.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(label.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(widget.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(secrets, secretsQueueCall);
		assertWrapped(integrity, integrityComputeCall);
		assertWrapped(label, labelResolveCall);
		assertWrapped(widget, loadKernelPreloadsCall);
		assertWrapped(widget, updateSelectedMarkdownPreviewsCall);
		assertWrapped(widget, revealFocusedCellCall);
		assertWrapped(widget, revealCellCall);
		assert.ok(!secrets.includes(`${secretsQueueCall};`));
		assert.ok(!integrity.includes('\t\tthis._compute();\n'));
		assert.ok(!label.includes('\t\tthis.resolveRemoteEnvironment();\n'));
		assert.ok(!widget.includes('\t\t\t\tthis._loadKernelPreloads();\n'));
		assert.ok(!widget.includes('\t\tthis._loadKernelPreloads();\n'));
		assert.ok(!widget.includes('\t\t\tthis.updateSelectedMarkdownPreviews();\n'));
		assert.ok(!widget.includes('\t\t\t\tthis.revealInCenterIfOutsideViewport(focusedCell);\n'));
		assert.ok(!widget.includes('\t\t\t\tthis.revealInCenterIfOutsideViewport(cell);\n'));
		assert.ok(widget.includes('\t\t\t\t\tawait this.revealInCenterIfOutsideViewport(cell);\n'));
		assert.ok(widget.includes(`${createOutputCall};`));
		assert.ok(!widget.includes(`${createOutputCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const views = fs.readFileSync(resolveSource(VIEWS_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(NOTEBOOK_WIDGET_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const viewsIface = fs.readFileSync(resolveSource(VIEWS_IFACE_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		const timer = fs.readFileSync(resolveSource(TIMER_REL), 'utf8');
		const resolver = fs.readFileSync(resolveSource(RESOLVER_REL), 'utf8');
		const onboarding = fs.readFileSync(resolveSource(ONBOARDING_REL), 'utf8');
		const auth = fs.readFileSync(resolveSource(AUTH_REL), 'utf8');
		const dataChannel = fs.readFileSync(resolveSource(DATA_CHANNEL_REL), 'utf8');
		const policies = fs.readFileSync(resolveSource(POLICIES_REL), 'utf8');
		const workingCopy = fs.readFileSync(resolveSource(WORKING_COPY_REL), 'utf8');
		const textfile = fs.readFileSync(resolveSource(TEXTFILE_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(viewsIface, 'openViewContainer(id: string, focus?: boolean): Promise<IPaneComposite | null>;');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assertPromiseSignature(secrets, 'override set(key: string, value: string): Promise<void> {');
		assertPromiseSignature(integrity, 'isPure(): Promise<IntegrityTestResult> { return this.isPurePromise; }');

		assert.ok(secrets.includes("run: () => this._openerService.open('https://go.microsoft.com/fwlink/?linkid=2239490')"));
		assert.ok(!secrets.includes(`this._openerService.open('https://go.microsoft.com/fwlink/?linkid=2239490')${doubleCatch}`));
		assert.ok(integrity.includes('run: () => this.openerService.open(URI.parse(checksumFailMoreInfoUrl))'));
		assert.ok(!integrity.includes(`this.openerService.open(URI.parse(checksumFailMoreInfoUrl))${doubleCatch}`));

		assert.ok(views.includes(`${viewsThenCall}${doubleCatch}`));
		assert.ok(!views.includes(`${viewsThenCall};`) || views.includes(`${viewsThenCall}${doubleCatch};`));
		assert.ok(views.includes('return registerAction2(class ResetViewLocationAction extends Action2 {'));
		assert.ok(views.includes(`accessor.get(IViewsService).openViewContainer(viewContainer.id, true)${doubleCatch}`));

		assert.ok(secrets.includes('return super.set(key, value);'));
		assert.ok(!secrets.includes(`return super.set(key, value)${doubleCatch}`));
		assert.ok(integrity.includes('this.isPurePromise = this._isPure();'));
		assert.ok(!integrity.includes(`this.isPurePromise = this._isPure()${doubleCatch}`));

		assert.ok(widget.includes('return this.createOutput(cell, output, offset, false);'));
		assert.ok(!widget.includes(`return this.createOutput(cell, output, offset, false)${doubleCatch}`));
		assert.ok(widget.includes('return this._cellLayoutManager?.layoutNotebookCell(cell, height);'));
		assert.ok(!widget.includes(`return this._cellLayoutManager?.layoutNotebookCell(cell, height)${doubleCatch}`));
		assert.ok(widget.includes('\t\t\t\t\tawait this.revealInCenterIfOutsideViewport(cell);\n'));
		assert.ok(!widget.includes(`await this.revealInCenterIfOutsideViewport(cell)${doubleCatch}`));
		assert.ok(widget.includes(`${createOutputCall};`));
		assert.ok(!widget.includes(`${createOutputCall}${doubleCatch}`));

		assert.ok(timer.includes('this.perfBaseline = this._barrier.wait()'));
		assert.ok(!timer.includes(`this.perfBaseline = this._barrier.wait()${doubleCatch}`));
		assert.ok(resolver.includes('return this.userInputAccessQueue.queue(() => this.quickInputService.input(inputOptions)).then(resolvedInput => {'));
		assert.ok(!resolver.includes(`return this.userInputAccessQueue.queue(() => this.quickInputService.input(inputOptions)).then(resolvedInput => {${doubleCatch}`));
		assert.ok(onboarding.includes(']).then(([behavior, assignmentContextId]) => {'));
		assert.ok(onboarding.includes('}, error => onUnexpectedError(error));'));
		assert.ok(!onboarding.includes(`}, error => onUnexpectedError(error))${doubleCatch}`));

		assert.ok(auth.includes('void queue.queue(async () => {'));
		assert.ok(!auth.includes(`void queue.queue(async () => {${doubleCatch}`));
		assert.ok(dataChannel.includes(`void this._activateExtensionProvider(entry, provider, generation)${doubleCatch}`));
		assert.ok(policies.includes('this._updatePolicyDefinitions(this.policyDefinitions);'));
		assert.ok(!policies.includes(`this._updatePolicyDefinitions(this.policyDefinitions)${doubleCatch}`));

		assert.ok(countDoubleChains(workingCopy) >= 1, 'D807 already-double workingCopy leftover remaining');
		assert.ok(!textfile.includes(doubleCatch));

		for (const source of [secrets, integrity, label, widget]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		}
	});

	test('existing-code label unused lifecycleService and variableResolver columnNumber stay unfixed', () => {
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const variable = fs.readFileSync(resolveSource(VARIABLE_REL), 'utf8');
		assert.ok(label.includes('@ILifecycleService lifecycleService: ILifecycleService,'));
		assert.ok(!label.includes('lifecycleService.'));
		assert.ok(variable.includes("throw new Error(localize('canNotResolveColumnNumber'"));
		assert.ok(variable.includes("throw new VariableError(VariableKind.LineNumber"));
		assert.ok(variable.includes("throw new VariableError(VariableKind.SelectedText"));
	});
});
