/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import type { ConnectionFailureCode, ConnectionPath } from '../common/connectionHubTypes.js';
import type { IClientIdentityStore } from './clientIdentityTypes.js';
import type { ConnectionProfile, IConnectionProfileStore } from './connectionProfileStore.js';
import type { PinnedTlsPlanInput } from './deviceGrant/tls-pin.js';
import { listHubDevices, type HubDevice, type HubDirectoryHttp } from './hubDirectoryClient.js';
import { issueHubRelayTicket, type HubRelayTicketHttp, type IssueHubRelayTicketResult } from './hub/hub-relay-ticket-client.js';
import type { HubRefreshHttp, IHubSessionStore } from './hubSessionStore.js';
import { withHubAccessRetry } from './hubAuthAccess.js';

const DEFAULT_HUB_RELAY_PORT = 443;

export type ResolvedEndpoint = {
	readonly attemptId: string;
	readonly authority: string;
	readonly port: number;
	readonly resolvedIp: string;
	readonly servername: string;
	readonly relayTicketId: string | null;
	readonly tls: PinnedTlsPlanInput | null;
	readonly expiresAtMs: number;
	readonly path: ConnectionPath;
};

export type ConnectionResolveResult =
	| { readonly ok: true; readonly endpoint: ResolvedEndpoint; readonly allowRelayFallback: boolean }
	| { readonly ok: false; readonly code: ConnectionFailureCode; readonly reason: string; readonly allowRelayFallback: boolean };

export type IssueRelayTicketInput = {
	readonly hubBaseUrl: string;
	readonly hubDeviceId: string;
};

export type IssueRelayTicketFn = (input: IssueRelayTicketInput) => Promise<IssueHubRelayTicketResult>;

type CachedRelayTicket = {
	readonly ticketId: string;
	readonly authority: string;
	readonly expiresAtMs: number;
};

export type ConnectionResolverDeps = {
	readonly connectionProfileStore: IConnectionProfileStore;
	readonly hubSessionStore: IHubSessionStore;
	readonly clientIdentityStore: IClientIdentityStore;
	readonly http?: HubDirectoryHttp & HubRelayTicketHttp & HubRefreshHttp;
	readonly listDevices?: (
		input: { readonly hubBaseUrl: string; readonly accessToken: string },
		http?: HubDirectoryHttp,
	) => ReturnType<typeof listHubDevices>;
	readonly issueRelayTicketFn?: (
		input: {
			readonly hubBaseUrl: string;
			readonly hubDeviceId: string;
			readonly clientIdentityId: string;
			readonly accessToken: string;
			readonly nowMs: number;
		},
		http?: HubRelayTicketHttp,
	) => Promise<IssueHubRelayTicketResult>;
	readonly resolveHost?: (host: string) => Promise<string>;
	readonly nowMs?: () => number;
};

function isPrivateOrLoopbackHost(host: string): boolean {
	const normalized = host.trim().toLowerCase();
	if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
		return true;
	}
	const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
	if (!ipv4Match) {
		return false;
	}
	const octets = ipv4Match.slice(1).map(part => Number(part));
	if (octets.some(o => o > 255)) {
		return false;
	}
	const [a, b] = octets;
	if (a === 10) {
		return true;
	}
	if (a === 172 && b >= 16 && b <= 31) {
		return true;
	}
	if (a === 192 && b === 168) {
		return true;
	}
	if (a === 127) {
		return true;
	}
	return false;
}

function tlsPlanFromProfileTrust(profile: ConnectionProfile): PinnedTlsPlanInput | null {
	if (!profile.trust) {
		return null;
	}
	return {
		trustAnchorLeafDer: Uint8Array.from(profile.trust.leafDer),
		expectedLeafSha256Hex: profile.trust.leafSha256Hex,
		hostnameVerification: 'replaced-by-pin',
	};
}

function mapDirectoryDenialToFailure(code: string): ConnectionFailureCode {
	if (code === 'hub_session_required' || code === 'hub_forbidden') {
		return 'hub_auth_expired';
	}
	if (code === 'hub_rate_limited') {
		return 'hub_rate_limited';
	}
	return 'hub_unreachable';
}

function mapTicketDenialToFailure(code: string): ConnectionFailureCode {
	if (code === 'hub_session_required' || code === 'hub_forbidden') {
		return 'hub_auth_expired';
	}
	if (code === 'hub_rate_limited') {
		return 'hub_rate_limited';
	}
	return 'hub_ticket_failed';
}

function relayAuthorityHost(authority: string): string {
	return authority.trim();
}

export class ConnectionResolver {

	private readonly ticketCache = new Map<string, CachedRelayTicket>();
	private readonly listDevices: NonNullable<ConnectionResolverDeps['listDevices']>;
	private readonly issueRelayTicketFn: NonNullable<ConnectionResolverDeps['issueRelayTicketFn']>;
	private readonly http: HubDirectoryHttp & HubRelayTicketHttp & HubRefreshHttp | undefined;
	private readonly resolveHost: (host: string) => Promise<string>;
	private readonly nowMs: () => number;

	constructor(private readonly deps: ConnectionResolverDeps) {
		this.listDevices = deps.listDevices ?? listHubDevices;
		this.issueRelayTicketFn = deps.issueRelayTicketFn ?? issueHubRelayTicket;
		this.http = deps.http;
		this.resolveHost = deps.resolveHost ?? (async host => host);
		this.nowMs = deps.nowMs ?? Date.now;
	}

	createIssueRelayTicketHook(): IssueRelayTicketFn {
		return async (input) => {
			const identity = await this.deps.clientIdentityStore.getOrCreateIdentity();
			if (identity.kind !== 'ready') {
				return {
					ok: false,
					code: 'hub_session_required',
					reason: `client identity unavailable: ${identity.kind}`,
				};
			}
			const accessToken = this.deps.hubSessionStore.getAccessTokenForHub(input.hubBaseUrl, this.nowMs());
			if (!accessToken) {
				return {
					ok: false,
					code: 'hub_session_required',
					reason: 'hub access token is required to issue a relay ticket',
				};
			}
			return this.issueRelayTicketFn({
				hubBaseUrl: input.hubBaseUrl,
				hubDeviceId: input.hubDeviceId,
				clientIdentityId: identity.identity.clientIdentityId,
				accessToken,
				nowMs: this.nowMs(),
			});
		};
	}

	async resolve(profileId: string, options: { readonly forceNewTicket?: boolean } = {}): Promise<ConnectionResolveResult> {
		const profile = this.deps.connectionProfileStore.get(profileId);
		if (!profile) {
			return {
				ok: false,
				code: 'trust_missing',
				reason: `connection profile not found: ${profileId}`,
				allowRelayFallback: false,
			};
		}

		switch (profile.target.kind) {
			case 'loopback':
				return this.resolveLoopback(profile);
			case 'directAddress':
				return this.resolveDirectAddress(profile);
			case 'hubDevice':
				return this.resolveHubDevice(profile, options.forceNewTicket === true);
		}
	}

	private async resolveLoopback(profile: ConnectionProfile): Promise<ConnectionResolveResult> {
		if (profile.target.kind !== 'loopback') {
			return {
				ok: false,
				code: 'trust_missing',
				reason: 'expected loopback connection target',
				allowRelayFallback: false,
			};
		}
		const socketOrPort = profile.target.socketOrPort;
		const authority = typeof socketOrPort === 'number' ? `127.0.0.1:${socketOrPort}` : String(socketOrPort);
		const [host, portRaw] = authority.includes(':') ? authority.split(':') : [authority, ''];
		const port = portRaw ? Number(portRaw) : (typeof socketOrPort === 'number' ? socketOrPort : 50051);
		const resolvedIp = await this.resolveHost(host);
		const now = this.nowMs();
		return {
			ok: true,
			allowRelayFallback: false,
			endpoint: {
				attemptId: randomUUID(),
				authority: host,
				port,
				resolvedIp,
				servername: host,
				relayTicketId: null,
				tls: null,
				expiresAtMs: now + 60_000,
				path: 'loopback',
			},
		};
	}

	private async resolveDirectAddress(profile: ConnectionProfile): Promise<ConnectionResolveResult> {
		if (profile.target.kind !== 'directAddress') {
			return {
				ok: false,
				code: 'trust_missing',
				reason: 'expected directAddress connection target',
				allowRelayFallback: false,
			};
		}
		const { host, port } = profile.target;
		if (!profile.allowPrivateNetwork && isPrivateOrLoopbackHost(host)) {
			return {
				ok: false,
				code: 'private_network_denied',
				reason: 'direct address resolves to private or loopback network without allowPrivateNetwork',
				allowRelayFallback: false,
			};
		}
		if (!profile.trust) {
			return {
				ok: false,
				code: 'trust_missing',
				reason: 'direct address dial requires engine trust',
				allowRelayFallback: false,
			};
		}
		const resolvedIp = await this.resolveHost(host);
		const now = this.nowMs();
		return {
			ok: true,
			allowRelayFallback: false,
			endpoint: {
				attemptId: randomUUID(),
				authority: host,
				port,
				resolvedIp,
				servername: host,
				relayTicketId: null,
				tls: tlsPlanFromProfileTrust(profile),
				expiresAtMs: now + 60_000,
				path: 'direct',
			},
		};
	}

	private async resolveHubDevice(profile: ConnectionProfile, forceNewTicket: boolean): Promise<ConnectionResolveResult> {
		if (profile.target.kind !== 'hubDevice') {
			return {
				ok: false,
				code: 'trust_missing',
				reason: 'expected hubDevice connection target',
				allowRelayFallback: true,
			};
		}
		const { hubBaseUrl, hubDeviceId } = profile.target;
		const allowRelayFallback = true;

		if (this.deps.hubSessionStore.requiresPasswordChange(hubBaseUrl, this.nowMs())) {
			return {
				ok: false,
				code: 'hub_password_change_required',
				reason: 'hub session requires password change before relay ticket',
				allowRelayFallback,
			};
		}

		if (!this.http) {
			const accessToken = this.deps.hubSessionStore.getAccessTokenForHub(hubBaseUrl, this.nowMs());
			if (!accessToken) {
				return {
					ok: false,
					code: 'hub_session_required',
					reason: 'hub signed-in session is required',
					allowRelayFallback,
				};
			}
			return this.resolveHubDeviceWithToken(profile, forceNewTicket, accessToken, allowRelayFallback);
		}

		const directoryAccess = await withHubAccessRetry(
			{
				store: this.deps.hubSessionStore,
				hubBaseUrl,
				nowMs: this.nowMs(),
				http: this.http,
			},
			accessToken => this.listDevices({ hubBaseUrl, accessToken }, this.http),
		);

		if ('authExpired' in directoryAccess) {
			return {
				ok: false,
				code: 'hub_auth_expired',
				reason: 'hub session expired during directory lookup',
				allowRelayFallback,
			};
		}

		if (!directoryAccess.ok) {
			return {
				ok: false,
				code: mapDirectoryDenialToFailure(directoryAccess.code),
				reason: directoryAccess.reason,
				allowRelayFallback,
			};
		}

		const device = directoryAccess.value.find(entry => entry.id === hubDeviceId);
		if (!device) {
			return {
				ok: false,
				code: 'hub_device_not_in_directory',
				reason: `hub device ${hubDeviceId} not found in live directory`,
				allowRelayFallback,
			};
		}

		const deviceFailure = this.validateHubDevicePresence(device);
		if (deviceFailure) {
			return deviceFailure;
		}

		if (!profile.trust) {
			return {
				ok: false,
				code: 'pairing_required',
				reason: 'hub device dial requires pairing orchestrator when trust is missing',
				allowRelayFallback,
			};
		}

		const identity = await this.deps.clientIdentityStore.getOrCreateIdentity();
		if (identity.kind !== 'ready') {
			return {
				ok: false,
				code: 'trust_missing',
				reason: `client identity unavailable: ${identity.kind}`,
				allowRelayFallback,
			};
		}

		const cacheKey = `${hubBaseUrl}::${hubDeviceId}`;
		const now = this.nowMs();
		let ticket: CachedRelayTicket | undefined;
		if (!forceNewTicket) {
			ticket = this.readCachedTicket(cacheKey, now);
		}
		if (!ticket) {
			type IssuedTicket = Extract<IssueHubRelayTicketResult, { ok: true }>;
			type TicketDenial = Extract<IssueHubRelayTicketResult, { ok: false }>;
			const ticketResult = await withHubAccessRetry<IssuedTicket, TicketDenial>(
				{
					store: this.deps.hubSessionStore,
					hubBaseUrl,
					nowMs: now,
					http: this.http,
				},
				accessToken => this.issueRelayTicketFn({
					hubBaseUrl,
					hubDeviceId,
					clientIdentityId: identity.identity.clientIdentityId,
					accessToken,
					nowMs: now,
				}, this.http).then((issued: IssueHubRelayTicketResult): { readonly ok: true; readonly value: IssuedTicket } | TicketDenial => {
					if (!issued.ok) {
						return issued;
					}
					return { ok: true as const, value: issued };
				}),
			);

			if ('authExpired' in ticketResult) {
				return {
					ok: false,
					code: 'hub_auth_expired',
					reason: 'hub session expired during relay ticket issuance',
					allowRelayFallback,
				};
			}

			if (!ticketResult.ok) {
				return {
					ok: false,
					code: mapTicketDenialToFailure(ticketResult.code),
					reason: ticketResult.reason,
					allowRelayFallback,
				};
			}

			const issued = ticketResult.value;
			ticket = {
				ticketId: issued.ticketId,
				authority: issued.authority,
				expiresAtMs: issued.expiresAtMs,
			};
			this.ticketCache.set(cacheKey, ticket);
		}

		const authorityHost = relayAuthorityHost(ticket!.authority);
		const resolvedIp = await this.resolveHost(authorityHost);
		return {
			ok: true,
			allowRelayFallback,
			endpoint: {
				attemptId: randomUUID(),
				authority: authorityHost,
				port: DEFAULT_HUB_RELAY_PORT,
				resolvedIp,
				servername: authorityHost,
				relayTicketId: ticket.ticketId,
				tls: tlsPlanFromProfileTrust(profile),
				expiresAtMs: ticket.expiresAtMs,
				path: 'hubRelay',
			},
		};
	}

	private async resolveHubDeviceWithToken(
		profile: ConnectionProfile,
		forceNewTicket: boolean,
		accessToken: string,
		allowRelayFallback: boolean,
	): Promise<ConnectionResolveResult> {
		if (profile.target.kind !== 'hubDevice') {
			return {
				ok: false,
				code: 'trust_missing',
				reason: 'expected hubDevice connection target',
				allowRelayFallback,
			};
		}
		const { hubBaseUrl, hubDeviceId } = profile.target;

		const directory = await this.listDevices({ hubBaseUrl, accessToken });
		if (!directory.ok) {
			return {
				ok: false,
				code: mapDirectoryDenialToFailure(directory.code),
				reason: directory.reason,
				allowRelayFallback,
			};
		}

		const device = directory.value.find(entry => entry.id === hubDeviceId);
		if (!device) {
			return {
				ok: false,
				code: 'hub_device_not_in_directory',
				reason: `hub device ${hubDeviceId} not found in live directory`,
				allowRelayFallback,
			};
		}

		const deviceFailure = this.validateHubDevicePresence(device);
		if (deviceFailure) {
			return deviceFailure;
		}

		if (!profile.trust) {
			return {
				ok: false,
				code: 'pairing_required',
				reason: 'hub device dial requires pairing orchestrator when trust is missing',
				allowRelayFallback,
			};
		}

		const identity = await this.deps.clientIdentityStore.getOrCreateIdentity();
		if (identity.kind !== 'ready') {
			return {
				ok: false,
				code: 'trust_missing',
				reason: `client identity unavailable: ${identity.kind}`,
				allowRelayFallback,
			};
		}

		const cacheKey = `${hubBaseUrl}::${hubDeviceId}`;
		const now = this.nowMs();
		let ticket: CachedRelayTicket | undefined;
		if (!forceNewTicket) {
			ticket = this.readCachedTicket(cacheKey, now);
		}
		if (!ticket) {
			const issued = await this.issueRelayTicketFn({
				hubBaseUrl,
				hubDeviceId,
				clientIdentityId: identity.identity.clientIdentityId,
				accessToken,
				nowMs: now,
			});
			if (!issued.ok) {
				return {
					ok: false,
					code: mapTicketDenialToFailure(issued.code),
					reason: issued.reason,
					allowRelayFallback,
				};
			}
			ticket = {
				ticketId: issued.ticketId,
				authority: issued.authority,
				expiresAtMs: issued.expiresAtMs,
			};
			this.ticketCache.set(cacheKey, ticket);
		}

		const authorityHost = relayAuthorityHost(ticket.authority);
		const resolvedIp = await this.resolveHost(authorityHost);
		return {
			ok: true,
			allowRelayFallback,
			endpoint: {
				attemptId: randomUUID(),
				authority: authorityHost,
				port: DEFAULT_HUB_RELAY_PORT,
				resolvedIp,
				servername: authorityHost,
				relayTicketId: ticket.ticketId,
				tls: tlsPlanFromProfileTrust(profile),
				expiresAtMs: ticket.expiresAtMs,
				path: 'hubRelay',
			},
		};
	}

	private validateHubDevicePresence(device: HubDevice): ConnectionResolveResult | undefined {
		const allowRelayFallback = true;
		if (device.revoked) {
			return {
				ok: false,
				code: 'hub_device_revoked',
				reason: `hub device ${device.id} is revoked`,
				allowRelayFallback,
			};
		}
		if (device.presence === 'OFFLINE') {
			return {
				ok: false,
				code: 'hub_unreachable',
				reason: `hub device ${device.id} is offline`,
				allowRelayFallback,
			};
		}
		if (device.engineStatus === 'NOT_SERVING') {
			return {
				ok: false,
				code: 'engine_not_serving',
				reason: `hub device ${device.id} engine is not serving`,
				allowRelayFallback,
			};
		}
		return undefined;
	}

	private readCachedTicket(cacheKey: string, nowMs: number): CachedRelayTicket | undefined {
		const cached = this.ticketCache.get(cacheKey);
		if (!cached) {
			return undefined;
		}
		if (cached.expiresAtMs <= nowMs) {
			this.ticketCache.delete(cacheKey);
			return undefined;
		}
		return cached;
	}
}

export function createConnectionResolver(deps: ConnectionResolverDeps): ConnectionResolver {
	return new ConnectionResolver(deps);
}
