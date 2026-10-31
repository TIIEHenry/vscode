/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isCancellationError } from '../../../../base/common/errors.js';
import { MarshalledId } from '../../../../base/common/marshallingIds.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { assertUniverseAgentExpectedOwner, isUniverseAgentExpectedOwner } from '../../common/universeAgentExpectedOwner.js';

suite('UniverseAgentExpectedOwner', () => {
	ensureNoDisposablesAreLeakedInTestSuite();
	const owner = { engineIdentityId: 'engine', linkId: 1 };
	const published = { ...owner, pairingPending: false };

	test('only an explicit scalar identity and positive safe link form an owner', () => {
		const malformed: unknown[] = [
			undefined, null, [], {}, { engineIdentityId: '', linkId: 1 },
			{ engineIdentityId: 'engine', linkId: '1' }, { engineIdentityId: 'engine', linkId: 0 },
			{ engineIdentityId: 'engine', linkId: -1 }, { engineIdentityId: 'engine', linkId: 1.5 },
			{ engineIdentityId: 'engine', linkId: NaN }, { engineIdentityId: 'engine', linkId: Infinity },
			{ engineIdentityId: 'engine', linkId: Number.MAX_SAFE_INTEGER + 1 },
			{ ...owner, $mid: MarshalledId.Regexp, source: '[', flags: '' },
		];
		assert.deepStrictEqual(malformed.map(isUniverseAgentExpectedOwner), malformed.map(() => false));
		assert.strictEqual(isUniverseAgentExpectedOwner(owner), true);
	});

	test('strict checks cancel missing malformed stale disconnected and pairing owners', () => {
		for (const invalid of [undefined, null, {}, { ...owner, linkId: 2 }, { ...owner, engineIdentityId: 'other' }]) {
			assert.throws(() => assertUniverseAgentExpectedOwner(invalid, published, true), isCancellationError);
		}
		assert.throws(() => assertUniverseAgentExpectedOwner(owner, published, false), isCancellationError);
		assert.throws(() => assertUniverseAgentExpectedOwner(owner, { ...published, pairingPending: true }, true), isCancellationError);
		assert.doesNotThrow(() => assertUniverseAgentExpectedOwner(owner, published, true));
	});
});
