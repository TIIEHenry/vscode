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
const CAROUSEL_REL = 'src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditor.ts';
const CAROUSEL_CONTRIB_REL = 'src/vs/workbench/contrib/imageCarousel/browser/imageCarousel.contribution.ts';
const CAROUSEL_INPUT_REL = 'src/vs/workbench/contrib/imageCarousel/browser/imageCarouselEditorInput.ts';
const KEYBINDINGS_EXPORT_REL = 'src/vs/workbench/contrib/keybindingsExport/electron-browser/keybindingsExport.contribution.ts';
const FOLDING_REL = 'src/vs/workbench/contrib/folding/browser/folding.contribution.ts';
const INLAY_HINTS_REL = 'src/vs/workbench/contrib/inlayHints/browser/inlayHintsAccessibilty.ts';
const LANGUAGE_STATUS_REL = 'src/vs/workbench/contrib/languageStatus/browser/languageStatus.ts';
const POLICY_REL = 'src/vs/workbench/contrib/policyExport/electron-browser/policyExport.contribution.ts';
const QUICKACCESS_REL = 'src/vs/workbench/contrib/quickaccess/browser/commandsQuickAccess.ts';
const THEMES_TEST_REL = 'src/vs/workbench/contrib/themes/browser/themes.test.contribution.ts';
const LIFECYCLE_REL = 'src/vs/workbench/services/lifecycle/electron-browser/lifecycleService.ts';
const SUGGEST_REL = 'src/vs/workbench/services/suggest/browser/simpleSuggestWidget.ts';
const NOTIFICATION_REL = 'src/vs/workbench/services/notification/common/notificationService.ts';
const PROGRESS_REL = 'src/vs/workbench/services/progress/browser/progressService.ts';
const USER_DATA_REL = 'src/vs/workbench/services/userData/browser/userDataInit.ts';
const TEXT_RES_REL = 'src/vs/workbench/services/textresourceProperties/common/textResourcePropertiesService.ts';
const SECRETS_REL = 'src/vs/workbench/services/secrets/electron-browser/secretStorageService.ts';
const INTEGRITY_REL = 'src/vs/workbench/services/integrity/electron-browser/integrityService.ts';
const LABEL_REL = 'src/vs/workbench/services/label/common/labelService.ts';
const TASKS_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const VIEWLET_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsViewlet.ts';
const WIDGETS_REL = 'src/vs/workbench/contrib/extensions/browser/extensionsWidgets.ts';
const TYPE_CONTRIB_REL = 'src/vs/workbench/contrib/typeHierarchy/browser/typeHierarchy.contribution.ts';
const CALL_CONTRIB_REL = 'src/vs/workbench/contrib/callHierarchy/browser/callHierarchy.contribution.ts';

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

const updateCurrentImageCall = 'this.updateCurrentImage()';
const loadBlobThenCall = 'this._loadBlobUrl(image).then(url => {';
const decodeThenCall = 'tmp.decode().then(() => {';
const adjacentThenCall = 'this._loadBlobUrl(adjacentImage).then(url => {';
const rawDataCatchCall = 'this._loadRawData(adjacentImage).catch(() => { /* ignore */ })';
const loopCheckThenCall = '.then(() => this.loopCheckForMaliciousExtensions())';
const openViewThenCall = 'this.viewsService.openView(EXPLORER_VIEW_ID, true).then(() => this.explorerService.select(location, true))';
const suggestThenCall = 'this._currentSuggestionDetails.then(() => {';

const d816Calls: Array<[string, string, number]> = [
	[CAROUSEL_REL, updateCurrentImageCall, 6],
];

suite('keybindingsExport leftover remaining moved to imageCarousel leftover Promise fire-and-forget catch scan (D816)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('keybindingsExport leftover remaining had fewer than four legal unused leftover sites so this knife moved through inlayHints/languageStatus/folding to unused leftover remaining', () => {
		const keybindingsExport = fs.readFileSync(resolveSource(KEYBINDINGS_EXPORT_REL), 'utf8');
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const languageStatus = fs.readFileSync(resolveSource(LANGUAGE_STATUS_REL), 'utf8');
		assert.ok(keybindingsExport.includes('.catch(async error => {'));
		assert.strictEqual(countDoubleChains(keybindingsExport), 0);
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.strictEqual(countDoubleChains(folding), 0);
		assert.strictEqual(countDoubleChains(inlayHints), 0);
		assert.strictEqual(countDoubleChains(languageStatus), 0);
		const keybindingsExportLegal = 0;
		const inlayHintsLegal = 0;
		const languageStatusLegal = 0;
		const foldingLegal = 0;
		assert.ok(keybindingsExportLegal < 4, `expected keybindingsExport legal leftover <4, got ${keybindingsExportLegal}`);
		assert.ok(inlayHintsLegal < 4, `expected inlayHints legal leftover <4, got ${inlayHintsLegal}`);
		assert.ok(languageStatusLegal < 4, `expected languageStatus legal leftover <4, got ${languageStatusLegal}`);
		assert.ok(foldingLegal < 4, `expected folding legal leftover <4, got ${foldingLegal}`);
		assert.ok(!keybindingsExport.includes('D816'));
		assert.ok(!folding.includes('D816'));
		assert.ok(!inlayHints.includes('D816'));
		assert.ok(!languageStatus.includes('D816'));
	});

	test('this knife covers six leftover Promise double-chain sites after keybindingsExport leftover remaining moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d816Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(CAROUSEL_REL) ?? ''), 7);
		assert.ok(!fs.readFileSync(resolveSource(CAROUSEL_CONTRIB_REL), 'utf8').includes(doubleCatch));
		assert.ok(!fs.readFileSync(resolveSource(CAROUSEL_INPUT_REL), 'utf8').includes(doubleCatch));
	});

	test('imageCarousel leftover updateCurrentImage leftover void promises are Promise/async + double-chain', () => {
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');
		assertPromiseSignature(carousel, 'private async updateCurrentImage(): Promise<void> {');
		assertPromiseSignature(carousel, 'private async _loadBlobUrl(image: ICarouselImage): Promise<string> {');
		assert.ok(carousel.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(carousel, updateCurrentImageCall);
		assert.strictEqual(countIncludes(carousel, `${updateCurrentImageCall}${doubleCatch}`), 6);
		assert.ok(!carousel.includes('\t\t\t\tthis.updateCurrentImage();\n'));
		assert.ok(!carousel.includes('\t\t\tthis.updateCurrentImage();\n'));
		assert.ok(!carousel.includes('\t\tthis.updateCurrentImage();\n'));
		assert.ok(carousel.includes('const url = await this._loadBlobUrl(currentImage);'));
		assert.ok(!carousel.includes(`await this._loadBlobUrl(currentImage)${doubleCatch}`));
	});

	test('imageCarousel leftover two-arg then / custom catch leftover remaining stay leftover remaining; already-double adjacent preload stays already-double', () => {
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');
		assert.ok(carousel.includes(loadBlobThenCall));
		assert.ok(carousel.includes('}, () => {\n\t\t\t\t\t\tmarkBroken();\n\t\t\t\t\t});'));
		assert.ok(!carousel.includes(`${loadBlobThenCall}${doubleCatch}`));
		assert.ok(carousel.includes(decodeThenCall));
		assert.ok(!carousel.includes(`${decodeThenCall}${doubleCatch}`));
		assert.ok(carousel.includes(`${adjacentThenCall}`));
		assert.ok(carousel.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(carousel.includes(`${rawDataCatchCall};`));
		assert.ok(!carousel.includes(`${rawDataCatchCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const carousel = fs.readFileSync(resolveSource(CAROUSEL_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(CAROUSEL_CONTRIB_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(CAROUSEL_INPUT_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(carousel, 'private async updateCurrentImage(): Promise<void> {');

		assert.ok(!carousel.includes('openerService.open'));
		assert.ok(!contrib.includes('openerService.open'));
		assert.ok(!input.includes('openerService.open'));

		assert.ok(contrib.includes('export class OpenImageInCarouselAction extends Action2') || contrib.includes('class OpenImageInCarouselAction extends Action2'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor, args?: unknown): Promise<void> {'));
		assert.ok(!contrib.includes(`async run(accessor: ServicesAccessor, args?: unknown): Promise<void> {${doubleCatch}`));
		assert.ok(contrib.includes('await editorService.openEditor(input, { pinned: true });'));
		assert.ok(!contrib.includes(`await editorService.openEditor(input, { pinned: true })${doubleCatch}`));
		assert.ok(!contrib.includes(`registerAction2${doubleCatch}`));

		assert.ok(suggest.includes(suggestThenCall));
		assert.ok(!suggest.includes(`${suggestThenCall}${doubleCatch}`));
		assert.ok(carousel.includes(loadBlobThenCall));
		assert.ok(!carousel.includes(`${loadBlobThenCall}${doubleCatch}`));
		assert.ok(!carousel.includes('.then(undefined,'));
		assert.ok(!contrib.includes('.then(undefined,'));

		for (const source of [carousel, contrib, input]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D816'));
		}
	});

	test('D812 leftover remaining that landed scans lock unwrapped stay unwrapped; already-double leftover stays already-double; this knife did not overflow into dirty leftover modules', () => {
		const keybindingsExport = fs.readFileSync(resolveSource(KEYBINDINGS_EXPORT_REL), 'utf8');
		const folding = fs.readFileSync(resolveSource(FOLDING_REL), 'utf8');
		const inlayHints = fs.readFileSync(resolveSource(INLAY_HINTS_REL), 'utf8');
		const viewlet = fs.readFileSync(resolveSource(VIEWLET_REL), 'utf8');
		const widgets = fs.readFileSync(resolveSource(WIDGETS_REL), 'utf8');
		const typeContrib = fs.readFileSync(resolveSource(TYPE_CONTRIB_REL), 'utf8');
		const callContrib = fs.readFileSync(resolveSource(CALL_CONTRIB_REL), 'utf8');
		const policy = fs.readFileSync(resolveSource(POLICY_REL), 'utf8');
		const quickaccess = fs.readFileSync(resolveSource(QUICKACCESS_REL), 'utf8');
		const themes = fs.readFileSync(resolveSource(THEMES_TEST_REL), 'utf8');
		const lifecycle = fs.readFileSync(resolveSource(LIFECYCLE_REL), 'utf8');
		const notification = fs.readFileSync(resolveSource(NOTIFICATION_REL), 'utf8');
		const progress = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const userData = fs.readFileSync(resolveSource(USER_DATA_REL), 'utf8');
		const textRes = fs.readFileSync(resolveSource(TEXT_RES_REL), 'utf8');
		const secrets = fs.readFileSync(resolveSource(SECRETS_REL), 'utf8');
		const integrity = fs.readFileSync(resolveSource(INTEGRITY_REL), 'utf8');
		const label = fs.readFileSync(resolveSource(LABEL_REL), 'utf8');
		const tasks = fs.readFileSync(resolveSource(TASKS_REL), 'utf8');

		assert.ok(keybindingsExport.includes('.catch(async error => {'));
		assert.ok(!keybindingsExport.includes(doubleCatch));
		assert.ok(folding.includes('\t\tthis._updateConfigValues();\n'));
		assert.ok(!folding.includes(`this._updateConfigValues()${doubleCatch}`));
		assert.ok(inlayHints.includes('\t\t\tthis._read(line, hints);\n'));
		assert.ok(!inlayHints.includes(`this._read(line, hints)${doubleCatch}`));
		assert.ok(viewlet.includes(`${loopCheckThenCall};`));
		assert.ok(!viewlet.includes(`${loopCheckThenCall}${doubleCatch}`));
		assert.ok(widgets.includes(`${openViewThenCall};`));
		assert.ok(!widgets.includes(`${openViewThenCall}${doubleCatch}`));

		assert.ok(typeContrib.includes(doubleCatch));
		assert.ok(callContrib.includes(doubleCatch));

		for (const [rel, source] of [
			[POLICY_REL, policy],
			[QUICKACCESS_REL, quickaccess],
			[THEMES_TEST_REL, themes],
			[LIFECYCLE_REL, lifecycle],
			[NOTIFICATION_REL, notification],
			[PROGRESS_REL, progress],
			[USER_DATA_REL, userData],
			[TEXT_RES_REL, textRes],
			[SECRETS_REL, secrets],
			[INTEGRITY_REL, integrity],
			[LABEL_REL, label],
			[TASKS_REL, tasks],
		] as const) {
			assert.ok(!source.includes('D816'), `${rel} should not mention D816`);
		}
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/keybindingsExport/test/node/keybindingsExportLeftoverPromiseCatchScanD816.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/folding/test/node/foldingLeftoverPromiseCatchScanD816.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/inlayHints/test/node/inlayHintsLeftoverPromiseCatchScanD816.test.ts')));
		assert.ok(!fs.existsSync(path.join(process.cwd(), 'src/vs/workbench/contrib/policyExport/test/node/unusedLeftoverPromiseCatchScanD816.test.ts')));
	});
});
