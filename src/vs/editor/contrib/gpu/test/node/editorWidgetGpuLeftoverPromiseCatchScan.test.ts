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
const WIDGET_REL = 'src/vs/editor/browser/widget/codeEditor/codeEditorWidget.ts';
const GPU_REL = 'src/vs/editor/contrib/gpu/browser/gpuActions.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const INSTANTIATION_REL = 'src/vs/platform/instantiation/common/instantiation.ts';
const MARKER_REL = 'src/vs/editor/contrib/hover/browser/markerHoverParticipant.ts';
const LINKS_REL = 'src/vs/editor/contrib/links/browser/links.ts';
const WORD_REL = 'src/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.ts';
const FOLD_REL = 'src/vs/editor/contrib/folding/browser/folding.ts';
const INLAY_CTRL_REL = 'src/vs/editor/contrib/inlayHints/browser/inlayHintsController.ts';
const GOTO_CMD_REL = 'src/vs/editor/contrib/gotoSymbol/browser/goToCommands.ts';

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

suite('editor widget/gpu leftover Promise fire-and-forget catch scan (D732)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers eight leftover Promise double-chain sites', () => {
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const gpu = fs.readFileSync(resolveSource(GPU_REL), 'utf8');
		const trigger = (widget.match(/this\._commandService\.executeCommand\(handlerId, payload\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const paste = (widget.match(/executeCommand\(editorCommon\.Handler\.Paste, payload\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const type = (widget.match(/executeCommand\(editorCommon\.Handler\.Type, payload\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const compositionType = (widget.match(/executeCommand\(editorCommon\.Handler\.CompositionType, payload\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const replacePrev = (widget.match(/executeCommand\(editorCommon\.Handler\.ReplacePreviousChar, payload\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const startComposition = (widget.match(/executeCommand\(editorCommon\.Handler\.CompositionStart, \{\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const saveAtlas = (gpu.match(/invokeFunction\(async accessor => \{\n\t\t\t\t\tconst workspaceContextService = accessor\.get\(IWorkspaceContextService\);[\s\S]*?await Promise\.all\(promises\);\n\t\t\t\t\t\}\n\t\t\t\t\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const drawGlyph = (gpu.match(/invokeFunction\(async accessor => \{\n\t\t\t\t\tconst configurationService = accessor\.get\(IConfigurationService\);[\s\S]*?await fileService\.writeFile\(resource, VSBuffer\.wrap\(new Uint8Array\(await blob\.arrayBuffer\(\)\)\)\);\n\t\t\t\t\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		assert.strictEqual(trigger + paste + type + compositionType + replacePrev + startComposition + saveAtlas + drawGlyph, 8);
	});

	test('codeEditorWidget leftover _triggerCommand executeCommand is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const call = 'this._commandService.executeCommand(handlerId, payload)';
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('codeEditorWidget leftover clipboard executeCommand FOFs are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		const paste = 'this._commandService.executeCommand(editorCommon.Handler.Paste, payload)';
		const type = 'this._commandService.executeCommand(editorCommon.Handler.Type, payload)';
		const compositionType = 'this._commandService.executeCommand(editorCommon.Handler.CompositionType, payload)';
		const replacePrev = 'this._commandService.executeCommand(editorCommon.Handler.ReplacePreviousChar, payload)';
		const startComposition = 'this._commandService.executeCommand(editorCommon.Handler.CompositionStart, {})';
		for (const call of [paste, type, compositionType, replacePrev, startComposition]) {
			assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
			assert.ok(!source.includes(`${call};`), `bare leftover remains: ${call}`);
		}
	});

	test('gpuActions leftover async invokeFunction FOFs are Promise double-chain; sync void stays skipped', () => {
		const source = fs.readFileSync(resolveSource(GPU_REL), 'utf8');
		const instantiation = fs.readFileSync(resolveSource(INSTANTIATION_REL), 'utf8');
		assert.ok(instantiation.includes('invokeFunction<R, TS extends any[] = []>(fn: (accessor: ServicesAccessor, ...args: TS) => R, ...args: TS): R;'));
		assert.ok(source.includes('instantiationService.invokeFunction(async accessor => {'));
		assertPromiseSignature(source, 'instantiationService.invokeFunction(async accessor => {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const saveClose = '\t\t\t\t}).catch(onUnexpectedError).catch(onUnexpectedError);\n\t\t\t\tbreak;\n\t\t\tcase \'drawGlyph\':';
		const drawClose = '\t\t\t\t}).catch(onUnexpectedError).catch(onUnexpectedError);\n\t\t\t\tbreak;\n\t\t}';
		assert.ok(source.includes(saveClose));
		assert.ok(source.includes(drawClose));
		assert.strictEqual((source.match(/invokeFunction\(async accessor => \{/g) ?? []).length, 2);
		assert.ok(source.includes("logService.info(['Texture atlas stats', ...stats].join('\\n\\n'));\n\t\t\t\t});"));
		assert.ok(!source.includes("logService.info(['Texture atlas stats', ...stats].join('\\n\\n'));\n\t\t\t\t}).catch(onUnexpectedError)"));
	});

	test('opener / Resolve / two-arg then / Action2.run / assigned Action.run / CompositionEnd / Cut / Connect / Watch / Pty stay skipped', () => {
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const gpu = fs.readFileSync(resolveSource(GPU_REL), 'utf8');
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const word = fs.readFileSync(resolveSource(WORD_REL), 'utf8');
		const fold = fs.readFileSync(resolveSource(FOLD_REL), 'utf8');
		const inlay = fs.readFileSync(resolveSource(INLAY_CTRL_REL), 'utf8');
		const gotoCmd = fs.readFileSync(resolveSource(GOTO_CMD_REL), 'utf8');
		assert.ok(marker.includes('this._openerService.open(resource, {'));
		assert.ok(marker.includes('}).catch(onUnexpectedError);'));
		assert.ok(!marker.includes('}).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(links.includes('link.resolve(CancellationToken.None).then(uri => {'));
		assert.ok(!links.includes(doubleCatch));
		assert.ok(word.includes('.then(undefined, onUnexpectedExternalError);'));
		assert.ok(fold.includes('}).then(undefined, onUnexpectedError);'));
		assert.ok(!fold.includes('}).then(undefined, onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(inlay.includes('labelPart.item.resolve(cts.token);'));
		assert.ok(!inlay.includes('labelPart.item.resolve(cts.token).catch(onUnexpectedError)'));
		assert.ok(widget.includes('Promise.resolve(action.run(payload)).then(undefined, onUnexpectedError);'));
		assert.ok(!widget.includes('Promise.resolve(action.run(payload)).then(undefined, onUnexpectedError).catch(onUnexpectedError)'));
		assert.ok(widget.includes('Promise.resolve(command.runEditorCommand(accessor, this, payload)).then(undefined, onUnexpectedError);'));
		assert.ok(widget.includes("this._commandService.executeCommand('editor.action.startFindReplaceAction');"));
		assert.ok(!widget.includes("this._commandService.executeCommand('editor.action.startFindReplaceAction').catch(onUnexpectedError)"));
		assert.ok(widget.includes('this._commandService.executeCommand(editorCommon.Handler.CompositionEnd, {});'));
		assert.ok(!widget.includes('this._commandService.executeCommand(editorCommon.Handler.CompositionEnd, {}).catch(onUnexpectedError)'));
		assert.ok(widget.includes('this._commandService.executeCommand(editorCommon.Handler.Cut, {});'));
		assert.ok(!widget.includes('this._commandService.executeCommand(editorCommon.Handler.Cut, {}).catch(onUnexpectedError)'));
		assert.ok(gotoCmd.includes('accessor.get(IInstantiationService).invokeFunction(command.run.bind(command), editor);'));
		assert.ok(!gotoCmd.includes('accessor.get(IInstantiationService).invokeFunction(command.run.bind(command), editor).catch(onUnexpectedError)'));
		for (const source of [widget, gpu, marker, links, word, fold, inlay, gotoCmd]) {
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
