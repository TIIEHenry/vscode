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
const WORKSPACES_REL = 'src/vs/platform/workspaces/common/workspaces.ts';
const EDITOR_REL = 'src/vs/workbench/services/editor/common/editorService.ts';
const SIMPLE_REL = 'src/vs/workbench/services/dialogs/browser/simpleFileDialog.ts';
const ABSTRACT_REL = 'src/vs/workbench/services/dialogs/browser/abstractFileDialogService.ts';
const BROWSER_REL = 'src/vs/workbench/services/dialogs/browser/fileDialogService.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const singleCatch = '.catch(onUnexpectedError)';
const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

function countIncludes(source: string, needle: string): number {
	return (source.match(new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${singleCatch}`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call}${doubleCatch}`), `double catch remains: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${singleCatch};`), `bare leftover remains: ${call}`);
}

function assertThenWrapped(source: string, thenStart: string): void {
	const idx = source.indexOf(thenStart);
	assert.ok(idx >= 0, `missing then: ${thenStart}`);
	const afterThen = source.slice(idx);
	const closeThen = afterThen.indexOf(`})${singleCatch};`);
	assert.ok(closeThen >= 0, `then not single-chained: ${thenStart}`);
	assert.ok(!afterThen.includes(`})${doubleCatch};`));
	assert.ok(!source.includes(`${thenStart};`));
}

const pickResourceThen = 'this.pickResource(true).then(result => {';
const onDidAcceptThen = 'this.onDidAccept().then(resolveValue => {';
const updateItemsThen = 'this.updateItems(homedir, true, this.trailing).then(() => {';
const addRecentlyOpenedCall = 'this.workspacesService.addRecentlyOpened([{ fileUri: uri, label: this.labelService.getUriLabel(uri, { appendWorkspaceSuffix: true }) }])';
const openEditorsCall = `this.editorService.openEditors(filesData.map(fileData => {
								return {
									resource: fileData.resource,
									contents: fileData.contents?.toString(),
									options: { pinned: true }
								};
							}))`;

const d795Calls: Array<[string, string, number, 'call' | 'then']> = [
	[SIMPLE_REL, pickResourceThen, 1, 'then'],
	[SIMPLE_REL, onDidAcceptThen, 1, 'then'],
	[SIMPLE_REL, updateItemsThen, 1, 'then'],
	[ABSTRACT_REL, addRecentlyOpenedCall, 1, 'call'],
	[BROWSER_REL, openEditorsCall, 1, 'call'],
];

suite('splash leftover remaining overflowed to dialogs leftover Promise fire-and-forget catch scan (D795)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers five leftover Promise single-chain sites after splash leftover remaining overflow', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count, kind] of d795Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			if (kind === 'then') {
				assertThenWrapped(source, call);
				assert.strictEqual(countIncludes(source, call), count, `${rel} ${call}: expected ${count} then starts, got ${countIncludes(source, call)}`);
			} else {
				const wrapped = countIncludes(source, `${call}${singleCatch}`);
				assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
				assertWrapped(source, call);
			}
			sites += count;
		}
		assert.strictEqual(sites, 5);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
	});

	test('dialogs leftover pickResource / onDidAccept / updateItems thens and addRecentlyOpened / openEditors are Promise double-chain', () => {
		const simple = fs.readFileSync(resolveSource(SIMPLE_REL), 'utf8');
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const browser = fs.readFileSync(resolveSource(BROWSER_REL), 'utf8');
		const workspaces = fs.readFileSync(resolveSource(WORKSPACES_REL), 'utf8');
		const editor = fs.readFileSync(resolveSource(EDITOR_REL), 'utf8');
		assertPromiseSignature(simple, 'private async pickResource(isSave: boolean = false): Promise<URI[] | URI | undefined> {');
		assertPromiseSignature(simple, 'private async onDidAccept(): Promise<URI | undefined> {');
		assertPromiseSignature(simple, 'private async updateItems(newFolder: URI, force: boolean = false, trailing?: string): Promise<boolean> {');
		assertPromiseSignature(workspaces, 'addRecentlyOpened(recents: IRecent[]): Promise<void>;');
		assertPromiseSignature(editor, 'openEditors(editors: EditorInputWithOptions[], group?: PreferredGroup, options?: IOpenEditorsOptions): Promise<readonly IEditorPane[]>;');
		assert.ok(simple.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(abstract.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(browser.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertThenWrapped(simple, pickResourceThen);
		assertThenWrapped(simple, onDidAcceptThen);
		assertThenWrapped(simple, updateItemsThen);
		assertWrapped(abstract, addRecentlyOpenedCall);
		assertWrapped(browser, openEditorsCall);
		assert.ok(!simple.includes('this.pickResource(true).then(result => {\n\t\t\t\tresolve(Array.isArray(result) ? result[0] : result);\n\t\t\t});'));
		assert.ok(!abstract.includes(`${addRecentlyOpenedCall};`));
		assert.ok(!browser.includes(`${openEditorsCall};`));
	});

});
