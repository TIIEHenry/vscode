/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../base/common/event.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import type { ConnectionPhase, ConnectionFailureCode, ConnectionProbeResult, UniverseAgentConnectProfileResult } from '../common/connectionHubTypes.js';
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
	UniverseAgentListAgentProfilesRequest,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSaveAgentProfileResult,
	UniverseAgentDeleteAgentProfileRequest,
	UniverseAgentDeleteAgentProfileResult,
	UniverseAgentResetAgentProfileRequest,
	UniverseAgentResetAgentProfileResult,
	UniverseAgentListMcpServersRequest,
	UniverseAgentListMcpServersResult,
	UniverseAgentGetMcpServerStatusesResult,
	UniverseAgentGetMcpServerToolsResult,
	UniverseAgentListPluginsResult,
	UniverseAgentPluginInfoResult,
	UniverseAgentEnablePluginResult,
	UniverseAgentReloadPluginResult,
	UniverseAgentUnloadPluginResult,
	UniverseAgentScanNewPluginsResult,
	UniverseAgentAddMcpServerRequest,
	UniverseAgentAddMcpServerResult,
	UniverseAgentUpdateMcpServerRequest,
	UniverseAgentUpdateMcpServerResult,
	UniverseAgentRemoveMcpServerRequest,
	UniverseAgentRemoveMcpServerResult,
	UniverseAgentListToolsResult,
	UniverseAgentListModelsResult,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentSessionEvent,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentTransportState,
	UniverseAgentAgentTreeNode,
	UniverseAgentFetchToolDetailRequest,
	UniverseAgentFetchToolDetailResult,
	IFileMutationRecord,
	ITurnSettleSignal,
} from '../common/universeAgentTypes.js';
import { createEmptyCapabilitySnapshot, probeEngineCapabilities } from './grpcCapabilityProbe.js';
import { createGrpcUniverseAgentClient, createPinnedGrpcUniverseAgentClient } from './grpc/grpcClient.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, isTransportFailureCode, UniverseAgentFetchToolDetailMethodKey, UniverseAgentGrpcServices, UniverseAgentSaveSkillContentMethodKey, UniverseAgentTransportError } from './grpc/grpcTransport.js';
import type { ConnectionResolver } from './connectionResolver.js';
import { runDeviceAuthHandshake } from './deviceAuthHandshake.js';
import type { IClientIdentityStore } from './clientIdentityTypes.js';
import type { ConnectionProfile, IConnectionProfileStore } from './connectionProfileStore.js';
import type { IEngineTrustStore } from './engineTrustStore.js';
import { createPairingOrchestrator, isPairingOrchestratorProfile, PairingOrchestrator, type PairingDialEndpoint } from './pairingOrchestrator.js';
import type { IUniverseAgentHubService } from '../common/hub.js';
import { UniverseAgentHubService, type UniverseAgentHubServiceOptions } from './universeAgentHubService.js';

export interface UniverseAgentConnectionServiceOptions extends UniverseAgentHubServiceOptions {
	readonly loopbackAddress?: string;
	readonly createTransport?: (address: string) => IUniverseAgentGrpcTransport;
	readonly connectionResolver?: ConnectionResolver;
	readonly connectionProfileStore?: IConnectionProfileStore;
	readonly clientIdentityStore?: IClientIdentityStore;
	readonly engineTrustStore?: IEngineTrustStore;
	readonly pairingOrchestrator?: PairingOrchestrator;
}

function isPairingPending(sessionToken: string | undefined, pairingNonce: string | undefined): boolean {
	return !sessionToken && !!pairingNonce;
}

export class UniverseAgentConnectionService extends Disposable implements IUniverseAgentConnection, IUniverseAgentHostConnection, IUniverseAgentHubService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidFileMutation = this._register(new Emitter<IFileMutationRecord>());
	readonly onDidFileMutation = this._onDidFileMutation.event;

	private readonly _onDidTurnSettle = this._register(new Emitter<ITurnSettleSignal>());
	readonly onDidTurnSettle = this._onDidTurnSettle.event;

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
	private _agentTreeFetchFailed = false;
	private _fetchToolDetailUnsupported = false;
	private _advertisedMethods: readonly string[] = [];
	private _capabilities: UniverseAgentCapabilitySnapshot = createEmptyCapabilitySnapshot();
	private _connectionPhase: ConnectionPhase = { kind: 'disconnected' };
	private _activeProfileId: string | undefined;

	private readonly _loopbackAddress: string;
	private readonly _createTransport: (address: string) => IUniverseAgentGrpcTransport;
	private readonly _connectionResolver: ConnectionResolver | undefined;
	private readonly _connectionProfileStore: IConnectionProfileStore | undefined;
	private readonly _clientIdentityStore: IClientIdentityStore | undefined;
	private readonly _pairingOrchestrator: PairingOrchestrator | undefined;

	constructor(options: UniverseAgentConnectionServiceOptions = {}) {
		super();
		this._hub = this._register(new UniverseAgentHubService(options));
		this._loopbackAddress = options.loopbackAddress ?? '127.0.0.1:50051';
		this._createTransport = options.createTransport ?? createGrpcUniverseAgentClient;
		this._connectionResolver = options.connectionResolver;
		this._connectionProfileStore = options.connectionProfileStore;
		this._clientIdentityStore = options.clientIdentityStore;
		if (options.pairingOrchestrator) {
			this._pairingOrchestrator = options.pairingOrchestrator;
		} else if (this._clientIdentityStore && this._connectionProfileStore && options.engineTrustStore) {
			this._pairingOrchestrator = createPairingOrchestrator({
				clientIdentityStore: this._clientIdentityStore,
				engineTrustStore: options.engineTrustStore,
				connectionProfileStore: this._connectionProfileStore,
				createPinnedTransport: ({ endpoint, tls }) => createPinnedGrpcUniverseAgentClient({
					address: `${endpoint.host}:${endpoint.port}`,
					tls,
					sslTargetNameOverride: endpoint.servername,
				}),
				issueRelayTicket: this._connectionResolver?.createIssueRelayTicketHook(),
				confirmSas: async () => true,
				confirmRecoverTrust: async () => true,
			});
		}
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
			const root = await this._withTransport(transport => transport.fetchAgentTree(sessionId));
			this._setAgentTreeFetchFailed(false);
			return root;
		} catch (error) {
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this._agentTreeProbeUnsupported = true;
				this._setAgentTreeFetchFailed(false);
				this._capabilities = {
					...this._capabilities,
					agentTree: { support: 'UNSUPPORTED', reason: 'UNIMPLEMENTED' },
				};
				this._fireSnapshotChanged();
			} else {
				this._setAgentTreeFetchFailed(true);
			}
			throw error;
		}
	}

	isAgentTreeUnsupported(): boolean {
		return this._agentTreeProbeUnsupported || this._capabilities.agentTree.support === 'UNSUPPORTED';
	}

	isAgentTreeFetchFailed(): boolean {
		return this._agentTreeFetchFailed;
	}

	async fetchToolDetail(request: UniverseAgentFetchToolDetailRequest): Promise<UniverseAgentFetchToolDetailResult> {
		if (!this.isEngineConnected() || !this._transport) {
			return { ok: false, reason: 'failed', message: 'Engine not connected' };
		}
		if (this._fetchToolDetailUnsupported || !this._advertisedMethods.includes(UniverseAgentFetchToolDetailMethodKey)) {
			return { ok: false, reason: 'unavailable' };
		}
		try {
			const wire = await this._transport.fetchToolDetail(request);
			if (!wire.success) {
				return { ok: false, reason: 'failed', message: wire.errorMessage };
			}
			return {
				ok: true,
				content: wire.content,
				truncated: wire.truncated,
				...(wire.totalBytes !== undefined ? { totalBytes: wire.totalBytes } : {}),
			};
		} catch (error) {
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this._fetchToolDetailUnsupported = true;
				return { ok: false, reason: 'unavailable' };
			}
			return { ok: false, reason: 'failed', message: error instanceof Error ? error.message : undefined };
		}
	}

	notifyFileMutation(record: IFileMutationRecord): void {
		this._onDidFileMutation.fire(record);
	}

	notifyTurnSettle(signal: ITurnSettleSignal): void {
		this._onDidTurnSettle.fire(signal);
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
			this._rememberAdvertisedMethods(result.methods);
			if (!this._pairingPending && this._transport) {
				this._capabilities = await probeEngineCapabilities({
					methods: result.methods,
					transport: this._transport,
				});
				await this._refreshSaveSkillContentBinding(result.methods);
			}
			this._connectionPhase = this._pairingPending
				? { kind: 'connecting', reason: 'initial' }
				: { kind: 'connected', path: 'loopback' };
			this._agentTreeFetchFailed = false;
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
			const profile = this._connectionProfileStore?.get(profileId);
			if (resolved.code === 'pairing_required' && profile && isPairingOrchestratorProfile(profile)) {
				return this._startProfilePairing(profileId, profile, reconnect);
			}
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
			this._rememberAdvertisedMethods(handshake.result.methods);
			this._capabilities = await probeEngineCapabilities({
				methods: handshake.result.methods,
				transport: this._transport,
			});
			await this._refreshSaveSkillContentBinding(handshake.result.methods);
			this._connectionPhase = { kind: 'connected', path: endpoint.path };
			this._agentTreeFetchFailed = false;
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

	async confirmPairing(): Promise<UniverseAgentConnectProfileResult> {
		if (!this._pairingOrchestrator) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'pairing orchestrator is not configured',
			};
		}

		const snapshot = this._pairingOrchestrator.getSnapshot();
		const profileId = this._activeProfileId;
		if (!snapshot || !profileId) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'no pairing awaiting confirmation',
			};
		}

		const confirmResult = snapshot.phase === 'recover_trust'
			? await this._pairingOrchestrator.confirmRecoverTrust()
			: await this._pairingOrchestrator.confirmSas();

		if (!confirmResult.ok) {
			const code = this._mapPairingFailureCode(confirmResult.code);
			this._connectionPhase = { kind: 'failed', code, reason: confirmResult.reason };
			this._fireSnapshotChanged();
			return { ok: false, code, reason: confirmResult.reason };
		}

		if (confirmResult.snapshot.phase === 'grant_pending') {
			this._pairingPending = true;
			this._connectionPhase = { kind: 'connecting', reason: 'initial' };
			this._fireSnapshotChanged();
			return {
				ok: true,
				path: 'direct',
				pairingPending: true,
				engineIdentityId: confirmResult.snapshot.engineIdentityId,
			};
		}

		this._pairingPending = false;
		return this.connectProfile(profileId);
	}

	async cancelPairing(): Promise<void> {
		this._pairingOrchestrator?.abandonRecoverTrust();
		await this.disconnect();
	}

	async probeConnectionProfile(profileId: string): Promise<ConnectionProbeResult> {
		if (!this._connectionResolver || !this._clientIdentityStore) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'connection resolver is not configured',
			};
		}

		const phaseBefore = this._connectionPhase;
		const transportBefore = this._transport;

		const resolved = await this._connectionResolver.resolve(profileId);
		if (!resolved.ok) {
			return { ok: false, code: resolved.code, reason: resolved.reason };
		}

		const endpoint = resolved.endpoint;
		const dialAddress = `${endpoint.resolvedIp}:${endpoint.port}`;
		let probeTransport: IUniverseAgentGrpcTransport;
		if (endpoint.tls) {
			probeTransport = createPinnedGrpcUniverseAgentClient({
				address: dialAddress,
				tls: endpoint.tls,
				sslTargetNameOverride: endpoint.servername,
			});
		} else {
			probeTransport = this._createTransport(dialAddress);
		}

		const identityState = await this._clientIdentityStore.getOrCreateIdentity();
		if (identityState.kind !== 'ready') {
			probeTransport.close();
			return {
				ok: false,
				code: 'trust_missing',
				reason: `client identity unavailable: ${identityState.kind}`,
			};
		}

		const startMs = Date.now();
		const probeTimeoutMs = 10_000;
		try {
			await Promise.race([
				probeTransport.getAuthNonce({
					clientIdentityId: identityState.identity.clientIdentityId,
					clientPublicKey: identityState.identity.clientPublicKey,
				}),
				new Promise<never>((_, reject) => {
					setTimeout(() => reject(new Error('probe timed out after 10s')), probeTimeoutMs);
				}),
			]);
			return {
				ok: true,
				path: endpoint.path,
				authority: endpoint.authority,
				latencyMs: Date.now() - startMs,
			};
		} catch (error) {
			return this._mapProbeTransportError(error);
		} finally {
			probeTransport.close();
			// Guard: probe must not mutate live connection state.
			this._connectionPhase = phaseBefore;
			this._transport = transportBefore;
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
		this._agentTreeFetchFailed = false;
		this._fetchToolDetailUnsupported = false;
		this._advertisedMethods = [];
		this._clearSaveSkillContentBinding();
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

	async listAgentProfiles(request: UniverseAgentListAgentProfilesRequest = {}): Promise<UniverseAgentListAgentProfilesResult> {
		const workDir = this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.listAgentProfiles({
			projectPath: request.projectPath ?? workDir,
		}));
	}

	async saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult> {
		return this._withTransport(transport => transport.saveAgentProfile(request));
	}

	async deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult> {
		return this._withTransport(transport => transport.deleteAgentProfile(request));
	}

	async resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult> {
		return this._withTransport(transport => transport.resetAgentProfile(request));
	}

	async listMcpServers(request: UniverseAgentListMcpServersRequest = {}): Promise<UniverseAgentListMcpServersResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.listMcpServers({
			...request,
			workDir,
		}));
	}

	async getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult> {
		return this._withTransport(transport => transport.getMcpServerStatuses(serverIds));
	}

	async getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult> {
		return this._withTransport(transport => transport.getMcpServerTools(serverId, forceRefresh));
	}

	async listPlugins(): Promise<UniverseAgentListPluginsResult> {
		return this._withTransport(transport => transport.listPlugins());
	}

	async getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult> {
		return this._withTransport(transport => transport.getPluginInfo(id));
	}

	async enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult> {
		return this._withTransport(transport => transport.enablePlugin(id, enabled));
	}

	async reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult> {
		return this._withTransport(transport => transport.reloadPlugin(id));
	}

	async unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult> {
		return this._withTransport(transport => transport.unloadPlugin(id));
	}

	async scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult> {
		return this._withTransport(transport => transport.scanNewPlugins());
	}

	async addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.addMcpServer({
			...request,
			workDir: request.scope === 'project' ? workDir : request.workDir,
		}));
	}

	async updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.updateMcpServer({
			...request,
			workDir: request.scope === 'project' ? workDir : request.workDir,
		}));
	}

	async removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.removeMcpServer({
			...request,
			workDir: request.scope === 'project' ? workDir : request.workDir,
		}));
	}

	async toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult> {
		const workDir = request.workDir ?? this.getConnectionSnapshot().workDir;
		return this._withTransport(transport => transport.toggleMcpServer({
			...request,
			workDir: request.scope === 'project' ? workDir : request.workDir,
		}));
	}

	async listTools(): Promise<UniverseAgentListToolsResult> {
		return this._withTransport(transport => transport.listTools());
	}

	async listModels(): Promise<UniverseAgentListModelsResult> {
		return this._withTransport(transport => transport.listModels());
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
		const activeProfileId = this._activeProfileId;
		const wasConnected = this._connectionPhase.kind === 'connected' || this._connectionPhase.kind === 'connecting';
		return this._hub.revokeDevice(deviceId).then(async result => {
			if (result.ok && wasConnected && activeProfileId) {
				const profile = this._connectionProfileStore?.get(activeProfileId);
				if (profile?.target.kind === 'hubDevice' && profile.target.hubDeviceId === deviceId) {
					await this.disconnect();
				}
			}
			return result;
		});
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

	addHubDeviceProfile(input: {
		readonly hubDeviceId: string;
		readonly displayName?: string;
	}) {
		return this._hub.addHubDeviceProfile(input);
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

	private _setAgentTreeFetchFailed(failed: boolean): void {
		if (this._agentTreeFetchFailed === failed) {
			return;
		}
		this._agentTreeFetchFailed = failed;
		this._fireSnapshotChanged();
	}

	private _fireSnapshotChanged(): void {
		this._onDidChangeConnection.fire(this._buildSnapshot());
	}

	private async _startProfilePairing(
		profileId: string,
		profile: ConnectionProfile,
		reconnect: boolean,
	): Promise<UniverseAgentConnectProfileResult> {
		if (!this._pairingOrchestrator || !this._connectionResolver) {
			return {
				ok: false,
				code: 'transport_failed',
				reason: 'pairing orchestrator is not configured',
			};
		}

		this._connectionPhase = {
			kind: 'connecting',
			reason: reconnect ? 'transport_lost' : 'initial',
		};
		this._activeProfileId = profileId;

		const pairingResolved = await this._connectionResolver.resolve(profileId, {
			forceNewTicket: true,
			forPairing: true,
		});
		if (!pairingResolved.ok) {
			this._connectionPhase = { kind: 'failed', code: pairingResolved.code, reason: pairingResolved.reason };
			this._fireSnapshotChanged();
			return { ok: false, code: pairingResolved.code, reason: pairingResolved.reason };
		}

		const endpoint = pairingResolved.endpoint;
		const pairingEndpoint: PairingDialEndpoint = {
			host: endpoint.resolvedIp,
			port: endpoint.port,
			servername: endpoint.servername,
		};

		const startResult = await this._pairingOrchestrator.startPairing(profile, pairingEndpoint);
		if (!startResult.ok) {
			const code = this._mapPairingFailureCode(startResult.code);
			this._connectionPhase = { kind: 'failed', code, reason: startResult.reason };
			this._fireSnapshotChanged();
			return { ok: false, code, reason: startResult.reason };
		}

		this._transport?.close();
		this._transport = undefined;
		this._sessionToken = undefined;
		this._pairingPending = true;
		this._transportState = 'idle';

		const snapshot = startResult.snapshot;
		if (snapshot.phase === 'recover_trust') {
			this._fireSnapshotChanged();
			return {
				ok: true,
				path: endpoint.path,
				pairingPending: true,
				engineIdentityId: snapshot.engineIdentityId,
			};
		}

		this._fireSnapshotChanged();
		return {
			ok: true,
			path: endpoint.path,
			pairingPending: true,
			sasCode: snapshot.sasCode,
			engineIdentityId: snapshot.engineIdentityId,
		};
	}

	private _mapPairingFailureCode(code: string): ConnectionFailureCode {
		switch (code) {
			case 'sas_mismatch':
			case 'pin_mismatch':
			case 'grant_pending':
			case 'trust_missing':
			case 'hub_session_required':
			case 'hub_password_change_required':
			case 'hub_auth_expired':
			case 'hub_unreachable':
			case 'hub_device_not_in_directory':
			case 'hub_device_revoked':
			case 'engine_not_serving':
			case 'hub_ticket_failed':
			case 'hub_rate_limited':
			case 'private_network_denied':
			case 'unsupported_environment':
				return code;
			default:
				return 'transport_failed';
		}
	}

	private _mapProbeTransportError(error: unknown): ConnectionProbeResult {
		if (error instanceof UniverseAgentTransportError) {
			return { ok: false, code: 'transport_failed', reason: error.message };
		}
		return {
			ok: false,
			code: 'transport_failed',
			reason: error instanceof Error ? error.message : String(error),
		};
	}

	private _rememberAdvertisedMethods(methods: readonly string[]): void {
		this._advertisedMethods = methods;
		this._fetchToolDetailUnsupported = false;
	}

	private async _refreshSaveSkillContentBinding(methods: readonly string[]): Promise<void> {
		this._clearSaveSkillContentBinding();
		if (!this._transport || !methods.includes(UniverseAgentSaveSkillContentMethodKey)) {
			return;
		}
		const status = await this._transport.probeRpc(
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SaveSkillContent,
		);
		if (status === GrpcStatusCode.OK) {
			this._bindSaveSkillContent();
		}
	}

	private _bindSaveSkillContent(): void {
		Object.defineProperty(this, 'saveSkillContent', {
			configurable: true,
			enumerable: true,
			writable: true,
			value: (request: UniverseAgentSaveSkillContentRequest) => this._invokeSaveSkillContent(request),
		});
	}

	private _clearSaveSkillContentBinding(): void {
		if ('saveSkillContent' in this) {
			delete (this as Partial<IUniverseAgentConnection>).saveSkillContent;
		}
	}

	private async _invokeSaveSkillContent(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult> {
		this._assertTransportReady();
		try {
			const result = await this._transport!.saveSkillContent(request);
			if (this._transportState !== 'ok') {
				this._transportState = 'ok';
				this._fireSnapshotChanged();
			}
			return result;
		} catch (error) {
			if (error instanceof UniverseAgentTransportError && error.code === GrpcStatusCode.UNIMPLEMENTED) {
				this._clearSaveSkillContentBinding();
				return { ok: false, reason: 'UNIMPLEMENTED' };
			}
			this._markTransportFailed(error);
			throw error;
		}
	}
}
