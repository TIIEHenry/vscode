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
	readonly privateKeyPkcs8: Uint8Array;
};

function mintTestIdentity(): TestIdentityMaterial {
	const { publicKey } = generateKeyPairSync('ed25519');
	const spki = publicKey.export({ type: 'spki', format: 'der' });
	const clientPublicKey = Uint8Array.from(spki.subarray(spki.length - 32));
	const clientIdentityId = createHash('sha256').update(clientPublicKey).digest('hex');
	return { clientIdentityId, clientPublicKey, privateKeyPkcs8: new Uint8Array() };
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

function directAddressProfile(overrides: Partial<ConnectionProfile> = {}): ConnectionProfile {
	const leafDer = randomBytes(32);
	const trust = createEngineTrustRecord({
		leafDer,
		engineIdentityId: '0123456789abcdef'.repeat(4),
		establishedAt: FIXTURE_NOW_MS,
	});
	return {
		profileId: PROFILE_ID,
		displayName: 'Direct Engine',
		target: { kind: 'directAddress', host: '203.0.113.10', port: 7443 },
		trust,
		state: 'active',
		allowPrivateNetwork: false,
		...overrides,
	};
}

function loopbackProfile(socketOrPort: string | number = 50051): ConnectionProfile {
	return {
		profileId: PROFILE_ID,
		displayName: 'Loopback Engine',
		target: { kind: 'loopback', socketOrPort },
		trust: null,
		state: 'active',
		allowPrivateNetwork: false,
	};
}

function createResolverHarness(input: {
	readonly profile: ConnectionProfile;
	readonly devices?: HubDevice[];
	readonly listDevices?: Parameters<NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['listDevices']>> extends never ? never : NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['listDevices']>;
	readonly issueRelayTicketFn?: NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['issueRelayTicketFn']>;
	readonly http?: NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['http']>;
	readonly resolveHost?: (host: string) => Promise<readonly string[]>;
	readonly nowMs?: () => number;
}): {
	readonly resolver: ConnectionResolver;
	readonly issueRelayTicketCalls: Array<{ hubDeviceId: string; nowMs: number }>;
} {
	const identity = mintTestIdentity();
	const hubSessionStore = new InMemoryHubSessionStore();
	awaitableApplyAuthSession(hubSessionStore);

	const issueRelayTicketCalls: Array<{ hubDeviceId: string; nowMs: number }> = [];
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
		http: input.http,
		resolveHost: input.resolveHost,
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

	test('dial cache drops a relay ticket only after it is handed off', async () => {
		const paths: Array<NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['http']> | undefined> = [
			undefined,
			{ fetch: async () => { throw new Error('dial cache test must not fetch'); } },
		];
		for (const http of paths) {
			const { resolver } = createResolverHarness({ profile: hubProfile(), http });
			const cached = await resolver.resolve(PROFILE_ID);
			const probed = await resolver.resolve(PROFILE_ID, { useRelayTicketCache: false });
			const stillCached = await resolver.resolve(PROFILE_ID);
			assert.ok(cached.ok && probed.ok && stillCached.ok);
			if (!cached.ok || !probed.ok || !stillCached.ok) {
				continue;
			}
			assert.strictEqual(stillCached.endpoint.relayTicketId, cached.endpoint.relayTicketId);
			assert.notStrictEqual(probed.endpoint.relayTicketId, cached.endpoint.relayTicketId);

			const renewed = await resolver.resolve(PROFILE_ID, {
				forPairing: true,
				forceNewTicket: true,
				useRelayTicketCache: false,
			});
			const afterRenew = await resolver.resolve(PROFILE_ID);
			assert.ok(renewed.ok && afterRenew.ok);
			if (!renewed.ok || !afterRenew.ok) {
				continue;
			}
			assert.strictEqual(afterRenew.endpoint.relayTicketId, cached.endpoint.relayTicketId);
			assert.notStrictEqual(renewed.endpoint.relayTicketId, cached.endpoint.relayTicketId);

			resolver.consumeRelayTicket('missing-profile');
			resolver.consumeRelayTicket(PROFILE_ID);
			const handedOff = await resolver.resolve(PROFILE_ID);
			const forced = await resolver.resolve(PROFILE_ID, { forceNewTicket: true });
			const reusedForced = await resolver.resolve(PROFILE_ID);
			assert.ok(handedOff.ok && forced.ok && reusedForced.ok);
			if (!handedOff.ok || !forced.ok || !reusedForced.ok) {
				continue;
			}
			assert.notStrictEqual(handedOff.endpoint.relayTicketId, cached.endpoint.relayTicketId);
			assert.notStrictEqual(forced.endpoint.relayTicketId, handedOff.endpoint.relayTicketId);
			assert.strictEqual(reusedForced.endpoint.relayTicketId, forced.endpoint.relayTicketId);
		}
	});

	test('direct address resolves without relay ticket', async () => {
		let issueCount = 0;
		const { resolver } = createResolverHarness({
			profile: directAddressProfile(),
			issueRelayTicketFn: async () => {
				issueCount++;
				return { ok: false, code: 'hub_ticket_http_failed', reason: 'must not issue ticket for direct address' };
			},
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(result.ok);
		if (result.ok) {
			assert.strictEqual(result.endpoint.relayTicketId, null);
			assert.strictEqual(result.endpoint.path, 'direct');
			assert.strictEqual(result.allowRelayFallback, false);
			assert.strictEqual(result.endpoint.authority, '203.0.113.10');
			assert.strictEqual(result.endpoint.port, 7443);
		}
		assert.strictEqual(issueCount, 0);
	});

	test('direct address rejects RFC1918 host by default', async () => {
		for (const host of ['192.168.1.1', '10.0.0.1', '172.16.0.1', '127.0.0.1', 'localhost']) {
			const { resolver } = createResolverHarness({
				profile: directAddressProfile({
					target: { kind: 'directAddress', host, port: 7443 },
					allowPrivateNetwork: false,
				}),
			});
			const result = await resolver.resolve(PROFILE_ID);
			assert.ok(!result.ok, `expected private host ${host} to be rejected`);
			if (!result.ok) {
				assert.strictEqual(result.code, 'private_network_denied');
				assert.strictEqual(result.allowRelayFallback, false);
			}
		}
	});

	test('direct address allows private host when allowPrivateNetwork is true', async () => {
		const { resolver } = createResolverHarness({
			profile: directAddressProfile({
				target: { kind: 'directAddress', host: '192.168.1.10', port: 50051 },
				allowPrivateNetwork: true,
			}),
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(result.ok);
		if (result.ok) {
			assert.strictEqual(result.endpoint.relayTicketId, null);
			assert.strictEqual(result.endpoint.path, 'direct');
		}
	});

	test('literal private addresses are denied before resolveHost', async () => {
		const hosts = [
			'fd00::1',
			'[fd00::1]',
			'fc00::1',
			'FD00::1',
			'::1',
			'[::1]',
			'0:0:0:0:0:0:0:1',
			'fe80::1',
			'fe80::1%eth0',
			'[fe80::1%eth0]',
			'169.254.1.1',
			'::ffff:10.0.0.1',
			'[::ffff:192.168.1.1]',
			'::ffff:169.254.1.1',
			'::ffff:127.0.0.1',
		];
		for (const host of hosts) {
			let lookups = 0;
			const { resolver } = createResolverHarness({
				profile: directAddressProfile({
					target: { kind: 'directAddress', host, port: 7443 },
					allowPrivateNetwork: false,
				}),
				resolveHost: async () => {
					lookups++;
					return ['1.1.1.1'];
				},
			});
			const result = await resolver.resolve(PROFILE_ID);
			assert.strictEqual(result.ok, false, host);
			if (!result.ok) {
				assert.strictEqual(result.code, 'private_network_denied', host);
				assert.strictEqual(result.allowRelayFallback, false, host);
			}
			assert.strictEqual(lookups, 0, host);
		}
	});

	test('unspecified and this-network literals are denied before resolveHost', async () => {
		const hosts = [
			'0.0.0.0',
			'0.1.2.3',
			'0.255.255.255',
			'000.000.000.000',
			'::',
			'[::]',
			'0::0',
			'0:0:0:0:0:0:0:0',
			'::%eth0',
			'[::%eth0]',
			'::ffff:0.0.0.0',
			'[::ffff:0.1.2.3]',
			'::ffff:0:1',
			'::FFFF:0.0.0.0',
		];
		for (const host of hosts) {
			let lookups = 0;
			const { resolver } = createResolverHarness({
				profile: directAddressProfile({
					target: { kind: 'directAddress', host, port: 7443 },
					allowPrivateNetwork: false,
				}),
				resolveHost: async () => {
					lookups++;
					return ['1.1.1.1'];
				},
			});
			const result = await resolver.resolve(PROFILE_ID);
			assert.strictEqual(result.ok, false, host);
			if (!result.ok) {
				assert.strictEqual(result.code, 'private_network_denied', host);
				assert.strictEqual(result.allowRelayFallback, false, host);
				assert.strictEqual('endpoint' in result, false, host);
			}
			assert.strictEqual(lookups, 0, host);
		}
	});

	test('direct address allows checked private hosts and public literals', async () => {
		for (const host of ['fd00::1', '[fd00::1]', 'fe80::1', '169.254.1.1', '0.0.0.0', '::', '[::]', '0.1.2.3', '::ffff:0.0.0.0']) {
			const { resolver } = createResolverHarness({
				profile: directAddressProfile({
					target: { kind: 'directAddress', host, port: 7443 },
					allowPrivateNetwork: true,
				}),
			});
			const result = await resolver.resolve(PROFILE_ID);
			assert.strictEqual(result.ok, true, host);
			if (result.ok) {
				const expected = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
				assert.strictEqual(result.endpoint.resolvedIp, expected, host);
			}
		}
		const allowed: ReadonlyArray<readonly [string, string]> = [
			['1.1.1.1', '1.1.1.1'],
			['172.32.0.1', '172.32.0.1'],
			['2001:db8::1', '2001:db8::1'],
			['[2001:db8::1]', '2001:db8::1'],
			['::ffff:8.8.8.8', '::ffff:8.8.8.8'],
			['fec0::1', 'fec0::1'],
			['1.0.0.0', '1.0.0.0'],
			['::2', '::2'],
			['0:0:0:0:0:0:0:2', '0:0:0:0:0:0:0:2'],
		];
		for (const [host, resolvedIp] of allowed) {
			const { resolver } = createResolverHarness({
				profile: directAddressProfile({
					target: { kind: 'directAddress', host, port: 7443 },
					allowPrivateNetwork: false,
				}),
			});
			const result = await resolver.resolve(PROFILE_ID);
			assert.strictEqual(result.ok, true, host);
			if (result.ok) {
				assert.strictEqual(result.endpoint.resolvedIp, resolvedIp, host);
			}
		}
	});

	test('any resolved private address denies the dial without writing resolvedIp', async () => {
		const lists = [
			['1.1.1.1', '10.0.0.1'],
			['2001:db8::5', '::ffff:10.0.0.1'],
			['8.8.8.8', 'fe80::1%eth0'],
			['1.1.1.1', '0.0.0.0'],
			['2001:db8::5', '::'],
			['8.8.8.8', '::ffff:0.1.2.3'],
		];
		for (const addresses of lists) {
			const { resolver } = createResolverHarness({
				profile: directAddressProfile({
					target: { kind: 'directAddress', host: 'engine.example', port: 7443 },
				}),
				resolveHost: async host => {
					assert.strictEqual(host, 'engine.example');
					return addresses;
				},
			});
			const result = await resolver.resolve(PROFILE_ID);
			assert.strictEqual(result.ok, false, addresses.join(','));
			if (!result.ok) {
				assert.strictEqual(result.code, 'private_network_denied');
				assert.strictEqual('endpoint' in result, false);
			}
			const encoded = JSON.stringify(result);
			for (const address of addresses) {
				assert.strictEqual(encoded.includes(address), false, address);
			}
		}

		const { resolver } = createResolverHarness({
			profile: directAddressProfile({
				target: { kind: 'directAddress', host: 'engine.example', port: 7443 },
			}),
			resolveHost: async () => ['2001:db8::5', '1.1.1.1'],
		});
		const allowed = await resolver.resolve(PROFILE_ID);
		assert.strictEqual(allowed.ok, true);
		if (allowed.ok) {
			assert.strictEqual(allowed.endpoint.resolvedIp, '2001:db8::5');
		}
	});

	test('resolveHost rejection or empty list is transport_failed and does not throw', async () => {
		const rejecting = createResolverHarness({
			profile: directAddressProfile({
				target: { kind: 'directAddress', host: 'engine.example', port: 7443 },
			}),
			resolveHost: async () => {
				throw new Error('dns down');
			},
		});
		const rejected = await rejecting.resolver.resolve(PROFILE_ID);
		assert.strictEqual(rejected.ok, false);
		if (!rejected.ok) {
			assert.strictEqual(rejected.code, 'transport_failed');
			assert.strictEqual(rejected.allowRelayFallback, false);
		}

		const empty = createResolverHarness({
			profile: directAddressProfile({
				target: { kind: 'directAddress', host: 'engine.example', port: 7443 },
			}),
			resolveHost: async () => [],
		});
		const emptied = await empty.resolver.resolve(PROFILE_ID);
		assert.strictEqual(emptied.ok, false);
		if (!emptied.ok) {
			assert.strictEqual(emptied.code, 'transport_failed');
			assert.strictEqual(emptied.allowRelayFallback, false);
		}

		const loopbackDown = createResolverHarness({
			profile: loopbackProfile(),
			resolveHost: async () => {
				throw new Error('loopback dns');
			},
		});
		const loopbackResult = await loopbackDown.resolver.resolve(PROFILE_ID);
		assert.strictEqual(loopbackResult.ok, false);
		if (!loopbackResult.ok) {
			assert.strictEqual(loopbackResult.code, 'transport_failed');
			assert.strictEqual(loopbackResult.allowRelayFallback, false);
		}
	});

	test('loopback target is not rejected by the private-network gate', async () => {
		const { resolver } = createResolverHarness({
			profile: loopbackProfile(),
			resolveHost: async host => {
				assert.strictEqual(host, '127.0.0.1');
				return ['127.0.0.1'];
			},
		});
		const result = await resolver.resolve(PROFILE_ID);
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.endpoint.path, 'loopback');
			assert.strictEqual(result.endpoint.resolvedIp, '127.0.0.1');
		}

		const privateResolved = createResolverHarness({
			profile: loopbackProfile(),
			resolveHost: async () => ['10.0.0.1', 'fd00::1', '0.0.0.0', '::'],
		});
		const allowed = await privateResolved.resolver.resolve(PROFILE_ID);
		assert.strictEqual(allowed.ok, true);
		if (allowed.ok) {
			assert.strictEqual(allowed.endpoint.resolvedIp, '10.0.0.1');
			assert.strictEqual(allowed.endpoint.path, 'loopback');
		}
	});

	test('hub relay denies any resolved authority address and drops a ticket cached in that arm', async () => {
		const paths: Array<NonNullable<ConstructorParameters<typeof ConnectionResolver>[0]['http']> | undefined> = [
			undefined,
			{ fetch: async () => { throw new Error('private relay test must not fetch'); } },
		];
		for (const http of paths) {
			let issueCount = 0;
			const { resolver } = createResolverHarness({
				profile: hubProfile(),
				http,
				resolveHost: async () => ['10.1.2.3'],
				issueRelayTicketFn: async () => {
					issueCount++;
					return {
						ok: true as const,
						ticketId: `ticket-${issueCount}`,
						authority: 'r-private.example.com',
						expiresAtMs: Date.parse(FIXTURE_TICKET_EXPIRES_AT),
					};
				},
			});
			const first = await resolver.resolve(PROFILE_ID);
			const second = await resolver.resolve(PROFILE_ID);
			assert.strictEqual(first.ok, false);
			assert.strictEqual(second.ok, false);
			if (!first.ok && !second.ok) {
				assert.strictEqual(first.code, 'private_network_denied');
				assert.strictEqual(second.code, 'private_network_denied');
				assert.strictEqual(JSON.stringify(first).includes('10.1.2.3'), false);
			}
			assert.strictEqual(issueCount, 2);
		}

		const { resolver } = createResolverHarness({
			profile: hubProfile(),
			devices: [{ ...FIXTURE_DEVICE, ipv4: '10.0.0.1', ipv6: 'fd00::9' }],
			resolveHost: async host => {
				assert.strictEqual(host, FIXTURE_AUTHORITY);
				return ['203.0.113.50'];
			},
		});
		const ignoredDirectory = await resolver.resolve(PROFILE_ID);
		assert.strictEqual(ignoredDirectory.ok, true);
		if (ignoredDirectory.ok) {
			assert.strictEqual(ignoredDirectory.endpoint.resolvedIp, '203.0.113.50');
		}

		let failedIssues = 0;
		const failed = createResolverHarness({
			profile: hubProfile(),
			resolveHost: async () => {
				throw new Error('relay dns');
			},
			issueRelayTicketFn: async () => {
				failedIssues++;
				return {
					ok: true as const,
					ticketId: `ticket-${failedIssues}`,
					authority: FIXTURE_AUTHORITY,
					expiresAtMs: Date.parse(FIXTURE_TICKET_EXPIRES_AT),
				};
			},
		});
		const firstFailure = await failed.resolver.resolve(PROFILE_ID);
		const secondFailure = await failed.resolver.resolve(PROFILE_ID);
		assert.strictEqual(firstFailure.ok, false);
		assert.strictEqual(secondFailure.ok, false);
		if (!firstFailure.ok && !secondFailure.ok) {
			assert.strictEqual(firstFailure.code, 'transport_failed');
			assert.strictEqual(firstFailure.allowRelayFallback, false);
			assert.strictEqual(secondFailure.code, 'transport_failed');
		}
		assert.strictEqual(failedIssues, 1);
	});

	test('hub relay denies unspecified authority addresses and drops the cached ticket', async () => {
		let issueCount = 0;
		const { resolver } = createResolverHarness({
			profile: hubProfile(),
			resolveHost: async () => ['0.0.0.0', '::'],
			issueRelayTicketFn: async () => {
				issueCount++;
				return {
					ok: true as const,
					ticketId: `ticket-${issueCount}`,
					authority: 'r-unspecified.example.com',
					expiresAtMs: Date.parse(FIXTURE_TICKET_EXPIRES_AT),
				};
			},
		});
		const first = await resolver.resolve(PROFILE_ID);
		const second = await resolver.resolve(PROFILE_ID);
		assert.strictEqual(first.ok, false);
		assert.strictEqual(second.ok, false);
		if (!first.ok && !second.ok) {
			assert.strictEqual(first.code, 'private_network_denied');
			assert.strictEqual(second.code, 'private_network_denied');
			const encoded = JSON.stringify(first);
			assert.strictEqual(encoded.includes('0.0.0.0'), false);
			assert.strictEqual(encoded.includes('::'), false);
		}
		assert.strictEqual(issueCount, 2);
	});

	test('expired access refreshes then directory resolve succeeds', async () => {
		const sessionApplyTime = FIXTURE_NOW_MS;
		const expiredNow = FIXTURE_NOW_MS + 900_000;
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, {
			accessToken: 'expired-token',
			expiresIn: 900,
			csrfToken: 'csrf-token',
			mustChangePassword: false,
			user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
		}, sessionApplyTime, 'refresh-token');

		const identity = mintTestIdentity();
		let devicesFetchCount = 0;
		const http = {
			fetch: async (url: string, init?: { readonly headers?: Readonly<Record<string, string>> }) => {
				if (url.includes('/auth/refresh')) {
					return {
						status: 200,
						headers: { getSetCookie: () => ['hub_refresh=rotated-refresh; Path=/; HttpOnly'] },
						json: async () => ({
							accessToken: 'fresh-token',
							expiresIn: 900,
							csrfToken: 'csrf-token',
							mustChangePassword: false,
							user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
						}),
					};
				}
				if (url.includes('/devices')) {
					devicesFetchCount++;
					assert.strictEqual(init?.headers?.Authorization, 'Bearer fresh-token');
					return {
						status: 200,
						json: async () => ({
							devices: [{
								id: HUB_DEVICE_ID,
								name: 'Engine',
								presence: 'ONLINE',
								engineStatus: 'SERVING',
								engineIdentityId: FIXTURE_DEVICE.engineIdentityId,
								certFingerprint: FIXTURE_DEVICE.certFingerprint,
								ipv4: FIXTURE_DEVICE.ipv4,
								ipv6: null,
								enginePort: FIXTURE_DEVICE.enginePort,
								revoked: false,
								lastHeartbeatAt: FIXTURE_DEVICE.lastHeartbeatAt,
							}],
						}),
					};
				}
				throw new Error(`unexpected fetch url: ${url}`);
			},
		};

		const resolver = createConnectionResolver({
			connectionProfileStore: new InMemoryConnectionProfileStore([hubProfile()]),
			hubSessionStore,
			clientIdentityStore: new TestClientIdentityStore(identity),
			http,
			issueRelayTicketFn: async () => ({
				ok: true as const,
				ticketId: 'ticket-after-refresh',
				authority: FIXTURE_AUTHORITY,
				expiresAtMs: Date.parse(FIXTURE_TICKET_EXPIRES_AT),
			}),
			nowMs: () => expiredNow,
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(result.ok);
		if (result.ok) {
			assert.strictEqual(result.endpoint.relayTicketId, 'ticket-after-refresh');
		}
		assert.strictEqual(devicesFetchCount, 1);
	});

	test('directory 401 with refresh failure returns hub_auth_expired without retry storm', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, {
			accessToken: 'stale-token',
			expiresIn: 900,
			csrfToken: 'csrf-token',
			mustChangePassword: false,
			user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
		}, FIXTURE_NOW_MS, 'refresh-token');

		const identity = mintTestIdentity();
		let devicesFetchCount = 0;
		let refreshFetchCount = 0;
		const http = {
			fetch: async (url: string) => {
				if (url.includes('/auth/refresh')) {
					refreshFetchCount++;
					return { status: 401, json: async () => ({}) };
				}
				if (url.includes('/devices')) {
					devicesFetchCount++;
					return { status: 401, json: async () => ({}) };
				}
				throw new Error(`unexpected fetch url: ${url}`);
			},
		};

		const resolver = createConnectionResolver({
			connectionProfileStore: new InMemoryConnectionProfileStore([hubProfile()]),
			hubSessionStore,
			clientIdentityStore: new TestClientIdentityStore(identity),
			http,
			issueRelayTicketFn: async () => ({
				ok: false as const,
				code: 'hub_ticket_http_failed',
				reason: 'must not issue ticket when auth expired',
			}),
			nowMs: () => FIXTURE_NOW_MS + 1000,
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_auth_expired');
		}
		assert.strictEqual(devicesFetchCount, 1);
		assert.strictEqual(refreshFetchCount, 1);
	});

	test('expired access with refresh 401 skips directory call', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, {
			accessToken: 'expired-token',
			expiresIn: 900,
			csrfToken: 'csrf-token',
			mustChangePassword: false,
			user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
		}, FIXTURE_NOW_MS, 'refresh-token');

		const identity = mintTestIdentity();
		let devicesFetchCount = 0;
		const http = {
			fetch: async (url: string) => {
				if (url.includes('/auth/refresh')) {
					return { status: 401, json: async () => ({}) };
				}
				if (url.includes('/devices')) {
					devicesFetchCount++;
					return { status: 200, json: async () => ({ devices: [] }) };
				}
				throw new Error(`unexpected fetch url: ${url}`);
			},
		};

		const resolver = createConnectionResolver({
			connectionProfileStore: new InMemoryConnectionProfileStore([hubProfile()]),
			hubSessionStore,
			clientIdentityStore: new TestClientIdentityStore(identity),
			http,
			nowMs: () => FIXTURE_NOW_MS + 900_000,
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_auth_expired');
		}
		assert.strictEqual(devicesFetchCount, 0);
	});

	test('expired access with refresh network failure returns hub_unreachable and keeps the refresh reason', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, {
			accessToken: 'expired-token',
			expiresIn: 900,
			csrfToken: 'csrf-token',
			mustChangePassword: false,
			user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
		}, FIXTURE_NOW_MS, 'refresh-token');

		const identity = mintTestIdentity();
		let devicesFetchCount = 0;
		let ticketCalls = 0;
		const http = {
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
		};

		const resolver = createConnectionResolver({
			connectionProfileStore: new InMemoryConnectionProfileStore([hubProfile()]),
			hubSessionStore,
			clientIdentityStore: new TestClientIdentityStore(identity),
			http,
			issueRelayTicketFn: async () => {
				ticketCalls++;
				return {
					ok: false as const,
					code: 'hub_ticket_http_failed',
					reason: 'must not issue ticket when hub is unreachable',
				};
			},
			nowMs: () => FIXTURE_NOW_MS + 900_000,
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_unreachable');
			assert.strictEqual(result.reason, 'hub refresh request failed: connect ECONNREFUSED');
		}
		assert.strictEqual(devicesFetchCount, 0);
		assert.strictEqual(ticketCalls, 0);
	});

	test('expired access with refresh HTTP 500 returns hub_unreachable and keeps the refresh reason', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, {
			accessToken: 'expired-token',
			expiresIn: 900,
			csrfToken: 'csrf-token',
			mustChangePassword: false,
			user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
		}, FIXTURE_NOW_MS, 'refresh-token');

		const identity = mintTestIdentity();
		let devicesFetchCount = 0;
		const http = {
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
		};

		const resolver = createConnectionResolver({
			connectionProfileStore: new InMemoryConnectionProfileStore([hubProfile()]),
			hubSessionStore,
			clientIdentityStore: new TestClientIdentityStore(identity),
			http,
			nowMs: () => FIXTURE_NOW_MS + 900_000,
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_unreachable');
			assert.strictEqual(result.reason, 'hub refresh HTTP 500');
		}
		assert.strictEqual(devicesFetchCount, 0);
	});

	test('expired access with refresh HTTP 403 returns hub_auth_expired', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, {
			accessToken: 'expired-token',
			expiresIn: 900,
			csrfToken: 'csrf-token',
			mustChangePassword: false,
			user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
		}, FIXTURE_NOW_MS, 'refresh-token');

		const identity = mintTestIdentity();
		let devicesFetchCount = 0;
		const http = {
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
		};

		const resolver = createConnectionResolver({
			connectionProfileStore: new InMemoryConnectionProfileStore([hubProfile()]),
			hubSessionStore,
			clientIdentityStore: new TestClientIdentityStore(identity),
			http,
			nowMs: () => FIXTURE_NOW_MS + 900_000,
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_auth_expired');
		}
		assert.strictEqual(devicesFetchCount, 0);
	});

	test('ticket refresh HTTP 500 stays hub_unreachable instead of hub_ticket_failed', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, {
			accessToken: 'hub-access-token',
			expiresIn: 900,
			csrfToken: 'csrf-token',
			mustChangePassword: false,
			user: { id: 'usr-1', email: 'user@example.com', role: 'USER', status: 'ACTIVE' },
		}, FIXTURE_NOW_MS, 'refresh-token');

		const identity = mintTestIdentity();
		let refreshFetchCount = 0;
		const http = {
			fetch: async (url: string) => {
				if (url.includes('/auth/refresh')) {
					refreshFetchCount++;
					return { status: 500, json: async () => ({}) };
				}
				if (url.includes('/devices')) {
					return {
						status: 200,
						json: async () => ({
							devices: [{
								id: HUB_DEVICE_ID,
								name: 'Engine',
								presence: 'ONLINE',
								engineStatus: 'SERVING',
								engineIdentityId: FIXTURE_DEVICE.engineIdentityId,
								certFingerprint: FIXTURE_DEVICE.certFingerprint,
								ipv4: FIXTURE_DEVICE.ipv4,
								ipv6: null,
								enginePort: FIXTURE_DEVICE.enginePort,
								revoked: false,
								lastHeartbeatAt: FIXTURE_DEVICE.lastHeartbeatAt,
							}],
						}),
					};
				}
				throw new Error(`unexpected fetch url: ${url}`);
			},
		};

		const resolver = createConnectionResolver({
			connectionProfileStore: new InMemoryConnectionProfileStore([hubProfile()]),
			hubSessionStore,
			clientIdentityStore: new TestClientIdentityStore(identity),
			http,
			issueRelayTicketFn: async () => ({
				ok: false as const,
				code: 'hub_forbidden',
				reason: 'ticket request denied with HTTP 403',
			}),
			nowMs: () => FIXTURE_NOW_MS,
		});

		const result = await resolver.resolve(PROFILE_ID);
		assert.ok(!result.ok);
		if (!result.ok) {
			assert.strictEqual(result.code, 'hub_unreachable');
			assert.strictEqual(result.reason, 'hub refresh HTTP 500');
		}
		assert.strictEqual(refreshFetchCount, 1);
	});
});
