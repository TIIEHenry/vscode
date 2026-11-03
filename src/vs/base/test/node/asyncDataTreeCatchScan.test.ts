/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../common/utils.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_REL = 'src/vs/base/browser/ui/tree/asyncDataTree.ts';

function asyncDataTreeSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/ui/tree/asyncDataTree.ts'),
		path.join(thisDir, '../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `asyncDataTree.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('AsyncDataTree leftover fire-and-forget catch scan (D674)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('refreshAndRenderNode leftover site is one and single-chain; zero double-chain (D674)', () => {
		const source = fs.readFileSync(asyncDataTreeSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const refreshSite = `this.refreshAndRenderNode(node.element, false)
					`;
		assert.ok(source.includes("import { isCancellationError, onUnexpectedError } from '../../../common/errors.js';"));
		assert.strictEqual((source.match(/this\.refreshAndRenderNode\(node\.element, false\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${refreshSite}${singleCatch};`));
		assert.ok(!source.includes(`${refreshSite};`));
		assert.ok(!source.includes(`${refreshSite}${doubleCatch};`));
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});
