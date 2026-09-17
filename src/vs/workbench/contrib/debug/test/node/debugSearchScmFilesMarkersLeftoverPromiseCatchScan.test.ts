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
const BREAKPOINT_WIDGET_REL = 'src/vs/workbench/contrib/debug/browser/breakpointWidget.ts';
const ADAPTER_REL = 'src/vs/workbench/contrib/debug/browser/debugAdapterManager.ts';
const SEARCH_VIEW_REL = 'src/vs/workbench/contrib/search/browser/searchView.ts';
const EXPLORER_REL = 'src/vs/workbench/contrib/files/browser/views/explorerView.ts';
const SCM_REPOS_REL = 'src/vs/workbench/contrib/scm/browser/scmRepositoriesViewPane.ts';
const MARKERS_REL = 'src/vs/workbench/contrib/markers/browser/markersTreeViewer.ts';

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

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch};`));
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('debug/search/scm/files/markers leftover Promise fire-and-forget catch scan (D686)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('debug breakpointWidget updateBreakpoints leftover is double-chain; then(undefined) gone', () => {
		const source = fs.readFileSync(resolveSource(BREAKPOINT_WIDGET_REL), 'utf8');
		const call = 'this.debugService.updateBreakpoints(this.breakpoint.originalUri, data, false)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/this\.debugService\.updateBreakpoints\(this\.breakpoint\.originalUri, data, false\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call}.then(undefined, onUnexpectedError);`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});

	test('debug adapter getKnownTasks leftover then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(ADAPTER_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes(`this.tasksService.getKnownTasks().then(tasks => {
			this.taskLabels = tasks.map(task => task._label);
			this.updateDebugAdapterSchema();
		})${doubleCatch};`));
		assert.ok(!source.includes(`this.tasksService.getKnownTasks().then(tasks => {
			this.taskLabels = tasks.map(task => task._label);
			this.updateDebugAdapterSchema();
		});`));
	});

	test('searchView updateFileStats leftover then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_VIEW_REL), 'utf8');
		const call = 'this.updateFileStats(changedMatches).then(async () => this.refreshTreeController.queue())';
		assert.strictEqual((source.match(/this\.updateFileStats\(changedMatches\)\.then\(async \(\) => this\.refreshTreeController\.queue\(\)\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}.catch(errors.onUnexpectedError).catch(errors.onUnexpectedError);`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(errors.onUnexpectedError);`));
	});

	test('files explorer leftover executeCommand / refresh are double-chain; Action2.run stays skipped', () => {
		const source = fs.readFileSync(resolveSource(EXPLORER_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assertDoubleChain(source, 'void this.commandService.executeCommand(NEW_FILE_COMMAND_ID)', 1);
		assertDoubleChain(source, 'void this.refresh(true)', 2);
		const action2NewFile = '\t\tcommandService.executeCommand(NEW_FILE_COMMAND_ID);';
		assert.ok(source.includes(action2NewFile));
		assert.ok(!source.split('\n').some(line => line.includes(action2NewFile) && line.includes('.catch')));
	});

	test('scm repositories artifact executeCommand leftover is double-chain', () => {
		const source = fs.readFileSync(resolveSource(SCM_REPOS_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, 'void this.commandService.executeCommand(e.element.artifact.command.id, e.element.repository.provider, e.element.artifact)', 1);
	});

	test('markers setQuickFixes leftover is double-chain; openEditor stays skipped', () => {
		const source = fs.readFileSync(resolveSource(MARKERS_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async setQuickFixes(waitForModel: boolean): Promise<void> {'));
		assertDoubleChain(source, 'void this.setQuickFixes(true)', 1);
		assert.ok(source.includes('}, ACTIVE_GROUP).then(() => undefined);'));
		assert.ok(!source.includes('}, ACTIVE_GROUP).then(() => undefined).catch'));
	});
});
