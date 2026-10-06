/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../storage/common/storage.js';
import { ConnectionProfileStore } from '../../node/connectionProfileStore.js';
import { createEngineTrustRecord } from '../../node/engineTrustStore.js';

const STORAGE_KEY = 'universeAgent.connectionProfiles';

const VALID_PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const VALID_PROFILE_ID_2 = '22222222-2222-4222-8222-222222222222';

class TestApplicationStorage implements Pick<IStorageService, 'get' | 'store' | 'remove'> {
	private readonly data = new Map<string, string>();

	get(key: string, _scope: StorageScope, fallbackValue?: string): string | undefined {
		return this.data.get(key) ?? fallbackValue;
	}

	store(key: string, value: string | number | boolean | object | null | undefined, _scope: StorageScope, _target: StorageTarget): void {
		this.data.set(key, String(value));
	}

	remove(key: string, _scope: StorageScope): void {
		this.data.delete(key);
	}

	asService(): IStorageService {
		return this as unknown as IStorageService;
	}

	seedProfiles(payload: unknown): void {
		this.store(STORAGE_KEY, JSON.stringify(payload), StorageScope.APPLICATION, StorageTarget.MACHINE);
	}
}

function validPersistedProfile(profileId: string) {
	return {
		profileId,
		displayName: 'Engine',
		target: { kind: 'directAddress', host: '127.0.0.1', port: 50061 },
		trust: null,
		state: 'pairingPending',
		allowPrivateNetwork: false,
	};
}

suite('Connection profile store', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('skips null array entries and still lists valid profiles', () => {
		const storage = new TestApplicationStorage();
		storage.seedProfiles([null, validPersistedProfile(VALID_PROFILE_ID)]);
		const store = new ConnectionProfileStore(storage.asService());

		const listed = store.list();
		assert.strictEqual(listed.length, 1);
		assert.strictEqual(listed[0].profileId, VALID_PROFILE_ID);

		assert.strictEqual(store.get(VALID_PROFILE_ID)?.displayName, 'Engine');
		assert.strictEqual(store.get('missing'), undefined);

		store.put({
			...listed[0],
			displayName: 'Updated',
		});
		assert.strictEqual(store.get(VALID_PROFILE_ID)?.displayName, 'Updated');

		store.remove(VALID_PROFILE_ID);
		assert.deepStrictEqual(store.list(), []);
	});

	test('skips profile with corrupt trust.leafDer and keeps siblings usable', () => {
		const trust = createEngineTrustRecord({
			leafDer: Uint8Array.from([1, 2, 3]),
			engineIdentityId: '0123456789abcdef'.repeat(4),
			establishedAt: 1,
		});
		const corruptTrustProfile = {
			...validPersistedProfile(VALID_PROFILE_ID),
			trust: {
				leafDer: 'not-an-array',
				leafSha256Hex: trust.leafSha256Hex,
				engineIdentityId: trust.engineIdentityId,
				establishedAt: trust.establishedAt,
				establishedVia: 'sas',
			},
			state: 'active',
		};
		const storage = new TestApplicationStorage();
		storage.seedProfiles([corruptTrustProfile, validPersistedProfile(VALID_PROFILE_ID_2)]);
		const store = new ConnectionProfileStore(storage.asService());

		const listed = store.list();
		assert.strictEqual(listed.length, 1);
		assert.strictEqual(listed[0].profileId, VALID_PROFILE_ID_2);

		store.remove(VALID_PROFILE_ID_2);
		assert.deepStrictEqual(store.list(), []);
	});

});
