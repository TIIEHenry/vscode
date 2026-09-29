/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { IEncryptionMainService, KnownStorageProvider } from '../../../encryption/common/encryptionService.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../storage/common/storage.js';
import { ClientIdentityStore, InMemoryClientIdentityStore } from '../../node/clientIdentityStore.js';
import {
	HubSessionStore,
	InMemoryHubSessionStore,
	isHubSessionTokenExpired,
	refreshHubAuthSession,
} from '../../node/hubSessionStore.js';
import type { ParsedAuthSessionV1 } from '../../node/hub/hub-auth-client.js';
import { normalizeHttpsUrl } from '../../node/hub/host-normalize.js';

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

class TestApplicationStorageMainService implements Pick<IStorageService, 'get' | 'store' | 'remove'> {
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

	keys(_scope: StorageScope, _target: StorageTarget): string[] {
		return [...this.data.keys()];
	}

	has(key: string): boolean {
		return this.data.has(key);
	}

	asService(): IStorageService {
		return this as unknown as IStorageService;
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

	test('applyAuthSession without refreshToken drops the persisted secret and keeps the new memory session', async () => {
		const store = new InMemoryHubSessionStore();
		const now = 1_000_000;
		await store.applyAuthSession('https://Example.com:443/', FIXTURE_SESSION, now, 'old-refresh');
		assert.deepStrictEqual(store.listPersistedHubBaseUrls(), ['https://example.com']);

		const nextSession: ParsedAuthSessionV1 = {
			...FIXTURE_SESSION,
			accessToken: 'new-access-token',
			csrfToken: 'new-csrf',
			user: { ...FIXTURE_SESSION.user, id: 'usr_2', email: 'next@example.com' },
		};
		await store.applyAuthSession('https://example.com/', nextSession, now);

		assert.deepStrictEqual(store.listPersistedHubBaseUrls(), []);
		assert.strictEqual(store.getAccessTokenForHub('https://example.com', now + 100), 'new-access-token');
		assert.deepStrictEqual(store.getStatusForHub('https://example.com', now + 100), {
			status: 'signedIn',
			email: 'next@example.com',
		});

		let refreshCalls = 0;
		const refreshed = await store.refreshIfNeeded('https://example.com', now + 100, {
			fetch: async () => {
				refreshCalls++;
				return { status: 200, json: async () => nextSession };
			},
		}, { force: true });
		assert.strictEqual(refreshCalls, 0);
		assert.strictEqual(refreshed.ok, false);
		if (!refreshed.ok) {
			assert.strictEqual(refreshed.code, 'hub_refresh_missing');
		}
	});

	test('applyAuthSession with a new refreshToken replaces refresh and csrf together', async () => {
		const store = new InMemoryHubSessionStore();
		const now = 1_000_000;
		await store.applyAuthSession('https://hub.example.com', FIXTURE_SESSION, now, 'old-refresh');
		const nextSession: ParsedAuthSessionV1 = {
			...FIXTURE_SESSION,
			accessToken: 'new-access-token',
			csrfToken: 'new-csrf',
		};
		await store.applyAuthSession('https://hub.example.com', nextSession, now, 'new-refresh');
		assert.deepStrictEqual(store.listPersistedHubBaseUrls(), ['https://hub.example.com']);

		let cookie = '';
		const refreshed = await store.refreshIfNeeded('https://hub.example.com', now + 100, {
			fetch: async (_url: string, init?: { readonly headers?: Readonly<Record<string, string>> }) => {
				cookie = init?.headers?.Cookie ?? '';
				return {
					status: 200,
					headers: { getSetCookie: () => ['hub_refresh=rotated-refresh; Path=/; HttpOnly'] },
					json: async () => nextSession,
				};
			},
		}, { force: true });
		assert.strictEqual(refreshed.ok, true);
		assert.ok(cookie.includes('hub_refresh=new-refresh'));
		assert.ok(cookie.includes('hub_csrf=new-csrf'));
		assert.ok(!cookie.includes('old-refresh'));
		assert.ok(!cookie.includes('csrf-token'));
	});

	test('HubSessionStore drops and rewrites the encrypted secret with the memory session', async () => {
		const encryption = new TestEncryptionService(true);
		const storage = new TestApplicationStorageMainService();
		const store = new HubSessionStore(encryption, storage.asService());
		const now = 1_000_000;
		const refreshKey = 'universeAgent.secret.hubRefresh.' + encodeURIComponent('https://example.com');
		await store.applyAuthSession('https://Example.com:443/', FIXTURE_SESSION, now, 'old-refresh');
		assert.deepStrictEqual(store.listPersistedHubBaseUrls(), ['https://example.com']);

		const nextSession: ParsedAuthSessionV1 = {
			...FIXTURE_SESSION,
			accessToken: 'new-access-token',
			csrfToken: 'new-csrf',
			user: { ...FIXTURE_SESSION.user, id: 'usr_2' },
		};
		await store.applyAuthSession('https://example.com', nextSession, now);
		assert.deepStrictEqual(store.listPersistedHubBaseUrls(), []);
		assert.ok(!storage.has(refreshKey));
		assert.strictEqual(store.getAccessTokenForHub('https://example.com', now + 100), 'new-access-token');

		await store.applyAuthSession('https://example.com/', nextSession, now, 'new-refresh');
		assert.deepStrictEqual(store.listPersistedHubBaseUrls(), ['https://example.com']);
		const encrypted = storage.get(refreshKey, StorageScope.APPLICATION);
		const decrypted = JSON.parse(encrypted!.slice('enc:'.length)) as { refreshToken: string; csrfToken: string; userId: string };
		assert.deepStrictEqual(decrypted, {
			refreshToken: 'new-refresh',
			csrfToken: 'new-csrf',
			userId: 'usr_2',
		});
	});

	test('normalizeHttpsUrl rejects a non-root path and keeps a trailing slash on the origin', () => {
		const rejected = normalizeHttpsUrl('https://hub.example.com/prefix');
		assert.strictEqual(rejected.ok, false);
		if (!rejected.ok) {
			assert.strictEqual(rejected.reason, 'url must not include a non-root path');
		}
		const rejectedTrailing = normalizeHttpsUrl('https://hub.example.com/prefix/');
		assert.strictEqual(rejectedTrailing.ok, false);
		const accepted = normalizeHttpsUrl('https://hub.example.com/');
		assert.strictEqual(accepted.ok, true);
		if (accepted.ok) {
			assert.strictEqual(accepted.url, 'https://hub.example.com');
		}
	});

	test('refreshHubAuthSession requests /api/v1/auth/refresh on the origin', async () => {
		let requested = '';
		let called = false;
		const rejected = await refreshHubAuthSession(
			{ hubBaseUrl: 'https://hub.example.com/prefix', refreshToken: 'refresh-token', csrfToken: 'csrf-token' },
			{
				fetch: async () => {
					called = true;
					return { status: 200, json: async () => FIXTURE_SESSION };
				},
			},
		);
		assert.strictEqual(called, false);
		assert.strictEqual(rejected.ok, false);
		if (!rejected.ok) {
			assert.strictEqual(rejected.code, 'hub_auth_contract_invalid');
		}

		const accepted = await refreshHubAuthSession(
			{ hubBaseUrl: 'https://hub.example.com/', refreshToken: 'refresh-token', csrfToken: 'csrf-token' },
			{
				fetch: async (url: string) => {
					requested = url;
					return { status: 200, json: async () => FIXTURE_SESSION };
				},
			},
		);
		assert.strictEqual(accepted.ok, true);
		const requestUrl = new URL(requested);
		assert.strictEqual(requestUrl.origin, 'https://hub.example.com');
		assert.strictEqual(requestUrl.pathname, '/api/v1/auth/refresh');
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
