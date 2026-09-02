/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	listHubDevices,
	parseHubDevice,
	parseHubDevicesResponse,
} from '../../node/hubDirectoryClient.js';

suite('Hub directory client', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const FIXTURE_DEVICE = {
		id: 'dev-1',
		name: 'Engine',
		presence: 'ONLINE',
		engineStatus: 'SERVING',
		engineIdentityId: '0123456789abcdef'.repeat(4),
		certFingerprint: 'fedcba9876543210'.repeat(4),
		ipv4: '203.0.113.10',
		ipv6: null,
		enginePort: 7443,
		revoked: false,
		lastHeartbeatAt: '2026-01-01T00:00:00Z',
	};

	test('parseHubDevice accepts camelCase fixture', () => {
		const result = parseHubDevice(FIXTURE_DEVICE);
		assert.ok(result.ok);
		if (result.ok) {
			assert.strictEqual(result.device.id, 'dev-1');
			assert.strictEqual(result.device.engineStatus, 'SERVING');
		}
	});

	test('parseHubDevicesResponse rejects snake_case device keys', () => {
		const result = parseHubDevicesResponse({
			devices: [{
				...FIXTURE_DEVICE,
				engine_status: 'SERVING',
			}],
		});
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_directory_contract_invalid');
		}
	});

	test('listHubDevices fail-closed on empty access token', async () => {
		let called = false;
		const result = await listHubDevices(
			{ hubBaseUrl: 'https://hub.example.com', accessToken: '  ' },
			{
				fetch: async () => {
					called = true;
					return { status: 200, json: async () => ({ devices: [] }) };
				},
			},
		);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_session_required');
		}
		assert.strictEqual(called, false);
	});

	test('listHubDevices parses devices response', async () => {
		const result = await listHubDevices(
			{ hubBaseUrl: 'https://hub.example.com', accessToken: 'token' },
			{
				fetch: async () => ({
					status: 200,
					json: async () => ({ devices: [FIXTURE_DEVICE] }),
				}),
			},
		);
		assert.ok(result.ok);
		if (result.ok) {
			assert.strictEqual(result.value.length, 1);
			assert.strictEqual(result.value[0]?.name, 'Engine');
		}
	});
});
