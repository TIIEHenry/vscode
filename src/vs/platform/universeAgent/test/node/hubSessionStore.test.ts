/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IEncryptionMainService, KnownStorageProvider } from '../../../encryption/common/encryptionService.js';
import { StorageScope, StorageTarget } from '../../../storage/common/storage.js';
import { IApplicationStorageMainService } from '../../../storage/electron-main/storageMainService.js';
import { ClientIdentityStore, InMemoryClientIdentityStore } from '../../node/clientIdentityStore.js';
import {
	HubSessionStore,
	InMemoryHubSessionStore,
	isHubSessionTokenExpired,
	refreshHubAuthSession,
} from '../../node/hubSessionStore.js';
import type { ParsedAuthSessionV1 } from '../../node/hub/hub-auth-client.js';

class TestEncryptionService implements IEncryptionMainService {
	declare readonly _serviceBrand: undefined;
	private readonly prefix = 'enc:';
	private readonly available: boolean;

	constructor(available = true) {
		this.available = available;
	}

	setUsePlainTextEncryption(): Promise<void> {
		return Promise.resolve();
	}

	getKeyStorageProvider(): Promise<KnownStorageProvider> {
		return Promise.resolve(KnownStorageProvider.basicText);
	}

	encrypt(value: string): Promise<string> {
		return Promise.resolve(this.prefix + value);
	}

	decrypt(value: string): Promise<string> {
		return Promise.resolve(value.slice(this.prefix.length));
	}

	isEncryptionAvailable(): Promise<boolean> {
		return Promise.resolve(this.available);
	}
}

class TestApplicationStorageMainService implements Pick<IApplicationStorageMainService, 'get' | 'store' | 'remove'> {
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

	has(key: string): boolean {
		return this.data.has(key);
	}

	asService(): IApplicationStorageMainService {
		return this as unknown as IApplicationStorageMainService;
	}
}

suite('Hub session store', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const FIXTURE_SESSION: ParsedAuthSessionV1 = {
		accessToken: 'hub-access-token',
		expiresIn: 900,
		csrfToken: 'csrf-token',
		mustChangePassword: false,
		user: {
			id: 'usr_1',
			email: 'user@example.com',
			role: 'USER',
			status: 'ACTIVE',
		},
	};

	test('stores access token before expiry', async () => {
		const store = new InMemoryHubSessionStore();
		const now = 1_000_000;
		await store.applyAuthSession('https://hub.example.com', FIXTURE_SESSION, now, 'refresh-token');
		assert.strictEqual(store.getAccessTokenForHub('https://hub.example.com', now + 100), 'hub-access-token');
		assert.deepStrictEqual(store.getStatusForHub('https://hub.example.com', now + 100), {
			status: 'signedIn',
			email: 'user@example.com',
		});
	});

	test('refresh single-flight coalesces concurrent callers', async () => {
		const store = new InMemoryHubSessionStore();
		const now = 1_000_000;
		await store.applyAuthSession('https://hub.example.com', FIXTURE_SESSION, now - 900_000, 'refresh-token');

		let fetchCount = 0;
		const http = {
			fetch: async () => {
				fetchCount += 1;
				await new Promise(resolve => setTimeout(resolve, 20));
				return {
					status: 200,
					headers: {
						getSetCookie: () => ['hub_refresh=rotated-refresh; Path=/; HttpOnly'],
					},
					json: async () => ({
						...FIXTURE_SESSION,
						accessToken: 'rotated-access-token',
					}),
				};
			},
		};

		const expiredNow = now;
		assert.ok(isHubSessionTokenExpired(now - 60_000, expiredNow));

		const [first, second] = await Promise.all([
			store.refreshIfNeeded('https://hub.example.com', expiredNow, http),
			store.refreshIfNeeded('https://hub.example.com', expiredNow, http),
		]);

		assert.strictEqual(fetchCount, 1);
		assert.ok(first.ok);
		assert.ok(second.ok);
		assert.strictEqual(store.getAccessTokenForHub('https://hub.example.com', expiredNow + 1), 'rotated-access-token');
	});

	test('encryption unavailable fail-closed on refresh', async () => {
		const store = new InMemoryHubSessionStore({ encryptionAvailable: false });
		const result = await store.refreshIfNeeded('https://hub.example.com', Date.now(), {
			fetch: async () => ({ status: 200, json: async () => FIXTURE_SESSION }),
		});
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_encryption_unavailable');
		}
	});

	test('refreshHubAuthSession rejects missing refresh token', async () => {
		const result = await refreshHubAuthSession(
			{ hubBaseUrl: 'https://hub.example.com', refreshToken: '', csrfToken: 'csrf' },
			{ fetch: async () => ({ status: 200, json: async () => FIXTURE_SESSION }) },
		);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_refresh_missing');
		}
	});

	test('HubSessionStore encrypts refresh token to APPLICATION/MACHINE storage', async () => {
		const encryption = new TestEncryptionService(true);
		const storage = new TestApplicationStorageMainService();
		const store = new HubSessionStore(encryption, storage.asService());
		const now = 1_000_000;
		await store.applyAuthSession('https://hub.example.com', FIXTURE_SESSION, now, 'refresh-token');

		const refreshKey = 'universeAgent.secret.hubRefresh.' + encodeURIComponent('https://hub.example.com');
		assert.ok(storage.has(refreshKey), 'refresh secret should be persisted when encryption is available');
		const encrypted = storage.get(refreshKey, StorageScope.APPLICATION);
		assert.ok(encrypted?.startsWith('enc:'), 'stored value should be encrypted');

		const decrypted = JSON.parse(encrypted!.slice('enc:'.length)) as { refreshToken: string; csrfToken: string };
		assert.strictEqual(decrypted.refreshToken, 'refresh-token');
		assert.strictEqual(decrypted.csrfToken, 'csrf-token');
		assert.strictEqual(store.getAccessTokenForHub('https://hub.example.com', now + 100), 'hub-access-token');
	});

	test('HubSessionStore does not persist refresh when encryption unavailable', async () => {
		const encryption = new TestEncryptionService(false);
		const storage = new TestApplicationStorageMainService();
		const store = new HubSessionStore(encryption, storage.asService());
		const now = 1_000_000;
		await store.applyAuthSession('https://hub.example.com', FIXTURE_SESSION, now, 'refresh-token');

		const refreshKey = 'universeAgent.secret.hubRefresh.' + encodeURIComponent('https://hub.example.com');
		assert.ok(!storage.has(refreshKey), 'refresh secret must not be written when encryption is unavailable');
		assert.strictEqual(store.getAccessTokenForHub('https://hub.example.com', now + 100), 'hub-access-token');
		assert.strictEqual(await store.isEncryptionAvailable(), false);
	});

	test('HubSessionStore clear removes persisted refresh secret', async () => {
		const encryption = new TestEncryptionService(true);
		const storage = new TestApplicationStorageMainService();
		const store = new HubSessionStore(encryption, storage.asService());
		const now = 1_000_000;
		await store.applyAuthSession('https://hub.example.com', FIXTURE_SESSION, now, 'refresh-token');
		await store.clear('https://hub.example.com');

		const refreshKey = 'universeAgent.secret.hubRefresh.' + encodeURIComponent('https://hub.example.com');
		assert.ok(!storage.has(refreshKey));
		assert.strictEqual(store.getAccessTokenForHub('https://hub.example.com', now + 100), null);
	});
});

suite('Client identity store', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('encryption unavailable fail-closed', async () => {
		const store = new InMemoryClientIdentityStore({ encryptionAvailable: false });
		const state = await store.getOrCreateIdentity();
		assert.strictEqual(state.kind, 'encryption_unavailable');
		const signer = await store.createSigner();
		assert.strictEqual(signer, undefined);
	});

	test('creates identity when encryption available', async () => {
		const store = new InMemoryClientIdentityStore();
		const state = await store.getOrCreateIdentity();
		assert.strictEqual(state.kind, 'ready');
		if (state.kind === 'ready') {
			assert.strictEqual(state.identity.clientPublicKey.length, 32);
			assert.match(state.identity.clientIdentityId, /^[0-9a-f]{64}$/);
		}
		const signer = await store.createSigner();
		assert.ok(typeof signer === 'function');
	});

	test('ClientIdentityStore persists encrypted identity to APPLICATION/MACHINE storage', async () => {
		const encryption = new TestEncryptionService(true);
		const storage = new TestApplicationStorageMainService();
		const store = new ClientIdentityStore(encryption, storage.asService());

		const first = await store.getOrCreateIdentity();
		assert.strictEqual(first.kind, 'ready');
		assert.ok(storage.has('universeAgent.secret.deviceIdentity'));

		const encrypted = storage.get('universeAgent.secret.deviceIdentity', StorageScope.APPLICATION);
		assert.ok(encrypted?.startsWith('enc:'));

		const second = await store.getOrCreateIdentity();
		assert.strictEqual(second.kind, 'ready');
		if (first.kind === 'ready' && second.kind === 'ready') {
			assert.strictEqual(second.identity.clientIdentityId, first.identity.clientIdentityId);
		}
	});

	test('ClientIdentityStore does not persist identity when encryption unavailable', async () => {
		const encryption = new TestEncryptionService(false);
		const storage = new TestApplicationStorageMainService();
		const store = new ClientIdentityStore(encryption, storage.asService());

		const state = await store.getOrCreateIdentity();
		assert.strictEqual(state.kind, 'encryption_unavailable');
		assert.ok(!storage.has('universeAgent.secret.deviceIdentity'));
		assert.strictEqual(await store.createSigner(), undefined);
	});
});
