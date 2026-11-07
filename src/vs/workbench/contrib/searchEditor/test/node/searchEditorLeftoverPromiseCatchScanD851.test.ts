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
const SEARCH_EDITOR_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.ts';
const SEARCH_EDITOR_CONTRIB_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditor.contribution.ts';
const SEARCH_EDITOR_ACTIONS_REL = 'src/vs/workbench/contrib/searchEditor/browser/searchEditorActions.ts';
const SETTINGS_REL = 'src/vs/workbench/contrib/preferences/browser/settingsEditor2.ts';

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

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

function assertPromiseSignature(source: string, signature: string): void {
	assert.ok(source.includes(signature), `missing Promise signature: ${signature}`);
	assert.ok(signature.includes('Promise<') || signature.includes('async '));
}

function assertWrapped(source: string, call: string): void {
	assert.ok(source.includes(`${call}${singleCatch}`), `missing single-chain: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${singleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}${doubleCatch}`), `redundant double-chain remains: ${call}`);
}

const delayCall = 'this.triggerSearch({ delay })';
const resetCursorCall = 'this.triggerSearch({ resetCursor: false })';
const delayResetCall = 'this.triggerSearch({ resetCursor: false, delay: triggeredOnType ? this.searchConfig.searchOnTypeDebouncePeriod : 0 })';
const leftoverNoArgIncludesCall = '\t\tthis._register(this.inputPatternIncludes.onChangeSearchInEditorsBox(() => this.triggerSearch()));\n';
const leftoverNoArgExcludesCall = '\t\tthis._register(this.inputPatternExcludes.onChangeIgnoreBox(() => this.triggerSearch()));\n';
const leftoverNoArgMessageCall = '() => this.triggerSearch()';
const assignedTriggerSearchCall = 'const p = this.triggerSearch(idQuery, true);';
const actionTriggerSearchCall = '(editorService.activeEditorPane as SearchEditor).triggerSearch({ resetCursor: false })';
const editorFocusResultsCall = 'editor.triggerSearch({ focusResults: args.focusResults })';
const editorNoArgCall = 'editor.triggerSearch()';
const ongoingThenCall = `newInput.ongoingSearchOperation.then(complete => {
				if (this._store.isDisposed) {
					return;
				}
				this.onSearchComplete(complete, existingConfig, newInput);
			})`;

const d851Calls: Array<[string, string, number]> = [
	[SEARCH_EDITOR_REL, delayCall, 1],
	[SEARCH_EDITOR_REL, resetCursorCall, 5],
	[SEARCH_EDITOR_REL, delayResetCall, 2],
];

suite('leftover remaining unused searchEditor leftover remaining unused Promise fire-and-forget catch scan (D851)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused searchEditor leftover async this.foo() FOF still had four or more legal unused leftover sites so this knife stayed', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		assertPromiseSignature(source, 'async triggerSearch(_options?: { resetCursor?: boolean; delay?: number; focusResults?: boolean }) {');
		let sites = 0;
		for (const [, call, count] of d851Calls) {
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused searchEditor legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D851'));
	});

	test('this knife covers eight leftover Promise single-chain sites after leftover remaining unused stayed on searchEditor triggerSearch', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d851Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(SEARCH_EDITOR_REL) ?? ''), 0);
	});

	test('searchEditor leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + single-chain', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		assertPromiseSignature(source, 'async triggerSearch(_options?: { resetCursor?: boolean; delay?: number; focusResults?: boolean }) {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, delayCall);
		assertWrapped(source, resetCursorCall);
		assertWrapped(source, delayResetCall);
		assert.strictEqual(countIncludes(source, `${delayCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${resetCursorCall}${singleCatch}`), 5);
		assert.strictEqual(countIncludes(source, `${delayResetCall}${singleCatch}`), 2);
		assert.ok(!source.includes('\t\tthis._register(this.queryEditorWidget.onSearchSubmit(({ delay }) => this.triggerSearch({ delay })));\n'));
		assert.ok(!source.includes('\t\t\tthis._register(this.queryEditorWidget.searchInput.onDidOptionChange(() => this.triggerSearch({ resetCursor: false })));\n'));
		assert.ok(!source.includes('\t\tthis._register(this.queryEditorWidget.onDidToggleContext(() => this.triggerSearch({ resetCursor: false })));\n'));
		assert.ok(!source.includes('\t\tthis.triggerSearch({ resetCursor: false });\n'));
		assert.ok(source.includes(leftoverNoArgIncludesCall));
		assert.ok(source.includes(leftoverNoArgExcludesCall));
		assert.ok(source.includes(leftoverNoArgMessageCall));
		assert.ok(!source.includes(`this.triggerSearch()${doubleCatch}`));
		assert.ok(source.includes('await this.triggerSearch();'));
		assert.ok(!source.includes(`await this.triggerSearch()${doubleCatch}`));
		assert.ok(source.includes(`${ongoingThenCall}${singleCatch};`));
		assert.strictEqual(countDoubleChains(source), 0);
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_EDITOR_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(SEARCH_EDITOR_CONTRIB_REL), 'utf8');
		const actions = fs.readFileSync(resolveSource(SEARCH_EDITOR_ACTIONS_REL), 'utf8');
		const settings = fs.readFileSync(resolveSource(SETTINGS_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'async triggerSearch(_options?: { resetCursor?: boolean; delay?: number; focusResults?: boolean }) {');

		assert.ok(source.includes('IOpenerService'));
		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(contrib.includes('registerAction2'));
		assert.ok(contrib.includes('async run(accessor: ServicesAccessor) {'));
		assert.ok(contrib.includes(`${actionTriggerSearchCall};`));
		assert.ok(!contrib.includes(`${actionTriggerSearchCall}${doubleCatch}`));
		assert.ok(actions.includes(`${editorFocusResultsCall};`));
		assert.ok(!actions.includes(`${editorFocusResultsCall}${doubleCatch}`));
		assert.ok(actions.includes(`${editorNoArgCall};`));
		assert.ok(!actions.includes(`${editorNoArgCall}${doubleCatch}`));
		assert.ok(settings.includes(assignedTriggerSearchCall));
		assert.ok(!settings.includes(`const p = this.triggerSearch(idQuery, true)${doubleCatch}`));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(!source.includes('return this.triggerSearch'));
		assert.ok(source.includes('await this.triggerSearch();'));
		assert.ok(!source.includes(`await this.triggerSearch()${doubleCatch}`));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D851'));
		assert.ok(!contrib.includes('D851'));
		assert.ok(!actions.includes('D851'));
		assert.ok(!settings.includes('D851'));
	});

});
