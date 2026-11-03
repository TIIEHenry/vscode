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
const SOURCE_REL = 'src/vs/sessions/contrib/sessionInputBanners/browser/sessionInputBanners.ts';

function sessionInputBannersSourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../browser/sessionInputBanners.ts'),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `sessionInputBanners.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

function countDoubleChains(source: string): number {
	return (source.match(/\.catch\(onUnexpectedError\)\.catch\(onUnexpectedError\)/g) ?? []).length;
}

suite('SessionInputBanners leftover fire-and-forget catch scan (D626)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('revealCI _revealPullRequest void single-catch onUnexpectedError (D626)', () => {
		const source = fs.readFileSync(sessionInputBannersSourcePath(), 'utf8');
		const singleCatch = '.catch(onUnexpectedError)';
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._revealPullRequest(state.pullRequest)';
		const singleCall = `${call}${singleCatch};`;
		assert.ok(source.includes("import { getErrorMessage, isCancellationError, onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _revealPullRequest(pullRequest: IGitHubPullRequestRef): Promise<void> {'));
		assert.ok(source.includes(`run: () => { if (!state.debug) { ${singleCall} } },`));
		assert.strictEqual((source.match(/void this\._revealPullRequest\(state\.pullRequest\)/g) ?? []).length, 1);
		assert.ok(source.includes(singleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}${doubleCatch};`));
		assert.ok(source.includes('void prModel.refresh().catch(onUnexpectedError);'));
		assert.ok(source.includes('void ciModelRef.object.refresh().catch(onUnexpectedError);'));
		assert.strictEqual(countDoubleChains(source), 0);
	});
});
