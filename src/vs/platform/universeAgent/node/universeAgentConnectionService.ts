/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import type { ConnectionPhase, UniverseAgentConnectProfileResult } from '../common/connectionHubTypes.js';
import type { IUniverseAgentConnection } from '../common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentConnectionSnapshot,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentSessionEvent,
	UniverseAgentTransportState,
} from '../common/universeAgentTypes.js';
import { createEmptyCapabilitySnapshot, probeEngineCapabilities } from './grpcCapabilityProbe.js';
import { createGrpcUniverseAgentClient, createPinnedGrpcUniverseAgentClient } from './grpc/grpcClient.js';
import { IUniverseAgentGrpcTransport, isTransportFailureCode, UniverseAgentTransportError } from './grpc/grpcTransport.js';
import type { ConnectionResolver } from './connectionResolver.js';
import { runDeviceAuthHandshake } from './deviceAuthHandshake.js';
import type { IClientIdentityStore } from './clientIdentityTypes.js';
import type { IConnectionProfileStore } from './connectionProfileStore.js';

export interface UniverseAgentConnectionServiceOptions {
	readonly loopbackAddress?: string;
	readonly createTransport?: (address: string) => IUniverseAgentGrpcTransport;
	readonly connectionResolver?: ConnectionResolver;
	readonly connectionProfileStore?: IConnectionProfileStore;
	readonly clientIdentityStore?: IClientIdentityStore;
}

function isPairingPending(sessionToken: string | undefined, pairingNonce: string | undefined): boolean {
	return !sessionToken && !!pairingNonce;
}

export class UniverseAgentConnectionService extends Disposable implements IUniverseAgentConnection {

	declare readonly _serviceBrand: undefined;

	readonly onDidFileMutation = Event.None;

	private readonly _onDidChangeConnection = this._register(new Emitter<UniverseAgentConnectionSnapshot>());
	readonly onDidChangeConnection = this._onDidChangeConnection.event;

	private _transport: IUniverseAgentGrpcTransport | undefined;
	private _transportState: UniverseAgentTransportState = 'idle';
	private _sessionToken: string | undefined;
	private _workDir: string | undefined;
	private _pairingPending = false;
	private _capabilities: UniverseAgentCapabilitySnapshot = createEmptyCapabilitySnapshot();
	private _connectionPhase: ConnectionPhase = { kind: 'disconnected' };
	private _activeProfileId: string | undefined;

	private readonly _loopbackAddress: string;
	private readonly _createTransport: (address: string) => IUniverseAgentGrpcTransport;
	private readonly _connectionResolver: ConnectionResolver | undefined;
	private readonly _connectionProfileStore: IConnectionProfileStore | undefined;
	private readonly _clientIdentityStore: IClientIdentityStore | undefined;

	constructor(options: UniverseAgentConnectionServiceOptions = {}) {
		super();
		this._loopbackAddress = options.loopbackAddress ?? '127.0.0.1:50051';
		this._createTransport = options.createTransport ?? createGrpcUniverseAgentClient;
		this._connectionResolver = options.connectionResolver;
		this._connectionProfileStore = options.connectionProfileStore;
		this._clientIdentityStore = options.clientIdentityStore;
	}

	isEngineConnected(): boolean {
		return !!this._sessionToken
			&& !this._pairingPending
			&& !!this._transport?.isChannelAlive;
	}

	getTransportState(): UniverseAgentTransportState {
		return this._transportState;
	}

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot {
		return this._buildSnapshot();
	}

	getCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
		return this._capabilities;
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		this._connectionPhase = { kind: 'connecting', reason: 'initial' };
		this._ensureTransport();
		try {
			const result = await this._transport!.connect(request);
			this._sessionToken = result.sessionToken;
			this._workDir = result.workDir;
			this._pairingPending = isPairingPending(result.sessionToken, result.pairingNonce);
			this._transportState = 'ok';
			if (!this._pairingPending && this._transport) {
				this._capabilities = await probeEngineCapabilities({
					methods: result.methods,
					transport: this._transport,
				});
			}
			this._connectionPhase = this._pairingPending
				? { kind: 'connecting', reason: 'initial' }
				: { kind: 'connected', path: 'loopback' };
			this._fireSnapshotChanged();
			return result;
		} catch (error) {
			this._markTransportFailed(error);
			throw error;
		}
	}

	async connectProfile(profileId: string, options: { readonly reconnect?: boolean } = {}): Promise<UniverseAgentConnectProfileResult> {
		if (!this._connectionResolver || !this._clientIdentityStore) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'connection resolver is not configured',
			};
		}

		const reconnect = options.reconnect === true || this._transportState === 'failed';
		this._connectionPhase = {
			kind: 'connecting',
			reason: reconnect ? 'transport_lost' : 'initial',
		};
		this._activeProfileId = profileId;

		const resolved = await this._connectionResolver.resolve(profileId, { forceNewTicket: reconnect });
		if (!resolved.ok) {
			this._connectionPhase = { kind: 'failed', code: resolved.code, reason: resolved.reason };
			this._fireSnapshotChanged();
			return { ok: false, code: resolved.code, reason: resolved.reason };
		}

		this._transport?.close();
		const endpoint = resolved.endpoint;
		const dialAddress = `${endpoint.resolvedIp}:${endpoint.port}`;
		if (endpoint.tls) {
			this._transport = createPinnedGrpcUniverseAgentClient({
				address: dialAddress,
				tls: endpoint.tls,
				sslTargetNameOverride: endpoint.servername,
			});
		} else {
			this._transport = this._createTransport(dialAddress);
		}

		const identityState = await this._clientIdentityStore.getOrCreateIdentity();
		if (identityState.kind !== 'ready') {
			const reason = `client identity unavailable: ${identityState.kind}`;
			this._connectionPhase = { kind: 'failed', code: 'trust_missing', reason };
			this._fireSnapshotChanged();
			return { ok: false, code: 'trust_missing', reason };
		}

		if (!endpoint.tls) {
			return this.connect({
				clientId: identityState.identity.clientIdentityId,
				protocolVersion: '1',
			}).then(result => ({
				ok: true as const,
				path: endpoint.path,
				sessionToken: result.sessionToken,
				workDir: result.workDir,
				pairingPending: isPairingPending(result.sessionToken, result.pairingNonce),
			}));
		}

		const profile = this._connectionProfileStore?.get(profileId);
		const engineIdentityId = profile?.trust?.engineIdentityId;
		if (!engineIdentityId) {
			const reason = 'paired profile trust is required for pinned dial';
			this._connectionPhase = { kind: 'failed', code: 'trust_missing', reason };
			this._fireSnapshotChanged();
			return { ok: false, code: 'trust_missing', reason };
		}

		const signer = await this._clientIdentityStore.createSigner();
		if (!signer) {
			const reason = 'device auth signer unavailable';
			this._connectionPhase = { kind: 'failed', code: 'trust_missing', reason };
			this._fireSnapshotChanged();
			return { ok: false, code: 'trust_missing', reason };
		}

		try {
			const handshake = await runDeviceAuthHandshake(
				this._transport,
				{
					clientIdentityId: identityState.identity.clientIdentityId,
					clientPublicKey: identityState.identity.clientPublicKey,
					engineIdentityId,
					observedLeafSha256Hex: endpoint.tls.expectedLeafSha256Hex,
				},
				signer,
				{ pairingPhase: 'formal' },
			);

			if (handshake.kind === 'failed') {
				const code = handshake.code === 'transport_failed' ? 'transport_failed' : 'pin_mismatch';
				this._connectionPhase = { kind: 'failed', code, reason: handshake.reason };
				this._fireSnapshotChanged();
				return { ok: false, code, reason: handshake.reason };
			}

			if (handshake.kind === 'pairing_pending') {
				this._sessionToken = undefined;
				this._workDir = handshake.result.workDir;
				this._pairingPending = true;
				this._transportState = 'ok';
				this._connectionPhase = { kind: 'connecting', reason: 'initial' };
				this._fireSnapshotChanged();
				return {
					ok: true,
					path: endpoint.path,
					workDir: handshake.result.workDir,
					pairingPending: true,
				};
			}

			this._sessionToken = handshake.result.sessionToken;
			this._workDir = handshake.result.workDir;
			this._pairingPending = false;
			this._transportState = 'ok';
			this._capabilities = await probeEngineCapabilities({
				methods: handshake.result.methods,
				transport: this._transport,
			});
			this._connectionPhase = { kind: 'connected', path: endpoint.path };
			this._fireSnapshotChanged();
			return {
				ok: true,
				path: endpoint.path,
				sessionToken: handshake.result.sessionToken,
				workDir: handshake.result.workDir,
				pairingPending: false,
			};
		} catch (error) {
			this._markTransportFailed(error);
			const reason = error instanceof Error ? error.message : String(error);
			return { ok: false, code: 'transport_failed', reason };
		}
	}

	async disconnect(): Promise<void> {
		this._transport?.close();
		this._transport = undefined;
		this._sessionToken = undefined;
		this._workDir = undefined;
		this._pairingPending = false;
		this._transportState = 'idle';
		this._capabilities = createEmptyCapabilitySnapshot();
		this._connectionPhase = { kind: 'closed' };
		this._activeProfileId = undefined;
		this._fireSnapshotChanged();
	}

	async listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		return this._withTransport(transport => transport.listSessions(request));
	}

	async createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		return this._withTransport(transport => transport.createSession(request));
	}

	async deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void> {
		await this._withTransport(transport => transport.deleteSession(request));
	}

	async getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		return this._withTransport(transport => transport.getHistory(request));
	}

	subscribeSessionEventStream(sessionId: string, listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void } {
		this._assertTransportReady();
		return this._transport!.subscribeSessionEventStream(sessionId, listener);
	}

	async chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
		await this._withTransport(transport => transport.chat(request, onResponse));
	}

	override dispose(): void {
		this._transport?.close();
		this._transport = undefined;
		super.dispose();
	}

	private _ensureTransport(): void {
		if (!this._transport) {
			this._transport = this._createTransport(this._loopbackAddress);
		}
	}

	private _assertTransportReady(): void {
		if (!this._transport || this._transportState === 'failed') {
			throw new UniverseAgentTransportError(14, 'UniverseAgent transport is not available');
		}
	}

	private async _withTransport<T>(operation: (transport: IUniverseAgentGrpcTransport) => Promise<T>): Promise<T> {
		this._assertTransportReady();
		try {
			const result = await operation(this._transport!);
			if (this._transportState !== 'ok') {
				this._transportState = 'ok';
				this._fireSnapshotChanged();
			}
			return result;
		} catch (error) {
			this._markTransportFailed(error);
			throw error;
		}
	}

	private _markTransportFailed(error: unknown): void {
		if (error instanceof UniverseAgentTransportError && isTransportFailureCode(error.code)) {
			this._transportState = 'failed';
			if (this._activeProfileId) {
				this._connectionPhase = { kind: 'connecting', reason: 'transport_lost' };
			} else if (this._connectionPhase.kind === 'connecting') {
				this._connectionPhase = { kind: 'failed', code: 'transport_failed', reason: error.message };
			}
			this._fireSnapshotChanged();
		}
	}

	private _buildSnapshot(): UniverseAgentConnectionSnapshot {
		return {
			transport: this._transportState,
			sessionToken: this._sessionToken,
			workDir: this._workDir,
			pairingPending: this._pairingPending,
			channelAlive: !!this._transport?.isChannelAlive,
			capabilities: this._capabilities,
		};
	}

	private _fireSnapshotChanged(): void {
		this._onDidChangeConnection.fire(this._buildSnapshot());
	}
}
