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
import { readGitWriteCapability } from './universeAgentCapabilities.js';
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
	'fireTrigger',
	'setTriggerEnabled',
	'deleteTrigger',
	'upsertTrigger',
	'writeClipboard',
	'readClipboard',
	'clearClipboard',
	'readContextVariable',
	'restoreSnapshot',
	'deleteSnapshot',
	'readGitChanges',
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
		fireTrigger: UNKNOWN_CAPABILITY,
		setTriggerEnabled: UNKNOWN_CAPABILITY,
		deleteTrigger: UNKNOWN_CAPABILITY,
		upsertTrigger: UNKNOWN_CAPABILITY,
		writeClipboard: UNKNOWN_CAPABILITY,
		readClipboard: UNKNOWN_CAPABILITY,
		clearClipboard: UNKNOWN_CAPABILITY,
		readContextVariable: UNKNOWN_CAPABILITY,
		restoreSnapshot: UNKNOWN_CAPABILITY,
		deleteSnapshot: UNKNOWN_CAPABILITY,
		readGitChanges: UNKNOWN_CAPABILITY,
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
		authenticated: false,
		pairingPending: false,
		channelAlive: false,
		sharedFsRootSent: false,
		capabilities: createIdleCapabilitySnapshot(),
		sessionListCapability: 'UNKNOWN',
		gitWriteCapability: readGitWriteCapability(undefined),
		phase: { kind: 'disconnected' },
		agentTreeFetchFailed: false,
	};
}

export function readSessionListCapability(snapshot: UniverseAgentConnectionSnapshot | undefined): UniverseAgentCapabilitySupport {
	const support = snapshot?.sessionListCapability;
	return support === 'SUPPORTED' || support === 'UNSUPPORTED' || support === 'UNKNOWN' ? support : 'UNKNOWN';
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
			if (Reflect.has(target, prop)) {
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
			if (Reflect.has(target, prop)) {
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

/**
 * Phase on a snapshot. Missing or unreadable values are disconnected, never connected.
 */
function readSnapshotPhase(phase: ConnectionPhase | undefined): ConnectionPhase {
	if (!phase || typeof phase !== 'object' || isThenable(phase)) {
		return { kind: 'disconnected' };
	}
	switch (phase.kind) {
		case 'disconnected':
			return { kind: 'disconnected' };
		case 'closed':
			return { kind: 'closed' };
		case 'connecting':
			if (phase.reason === 'initial' || phase.reason === 'transport_lost') {
				return { kind: 'connecting', reason: phase.reason };
			}
			return { kind: 'disconnected' };
		case 'connected':
			if (phase.path === 'direct' || phase.path === 'hubRelay' || phase.path === 'loopback') {
				return { kind: 'connected', path: phase.path };
			}
			return { kind: 'disconnected' };
		case 'failed':
			if (typeof phase.code === 'string' && phase.code.length > 0 && typeof phase.reason === 'string') {
				return { kind: 'failed', code: phase.code, reason: phase.reason };
			}
			return { kind: 'disconnected' };
		default:
			return { kind: 'disconnected' };
	}
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

	/** H4b live-engine gate — same as `isConversationEngineLive(phase, pairingPending)`. */
	get connected(): boolean {
		return isUniverseAgentPhaseConnected(this._phase) && !this._snapshot.pairingPending;
	}

	get agentTreeFetchFailed(): boolean {
		return this._agentTreeFetchFailed;
	}

	applySnapshot(snapshot: UniverseAgentConnectionSnapshot): void {
		const phase = readSnapshotPhase(snapshot.phase);
		const agentTreeFetchFailed = snapshot.agentTreeFetchFailed === true;
		this._phase = phase;
		this._agentTreeFetchFailed = agentTreeFetchFailed;
		// Copy the renderer fields explicitly so a smuggled sessionToken cannot stay in the cache.
		this._snapshot = {
			transport: snapshot.transport,
			authenticated: snapshot.authenticated === true,
			workDir: snapshot.workDir,
			sharedFsRootSent: snapshot.sharedFsRootSent,
			pairingPending: snapshot.pairingPending,
			channelAlive: snapshot.channelAlive,
			capabilities: sanitizeDesktopCapabilitySnapshot(normalizeCapabilities(snapshot.capabilities)),
			sessionListCapability: readSessionListCapability(snapshot),
			gitWriteCapability: readGitWriteCapability(snapshot),
			phase,
			agentTreeFetchFailed,
		};
	}

	applyPhase(phase: ConnectionPhase): void {
		this._phase = readSnapshotPhase(phase);
		this._snapshot = {
			...this._snapshot,
			phase: this._phase,
		};
	}

	applyAgentTreeFetchFailed(failed: boolean): void {
		this._agentTreeFetchFailed = failed === true;
		this._snapshot = {
			...this._snapshot,
			agentTreeFetchFailed: this._agentTreeFetchFailed,
		};
	}

	navigatorCapability(key: UniverseAgentNavigatorCapabilityKey): UniverseAgentCapabilitySupport {
		if (key === 'sessionList') {
			return readSessionListCapability(this._snapshot);
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
	private _profilesGeneration = 0;
	private _authGeneration = 0;
	private _directoryGeneration = 0;
	private _hubBaseUrlGeneration = 0;

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

	get profilesGeneration(): number {
		return this._profilesGeneration;
	}

	get authGeneration(): number {
		return this._authGeneration;
	}

	get directoryGeneration(): number {
		return this._directoryGeneration;
	}

	get hubBaseUrlGeneration(): number {
		return this._hubBaseUrlGeneration;
	}

	applyProfiles(value: unknown): void {
		this._profiles = asConnectionProfileList(value);
		this._profilesGeneration++;
	}

	applyAuth(status: HubAuthStatus): void {
		this._auth = status;
		this._authGeneration++;
	}

	applyDirectory(status: HubDirectoryStatus): void {
		this._directory = status;
		this._directoryGeneration++;
	}

	applyHubBaseUrl(url: string | undefined): void {
		this._hubBaseUrl = url;
		this._hubBaseUrlGeneration++;
	}
}
