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
const EXTENSIONS_REL = 'src/vs/workbench/services/extensions/common/extensions.ts';
const NOTEBOOK_COMMON_REL = 'src/vs/workbench/contrib/notebook/common/notebookCommon.ts';
const NOTEBOOK_BROWSER_REL = 'src/vs/workbench/contrib/notebook/browser/notebookBrowser.ts';
const NOTEBOOK_WIDGET_REL = 'src/vs/workbench/contrib/notebook/browser/notebookEditorWidget.ts';
const NOTEBOOK_MODEL_REL = 'src/vs/workbench/contrib/notebook/common/notebookEditorModel.ts';
const INLINE_CHAT_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/interactive/browser/interactiveEditor.ts';
const INPUT_REL = 'src/vs/workbench/contrib/interactive/browser/interactiveEditorInput.ts';
const REPL_CONTRIB_REL = 'src/vs/workbench/contrib/replNotebook/browser/repl.contribution.ts';
const REPL_EDITOR_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditor.ts';
const REPL_INPUT_REL = 'src/vs/workbench/contrib/replNotebook/browser/replEditorInput.ts';
const DEBUG_REPL_REL = 'src/vs/workbench/contrib/debug/browser/repl.ts';

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

const installCall = 'this._installHandler()';
const revertCall = 'void Promise.resolve(this._editorModelReference?.revert({ soft: true }))';
const setOptionsInputCall = `this._notebookWidget.value!.setOptions({
			isReadOnly: true
		})`;
const setOptionsOverrideCall = 'void Promise.resolve(this._notebookWidget.value?.setOptions(options))';

const d792Calls: Array<[string, string, number]> = [
	[CONTRIB_REL, installCall, 1],
	[INPUT_REL, revertCall, 1],
	[EDITOR_REL, setOptionsInputCall, 1],
	[EDITOR_REL, setOptionsOverrideCall, 1],
];

suite('interactive leftover Promise fire-and-forget catch scan (D792)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers four leftover Promise double-chain sites in contrib/interactive only', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d792Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
		const contrib = seen.get(CONTRIB_REL) ?? fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const input = seen.get(INPUT_REL) ?? fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const editor = seen.get(EDITOR_REL) ?? fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assert.strictEqual(countDoubleChains(contrib), 1);
		assert.strictEqual(countDoubleChains(input), 1);
		assert.strictEqual(countDoubleChains(editor), 2);
	});

	test('interactive leftover _installHandler is Promise double-chain; await whenInstalledExtensionsRegistered stays', () => {
		const source = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const extensions = fs.readFileSync(resolveSource(EXTENSIONS_REL), 'utf8');
		assertPromiseSignature(source, 'private async _installHandler(): Promise<void> {');
		assertPromiseSignature(extensions, 'whenInstalledExtensionsRegistered(): Promise<boolean>;');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, installCall);
		assert.ok(!source.includes('\t\tthis._installHandler();\n'));
		assert.ok(source.includes('await this._extensionService.whenInstalledExtensionsRegistered();'));
		assert.ok(!source.includes(`whenInstalledExtensionsRegistered()${doubleCatch}`));
	});

	test('interactive leftover dispose revert PromiseLike is Promise.resolve double-chain; assigned / returned resolve stay skipped', () => {
		const source = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const notebook = fs.readFileSync(resolveSource(NOTEBOOK_COMMON_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(NOTEBOOK_MODEL_REL), 'utf8');
		assertPromiseSignature(notebook, 'revert(options?: IRevertOptions): Promise<void>;');
		assertPromiseSignature(model, 'async revert(options?: IRevertOptions): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, revertCall);
		assert.ok(!source.includes('this._editorModelReference?.revert({ soft: true });'));
		assert.ok(source.includes('this._inputResolver = this._resolveEditorModel();'));
		assert.ok(!source.includes(`this._inputResolver = this._resolveEditorModel()${doubleCatch}`));
		assert.ok(source.includes('return this._inputResolver;'));
		assert.ok(!source.includes(`return this._inputResolver${doubleCatch}`));
		assert.ok(source.includes('await this._editorModelReference.revert(options);'));
		assert.ok(!source.includes(`await this._editorModelReference.revert(options)${doubleCatch}`));
	});

	test('interactive leftover setOptions fire-and-forgets are Promise / PromiseLike double-chain', () => {
		const source = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(NOTEBOOK_BROWSER_REL), 'utf8');
		const widget = fs.readFileSync(resolveSource(NOTEBOOK_WIDGET_REL), 'utf8');
		assertPromiseSignature(browser, 'setOptions(options: INotebookEditorOptions | undefined): Promise<void>;');
		assertPromiseSignature(widget, 'async setOptions(options: INotebookEditorOptions | undefined) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, setOptionsInputCall);
		assertWrapped(source, setOptionsOverrideCall);
		assert.ok(!source.includes('\t\tthis._notebookWidget.value?.setOptions(options);\n'));
		assert.ok(source.includes('await this._notebookWidget.value!.setModel(model.notebook, viewState?.notebook);'));
		assert.ok(!source.includes(`setModel(model.notebook, viewState?.notebook)${doubleCatch}`));
	});

	test('repl leftover remaining stays unwrapped because interactive already has four legal sites', () => {
		const replContrib = fs.readFileSync(resolveSource(REPL_CONTRIB_REL), 'utf8');
		const replEditor = fs.readFileSync(resolveSource(REPL_EDITOR_REL), 'utf8');
		const replInput = fs.readFileSync(resolveSource(REPL_INPUT_REL), 'utf8');
		assert.ok(!replContrib.includes(doubleCatch));
		assert.ok(replContrib.includes('\t\tthis._installHandler();\n'));
		assert.ok(!replEditor.includes(doubleCatch));
		assert.ok(replEditor.includes('this._notebookWidget.value?.setOptions(options);'));
		assert.ok(replEditor.includes(`this._notebookWidget.value!.setOptions({
			isReadOnly: true
		});`));
		assert.ok(!replInput.includes(doubleCatch));
		assert.ok(replInput.includes('this.editorModelReference?.object.revert({ soft: true });'));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Connect / Watch / Resolve / Pty / D145 stay skipped', () => {
		const contrib = fs.readFileSync(resolveSource(CONTRIB_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		const input = fs.readFileSync(resolveSource(INPUT_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');
		const inlineChat = fs.readFileSync(resolveSource(INLINE_CHAT_REL), 'utf8');
		const debugRepl = fs.readFileSync(resolveSource(DEBUG_REPL_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(inlineChat, 'async acceptSession() {');

		assert.ok(contrib.includes('async run(accessor: ServicesAccessor, showOptions?: number | { viewColumn?: number; preserveFocus?: boolean }, resource?: URI, id?: string, title?: string): Promise<{ notebookUri: URI; inputUri: URI; notebookEditorId?: string }> {'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor, context?: UriComponents): Promise<void> {'));
		assert.ok(contrib.includes('ctrl.acceptSession();'));
		assert.ok(!contrib.includes(`ctrl.acceptSession()${doubleCatch}`));
		assert.ok(!contrib.includes('IOpenerService'));
		assert.ok(!editor.includes('IOpenerService'));
		assert.ok(!input.includes('IOpenerService'));

		assert.ok(editor.includes('this._notebookWidget.value?.onWillHide();'));
		assert.ok(!editor.includes(`this._notebookWidget.value?.onWillHide()${doubleCatch}`));
		assert.ok(editor.includes('this._notebookWidget.value?.onShow();'));
		assert.ok(!editor.includes(`this._notebookWidget.value?.onShow()${doubleCatch}`));

		assert.ok(debugRepl.includes('void this.tree.updateChildren(undefined, true, false).catch(onUnexpectedError).catch(onUnexpectedError);'));

		for (const source of [contrib, editor, input]) {
			assert.ok(!source.includes('.then(undefined,'));
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Resolve[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		}
	});
});
