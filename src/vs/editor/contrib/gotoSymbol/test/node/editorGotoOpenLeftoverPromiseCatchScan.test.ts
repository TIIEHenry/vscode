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
const STICKY_REL = 'src/vs/editor/contrib/stickyScroll/browser/stickyScrollController.ts';
const INLAY_LOC_REL = 'src/vs/editor/contrib/inlayHints/browser/inlayHintsLocations.ts';
const CONTROLLER_REL = 'src/vs/editor/contrib/codeAction/browser/codeActionController.ts';
const GOTO_CMD_REL = 'src/vs/editor/contrib/gotoSymbol/browser/goToCommands.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const REFS_REL = 'src/vs/editor/contrib/gotoSymbol/browser/peek/referencesController.ts';
const EDITOR_SVC_REL = 'src/vs/editor/browser/services/codeEditorService.ts';
const GOTO_ERR_REL = 'src/vs/editor/contrib/gotoError/browser/gotoError.ts';
const MARKER_REL = 'src/vs/editor/contrib/hover/browser/markerHoverParticipant.ts';
const LINKS_REL = 'src/vs/editor/contrib/links/browser/links.ts';
const WORD_REL = 'src/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.ts';
const FOLD_REL = 'src/vs/editor/contrib/folding/browser/folding.ts';
const INLAY_CTRL_REL = 'src/vs/editor/contrib/inlayHints/browser/inlayHintsController.ts';
const GPU_REL = 'src/vs/editor/contrib/gpu/browser/gpuActions.ts';
const WIDGET_REL = 'src/vs/editor/browser/widget/codeEditor/codeEditorWidget.ts';

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

suite('editor goto/open leftover Promise fire-and-forget catch scan (D725)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers six leftover Promise double-chain sites', () => {
		const sticky = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const controller = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		const gotoCmd = fs.readFileSync(resolveSource(GOTO_CMD_REL), 'utf8');
		const refs = fs.readFileSync(resolveSource(REFS_REL), 'utf8');
		const gotoErr = fs.readFileSync(resolveSource(GOTO_ERR_REL), 'utf8');
		const stickyGoto = (sticky.match(/goToDefinitionWithLocation, e, this\._editor, \{ uri: this\._editor\.getModel\(\)\.uri, range: this\._stickyRangeProjectedOnEditor \}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const showList = (controller.match(/this\.showCodeActionList\(actions, this\.toCoords\(newState\.position\), \{ includeDisabledActions, fromLightbulb: false \}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const altAction = (gotoCmd.match(/altAction\.runEditorCommand\(accessor, editor, arg, range\)\.finally\(\(\) => \{\n\t\t\t\t\tSymbolNavigationAction\._activeAlternativeCommands\.delete\(this\.desc\.id\);\n\t\t\t\t\}\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const peek = (gotoCmd.match(/executeCommand\('editor\.action\.goToLocations', resource, position, references, multiple, undefined, true\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const openRef = (refs.match(/\}, this\._editor, sideBySide\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const related = (gotoErr.match(/\}, this\._editor\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		assert.strictEqual(stickyGoto + showList + altAction + peek + openRef + related, 6);
	});

	test('stickyScroll leftover goToDefinitionWithLocation FOF is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(STICKY_REL), 'utf8');
		const loc = fs.readFileSync(resolveSource(INLAY_LOC_REL), 'utf8');
		assertPromiseSignature(loc, 'export async function goToDefinitionWithLocation(accessor: ServicesAccessor, event: ClickLinkMouseEvent, editor: IActiveCodeEditor, location: Location) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const call = 'this._instaService.invokeFunction(goToDefinitionWithLocation, e, this._editor, { uri: this._editor.getModel().uri, range: this._stickyRangeProjectedOnEditor })';
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('codeAction leftover showCodeActionList FOF is Promise double-chain; awaited sites stay awaited', () => {
		const source = fs.readFileSync(resolveSource(CONTROLLER_REL), 'utf8');
		assertPromiseSignature(source, 'public async showCodeActionList(actions: CodeActionSet, at: IAnchor | IPosition, options: IActionShowOptions): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const call = 'this.showCodeActionList(actions, this.toCoords(newState.position), { includeDisabledActions, fromLightbulb: false })';
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(source.includes('await this.showCodeActionList(actions, at, { includeDisabledActions: false, fromLightbulb: true });'));
		assert.ok(source.includes('return this.showCodeActionList(actions, at, { includeDisabledActions: false, fromLightbulb: false });'));
	});

	test('gotoSymbol leftover altAction runEditorCommand and peekLocations executeCommand are Promise double-chain; Action2.run bind stays skipped', () => {
		const source = fs.readFileSync(resolveSource(GOTO_CMD_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(source, 'override runEditorCommand(accessor: ServicesAccessor, editor: ICodeEditor, arg?: SymbolNavigationAnchor | unknown, range?: Range): Promise<void> {');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const altCall = `instaService.invokeFunction((accessor) => altAction.runEditorCommand(accessor, editor, arg, range).finally(() => {
					SymbolNavigationAction._activeAlternativeCommands.delete(this.desc.id);
				}))`;
		assert.ok(source.includes(`${altCall}${doubleCatch};`));
		assert.ok(!source.includes(`${altCall};`));
		const peekCall = "accessor.get(ICommandService).executeCommand('editor.action.goToLocations', resource, position, references, multiple, undefined, true)";
		assert.ok(source.includes(`${peekCall}${doubleCatch};`));
		assert.ok(!source.includes(`${peekCall};`));
		assert.ok(source.includes('accessor.get(IInstantiationService).invokeFunction(command.run.bind(command), editor);'));
		assert.ok(!source.includes('accessor.get(IInstantiationService).invokeFunction(command.run.bind(command), editor).catch(onUnexpectedError)'));
	});

	test('references leftover openReference openCodeEditor is Promise double-chain; two-arg _gotoReference stays skipped', () => {
		const source = fs.readFileSync(resolveSource(REFS_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		assertPromiseSignature(editorSvc, 'openCodeEditor(input: ITextResourceEditorInput, source: ICodeEditor | null, sideBySide?: boolean): Promise<ICodeEditor | null>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		const thenCall = `this._editorService.openCodeEditor({
			resource: uri,
			options: { selection: range, selectionSource: TextEditorSelectionSource.JUMP, pinned }
		}, this._editor, sideBySide)`;
		assert.ok(source.includes(`${thenCall}${doubleCatch};`));
		assert.ok(!source.includes(`${thenCall};`));
		assert.ok(source.includes('}, (err) => {\n\t\t\tthis._ignoreModelChangeEvent = false;\n\t\t\tonUnexpectedError(err);\n\t\t});'));
		assert.ok(!source.includes('}, (err) => {\n\t\t\tthis._ignoreModelChangeEvent = false;\n\t\t\tonUnexpectedError(err);\n\t\t}).catch(onUnexpectedError)'));
	});

	test('gotoError leftover related openCodeEditor is Promise double-chain; awaited navigate stays awaited', () => {
		const source = fs.readFileSync(resolveSource(GOTO_ERR_REL), 'utf8');
		const editorSvc = fs.readFileSync(resolveSource(EDITOR_SVC_REL), 'utf8');
		assertPromiseSignature(editorSvc, 'openCodeEditor(input: ITextResourceEditorInput, source: ICodeEditor | null, sideBySide?: boolean): Promise<ICodeEditor | null>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const call = `this._editorService.openCodeEditor({
				resource: related.resource,
				options: { pinned: true, revealIfOpened: true, selection: Range.lift(related).collapseToStart() }
			}, this._editor)`;
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(source.includes('const otherEditor = await this._editorService.openCodeEditor({'));
	});

	test('opener / Resolve / two-arg then / Action2.run / gpu sync void / widget Action.run / Connect / Watch / Pty stay skipped', () => {
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const word = fs.readFileSync(resolveSource(WORD_REL), 'utf8');
		const fold = fs.readFileSync(resolveSource(FOLD_REL), 'utf8');
		const inlay = fs.readFileSync(resolveSource(INLAY_CTRL_REL), 'utf8');
		const gpu = fs.readFileSync(resolveSource(GPU_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const gotoCmd = fs.readFileSync(resolveSource(GOTO_CMD_REL), 'utf8');
		assert.ok(marker.includes('this._openerService.open(resource, {'));
		assert.ok(marker.includes('}).catch(onUnexpectedError);'));
		assert.ok(!marker.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(marker.includes('this._openerService.open(code.target);'));
		assert.ok(links.includes('link.resolve(CancellationToken.None).then(uri => {'));
		assert.ok(!links.includes(doubleCatch));
		assert.ok(word.includes('.then(undefined, onUnexpectedExternalError);'));
		assert.ok(fold.includes('}).then(undefined, onUnexpectedError);'));
		assert.ok(!fold.includes('}).then(undefined, onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(inlay.includes('labelPart.item.resolve(cts.token);'));
		assert.ok(!inlay.includes('labelPart.item.resolve(cts.token).catch(onUnexpectedError)'));
		assert.ok(gpu.includes('instantiationService.invokeFunction(accessor => {'));
		assert.ok(gpu.includes("logService.info(['Texture atlas stats', ...stats].join('\\n\\n'));\n\t\t\t\t});"));
		assert.ok(!gpu.includes("logService.info(['Texture atlas stats', ...stats].join('\\n\\n'));\n\t\t\t\t}).catch(onUnexpectedError)"));
		assert.ok(widget.includes('Promise.resolve(action.run(payload)).then(undefined, onUnexpectedError);'));
		assert.ok(!widget.includes('Promise.resolve(action.run(payload)).then(undefined, onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(widget.includes("this._commandService.executeCommand('editor.action.startFindReplaceAction');"));
		assert.ok(!widget.includes("this._commandService.executeCommand('editor.action.startFindReplaceAction').catch(onUnexpectedError)"));
		assert.ok(gotoCmd.includes('accessor.get(IInstantiationService).invokeFunction(command.run.bind(command), editor);'));
		for (const source of [marker, links, word, fold, inlay, gpu, widget, gotoCmd]) {
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
