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
const INLINE_CHAT_REL = 'src/vs/workbench/contrib/inlineChat/browser/inlineChatController.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/interactive/browser/interactive.contribution.ts';
const EDITOR_REL = 'src/vs/workbench/contrib/interactive/browser/interactiveEditor.ts';
const INPUT_REL = 'src/vs/workbench/contrib/interactive/browser/interactiveEditorInput.ts';
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

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

suite('interactive leftover Promise fire-and-forget catch scan (D792)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
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
