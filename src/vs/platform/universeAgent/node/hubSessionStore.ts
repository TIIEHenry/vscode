/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IEncryptionMainService } from '../../encryption/common/encryptionService.js';
import { IApplicationStorageMainService } from '../../storage/electron-main/storageMainService.js';
import { StorageScope, StorageTarget } from '../../storage/common/storage.js';
import { normalizeHttpsUrl } from './hub/host-normalize.js';
import { parseAuthSessionV1, type ParsedAuthSessionV1, type HubAuthHttp } from './hub/hub-auth-client.js';

export type HubAuthStatusProjection =
	| { readonly status: 'signedOut' }
	| { readonly status: 'signedIn'; readonly email: string }
	| { readonly status: 'mustChangePassword'; readonly email: string };

type HubSessionBucket = {
	readonly accessToken: string;
	readonly expiresAtMs: number;
	readonly mustChangePassword: boolean;
	readonly userId: string;
	readonly email: string;
	readonly csrfToken: string;
};

type PersistedHubRefreshSecrets = {
	readonly refreshToken: string;
	readonly csrfToken: string;
	readonly userId: string;
};

const REFRESH_COOKIE = 'hub_refresh';
const CSRF_COOKIE = 'hub_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const SECRET_KEY_PREFIX = 'universeAgent.secret.hubRefresh.';
const HUB_AUTH_TIMEOUT_MS = 10_000;

export function hubBaseUrlFromRefreshSecretStorageKey(key: string): string | undefined {
	if (!key.startsWith(SECRET_KEY_PREFIX)) {
		return undefined;
	}
	try {
		return decodeURIComponent(key.slice(SECRET_KEY_PREFIX.length));
	} catch {
		return undefined;
	}
}

export function isHubSessionTokenExpired(expiresAtMs: number, nowMs: number, bufferMs = 60_000): boolean {
	if (!Number.isFinite(expiresAtMs) || !Number.isFinite(nowMs)) {
		return true;
	}
	return nowMs >= expiresAtMs - bufferMs;
}

function hubBaseUrlIdentityKey(hubBaseUrl: string): string {
	const normalized = normalizeHttpsUrl(hubBaseUrl);
	if (normalized.ok) {
		return normalized.url;
	}
	return hubBaseUrl;
}

function secretStorageKey(hubBaseUrl: string): string {
	return `${SECRET_KEY_PREFIX}${encodeURIComponent(hubBaseUrlIdentityKey(hubBaseUrl))}`;
}

function createFetchAbortSignal(): AbortSignal {
	if (typeof AbortSignal.timeout === 'function') {
		return AbortSignal.timeout(HUB_AUTH_TIMEOUT_MS);
	}
	const controller = new AbortController();
	setTimeout(() => controller.abort(), HUB_AUTH_TIMEOUT_MS);
	return controller.signal;
}

export type HubRefreshDenialCode =
	| 'hub_auth_contract_invalid'
	| 'hub_auth_http_failed'
	| 'hub_refresh_unavailable'
	| 'hub_refresh_missing'
	| 'hub_encryption_unavailable';

export type HubRefreshResult =
	| { readonly ok: true; readonly session: ParsedAuthSessionV1 }
	| { readonly ok: false; readonly code: HubRefreshDenialCode; readonly reason: string };

export type HubRefreshHttp = HubAuthHttp & {
	readonly fetch: HubAuthHttp['fetch'] & ((
		url: string,
		init: {
			readonly method: 'POST';
			readonly headers: Readonly<Record<string, string>>;
			readonly body?: string;
			readonly signal?: AbortSignal;
		},
	) => Promise<{
		readonly status: number;
		readonly headers?: { readonly getSetCookie?: () => readonly string[] };
		readonly json: () => Promise<unknown>;
	}>);
};

function parseRefreshCookie(setCookieHeaders: readonly string[] | undefined, cookieName: string): string | undefined {
	if (!setCookieHeaders) {
		return undefined;
	}
	for (const header of setCookieHeaders) {
		if (!header.startsWith(`${cookieName}=`)) {
			continue;
		}
		const value = header.slice(cookieName.length + 1).split(';')[0]?.trim();
		if (value) {
			return value;
		}
	}
	return undefined;
}

export async function refreshHubAuthSession(
	input: {
		readonly hubBaseUrl: string;
		readonly refreshToken: string;
		readonly csrfToken: string;
	},
	http: HubRefreshHttp,
): Promise<HubRefreshResult & { readonly rotatedRefreshToken?: string }> {
	const hubUrl = normalizeHttpsUrl(input.hubBaseUrl);
	if (!hubUrl.ok) {
		return { ok: false, code: 'hub_auth_contract_invalid', reason: hubUrl.reason };
	}
	if (input.refreshToken.trim().length === 0 || input.csrfToken.trim().length === 0) {
		return { ok: false, code: 'hub_refresh_missing', reason: 'refresh or csrf token missing' };
	}

	const requestUrl = new URL('/api/v1/auth/refresh', hubUrl.url);
	try {
		const response = await http.fetch(String(requestUrl), {
			method: 'POST',
			headers: {
				Cookie: `${REFRESH_COOKIE}=${input.refreshToken}; ${CSRF_COOKIE}=${input.csrfToken}`,
				[CSRF_HEADER]: input.csrfToken,
				Accept: 'application/json',
			},
			signal: createFetchAbortSignal(),
		});

		if (response.status !== 200 && response.status !== 403) {
			return {
				ok: false,
				code: 'hub_auth_http_failed',
				reason: `hub refresh HTTP ${response.status}`,
			};
		}

		const raw = await response.json();
		const parsed = parseAuthSessionV1(raw);
		if (!parsed.ok) {
			return parsed;
		}

		const setCookie = response.headers?.getSetCookie?.() ?? [];
		const rotatedRefreshToken = parseRefreshCookie(setCookie, REFRESH_COOKIE) ?? input.refreshToken;
		return { ok: true, session: parsed.session, rotatedRefreshToken };
	} catch (err) {
		return {
			ok: false,
			code: 'hub_auth_http_failed',
			reason: `hub refresh request failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

export interface IHubSessionStore {
	getAccessTokenForHub(hubBaseUrl: string, nowMs: number): string | null;
	getStatusForHub(hubBaseUrl: string, nowMs: number): HubAuthStatusProjection;
	requiresPasswordChange(hubBaseUrl: string, nowMs: number): boolean;
	applyAuthSession(hubBaseUrl: string, session: ParsedAuthSessionV1, nowMs: number, refreshToken?: string): Promise<void>;
	clear(hubBaseUrl: string): Promise<void>;
	refreshIfNeeded(
		hubBaseUrl: string,
		nowMs: number,
		http?: HubRefreshHttp,
		options?: { readonly force?: boolean },
	): Promise<HubRefreshResult | { readonly ok: true; readonly skipped: true }>;
	listPersistedHubBaseUrls(): string[];
	isEncryptionAvailable(): Promise<boolean>;
}

export class HubSessionStore implements IHubSessionStore {

	private readonly buckets = new Map<string, HubSessionBucket>();
	private readonly refreshFlights = new Map<string, Promise<HubRefreshResult | { readonly ok: true; readonly skipped: true }>>();

	constructor(
		private readonly encryptionService: IEncryptionMainService,
		private readonly applicationStorage: IApplicationStorageMainService,
	) { }

	async isEncryptionAvailable(): Promise<boolean> {
		return this.encryptionService.isEncryptionAvailable();
	}

	listPersistedHubBaseUrls(): string[] {
		const keys = this.applicationStorage.keys(StorageScope.APPLICATION, StorageTarget.MACHINE);
		const urls: string[] = [];
		for (const key of keys) {
			const hubBaseUrl = hubBaseUrlFromRefreshSecretStorageKey(key);
			if (hubBaseUrl && this.applicationStorage.get(key, StorageScope.APPLICATION)) {
				urls.push(hubBaseUrl);
			}
		}
		return urls;
	}

	getAccessTokenForHub(hubBaseUrl: string, nowMs: number): string | null {
		const bucket = this.readBucket(hubBaseUrl, nowMs);
		return bucket?.accessToken ?? null;
	}

	getStatusForHub(hubBaseUrl: string, nowMs: number): HubAuthStatusProjection {
		const bucket = this.readBucket(hubBaseUrl, nowMs);
		if (!bucket) {
			return { status: 'signedOut' };
		}
		if (bucket.mustChangePassword) {
			return { status: 'mustChangePassword', email: bucket.email };
		}
		return { status: 'signedIn', email: bucket.email };
	}

	requiresPasswordChange(hubBaseUrl: string, nowMs: number): boolean {
		const bucket = this.readBucket(hubBaseUrl, nowMs);
		return bucket !== null && bucket.mustChangePassword;
	}

	async applyAuthSession(
		hubBaseUrl: string,
		session: ParsedAuthSessionV1,
		nowMs: number,
		refreshToken?: string,
	): Promise<void> {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		this.buckets.set(key, {
			accessToken: session.accessToken,
			expiresAtMs: nowMs + session.expiresIn * 1000,
			mustChangePassword: session.mustChangePassword,
			userId: session.user.id,
			email: session.user.email,
			csrfToken: session.csrfToken,
		});

		if (refreshToken && (await this.encryptionService.isEncryptionAvailable())) {
			const payload: PersistedHubRefreshSecrets = {
				refreshToken,
				csrfToken: session.csrfToken,
				userId: session.user.id,
			};
			const encrypted = await this.encryptionService.encrypt(JSON.stringify(payload));
			this.applicationStorage.store(
				secretStorageKey(hubBaseUrl),
				encrypted,
				StorageScope.APPLICATION,
				StorageTarget.MACHINE,
			);
		}
	}

	async clear(hubBaseUrl: string): Promise<void> {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		this.buckets.delete(key);
		this.applicationStorage.remove(secretStorageKey(hubBaseUrl), StorageScope.APPLICATION);
	}

	async refreshIfNeeded(
		hubBaseUrl: string,
		nowMs: number,
		http?: HubRefreshHttp,
		options?: { readonly force?: boolean },
	): Promise<HubRefreshResult | { readonly ok: true; readonly skipped: true }> {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		const existing = this.refreshFlights.get(key);
		if (existing) {
			return existing;
		}

		const flight = this.doRefreshIfNeeded(hubBaseUrl, nowMs, http, options?.force === true);
		this.refreshFlights.set(key, flight);
		try {
			return await flight;
		} finally {
			this.refreshFlights.delete(key);
		}
	}

	private async doRefreshIfNeeded(
		hubBaseUrl: string,
		nowMs: number,
		http?: HubRefreshHttp,
		force = false,
	): Promise<HubRefreshResult | { readonly ok: true; readonly skipped: true }> {
		const bucket = this.readBucket(hubBaseUrl, nowMs);
		if (!force && bucket && !isHubSessionTokenExpired(bucket.expiresAtMs, nowMs)) {
			return { ok: true, skipped: true };
		}

		if (!(await this.encryptionService.isEncryptionAvailable())) {
			return { ok: false, code: 'hub_encryption_unavailable', reason: 'encryption unavailable for hub refresh persistence' };
		}

		const encrypted = this.applicationStorage.get(secretStorageKey(hubBaseUrl), StorageScope.APPLICATION);
		if (!encrypted) {
			return { ok: false, code: 'hub_refresh_missing', reason: 'no persisted refresh token' };
		}

		let secrets: PersistedHubRefreshSecrets;
		try {
			secrets = JSON.parse(await this.encryptionService.decrypt(encrypted)) as PersistedHubRefreshSecrets;
		} catch (err) {
			return {
				ok: false,
				code: 'hub_refresh_unavailable',
				reason: err instanceof Error ? err.message : String(err),
			};
		}

		if (!http) {
			return { ok: false, code: 'hub_refresh_unavailable', reason: 'refresh HTTP client not provided' };
		}

		const result = await refreshHubAuthSession(
			{
				hubBaseUrl,
				refreshToken: secrets.refreshToken,
				csrfToken: secrets.csrfToken,
			},
			http,
		);

		if (!result.ok) {
			return result;
		}

		await this.applyAuthSession(hubBaseUrl, result.session, nowMs, result.rotatedRefreshToken ?? secrets.refreshToken);
		return result;
	}

	private readBucket(hubBaseUrl: string, nowMs: number): HubSessionBucket | null {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		const bucket = this.buckets.get(key);
		if (!bucket) {
			return null;
		}
		if (bucket.expiresAtMs <= nowMs || bucket.accessToken.trim().length === 0) {
			this.buckets.delete(key);
			return null;
		}
		return bucket;
	}
}

/** In-memory Hub session store for tests. */
export class InMemoryHubSessionStore implements IHubSessionStore {

	private readonly buckets = new Map<string, HubSessionBucket>();
	private readonly refreshSecrets = new Map<string, PersistedHubRefreshSecrets>();
	private readonly refreshFlights = new Map<string, Promise<HubRefreshResult | { readonly ok: true; readonly skipped: true }>>();
	private encryptionAvailable: boolean;

	constructor(options?: { readonly encryptionAvailable?: boolean }) {
		this.encryptionAvailable = options?.encryptionAvailable ?? true;
	}

	async isEncryptionAvailable(): Promise<boolean> {
		return this.encryptionAvailable;
	}

	listPersistedHubBaseUrls(): string[] {
		return [...this.refreshSecrets.keys()];
	}

	getAccessTokenForHub(hubBaseUrl: string, nowMs: number): string | null {
		return this.readBucket(hubBaseUrl, nowMs)?.accessToken ?? null;
	}

	getStatusForHub(hubBaseUrl: string, nowMs: number): HubAuthStatusProjection {
		const bucket = this.readBucket(hubBaseUrl, nowMs);
		if (!bucket) {
			return { status: 'signedOut' };
		}
		if (bucket.mustChangePassword) {
			return { status: 'mustChangePassword', email: bucket.email };
		}
		return { status: 'signedIn', email: bucket.email };
	}

	requiresPasswordChange(hubBaseUrl: string, nowMs: number): boolean {
		const bucket = this.readBucket(hubBaseUrl, nowMs);
		return bucket !== null && bucket.mustChangePassword;
	}

	async applyAuthSession(
		hubBaseUrl: string,
		session: ParsedAuthSessionV1,
		nowMs: number,
		refreshToken?: string,
	): Promise<void> {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		this.buckets.set(key, {
			accessToken: session.accessToken,
			expiresAtMs: nowMs + session.expiresIn * 1000,
			mustChangePassword: session.mustChangePassword,
			userId: session.user.id,
			email: session.user.email,
			csrfToken: session.csrfToken,
		});
		if (refreshToken && this.encryptionAvailable) {
			this.refreshSecrets.set(key, {
				refreshToken,
				csrfToken: session.csrfToken,
				userId: session.user.id,
			});
		}
	}

	async clear(hubBaseUrl: string): Promise<void> {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		this.buckets.delete(key);
		this.refreshSecrets.delete(key);
	}

	async refreshIfNeeded(
		hubBaseUrl: string,
		nowMs: number,
		http?: HubRefreshHttp,
		options?: { readonly force?: boolean },
	): Promise<HubRefreshResult | { readonly ok: true; readonly skipped: true }> {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		const existing = this.refreshFlights.get(key);
		if (existing) {
			return existing;
		}
		const flight = this.doRefreshIfNeeded(hubBaseUrl, nowMs, http, options?.force === true);
		this.refreshFlights.set(key, flight);
		try {
			return await flight;
		} finally {
			this.refreshFlights.delete(key);
		}
	}

	private async doRefreshIfNeeded(
		hubBaseUrl: string,
		nowMs: number,
		http?: HubRefreshHttp,
		force = false,
	): Promise<HubRefreshResult | { readonly ok: true; readonly skipped: true }> {
		const bucket = this.readBucket(hubBaseUrl, nowMs);
		if (!force && bucket && !isHubSessionTokenExpired(bucket.expiresAtMs, nowMs)) {
			return { ok: true, skipped: true };
		}
		if (!this.encryptionAvailable) {
			return { ok: false, code: 'hub_encryption_unavailable', reason: 'encryption unavailable' };
		}
		const secrets = this.refreshSecrets.get(hubBaseUrlIdentityKey(hubBaseUrl));
		if (!secrets) {
			return { ok: false, code: 'hub_refresh_missing', reason: 'no persisted refresh token' };
		}
		if (!http) {
			return { ok: false, code: 'hub_refresh_unavailable', reason: 'refresh HTTP client not provided' };
		}
		const result = await refreshHubAuthSession(
			{ hubBaseUrl, refreshToken: secrets.refreshToken, csrfToken: secrets.csrfToken },
			http,
		);
		if (!result.ok) {
			return result;
		}
		await this.applyAuthSession(hubBaseUrl, result.session, nowMs, result.rotatedRefreshToken ?? secrets.refreshToken);
		return result;
	}

	private readBucket(hubBaseUrl: string, nowMs: number): HubSessionBucket | null {
		const key = hubBaseUrlIdentityKey(hubBaseUrl);
		const bucket = this.buckets.get(key);
		if (!bucket || bucket.expiresAtMs <= nowMs) {
			this.buckets.delete(key);
			return null;
		}
		return bucket;
	}
}

export function formatHubAccountDisplayName(email?: string, userId?: string): string {
	const cleanEmail = email?.trim();
	if (cleanEmail && cleanEmail.length > 0) {
		return cleanEmail;
	}
	const cleanId = userId?.trim();
	if (cleanId && cleanId.length > 0) {
		return `User ${cleanId.slice(0, 8)}`;
	}
	return 'Hub Account';
}
