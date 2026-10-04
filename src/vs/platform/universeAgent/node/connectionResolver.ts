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
import { isHubAccessAuthExpired, withHubAccessRetry } from './hubAuthAccess.js';

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

export type ConnectionResolveOptions = {
	readonly forceNewTicket?: boolean;
	readonly forPairing?: boolean;
	/** Default true. False neither reads nor writes the dial ticket cache. */
	readonly useRelayTicketCache?: boolean;
};

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
	readonly resolveHost?: (host: string) => Promise<readonly string[]>;
	readonly nowMs?: () => number;
};

const PRIVATE_NETWORK_DENIED_REASON = 'direct address resolves to private or loopback network without allowPrivateNetwork';

/** Drop one pair of brackets, then a `%zone`, before classification. */
function stripHostDecorations(host: string): string {
	let normalized = host.trim().toLowerCase();
	if (normalized.startsWith('[') && normalized.endsWith(']') && normalized.length >= 2) {
		normalized = normalized.slice(1, -1).trim();
	}
	const zoneIndex = normalized.indexOf('%');
	if (zoneIndex >= 0) {
		normalized = normalized.slice(0, zoneIndex);
	}
	return normalized;
}

function hostForResolution(host: string): string {
	const trimmed = host.trim();
	if (trimmed.startsWith('[') && trimmed.endsWith(']') && trimmed.length >= 2) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

function parseIpv4(value: string): readonly [number, number, number, number] | undefined {
	const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(value);
	if (!match) {
		return undefined;
	}
	const a = Number(match[1]);
	const b = Number(match[2]);
	const c = Number(match[3]);
	const d = Number(match[4]);
	if (a > 255 || b > 255 || c > 255 || d > 255) {
		return undefined;
	}
	return [a, b, c, d];
}

function isPrivateOrLoopbackIpv4(a: number, b: number): boolean {
	// 0.0.0.0/8 is "this network". On Linux a dial to it lands on the local host.
	if (a === 0 || a === 10 || a === 127) {
		return true;
	}
	if (a === 172 && b >= 16 && b <= 31) {
		return true;
	}
	if (a === 192 && b === 168) {
		return true;
	}
	if (a === 169 && b === 254) {
		return true;
	}
	return false;
}

function parseIpv6(value: string): Uint8Array | undefined {
	let text = value;
	if (text.includes('.')) {
		const lastColon = text.lastIndexOf(':');
		if (lastColon < 0) {
			return undefined;
		}
		const embedded = parseIpv4(text.slice(lastColon + 1));
		if (!embedded) {
			return undefined;
		}
		const hi = ((embedded[0] << 8) | embedded[1]).toString(16);
		const lo = ((embedded[2] << 8) | embedded[3]).toString(16);
		text = `${text.slice(0, lastColon)}:${hi}:${lo}`;
	}
	const halves = text.split('::');
	if (halves.length > 2) {
		return undefined;
	}
	const parseSide = (side: string): number[] | undefined => {
		if (side === '') {
			return [];
		}
		const parts = side.split(':');
		const hextets: number[] = [];
		for (const part of parts) {
			if (!/^[0-9a-f]{1,4}$/.test(part)) {
				return undefined;
			}
			hextets.push(Number.parseInt(part, 16));
		}
		return hextets;
	};
	let hextets: number[];
	if (halves.length === 1) {
		const full = parseSide(halves[0] ?? '');
		if (!full || full.length !== 8) {
			return undefined;
		}
		hextets = full;
	} else {
		const left = parseSide(halves[0] ?? '');
		const right = parseSide(halves[1] ?? '');
		if (!left || !right) {
			return undefined;
		}
		const missing = 8 - left.length - right.length;
		if (missing < 1) {
			return undefined;
		}
		hextets = [...left, ...Array.from({ length: missing }, () => 0), ...right];
	}
	const bytes = new Uint8Array(16);
	for (let index = 0; index < 8; index++) {
		const hextet = hextets[index] ?? 0;
		bytes[index * 2] = hextet >> 8;
		bytes[index * 2 + 1] = hextet & 0xff;
	}
	return bytes;
}

function isIpv4Mapped(bytes: Uint8Array): boolean {
	for (let index = 0; index < 10; index++) {
		if (bytes[index] !== 0) {
			return false;
		}
	}
	return bytes[10] === 0xff && bytes[11] === 0xff;
}

function isIpv6Loopback(bytes: Uint8Array): boolean {
	for (let index = 0; index < 15; index++) {
		if (bytes[index] !== 0) {
			return false;
		}
	}
	return bytes[15] === 1;
}

/** The unspecified address `::`. A dial to it lands on the local host, same as loopback. */
function isIpv6Unspecified(bytes: Uint8Array): boolean {
	for (let index = 0; index < 16; index++) {
		if (bytes[index] !== 0) {
			return false;
		}
	}
	return true;
}

function isPrivateOrLoopbackHost(host: string): boolean {
	const normalized = stripHostDecorations(host);
	if (normalized === 'localhost') {
		return true;
	}
	const ipv4 = parseIpv4(normalized);
	if (ipv4) {
		return isPrivateOrLoopbackIpv4(ipv4[0], ipv4[1]);
	}
	const ipv6 = parseIpv6(normalized);
	if (!ipv6) {
		return false;
	}
	if (isIpv4Mapped(ipv6)) {
		return isPrivateOrLoopbackIpv4(ipv6[12] ?? 0, ipv6[13] ?? 0);
	}
	if (isIpv6Unspecified(ipv6) || isIpv6Loopback(ipv6)) {
		return true;
	}
	if ((ipv6[0] & 0xfe) === 0xfc) {
		return true;
	}
	return ipv6[0] === 0xfe && (ipv6[1] & 0xc0) === 0x80;
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
	if (code === 'hub_unreachable') {
		return 'hub_unreachable';
	}
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
	private readonly resolveHost: (host: string) => Promise<readonly string[]>;
	private readonly nowMs: () => number;

	constructor(private readonly deps: ConnectionResolverDeps) {
		this.listDevices = deps.listDevices ?? listHubDevices;
		this.issueRelayTicketFn = deps.issueRelayTicketFn ?? issueHubRelayTicket;
		this.http = deps.http;
		this.resolveHost = deps.resolveHost ?? (async host => [host]);
		this.nowMs = deps.nowMs ?? Date.now;
	}

	async resolve(profileId: string, options: ConnectionResolveOptions = {}): Promise<ConnectionResolveResult> {
		const profile = this.deps.connectionProfileStore.get(profileId);
		if (!profile) {
			return {
				ok: false,
				code: 'trust_missing',
				reason: `connection profile not found: ${profileId}`,
				allowRelayFallback: false,
			};
		}

		const forPairing = options.forPairing === true;
		const useRelayTicketCache = options.useRelayTicketCache !== false;

		switch (profile.target.kind) {
			case 'loopback':
				return this.resolveLoopback(profile);
			case 'directAddress':
				return this.resolveDirectAddress(profile, forPairing);
			case 'hubDevice':
				return this.resolveHubDevice(profile, options.forceNewTicket === true, forPairing, useRelayTicketCache);
		}
	}

	/** Drop the dial-cache ticket once it is about to be handed to a TLS dial. */
	consumeRelayTicket(profileId: string): void {
		const profile = this.deps.connectionProfileStore.get(profileId);
		if (!profile || profile.target.kind !== 'hubDevice') {
			return;
		}
		const { hubBaseUrl, hubDeviceId } = profile.target;
		this.ticketCache.delete(`${hubBaseUrl}::${hubDeviceId}`);
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
		const dial = await this.resolveDialAddress(host, false);
		if (!dial.ok) {
			return dial;
		}
		const now = this.nowMs();
		return {
			ok: true,
			allowRelayFallback: false,
			endpoint: {
				attemptId: randomUUID(),
				authority: host,
				port,
				resolvedIp: dial.resolvedIp,
				servername: host,
				relayTicketId: null,
				tls: null,
				expiresAtMs: now + 60_000,
				path: 'loopback',
			},
		};
	}

	private async resolveDirectAddress(profile: ConnectionProfile, forPairing: boolean): Promise<ConnectionResolveResult> {
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
				reason: PRIVATE_NETWORK_DENIED_REASON,
				allowRelayFallback: false,
			};
		}
		if (!profile.trust && !forPairing) {
			return {
				ok: false,
				code: 'pairing_required',
				reason: 'direct address dial requires pairing orchestrator when trust is missing',
				allowRelayFallback: false,
			};
		}
		const dial = await this.resolveDialAddress(host, !profile.allowPrivateNetwork);
		if (!dial.ok) {
			return dial;
		}
		const now = this.nowMs();
		return {
			ok: true,
			allowRelayFallback: false,
			endpoint: {
				attemptId: randomUUID(),
				authority: host,
				port,
				resolvedIp: dial.resolvedIp,
				servername: host,
				relayTicketId: null,
				tls: profile.trust ? tlsPlanFromProfileTrust(profile) : null,
				expiresAtMs: now + 60_000,
				path: 'direct',
			},
		};
	}

	private async resolveHubDevice(profile: ConnectionProfile, forceNewTicket: boolean, forPairing: boolean, useRelayTicketCache: boolean): Promise<ConnectionResolveResult> {
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
			return this.resolveHubDeviceWithToken(profile, forceNewTicket, accessToken, allowRelayFallback, forPairing, useRelayTicketCache);
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

		if (isHubAccessAuthExpired(directoryAccess)) {
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

		if (!profile.trust && !forPairing) {
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
		let ticket = this.lookupRelayTicket(cacheKey, now, forceNewTicket, useRelayTicketCache);
		let wroteCache = false;
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

			if (isHubAccessAuthExpired(ticketResult)) {
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
			this.storeRelayTicket(cacheKey, ticket, useRelayTicketCache);
			wroteCache = useRelayTicketCache;
		}

		return this.finishHubRelayEndpoint(profile, ticket, cacheKey, wroteCache, allowRelayFallback, forPairing);
	}

	private async resolveHubDeviceWithToken(
		profile: ConnectionProfile,
		forceNewTicket: boolean,
		accessToken: string,
		allowRelayFallback: boolean,
		forPairing: boolean,
		useRelayTicketCache: boolean,
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

		if (!profile.trust && !forPairing) {
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
		let ticket = this.lookupRelayTicket(cacheKey, now, forceNewTicket, useRelayTicketCache);
		let wroteCache = false;
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
			this.storeRelayTicket(cacheKey, ticket, useRelayTicketCache);
			wroteCache = useRelayTicketCache;
		}

		return this.finishHubRelayEndpoint(profile, ticket, cacheKey, wroteCache, allowRelayFallback, forPairing);
	}

	private async finishHubRelayEndpoint(
		profile: ConnectionProfile,
		ticket: CachedRelayTicket,
		cacheKey: string,
		wroteCache: boolean,
		allowRelayFallback: boolean,
		forPairing: boolean,
	): Promise<ConnectionResolveResult> {
		const authorityHost = relayAuthorityHost(ticket.authority);
		const dial = await this.resolveDialAddress(authorityHost, !profile.allowPrivateNetwork);
		if (!dial.ok) {
			if (wroteCache && dial.code === 'private_network_denied') {
				this.ticketCache.delete(cacheKey);
			}
			return dial;
		}
		return {
			ok: true,
			allowRelayFallback,
			endpoint: {
				attemptId: randomUUID(),
				authority: authorityHost,
				port: DEFAULT_HUB_RELAY_PORT,
				resolvedIp: dial.resolvedIp,
				servername: authorityHost,
				relayTicketId: ticket.ticketId,
				tls: forPairing && !profile.trust ? null : tlsPlanFromProfileTrust(profile),
				expiresAtMs: ticket.expiresAtMs,
				path: 'hubRelay',
			},
		};
	}

	private async resolveDialAddress(host: string, denyPrivateNetwork: boolean): Promise<
		| { readonly ok: true; readonly resolvedIp: string }
		| { readonly ok: false; readonly code: 'private_network_denied' | 'transport_failed'; readonly reason: string; readonly allowRelayFallback: false }
	> {
		let addresses: readonly string[];
		try {
			addresses = await this.resolveHost(hostForResolution(host));
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			return {
				ok: false,
				code: 'transport_failed',
				reason: `host resolution failed: ${detail}`,
				allowRelayFallback: false,
			};
		}
		const resolvedIp = addresses[0];
		if (resolvedIp === undefined) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'host resolution returned no addresses',
				allowRelayFallback: false,
			};
		}
		if (denyPrivateNetwork) {
			for (const address of addresses) {
				if (isPrivateOrLoopbackHost(address)) {
					return {
						ok: false,
						code: 'private_network_denied',
						reason: PRIVATE_NETWORK_DENIED_REASON,
						allowRelayFallback: false,
					};
				}
			}
		}
		return { ok: true, resolvedIp };
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

	private lookupRelayTicket(cacheKey: string, nowMs: number, forceNewTicket: boolean, useRelayTicketCache: boolean): CachedRelayTicket | undefined {
		if (!useRelayTicketCache || forceNewTicket) {
			return undefined;
		}
		return this.readCachedTicket(cacheKey, nowMs);
	}

	private storeRelayTicket(cacheKey: string, ticket: CachedRelayTicket, useRelayTicketCache: boolean): void {
		if (!useRelayTicketCache) {
			return;
		}
		this.ticketCache.set(cacheKey, ticket);
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
