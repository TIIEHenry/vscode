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
const SUGGEST_REL = 'src/vs/editor/contrib/suggest/browser/suggestController.ts';
const CODELENS_REL = 'src/vs/editor/contrib/codelens/browser/codelensController.ts';
const COMMANDS_REL = 'src/vs/platform/commands/common/commands.ts';
const NOTIFY_REL = 'src/vs/platform/notification/common/notification.ts';
const GPU_REL = 'src/vs/editor/contrib/gpu/browser/gpuActions.ts';
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

suite('editor leftover Promise fire-and-forget catch scan (D738)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('this knife covers four leftover Promise double-chain sites', () => {
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const codelens = fs.readFileSync(resolveSource(CODELENS_REL), 'utf8');
		const compositionEnd = (widget.match(/executeCommand\(editorCommon\.Handler\.CompositionEnd, \{\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const cut = (widget.match(/executeCommand\(editorCommon\.Handler\.Cut, \{\}\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const fallback = (suggest.match(/executeCommand\(arg\.fallback\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		const notifyThenDouble = (codelens.match(/\.catch\(err => this\._notificationService\.error\(err\)\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
		assert.strictEqual(compositionEnd + cut + fallback + notifyThenDouble, 4);
	});

	test('codeEditorWidget leftover CompositionEnd / Cut executeCommand FOFs are Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const compositionEnd = 'this._commandService.executeCommand(editorCommon.Handler.CompositionEnd, {})';
		const cut = 'this._commandService.executeCommand(editorCommon.Handler.Cut, {})';
		for (const call of [compositionEnd, cut]) {
			assert.ok(source.includes(`${call}${doubleCatch};`), `missing double-chain: ${call}`);
			assert.ok(!source.includes(`${call};`), `bare leftover remains: ${call}`);
			assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`), `single-chain remains: ${call}`);
		}
	});

	test('suggest leftover executeCommand(arg.fallback) is Promise double-chain; Promise.all().finally stays skipped', () => {
		const source = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(source.includes("import { onUnexpectedError, onUnexpectedExternalError } from '../../../../base/common/errors.js';"));
		const call = 'this._commandService.executeCommand(arg.fallback)';
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('Promise.all(tasks).finally(() => {'));
		assert.ok(!/Promise\.all\(tasks\)\.finally\(\(\) => \{[\s\S]*?\}\)\.catch\(onUnexpectedError\)/.test(source));
	});

	test('codelens leftover executeCommand keeps notification then is Promise double-chain', () => {
		const source = fs.readFileSync(resolveSource(CODELENS_REL), 'utf8');
		const commands = fs.readFileSync(resolveSource(COMMANDS_REL), 'utf8');
		const notify = fs.readFileSync(resolveSource(NOTIFY_REL), 'utf8');
		assertPromiseSignature(commands, 'executeCommand<R = unknown>(commandId: string, ...args: unknown[]): Promise<R | undefined>;');
		assert.ok(notify.includes('error(message: NotificationMessage | NotificationMessage[]): void;'));
		assert.ok(source.includes("import { onUnexpectedError, onUnexpectedExternalError } from '../../../../base/common/errors.js';"));
		const call = 'this._commandService.executeCommand(command.id, ...(command.arguments || []))';
		const notifyCatch = '.catch(err => this._notificationService.error(err))';
		assert.ok(source.includes(`${call}${notifyCatch}${doubleCatch};`));
		assert.ok(!source.includes(`${call}${notifyCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(source.includes('await commandService.executeCommand(command.id, ...(command.arguments || []));'));
	});

	test('opener / Resolve / two-arg then / Action2.run / assigned Action.run / gpu sync void / Promise.all().finally / Connect / Watch / Pty stay skipped', () => {
		const widget = fs.readFileSync(resolveSource(WIDGET_REL), 'utf8');
		const gpu = fs.readFileSync(resolveSource(GPU_REL), 'utf8');
		const marker = fs.readFileSync(resolveSource(MARKER_REL), 'utf8');
		const links = fs.readFileSync(resolveSource(LINKS_REL), 'utf8');
		const word = fs.readFileSync(resolveSource(WORD_REL), 'utf8');
		const fold = fs.readFileSync(resolveSource(FOLD_REL), 'utf8');
		const inlay = fs.readFileSync(resolveSource(INLAY_CTRL_REL), 'utf8');
		const gotoCmd = fs.readFileSync(resolveSource(GOTO_CMD_REL), 'utf8');
		const suggest = fs.readFileSync(resolveSource(SUGGEST_REL), 'utf8');
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
		assert.ok(widget.includes("this._commandService.executeCommand('workbench.action.openSettings2', {"));
		assert.ok(widget.includes("query: 'editor.multiCursorLimit'\n\t\t\t\t\t\t\t\t\t});"));
		assert.ok(!widget.includes("query: 'editor.multiCursorLimit'\n\t\t\t\t\t\t\t\t\t}).catch(onUnexpectedError)"));
		assert.ok(gpu.includes('instantiationService.invokeFunction(accessor => {'));
		assert.ok(gpu.includes("logService.info(['Texture atlas stats', ...stats].join('\\n\\n'));\n\t\t\t\t});"));
		assert.ok(!gpu.includes("logService.info(['Texture atlas stats', ...stats].join('\\n\\n'));\n\t\t\t\t}).catch(onUnexpectedError)"));
		assert.ok(gotoCmd.includes('accessor.get(IInstantiationService).invokeFunction(command.run.bind(command), editor);'));
		assert.ok(!gotoCmd.includes('accessor.get(IInstantiationService).invokeFunction(command.run.bind(command), editor).catch(onUnexpectedError)'));
		assert.ok(suggest.includes('Promise.all(tasks).finally(() => {'));
		assert.ok(!/Promise\.all\(tasks\)\.finally\(\(\) => \{[\s\S]*?\}\)\.catch\(onUnexpectedError\)/.test(suggest));
		for (const source of [widget, gpu, marker, links, word, fold, inlay, gotoCmd, suggest]) {
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
