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
		assert.strictEqual(service.getAuthStatus().kind, 'signedIn');
		if (service.getAuthStatus().kind === 'signedIn') {
			assert.strictEqual(service.getAuthStatus().email, 'user@example.com');
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
