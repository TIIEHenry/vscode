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

	get(key: string, scope: StorageScope, fallbackValue: string): string;
	get(key: string, scope: StorageScope, fallbackValue?: string): string | undefined;
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

	test('skips profiles whose target is malformed for its kind', () => {
		const ids = Array.from({ length: 12 }, (_, i) => `${String(i).padStart(8, '0')}-1111-4111-8111-111111111111`);
		const malformedTargets: unknown[] = [
			null,
			[],
			'directAddress',
			{ kind: 'carrierPigeon', host: 'h', port: 1 },
			{ kind: 'directAddress', port: 50061 },
			{ kind: 'directAddress', host: '127.0.0.1', port: '50061' },
			{ kind: 'directAddress', host: '127.0.0.1', port: 70000 },
			{ kind: 'directAddress', host: ' ', port: 50061 },
			{ kind: 'loopback', socketOrPort: null },
			{ kind: 'loopback', socketOrPort: 1.5 },
			{ kind: 'hubDevice', hubBaseUrl: 'https://hub.example.com', accountId: 'usr_1' },
			{ kind: 'hubDevice', hubBaseUrl: 42, accountId: 'usr_1', hubDeviceId: 'dev-1' },
		];
		const storage = new TestApplicationStorage();
		storage.seedProfiles([
			...malformedTargets.map((target, i) => ({ ...validPersistedProfile(ids[i]), target })),
			{ ...validPersistedProfile(VALID_PROFILE_ID), target: { kind: 'loopback', socketOrPort: 50051 } },
			{ ...validPersistedProfile(VALID_PROFILE_ID_2), target: { kind: 'hubDevice', hubBaseUrl: 'https://hub.example.com', accountId: 'usr_1', hubDeviceId: 'dev-1' } },
		]);
		const store = new ConnectionProfileStore(storage.asService());

		assert.deepStrictEqual(store.list().map(p => [p.profileId, p.target]), [
			[VALID_PROFILE_ID, { kind: 'loopback', socketOrPort: 50051 }],
			[VALID_PROFILE_ID_2, { kind: 'hubDevice', hubBaseUrl: 'https://hub.example.com', accountId: 'usr_1', hubDeviceId: 'dev-1' }],
		]);
		assert.strictEqual(store.get(ids[0]), undefined);
	});

	test('put and remove keep entries that fail validation in storage', () => {
		const trust = createEngineTrustRecord({
			leafDer: Uint8Array.from([1, 2, 3]),
			engineIdentityId: '0123456789abcdef'.repeat(4),
			establishedAt: 1,
		});
		const unverifiableTrustProfile = {
			...validPersistedProfile(VALID_PROFILE_ID),
			trust: {
				leafDer: [1, 2, 3],
				leafSha256Hex: '0'.repeat(64),
				engineIdentityId: trust.engineIdentityId,
				establishedAt: trust.establishedAt,
				establishedVia: 'sas',
			},
			state: 'active',
		};
		const unknownTarget = { ...validPersistedProfile('33333333-3333-4333-8333-333333333333'), target: { kind: 'futureKind' } };
		const storage = new TestApplicationStorage();
		storage.seedProfiles([unverifiableTrustProfile, unknownTarget, validPersistedProfile(VALID_PROFILE_ID_2)]);
		const store = new ConnectionProfileStore(storage.asService());
		const valid = store.get(VALID_PROFILE_ID_2)!;

		store.put({ ...valid, displayName: 'Renamed' });
		store.remove(VALID_PROFILE_ID_2);

		assert.deepStrictEqual(JSON.parse(storage.get(STORAGE_KEY, StorageScope.APPLICATION)!), [unverifiableTrustProfile, unknownTarget]);
	});

});
