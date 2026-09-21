/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_REL = 'src/vs/base/common/errors.ts';
const COLOR_REL = 'src/vs/editor/contrib/colorPicker/browser/colorDetector.ts';
const STICKY_PROVIDER_REL = 'src/vs/editor/contrib/stickyScroll/browser/stickyScrollProvider.ts';
const VIEW_GPU_REL = 'src/vs/editor/browser/viewParts/viewLinesGpu/viewLinesGpu.ts';
const RECT_REL = 'src/vs/editor/browser/gpu/rectangleRenderer.ts';
const LINKED_REL = 'src/vs/editor/contrib/linkedEditing/browser/linkedEditing.ts';
const GUTTER_REL = 'src/vs/editor/contrib/inlineCompletions/browser/view/inlineEdits/components/gutterIndicatorView.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../', rel),
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

const leftoverBeginComputeCall = 'this.beginCompute()';
const leftoverUpdateCall = 'this.update()';
const leftoverInitWebgpuCall = 'this.initWebgpu()';
const leftoverInitWebgpuDeviceCall = 'this._initWebgpu(device)';
const leftoverUpdateRangesCall = 'this.updateRanges()';
const leftoverTriggerAnimationCall = 'this.triggerAnimation()';

const d1254Calls: Array<[string, string, number]> = [
	[COLOR_REL, leftoverBeginComputeCall, 2],
	[STICKY_PROVIDER_REL, leftoverUpdateCall, 2],
	[VIEW_GPU_REL, leftoverInitWebgpuCall, 1],
	[RECT_REL, leftoverInitWebgpuDeviceCall, 1],
	[LINKED_REL, leftoverUpdateRangesCall, 1],
	[GUTTER_REL, leftoverTriggerAnimationCall, 1],
];

suite('leftover remaining unused editor leftover remaining unused this.foo() leftover remaining unused Promise fire-and-forget catch scan (D1254)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused editor leftover async this.foo() FOF still had four or more legal unused leftover sites after discarding collision overflow so this knife stayed', () => {
		let sites = 0;
		for (const [, , count] of d1254Calls) {
			sites += count;
		}
		assert.ok(sites >= 4, `expected leftover remaining unused editor legal leftover >=4 after discarding collision overflow, got ${sites}`);
		assert.ok(sites <= 8);
		assert.strictEqual(sites, 8);
		for (const [rel] of d1254Calls) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.ok(!source.includes('D1254'));
		}
	});

	test('this knife covers eight leftover Promise double-chain sites after leftover remaining unused stayed on editor this.foo() FOF', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d1254Calls) {
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
		assert.strictEqual(countDoubleChains(seen.get(COLOR_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(STICKY_PROVIDER_REL) ?? ''), 2);
		assert.strictEqual(countDoubleChains(seen.get(VIEW_GPU_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(RECT_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(LINKED_REL) ?? ''), 1);
		assert.strictEqual(countDoubleChains(seen.get(GUTTER_REL) ?? ''), 1);
	});

	test('editor leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const color = fs.readFileSync(resolveSource(COLOR_REL), 'utf8');
		const provider = fs.readFileSync(resolveSource(STICKY_PROVIDER_REL), 'utf8');
		const viewGpu = fs.readFileSync(resolveSource(VIEW_GPU_REL), 'utf8');
		const rect = fs.readFileSync(resolveSource(RECT_REL), 'utf8');
		const linked = fs.readFileSync(resolveSource(LINKED_REL), 'utf8');
		const gutter = fs.readFileSync(resolveSource(GUTTER_REL), 'utf8');

		assertPromiseSignature(color, 'private async beginCompute(): Promise<void> {');
		assertPromiseSignature(provider, 'public async update(): Promise<void> {');
		assertPromiseSignature(viewGpu, 'async initWebgpu() {');
		assertPromiseSignature(rect, 'private async _initWebgpu(device: Promise<GPUDevice>) {');
		assertPromiseSignature(linked, 'public async updateRanges(force = false): Promise<void> {');
		assertPromiseSignature(gutter, 'public triggerAnimation(): Promise<Animation> {');

		assert.ok(color.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(provider.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(viewGpu.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(rect.includes("import { onUnexpectedError } from '../../../base/common/errors.js';"));
		assert.ok(linked.includes("import { isCancellationError, onUnexpectedError, onUnexpectedExternalError } from '../../../../base/common/errors.js';"));
		assert.ok(gutter.includes("import { BugIndicatingError, onUnexpectedError } from '../../../../../../../base/common/errors.js';"));

		assertWrapped(color, leftoverBeginComputeCall);
		assertWrapped(provider, leftoverUpdateCall);
		assertWrapped(viewGpu, leftoverInitWebgpuCall);
		assertWrapped(rect, leftoverInitWebgpuDeviceCall);
		assertWrapped(linked, leftoverUpdateRangesCall);
		assertWrapped(gutter, leftoverTriggerAnimationCall);
		assert.ok(!color.includes('\t\tthis.beginCompute();\n'));
		assert.ok(!provider.includes('\t\tthis.update();\n'));
		assert.ok(!viewGpu.includes('\t\tthis.initWebgpu();\n'));
		assert.ok(!rect.includes('\t\tthis._initWebgpu(device);\n'));
		assert.ok(!linked.includes('\t\tthis.updateRanges();\n'));
		assert.ok(!gutter.includes('\t\t\t\tthis.triggerAnimation();\n'));
		assert.ok(provider.includes('() => this.update()'));
		assert.ok(!provider.includes(`() => this.update()${doubleCatch}`));
		assert.ok(linked.includes('this._rangeUpdateTriggerPromise = rangeUpdateScheduler.trigger(() => this.updateRanges()'));
		assert.ok(!linked.includes(`() => this.updateRanges()${doubleCatch}`));
		for (const source of [color, provider, viewGpu, rect, linked, gutter]) {
			assert.ok(!source.includes('D1254'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		}
	});
});
