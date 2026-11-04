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
const SOURCE_REL = 'src/vs/sessions/contrib/layout/browser/singlePane/singlePaneDockedTabsCoordinator.ts';

function singlePaneDockedTabsCoordinatorSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/singlePane/singlePaneDockedTabsCoordinator.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `singlePaneDockedTabsCoordinator.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('SinglePaneDockedTabsCoordinator leftover fire-and-forget catch scan (D639)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_sequencer.queue five leftover sites single-catch onUnexpectedError (D639)', () => {
		const source = fs.readFileSync(singlePaneDockedTabsCoordinatorSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const removeFiles = 'void this._sequencer.queue(() => this._removeFilesTab(this._editorGroupsService.mainPart.activeGroup))';
		const restoreCollapsed = 'void this._sequencer.queue(() => this._restoreCollapsedTabs())';
		const collapseNonManaged = 'void this._sequencer.queue(() => this._collapseNonManagedTabs())';
		const reconcile = 'void this._sequencer.queue(() => this._reconcile(generation))';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._sequencer\.queue\(\(\) => this\._removeFilesTab\(this\._editorGroupsService\.mainPart\.activeGroup\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._sequencer\.queue\(\(\) => this\._restoreCollapsedTabs\(\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/void this\._sequencer\.queue\(\(\) => this\._collapseNonManagedTabs\(\)\)/g) ?? []).length, 2);
		assert.strictEqual((source.match(/void this\._sequencer\.queue\(\(\) => this\._reconcile\(generation\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\);/g) ?? []).length, 5);
		assert.ok(source.includes(`${removeFiles}${singleCatch};`));
		assert.ok(source.includes(`${restoreCollapsed}${singleCatch};`));
		assert.strictEqual((source.split(`${collapseNonManaged}${singleCatch};`).length - 1), 2);
		assert.ok(source.includes(`${reconcile}${singleCatch};`));
		assert.ok(!source.includes(`${removeFiles};`));
		assert.ok(!source.includes(`${restoreCollapsed};`));
		assert.ok(!source.includes(`${collapseNonManaged};`));
		assert.ok(!source.includes(`${reconcile};`));
		assert.ok(!source.includes(`${removeFiles}${doubleCatch};`));
		assert.ok(!source.includes(`${restoreCollapsed}${doubleCatch};`));
		assert.ok(!source.includes(`${collapseNonManaged}${doubleCatch};`));
		assert.ok(!source.includes(`${reconcile}${doubleCatch};`));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});
