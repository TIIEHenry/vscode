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
const CONTROLLER_REL = 'src/vs/editor/contrib/codeAction/browser/codeActionController.ts';
const MARKER_REL = 'src/vs/editor/contrib/hover/browser/markerHoverParticipant.ts';
const COLOR_UTILS_REL = 'src/vs/editor/contrib/colorPicker/browser/colorPickerParticipantUtils.ts';
const HOVER_COLOR_REL = 'src/vs/editor/contrib/colorPicker/browser/hoverColorPicker/hoverColorPickerParticipant.ts';
const STANDALONE_COLOR_REL = 'src/vs/editor/contrib/colorPicker/browser/standaloneColorPicker/standaloneColorPickerParticipant.ts';
const INLAY_CTRL_REL = 'src/vs/editor/contrib/inlayHints/browser/inlayHintsController.ts';
const INLAY_LOC_REL = 'src/vs/editor/contrib/inlayHints/browser/inlayHintsLocations.ts';
const LINKS_REL = 'src/vs/editor/contrib/links/browser/links.ts';
const WORD_REL = 'src/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.ts';
const FOLD_REL = 'src/vs/editor/contrib/folding/browser/folding.ts';
const HOVER_REL = 'src/vs/editor/contrib/hover/browser/hoverActions.ts';
const FORMAT_REL = 'src/vs/editor/contrib/format/browser/formatActions.ts';
const GOTO_REL = 'src/vs/editor/contrib/gotoSymbol/browser/link/goToDefinitionAtPosition.ts';
const STICKY_REL = 'src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts';

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

suite('editor apply/color/inlay leftover Promise fire-and-forget catch scan (D718)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers seven leftover Promise double-chain sites', () => {
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const hoverColor = fs.readFileSync(resolveSource(HOVER_COLOR_REL), 'utf8');
		const standalone = fs.readFileSync(resolveSource(STANDALONE_COLOR_REL), 'utf8');
		const inlay = fs.readFileSync(resolveSource(INLAY_CTRL_REL), 'utf8');
		const lightbulb = (controller.match(/this\.showCodeActionsFromLightbulb\(e\.actions, e\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const applyOnSelect = (controller.match(/this\.applyCodeAction\(action, \/\* retrigger \*\/ true, !!preview, options\.fromLightbulb \? ApplyCodeActionReason\.FromAILightbulb : ApplyCodeActionReason\.FromCodeActions\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const applyHover = (marker.match(/controller\?\.applyCodeAction\(aiCodeAction, false, false, ApplyCodeActionReason\.FromProblemsHover\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const hoverPresentations = (hoverColor.match(/updateColorPresentations\(editorModel, model, color, range, colorHover\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const standalonePresentations = (standalone.match(/updateColorPresentations\([\s\S]*?\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const goto = (inlay.match(/goToDefinitionWithLocation, e, this\._editor as IActiveCodeEditor, part\.location\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		assert.strictEqual(lightbulb + applyOnSelect + applyHover + hoverPresentations + standalonePresentations + goto, 7);
	});

	test('codeAction leftover lightbulb onClick and list onSelect applyCodeAction are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		assertPromiseSignature(source, 'private async showCodeActionsFromLightbulb(actions: CodeActionSet, at: IAnchor | IPosition): Promise<void> {');
		assertPromiseSignature(source, 'async applyCodeAction(action: CodeActionItem, retrigger: boolean, preview: boolean, actionReason: ApplyCodeActionReason): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`this.showCodeActionsFromLightbulb(e.actions, e)${doubleCatch}`));
		assert.ok(!source.includes('this.showCodeActionsFromLightbulb(e.actions, e));'));
		assert.ok(source.includes(`this.applyCodeAction(action, /* retrigger */ true, !!preview, options.fromLightbulb ? ApplyCodeActionReason.FromAILightbulb : ApplyCodeActionReason.FromCodeActions)${doubleCatch};`));
		assert.ok(!source.includes('this.applyCodeAction(action, /* retrigger */ true, !!preview, options.fromLightbulb ? ApplyCodeActionReason.FromAILightbulb : ApplyCodeActionReason.FromCodeActions);'));
		assert.ok(source.includes('await this.applyCodeAction(actionItem, false, false, ApplyCodeActionReason.FromAILightbulb);'));
		assert.ok(source.includes('await this.applyCodeAction(validActionToApply, false, false, ApplyCodeActionReason.FromCodeActions);'));
	});

	test('markerHover leftover applyCodeAction is Promise double-chain; opener / two-arg then stay skipped', () => {
		const source = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		assertPromiseSignature(controller, 'async applyCodeAction(action: CodeActionItem, retrigger: boolean, preview: boolean, actionReason: ApplyCodeActionReason): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`controller?.applyCodeAction(aiCodeAction, false, false, ApplyCodeActionReason.FromProblemsHover)${doubleCatch};`));
		assert.ok(!source.includes('controller?.applyCodeAction(aiCodeAction, false, false, ApplyCodeActionReason.FromProblemsHover);'));
		assert.ok(source.includes('this._openerService.open(resource, {'));
		assert.ok(source.includes(`}).catch(onUnexpectedError);
					}`));
		assert.ok(!source.includes('this._openerService.open(resource, {\n\t\t\t\t\t\t\tfromUserGesture: true,\n\t\t\t\t\t\t\teditorOptions\n\t\t\t\t\t\t}).catch(onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(source.includes('}, onUnexpectedError);'));
		assert.ok(!source.includes('}, onUnexpectedError).catch(onUnexpectedError)'));
	});

	test('colorPicker leftover updateColorPresentations FOFs are Promise double-chain; awaited sites stay awaited', () => {
		const utils = fs.readFileSync(resolveSource(COLOR_UTILS_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_COLOR_REL), 'utf8');
		const standalone = fs.readFileSync(resolveSource(STANDALONE_COLOR_REL), 'utf8');
		assertPromiseSignature(utils, 'export async function updateColorPresentations(editorModel: ITextModel, colorPickerModel: ColorPickerModel, color: Color, range: Range, colorHover: BaseColor): Promise<void> {');
		assert.ok(hover.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(standalone.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(hover.includes(`updateColorPresentations(editorModel, model, color, range, colorHover)${doubleCatch};`));
		assert.ok(hover.includes('await updateColorPresentations(editorModel, model, color, range, colorHover);'));
		assert.ok(!hover.includes('\t\t\tupdateColorPresentations(editorModel, model, color, range, colorHover);\n'));
		assert.ok(standalone.includes(`updateColorPresentations(editorModel, colorPickerModel, color, colorHover.range, colorHover)${doubleCatch};`));
		assert.ok(standalone.includes(`updateColorPresentations(editorModel, colorPickerModel, this.color, colorHover.range, colorHover)${doubleCatch};`));
		assert.ok(standalone.includes('await updateColorPresentations(this._editor.getModel(), colorPickerModel, this._color, range, colorHoverData);'));
		assert.ok(!standalone.includes('updateColorPresentations(editorModel, colorPickerModel, color, colorHover.range, colorHover);'));
		assert.ok(!standalone.includes('updateColorPresentations(editorModel, colorPickerModel, this.color, colorHover.range, colorHover);'));
	});

	test('inlayHints leftover goToDefinitionWithLocation FOF is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(INLAY_CTRL_REL), 'utf8');
		const loc = fs.readFileSync(resolveSource(INLAY_LOC_REL), 'utf8');
		assertPromiseSignature(loc, 'export async function goToDefinitionWithLocation(accessor: ServicesAccessor, event: ClickLinkMouseEvent, editor: IActiveCodeEditor, location: Location) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor as IActiveCodeEditor, part.location)${doubleCatch};`));
		assert.ok(!source.includes('this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor as IActiveCodeEditor, part.location);'));
	});

	test('opener / D145 / two-arg then / Resolve / D703 / D709 / Connect / Watch / Pty stay skipped', () => {
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const word = fs.readFileSync(resolveSource(WORD_REL), 'utf8');
		const fold = fs.readFileSync(resolveSource(FOLD_REL), 'utf8');
		const hover = fs.readFileSync(resolveSource(HOVER_REL), 'utf8');
		const format = fs.readFileSync(resolveSource(FORMAT_REL), 'utf8');
		const goto = fs.readFileSync(resolveSource(GOTO_REL), 'utf8');
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const inlay = fs.readFileSync(resolveSource(INLAY_CTRL_REL), 'utf8');
		assert.ok(marker.includes('this._openerService.open(resource, {'));
		assert.ok(marker.includes('}).catch(onUnexpectedError);'));
		assert.ok(links.includes('link.resolve(CancellationToken.None).then(uri => {'));
		assert.ok(!links.includes(doubleCatch));
		assert.ok(word.includes('.then(undefined, onUnexpectedExternalError);'));
		assert.ok(fold.includes('}).then(undefined, onUnexpectedError);'));
		assert.ok(!fold.includes('}).then(undefined, onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(hover.includes(`promise.then(() => {
			controller.showContentHover(range, HoverStartMode.Immediate, HoverStartSource.Keyboard, true);
		})${doubleCatch};`));
		assert.ok(format.includes('}).finally(() => {\n\t\t\tunbind.dispose();\n\t\t}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(goto.includes(`this.startFindDefinition(position)${doubleCatch};`));
		assert.ok(sticky.includes(`this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor, { uri: this._editor.getModel().uri, range: this._stickyRangeProjectedOnEditor })${doubleCatch};`));
		assert.ok(controller.includes(`this.showCodeActionList(actions, this.toCoords(newState.position), { includeDisabledActions, fromLightbulb: false })${doubleCatch};`));
		assert.ok(inlay.includes('labelPart.item.resolve(cts.token);'));
		assert.ok(!inlay.includes('labelPart.item.resolve(cts.token).catch(onUnexpectedError)'));
		for (const source of [marker, links, word, fold, hover, format, goto, sticky, controller, inlay]) {
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
