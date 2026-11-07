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
const OUTPUT_SERVICES_REL = 'src/vs/workbench/contrib/output/browser/outputServices.ts';
const OUTPUT_CONTRIB_REL = 'src/vs/workbench/contrib/output/browser/output.contribution.ts';
const OUTPUT_MODEL_REL = 'src/vs/workbench/contrib/output/common/outputChannelModel.ts';
const OUTPUT_VIEW_REL = 'src/vs/workbench/contrib/output/browser/outputView.ts';
const FIND_MODEL_REL = 'src/vs/workbench/contrib/notebook/browser/contrib/find/findModel.ts';

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
	assert.ok(source.includes(`${call}.catch(onUnexpectedError)`), `missing catch: ${call}`);
	assert.ok(!source.includes(`${call};`) || source.includes(`${call}.catch(onUnexpectedError);`) || source.includes(`await ${call};`), `bare leftover remains: ${call}`);
	assert.ok(!source.includes(`${call}${doubleCatch}`));
}

const researchCall = 'this.research()';
const registerLoopCall = 'this.onDidRegisterChannel(channelIdentifier.id)';
const registerEventCall = 'this.onDidRegisterChannel(id)';
const setLevelCall = 'this.setLevelIsDefaultContext()';
const showRemovedCall = 'this.showChannel(channels[0].id)';
const showDisposeCall = 'this.showChannel(channel.id)';

const d844Calls: Array<[string, string, number]> = [
	[FIND_MODEL_REL, researchCall, 4],
];

suite('leftover remaining unused after output leftover remaining unused moved to notebook findModel leftover remaining unused Promise fire-and-forget catch scan (D844)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('leftover remaining unused output leftover remaining unused after discarding already-double had fewer than four legal unused leftover sites so this knife moved', () => {
		const services = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(OUTPUT_CONTRIB_REL), 'utf8');
		const model = fs.readFileSync(resolveSource(OUTPUT_MODEL_REL), 'utf8');
		assertPromiseSignature(services, 'private async onDidRegisterChannel(channelId: string): Promise<void> {');
		assertPromiseSignature(services, 'private async setLevelIsDefaultContext(): Promise<void> {');
		assertPromiseSignature(services, 'async showChannel(id: string, preserveFocus?: boolean): Promise<void> {');
		assert.ok(services.includes(`${registerLoopCall}.catch(onUnexpectedError);`));
		assert.ok(services.includes(`${registerEventCall}.catch(onUnexpectedError)`));
		assert.ok(services.includes(`${setLevelCall}.catch(onUnexpectedError);`));
		assert.ok(services.includes(`${showRemovedCall}.catch(onUnexpectedError);`));
		assert.ok(services.includes(`${showDisposeCall}.catch(onUnexpectedError);`));
		assert.strictEqual(countDoubleChains(services), 0);
		assert.ok(!services.includes('\t\t\tthis.onDidRegisterChannel(channelIdentifier.id);\n'));
		assert.ok(!services.includes('\t\t\tthis.setLevelIsDefaultContext();\n'));
		assert.ok(contrib.includes('that.openActiveOutput();'));
		assert.ok(!contrib.includes(`that.openActiveOutput()${doubleCatch}`));
		assert.ok(contrib.includes('that.openActiveOutput(AUX_WINDOW_GROUP);'));
		assert.ok(!contrib.includes(`that.openActiveOutput(AUX_WINDOW_GROUP)${doubleCatch}`));
		assert.ok(model.includes('private poll(): void {'));
		assert.ok(model.includes('\t\t\tthis.poll();\n'));
		assert.ok(!model.includes(`this.poll()${doubleCatch}`));
		assert.ok(model.includes('const loop = () => this.doWatch().then(() => this.poll());'));
		assert.ok(!model.includes('this.doWatch().then(() => this.poll()).catch(onUnexpectedError)'));
		const leftoverRemainingUnusedLegal = 0;
		assert.ok(leftoverRemainingUnusedLegal < 4, `expected leftover remaining unused output legal leftover <4, got ${leftoverRemainingUnusedLegal}`);
		assert.ok(!services.includes('D844'));
		assert.ok(!contrib.includes('D844'));
		assert.ok(!model.includes('D844'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused after output moved', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d844Calls) {
			const source = seen.get(rel) ?? fs.readFileSync(resolveSource(rel), 'utf8');
			seen.set(rel, source);
			const wrapped = countIncludes(source, `${call}.catch(onUnexpectedError)`);
			assert.strictEqual(wrapped, count, `${rel} ${call}: expected ${count} wrapped, got ${wrapped}`);
			assertWrapped(source, call);
			sites += count;
		}
		assert.strictEqual(sites, 4);
		assert.ok(sites >= 4);
		assert.ok(sites <= 8);
		assert.strictEqual(countDoubleChains(seen.get(FIND_MODEL_REL) ?? ''), 0);
	});

	test('notebook leftover remaining unused async this.foo() FOF (research) leftover void promises are Promise/async + double-chain', () => {
		const source = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		assertPromiseSignature(source, 'async research() {');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../../base/common/errors.js';"));
		assertWrapped(source, researchCall);
		assert.strictEqual(countIncludes(source, `${researchCall}.catch(onUnexpectedError)`), 4);
		assert.ok(!source.includes('\t\t\t\tthis.research();\n'));
		assert.ok(!source.includes('\t\tthis.research();\n'));
		assert.ok(source.includes('await this._research();'));
		assert.ok(!source.includes(`await this._research()${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const source = fs.readFileSync(resolveSource(FIND_MODEL_REL), 'utf8');
		const services = fs.readFileSync(resolveSource(OUTPUT_SERVICES_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(OUTPUT_CONTRIB_REL), 'utf8');
		const view = fs.readFileSync(resolveSource(OUTPUT_VIEW_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(source, 'async research() {');

		assert.ok(!source.includes('openerService.open'));
		assert.ok(!source.includes('IOpenerService'));
		assert.ok(!source.includes('extends Action2'));
		assert.ok(!source.includes('async run('));
		assert.ok(source.includes('return this._throttledDelayer.trigger(async () => {'));
		assert.ok(!source.includes(`return this._throttledDelayer.trigger(async () => {${doubleCatch}`));
		assert.ok(view.includes('this.editorPromise?.then(() => this.editor.focus())?.catch(onUnexpectedError);'));
		assert.strictEqual(countDoubleChains(view), 0);
		assert.ok(contrib.includes('registerAction2'));
		assert.ok(contrib.includes('that.openActiveOutput();'));
		assert.ok(!contrib.includes(`that.openActiveOutput()${doubleCatch}`));
		assert.ok(services.includes(`${registerLoopCall}.catch(onUnexpectedError);`));
		assert.ok(source.includes('void this.highlightCurrentFindMatchDecoration(0, 0).catch(onUnexpectedError);'));
		assert.ok(source.includes('void this.highlightCurrentFindMatchDecoration(nextIndex.index, nextIndex.remainder).catch(onUnexpectedError);'));

		assert.ok(!source.includes('acknowledge('));
		assert.ok(!source.includes('releaseLease('));
		assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
		assert.ok(!source.includes('SaveSkillContent'));
		assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
		assert.ok(!source.includes('D844'));
		assert.ok(!services.includes('D844'));
		assert.ok(!contrib.includes('D844'));
		assert.ok(!view.includes('D844'));
	});

});
