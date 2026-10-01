/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createStreamHarness } from './streamHarness.js';
import { runStreamScript } from './streamScript.js';
import { STREAM_SCRIPTS } from './streamScripts.js';

/**
 * One test per script in `streamScripts.ts`. This file never needs to change when a case is added.
 */
suite('Conversation stream scripts', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('script ids are unique', () => {
		const ids = STREAM_SCRIPTS.map(s => s.id);
		assert.deepStrictEqual(ids, [...new Set(ids)]);
	});

	for (const script of STREAM_SCRIPTS) {
		test(`${script.id}: ${script.title}`, async () => {
			await runStreamScript(createStreamHarness(store), script);
		});
	}
});
