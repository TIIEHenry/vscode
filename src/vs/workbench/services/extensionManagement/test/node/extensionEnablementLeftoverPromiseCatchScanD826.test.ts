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
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const SCANNER_REL = 'src/vs/workbench/services/extensionManagement/browser/webExtensionsScannerService.ts';
const MGMT_REL = 'src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts';
const GLOBAL_ENABLEMENT_REL = 'src/vs/platform/extensionManagement/common/extensionEnablementService.ts';
const GLOBAL_IFACE_REL = 'src/vs/platform/extensionManagement/common/extensionManagement.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const XTERM_REL = 'src/vs/workbench/contrib/terminal/browser/xterm/xtermTerminal.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const ACCOUNT_REL = 'src/vs/workbench/services/policies/common/accountPolicyService.ts';
const CONFIG_REL = 'src/vs/workbench/services/configuration/browser/configuration.ts';
const GETTING_STARTED_REL = 'src/vs/workbench/contrib/welcomeGettingStarted/browser/gettingStarted.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const NOTEBOOK_WIDGET_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const USER_ACTIVITY_REL = 'src/vs/workbench/services/userActivity/common/userActivityService.ts';

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

const disableChatCall = 'this._disableExtension({ id: this._chatExtensionId })';
const enableIdentCall = 'this._enableExtension(extension.identifier)';
const disableIdentCall = 'this._disableExtension(extension.identifier)';
const removeDisabledIdentCall = 'this._removeFromWorkspaceDisabledExtensions(identifier)';
const addDisabledIdentCall = 'this._addToWorkspaceDisabledExtensions(identifier)';
const removeDisabledExtCall = 'this._removeFromWorkspaceDisabledExtensions(extension)';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const whenInitializedThenCall = `this.extensionsManager.whenInitialized().then(() => {
			if (!isDisposed) {
				uninstallDisposable.dispose();
				this._onDidChangeExtensions([], [], false);
				this._register(this.extensionsManager.onDidChangeExtensions(({ added, removed, isProfileSwitch }) => this._onDidChangeExtensions(added, removed, isProfileSwitch)));
				this.loopCheckForMaliciousExtensions();
			}
		})`;
const eventuallyThenCall = `this.lifecycleService.when(LifecyclePhase.Eventually).then(() => {
				this.notificationService.prompt(Severity.Info, localize('extensionsDisabled', "All installed extensions are temporarily disabled."), [{
					label: localize('Reload', "Reload and Enable Extensions"),
					run: () => hostService.reload({ disableExtensions: false })
				}], {
					sticky: true,
					priority: NotificationPriority.URGENT
				});
			})`;
const eventLeftoverCall = 'this._onDidChangeGloballyDisabledExtensions(extensions, source)';
const globalEnableLeftoverCall = 'this.globalExtensionEnablementService.enableExtension(extension)';
const secretsQueueCall = `		this._sequencer.queue(key, async () => {
			await this.resolvedStorageService;

			if (this.type !== 'persisted' && !this._environmentService.useInMemorySecretStorage) {
				this._logService.trace('[NativeSecretStorageService] Notifying user that secrets are not being stored on disk.');
				await this.notifyOfNoEncryptionOnce();
			}

		})`;
const integrityComputeCall = 'this._compute()';
const labelResolveCall = 'this.resolveRemoteEnvironment()';
const loadKernelPreloadsCall = 'this._loadKernelPreloads()';

const d826Calls: Array<[string, string, number]> = [
	[ENABLEMENT_REL, disableChatCall, 1],
	[ENABLEMENT_REL, enableIdentCall, 1],
	[ENABLEMENT_REL, disableIdentCall, 1],
	[ENABLEMENT_REL, removeDisabledIdentCall, 3],
	[ENABLEMENT_REL, addDisabledIdentCall, 1],
	[ENABLEMENT_REL, removeDisabledExtCall, 1],
];

suite('leftover remaining unused extensionEnablement leftover async this.foo() FOF Promise fire-and-forget catch scan (D826)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused extensionEnablement still has four or more legal unused leftover sites so this knife stayed', () => {
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		assert.ok(suggest.includes('this._currentSuggestionDetails.then(() => {'));
		assert.ok(!suggest.includes(`this._currentSuggestionDetails.then(() => {${doubleCatch}`));
		assert.strictEqual(countDoubleChains(notification), 0);
		const unusedLeftoverRemainingLegal = 0;
		assert.ok(unusedLeftoverRemainingLegal < 4, `expected unused leftover remaining legal leftover <4, got ${unusedLeftoverRemainingLegal}`);
		let sites = 0;
		for (const [, call] of d826Calls) {
			sites += countIncludes(enablement, `${call}${doubleCatch}`);
		}
		assert.ok(sites >= 4, `expected leftover remaining unused extensionEnablement legal leftover >=4, got ${sites}`);
		assert.ok(!enablement.includes('D826'));
		assert.ok(!folding.includes('D826'));
		assert.ok(!inlayHints.includes('D826'));
		assert.ok(!languageStatus.includes('D826'));
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on extensionEnablement', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d826Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(ENABLEMENT_REL) ?? ''), 11);
	});

	test('extensionEnablement leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const globalEnablement = fs.readFileSync(resolveSource(GLOBAL_ENABLEMENT_REL), 'utf8');
		const globalIface = fs.readFileSync(resolveSource(GLOBAL_IFACE_REL), 'utf8');
		assertPromiseSignature(enablement, 'private _enableExtension(identifier: IExtensionIdentifier): Promise<boolean> {');
		assertPromiseSignature(enablement, 'private _disableExtension(identifier: IExtensionIdentifier): Promise<boolean> {');
		assertPromiseSignature(enablement, 'private _addToWorkspaceDisabledExtensions(identifier: IExtensionIdentifier): Promise<boolean> {');
		assertPromiseSignature(enablement, 'private async _removeFromWorkspaceDisabledExtensions(identifier: IExtensionIdentifier): Promise<boolean> {');
		assertPromiseSignature(globalEnablement, 'async enableExtension(extension: IExtensionIdentifier, source?: string): Promise<boolean> {');
		assertPromiseSignature(globalEnablement, 'async disableExtension(extension: IExtensionIdentifier, source?: string): Promise<boolean> {');
		assertPromiseSignature(globalIface, 'enableExtension(extension: IExtensionIdentifier, source?: string): Promise<boolean>;');
		assert.ok(enablement.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(enablement, disableChatCall);
		assertWrapped(enablement, enableIdentCall);
		assertWrapped(enablement, disableIdentCall);
		assertWrapped(enablement, removeDisabledIdentCall);
		assertWrapped(enablement, addDisabledIdentCall);
		assertWrapped(enablement, removeDisabledExtCall);
		assert.ok(!enablement.includes('\t\t\t\t\tthis._disableExtension({ id: this._chatExtensionId });\n'));
		assert.ok(!enablement.includes('\t\t\t\tthis._enableExtension(extension.identifier);\n'));
		assert.ok(!enablement.includes('\t\t\t\tthis._disableExtension(extension.identifier);\n'));
		assert.ok(!enablement.includes('\t\tthis._removeFromWorkspaceDisabledExtensions(identifier);\n'));
		assert.ok(!enablement.includes('\t\tthis._addToWorkspaceDisabledExtensions(identifier);\n'));
		assert.ok(!enablement.includes('\t\tthis._removeFromWorkspaceDisabledExtensions(extension);\n'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(enablement, 'private _enableExtension(identifier: IExtensionIdentifier): Promise<boolean> {');

		assert.ok(!enablement.includes('openerService.open'));
		assert.ok(!enablement.includes('IOpenerService'));

		assert.ok(enablement.includes('run: () => hostService.reload({ disableExtensions: false })'));
		assert.ok(!enablement.includes(`hostService.reload({ disableExtensions: false })${doubleCatch}`));

		assert.ok(scanner.includes('run(serviceAccessor: ServicesAccessor): void {'));
		assert.ok(scanner.includes('editorService.openEditor({ resource: userDataProfileService.currentProfile.extensionsResource });'));
		assert.ok(!scanner.includes(`editorService.openEditor({ resource: userDataProfileService.currentProfile.extensionsResource })${doubleCatch}`));

		assert.ok(enablement.includes('this.initializePromise = this.initialize();'));
		assert.ok(!enablement.includes(`this.initializePromise = this.initialize()${doubleCatch}`));

		assert.ok(enablement.includes('return this.globalExtensionEnablementService.enableExtension(identifier, SOURCE);'));
		assert.ok(!enablement.includes(`return this.globalExtensionEnablementService.enableExtension(identifier, SOURCE)${doubleCatch}`));
		assert.ok(enablement.includes('return this.globalExtensionEnablementService.disableExtension(identifier, SOURCE);'));
		assert.ok(!enablement.includes(`return this.globalExtensionEnablementService.disableExtension(identifier, SOURCE)${doubleCatch}`));

		assert.ok(enablement.includes(`${whenInitializedThenCall}${doubleCatch}`));
		assert.ok(enablement.includes(`${eventuallyThenCall}${doubleCatch}`));
		assert.ok(enablement.includes(`${loopCheckThenCall}\n\t\t\t.catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(!enablement.includes(`${whenInitializedThenCall}${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!enablement.includes(`${eventuallyThenCall}${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!enablement.includes(`${loopCheckThenCall}\n\t\t\t.catch(onUnexpectedError).catch(onUnexpectedError).catch(onUnexpectedError)`));

		assert.ok(enablement.includes(`({ extensions, source }) => ${eventLeftoverCall}`));
		assert.ok(!enablement.includes(`${eventLeftoverCall}${doubleCatch}`));
		assert.ok(enablement.includes(`${globalEnableLeftoverCall};`));
		assert.ok(!enablement.includes(`${globalEnableLeftoverCall}${doubleCatch}`));

		assert.ok(enablement.includes('this.configurationService.updateValue(ChatAIDisabledSettingId, true)'));
		assert.ok(enablement.includes(".catch(err => this.logService.error('Failed to update chat.disableAIFeatures setting during builtin chat extension enablement migration', err));"));
		assert.ok(!enablement.includes(`this.configurationService.updateValue(ChatAIDisabledSettingId, true)${doubleCatch}`));

		assert.ok(mgmt.includes('return Promises.settled(servers.map(server => server.extensionManagementService.installFromGallery(gallery, installOptions))).then(([local]) => local);'));
		assert.ok(!mgmt.includes(`installFromGallery(gallery, installOptions))).then(([local]) => local)${doubleCatch}`));

		for (const source of [enablement, scanner, mgmt]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D826'));
		}
	});

	test('D808 secrets/integrity/label/notebook leftover this.foo() stay unretouched; owned leftover remaining unused modules stay unedited', () => {
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_WIDGET_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const xterm = fs.readFileSync(resolveSource(XTERM_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');
		const account = fs.readFileSync(resolveSource(ACCOUNT_REL), 'utf8');
		const configuration = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const gettingStarted = fs.readFileSync(resolveSource(GETTING_STARTED_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const userActivity = fs.readFileSync(resolveSource(USER_ACTIVITY_REL), 'utf8');

		assert.ok(secrets.includes(`${secretsQueueCall}${doubleCatch}`));
		assert.ok(integrity.includes(`${integrityComputeCall}${doubleCatch}`));
		assert.ok(label.includes(`${labelResolveCall}${doubleCatch}`));
		assert.ok(notebook.includes(`${loadKernelPreloadsCall}${doubleCatch}`));

		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes('this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true));'));
		assert.ok(!widgets.includes(`this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))${doubleCatch}`));

		for (const [rel, source] of [
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[NOTEBOOK_WIDGET_REL, notebook],
			[SETTINGS_REL, settings],
			[WORKBENCH_SVC_REL, workbench],
			[XTERM_REL, xterm],
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[TASKS_REL, tasks],
			[ACCOUNT_REL, account],
			[CONFIG_REL, configuration],
			[GETTING_STARTED_REL, gettingStarted],
			[USER_ACTIVITY_REL, userActivity],
		] as const) {
			assert.ok(!source.includes('D826'), `${rel} should not mention D826`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/secrets/test/node/secretsLeftoverPromiseCatchScanD826.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/preferences/test/node/settingsEditor2LeftoverPromiseCatchScanD826.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/extensions/test/node/extensionsLeftoverPromiseCatchScanD826.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/tasks/test/node/tasksLeftoverPromiseCatchScanD826.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/policies/test/node/accountPolicyLeftoverPromiseCatchScanD826.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/welcomeGettingStarted/test/node/welcomeGettingStartedLeftoverPromiseCatchScanD826.test.ts')));
	});
});
