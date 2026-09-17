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
const PROGRESS_REL = 'src/vs/workbench/contrib/sources/browser/sourcesReviewProgressService.ts';
const REVIEW_REL = 'src/vs/workbench/contrib/sources/browser/sourcesReviewList.ts';
const CHANGES_REL = 'src/vs/workbench/contrib/sources/browser/sourcesChangesList.ts';

function resolveSource(rel: string): string {
	const candidates = [
		path.join(process.cwd(), rel),
		path.join(thisDir, '../../../../../../../', rel),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `${rel} not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

suite('Sources leftover fire-and-forget catch scan (D677)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('progress invalidateResource leftover voids are double-chain', () => {
		const source = fs.readFileSync(resolveSource(PROGRESS_REL), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this.invalidateResource(resource)';
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async invalidateResource(resource: URI): Promise<void> {'));
		assert.strictEqual((source.match(/void this\.invalidateResource\(resource\)/g) ?? []).length, 2);
		assert.ok(source.includes(`${call}${doubleCatch};`));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(!/^\t+this\.invalidateResource\(resource\);/m.test(source));
	});

	test('Review and Changes onDidOpen leftover Promises are double-chain; async e gone', () => {
		const review = fs.readFileSync(resolveSource(REVIEW_REL), 'utf8');
		const changes = fs.readFileSync(resolveSource(CHANGES_REL), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

		const reviewOpenStart = review.indexOf('this._register(this.list.onDidOpen');
		const reviewOpenEnd = review.indexOf('this._register(this.list.onContextMenu', reviewOpenStart);
		assert.ok(reviewOpenStart >= 0 && reviewOpenEnd > reviewOpenStart);
		const reviewOpen = review.slice(reviewOpenStart, reviewOpenEnd);
		assert.ok(!reviewOpen.includes('async e =>'));
		assert.ok(reviewOpen.includes('void (async () => {'));
		assert.ok(reviewOpen.includes(`})()${doubleCatch};`));
		assert.ok(reviewOpen.includes('markReviewedAfterSuccessfulOpen'));
		assert.ok(!reviewOpen.includes(`})().catch(onUnexpectedError);`));

		const changesOpenStart = changes.indexOf('this._register(this.list.onDidOpen');
		const changesOpenEnd = changes.indexOf('this._register(this.list.onDidChangeSelection', changesOpenStart);
		assert.ok(changesOpenStart >= 0 && changesOpenEnd > changesOpenStart);
		const changesOpen = changes.slice(changesOpenStart, changesOpenEnd);
		assert.ok(!changesOpen.includes('async e =>'));
		assert.ok(changesOpen.includes('void (async () => {'));
		assert.ok(changesOpen.includes(`})()${doubleCatch};`));
		assert.ok(changesOpen.includes('openSourcesChangeEntry'));
		assert.ok(!changesOpen.includes(`})().catch(onUnexpectedError);`));
	});
});
