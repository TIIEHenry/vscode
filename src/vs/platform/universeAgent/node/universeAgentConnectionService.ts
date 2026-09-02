/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import type { ConnectionPhase, UniverseAgentConnectProfileResult } from '../common/connectionHubTypes.js';
import type { IUniverseAgentConnection, IUniverseAgentTeamApi, UniverseAgentNavigatorCapabilityKey } from '../common/universeAgentConnection.js';
import type { IUniverseAgentHostConnection } from '../common/universeAgentHostConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
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
	UniverseAgentListSkillsResult,
	UniverseAgentSessionEvent,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentTransportState,
	UniverseAgentAgentTreeNode,
	IFileMutationRecord,
} from '../common/universeAgentTypes.js';
import { createEmptyCapabilitySnapshot, probeEngineCapabilities } from './grpcCapabilityProbe.js';
import { createGrpcUniverseAgentClient, createPinnedGrpcUniverseAgentClient } from './grpc/grpcClient.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, isTransportFailureCode, UniverseAgentTransportError } from './grpc/grpcTransport.js';
import type { ConnectionResolver } from './connectionResolver.js';
import { runDeviceAuthHandshake } from './deviceAuthHandshake.js';
import type { IClientIdentityStore } from './clientIdentityTypes.js';
import type { IConnectionProfileStore } from './connectionProfileStore.js';
import type { IUniverseAgentHubService } from '../common/hub.js';
import { UniverseAgentHubService, type UniverseAgentHubServiceOptions } from './universeAgentHubService.js';

export interface UniverseAgentConnectionServiceOptions extends UniverseAgentHubServiceOptions {
	readonly loopbackAddress?: string;
	readonly createTransport?: (address: string) => IUniverseAgentGrpcTransport;
	readonly connectionResolver?: ConnectionResolver;
	readonly connectionProfileStore?: IConnectionProfileStore;
	readonly clientIdentityStore?: IClientIdentityStore;
}

function isPairingPending(sessionToken: string | undefined, pairingNonce: string | undefined): boolean {
	return !sessionToken && !!pairingNonce;
}

export class UniverseAgentConnectionService extends Disposable implements IUniverseAgentConnection, IUniverseAgentHostConnection, IUniverseAgentHubService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidFileMutation = this._register(new Emitter<IFileMutationRecord>());
	readonly onDidFileMutation = this._onDidFileMutation.event;

	private readonly _onDidChangeTeamRuntime = this._register(new Emitter<{ readonly sessionId: string }>());
	readonly onDidChangeTeamRuntime = this._onDidChangeTeamRuntime.event;

	private readonly _onRequestAgentTreeRefresh = this._register(new Emitter<{ readonly sessionId: string }>());
	readonly onRequestAgentTreeRefresh = this._onRequestAgentTreeRefresh.event;

	readonly team: IUniverseAgentTeamApi;

	private readonly _hub: UniverseAgentHubService;

	private readonly _onDidChangeConnection = this._register(new Emitter<UniverseAgentConnectionSnapshot>());
	readonly onDidChangeConnection = this._onDidChangeConnection.event;

	private _transport: IUniverseAgentGrpcTransport | undefined;
	private _transportState: UniverseAgentTransportState = 'idle';
	private _sessionToken: string | undefined;
	private _workDir: string | undefined;
	private _sharedFsRootSent = false;
	private _pairingPending = false;
	private _agentTreeProbeUnsupported = false;
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
		this._hub = this._register(new UniverseAgentHubService(options));
		this._loopbackAddress = options.loopbackAddress ?? '127.0.0.1:50051';
		this._createTransport = options.createTransport ?? createGrpcUniverseAgentClient;
		this._connectionResolver = options.connectionResolver;
		this._connectionProfileStore = options.connectionProfileStore;
		this._clientIdentityStore = options.clientIdentityStore;
		this.team = {
			memberStatus: (sessionId, agentId) => this._withTransport(t => t.memberStatus(sessionId, agentId)),
			taskList: (sessionId, agentId) => this._withTransport(t => t.taskList(sessionId, agentId)),
			teamInfo: (sessionId, agentId, teamId) => this._withTransport(t => t.teamInfo(sessionId, agentId, teamId)),
		};
	}

	isEngineConnected(): boolean {
		return !!this._sessionToken
			&& !this._pairingPending
			&& !!this._transport?.isChannelAlive;
	}

	getConnectionPhase(): ConnectionPhase {
		return this._connectionPhase;
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

	getNavigatorCapability(key: UniverseAgentNavigatorCapabilityKey): UniverseAgentCapabilitySupport {
		if (key === 'sessionList') {
			return 'UNKNOWN';
		}
		return this._capabilities[key]?.support ?? 'UNKNOWN';
	}

	requestAgentTreeRefresh(sessionId: string): void {
		if (sessionId) {
			this._onRequestAgentTreeRefresh.fire({ sessionId });
		}
	}

	async fetchAgentTree(sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined> {
		if (this._agentTreeProbeUnsupported) {
			return undefined;
		}
		try {
			return await this._withTransport(transport => transport.fetchAgentTree(sessionId));
		} catch (error) {
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this._agentTreeProbeUnsupported = true;
				this._capabilities = {
					...this._capabilities,
					agentTree: { support: 'UNSUPPORTED', reason: 'UNIMPLEMENTED' },
				};
				this._fireSnapshotChanged();
			}
			throw error;
		}
	}

	isAgentTreeUnsupported(): boolean {
		return this._agentTreeProbeUnsupported || this._capabilities.agentTree.support === 'UNSUPPORTED';
	}

	notifyFileMutation(record: IFileMutationRecord): void {
		this._onDidFileMutation.fire(record);
	}

	notifyTeamRuntimeChange(sessionId: string): void {
		this._onDidChangeTeamRuntime.fire({ sessionId });
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		this._connectionPhase = { kind: 'connecting', reason: 'initial' };
		this._sharedFsRootSent = !!request.workDir;
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
		this._sharedFsRootSent = false;
		this._pairingPending = false;
		this._agentTreeProbeUnsupported = false;
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

	async listSkills(): Promise<UniverseAgentListSkillsResult> {
		return this._withTransport(transport => transport.listSkills());
	}

	async setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult> {
		return this._withTransport(transport => transport.setSkillEnabled(request));
	}

	async getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult> {
		return this._withTransport(transport => transport.getSkillInfo(request));
	}

	getActiveHubBaseUrl(): string | undefined {
		return this._hub.getActiveHubBaseUrl();
	}

	setActiveHubBaseUrl(hubBaseUrl: string | undefined): void {
		this._hub.setActiveHubBaseUrl(hubBaseUrl);
	}

	getAuthStatus() {
		return this._hub.getAuthStatus();
	}

	getDirectoryStatus() {
		return this._hub.getDirectoryStatus();
	}

	listConnectionProfiles() {
		return this._hub.listConnectionProfiles();
	}

	get onDidChangeAuthStatus() {
		return this._hub.onDidChangeAuthStatus;
	}

	get onDidChangeDirectory() {
		return this._hub.onDidChangeDirectory;
	}

	get onDidChangeProfiles() {
		return this._hub.onDidChangeProfiles;
	}

	login(hubBaseUrl: string, email: string, password: string) {
		return this._hub.login(hubBaseUrl, email, password);
	}

	logout() {
		return this._hub.logout();
	}

	changePassword(oldPassword: string, newPassword: string) {
		return this._hub.changePassword(oldPassword, newPassword);
	}

	refreshDirectory() {
		return this._hub.refreshDirectory();
	}

	renameDevice(deviceId: string, name: string) {
		return this._hub.renameDevice(deviceId, name);
	}

	revokeDevice(deviceId: string) {
		return this._hub.revokeDevice(deviceId);
	}

	confirmDeviceCode(code: string) {
		return this._hub.confirmDeviceCode(code);
	}

	addDirectAddressProfile(input: {
		readonly host: string;
		readonly port: number;
		readonly displayName?: string;
		readonly allowPrivateNetwork?: boolean;
	}) {
		return this._hub.addDirectAddressProfile(input);
	}

	forgetConnectionProfile(profileId: string) {
		return this._hub.forgetConnectionProfile(profileId);
	}

	isEncryptionAvailable() {
		return this._hub.isEncryptionAvailable();
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
			sharedFsRootSent: this._sharedFsRootSent,
			pairingPending: this._pairingPending,
			channelAlive: !!this._transport?.isChannelAlive,
			capabilities: this._capabilities,
		};
	}

	private _fireSnapshotChanged(): void {
		this._onDidChangeConnection.fire(this._buildSnapshot());
	}
}
