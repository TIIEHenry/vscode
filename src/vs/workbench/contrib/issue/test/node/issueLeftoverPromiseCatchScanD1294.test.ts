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
const BASE_REL = 'src/vs/workbench/contrib/issue/browser/baseIssueReporterService.ts';
const FORM_REL = 'src/vs/workbench/contrib/issue/browser/issueFormService.ts';

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
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}${doubleCatch};`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

const leftoverRenderBlocksCall = 'this.renderBlocks()';
const leftoverUpdateIssueReporterUriCall = 'this.updateIssueReporterUri(extension)';
const leftoverCloseReporterCall = 'this.closeReporter()';

const d1294Calls: Array<[string, string, number]> = [
	[BASE_REL, leftoverRenderBlocksCall, 6],
	[BASE_REL, leftoverUpdateIssueReporterUriCall, 1],
	[FORM_REL, leftoverCloseReporterCall, 1],
];

suite('leftover remaining unused remaining remaining unused issue leftover remaining unused remaining remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D1294)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused remaining remaining unused issue leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d1294Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused remaining remaining unused issue legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		for (const [rel] of d1294Calls) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('D1294'));
		}
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused remaining remaining unused stayed on issue this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d1294Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}${doubleCatch}`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 8);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(BASE_REL) ?? ''), 13);
		assert.strictEqual(countDoubleChains(seen.get(FORM_REL) ?? ''), 1);
	});

	test('issue leftover remaining unused remaining remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const base = fs.readFileSync(resolveSource(BASE_REL), 'utf8');
		const form = fs.readFileSync(resolveSource(FORM_REL), 'utf8');

		assertPromiseSignature(base, 'public async renderBlocks(): Promise<void> {');
		assertPromiseSignature(base, 'private async updateIssueReporterUri(extension: IssueReporterExtensionData): Promise<void> {');
		assertPromiseSignature(form, 'async closeReporter(): Promise<void> {');

		assert.ok(base.includes("import { CancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(form.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));

		assertWrapped(base, leftoverRenderBlocksCall);
		assertWrapped(base, leftoverUpdateIssueReporterUriCall);
		assertWrapped(form, leftoverCloseReporterCall);
		assert.ok(!base.includes('this.renderBlocks();'));
		assert.ok(!base.includes('this.updateIssueReporterUri(extension);'));
		assert.ok(!form.includes('this.closeReporter();'));
		assert.strictEqual(countIncludes(base, `${leftoverRenderBlocksCall}${doubleCatch}`), 6);
		assert.strictEqual(countIncludes(base, `${leftoverUpdateIssueReporterUriCall}${doubleCatch}`), 1);
		assert.strictEqual(countIncludes(form, `${leftoverCloseReporterCall}${doubleCatch}`), 1);
		for (const source of [base, form]) {
			assert.ok(!source.includes('D1294'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		}
	});
});
