/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const FORMAT_REL = 'src/vs/editor/contrib/format/browser/formatActions.ts';
const FORMAT_API_REL = 'src/vs/editor/contrib/format/browser/format.ts';
const GOTO_REL = 'src/vs/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition.ts';
const DIFF_REL = 'src/vs/editor/browser/widget/diffEditor/diffEditorWidget.ts';
const UNUSUAL_REL = 'src/vs/editor/contrib/unusualLineTerminators/browser/unusualLineTerminators.ts';
const MARKER_REL = 'src/vs/editor/contrib/hover/browser/markerHoverParticipant.ts';
const LINKS_REL = 'src/vs/editor/contrib/links/browser/links.ts';
const WORD_REL = 'src/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.ts';
const FOLD_REL = 'src/vs/editor/contrib/folding/browser/folding.ts';
const OUTLINE_REL = 'src/vs/editor/contrib/documentSymbols/browser/outlineModel.ts';
const HOVER_REL = 'src/vs/editor/contrib/hover/browser/hoverActions.ts';
const ACCESS_REL = 'src/vs/editor/contrib/inlineCompletions/browser/inlineCompletionsAccessibleView.ts';
const MODEL_REL = 'src/vs/editor/contrib/inlineCompletions/browser/model/inlineCompletionsModel.ts';
const INDENT_REL = 'src/vs/editor/contrib/indentation/browser/indentation.ts';
const STICKY_REL = 'src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts';
const SECTION_REL = 'src/vs/editor/contrib/sectionHeaders/browser/sectionHeaders.ts';
const UNICODE_REL = 'src/vs/editor/contrib/unicodeHighlighter/browser/unicodeHighlighter.ts';

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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

suite('editor remaining leftover Promise fire-and-forget catch scan (D709)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise sites', () => {
		const format = fs.readFileSync(resolveSource(FORMAT_REL), 'utf8');
		const goto = fs.readFileSync(resolveSource(GOTO_REL), 'utf8');
		const diff = fs.readFileSync(resolveSource(DIFF_REL), 'utf8');
		const unusual = fs.readFileSync(resolveSource(UNUSUAL_REL), 'utf8');
		const formatThenFinally = (format.match(/\}\)\.finally\(\(\) => \{\n\t\t\tunbind\.dispose\(\);\n\t\t\}\)\.catch\(onUnexpectedError\);/g) ?? []).length;
		const gotoSites = (goto.match(/\.catch\(onUnexpectedError\)/g) ?? []).length;
		const diffSites = (diff.match(/this\.waitForDiff\(\)\.then\(\(\) => \{[\s\S]*?\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\);/g) ?? []).length;
		const unusualSites = (unusual.match(/this\._checkForUnusualLineTerminators\(\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		assert.strictEqual(formatThenFinally + gotoSites + diffSites + unusualSites, 8);
		assert.ok(!format.includes(doubleCatch));
		assert.ok(!goto.includes(doubleCatch));
		assert.ok(!unusual.includes(doubleCatch));
	});

	test('FormatOnType leftover _trigger then+finally is Promise single-catch; FormatOnPaste D669 stays', () => {
		const source = fs.readFileSync(resolveSource(FORMAT_REL), 'utf8');
		const api = fs.readFileSync(resolveSource(FORMAT_API_REL), 'utf8');
		assertPromiseSignature(api, 'export function getOnTypeFormattingEdits(\n\tworkerService: IEditorWorkerService,\n\tlanguageFeaturesService: ILanguageFeaturesService,\n\tmodel: ITextModel,\n\tposition: Position,\n\tch: string,\n\toptions: FormattingOptions,\n\ttoken: CancellationToken\n): Promise<TextEdit[] | null | undefined> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `).then(edits => {
			if (cts.token.isCancellationRequested) {
				return;
			}
			if (this._editor.getModel() !== model) {
				return;
			}
			if (isNonEmptyArray(edits)) {
				this._accessibilitySignalService.playSignal(AccessibilitySignal.format, { userGesture: false });
				FormattingEdit.execute(this._editor, edits, true);
			}
		}).finally(() => {
			unbind.dispose();
		})`;
		assert.ok(source.includes(`${thenCall}.catch(onUnexpectedError);`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(doubleCatch));
		assert.ok(source.includes('this._instantiationService.invokeFunction(formatDocumentRangesWithSelectedProvider, this.editor, range, FormattingMode.Silent, Progress.None, CancellationToken.None, false).catch(onUnexpectedError);'));
	});

	test('goToDefinitionAtPosition leftover gotoDefinition catch and startFindDefinition are Promise single-catch', () => {
		const source = fs.readFileSync(resolveSource(GOTO_REL), 'utf8');
		assertPromiseSignature(source, 'private async gotoDefinition(position: Position, openToSide: boolean): Promise<unknown> {');
		assertPromiseSignature(source, 'private async startFindDefinition(position: Position): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(source.includes(`this.gotoDefinition(mouseEvent.target.position!, mouseEvent.hasSideBySideModifier)
					.catch(onUnexpectedError)
					.finally(() => {`));
		assert.ok(!source.includes('.catch((error: Error) => {'));
		assert.ok(source.includes(`this.startFindDefinition(position).catch(onUnexpectedError);`));
		assert.ok(!source.includes(`\t\tthis.startFindDefinition(position);`));
		assert.ok(!source.includes(`this.startFindDefinition(position)${doubleCatch};`));
		assert.ok(!source.includes(doubleCatch));
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)/g) ?? []).length, 2);
	});

	test('diffEditor leftover waitForDiff then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(DIFF_REL), 'utf8');
		assertPromiseSignature(source, 'async waitForDiff(): Promise<void> {');
		assert.ok(source.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		const thenCall = `this.waitForDiff().then(() => {
			if (this._diffModel.get() !== diffModel) {
				return;
			}
			const diffs = diffModel.diff.get()?.mappings;
			if (!diffs || diffs.length === 0) {
				return;
			}
			this._goTo(diffs[0]);
		})`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(!source.includes(`${thenCall}.catch(onUnexpectedError);`));
	});

	test('unusualLineTerminators leftover _checkForUnusualLineTerminators voids are Promise single-catch', () => {
		const source = fs.readFileSync(resolveSource(UNUSUAL_REL), 'utf8');
		assertPromiseSignature(source, 'private async _checkForUnusualLineTerminators(): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const call = 'this._checkForUnusualLineTerminators()';
		assert.strictEqual((source.match(/this\._checkForUnusualLineTerminators\(\)\.catch\(onUnexpectedError\)/g) ?? []).length, 4);
		assert.ok(source.includes(`${call}.catch(onUnexpectedError)`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}${doubleCatch}`));
		assert.ok(!source.includes(doubleCatch));
	});

	test('opener / D145 / two-arg then / Resolve / D703 eight / outline swallow / grpc Wire / Connect / Watch / Pty stay skipped', () => {
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const word = fs.readFileSync(resolveSource(WORD_REL), 'utf8');
		const fold = fs.readFileSync(resolveSource(FOLD_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const access = fs.readFileSync(resolveSource(ACCESS_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(MODEL_REL), 'utf8');
		const indent = fs.readFileSync(resolveSource(INDENT_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const section = fs.readFileSync(resolveSource(SECTION_REL), 'utf8');
		const unicode = fs.readFileSync(resolveSource(UNICODE_REL), 'utf8');
		assert.ok(marker.includes('}).catch(onUnexpectedError);'));
		assert.ok(!marker.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(links.includes('link.resolve(CancellationToken.None).then(uri => {'));
		assert.ok(!links.includes(doubleCatch));
		assert.ok(word.includes('.then(undefined, onUnexpectedExternalError);'));
		assert.ok(fold.includes('}).then(undefined, onUnexpectedError);'));
		assert.ok(!fold.includes('}).then(undefined, onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(outline.includes('}).catch(_err => {'));
		assert.ok(outline.includes('this._cache.delete(textModel.id);'));
		assert.ok(!outline.includes(doubleCatch));
		const hoverCall = `promise.then(() => {
			if (!editor.hasModel() || !editor.getPosition()?.equals(position)) {
				return;
			}
			controller.showContentHover(range, HoverStartMode.Immediate, HoverStartSource.Keyboard, true);
		}).catch(onUnexpectedError);`;
		assert.ok(hover.includes(hoverCall));
		assert.ok(!hover.includes(doubleCatch));
		assert.ok(access.includes(`this._model.next().then((() => this._onDidChangeContent.fire())).catch(onUnexpectedError);`));
		assert.ok(access.includes(`this._model.previous().then((() => this._onDidChangeContent.fire())).catch(onUnexpectedError);`));
		assert.ok(!access.includes(doubleCatch));
		assert.ok(model.includes(`defaultAccountService.getDefaultAccount().then(createDisposableCb(account => this.sku.set(skuFromAccount(account), undefined), this._store)).catch(onUnexpectedError);`));
		assert.ok(!model.includes(doubleCatch));
		assert.ok(indent.includes(`			})${doubleCatch};`));
		assert.ok(sticky.includes(`			})).catch(onUnexpectedError);`));
		assert.ok(!sticky.includes(doubleCatch));
		assert.ok(!section.includes(doubleCatch));
		assert.ok(unicode.includes(doubleCatch));
		for (const source of [marker, links, word, fold, outline, hover, access, model, indent, sticky, section, unicode]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!source.includes('Wire('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
