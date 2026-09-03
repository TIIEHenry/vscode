/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ParsedAuthSessionV1 } from '../../node/hub/hub-auth-client.js';
import { InMemoryHubSessionStore } from '../../node/hubSessionStore.js';
import { UniverseAgentHubService } from '../../node/universeAgentHubService.js';

suite('UniverseAgentHubService startup restore', () => {

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

	const HUB_BASE = 'https://hub.example.com';

	test('constructor restore refreshes persisted session and reports signedIn', async () => {
		const now = 1_000_000;
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, now - 900_000, 'refresh-token');

		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => now,
			http: {
				fetch: async () => ({
					status: 200,
					headers: {
						getSetCookie: () => ['hub_refresh=rotated-refresh; Path=/; HttpOnly'],
					},
					json: async () => ({
						...FIXTURE_SESSION,
						accessToken: 'restored-access-token',
					}),
				}),
			},
		});

		await service.whenStartupRestoreComplete;

		assert.strictEqual(service.getActiveHubBaseUrl(), HUB_BASE);
		const status = service.getAuthStatus();
		assert.strictEqual(status.kind, 'signedIn');
		if (status.kind === 'signedIn') {
			assert.strictEqual(status.email, 'user@example.com');
		}
		service.dispose();
	});

	test('startup refresh failure stays signedOut', async () => {
		const now = 1_000_000;
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, now - 900_000, 'refresh-token');

		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => now,
			skipStartupRestore: true,
			http: {
				fetch: async () => ({
					status: 401,
					json: async () => ({}),
				}),
			},
		});

		await service.restorePersistedHubSessionIfNeeded();

		assert.strictEqual(service.getActiveHubBaseUrl(), HUB_BASE);
		assert.strictEqual(service.getAuthStatus().kind, 'authExpired');
		service.dispose();
	});

	test('no persisted refresh leaves Hub signedOut', async () => {
		const service = new UniverseAgentHubService({
			hubSessionStore: new InMemoryHubSessionStore(),
			skipStartupRestore: true,
		});

		await service.restorePersistedHubSessionIfNeeded();

		assert.strictEqual(service.getActiveHubBaseUrl(), undefined);
		assert.strictEqual(service.getAuthStatus().kind, 'signedOut');
		service.dispose();
	});
});

suite('UniverseAgentHubService runtime refresh', () => {

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

	const HUB_BASE = 'https://hub.example.com';

	const FIXTURE_DEVICE = {
		id: 'dev-1',
		name: 'Engine',
		presence: 'ONLINE' as const,
		engineStatus: 'SERVING' as const,
		engineIdentityId: '0123456789abcdef'.repeat(4),
		certFingerprint: 'fedcba9876543210'.repeat(4),
		ipv4: '203.0.113.10',
		ipv6: null,
		enginePort: 7443,
		revoked: false,
		lastHeartbeatAt: '2026-01-01T00:00:00Z',
	};

	test('refreshDirectory refreshes expired access then lists devices', async () => {
		const sessionApplyTime = 1_000_000;
		const now = sessionApplyTime + 900_000;
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, sessionApplyTime, 'refresh-token');

		let devicesFetchCount = 0;
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => now,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string, init?: { readonly headers?: Readonly<Record<string, string>> }) => {
					if (url.includes('/auth/refresh')) {
						return {
							status: 200,
							headers: { getSetCookie: () => ['hub_refresh=rotated-refresh; Path=/; HttpOnly'] },
							json: async () => ({
								...FIXTURE_SESSION,
								accessToken: 'restored-access-token',
							}),
						};
					}
					if (url.includes('/devices')) {
						devicesFetchCount++;
						assert.strictEqual(init?.headers?.Authorization, 'Bearer restored-access-token');
						return {
							status: 200,
							json: async () => ({ devices: [FIXTURE_DEVICE] }),
						};
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});

		service.setActiveHubBaseUrl(HUB_BASE);
		const status = await service.refreshDirectory();

		assert.strictEqual(status.kind, 'ok');
		if (status.kind === 'ok') {
			assert.strictEqual(status.devices.length, 1);
			assert.strictEqual(status.devices[0].id, 'dev-1');
		}
		assert.strictEqual(service.getAuthStatus().kind, 'signedIn');
		assert.strictEqual(devicesFetchCount, 1);
		service.dispose();
	});

	test('refreshDirectory maps runtime refresh 401 to authExpired', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');

		let devicesFetchCount = 0;
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => FIXTURE_NOW_MS + 1000,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/auth/refresh')) {
						return { status: 401, json: async () => ({}) };
					}
					if (url.includes('/devices')) {
						devicesFetchCount++;
						return { status: 401, json: async () => ({}) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});

		service.setActiveHubBaseUrl(HUB_BASE);
		const status = await service.refreshDirectory();

		assert.strictEqual(status.kind, 'authExpired');
		assert.strictEqual(service.getAuthStatus().kind, 'authExpired');
		assert.strictEqual(devicesFetchCount, 1);
		service.dispose();
	});
});

const FIXTURE_NOW_MS = Date.parse('2026-01-01T00:00:00Z');
