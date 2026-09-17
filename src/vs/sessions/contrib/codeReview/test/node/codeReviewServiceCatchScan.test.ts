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

suite('CodeReviewService leftover fire-and-forget catch scan (D613)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('reviewThreadsRef.object.refresh void double-catch onUnexpectedError (D613)', () => {
		// GitHubPullRequestReviewThreadsModel.refresh returns Promise<void>; a bare void leaks on reject.
		// A lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(codeReviewServiceSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void reviewThreadsRef.object.refresh()';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void reviewThreadsRef\.object\.refresh\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('reader.store.add(reviewThreadsRef.object.startPolling());'));
		assert.ok(!source.includes('reviewThreadsRef.object.startPolling().catch'));
	});
});
