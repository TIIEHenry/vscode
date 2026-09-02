/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ConnectionProfile, IConnectionProfileStore } from '../../node/connectionProfileStore.js';
import { createEngineTrustRecord } from '../../node/engineTrustStore.js';
import type { IClientIdentityStore } from '../../node/clientIdentityTypes.js';
import { ConnectionResolver, createConnectionResolver } from '../../node/connectionResolver.js';
import type { HubDevice } from '../../node/hubDirectoryClient.js';
import { InMemoryHubSessionStore } from '../../node/hubSessionStore.js';

const HUB_BASE = 'https://hub.example.com';
const HUB_DEVICE_ID = 'dev-hub-1';
const PROFILE_ID = '11111111-1111-4111-8111-111111111111';
const FIXTURE_NOW_MS = Date.parse('2026-01-01T00:00:00Z');
const FIXTURE_AUTHORITY = 'r-noncefixture01.a.example.com';
const FIXTURE_TICKET_EXPIRES_AT = '2030-01-01T00:00:00Z';

const FIXTURE_DEVICE: HubDevice = {
	id: HUB_DEVICE_ID,
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

type TestIdentityMaterial = {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
};

function mintTestIdentity(): TestIdentityMaterial {
	const { publicKey } = generateKeyPairSync('ed25519');
	const spki = publicKey.export({ type: 'spki', format: 'der' });
	const clientPublicKey = Uint8Array.from(spki.subarray(spki.length - 32));
	const clientIdentityId = createHash('sha256').update(clientPublicKey).digest('hex');
	return { clientIdentityId, clientPublicKey };
}

class TestClientIdentityStore implements IClientIdentityStore {

	constructor(private readonly identity: TestIdentityMaterial) { }

	async getState(): Promise<import('../../node/clientIdentityTypes.js').ClientIdentityStoreState> {
		return { kind: 'ready', identity: this.identity };
	}

	async getOrCreateIdentity(): Promise<import('../../node/clientIdentityTypes.js').ClientIdentityStoreState> {
		return { kind: 'ready', identity: this.identity };
	}

	async createSigner(): Promise<undefined> {
		return undefined;
	}
}

class InMemoryConnectionProfileStore implements IConnectionProfileStore {

	constructor(private readonly profiles: ConnectionProfile[]) { }

	list(): ConnectionProfile[] {
		return [...this.profiles];
	}

	get(profileId: string): ConnectionProfile | undefined {
		return this.profiles.find(profile => profile.profileId === profileId);
	}

	put(profile: ConnectionProfile): void {
		const index = this.profiles.findIndex(entry => entry.profileId === profile.profileId);
		if (index >= 0) {
			this.profiles[index] = profile;
		} else {
			this.profiles.push(profile);
		}
	}

	remove(profileId: string): void {
		const index = this.profiles.findIndex(profile => profile.profileId === profileId);
		if (index >= 0) {
			this.profiles.splice(index, 1);
		}
	}

	createDraft(_input: {
		readonly displayName: string;
		readonly target: ConnectionProfile['target'];
		readonly allowPrivateNetwork?: boolean;
	}): ConnectionProfile {
		throw new Error('not implemented');
	}
}

function hubProfile(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
	const leafDer = randomBytes(32);
	const trust = createEngineTrustRecord({
		leafDer,
		engineIdentityId: FIXTURE_DEVICE.engineIdentityId!,
		establishedAt: FIXTURE_NOW_MS,
	});
	return {
		profileId: PROFILE_ID,
		displayName: 'Remote Engine',
		target: {
			kind: 'hubDevice',
			hubBaseUrl: HUB_BASE,
			accountId: 'acct-1',
			hubDeviceId: HUB_DEVICE_ID,
		},
		trust,
		state: 'active',
		allowPrivateNetwork: false,
		...overrides,
	};
}

function createResolverHarness(input: {
	readonly profile: ConnectionProfile;
	readonly devices?: HubDevice[];
	readonly listDevices?: Parameters<NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['listDevices']>> extends never ? never : NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['listDevices']>;
	readonly issueRelayTicketFn?: NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['issueRelayTicketFn']>;
	readonly nowMs?: () => number;
}): {
	readonly resolver: ConnectionResolver;
	readonly issueRelayTicketCalls: Array<{ hubDeviceId: string; nowMs: number }>;
} {
	const identity = mintTestIdentity();
	const hubSessionStore = new InMemoryHubSessionStore();
	awaitableApplyAuthSession(hubSessionStore);

	let issueRelayTicketCalls: Array<{ hubDeviceId: string; nowMs: number }> = [];
	let ticketCounter = 0;

	const resolver = createConnectionResolver({
		connectionProfileStore: new InMemoryConnectionProfileStore([input.profile]),
		hubSessionStore,
		clientIdentityStore: new TestClientIdentityStore(identity),
		listDevices: input.listDevices ?? (async () => ({
			ok: true as const,
			value: input.devices ?? [FIXTURE_DEVICE],
		})),
		issueRelayTicketFn: input.issueRelayTicketFn ?? (async (ticketInput) => {
			issueRelayTicketCalls.push({
				hubDeviceId: ticketInput.hubDeviceId,
				nowMs: ticketInput.nowMs,
			});
			ticketCounter++;
			return {
				ok: true as const,
				ticketId: `ticket-${ticketCounter}`,
				authority: FIXTURE_AUTHORITY,
				expiresAtMs: Date.parse(FIXTURE_TICKET_EXPIRES_AT),
			};
		}),
		nowMs: input.nowMs ?? (() => FIXTURE_NOW_MS),
	});

	return { resolver, issueRelayTicketCalls };
}

function awaitableApplyAuthSession(hubSessionStore: InMemoryHubSessionStore): void {
	void hubSessionStore.applyAuthSession(HUB_BASE, {
		accessToken: 'hub-access-token',
		expiresIn: 900,
		csrfToken: 'csrf-token',
		mustChangePassword: false,
		user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
	}, FIXTURE_NOW_MS);
}

suite('ConnectionResolver', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('live directory missing device id rejects dial', async () => {
		const { resolver } = createResolverHarness({
			profile: hubProfile(),
			devices: [{
				...FIXTURE_DEVICE,
				id: 'other-device',
			}],
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_device_not_in_directory');
			assert.strictEqual(result.allowRelayFallback, true);
		}
	});

	test('revoked device rejects dial', async () => {
		const { resolver, issueRelayTicketCalls } = createResolverHarness({
			profile: hubProfile(),
			devices: [{
				...FIXTURE_DEVICE,
				revoked: true,
			}],
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_device_revoked');
		}
		assert.strictEqual(issueRelayTicketCalls.length, 0);
	});

	test('401 directory response maps to hub_auth_expired without issuing ticket', async () => {
		const { resolver, issueRelayTicketCalls } = createResolverHarness({
			profile: hubProfile(),
			listDevices: async () => ({
				ok: false,
				code: 'hub_session_required',
				reason: 'directory request denied with HTTP 401',
			}),
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_auth_expired');
		}
		assert.strictEqual(issueRelayTicketCalls.length, 0);
	});

	test('expired ticket TTL is not reused', async () => {
		let nowMs = FIXTURE_NOW_MS;
		let issueCount = 0;
		const { resolver } = createResolverHarness({
			profile: hubProfile(),
			nowMs: () => nowMs,
			issueRelayTicketFn: async (ticketInput) => {
				issueCount++;
				return {
					ok: true,
					ticketId: `ticket-at-${ticketInput.nowMs}`,
					authority: FIXTURE_AUTHORITY,
					expiresAtMs: FIXTURE_NOW_MS + 60_000,
				};
			},
		});

		const first = await resolver.resolve(PROFILE_ID);
		assert.ok(first.ok);
		if (first.ok) {
			assert.strictEqual(first.endpoint.relayTicketId, `ticket-at-${FIXTURE_NOW_MS}`);
		}

		nowMs = FIXTURE_NOW_MS + 120_000;
		const second = await resolver.resolve(PROFILE_ID);
		assert.ok(second.ok);
		if (second.ok) {
			assert.strictEqual(second.endpoint.relayTicketId, `ticket-at-${FIXTURE_NOW_MS + 120_000}`);
		}
		assert.strictEqual(issueCount, 2);
	});

	test('reconnect forces a new relay ticket', async () => {
		const { resolver, issueRelayTicketCalls } = createResolverHarness({
			profile: hubProfile(),
		});

		const first = await resolver.resolve(PROFILE_ID);
		const second = await resolver.resolve(PROFILE_ID, { forceNewTicket: true });

		assert.ok(first.ok && second.ok);
		if (first.ok && second.ok) {
			assert.notStrictEqual(first.endpoint.relayTicketId, second.endpoint.relayTicketId);
			assert.strictEqual(first.endpoint.relayTicketId, 'ticket-1');
			assert.strictEqual(second.endpoint.relayTicketId, 'ticket-2');
		}
		assert.strictEqual(issueRelayTicketCalls.length, 2);
	});

	test('successful hub resolve returns allowRelayFallback and hubRelay path', async () => {
		const { resolver } = createResolverHarness({
			profile: hubProfile(),
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(result.ok);
		if (result.ok) {
			assert.strictEqual(result.allowRelayFallback, true);
			assert.strictEqual(result.endpoint.path, 'hubRelay');
			assert.strictEqual(result.endpoint.relayTicketId, 'ticket-1');
			assert.strictEqual(result.endpoint.servername, FIXTURE_AUTHORITY);
		}
	});

	test('createIssueRelayTicketHook delegates to relay ticket client', async () => {
		const { resolver } = createResolverHarness({
			profile: hubProfile(),
		});
		const hook = resolver.createIssueRelayTicketHook();
		const result = await hook({
			hubBaseUrl: HUB_BASE,
			hubDeviceId: HUB_DEVICE_ID,
		});
		assert.ok(result.ok);
		if (result.ok) {
			assert.strictEqual(result.ticketId, 'ticket-1');
		}
	});
});
