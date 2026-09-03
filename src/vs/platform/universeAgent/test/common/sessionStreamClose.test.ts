/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { createStreamCloseGate } from '../../common/sessionStreamClose.js';
import type { UniverseAgentSessionStreamCloseCause } from '../../common/universeAgentTypes.js';

suite('createStreamCloseGate', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('remote end notifies once', () => {
		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const gate = createStreamCloseGate(cause => seen.push(cause));
		gate.finish({ kind: 'remote' });
		gate.finish({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);
		assert.strictEqual(gate.closed, true);
	});

	test('error notifies with message', () => {
		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const gate = createStreamCloseGate(cause => seen.push(cause));
		gate.finish({ kind: 'error', message: 'stream error' });
		assert.deepStrictEqual(seen, [{ kind: 'error', message: 'stream error' }]);
	});

	test('local dispose silences a follow-up CANCELLED', () => {
		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const gate = createStreamCloseGate(cause => seen.push(cause));
		gate.closeLocal();
		gate.finish({ kind: 'error', message: 'CANCELLED' });
		gate.finish({ kind: 'remote' });
		assert.deepStrictEqual(seen, []);
		assert.strictEqual(gate.closed, true);
	});
});
