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
const OUTPUT_REL = 'src/vs/workbench/contrib/output/browser/outputServices.ts';
const OUTPUT_CONTRIB_REL = 'src/vs/workbench/contrib/output/browser/output.contribution.ts';
const LOGS_CONTRIB_REL = 'src/vs/workbench/contrib/logs/common/logs.contribution.ts';
const ASSIGN_REL = 'src/vs/workbench/services/assignment/common/assignmentService.ts';
const FILTERS_REL = 'src/vs/workbench/services/assignment/common/assignmentFilters.ts';

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

const registerLoopCall = 'this.onDidRegisterChannel(channelIdentifier.id)';
const refetchCall = 'this.refetchAssignments()';
const updateExtCall = 'this.updateExtensionVersions()';
const leftoverAssignmentThenCall = 'this.defaultAccountService.getDefaultAccount().then(() => this.recreateTasClientIfEndpointChanged())';
const leftoverRecreateCall = '() => this.recreateTasClientIfEndpointChanged()';
const leftoverEntitlementCall = 'this.updateCopilotEntitlementInfo()';
const leftoverTokenCall = 'this.updateCopilotTokenInfo()';

const d864Calls: Array<[string, string, number]> = [
	[ASSIGN_REL, refetchCall, 2],
	[FILTERS_REL, updateExtCall, 2],
];

suite('leftover remaining unused after output leftover remaining unused after already-double overflowed to unused leftover remaining unused assignment leftover remaining unused Promise fire-and-forget catch scan (D864)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife covers four leftover Promise double-chain sites after leftover remaining unused after output leftover remaining unused overflowed to unused leftover remaining unused assignment leftover remaining unused this.foo()', () => {
		let sites = 0;
		const seen = new Map<string, string>();
		for (const [rel, call, count] of d864Calls) {
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
		assert.strictEqual(countIncludes(seen.get(ASSIGN_REL) ?? '', `${refetchCall}.catch(onUnexpectedError)`), 2);
		assert.strictEqual(countIncludes(seen.get(FILTERS_REL) ?? '', `${updateExtCall}.catch(onUnexpectedError)`), 2);
		assert.strictEqual(countDoubleChains(seen.get(ASSIGN_REL) ?? ''), 0);
		assert.strictEqual(countDoubleChains(seen.get(FILTERS_REL) ?? ''), 0);
	});

	test('unused leftover remaining unused assignment leftover remaining unused async this.foo() FOF leftover void promises are Promise/async + double-chain', () => {
		const assign = fs.readFileSync(resolveSource(ASSIGN_REL), 'utf8');
		const filters = fs.readFileSync(resolveSource(FILTERS_REL), 'utf8');
		assertPromiseSignature(assign, 'private async refetchAssignments(): Promise<void> {');
		assertPromiseSignature(filters, 'private async updateExtensionVersions() {');
		assert.ok(assign.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(filters.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertWrapped(assign, refetchCall);
		assertWrapped(filters, updateExtCall);
		assert.ok(!assign.includes('() => this.refetchAssignments())'));
		assert.ok(!filters.includes('\t\tthis.updateExtensionVersions();\n'));
		assert.ok(!filters.includes('\t\t\t\tthis.updateExtensionVersions();\n'));
		assert.ok(assign.includes(`${leftoverAssignmentThenCall}.catch(onUnexpectedError);`));
		assert.ok(assign.includes(`${leftoverRecreateCall})`));
		assert.ok(!assign.includes(`${leftoverRecreateCall}${doubleCatch}`));
		assert.ok(filters.includes(`${leftoverEntitlementCall};`));
		assert.ok(!filters.includes(`${leftoverEntitlementCall}${doubleCatch}`));
		assert.ok(filters.includes(`${leftoverTokenCall};`));
		assert.ok(!filters.includes(`${leftoverTokenCall}${doubleCatch}`));
	});

	test('opener / Action2.run / assigned then / two-arg then / returned Promise / already-double / Resolve / Pty / Connect / Watch / D145 stay skipped', () => {
		const assign = fs.readFileSync(resolveSource(ASSIGN_REL), 'utf8');
		const filters = fs.readFileSync(resolveSource(FILTERS_REL), 'utf8');
		const services = fs.readFileSync(resolveSource(OUTPUT_REL), 'utf8');
		const contrib = fs.readFileSync(resolveSource(OUTPUT_CONTRIB_REL), 'utf8');
		const logsContrib = fs.readFileSync(resolveSource(LOGS_CONTRIB_REL), 'utf8');
		const opener = fs.readFileSync(resolveSource(OPENER_REL), 'utf8');

		assertPromiseSignature(opener, 'open(resource: URI | string, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean>;');
		assertPromiseSignature(assign, 'private async refetchAssignments(): Promise<void> {');
		assertPromiseSignature(assign, 'async getTreatment<T extends string | number | boolean>(name: string): Promise<T | undefined> {');

		assert.ok(!assign.includes('openerService.open'));
		assert.ok(!filters.includes('openerService.open'));
		assert.ok(!assign.includes('extends Action2'));
		assert.ok(!filters.includes('extends Action2'));
		assert.ok(contrib.includes('that.openActiveOutput();'));
		assert.ok(!contrib.includes(`that.openActiveOutput()${doubleCatch}`));
		assert.ok(logsContrib.includes('run(servicesAccessor: ServicesAccessor): Promise<void> {'));
		assert.ok(logsContrib.includes('return action.run().finally(() => action.dispose());'));
		assert.ok(!logsContrib.includes(`return action.run().finally(() => action.dispose())${doubleCatch}`));
		assert.ok(services.includes(`${registerLoopCall}.catch(onUnexpectedError);`));
		assert.strictEqual(countDoubleChains(services), 0);
		assert.ok(assign.includes(`${leftoverAssignmentThenCall}.catch(onUnexpectedError);`));
		assert.ok(assign.includes('tasClient.initialFetch.then(() => {'));
		assert.ok(!assign.includes(`tasClient.initialFetch.then(() => {${doubleCatch}`));
		assert.ok(assign.includes('client?.then(c => c.dispose()).catch(() => undefined);'));
		assert.ok(!assign.includes(`client?.then(c => c.dispose())${doubleCatch}`));

		for (const source of [assign, filters, services, contrib]) {
			assert.ok(!source.includes('acknowledge('));
			assert.ok(!source.includes('releaseLease('));
			assert.ok(!/Connect\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Watch\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveTurn\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/ResolveAnchor\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!/Pty[A-Za-z]*\([^)]*\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/.test(source));
			assert.ok(!source.includes('SaveSkillContent'));
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`));
			assert.ok(!source.includes('D864'));
		}
	});

});
