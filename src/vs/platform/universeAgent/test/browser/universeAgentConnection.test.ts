/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { WebUniverseAgentConnection } from '../../browser/universeAgentConnectionService.js';
import { WebUniverseAgentHubService } from '../../browser/universeAgentHubService.js';
import { WebUniverseAgentSessionView } from '../../browser/universeAgentSessionViewService.js';
import { WEB_UNSUPPORTED_CODE, WEB_UNSUPPORTED_REASON } from '../../browser/webUnsupported.js';
import type { UniverseAgentCapabilityKey } from '../../common/universeAgentTypes.js';

const ALL_CAPABILITY_KEYS: readonly UniverseAgentCapabilityKey[] = [
	'skills',
	'mcp',
	'mcpRuntime',
	'plugins',
	'globalRules',
	'agentProfiles',
	'projectRules',
	'tools',
	'hooksMetadata',
	'agentTree',
	'team',
];

suite('Web universeAgent disconnect (P0)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('connection snapshot is idle, all capability keys UNSUPPORTED', () => {
		const connection = new WebUniverseAgentConnection();
		assert.strictEqual(connection.isEngineConnected(), false);
		assert.strictEqual(connection.getTransportState(), 'idle');
		assert.deepStrictEqual(connection.getConnectionPhase(), { kind: 'disconnected' });

		const snapshot = connection.getCapabilitySnapshot();
		assert.deepStrictEqual(Object.keys(snapshot).sort(), [...ALL_CAPABILITY_KEYS].sort());
		for (const key of ALL_CAPABILITY_KEYS) {
			assert.strictEqual(snapshot[key].support, 'UNSUPPORTED');
			assert.strictEqual(snapshot[key].reason, WEB_UNSUPPORTED_REASON);
		}
	});

	test('P1a methods reject unsupported_environment', async () => {
		const connection = new WebUniverseAgentConnection();
		await assert.rejects(() => connection.getMcpServerStatuses(), (error: unknown) => error instanceof Error && error.message === WEB_UNSUPPORTED_REASON);
		await assert.rejects(() => connection.getMcpServerTools('s1'), (error: unknown) => error instanceof Error && error.message === WEB_UNSUPPORTED_REASON);
		await assert.rejects(() => connection.listPlugins(), (error: unknown) => error instanceof Error && error.message === WEB_UNSUPPORTED_REASON);
		await assert.rejects(() => connection.getPluginInfo('p1'), (error: unknown) => error instanceof Error && error.message === WEB_UNSUPPORTED_REASON);
		await assert.rejects(() => connection.enablePlugin('p1'), (error: unknown) => error instanceof Error && error.message === WEB_UNSUPPORTED_REASON);
		await assert.rejects(() => connection.reloadPlugin('p1'), (error: unknown) => error instanceof Error && error.message === WEB_UNSUPPORTED_REASON);
		await assert.rejects(() => connection.unloadPlugin('p1'), (error: unknown) => error instanceof Error && error.message === WEB_UNSUPPORTED_REASON);
		await assert.rejects(() => connection.scanNewPlugins(), (error: unknown) => error instanceof Error && error.message === WEB_UNSUPPORTED_REASON);
	});

	test('connect() does not throw and returns no token', async () => {
		const connection = new WebUniverseAgentConnection();
		const result = await connection.connect({ clientId: 'web', protocolVersion: '1' });
		assert.strictEqual(result.sessionToken, undefined);
		assert.deepStrictEqual(result.methods, []);
		assert.deepStrictEqual(result.events, []);
	});

	test('connectProfile uses unsupported_environment, not transport_failed', async () => {
		const connection = new WebUniverseAgentConnection();
		const result = await connection.connectProfile('profile-1');
		assert.strictEqual(result.ok, false);
		if (!result.ok) {
			assert.strictEqual(result.code, WEB_UNSUPPORTED_CODE);
			assert.notStrictEqual(result.code, 'transport_failed');
			assert.strictEqual(result.reason, WEB_UNSUPPORTED_REASON);
		}
	});

	test('session view lease is empty', async () => {
		const sessionView = new WebUniverseAgentSessionView();
		const leaseId = await sessionView.acquireLease('sess-1');
		assert.ok(leaseId.startsWith('web-empty:'));
		const post = await sessionView.post(leaseId, { kind: 'submitInput', text: 'hi' });
		assert.strictEqual(post.accepted, false);
		const detail = await sessionView.requestDetail(leaseId, '{"toolCallId":"tc","detailKind":1,"refId":"tc"}');
		assert.strictEqual(detail.ok, false);
		if (!detail.ok) {
			assert.strictEqual(detail.reason, 'unavailable');
		}
	});

	test('hub auth is unavailable; login/connect refuse without echoing credentials', async () => {
		const hub = new WebUniverseAgentHubService();
		assert.deepStrictEqual(hub.getAuthStatus(), { kind: 'unavailable' });
		assert.deepStrictEqual(hub.listConnectionProfiles(), []);
		assert.strictEqual(await hub.isEncryptionAvailable(), true);

		const login = await hub.login('https://hub.example', 'user@example.com', 's3cret-password');
		assert.strictEqual(login.ok, false);
		if (!login.ok) {
			assert.strictEqual(login.code, WEB_UNSUPPORTED_CODE);
			assert.ok(!login.reason.includes('s3cret-password'));
			assert.ok(!login.reason.includes('user@example.com'));
		}

		const direct = await hub.addDirectAddressProfile({ host: '127.0.0.1', port: 50051 });
		assert.strictEqual(direct.ok, false);
		if (!direct.ok) {
			assert.strictEqual(direct.code, WEB_UNSUPPORTED_CODE);
		}
	});
});
