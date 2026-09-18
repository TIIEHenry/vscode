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
const GALLERY_IFACE_REL = 'src/vs/platform/extensionManagement/common/extensionGalleryManifest.ts';
const ACCOUNT_IFACE_REL = 'src/vs/platform/defaultAccount/common/defaultAccount.ts';
const WEB_GALLERY_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionGalleryManifestService.ts';
const NATIVE_GALLERY_REL = 'src/vs/workbench/services/extensionManagement/electron-browser/extensionGalleryManifestService.ts';
const ENABLEMENT_REL = 'src/vs/workbench/services/extensionManagement/browser/extensionEnablementService.ts';
const SCANNER_REL = 'src/vs/workbench/services/extensionManagement/browser/webExtensionsScannerService.ts';
const MGMT_REL = 'src/vs/workbench/services/extensionManagement/common/extensionManagementService.ts';
const ENABLEMENT_TEST_REL = 'src/vs/workbench/services/extensionManagement/test/browser/extensionEnablementService.test.ts';
const ASSIGNMENT_REL = 'src/vs/workbench/services/assignment/common/assignmentService.ts';
const TEXTMATE_REL = 'src/vs/workbench/services/textMate/browser/textMateTokenizationFeatureImpl.ts';
const TEXTMATE_WORKER_REL = 'src/vs/workbench/services/textMate/browser/backgroundTokenization/threadedBackgroundTokenizerFactory.ts';
const EMMET_REL = 'src/vs/workbench/contrib/emmet/browser/emmetActions.ts';
const EDIT_TELEMETRY_REL = 'src/vs/workbench/contrib/editTelemetry/browser/telemetry/editSourceTrackingImpl.ts';

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

const galleryThen = 'this.getExtensionGalleryManifest().then(manifest => {';
const loopThen = `.then(() => this.loopCheckForMaliciousExtensions())`;
const assignmentThen = 'this.defaultAccountService.getDefaultAccount().then(() => this.recreateTasClientIfEndpointChanged())';
const textMateFofThen = `this._getVSCodeOniguruma().then((vscodeOniguruma) => {
						this._debugModePrintFunc = () => { };`;

suite('extensionManagement leftover Promise fire-and-forget catch scan (D800)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('extensionManagement leftover remaining has fewer than four new legal sites so this knife moved to assignment then textMate', () => {
		const webGallery = fs.readFileSync(resolveSource(WEB_GALLERY_REL), 'utf8');
		const nativeGallery = fs.readFileSync(resolveSource(NATIVE_GALLERY_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const newWraps = countIncludes(webGallery, `${galleryThen}`) +
			countIncludes(nativeGallery, `${galleryThen}`) +
			countIncludes(enablement, `${loopThen}\n\t\t\t.catch(onUnexpectedError).catch(onUnexpectedError)`);
		assert.strictEqual(newWraps, 3);
		assert.ok(newWraps < 4, `expected extensionManagement new legal leftover <4, got ${newWraps}`);
		assert.strictEqual(countDoubleChains(webGallery), 1);
		assert.strictEqual(countDoubleChains(nativeGallery), 1);
		assert.strictEqual(countDoubleChains(enablement), 11);
		assert.strictEqual(countDoubleChains(scanner), 1);
		assert.ok(enablement.includes(`this.extensionsManager.whenInitialized().then(() => {`));
		assert.ok(enablement.includes(`this.lifecycleService.when(LifecyclePhase.Eventually).then(() => {`));
		assert.ok(scanner.includes(`lifecycleService.when(LifecyclePhase.Eventually).then(() => this.updateCaches())${doubleCatch}`));
	});

	test('this knife covers five leftover Promise double-chain sites after extensionManagement leftover overflow', () => {
		const webGallery = fs.readFileSync(resolveSource(WEB_GALLERY_REL), 'utf8');
		const nativeGallery = fs.readFileSync(resolveSource(NATIVE_GALLERY_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const assignment = fs.readFileSync(resolveSource(ASSIGNMENT_REL), 'utf8');
		const textMate = fs.readFileSync(resolveSource(TEXTMATE_REL), 'utf8');
		assertThenWrapped(webGallery, galleryThen);
		assertThenWrapped(nativeGallery, galleryThen);
		assert.ok(enablement.includes(`${loopThen}\n\t\t\t.catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(!enablement.includes(`${loopThen};`));
		assertWrapped(assignment, assignmentThen);
		assertThenWrapped(textMate, textMateFofThen);
		const sites = 1 + 1 + 1 + 1 + 1;
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4 && sites <= 8);
	});

	test('wrapped leftover .then fire-and-forgets are Promise/async + double-chain', () => {
		const webGallery = fs.readFileSync(resolveSource(WEB_GALLERY_REL), 'utf8');
		const nativeGallery = fs.readFileSync(resolveSource(NATIVE_GALLERY_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const assignment = fs.readFileSync(resolveSource(ASSIGNMENT_REL), 'utf8');
		const textMate = fs.readFileSync(resolveSource(TEXTMATE_REL), 'utf8');
		const galleryIface = fs.readFileSync(resolveSource(GALLERY_IFACE_REL), 'utf8');
		const asyncSrc = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const accountIface = fs.readFileSync(resolveSource(ACCOUNT_IFACE_REL), 'utf8');
		assertPromiseSignature(galleryIface, 'getExtensionGalleryManifest(): Promise<IExtensionGalleryManifest | null>;');
		assertPromiseSignature(enablement, 'private async checkForMaliciousExtensions(): Promise<void> {');
		assertPromiseSignature(asyncSrc, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assertPromiseSignature(accountIface, 'getDefaultAccount(): Promise<IDefaultAccount | null>;');
		assertPromiseSignature(textMate, 'private _getVSCodeOniguruma(): Promise<typeof import(\'vscode-oniguruma\')> {');
		assert.ok(webGallery.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(nativeGallery.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(enablement.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(assignment.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(textMate.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertThenWrapped(webGallery, galleryThen);
		assertThenWrapped(nativeGallery, galleryThen);
		assertWrapped(assignment, assignmentThen);
		assertThenWrapped(textMate, textMateFofThen);
		assert.ok(enablement.includes(`${loopThen}\n\t\t\t.catch(onUnexpectedError).catch(onUnexpectedError);`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const webGallery = fs.readFileSync(resolveSource(WEB_GALLERY_REL), 'utf8');
		const nativeGallery = fs.readFileSync(resolveSource(NATIVE_GALLERY_REL), 'utf8');
		const enablement = fs.readFileSync(resolveSource(ENABLEMENT_REL), 'utf8');
		const scanner = fs.readFileSync(resolveSource(SCANNER_REL), 'utf8');
		const mgmt = fs.readFileSync(resolveSource(MGMT_REL), 'utf8');
		const enablementTest = fs.readFileSync(resolveSource(ENABLEMENT_TEST_REL), 'utf8');
		const assignment = fs.readFileSync(resolveSource(ASSIGNMENT_REL), 'utf8');
		const textMate = fs.readFileSync(resolveSource(TEXTMATE_REL), 'utf8');
		const worker = fs.readFileSync(resolveSource(TEXTMATE_WORKER_REL), 'utf8');
		const emmet = fs.readFileSync(resolveSource(EMMET_REL), 'utf8');
		const editTelemetry = fs.readFileSync(resolveSource(EDIT_TELEMETRY_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assert.ok(!webGallery.includes('openerService.open('));
		assert.ok(!nativeGallery.includes('openerService.open('));
		assert.ok(!enablement.includes('openerService.open('));
		assert.ok(!assignment.includes('openerService.open('));
		assert.ok(!textMate.includes('openerService.open('));

		assert.ok(scanner.includes('run(serviceAccessor: ServicesAccessor): void {'));
		assert.ok(scanner.includes('editorService.openEditor({ resource: userDataProfileService.currentProfile.extensionsResource });'));
		assert.ok(!scanner.includes(`editorService.openEditor({ resource: userDataProfileService.currentProfile.extensionsResource })${doubleCatch}`));

		assert.ok(worker.includes('const controllerContainer = this._getWorkerProxy().then((workerProxy) => {'));
		assertPromiseSignature(worker, 'private _getWorkerProxy(): Promise<Proxied<TextMateTokenizationWorker> | null> {');
		assert.ok(!worker.includes(doubleCatch));

		assert.ok(enablementTest.includes(".then(() => assert.fail('should throw an error'), error => assert.ok(error));"));
		assert.ok(!enablementTest.includes(doubleCatch));

		assert.ok(mgmt.includes('return Promises.settled(servers.map(server => server.extensionManagementService.installFromGallery(gallery, installOptions))).then(([local]) => local);'));
		assert.ok(!mgmt.includes(`installFromGallery(gallery, installOptions))).then(([local]) => local)${doubleCatch}`));
		assert.ok(textMate.includes('return this._getVSCodeOniguruma().then((vscodeOniguruma) => {'));
		assert.ok(!textMate.includes(`return this._getVSCodeOniguruma().then((vscodeOniguruma) => {${doubleCatch}`));
		assert.ok(emmet.includes('this._lastGrammarContributions = extensionService.readExtensionPointContributions(grammarsExtPoint).then((contributions) => {'));
		assert.ok(emmet.includes('return this._withGrammarContributions(extensionService).then((grammarContributions) => {'));
		assert.ok(!emmet.includes(doubleCatch));

		assert.ok(enablement.includes(`this.extensionsManager.whenInitialized().then(() => {`));
		assert.ok(enablement.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(scanner.includes(`lifecycleService.when(LifecyclePhase.Eventually).then(() => this.updateCaches())${doubleCatch}`));

		assert.ok(assignment.includes('tasClient.initialFetch.then(() => {'));
		assert.ok(assignment.includes('}).catch(() => undefined);'));
		assert.ok(!assignment.includes(`tasClient.initialFetch.then(() => {${doubleCatch}`));
		assert.ok(assignment.includes('client?.then(c => c.dispose()).catch(() => undefined);'));
		assert.ok(!assignment.includes(`client?.then(c => c.dispose())${doubleCatch}`));

		assert.ok(editTelemetry.includes('void this.sendTelemetry(mode, trigger, tracker, focusTime, actualTime).catch(error => {'));
		assert.ok(!editTelemetry.includes(doubleCatch));

		for (const source of [webGallery, nativeGallery, enablement, scanner, mgmt, assignment, textMate, worker, emmet]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve(Turn|Anchor)\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
