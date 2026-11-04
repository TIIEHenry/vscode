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
const SOURCE_REL = 'src/vs/sessions/contrib/codeReview/browser/codeReviewService.ts';

function codeReviewServiceSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/codeReviewService.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `codeReviewService.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('CodeReviewService leftover fire-and-forget catch scan (D613)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('reviewThreadsRef.object.refresh void single-catch onUnexpectedError (D613)', () => {
		const source = fs.readFileSync(codeReviewServiceSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void reviewThreadsRef.object.refresh()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/reviewThreadsRef\.object\.refresh\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}.then(`));
		assert.ok(source.includes('_noteReviewRefreshSettled('));
		assert.ok(source.includes(`${singleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${doubleCatch};`));
		assert.ok(source.includes('reader.store.add(reviewThreadsRef.object.startPolling());'));
		assert.ok(!source.includes('reviewThreadsRef.object.startPolling().catch'));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});
