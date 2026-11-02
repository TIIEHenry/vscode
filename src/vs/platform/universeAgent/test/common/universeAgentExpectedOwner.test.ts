/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { isCancellationError } from '../../../../base/common/errors.js';
import { MarshalledId } from '../../../../base/common/marshallingIds.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { assertUniverseAgentExpectedOwner, assertUniverseAgentSessionDeleteOwner, isUniverseAgentExpectedOwner, isUniverseAgentSessionDeleteOwner } from '../../common/universeAgentExpectedOwner.js';

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

	test('session Delete permits only exact link-only ownership without weakening other owners', () => {
		for (const identity of [undefined, 'engine']) {
			const expected = { linkId: 1, engineIdentityId: identity };
			assert.strictEqual(isUniverseAgentSessionDeleteOwner(expected), true);
			assert.doesNotThrow(() => assertUniverseAgentSessionDeleteOwner(expected, { ...expected, pairingPending: false }, true));
			assert.throws(() => assertUniverseAgentSessionDeleteOwner(expected, { linkId: 1, engineIdentityId: identity === undefined ? 'engine' : undefined, pairingPending: false }, true), isCancellationError);
		}
		assert.doesNotThrow(() => assertUniverseAgentSessionDeleteOwner({ linkId: 1 }, { linkId: 1, pairingPending: false }, true));
		assert.strictEqual(isUniverseAgentExpectedOwner({ linkId: 1 }), false);
		assert.strictEqual(isUniverseAgentExpectedOwner({ linkId: 1, engineIdentityId: undefined }), false);
	});

	test('session Delete rejects missing malformed stale and unavailable ownership', () => {
		const malformed: unknown[] = [undefined, null, [], {}, { linkId: '1' }, { linkId: 0 }, { linkId: -1 },
			{ linkId: 1.5 }, { linkId: NaN }, { linkId: Infinity }, { linkId: Number.MAX_SAFE_INTEGER + 1 },
			{ linkId: 1, engineIdentityId: '' }, { linkId: 1, engineIdentityId: null }, { linkId: 1, extra: true },
			{ linkId: 1, $mid: MarshalledId.Regexp }, Object.create({ linkId: 1 }),
			Object.defineProperty({}, 'linkId', { get: () => { throw new Error('accessor must not run'); } })];
		assert.deepStrictEqual(malformed.map(isUniverseAgentSessionDeleteOwner), malformed.map(() => false));
		for (const value of [...malformed, { ...owner, linkId: 2 }]) {
			assert.throws(() => assertUniverseAgentSessionDeleteOwner(value, published, true), isCancellationError);
		}
		assert.throws(() => assertUniverseAgentSessionDeleteOwner(owner, published, false), isCancellationError);
		assert.throws(() => assertUniverseAgentSessionDeleteOwner(owner, { ...published, pairingPending: true }, true), isCancellationError);
	});

	test('session Delete never reads inherited owner data or prototype accessors', () => {
		let getterCalls = 0;
		const inheritedLink = Object.assign(Object.create({ linkId: 1 }), { engineIdentityId: 'engine' });
		const inheritedIdentity = Object.assign(Object.create({ engineIdentityId: 'engine' }), { linkId: 1 });
		const inheritedGetter = Object.assign(Object.create({ get engineIdentityId() { getterCalls++; return 'engine'; } }), { linkId: 1 });
		for (const value of [inheritedLink, inheritedIdentity, inheritedGetter]) {
			assert.strictEqual(isUniverseAgentSessionDeleteOwner(value), false);
			assert.throws(() => assertUniverseAgentSessionDeleteOwner(value, published, true), isCancellationError);
		}
		assert.strictEqual(getterCalls, 0);
	});
});
