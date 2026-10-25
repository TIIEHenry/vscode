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
const SOURCE_REL = 'src/vs/workbench/contrib/conversation/browser/engineProviderModelSection.ts';

function sourcePath(): string {
	const candidates = [
		path.join(process.cwd(), SOURCE_REL),
		path.join(thisDir, '../../../../../../../', SOURCE_REL),
	];
	const found = candidates.find(candidate => fs.existsSync(candidate));
	assert.ok(found, `engineProviderModelSection.ts not found from cwd or import.meta (${candidates.join(' | ')})`);
	return found;
}

const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';

suite('Engine provider/model fire-and-forget catch scan (D1319)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('async settings actions catch dialog and transport failures', () => {
		const source = fs.readFileSync(sourcePath(), 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		for (const method of [
			'promptProvider',
			'clearProvider',
			'importLocalProviders',
			'promptModel',
			'setListedModelEnabled',
			'deleteListedModel',
			'testListedModel',
		]) {
			const matches = source.match(new RegExp(`void this\\.${method}\\([^\\n;]*`, 'g')) ?? [];
			assert.ok(matches.length > 0, `${method} should have at least one fire-and-forget call`);
			for (const match of matches) {
				assert.ok(match.includes(doubleCatch), `${method} fire-and-forget call must use a double catch: ${match}`);
			}
		}
	});
});
