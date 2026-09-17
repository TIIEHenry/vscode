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
const EXPLORER_SERVICE_REL = 'src/vs/workbench/contrib/files/browser/explorerService.ts';
const SEARCH_MODEL_REL = 'src/vs/workbench/contrib/search/browser/searchTreeModel/searchModel.ts';
const SEARCH_FIND_REL = 'src/vs/workbench/contrib/search/browser/searchActionsFind.ts';
const SCM_HISTORY_REL = 'src/vs/workbench/contrib/scm/browser/scmHistoryViewPane.ts';

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
const errorsDoubleCatch = '.catch(errors.onUnexpectedError).catch(errors.onUnexpectedError)';

function assertDoubleChain(source: string, call: string, count: number): void {
	assert.strictEqual((source.match(new RegExp(call.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length, count);
	assert.ok(source.includes(`${call}${doubleCatch};`));
	assert.ok(!source.includes(`${call};`));
	assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
}

suite('scm/files/search leftover Promise fire-and-forget catch scan (D691)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('files explorerService leftover onConfigurationUpdated / setTreeInput / refresh are double-chain', () => {
		const source = fs.readFileSync(resolveSource(EXPLORER_SERVICE_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		const configCall = 'void this.onConfigurationUpdated(e)';
		assert.strictEqual((source.match(/void this\.onConfigurationUpdated\(e\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${configCall}${doubleCatch}));`));
		assert.ok(!source.includes(`${configCall};`));
		assert.ok(!source.includes(`${configCall}.catch(onUnexpectedError));`));
		assertDoubleChain(source, 'void this.view?.setTreeInput()?', 1);
		assertDoubleChain(source, 'void this.refresh(false)', 1);
	});

	test('searchModel leftover _startStreamDelay then is double-chain', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_MODEL_REL), 'utf8');
		const delayThen = `this._startStreamDelay.then(() => {
					if (targetQueue.length) {
						this._searchResult.add(targetQueue, searchInstanceID, ai, !ai);
						targetQueue.length = 0;
					}
				})`;
		assert.ok(source.includes(`${delayThen}${errorsDoubleCatch};`));
		assert.ok(!source.includes(`${delayThen};`));
		assert.ok(!source.includes(`${delayThen}.catch(errors.onUnexpectedError);`));
	});

	test('searchActionsFind leftover select then is double-chain; openPaneComposite wrap is D756', () => {
		const source = fs.readFileSync(resolveSource(SEARCH_FIND_REL), 'utf8');
		assertDoubleChain(source, 'explorerService.select(uri, true).then(() => explorerView.focus())', 1);
		assert.ok(!source.includes('explorerService.select(uri, true).then(() => explorerView.focus(), onUnexpectedError);'));
		assert.ok(source.includes('paneCompositeService.openPaneComposite(VIEWLET_ID_FILES, ViewContainerLocation.Sidebar, false).then((viewlet) => {'));
		assert.ok(source.includes(`explorerService.select(uri, true).then(() => explorerView.focus())${doubleCatch};
			}
		})${doubleCatch};`));
	});

	test('scm history leftover refresh voids are double-chain; await refresh stays skipped', () => {
		const source = fs.readFileSync(resolveSource(SCM_HISTORY_REL), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assertDoubleChain(source, 'void this.refresh()', 3);
		assert.ok(source.includes('await this.refresh();'));
		assert.ok(!source.includes('await this.refresh().catch'));
		assert.ok(source.includes('\t\tview.refresh();'));
		assert.ok(!source.includes('view.refresh().catch'));
	});
});
