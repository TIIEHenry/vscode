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

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

const loadBlobThenCall = 'this._loadBlobUrl(image).then(url => {';
const suggestThenCall = 'this._currentSuggestionDetails.then(() => {';

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

});
