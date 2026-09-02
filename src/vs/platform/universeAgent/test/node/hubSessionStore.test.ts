/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { InMemoryClientIdentityStore } from '../../node/clientIdentityStore.js';
import {
	InMemoryHubSessionStore,
	isHubSessionTokenExpired,
	refreshHubAuthSession,
} from '../../node/hubSessionStore.js';
import type { ParsedAuthSessionV1 } from '../../node/hub/hub-auth-client.js';

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
});
