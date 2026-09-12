/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from '../../../../base/common/path.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { UNIVERSE_AGENT_SCHEME } from '../../common/universeAgentScheme.js';

const thisDir = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(thisDir, '../../../../../../');

suite('universeAgentScheme', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('product.json urlProtocol matches UNIVERSE_AGENT_SCHEME', () => {
		const productJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'product.json'), 'utf8')) as { urlProtocol: string };
		assert.strictEqual(productJson.urlProtocol, UNIVERSE_AGENT_SCHEME);
		assert.strictEqual(UNIVERSE_AGENT_SCHEME, 'universe-agent');
		assert.strictEqual(productJson.urlProtocol, 'universe-agent');
	});
});
