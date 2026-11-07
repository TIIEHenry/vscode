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
const SEARCH_WIDGET_REL = 'src/vs/workbench/contrib/search/browser/searchWidget.ts';

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

const delayMultiplierCall = 'this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier)';
const debounceCall = 'this.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod)';
const submitCall = 'this.submitSearch()';

const d841Calls: Array<[string, string, number]> = [
	[SEARCH_WIDGET_REL, delayMultiplierCall, 1],
	[SEARCH_WIDGET_REL, debounceCall, 1],
	[SEARCH_WIDGET_REL, submitCall, 2],
];

suite('leftover remaining unused searchWidget leftover remaining unused Promise fire-and-forget catch scan (D841)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused searchWidget leftover async this.foo() FOF still had four or more legal unused leftover sites so this knife stayed', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		assertPromiseSignature(source, 'private async submitSearch(triggeredOnType = false, delay: number = 0): Promise<void> {');
		let sites = 0;
		for (const [, call, count] of d841Calls) {
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${call}: expected ${count} wrapped, got ${wrapped}`);
			sites += wrapped;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused searchWidget legal leftover >=4, got ${sites}`);
		assert.ok(sites <= 8);
		assert.ok(!source.includes('D841'));
	});

	test('this knife covers four leftover Promise single-chain sites after leftover remaining unused stayed on searchWidget', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d841Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${singleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(SEARCH_WIDGET_REL) ?? ''), 0);
	});

	test('searchWidget leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + single-chain', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		assertPromiseSignature(source, 'private async submitSearch(triggeredOnType = false, delay: number = 0): Promise<void> {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(source, delayMultiplierCall);
		assertWrapped(source, debounceCall);
		assertWrapped(source, submitCall);
		assert.strictEqual(countIncludes(source, `${delayMultiplierCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${debounceCall}${singleCatch}`), 1);
		assert.strictEqual(countIncludes(source, `${submitCall}${singleCatch}`), 2);
		assert.ok(!source.includes('\t\t\t\t\tthis.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod * delayMultiplier);\n'));
		assert.ok(!source.includes('\t\t\t\tthis.submitSearch(true, this.searchConfiguration.searchOnTypeDebouncePeriod);\n'));
		assert.ok(!source.includes('\t\t\tthis.submitSearch();\n'));
		assert.ok(!source.includes('await this.submitSearch'));
		assert.strictEqual(countDoubleChains(source), 0);
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_WIDGET_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'private async submitSearch(triggeredOnType = false, delay: number = 0): Promise<void> {');

		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('IOpenerService'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(source.includes('class ReplaceAllAction extends Action'));
		assert.ok(source.includes('new ReplaceAllAction(searchView.searchAndReplaceWidget).run();'));
		assert.ok(!source.includes(`new ReplaceAllAction(searchView.searchAndReplaceWidget).run()${doubleCatch}`));
		assert.ok(!source.includes('.then(undefined,'));
		assert.ok(!source.includes('return this.submitSearch'));
		assert.ok(!source.includes('await this.submitSearch'));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D841'));
	});

});
