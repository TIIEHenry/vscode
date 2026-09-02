/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { parseAuthSessionV1, loginHub } from '../../node/hub/hub-auth-client.js';
import {
	isHubRelayAuthority,
	issueHubRelayTicket,
	parseHubRelayTicketResponse,
} from '../../node/hub/hub-relay-ticket-client.js';

suite('Hub AuthSession contract', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const FIXTURE_SESSION = {
		accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.auth-session',
		expiresIn: 900,
		csrfToken: 'csrf-auth-session-token',
		mustChangePassword: false,
		user: {
			id: 'usr_active_001',
			email: 'user@example.com',
			role: 'USER',
			status: 'ACTIVE',
		},
	};

	test('parseAuthSessionV1 accepts camelCase fixture', () => {
		const result = parseAuthSessionV1(FIXTURE_SESSION);
		assert.ok(result.ok);
		if (result.ok) {
			assert.deepStrictEqual(result.session, FIXTURE_SESSION);
		}
	});

	test('parseAuthSessionV1 rejects snake_case keys', () => {
		const result = parseAuthSessionV1({
			access_token: 'tok',
			expiresIn: 900,
			csrfToken: 'csrf',
			mustChangePassword: false,
			user: FIXTURE_SESSION.user,
		});
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_auth_contract_invalid');
		}
	});

	test('loginHub maps 401 to invalid credentials', async () => {
		const result = await loginHub(
			{
				hubBaseUrl: 'https://hub.example.com',
				email: 'user@example.com',
				password: 'secret',
			},
			{
				fetch: async () => ({ status: 401, json: async () => ({}) }),
			},
		);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_auth_invalid_credentials');
		}
	});
});

suite('Hub relay ticket contract', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const FIXTURE_AUTHORITY = 'r-noncefixture01.a.example.com';
	const FIXTURE_EXPIRES_AT = '2030-01-01T00:00:00Z';
	const FIXTURE_NOW_MS = Date.parse('2026-01-01T00:00:00Z');
	const FIXTURE_RESPONSE = {
		ticketId: 'tix_fixture_deadbeef',
		authority: FIXTURE_AUTHORITY,
		expiresAt: FIXTURE_EXPIRES_AT,
	};

	test('parseHubRelayTicketResponse accepts camelCase fixture', () => {
		const result = parseHubRelayTicketResponse(FIXTURE_RESPONSE, FIXTURE_NOW_MS);
		assert.deepStrictEqual(result, {
			ok: true,
			ticketId: 'tix_fixture_deadbeef',
			authority: FIXTURE_AUTHORITY,
			expiresAtMs: Date.parse(FIXTURE_EXPIRES_AT),
		});
		assert.ok(isHubRelayAuthority(FIXTURE_AUTHORITY));
	});

	test('parseHubRelayTicketResponse rejects snake_case keys', () => {
		const result = parseHubRelayTicketResponse(
			{
				ticket_id: 'tix',
				authority: FIXTURE_AUTHORITY,
				expires_at: FIXTURE_EXPIRES_AT,
			},
			FIXTURE_NOW_MS,
		);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_ticket_contract_invalid');
		}
	});

	test('issueHubRelayTicket fail-closed on empty access token', async () => {
		let called = false;
		const result = await issueHubRelayTicket(
			{
				hubBaseUrl: 'https://hub.example.com',
				hubDeviceId: 'dev-1',
				clientIdentityId: 'a'.repeat(64),
				accessToken: '   ',
				nowMs: FIXTURE_NOW_MS,
			},
			{
				fetch: async () => {
					called = true;
					return { status: 200, json: async () => FIXTURE_RESPONSE };
				},
			},
		);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_session_required');
		}
		assert.strictEqual(called, false);
	});
});
