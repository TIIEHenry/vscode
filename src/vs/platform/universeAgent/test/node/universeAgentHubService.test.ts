/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { randomUUID } from 'node:crypto';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ParsedAuthSessionV1 } from '../../node/hub/hub-auth-client.js';
import type { ConnectionProfile, IConnectionProfileStore } from '../../node/connectionProfileStore.js';
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

	test('refreshDirectory maps expired-access network failure to unreachable', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');

		let devicesFetchCount = 0;
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => FIXTURE_NOW_MS + 900_000,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/auth/refresh')) {
						throw new Error('connect ECONNREFUSED');
					}
					if (url.includes('/devices')) {
						devicesFetchCount++;
						return { status: 200, json: async () => ({ devices: [] }) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});

		service.setActiveHubBaseUrl(HUB_BASE);
		const status = await service.refreshDirectory();

		assert.strictEqual(status.kind, 'unreachable');
		if (status.kind === 'unreachable') {
			assert.strictEqual(status.reason, 'hub refresh request failed: connect ECONNREFUSED');
		}
		assert.strictEqual(service.getAuthStatus().kind, 'signedOut');
		assert.strictEqual(devicesFetchCount, 0);
		service.dispose();
	});

	test('refreshDirectory maps expired-access refresh HTTP 500 to unreachable', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');

		let devicesFetchCount = 0;
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => FIXTURE_NOW_MS + 900_000,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/auth/refresh')) {
						return { status: 500, json: async () => ({}) };
					}
					if (url.includes('/devices')) {
						devicesFetchCount++;
						return { status: 200, json: async () => ({ devices: [] }) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});

		service.setActiveHubBaseUrl(HUB_BASE);
		const status = await service.refreshDirectory();

		assert.strictEqual(status.kind, 'unreachable');
		if (status.kind === 'unreachable') {
			assert.strictEqual(status.reason, 'hub refresh HTTP 500');
		}
		assert.notStrictEqual(service.getAuthStatus().kind, 'authExpired');
		assert.strictEqual(devicesFetchCount, 0);
		service.dispose();
	});

	test('refreshDirectory maps expired-access refresh HTTP 403 to authExpired', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');

		let devicesFetchCount = 0;
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => FIXTURE_NOW_MS + 900_000,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/auth/refresh')) {
						return { status: 403, json: async () => ({}) };
					}
					if (url.includes('/devices')) {
						devicesFetchCount++;
						return { status: 200, json: async () => ({ devices: [] }) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});

		service.setActiveHubBaseUrl(HUB_BASE);
		const status = await service.refreshDirectory();

		assert.strictEqual(status.kind, 'authExpired');
		assert.strictEqual(service.getAuthStatus().kind, 'authExpired');
		assert.strictEqual(devicesFetchCount, 0);
		service.dispose();
	});

	test('addHubDeviceProfile creates then reuses a hubDevice profile', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => FIXTURE_NOW_MS,
			skipStartupRestore: true,
		});
		service.setActiveHubBaseUrl(HUB_BASE);

		const first = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1', displayName: 'Studio' });
		assert.strictEqual(first.ok, true);
		const second = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1', displayName: 'Studio' });
		assert.strictEqual(second.ok, true);
		if (first.ok && second.ok) {
			assert.strictEqual(first.profileId, second.profileId);
		}
		const profiles = service.listConnectionProfiles();
		assert.strictEqual(profiles.length, 1);
		assert.strictEqual(profiles[0].displayName, 'Studio');
		assert.strictEqual(profiles[0].targetKind, 'hubDevice');
		service.dispose();
	});

	test('addHubDeviceProfile refuses when Hub is signed out', async () => {
		const service = new UniverseAgentHubService({
			hubSessionStore: new InMemoryHubSessionStore(),
			skipStartupRestore: true,
		});
		const result = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1' });
		assert.strictEqual(result.ok, false);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_session_required');
		}
		service.dispose();
	});
});

const FIXTURE_NOW_MS = Date.parse('2026-01-01T00:00:00Z');

class TestConnectionProfileStore implements IConnectionProfileStore {
	private profiles: ConnectionProfile[] = [];

	list(): ConnectionProfile[] {
		return [...this.profiles];
	}

	get(profileId: string): ConnectionProfile | undefined {
		return this.profiles.find(p => p.profileId === profileId);
	}

	put(profile: ConnectionProfile): void {
		this.profiles = this.profiles.filter(p => p.profileId !== profile.profileId);
		this.profiles.push(profile);
	}

	remove(profileId: string): void {
		this.profiles = this.profiles.filter(p => p.profileId !== profileId);
	}

	createDraft(input: {
		readonly displayName: string;
		readonly target: ConnectionProfile['target'];
		readonly allowPrivateNetwork?: boolean;
	}): ConnectionProfile {
		const profile: ConnectionProfile = {
			profileId: randomUUID(),
			displayName: input.displayName,
			target: input.target,
			trust: null,
			state: 'pairingPending',
			allowPrivateNetwork: input.allowPrivateNetwork ?? false,
		};
		this.put(profile);
		return profile;
	}
}

suite('UniverseAgentHubService addHubDeviceProfile', () => {

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

	test('signedIn creates hubDevice profile with accountId userId and reuses same id', async () => {
		const profileStore = new TestConnectionProfileStore();
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			connectionProfileStore: profileStore,
			nowMs: () => FIXTURE_NOW_MS,
			skipStartupRestore: true,
		});
		service.setActiveHubBaseUrl(HUB_BASE);

		const first = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1', displayName: 'Studio' });
		const second = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1', displayName: 'Studio' });
		assert.strictEqual(first.ok, true);
		assert.strictEqual(second.ok, true);
		if (first.ok && second.ok) {
			assert.strictEqual(first.profileId, second.profileId);
			const stored = profileStore.get(first.profileId);
			assert.ok(stored && stored.target.kind === 'hubDevice');
			if (stored.target.kind === 'hubDevice') {
				assert.strictEqual(stored.target.accountId, 'usr_1');
				assert.strictEqual(stored.target.hubDeviceId, 'dev-1');
			}
		}
		service.dispose();
	});

	test('signedOut refuses with hub_session_required', async () => {
		const service = new UniverseAgentHubService({
			hubSessionStore: new InMemoryHubSessionStore(),
			skipStartupRestore: true,
		});
		const result = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1' });
		assert.strictEqual(result.ok, false);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_session_required');
		}
		service.dispose();
	});

	test('mustChangePassword refuses with hub_password_change_required', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, {
			...FIXTURE_SESSION,
			mustChangePassword: true,
		}, FIXTURE_NOW_MS, 'refresh-token');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => FIXTURE_NOW_MS,
			skipStartupRestore: true,
		});
		service.setActiveHubBaseUrl(HUB_BASE);
		const result = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1' });
		assert.strictEqual(result.ok, false);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_password_change_required');
		}
		service.dispose();
	});
});

suite('UniverseAgentHubService revokeDevice (GC-2)', () => {

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
	const FIXTURE_NOW_MS = 1_700_000_000_000;

	test('revokeDevice marks matching hubDevice profiles revoked', async () => {
		const profileStore = new TestConnectionProfileStore();
		const profile = profileStore.createDraft({
			displayName: 'Studio',
			target: { kind: 'hubDevice', hubBaseUrl: HUB_BASE, accountId: 'usr_1', hubDeviceId: 'dev-1' },
		});
		profileStore.put(profile);
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			connectionProfileStore: profileStore,
			nowMs: () => FIXTURE_NOW_MS,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/revoke')) {
						return { status: 200, json: async () => ({}) };
					}
					if (url.includes('/devices')) {
						return { status: 200, json: async () => ({ devices: [] }) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});
		service.setActiveHubBaseUrl(HUB_BASE);
		const result = await service.revokeDevice('dev-1');
		assert.strictEqual(result.ok, true);
		const stored = profileStore.get(profile.profileId);
		assert.ok(stored);
		assert.strictEqual(stored?.state, 'revoked');
		service.dispose();
	});

	test('revokeDevice marks only the hub captured before refreshDirectory', async () => {
		const otherHub = 'https://other.example.com';
		const profileStore = new TestConnectionProfileStore();
		const kept = profileStore.createDraft({
			displayName: 'Other',
			target: { kind: 'hubDevice', hubBaseUrl: otherHub, accountId: 'usr_1', hubDeviceId: 'dev-1' },
		});
		const marked = profileStore.createDraft({
			displayName: 'This',
			target: { kind: 'hubDevice', hubBaseUrl: HUB_BASE, accountId: 'usr_1', hubDeviceId: 'dev-1' },
		});
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			connectionProfileStore: profileStore,
			nowMs: () => FIXTURE_NOW_MS,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/revoke')) {
						service.setActiveHubBaseUrl(otherHub);
						return { status: 200, json: async () => ({}) };
					}
					if (url.includes('/devices')) {
						return { status: 200, json: async () => ({ devices: [] }) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});
		service.setActiveHubBaseUrl(HUB_BASE);
		const result = await service.revokeDevice('dev-1');
		assert.strictEqual(result.ok, true);
		assert.strictEqual(service.getActiveHubBaseUrl(), otherHub);
		assert.strictEqual(profileStore.get(marked.profileId)?.state, 'revoked');
		assert.strictEqual(profileStore.get(kept.profileId)?.state, 'pairingPending');
		service.dispose();
	});

	test('revokeDevice treats host case and default port as the same hub', async () => {
		const profileStore = new TestConnectionProfileStore();
		const alias = profileStore.createDraft({
			displayName: 'Alias',
			target: { kind: 'hubDevice', hubBaseUrl: 'https://Example.com:443/', accountId: 'usr_1', hubDeviceId: 'dev-1' },
		});
		const other = profileStore.createDraft({
			displayName: 'Other',
			target: { kind: 'hubDevice', hubBaseUrl: 'https://other.example.com', accountId: 'usr_1', hubDeviceId: 'dev-1' },
		});
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession('https://example.com', FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			connectionProfileStore: profileStore,
			nowMs: () => FIXTURE_NOW_MS,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/revoke')) {
						return { status: 200, json: async () => ({}) };
					}
					if (url.includes('/devices')) {
						return { status: 200, json: async () => ({ devices: [] }) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});
		service.setActiveHubBaseUrl('https://Example.com:443/');
		assert.strictEqual(service.getActiveHubBaseUrl(), 'https://example.com');
		const result = await service.revokeDevice('dev-1');
		assert.strictEqual(result.ok, true);
		assert.strictEqual(profileStore.get(alias.profileId)?.state, 'revoked');
		assert.strictEqual(profileStore.get(other.profileId)?.state, 'pairingPending');
		service.dispose();
	});
});

suite('UniverseAgentHubService auth secret rotation', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const FIXTURE_SESSION: ParsedAuthSessionV1 = {
		accessToken: 'hub-access-token',
		expiresIn: 900,
		csrfToken: 'old-csrf',
		mustChangePassword: false,
		user: {
			id: 'usr_1',
			email: 'user@example.com',
			role: 'USER',
			status: 'ACTIVE',
		},
	};

	const HUB_BASE = 'https://hub.example.com';
	const NOW = 1_700_000_000_000;

	function nextSession(accessToken: string, csrfToken: string, email = 'user@example.com'): ParsedAuthSessionV1 {
		return {
			...FIXTURE_SESSION,
			accessToken,
			csrfToken,
			user: { ...FIXTURE_SESSION.user, email },
		};
	}

	test('changePassword without a refresh cookie drops the old secret', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, NOW, 'old-refresh');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => NOW,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/auth/change-password')) {
						return {
							status: 200,
							json: async () => nextSession('after-password-access', 'after-password-csrf', 'next@example.com'),
						};
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});
		service.setActiveHubBaseUrl(HUB_BASE);
		const result = await service.changePassword('old-secret', 'new-secret');
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(hubSessionStore.listPersistedHubBaseUrls(), []);
		assert.strictEqual(hubSessionStore.getAccessTokenForHub(HUB_BASE, NOW), 'after-password-access');
		const auth = service.getAuthStatus();
		assert.strictEqual(auth.kind, 'signedIn');
		if (auth.kind === 'signedIn') {
			assert.strictEqual(auth.email, 'next@example.com');
		}

		let refreshCalls = 0;
		const forced = await hubSessionStore.refreshIfNeeded(HUB_BASE, NOW, {
			fetch: async () => {
				refreshCalls++;
				return { status: 200, json: async () => FIXTURE_SESSION };
			},
		}, { force: true });
		assert.strictEqual(refreshCalls, 0);
		assert.strictEqual(forced.ok, false);
		if (!forced.ok) {
			assert.strictEqual(forced.code, 'hub_refresh_missing');
		}
		service.dispose();
	});

	test('changePassword with a refresh cookie replaces refresh and csrf', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, NOW, 'old-refresh');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => NOW,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/auth/change-password')) {
						return {
							status: 200,
							headers: { getSetCookie: () => ['hub_refresh=new-refresh; Path=/; HttpOnly'] },
							json: async () => nextSession('after-password-access', 'after-password-csrf'),
						};
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});
		service.setActiveHubBaseUrl(HUB_BASE);
		const result = await service.changePassword('old-secret', 'new-secret');
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(hubSessionStore.listPersistedHubBaseUrls(), [HUB_BASE]);

		let cookie = '';
		const forced = await hubSessionStore.refreshIfNeeded(HUB_BASE, NOW, {
			fetch: async (_url: string, init?: { readonly headers?: Readonly<Record<string, string>> }) => {
				cookie = init?.headers?.Cookie ?? '';
				return {
					status: 200,
					headers: { getSetCookie: () => ['hub_refresh=rotated-refresh; Path=/; HttpOnly'] },
					json: async () => nextSession('rotated-access', 'after-password-csrf'),
				};
			},
		}, { force: true });
		assert.strictEqual(forced.ok, true);
		assert.ok(cookie.includes('hub_refresh=new-refresh'));
		assert.ok(cookie.includes('hub_csrf=after-password-csrf'));
		assert.ok(!cookie.includes('old-refresh'));
		assert.ok(!cookie.includes('old-csrf'));
		service.dispose();
	});

	test('login without a refresh cookie drops the previous secret', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, NOW, 'old-refresh');
		let refreshCalls = 0;
		const http = {
			fetch: async (url: string) => {
				if (url.includes('/auth/login')) {
					return {
						status: 200,
						json: async () => nextSession('login-access', 'login-csrf', 'next@example.com'),
					};
				}
				if (url.includes('/auth/refresh')) {
					refreshCalls++;
					return { status: 200, json: async () => FIXTURE_SESSION };
				}
				if (url.includes('/devices')) {
					return { status: 200, json: async () => ({ devices: [] }) };
				}
				throw new Error(`unexpected fetch url: ${url}`);
			},
		};
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => NOW,
			skipStartupRestore: true,
			http,
		});
		const result = await service.login(HUB_BASE, 'user@example.com', 'secret');
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(hubSessionStore.listPersistedHubBaseUrls(), []);
		assert.strictEqual(hubSessionStore.getAccessTokenForHub(HUB_BASE, NOW), 'login-access');
		const forced = await hubSessionStore.refreshIfNeeded(HUB_BASE, NOW, http, { force: true });
		assert.strictEqual(refreshCalls, 0);
		assert.strictEqual(forced.ok, false);
		if (!forced.ok) {
			assert.strictEqual(forced.code, 'hub_refresh_missing');
		}
		service.dispose();
	});
});

suite('UniverseAgentHubService canonical hub URL', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const FIXTURE_SESSION: ParsedAuthSessionV1 = {
		accessToken: 'hub-access-token',
		expiresIn: 900,
		csrfToken: 'old-csrf',
		mustChangePassword: false,
		user: {
			id: 'usr_1',
			email: 'user@example.com',
			role: 'USER',
			status: 'ACTIVE',
		},
	};

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

	test('login stores the normalized URL and still refreshes after access expiry', async () => {
		let now = 1_000_000;
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession('https://example.com', FIXTURE_SESSION, now, 'old-refresh');
		const profileStore = new TestConnectionProfileStore();
		const seeded = profileStore.createDraft({
			displayName: 'Studio',
			target: { kind: 'hubDevice', hubBaseUrl: 'https://Example.com:443/', accountId: 'usr_1', hubDeviceId: 'dev-1' },
		});
		let refreshCookies = '';
		const service = new UniverseAgentHubService({
			hubSessionStore,
			connectionProfileStore: profileStore,
			nowMs: () => now,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string, init?: { readonly headers?: Readonly<Record<string, string>> }) => {
					if (url.includes('/auth/login')) {
						return {
							status: 200,
							headers: { getSetCookie: () => ['hub_refresh=login-refresh; Path=/; HttpOnly'] },
							json: async () => ({
								...FIXTURE_SESSION,
								accessToken: 'login-access',
								csrfToken: 'login-csrf',
							}),
						};
					}
					if (url.includes('/auth/refresh')) {
						refreshCookies = init?.headers?.Cookie ?? '';
						return {
							status: 200,
							headers: { getSetCookie: () => ['hub_refresh=rotated-refresh; Path=/; HttpOnly'] },
							json: async () => ({
								...FIXTURE_SESSION,
								accessToken: 'refreshed-access',
								csrfToken: 'login-csrf',
							}),
						};
					}
					if (url.includes('/devices')) {
						return { status: 200, json: async () => ({ devices: [FIXTURE_DEVICE] }) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});

		const loginResult = await service.login('https://Example.com:443/', 'user@example.com', 'secret');
		assert.strictEqual(loginResult.ok, true);
		assert.strictEqual(service.getActiveHubBaseUrl(), 'https://example.com');
		assert.deepStrictEqual(hubSessionStore.listPersistedHubBaseUrls(), ['https://example.com']);

		now = 1_000_000 + 900_000;
		const status = await service.refreshDirectory();
		assert.strictEqual(status.kind, 'ok');
		assert.ok(refreshCookies.includes('hub_refresh=login-refresh'));
		assert.ok(refreshCookies.includes('hub_csrf=login-csrf'));
		assert.ok(!refreshCookies.includes('old-refresh'));
		assert.ok(!refreshCookies.includes('old-csrf'));

		const added = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1', displayName: 'Studio' });
		assert.strictEqual(added.ok, true);
		if (added.ok) {
			assert.strictEqual(added.profileId, seeded.profileId);
		}
		service.setActiveHubBaseUrl('https://EXAMPLE.com');
		const again = await service.addHubDeviceProfile({ hubDeviceId: 'dev-1' });
		assert.strictEqual(again.ok, true);
		if (added.ok && again.ok) {
			assert.strictEqual(again.profileId, added.profileId);
		}
		service.dispose();
	});

	test('setActiveHubBaseUrl ignores a non-root path and login rejects it', async () => {
		const service = new UniverseAgentHubService({
			hubSessionStore: new InMemoryHubSessionStore(),
			nowMs: () => 1_000_000,
			skipStartupRestore: true,
			http: {
				fetch: async () => {
					throw new Error('invalid hub URL must not be dialed');
				},
			},
		});
		service.setActiveHubBaseUrl('https://hub.example.com');
		service.setActiveHubBaseUrl('https://hub.example.com/prefix');
		assert.strictEqual(service.getActiveHubBaseUrl(), 'https://hub.example.com');
		const loginResult = await service.login('https://hub.example.com/prefix', 'user@example.com', 'secret');
		assert.strictEqual(loginResult.ok, false);
		if (!loginResult.ok) {
			assert.strictEqual(loginResult.code, 'hub_auth_contract_invalid');
		}
		assert.strictEqual(service.getActiveHubBaseUrl(), 'https://hub.example.com');
		service.setActiveHubBaseUrl('   ');
		assert.strictEqual(service.getActiveHubBaseUrl(), undefined);
		service.dispose();
	});
});

suite('UniverseAgentHubService directory failure badge', () => {

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

	test('directory HTTP failure after a successful refresh clears authExpired', async () => {
		let now = FIXTURE_NOW_MS + 1_000;
		let refreshCalls = 0;
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => now,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/auth/refresh')) {
						refreshCalls++;
						if (refreshCalls === 1) {
							return { status: 401, json: async () => ({}) };
						}
						return {
							status: 200,
							headers: { getSetCookie: () => ['hub_refresh=rotated-refresh; Path=/; HttpOnly'] },
							json: async () => ({
								...FIXTURE_SESSION,
								accessToken: 'refreshed-access',
							}),
						};
					}
					if (url.includes('/devices')) {
						if (refreshCalls < 2) {
							return { status: 401, json: async () => ({}) };
						}
						return { status: 503, json: async () => ({}) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});
		service.setActiveHubBaseUrl(HUB_BASE);
		const expired = await service.refreshDirectory();
		assert.strictEqual(expired.kind, 'authExpired');
		assert.strictEqual(service.getAuthStatus().kind, 'authExpired');

		now = FIXTURE_NOW_MS + 900_000;
		const status = await service.refreshDirectory();
		assert.strictEqual(status.kind, 'unreachable');
		assert.notStrictEqual(service.getAuthStatus().kind, 'authExpired');
		assert.strictEqual(service.getAuthStatus().kind, 'signedIn');
		service.dispose();
	});

	test('directory HTTP failure without access leaves authExpired set', async () => {
		let now = FIXTURE_NOW_MS + 1_000;
		let deviceCalls = 0;
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');
		const service = new UniverseAgentHubService({
			hubSessionStore,
			nowMs: () => now,
			skipStartupRestore: true,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/auth/refresh')) {
						return { status: 401, json: async () => ({}) };
					}
					if (url.includes('/devices')) {
						deviceCalls++;
						if (deviceCalls === 1) {
							return { status: 401, json: async () => ({}) };
						}
						now = FIXTURE_NOW_MS + 900_000;
						return { status: 503, json: async () => ({}) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});
		service.setActiveHubBaseUrl(HUB_BASE);
		const expired = await service.refreshDirectory();
		assert.strictEqual(expired.kind, 'authExpired');

		const status = await service.refreshDirectory();
		assert.strictEqual(status.kind, 'unreachable');
		assert.strictEqual(service.getAuthStatus().kind, 'authExpired');
		service.dispose();
	});
});
