/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import * as path from '../../../../../base/common/path.js';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../../..');
const SOURCE_PATH = path.join(repoRoot, 'src/vs/workbench/contrib/universeAgentMigration/electron-browser/universeAgentMigration.contribution.ts');

suite('UniverseAgentMigration contribution leftover catch (source scan)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('maybeOffer fire-and-forget void double-catch onUnexpectedError', () => {
		// Inner try/catch is insufficient: a lone `.catch(onUnexpectedError)` still leaks when the handler warn-then-rethrows.
		const source = fs.readFileSync(SOURCE_PATH, 'utf8');
		const doubleCatch = '.catch(onUnexpectedError).catch(onUnexpectedError)';
		const doubleCaught = `void this.maybeOffer()${doubleCatch};`;
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.maybeOffer\(\)/g) ?? []).length, 1);
		assert.ok(source.includes(doubleCaught));
		assert.ok(!source.includes('void this.maybeOffer();'));
		assert.ok(!source.includes('void this.maybeOffer().catch(onUnexpectedError);'));
	});
});
