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

	test('maybeOffer fire-and-forget void single-catch onUnexpectedError', () => {
		// No behavior test constructs this contribution yet; keep the call site from going bare.
		const source = fs.readFileSync(SOURCE_PATH, 'utf8');
		assert.ok(source.includes("import { onUnexpectedError } from '../../../../base/common/errors.js';"));
		assert.strictEqual((source.match(/void this\.maybeOffer\(\)/g) ?? []).length, 1);
		assert.ok(source.includes('void this.maybeOffer().catch(onUnexpectedError);'));
		assert.ok(!source.includes('void this.maybeOffer();'));
		assert.ok(!source.includes('.catch(onUnexpectedError).catch(onUnexpectedError)'));
	});
});
