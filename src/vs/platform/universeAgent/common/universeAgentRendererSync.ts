/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConnectionPhase } from './connectionHubTypes.js';
import type { UniverseAgentNavigatorCapabilityKey } from './universeAgentConnection.js';
import type {
	ConnectionProfileProjection,
	HubAuthStatus,
	HubDirectoryStatus,
} from './hub.js';
import type {
	UniverseAgentCapabilityEntry,
	UniverseAgentCapabilityKey,
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
	UniverseAgentConnectionSnapshot,
	UniverseAgentTransportState,
} from './universeAgentTypes.js';

const UNKNOWN_CAPABILITY: UniverseAgentCapabilityEntry = { support: 'UNKNOWN' };

/** Web stub only. Desktop idle / node empty snapshots must never use this reason. */
export const WEB_UNSUPPORTED_LOCAL_ENGINE_REASON = 'Web 不支持本机 Engine 连接';

const CAPABILITY_KEYS: readonly UniverseAgentCapabilityKey[] = [
	'skills',
	'mcp',
	'mcpRuntime',
	'plugins',
	'models',
	'providerConfig',
	'globalRules',
	'agentProfiles',
	'projectRules',
	'tools',
	'hooksMetadata',
	'agentTree',
	'team',
];

/** Renderer-safe empty matrix when IPC has not hydrated yet (or a key is missing). */
export function createIdleCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
	return {
		skills: UNKNOWN_CAPABILITY,
		mcp: UNKNOWN_CAPABILITY,
		mcpRuntime: UNKNOWN_CAPABILITY,
		plugins: UNKNOWN_CAPABILITY,
		models: UNKNOWN_CAPABILITY,
		providerConfig: UNKNOWN_CAPABILITY,
		globalRules: UNKNOWN_CAPABILITY,
		agentProfiles: UNKNOWN_CAPABILITY,
		projectRules: UNKNOWN_CAPABILITY,
		tools: UNKNOWN_CAPABILITY,
		hooksMetadata: UNKNOWN_CAPABILITY,
		agentTree: UNKNOWN_CAPABILITY,
		team: UNKNOWN_CAPABILITY,
	};
}

export function capabilityEntryIsWebUnsupported(entry: UniverseAgentCapabilityEntry | undefined): boolean {
	return entry?.reason === WEB_UNSUPPORTED_LOCAL_ENGINE_REASON;
}

/**
 * Electron / node snapshots must not carry the Web stub reason.
 * WebUniverseAgentConnection returns the stub snapshot directly and skips this.
 */
export function sanitizeDesktopCapabilitySnapshot(snapshot: UniverseAgentCapabilitySnapshot): UniverseAgentCapabilitySnapshot {
	let changed = false;
	const next = { ...snapshot };
	for (const key of CAPABILITY_KEYS) {
		if (capabilityEntryIsWebUnsupported(next[key])) {
			next[key] = UNKNOWN_CAPABILITY;
			changed = true;
		}
	}
	return changed ? next : snapshot;
}

export function createIdleConnectionSnapshot(): UniverseAgentConnectionSnapshot {
	return {
		transport: 'idle',
		pairingPending: false,
		channelAlive: false,
		sharedFsRootSent: false,
		capabilities: createIdleCapabilitySnapshot(),
	};
}

export function readCapabilityEntry(
	snapshot: UniverseAgentCapabilitySnapshot | undefined,
	key: UniverseAgentCapabilityKey,
): UniverseAgentCapabilityEntry {
	return snapshot?.[key] ?? UNKNOWN_CAPABILITY;
}

export function isUniverseAgentPhaseConnected(phase: ConnectionPhase | undefined): phase is Extract<ConnectionPhase, { kind: 'connected' }> {
	return phase?.kind === 'connected';
}

export function asConnectionProfileList(value: unknown): readonly ConnectionProfileProjection[] {
	return Array.isArray(value) ? value : [];
}

export async function resolveMaybePromise<T>(value: T | Promise<T>): Promise<T> {
	return await value;
}

/**
 * ProxyChannel turns every method into `async`. Bind local sync getters first,
 * then forward the rest to the remote stub.
 */
export function createRemoteForwardingProxy<T extends object>(local: T, remote: object): T {
	return new Proxy(local, {
		get(target, prop, receiver) {
			if (prop === 'then') {
				return undefined;
			}
			if (prop in target) {
				const value = Reflect.get(target, prop, receiver);
				if (typeof value === 'function') {
					return value.bind(target);
				}
				if (value !== undefined) {
					return value;
				}
			}
			const remoteValue = Reflect.get(remote, prop);
			if (typeof remoteValue === 'function') {
				return remoteValue.bind(remote);
			}
			if (prop in target) {
				return Reflect.get(target, prop, receiver);
			}
			return remoteValue;
		},
	});
}

function isThenable(value: unknown): boolean {
	return !!value && typeof value === 'object' && typeof (value as { then?: unknown }).then === 'function';
}

function normalizeCapabilities(snapshot: UniverseAgentCapabilitySnapshot | undefined): UniverseAgentCapabilitySnapshot {
	const fallback = createIdleCapabilitySnapshot();
	if (!snapshot || typeof snapshot !== 'object' || isThenable(snapshot)) {
		return fallback;
	}
	const next = { ...fallback };
	for (const key of CAPABILITY_KEYS) {
		if (snapshot[key]) {
			next[key] = snapshot[key];
		}
	}
	return next;
}

export function ensureCapabilitySnapshot(snapshot: UniverseAgentCapabilitySnapshot | undefined): UniverseAgentCapabilitySnapshot {
	return normalizeCapabilities(snapshot);
}

/** Sync view of proxied {@link IUniverseAgentConnection} getters. */
export class UniverseAgentConnectionSyncCache {

	private _phase: ConnectionPhase = { kind: 'disconnected' };
	private _snapshot: UniverseAgentConnectionSnapshot = createIdleConnectionSnapshot();
	private _agentTreeFetchFailed = false;

	get phase(): ConnectionPhase {
		return this._phase;
	}

	get snapshot(): UniverseAgentConnectionSnapshot {
		return this._snapshot;
	}

	get capabilities(): UniverseAgentCapabilitySnapshot {
		return this._snapshot.capabilities;
	}

	get transport(): UniverseAgentTransportState {
		return this._snapshot.transport;
	}

	get connected(): boolean {
		return this._phase.kind === 'connected';
	}

	get agentTreeFetchFailed(): boolean {
		return this._agentTreeFetchFailed;
	}

	applySnapshot(snapshot: UniverseAgentConnectionSnapshot): void {
		this._snapshot = {
			...snapshot,
			capabilities: sanitizeDesktopCapabilitySnapshot(normalizeCapabilities(snapshot.capabilities)),
		};
	}

	applyPhase(phase: ConnectionPhase): void {
		this._phase = phase;
	}

	applyAgentTreeFetchFailed(failed: boolean): void {
		this._agentTreeFetchFailed = failed;
	}

	navigatorCapability(key: UniverseAgentNavigatorCapabilityKey): UniverseAgentCapabilitySupport {
		// Session listing is not carried in the capability snapshot; the node service
		// answers the same way.
		if (key === 'sessionList') {
			return 'UNKNOWN';
		}
		return this._snapshot.capabilities[key]?.support ?? 'UNKNOWN';
	}
}

/** Sync view of proxied {@link IUniverseAgentHubService} getters. */
export class UniverseAgentHubSyncCache {

	private _profiles: readonly ConnectionProfileProjection[] = [];
	private _auth: HubAuthStatus = { kind: 'signedOut' };
	private _directory: HubDirectoryStatus = { kind: 'idle' };
	private _hubBaseUrl: string | undefined;

	get profiles(): readonly ConnectionProfileProjection[] {
		return this._profiles;
	}

	get auth(): HubAuthStatus {
		return this._auth;
	}

	get directory(): HubDirectoryStatus {
		return this._directory;
	}

	get hubBaseUrl(): string | undefined {
		return this._hubBaseUrl;
	}

	applyProfiles(value: unknown): void {
		this._profiles = asConnectionProfileList(value);
	}

	applyAuth(status: HubAuthStatus): void {
		this._auth = status;
	}

	applyDirectory(status: HubDirectoryStatus): void {
		this._directory = status;
	}

	applyHubBaseUrl(url: string | undefined): void {
		this._hubBaseUrl = url;
	}
}
