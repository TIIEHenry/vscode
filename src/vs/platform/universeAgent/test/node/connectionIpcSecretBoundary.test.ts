/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { finalizeConnectProfileResult } from '../../common/connectProfileResult.js';
import type { UniverseAgentConnectProfileResult } from '../../common/connectionHubTypes.js';
import {
	createIdleCapabilitySnapshot,
	createIdleConnectionSnapshot,
	UniverseAgentConnectionSyncCache,
} from '../../common/universeAgentRendererSync.js';
import type { UniverseAgentConnectionSnapshot } from '../../common/universeAgentTypes.js';
import type { IClientIdentityStore } from '../../node/clientIdentityTypes.js';
import type { ConnectionResolver } from '../../node/connectionResolver.js';
import type { IUniverseAgentGrpcTransport } from '../../node/grpc/grpcTransport.js';
import { UniverseAgentConnectionService } from '../../node/universeAgentConnectionService.js';

const SECRET = 'ipc-secret-token-elr4';

/**
 * connection-hub-client §6 secret boundary (`accessToken` / `csrf` / `ticketId` / private key),
 * plus `sessionToken` (ELR-4). These names must not appear on connection IPC objects.
 */
const CONNECTION_IPC_FORBIDDEN_SECRET_FIELDS = [
	'sessionToken',
	'accessToken',
	'csrf',
	'csrfToken',
	'ticketId',
	'relayTicketId',
	'privateKey',
	'privateKeyPkcs8',
	'refreshToken',
] as const;

function assertNoForbiddenSecretFields(value: unknown, path = 'value'): void {
	if (!value || typeof value !== 'object') {
		return;
	}
	if (Array.isArray(value)) {
		for (let index = 0; index < value.length; index++) {
			assertNoForbiddenSecretFields(value[index], `${path}[${index}]`);
		}
		return;
	}
	for (const [key, child] of Object.entries(value)) {
		assert.ok(
			!(CONNECTION_IPC_FORBIDDEN_SECRET_FIELDS as readonly string[]).includes(key),
			`${path}.${key} is forbidden on the connection IPC surface`,
		);
		assertNoForbiddenSecretFields(child, `${path}.${key}`);
	}
}

function secretTransport(): IUniverseAgentGrpcTransport {
	const transport = {
		isChannelAlive: true,
		installSessionToken: () => { },
		onDidRejectSessionToken: Event.None,
		onDidObserveUnavailable: Event.None,
		connect: async () => ({
			sessionToken: SECRET,
			workDir: '/tmp/work',
			methods: [] as readonly string[],
			events: [] as readonly string[],
		}),
		close: () => { },
	};
	return transport as unknown as IUniverseAgentGrpcTransport;
}

suite('connection IPC secret boundary (ELR-4)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('forbidden field list includes sessionToken', () => {
		assert.ok(CONNECTION_IPC_FORBIDDEN_SECRET_FIELDS.includes('sessionToken'));
		assert.ok(CONNECTION_IPC_FORBIDDEN_SECRET_FIELDS.includes('accessToken'));
		assert.ok(CONNECTION_IPC_FORBIDDEN_SECRET_FIELDS.includes('csrf'));
		assert.ok(CONNECTION_IPC_FORBIDDEN_SECRET_FIELDS.includes('ticketId'));
		assert.ok(CONNECTION_IPC_FORBIDDEN_SECRET_FIELDS.includes('privateKey'));
	});

	test('finalizeConnectProfileResult drops a smuggled sessionToken', () => {
		const connected = finalizeConnectProfileResult({
			ok: true,
			path: 'direct',
			pairingPending: false,
			authenticated: true,
			workDir: '/tmp/work',
			sessionToken: SECRET,
		} as UniverseAgentConnectProfileResult);
		assert.strictEqual(connected.ok, true);
		if (connected.ok) {
			assert.strictEqual(connected.authenticated, true);
			assert.strictEqual(connected.pairingPending, false);
		}
		assert.strictEqual(JSON.stringify(connected).includes(SECRET), false);
		assertNoForbiddenSecretFields(connected);

		const pairing = finalizeConnectProfileResult({
			ok: true,
			path: 'direct',
			pairingPending: true,
			sasCode: 'ABCD-EFGH',
			sessionToken: SECRET,
		} as UniverseAgentConnectProfileResult);
		assert.strictEqual(pairing.ok, true);
		if (pairing.ok) {
			assert.strictEqual(pairing.authenticated, false);
			assert.strictEqual(pairing.pairingPending, true);
		}
		assert.strictEqual(JSON.stringify(pairing).includes(SECRET), false);
		assertNoForbiddenSecretFields(pairing);
	});

	test('idle snapshot and renderer cache do not keep sessionToken', () => {
		const idle = createIdleConnectionSnapshot();
		assert.strictEqual(idle.authenticated, false);
		assert.strictEqual(Object.hasOwn(idle, 'authenticated'), true);
		assertNoForbiddenSecretFields(idle);

		const cache = new UniverseAgentConnectionSyncCache();
		cache.applySnapshot({
			transport: 'ok',
			authenticated: true,
			pairingPending: false,
			channelAlive: true,
			sharedFsRootSent: false,
			capabilities: createIdleCapabilitySnapshot(),
			sessionToken: SECRET,
		} as UniverseAgentConnectionSnapshot);
		assert.strictEqual(cache.snapshot.authenticated, true);
		assert.strictEqual(JSON.stringify(cache.snapshot).includes(SECRET), false);
		assertNoForbiddenSecretFields(cache.snapshot);
	});

	test('onDidChangeConnection snapshot has authenticated and no session token', async () => {
		const service = store.add(new UniverseAgentConnectionService({
			createTransport: () => secretTransport(),
		}));
		const snapshots: UniverseAgentConnectionSnapshot[] = [];
		store.add(service.onDidChangeConnection(snapshot => { snapshots.push(snapshot); }));
		await service.connect({ clientId: 'elr4', protocolVersion: '1' });
		assert.ok(snapshots.length > 0);
		for (const snapshot of snapshots) {
			assertNoForbiddenSecretFields(snapshot);
			assert.strictEqual(JSON.stringify(snapshot).includes(SECRET), false);
		}
		const current = service.getConnectionSnapshot();
		assert.strictEqual(current.authenticated, true);
		assert.strictEqual(Object.hasOwn(current, 'authenticated'), true);
		assertNoForbiddenSecretFields(current);
		assert.strictEqual(JSON.stringify(current).includes(SECRET), false);
	});

	test('connectProfile result has authenticated and no session token', async () => {
		const material = {
			clientIdentityId: 'a'.repeat(64),
			clientPublicKey: new Uint8Array(32),
			privateKeyPkcs8: new Uint8Array(32),
		};
		const identity: IClientIdentityStore = {
			getState: async () => ({ kind: 'ready', identity: material }),
			getOrCreateIdentity: async () => ({ kind: 'ready', identity: material }),
			createSigner: async () => () => new Uint8Array(64),
		};
		const resolver = {
			resolve: async () => ({
				ok: true as const,
				allowRelayFallback: false as const,
				endpoint: {
					attemptId: 'elr4',
					authority: '127.0.0.1',
					port: 50051,
					resolvedIp: '127.0.0.1',
					servername: '127.0.0.1',
					relayTicketId: null,
					tls: null,
					expiresAtMs: Date.now() + 60_000,
					path: 'direct' as const,
				},
			}),
			consumeRelayTicket: () => { },
		} as unknown as ConnectionResolver;
		const service = store.add(new UniverseAgentConnectionService({
			createTransport: () => secretTransport(),
			connectionResolver: resolver,
			clientIdentityStore: identity,
		}));
		const snapshots: UniverseAgentConnectionSnapshot[] = [];
		store.add(service.onDidChangeConnection(snapshot => { snapshots.push(snapshot); }));
		const result = await service.connectProfile('profile-elr4');
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.authenticated, true);
			assert.strictEqual(result.pairingPending, false);
		}
		assert.strictEqual(JSON.stringify(result).includes(SECRET), false);
		assertNoForbiddenSecretFields(result);
		assert.ok(snapshots.length > 0);
		for (const snapshot of snapshots) {
			assertNoForbiddenSecretFields(snapshot);
			assert.strictEqual(JSON.stringify(snapshot).includes(SECRET), false);
		}
		const current = service.getConnectionSnapshot();
		assert.strictEqual(current.authenticated, true);
		assertNoForbiddenSecretFields(current);
		assert.strictEqual(JSON.stringify(current).includes(SECRET), false);
	});
});
