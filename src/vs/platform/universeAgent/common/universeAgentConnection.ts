/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import type { ConnectionPhase, ConnectionProbeResult, UniverseAgentConnectProfileResult } from './connectionHubTypes.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentChatStream,
	UniverseAgentContinueGenerationRequest,
	UniverseAgentContinuationStream,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentConnectionSnapshot,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentRenameSessionRequest,
	UniverseAgentRenameSessionResult,
	UniverseAgentCancelGenerationRequest,
	UniverseAgentCancelGenerationResult,
	UniverseAgentCancelToolCallRequest,
	UniverseAgentCancelToolCallResult,
	UniverseAgentSetSessionGoalRequest,
	UniverseAgentSetSessionGoalResult,
	UniverseAgentCancelSessionGoalRequest,
	UniverseAgentCancelSessionGoalResult,
	UniverseAgentRespondPermissionRequest,
	UniverseAgentRespondPermissionResult,
	UniverseAgentEnqueueQueueItemRequest,
	UniverseAgentEditQueueItemRequest,
	UniverseAgentHoldQueueItemRequest,
	UniverseAgentQueueItemRefRequest,
	UniverseAgentQueueMutationResult,
	UniverseAgentQueueRefRequest,
	UniverseAgentForkAgentRequest,
	UniverseAgentForkAgentResult,
	UniverseAgentKillAgentRequest,
	UniverseAgentKillAgentResult,
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
	UniverseAgentToolInfoRequest,
	UniverseAgentToolInfoResult,
	UniverseAgentListModelsResult,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentTeamInfo,
	UniverseAgentTeamMemberInfo,
	UniverseAgentTeamTaskInfo,
	UniverseAgentTransportState,
	IFileMutationRecord,
	ITurnSettleSignal,
	UniverseAgentCapabilitySupport,
} from './universeAgentTypes.js';

export const IUniverseAgentConnection = createDecorator<IUniverseAgentConnection>('universeAgentConnection');

/** IPC channel name for the electron-main hosted gRPC adapter. */
export const universeAgentConnectionChannelName = 'universeAgentConnection';

/**
 * Platform transport contract for UniverseAgent gRPC.
 * Renderer sees this interface via electron-browser ProxyChannel; node holds the client.
 */
/** Navigator / Team unary surface (m6 §11). */
export interface IUniverseAgentTeamApi {
	memberStatus(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamMemberInfo[]>;
	taskList(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamTaskInfo[]>;
	teamInfo(sessionId: string, agentId: string, teamId: number): Promise<UniverseAgentTeamInfo | undefined>;
}

/** IDE-derived capability keys for Navigator (navigator-engine-segments §3). */
export type UniverseAgentNavigatorCapabilityKey = 'agentTree' | 'team' | 'sessionList';

export interface IUniverseAgentConnection {

	readonly _serviceBrand: undefined;

	/** Production connected = non-empty session_token + live channel; pairing-pending is never connected. */
	isEngineConnected(): boolean;

	getTransportState(): UniverseAgentTransportState;

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot;

	getCapabilitySnapshot(): UniverseAgentCapabilitySnapshot;

	readonly onDidChangeConnection: Event<UniverseAgentConnectionSnapshot>;

	/** File mutations after host join (m6 §11 A2); never raw L3 snapshots. */
	readonly onDidFileMutation: Event<IFileMutationRecord>;

	/** Turn settle after TurnCompletedChange.assistant_turn_id (m6 §11 A2 / PRD-023 §2.4). */
	readonly onDidTurnSettle: Event<ITurnSettleSignal>;

	/** L3 multi_agent_status demux (m6 §11 A2). */
	readonly onDidChangeTeamRuntime: Event<{ readonly sessionId: string }>;

	/** Manual Agent tree refresh; forwarded to SessionViewHost (navigator §2.2). */
	requestAgentTreeRefresh(sessionId: string): void;

	/** Navigator capability three-state (IDE-derived keys). */
	getNavigatorCapability(key: UniverseAgentNavigatorCapabilityKey): UniverseAgentCapabilitySupport;

	/**
	 * True after a connected AgentService.Tree pull failed for a reason other than UNIMPLEMENTED.
	 * Cleared on a successful Tree pull (or UNIMPLEMENTED → capability UNSUPPORTED). Not transport state.
	 */
	isAgentTreeFetchFailed(): boolean;

	readonly team: IUniverseAgentTeamApi;

	connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult>;

	/** Hub / DirectAddress profile dial via live resolver (connection-hub H3). */
	connectProfile(profileId: string, options?: { readonly reconnect?: boolean }): Promise<UniverseAgentConnectProfileResult>;

	/** Complete SAS pairing after {@link connectProfile} returned `pairingPending: true`. */
	confirmPairing(): Promise<UniverseAgentConnectProfileResult>;

	/** Abandon in-flight pairing and disconnect (no trust write). */
	cancelPairing(): Promise<void>;

	/** Independent TLS channel probe to GetAuthNonce only (connection-hub §4.2). */
	probeConnectionProfile(profileId: string): Promise<ConnectionProbeResult>;

	/** Connection-level phase for pane (StatusBar uses this in H4b). */
	getConnectionPhase(): ConnectionPhase;

	disconnect(): Promise<void>;

	listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult>;

	createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult>;

	deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void>;

	/** AgentService.Rename unary. Engine roster forwards this when connected. */
	renameSession(request: UniverseAgentRenameSessionRequest): Promise<UniverseAgentRenameSessionResult>;

	/** AgentService.Cancel unary. Engine roster + Inbox Stop forward when connected. */
	cancelGeneration(request: UniverseAgentCancelGenerationRequest): Promise<UniverseAgentCancelGenerationResult>;

	/**
	 * AgentService.CancelToolCall unary (per-tool cancel). Optional so Web / tests
	 * can omit it; timeline UI is not forwarded yet.
	 */
	cancelToolCall?(request: UniverseAgentCancelToolCallRequest): Promise<UniverseAgentCancelToolCallResult>;

	/**
	 * PermissionService.SetSessionGoal unary (Inbox Goal). Optional so Web / tests
	 * can omit it; engine roster no-ops when absent.
	 */
	setSessionGoal?(request: UniverseAgentSetSessionGoalRequest): Promise<UniverseAgentSetSessionGoalResult>;

	/** PermissionService.CancelSessionGoal unary. Optional with `setSessionGoal`. */
	cancelSessionGoal?(request: UniverseAgentCancelSessionGoalRequest): Promise<UniverseAgentCancelSessionGoalResult>;

	/**
	 * PermissionService.Respond unary (permission seat reply). Optional so Web /
	 * tests can omit it. Transport only — roster still posts Chat-arm
	 * `permissionRespond`; this unary is not forwarded yet.
	 */
	respondPermission?(request: UniverseAgentRespondPermissionRequest): Promise<UniverseAgentRespondPermissionResult>;

	/** AgentService.EnqueueQueueItem. Transport only — roster has no enqueue surface. */

	enqueueQueueItem(request: UniverseAgentEnqueueQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.PauseQueue. Engine roster forwards when connected. */
	pauseQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.ResumeQueue. Engine roster forwards when connected. */
	resumeQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.ClearQueue. Engine roster forwards when connected. */
	clearQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.HoldQueueItem. Engine roster forwards when connected. */
	holdQueueItem(request: UniverseAgentHoldQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.ReleaseQueueItemHold. Engine roster forwards when connected. */
	releaseQueueItemHold(request: UniverseAgentQueueItemRefRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.EditQueueItem. Engine roster forwards when connected. */
	editQueueItem(request: UniverseAgentEditQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.Fork unary (create SubAgent). Optional so Web / tests can omit
	 * it; engine roster no-ops when absent. Connected Fork action forwards this
	 * unary; local `registerForkChat` stays the disconnected Fork-tab path.
	 */
	forkAgent?(request: UniverseAgentForkAgentRequest): Promise<UniverseAgentForkAgentResult>;

	/**
	 * AgentService.Kill unary (terminate SubAgent). Optional so Web / tests can
	 * omit it. Transport only — roster / catalog UI is not forwarded yet.
	 */
	killAgent?(request: UniverseAgentKillAgentRequest): Promise<UniverseAgentKillAgentResult>;

	getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult>;

	/**
	 * SessionService.SessionEventStream. Optional `onClosed` matches Chat /
	 * ContinueGeneration (`remote` / `error`). Local dispose does not invoke it.
	 */
	subscribeSessionEventStream(
		sessionId: string,
		listener: (event: UniverseAgentSessionEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void };

	chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void>;

	/**
	 * Resident Chat bidi (ADR-012). Optional so tests / Web can keep one-shot `chat()`.
	 * Host posts `chatStreamUp` after open (or when this method is absent) and writes on the handle.
	 * Remote/error `onClosed` posts `chatStreamDown`; local dispose / connection-down is silent.
	 */
	openChatStream?(
		sessionId: string,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentChatStream;

	/**
	 * AgentService.ContinueGeneration server-stream (ADR-028). Node gRPC implements this;
	 * Web / tests may omit it (host then counts `intent.unhandled`).
	 */
	openContinuationStream?(
		request: UniverseAgentContinueGenerationRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentContinuationStream;

	listSkills(): Promise<UniverseAgentListSkillsResult>;

	setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult>;

	getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult>;

	/** Engine-backed catalog write; bound after Connect advertises ToolService.SaveSkillContent and probe OK. */
	saveSkillContent?(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult>;

	listAgentProfiles(request?: UniverseAgentListAgentProfilesRequest): Promise<UniverseAgentListAgentProfilesResult>;

	saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult>;

	deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult>;

	resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult>;

	listMcpServers(request?: UniverseAgentListMcpServersRequest): Promise<UniverseAgentListMcpServersResult>;

	/** McpService.GetMcpServerStatuses — runtime, not definitions (`mcp` vs `mcpRuntime`). */
	getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult>;

	/** McpService.GetMcpServerTools — `forceRefresh` maps to proto `force_refresh`. */
	getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult>;

	/** PluginService.List — also the `plugins` capability probe target. */
	listPlugins(): Promise<UniverseAgentListPluginsResult>;

	getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult>;

	/** PluginService.Enable. `enabled` defaults to true (`enablePlugin(id)`). */
	enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult>;

	reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult>;

	unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult>;

	scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult>;

	addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult>;

	updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult>;

	removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult>;

	toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult>;

	listTools(): Promise<UniverseAgentListToolsResult>;

	/**
	 * ToolService.ToolInfo unary. Optional so Web / tests can omit until
	 * Engine Tools detail forwards it. ListTools catalog stays list-only.
	 */
	getToolInfo?(request: UniverseAgentToolInfoRequest): Promise<UniverseAgentToolInfoResult>;

	/** ConfigService.ListModels — always `include_disabled=true` (Engine Model registry). */
	listModels(): Promise<UniverseAgentListModelsResult>;
}
