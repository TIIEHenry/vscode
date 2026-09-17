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

suite('SessionInputBanners leftover fire-and-forget catch scan (D626)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('revealCI _revealPullRequest void double-catch onUnexpectedError (D626)', () => {
		// Single-chain `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(sessionInputBannersSourcePath(), 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const call = 'void this._revealPullRequest(state.pullRequest)';
		const doubleCall = `${call}${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.ok(source.includes('private async _revealPullRequest(pullRequest: IGitHubPullRequestRef): Promise<void> {'));
		assert.ok(source.includes(`run: () => { if (!state.debug) { ${doubleCall} } },`));
		assert.strictEqual((source.match(/void this\._revealPullRequest\(state\.pullRequest\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCall));
		assert.ok(!source.includes(`${call};`));
		assert.ok(!source.includes(`${call}.catch(onUnexpectedError);`));
		assert.ok(source.includes('void prModel.refresh().catch(onUnexpectedError).catch(onUnexpectedError);'));
		assert.ok(source.includes('void ciModelRef.object.refresh().catch(onUnexpectedError).catch(onUnexpectedError);'));
	});
});
