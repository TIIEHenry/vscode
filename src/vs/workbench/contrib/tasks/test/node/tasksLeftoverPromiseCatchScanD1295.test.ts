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
const ABSTRACT_REL = 'src/vs/workbench/contrib/tasks/browser/abstractTaskService.ts';
const AUTO_REL = 'src/vs/workbench/contrib/tasks/browser/runAutomaticTasks.ts';
const CONTRIB_REL = 'src/vs/workbench/contrib/tasks/browser/task.contribution.ts';
const TERMINAL_REL = 'src/vs/workbench/contrib/tasks/browser/terminalTaskSystem.ts';
const SCHEMA_V1_REL = 'src/vs/workbench/contrib/tasks/common/jsonSchema_v1.ts';
const SCHEMA_V2_REL = 'src/vs/workbench/contrib/tasks/common/jsonSchema_v2.ts';
const MATCHER_REL = 'src/vs/workbench/contrib/tasks/common/problemMatcher.ts';

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

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

const totals: Array<[string, number]> = [
	[ABSTRACT_REL, 38],
	[AUTO_REL, 6],
	[CONTRIB_REL, 1],
	[TERMINAL_REL, 2],
	[SCHEMA_V1_REL, 1],
	[SCHEMA_V2_REL, 2],
	[MATCHER_REL, 1],
];

suite('tasks leftover Promise fire-and-forget catch scan (D1295)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('onUnexpectedError returns undefined so a lone catch still leaks when the handler warn-then-rethrows', () => {
		const source = fs.readFileSync(resolveSource(ERRORS_REL), 'utf8');
		assert.ok(source.includes('export function onUnexpectedError(e: any): undefined {'));
		assert.ok(source.includes('\treturn undefined;'));
	});

	test('this knife locks double-chain totals on the seven tasks files', () => {
		let sites = 0;
		for (const [rel, count] of totals) {
			const source = fs.readFileSync(resolveSource(rel), 'utf8');
			assert.strictEqual(countDoubleChains(source), count, rel);
			assert.ok(!source.includes('D1295'), rel);
			assert.ok(!source.includes(`${doubleCatch}.catch(onUnexpectedError)`), rel);
			sites += count;
		}
		assert.strictEqual(sites, 51);
	});

	test('D689 registerCommands / reconnect chains stay, and the new tasks anchors are double-chain', () => {
		const abstract = fs.readFileSync(resolveSource(ABSTRACT_REL), 'utf8');
		const auto = fs.readFileSync(resolveSource(AUTO_REL), 'utf8');
		const matcher = fs.readFileSync(resolveSource(MATCHER_REL), 'utf8');
		assert.ok(abstract.includes('this._registerCommands().then(() => TaskCommandsRegistered.bindTo(this._contextKeyService).set(true)).catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(abstract.includes('void this._upgrade().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(abstract.includes('void Promise.resolve(this._terminalService.whenConnected).then(() => {'));
		assert.strictEqual((auto.match(/void this\._tryRunTasks\(\)\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 3);
		assert.ok(auto.includes('void this._runWithPermission('));
		assert.ok(!auto.includes('_runWithPermission(this._taskService, this._configurationService, this._storageService, this._notificationService, this._openerService, autoTasks.tasks, autoTasks.taskNames, autoTasks.locations).catch'));
		assert.ok(matcher.includes('void ProblemPatternRegistry.onReady().catch(onUnexpectedError).catch(onUnexpectedError);'));
	});
});
