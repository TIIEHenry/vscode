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
const EXTENSIONS_IFACE_REL = 'src/vs/workbench/contrib/extensions/common/extensions.ts';
const WORKBENCH_SVC_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWorkbenchService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/extensions/browser/extensions.contribution.ts';
const ACTIONS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsActions.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/extensions/browser/extensionEditor.ts';
const VIEWS_IFACE_REL = 'src/vs/workbench/services/views/common/viewsService.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/files/browser/explorerService.ts';
const VIEWS_DESC_REL = 'src/vs/workbench/services/views/browser/viewDescriptorService.ts';
const VIEWS_SVC_REL = 'src/vs/workbench/services/views/browser/viewsService.ts';
const UNTITLED_MODEL_REL = 'src/vs/workbench/services/untitled/common/untitledTextEditorModel.ts';
const CALL_CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';
const CALL_PEEK_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchyPeek.ts';
const TYPE_CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const DATA_CHANNEL_REL = 'src/vs/workbench/services/dataChannel/browser/dataChannelService.ts';

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

const enabledAutoCheckCall = 'this.checkForUpdates(`Enabled auto check updates`)';
const enablementChangedCall = "this.checkForUpdates('Extension enablement changed')";
const productUpdateCall = "this.checkForUpdates('Product update')";
const allowedExtensionsCall = "this.checkForUpdates('Allowed extensions changed')";
const meteredCall = "this.checkForUpdates('Connection is no longer metered')";
const refreshCheckCall = 'this.extensionsWorkbenchService.checkForUpdates()';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';

const d815Calls: Array<[string, string, number]> = [
	[WORKBENCH_SVC_REL, enabledAutoCheckCall, 1],
	[WORKBENCH_SVC_REL, enablementChangedCall, 1],
	[WORKBENCH_SVC_REL, productUpdateCall, 1],
	[WORKBENCH_SVC_REL, allowedExtensionsCall, 1],
	[WORKBENCH_SVC_REL, meteredCall, 1],
	[VIEWLET_REL, refreshCheckCall, 1],
];

suite('views leftover remaining moved to extensions leftover Promise fire-and-forget catch scan (D815)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('views leftover remaining has fewer than four legal sites so this knife moved to unused leftover remaining in contrib/extensions', () => {
		const viewsDesc = fs.readFileSync(resolveSource(VIEWS_DESC_REL), 'utf8');
		const viewsSvc = fs.readFileSync(resolveSource(VIEWS_SVC_REL), 'utf8');
		assert.ok(viewsDesc.includes('this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered());'));
		assert.ok(!viewsDesc.includes(`this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered())${doubleCatch}`));
		assert.strictEqual(countDoubleChains(viewsDesc), 0);
		assert.strictEqual(countDoubleChains(viewsSvc), 0);
		const viewsLegal = countIncludes(viewsDesc, 'this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered());');
		assert.ok(viewsLegal < 4, `expected views legal leftover <4, got ${viewsLegal}`);
		assert.strictEqual(viewsLegal, 1);
		assert.ok(!viewsDesc.includes('D815'));
		assert.ok(!viewsSvc.includes('D815'));
	});

	test('this knife covers six leftover Promise double-chain sites after views leftover remaining moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d815Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(WORKBENCH_SVC_REL) ?? ''), 5);
		assert.strictEqual(countDoubleChains(seen.get(VIEWLET_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8')), 1);
	});

	test('extensions leftover checkForUpdates leftover void promises are Promise/async + double-chain', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const iface = fs.readFileSync(resolveSource(EXTENSIONS_IFACE_REL), 'utf8');
		assertPromiseSignature(iface, 'checkForUpdates(): Promise<void>;');
		assertPromiseSignature(workbench, 'async checkForUpdates(reason?: string, onlyBuiltin?: boolean): Promise<void> {');
		assert.ok(workbench.includes("import { CancellationError, getErrorMessage, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(viewlet.includes("import { isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(workbench, enabledAutoCheckCall);
		assertWrapped(workbench, enablementChangedCall);
		assertWrapped(workbench, productUpdateCall);
		assertWrapped(workbench, allowedExtensionsCall);
		assertWrapped(workbench, meteredCall);
		assertWrapped(viewlet, refreshCheckCall);
		assert.ok(!workbench.includes('this.checkForUpdates(`Enabled auto check updates`);'));
		assert.ok(!workbench.includes("this.checkForUpdates('Extension enablement changed');"));
		assert.ok(!workbench.includes("this.checkForUpdates('Product update');"));
		assert.ok(!workbench.includes("this.checkForUpdates('Allowed extensions changed');"));
		assert.ok(!workbench.includes("this.checkForUpdates('Connection is no longer metered');"));
		assert.ok(!viewlet.includes('\t\t\tthis.extensionsWorkbenchService.checkForUpdates();\n'));
	});

	test('extensions leftover loopCheck then / openView then stay leftover remaining because landed scans already claim them unwrapped', () => {
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const workbench = fs.readFileSync(resolveSource(WORKBENCH_SVC_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(ACTIONS_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(workbench, 'async checkForUpdates(reason?: string, onlyBuiltin?: boolean): Promise<void> {');

		assert.ok(actions.includes("run: () => this.openerService.open(downloadUrl).then(() => {"));
		assert.ok(!actions.includes(`this.openerService.open(downloadUrl)${doubleCatch}`));

		assert.ok(contrib.includes('registerAction2'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor): Promise<any> {'));
		assert.ok(!contrib.includes(`async run(accessor: ServicesAccessor): Promise<any> {${doubleCatch}`));

		assert.ok(workbench.includes('this.queryLocal().then(async local => {'));
		assert.ok(workbench.includes('}).then(undefined, error => this.onError(error));'));
		assert.ok(!workbench.includes(`this.queryLocal().then(async local => {${doubleCatch}`));
		assert.ok(!workbench.includes(`}).then(undefined, error => this.onError(error))${doubleCatch}`));

		assert.ok(contrib.includes('extensionManagementService.getInstalled(ExtensionType.User, profile.extensionsResource)'));
		assert.ok(contrib.includes('.then(async extensions => {'));
		assert.ok(!contrib.includes(`.then(async extensions => {${doubleCatch}`));

		assert.ok(actions.includes('return this.getOrCreateExtensionsFile(extensionsFileResource)'));
		assert.ok(!actions.includes(`return this.getOrCreateExtensionsFile(extensionsFileResource)${doubleCatch}`));
		assert.ok(editor.includes('\t\t\taction.run();\n'));
		assert.ok(!editor.includes(`action.run()${doubleCatch}`));

		assert.ok(viewlet.includes('extensionGalleryManifestService.getExtensionGalleryManifest()'));
		assert.ok(viewlet.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(widgets.includes('extensionGalleryManifestService.getExtensionGalleryManifest().then(manifest => {'));
		assert.ok(widgets.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));

		assert.ok(workbench.includes('await this.checkForUpdates();'));
		assert.ok(!workbench.includes(`await this.checkForUpdates()${doubleCatch}`));
		assert.ok(workbench.includes('await this.checkForUpdates(undefined, true);'));
		assert.ok(!workbench.includes(`await this.checkForUpdates(undefined, true)${doubleCatch}`));

		for (const source of [workbench, viewlet, widgets, contrib, actions]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D815'));
		}
	});

	test('D812 callHierarchy leftover already-double stays already-double; views leftover remaining stay unwrapped; this knife did not overflow into dirty leftover modules', () => {
		const callContrib = fs.readFileSync(resolveSource(CALL_CONTRIB_REL), 'utf8');
		const callPeek = fs.readFileSync(resolveSource(CALL_PEEK_REL), 'utf8');
		const typeContrib = fs.readFileSync(resolveSource(TYPE_CONTRIB_REL), 'utf8');
		const viewsDesc = fs.readFileSync(resolveSource(VIEWS_DESC_REL), 'utf8');
		const untitled = fs.readFileSync(resolveSource(UNTITLED_MODEL_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const dataChannel = fs.readFileSync(resolveSource(DATA_CHANNEL_REL), 'utf8');

		assert.ok(callContrib.includes(`this._widget!.showModel(model)${doubleCatch}`));
		assert.ok(callPeek.includes(`this._updatePreview()${doubleCatch}`));
		assert.ok(!callContrib.includes('D815'));
		assert.ok(!callPeek.includes('D815'));
		assert.ok(!typeContrib.includes('D815'));

		assert.ok(viewsDesc.includes('this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered());'));
		assert.ok(!viewsDesc.includes(`this.extensionService.whenInstalledExtensionsRegistered().then(() => this.whenExtensionsRegistered())${doubleCatch}`));
		assert.ok(untitled.includes('\t\tthis.autoDetectLanguage();\n'));
		assert.ok(!untitled.includes(`this.autoDetectLanguage()${doubleCatch}`));

		for (const [rel, source] of [
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[DATA_CHANNEL_REL, dataChannel],
		] as const) {
			assert.ok(!source.includes('D815'), `${rel} should not mention D815`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/services/views/test/node/viewsLeftoverPromiseCatchScanD815.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/callHierarchy/test/node/callHierarchyLeftoverPromiseCatchScanD815.test.ts')));
	});
});
