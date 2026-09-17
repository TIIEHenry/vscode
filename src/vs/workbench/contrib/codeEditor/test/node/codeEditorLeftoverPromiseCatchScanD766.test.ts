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
const CONFIG_REL = 'src/vs/platform/configuration/common/configuration.ts';
const ASYNC_REL = 'src/vs/base/common/async.ts';
const TEXT_CONFIG_REL = 'src/vs/editor/common/services/textResourceConfiguration.ts';
const OUTLINE_API_REL = 'src/vs/workbench/services/outline/browser/outline.ts';
const EDITOR_SERVICE_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const OPENER_REL = 'src/vs/platform/opener/common/opener.ts';
const LANG_REL = 'src/vs/workbench/contrib/codeEditor/common/languageConfigurationExtensionPoint.ts';
const OUTLINE_REL = 'src/vs/workbench/contrib/codeEditor/browser/outline/documentSymbolsOutline.ts';
const SAVE_REL = 'src/vs/workbench/contrib/codeEditor/browser/saveParticipants.ts';
const HINT_REL = 'src/vs/workbench/contrib/codeEditor/browser/emptyTextEditorHint/emptyTextEditorHint.ts';
const DIFF_REL = 'src/vs/workbench/contrib/codeEditor/browser/diffEditorHelper.ts';
const DISPLAY_REL = 'src/vs/workbench/contrib/codeEditor/electron-browser/displayChangeRemeasureFonts.ts';
const FIND_REL = 'src/vs/workbench/contrib/codeEditor/browser/find/simpleFindWidget.ts';
const GOTO_SYMBOL_REL = 'src/vs/workbench/contrib/codeEditor/browser/quickaccess/gotoSymbolQuickAccess.ts';
const GOTO_LINE_REL = 'src/vs/workbench/contrib/codeEditor/browser/quickaccess/gotoLineQuickAccess.ts';
const LARGE_REL = 'src/vs/workbench/contrib/codeEditor/browser/largeFileOptimizations.ts';
const INSPECT_TOKENS_REL = 'src/vs/workbench/contrib/codeEditor/browser/inspectEditorTokens/inspectEditorTokens.ts';
const INSPECT_KEYS_REL = 'src/vs/workbench/contrib/codeEditor/browser/inspectKeybindings.ts';
const ACCESS_REL = 'src/vs/workbench/contrib/codeEditor/browser/accessibility/accessibility.ts';
const DICTATION_REL = 'src/vs/workbench/contrib/codeEditor/browser/dictation/editorDictation.ts';
const DEBUG_TM_REL = 'src/vs/workbench/contrib/codeEditor/electron-browser/startDebugTextMate.ts';

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
	assert.ok(signature.includes('Promise<') || signature.includes('async ') || signature.includes('PromiseLike'));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${doubleCatch}`), `missing double-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

function countWrapped(source: string, call: string): number {
	return (source.match(new RegExp(`${call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}${doubleCatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')) ?? []).length;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

const createOutlineCall = 'this._createOutline()';
const createOutlineEvent = 'this._createOutline(event)';
const createOutlineFinally = 'this._createOutline().finally(() => firstLoadBarrier.open())';
const loadModeCall = 'this._loadConfigurationsForMode(languageId)';
const triggerCall = 'this.triggerCodeActionsCommand()';
const hintUpdate = 'this.configurationService.updateValue(emptyTextEditorHintSetting, \'hidden\')';
const hintLanguage = 'languageOnClickOrTap(event.browserEvent)';
const diffWhitespace = 'this._textResourceConfigurationService.updateValue(this._diffEditor.getModel()!.modified.uri, \'diffEditor.ignoreTrimWhitespace\', false)';
const diffTimeout = 'this._textResourceConfigurationService.updateValue(this._diffEditor.getModel()!.modified.uri, \'diffEditor.maxComputationTime\', 0)';
const displayTrigger = `this._delayer.trigger(() => {
				FontMeasurements.clearAllFontInfos();
				return Promise.resolve();
			})`;
const findTrigger = 'this._updateHistoryDelayer.trigger(this._updateHistory.bind(this))';
const revealLike = 'void Promise.resolve(outline.reveal(element.element, {}, false, false))';

const d766Calls: Array<[string, string, number]> = [
	[OUTLINE_REL, createOutlineCall, 3],
	[OUTLINE_REL, createOutlineEvent, 1],
	[OUTLINE_REL, createOutlineFinally, 1],
	[LANG_REL, loadModeCall, 1],
	[SAVE_REL, triggerCall, 2],
	[HINT_REL, hintUpdate, 1],
	[HINT_REL, hintLanguage, 1],
	[DIFF_REL, diffWhitespace, 1],
	[DIFF_REL, diffTimeout, 1],
	[DISPLAY_REL, displayTrigger, 1],
	[FIND_REL, findTrigger, 1],
	[GOTO_SYMBOL_REL, revealLike, 1],
];

suite('codeEditor leftover remaining Promise fire-and-forget catch scan (D766)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers fifteen leftover Promise double-chain sites', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d766Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countWrapped(source, call);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 15);
		assert.ok(sites >= 4);
	});

	test('leftover _createOutline / _loadConfigurationsForMode / triggerCodeActionsCommand fire-and-forgets are Promise double-chain', () => {
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const lang = fs.readFileSync(resolveSource(LANG_REL), 'utf8');
		const save = fs.readFileSync(resolveSource(SAVE_REL), 'utf8');
		assertPromiseSignature(outline, 'private async _createOutline(contentChangeEvent?: IModelContentChangedEvent): Promise<void> {');
		assertPromiseSignature(lang, 'private async _loadConfigurationsForMode(languageId: string): Promise<void> {');
		assertPromiseSignature(save, 'private async triggerCodeActionsCommand() {');
		assert.ok(outline.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(lang.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(save.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual(countWrapped(outline, createOutlineCall), 3);
		assert.strictEqual(countWrapped(outline, createOutlineEvent), 1);
		assert.strictEqual(countWrapped(outline, createOutlineFinally), 1);
		assert.strictEqual(countDoubleChains(outline), 5);
		assert.ok(lang.includes(`${loadModeCall}${doubleCatch};`));
		assert.ok(lang.includes('this._loadConfigurationsForMode(languageIdentifier);'));
		assert.ok(!lang.includes(`this._loadConfigurationsForMode(languageIdentifier)${doubleCatch}`));
		assert.strictEqual(countWrapped(save, triggerCall), 2);
		assert.ok(!save.includes('this.triggerCodeActionsCommand();'));
	});

	test('leftover updateValue / languageOnClick / delayer / PromiseLike reveal fire-and-forgets are Promise double-chain', () => {
		const hint = fs.readFileSync(resolveSource(HINT_REL), 'utf8');
		const diff = fs.readFileSync(resolveSource(DIFF_REL), 'utf8');
		const display = fs.readFileSync(resolveSource(DISPLAY_REL), 'utf8');
		const find = fs.readFileSync(resolveSource(FIND_REL), 'utf8');
		const gotoSymbol = fs.readFileSync(resolveSource(GOTO_SYMBOL_REL), 'utf8');
		const config = fs.readFileSync(resolveSource(CONFIG_REL), 'utf8');
		const textConfig = fs.readFileSync(resolveSource(TEXT_CONFIG_REL), 'utf8');
		const asyncSource = fs.readFileSync(resolveSource(ASYNC_REL), 'utf8');
		const outlineApi = fs.readFileSync(resolveSource(OUTLINE_API_REL), 'utf8');
		assertPromiseSignature(config, 'updateValue(key: string, value: unknown): Promise<void>;');
		assertPromiseSignature(textConfig, 'updateValue(resource: URI | undefined, key: string, value: unknown, configurationTarget?: ConfigurationTarget): Promise<void>;');
		assertPromiseSignature(asyncSource, 'trigger(task: ITask<T | Promise<T>>, delay = this.defaultDelay): Promise<T> {');
		assert.ok(outlineApi.includes('reveal(entry: E, options: IEditorOptions, sideBySide: boolean, select: boolean): Promise<void> | void;'));
		assert.ok(hint.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(diff.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(display.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(find.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(gotoSymbol.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.ok(hint.includes(`${hintUpdate}${doubleCatch};`));
		assert.ok(hint.includes(`${hintLanguage}${doubleCatch};`));
		assert.ok(diff.includes(`${diffWhitespace}${doubleCatch};`));
		assert.ok(diff.includes(`${diffTimeout}${doubleCatch};`));
		assert.ok(display.includes(`${displayTrigger}${doubleCatch};`));
		assert.ok(find.includes(`${findTrigger}${doubleCatch};`));
		assert.ok(gotoSymbol.includes(`${revealLike}${doubleCatch}`));
		assert.strictEqual(countDoubleChains(hint), 2);
		assert.strictEqual(countDoubleChains(diff), 2);
		assert.strictEqual(countDoubleChains(display), 1);
		assert.strictEqual(countDoubleChains(find), 1);
	});

	test('opener / D145 / Action2.run / assigned then / two-arg then / returned Promise / already-double stay skipped', () => {
		const lang = fs.readFileSync(resolveSource(LANG_REL), 'utf8');
		const outline = fs.readFileSync(resolveSource(OUTLINE_REL), 'utf8');
		const gotoSymbol = fs.readFileSync(resolveSource(GOTO_SYMBOL_REL), 'utf8');
		const gotoLine = fs.readFileSync(resolveSource(GOTO_LINE_REL), 'utf8');
		const large = fs.readFileSync(resolveSource(LARGE_REL), 'utf8');
		const inspectTokens = fs.readFileSync(resolveSource(INSPECT_TOKENS_REL), 'utf8');
		const inspectKeys = fs.readFileSync(resolveSource(INSPECT_KEYS_REL), 'utf8');
		const access = fs.readFileSync(resolveSource(ACCESS_REL), 'utf8');
		const dictation = fs.readFileSync(resolveSource(DICTATION_REL), 'utf8');
		const debugTm = fs.readFileSync(resolveSource(DEBUG_TM_REL), 'utf8');
		const editorService = fs.readFileSync(resolveSource(EDITOR_SERVICE_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(editorService, 'openEditor(editor: IUntypedEditorInput, group?: PreferredGroup): Promise<IEditorPane | undefined>;');
		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');

		assert.ok(lang.includes('this._extensionService.whenInstalledExtensionsRegistered().then(() => {'));
		assert.ok(lang.includes(`}).catch(onUnexpectedError).catch(onUnexpectedError);`));
		assert.ok(lang.includes('this._loadConfigurationsForMode(languageIdentifier);'));
		assert.ok(!lang.includes(`this._loadConfigurationsForMode(languageIdentifier)${doubleCatch}`));

		assert.ok(large.includes('this._configurationService.updateValue(`editor.largeFileOptimizations`, false).then(() => {'));
		assert.ok(large.includes('}, (err) => {'));
		assert.ok(!large.includes(`this._configurationService.updateValue(\`editor.largeFileOptimizations\`, false).then(() => {${doubleCatch}`));

		assert.ok(inspectTokens.includes('Promise.all([grammar, semanticTokens]).then(([grammar, semanticTokens]) => {'));
		assert.ok(inspectTokens.includes('}, (err) => {'));
		assert.ok(!inspectTokens.includes(`Promise.all([grammar, semanticTokens]).then(([grammar, semanticTokens]) => {${doubleCatch}`));

		assert.ok(gotoSymbol.includes('this.outlineService.createOutline(pane, OutlineTarget.QuickPick, cts.token).then(outline => {'));
		assert.ok(gotoSymbol.includes('}).catch(err => {'));
		assert.ok(gotoSymbol.includes('onUnexpectedError(err);'));
		assert.ok(!gotoSymbol.includes(`this.outlineService.createOutline(pane, OutlineTarget.QuickPick, cts.token).then(outline => {${doubleCatch}`));

		assert.ok(outline.includes('const value = await raceCancellation(timeout(2000).then(() => true), cts.token, false);'));
		assert.ok(!outline.includes(`timeout(2000).then(() => true)${doubleCatch}`));
		assert.ok(outline.includes('await this._codeEditorService.openCodeEditor({'));
		assert.ok(!outline.includes(`this._codeEditorService.openCodeEditor({}${doubleCatch}`));

		assert.ok(inspectKeys.includes('editorService.openEditor({ resource: undefined, contents: keybindingService._dumpDebugInfo(), options: { pinned: true } });'));
		assert.ok(!inspectKeys.includes('editorService.openEditor({ resource: undefined, contents: keybindingService._dumpDebugInfo(), options: { pinned: true } }).catch'));
		assert.ok(gotoLine.includes('this.editorService.openEditor(this.editorService.activeEditor, editorOptions, SIDE_GROUP);'));
		assert.ok(!gotoLine.includes('this.editorService.openEditor(this.editorService.activeEditor, editorOptions, SIDE_GROUP).catch'));
		assert.ok(gotoSymbol.includes('this.editorService.openEditor(this.editorService.activeEditor, editorOptions, SIDE_GROUP);'));
		assert.ok(!gotoSymbol.includes('this.editorService.openEditor(this.editorService.activeEditor, editorOptions, SIDE_GROUP).catch'));
		assert.ok(debugTm.includes('const textEditorPane = await editorService.openEditor({'));
		assert.ok(!debugTm.includes(`editorService.openEditor({}${doubleCatch}`));

		assert.ok(access.includes("configurationService.updateValue('editor.accessibilitySupport', isScreenReaderOptimized ? 'off' : 'on', ConfigurationTarget.USER);"));
		assert.ok(!access.includes("configurationService.updateValue('editor.accessibilitySupport', isScreenReaderOptimized ? 'off' : 'on', ConfigurationTarget.USER).catch"));
		assert.ok(dictation.includes('EditorDictation.get(editor)?.start();'));
		assert.ok(!dictation.includes(`EditorDictation.get(editor)?.start()${doubleCatch}`));
		assert.ok(inspectKeys.includes('run(accessor: ServicesAccessor, editor: ICodeEditor): void {'));
		assert.ok(access.includes('async run(accessor: ServicesAccessor): Promise<void> {'));
	});

	test('Connect / Watch / Resolve / Pty / invented proto stay skipped', () => {
		const files = [LANG_REL, OUTLINE_REL, SAVE_REL, HINT_REL, DIFF_REL, DISPLAY_REL, FIND_REL, GOTO_SYMBOL_REL];
		for (const rel of files) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
