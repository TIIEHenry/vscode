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
const SOURCE_REL = 'src/vs/sessions/contrib/layout/browser/singlePane/singlePaneDetailPanelCoordinator.ts';

function singlePaneDetailPanelCoordinatorSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/singlePane/singlePaneDetailPanelCoordinator.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `singlePaneDetailPanelCoordinator.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('SinglePaneDetailPanelCoordinator leftover fire-and-forget catch scan (D642)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('_sequencer.queue _syncTarget leftover site double-catch onUnexpectedError (D642)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(singlePaneDetailPanelCoordinatorSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._sequencer.queue(() => this._syncTarget(target, generation))';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\._sequencer\.queue\(\(\) => this\._syncTarget\(target, generation\)\)/g) ?? []).length, 1);
		assert.strictEqual((source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
	});
});
