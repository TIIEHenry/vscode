/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { normalizeHttpsUrl } from './hub/host-normalize.js';

export type HubDevicePresence = 'ONLINE' | 'OFFLINE';
export type HubEngineStatus = 'SERVING' | 'NOT_SERVING';

export type HubDevice = {
	readonly id: string;
	readonly name: string;
	readonly presence: HubDevicePresence;
	readonly engineStatus: HubEngineStatus | null;
	readonly engineIdentityId: string | null;
	readonly certFingerprint: string | null;
	readonly ipv4: string | null;
	readonly ipv6: string | null;
	readonly enginePort: number | null;
	readonly revoked: boolean;
	readonly lastHeartbeatAt: string | null;
};

export type HubDirectoryDenialCode =
	| 'hub_session_required'
	| 'hub_directory_http_failed'
	| 'hub_directory_contract_invalid'
	| 'hub_forbidden'
	| 'hub_rate_limited';

export type HubDirectoryHttp = {
	readonly fetch: (
		url: string,
		init: {
			readonly method: 'GET' | 'PATCH' | 'POST';
			readonly headers: Readonly<Record<string, string>>;
			readonly body?: string;
			readonly signal?: AbortSignal;
		},
	) => Promise<{
		readonly status: number;
		readonly json: () => Promise<unknown>;
	}>;
};

const HUB_DIRECTORY_TIMEOUT_MS = 10_000;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key);
	if (desc === undefined || desc.get !== undefined || desc.set !== undefined || !Object.hasOwn(desc, 'value')) {
		return undefined;
	}
	return desc.value;
}

function isExactNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim();
}

function contractInvalid(reason: string): {
	readonly ok: false;
	readonly code: 'hub_directory_contract_invalid';
	readonly reason: string;
} {
	return { ok: false, code: 'hub_directory_contract_invalid', reason };
}

function parsePresence(value: unknown): HubDevicePresence | undefined {
	if (value === 'ONLINE' || value === 'OFFLINE') {
		return value;
	}
	return undefined;
}

function parseEngineStatus(value: unknown): HubEngineStatus | null | undefined {
	if (value === null || value === undefined) {
		return null;
	}
	if (value === 'SERVING' || value === 'NOT_SERVING') {
		return value;
	}
	return undefined;
}

export function parseHubDevice(raw: unknown):
	| { readonly ok: true; readonly device: HubDevice }
	| { readonly ok: false; readonly code: 'hub_directory_contract_invalid'; readonly reason: string } {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return contractInvalid('device must be an object');
	}
	const record = raw as object;
	if (Object.hasOwn(record, 'engine_status') || Object.hasOwn(record, 'engine_identity_id')) {
		return contractInvalid('device must use camelCase own-data keys');
	}

	const id = readOwnDataValue(record, 'id');
	const name = readOwnDataValue(record, 'name');
	const presence = parsePresence(readOwnDataValue(record, 'presence'));
	const engineStatus = parseEngineStatus(readOwnDataValue(record, 'engineStatus'));
	const engineIdentityId = readOwnDataValue(record, 'engineIdentityId');
	const certFingerprint = readOwnDataValue(record, 'certFingerprint');
	const ipv4 = readOwnDataValue(record, 'ipv4');
	const ipv6 = readOwnDataValue(record, 'ipv6');
	const enginePort = readOwnDataValue(record, 'enginePort');
	const revoked = readOwnDataValue(record, 'revoked');
	const lastHeartbeatAt = readOwnDataValue(record, 'lastHeartbeatAt');

	if (!isExactNonEmptyString(id)) {
		return contractInvalid('device.id must be a non-empty exact string');
	}
	if (!isExactNonEmptyString(name)) {
		return contractInvalid('device.name must be a non-empty exact string');
	}
	if (!presence) {
		return contractInvalid('device.presence must be ONLINE or OFFLINE');
	}
	if (engineStatus === undefined) {
		return contractInvalid('device.engineStatus must be SERVING, NOT_SERVING, or null');
	}
	if (engineIdentityId !== null && engineIdentityId !== undefined && !isExactNonEmptyString(engineIdentityId)) {
		return contractInvalid('device.engineIdentityId must be a non-empty exact string or null');
	}
	if (certFingerprint !== null && certFingerprint !== undefined) {
		if (typeof certFingerprint !== 'string' || !FINGERPRINT_PATTERN.test(certFingerprint)) {
			return contractInvalid('device.certFingerprint must be lowercase hex sha256 or null');
		}
	}
	if (ipv4 !== null && ipv4 !== undefined && typeof ipv4 !== 'string') {
		return contractInvalid('device.ipv4 must be string or null');
	}
	if (ipv6 !== null && ipv6 !== undefined && typeof ipv6 !== 'string') {
		return contractInvalid('device.ipv6 must be string or null');
	}
	if (enginePort !== null && enginePort !== undefined) {
		if (typeof enginePort !== 'number' || !Number.isInteger(enginePort) || enginePort < 1 || enginePort > 65535) {
			return contractInvalid('device.enginePort must be integer 1..65535 or null');
		}
	}
	if (typeof revoked !== 'boolean') {
		return contractInvalid('device.revoked must be boolean');
	}
	if (lastHeartbeatAt !== null && lastHeartbeatAt !== undefined && !isExactNonEmptyString(lastHeartbeatAt)) {
		return contractInvalid('device.lastHeartbeatAt must be RFC3339 string or null');
	}

	return {
		ok: true,
		device: {
			id,
			name,
			presence,
			engineStatus,
			engineIdentityId: typeof engineIdentityId === 'string' ? engineIdentityId : null,
			certFingerprint: typeof certFingerprint === 'string' ? certFingerprint : null,
			ipv4: typeof ipv4 === 'string' ? ipv4 : null,
			ipv6: typeof ipv6 === 'string' ? ipv6 : null,
			enginePort: typeof enginePort === 'number' ? enginePort : null,
			revoked,
			lastHeartbeatAt: typeof lastHeartbeatAt === 'string' ? lastHeartbeatAt : null,
		},
	};
}

export function parseHubDevicesResponse(raw: unknown):
	| { readonly ok: true; readonly devices: HubDevice[] }
	| { readonly ok: false; readonly code: 'hub_directory_contract_invalid'; readonly reason: string } {
	if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
		return contractInvalid('devices response must be an object');
	}
	const devicesRaw = readOwnDataValue(raw as object, 'devices');
	if (!Array.isArray(devicesRaw)) {
		return contractInvalid('devices must be an array');
	}
	const devices: HubDevice[] = [];
	for (const item of devicesRaw) {
		const parsed = parseHubDevice(item);
		if (!parsed.ok) {
			return parsed;
		}
		devices.push(parsed.device);
	}
	return { ok: true, devices };
}

function createFetchAbortSignal(): AbortSignal {
	if (typeof AbortSignal.timeout === 'function') {
		return AbortSignal.timeout(HUB_DIRECTORY_TIMEOUT_MS);
	}
	const controller = new AbortController();
	setTimeout(() => controller.abort(), HUB_DIRECTORY_TIMEOUT_MS);
	return controller.signal;
}

function defaultHttp(): HubDirectoryHttp {
	return { fetch: globalThis.fetch.bind(globalThis) };
}

function mapHttpStatus(status: number): HubDirectoryDenialCode {
	if (status === 401) {
		return 'hub_session_required';
	}
	if (status === 403) {
		return 'hub_forbidden';
	}
	if (status === 429) {
		return 'hub_rate_limited';
	}
	return 'hub_directory_http_failed';
}

export type HubDirectoryClientInput = {
	readonly hubBaseUrl: string;
	readonly accessToken: string;
};

export type HubDirectoryResult<T> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly code: HubDirectoryDenialCode; readonly reason: string };

async function authorizedFetch(
	input: HubDirectoryClientInput,
	path: string,
	init: { readonly method: 'GET' | 'PATCH' | 'POST'; readonly body?: string },
	http: HubDirectoryHttp,
): Promise<{ readonly ok: true; readonly raw: unknown } | { readonly ok: false; readonly code: HubDirectoryDenialCode; readonly reason: string }> {
	const token = input.accessToken.trim();
	if (token.length === 0) {
		return { ok: false, code: 'hub_session_required', reason: 'hub access token is required' };
	}
	const hubUrl = normalizeHttpsUrl(input.hubBaseUrl);
	if (!hubUrl.ok) {
		return { ok: false, code: 'hub_directory_contract_invalid', reason: hubUrl.reason };
	}
	const requestUrl = new URL(path, hubUrl.url);
	try {
		const response = await http.fetch(String(requestUrl), {
			method: init.method,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/json',
				...(init.body ? { 'Content-Type': 'application/json' } : {}),
			},
			body: init.body,
			signal: createFetchAbortSignal(),
		});
		if (response.status !== 200 && response.status !== 204) {
			const code = mapHttpStatus(response.status);
			return {
				ok: false,
				code,
				reason: code === 'hub_directory_http_failed'
					? `directory HTTP ${response.status}`
					: `directory request denied with HTTP ${response.status}`,
			};
		}
		if (response.status === 204) {
			return { ok: true, raw: null };
		}
		return { ok: true, raw: await response.json() };
	} catch (err) {
		return {
			ok: false,
			code: 'hub_directory_http_failed',
			reason: `directory request failed: ${err instanceof Error ? err.message : String(err)}`,
		};
	}
}

export async function listHubDevices(
	input: HubDirectoryClientInput,
	http: HubDirectoryHttp = defaultHttp(),
): Promise<HubDirectoryResult<HubDevice[]>> {
	const response = await authorizedFetch(input, '/api/v1/devices', { method: 'GET' }, http);
	if (!response.ok) {
		return response;
	}
	const parsed = parseHubDevicesResponse(response.raw);
	if (!parsed.ok) {
		return parsed;
	}
	return { ok: true, value: parsed.devices };
}

export async function renameHubDevice(
	input: HubDirectoryClientInput & { readonly hubDeviceId: string; readonly name: string },
	http: HubDirectoryHttp = defaultHttp(),
): Promise<HubDirectoryResult<void>> {
	if (input.hubDeviceId.trim().length === 0) {
		return { ok: false, code: 'hub_directory_contract_invalid', reason: 'hubDeviceId must be non-empty' };
	}
	if (input.name.trim().length === 0) {
		return { ok: false, code: 'hub_directory_contract_invalid', reason: 'name must be non-empty' };
	}
	const response = await authorizedFetch(
		input,
		`/api/v1/devices/${encodeURIComponent(input.hubDeviceId.trim())}`,
		{ method: 'PATCH', body: JSON.stringify({ name: input.name }) },
		http,
	);
	if (!response.ok) {
		return response;
	}
	return { ok: true, value: undefined };
}

export async function revokeHubDevice(
	input: HubDirectoryClientInput & { readonly hubDeviceId: string },
	http: HubDirectoryHttp = defaultHttp(),
): Promise<HubDirectoryResult<void>> {
	if (input.hubDeviceId.trim().length === 0) {
		return { ok: false, code: 'hub_directory_contract_invalid', reason: 'hubDeviceId must be non-empty' };
	}
	const response = await authorizedFetch(
		input,
		`/api/v1/devices/${encodeURIComponent(input.hubDeviceId.trim())}/revoke`,
		{ method: 'POST' },
		http,
	);
	if (!response.ok) {
		return response;
	}
	return { ok: true, value: undefined };
}

export async function confirmHubDeviceCode(
	input: HubDirectoryClientInput & { readonly deviceCode: string },
	http: HubDirectoryHttp = defaultHttp(),
): Promise<HubDirectoryResult<void>> {
	if (input.deviceCode.trim().length === 0) {
		return { ok: false, code: 'hub_directory_contract_invalid', reason: 'deviceCode must be non-empty' };
	}
	const response = await authorizedFetch(
		input,
		'/api/v1/device-codes/confirm',
		{ method: 'POST', body: JSON.stringify({ deviceCode: input.deviceCode.trim() }) },
		http,
	);
	if (!response.ok) {
		return response;
	}
	return { ok: true, value: undefined };
}
