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
	UniverseAgentChatSyncRequest,
	UniverseAgentChatSyncResult,
	UniverseAgentSyncInputDeliveryRequest,
	UniverseAgentSyncInputDeliveryResult,
	UniverseAgentChatStream,
	UniverseAgentContinueGenerationRequest,
	UniverseAgentContinuationStream,
	UniverseAgentRegenerateRequest,
	UniverseAgentRegenerateStream,
	UniverseAgentResumeRequest,
	UniverseAgentResumeStream,
	UniverseAgentSubscribeToolDetailRequest,
	UniverseAgentSubscribeToolDetailChunk,
	UniverseAgentSubscribeToolDetailStream,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentConnectionSnapshot,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentSessionInfoRequest,
	UniverseAgentSessionInfoResult,
	UniverseAgentResumeSessionRequest,
	UniverseAgentResumeSessionResult,
	UniverseAgentPrewarmSessionsRequest,
	UniverseAgentPrewarmSessionsResult,
	UniverseAgentShelveSessionRequest,
	UniverseAgentShelveSessionResult,
	UniverseAgentUnshelveSessionRequest,
	UniverseAgentUnshelveSessionResult,
	UniverseAgentPurgeSessionRequest,
	UniverseAgentPurgeSessionResult,
	UniverseAgentExportSessionRequest,
	UniverseAgentExportSessionResult,
	UniverseAgentResolveTurnRequest,
	UniverseAgentResolveTurnResult,
	UniverseAgentAgentStatusRequest,
	UniverseAgentAgentStatusResult,
	UniverseAgentTodoRequest,
	UniverseAgentTodoResult,
	UniverseAgentCompactRequest,
	UniverseAgentCompactResult,
	UniverseAgentResolveAnchorRequest,
	UniverseAgentResolveAnchorResult,
	UniverseAgentUsageRequest,
	UniverseAgentUsageResult,
	UniverseAgentListAgentsRequest,
	UniverseAgentListAgentsResult,
	UniverseAgentAgentHistoryRequest,
	UniverseAgentAgentHistoryResult,
	UniverseAgentPauseAgentRequest,
	UniverseAgentPauseAgentResult,
	UniverseAgentBackRequest,
	UniverseAgentBackResult,
	UniverseAgentPruneRequest,
	UniverseAgentPruneResult,
	UniverseAgentResetAgentRequest,
	UniverseAgentResetAgentResult,
	UniverseAgentBranchRequest,
	UniverseAgentBranchResult,
	UniverseAgentSuspendLoopRequest,
	UniverseAgentSuspendLoopResult,
	UniverseAgentResumeLoopRequest,
	UniverseAgentResumeLoopResult,
	UniverseAgentStopLoopRequest,
	UniverseAgentStopLoopResult,
	UniverseAgentRenameSessionRequest,
	UniverseAgentRenameSessionResult,
	UniverseAgentCancelGenerationRequest,
	UniverseAgentCancelGenerationResult,
	UniverseAgentCancelToolCallRequest,
	UniverseAgentCancelToolCallResult,
	UniverseAgentRunToolInBackgroundRequest,
	UniverseAgentRunToolInBackgroundResult,
	UniverseAgentStopShellTaskRequest,
	UniverseAgentStopShellTaskResult,
	UniverseAgentSendShellSessionClientControlRequest,
	UniverseAgentSendShellSessionClientControlResult,
	UniverseAgentFetchToolUsageDetailRequest,
	UniverseAgentFetchToolUsageDetailResult,
	UniverseAgentFireTriggerWebhookRequest,
	UniverseAgentFireTriggerWebhookResult,
	UniverseAgentInstallSessionDemoFakeRequest,
	UniverseAgentInstallSessionDemoFakeResult,
	UniverseAgentClearSessionDemoFakeRequest,
	UniverseAgentClearSessionDemoFakeResult,
	UniverseAgentSwitchWorkDirRequest,
	UniverseAgentSwitchWorkDirResult,
	UniverseAgentTestModelProfileRequest,
	UniverseAgentTestModelProfileResult,
	UniverseAgentSetConfigRequest,
	UniverseAgentSetConfigResult,
	UniverseAgentSetModelPreferencesRequest,
	UniverseAgentSetModelPreferencesResult,
	UniverseAgentSetSessionGoalRequest,
	UniverseAgentSetSessionGoalResult,
	UniverseAgentCancelSessionGoalRequest,
	UniverseAgentCancelSessionGoalResult,
	UniverseAgentRespondPermissionRequest,
	UniverseAgentRespondPermissionResult,
	UniverseAgentSyncPermissionRuleRequest,
	UniverseAgentSyncPermissionRuleResult,
	UniverseAgentPromotePermissionRuleRequest,
	UniverseAgentPromotePermissionRuleResult,
	UniverseAgentGetSessionRulesRequest,
	UniverseAgentGetSessionRulesResult,
	UniverseAgentSetPermissionModeRequest,
	UniverseAgentSetPermissionModeResult,
	UniverseAgentTaskUpdateRequest,
	UniverseAgentTaskUpdateResult,
	UniverseAgentTaskCancelRequest,
	UniverseAgentTaskCancelResult,
	UniverseAgentMessageMemberRequest,
	UniverseAgentMessageMemberResult,
	UniverseAgentCreateTeamRequest,
	UniverseAgentCreateTeamResult,
	UniverseAgentStartMemberRequest,
	UniverseAgentStartMemberResult,
	UniverseAgentKillMemberRequest,
	UniverseAgentKillMemberResult,
	UniverseAgentAbortTeamRequest,
	UniverseAgentAbortTeamResult,
	UniverseAgentRespondQuestionRequest,
	UniverseAgentRespondQuestionResult,
	UniverseAgentEnqueueQueueItemRequest,
	UniverseAgentInsertQueueItemRequest,
	UniverseAgentReorderQueueRequest,
	UniverseAgentDeleteQueueItemRequest,
	UniverseAgentRetryQueueItemRequest,
	UniverseAgentRetryAllFailedRequest,
	UniverseAgentRetryQueueItemUploadRequest,
	UniverseAgentPinQueueItemRequest,
	UniverseAgentSetQueueItemLockedRequest,
	UniverseAgentInjectQueueItemRequest,
	UniverseAgentSetQueueItemForkAnchorRequest,
	UniverseAgentEditQueueItemRequest,
	UniverseAgentHoldQueueItemRequest,
	UniverseAgentQueueItemRefRequest,
	UniverseAgentQueueMutationResult,
	UniverseAgentQueueRefRequest,
	UniverseAgentForkAgentRequest,
	UniverseAgentForkAgentResult,
	UniverseAgentKillAgentRequest,
	UniverseAgentKillAgentResult,
	UniverseAgentDeleteMessageRequest,
	UniverseAgentDeleteMessageResult,
	UniverseAgentEditMessageRequest,
	UniverseAgentEditMessageResult,
	UniverseAgentSendClientToolResponseRequest,
	UniverseAgentSendClientToolResponseResult,
	UniverseAgentListSnapshotsRequest,
	UniverseAgentListSnapshotsResult,
	UniverseAgentListLoopSnapshotsRequest,
	UniverseAgentListLoopSnapshotsResult,
	UniverseAgentCreateSnapshotRequest,
	UniverseAgentCreateSnapshotResult,
	UniverseAgentRestoreSnapshotRequest,
	UniverseAgentRestoreSnapshotResult,
	UniverseAgentDeleteSnapshotRequest,
	UniverseAgentDeleteSnapshotResult,
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
	UniverseAgentListCommandsResult,
	UniverseAgentGetCommandDefRequest,
	UniverseAgentGetCommandDefResult,
	UniverseAgentListFilesRequest,
	UniverseAgentListFilesResult,
	UniverseAgentReadFileRequest,
	UniverseAgentReadFileResult,
	UniverseAgentGetFileInfoRequest,
	UniverseAgentGetFileInfoResult,
	UniverseAgentWriteFileRequest,
	UniverseAgentWriteFileResult,
	UniverseAgentForceWriteFileRequest,
	UniverseAgentAgentMergeRequest,
	UniverseAgentAgentMergeResult,
	UniverseAgentReadGitSummaryRequest,
	UniverseAgentReadGitSummaryResult,
	UniverseAgentReadGitChangesRequest,
	UniverseAgentReadGitChangesResult,
	UniverseAgentReadGitFileDiffRequest,
	UniverseAgentReadGitFileDiffResult,
	UniverseAgentWriteGitStagePathsRequest,
	UniverseAgentWriteGitCommitRequest,
	UniverseAgentWriteGitApplyHunksRequest,
	UniverseAgentWriteGitWriteResult,
	UniverseAgentGetSessionUsageRequest,
	UniverseAgentGetSessionUsageResult,
	UniverseAgentGetGlobalUsageResult,
	UniverseAgentSaveMemoryRequest,
	UniverseAgentSaveMemoryResult,
	UniverseAgentMemorySearchRequest,
	UniverseAgentMemorySearchResult,
	UniverseAgentSetPermissionPolicyRequest,
	UniverseAgentSetPermissionPolicyResult,
	UniverseAgentListModelsResult,
	UniverseAgentGetConfigRequest,
	UniverseAgentGetConfigResult,
	UniverseAgentSwitchModelRequest,
	UniverseAgentSwitchModelResult,
	UniverseAgentGetModelPreferencesRequest,
	UniverseAgentGetModelPreferencesResult,
	UniverseAgentResolveModelRequest,
	UniverseAgentResolveModelResult,
	UniverseAgentWatchConfigRequest,
	UniverseAgentConfigChangedEvent,
	UniverseAgentWatchConfigStream,
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

	/**
	 * SessionService.Info unary (session metadata + root AgentInfo). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` is sent as-is. No Conversation roster / UI.
	 */
	getSessionInfo?(request: UniverseAgentSessionInfoRequest): Promise<UniverseAgentSessionInfoResult>;

	/**
	 * SessionService.Resume unary (restore a persisted session). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` is sent as-is. No Conversation roster / UI. ≠ Agent.ResumeQueue.
	 */
	resumeSession?(request: UniverseAgentResumeSessionRequest): Promise<UniverseAgentResumeSessionResult>;

	/**
	 * SessionService.Prewarm unary (explicit session restore batch). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionIds` (including empty strings) are sent as-is. No Conversation
	 * roster / UI. ≠ Resume / Shelve / Unshelve / List.
	 */
	prewarmSessions?(request: UniverseAgentPrewarmSessionsRequest): Promise<UniverseAgentPrewarmSessionsResult>;

	/**
	 * SessionService.Shelve unary (park a session without deleting it). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` is sent as-is. No Conversation roster / UI. ≠ Delete / Unshelve / Resume.
	 */
	shelveSession?(request: UniverseAgentShelveSessionRequest): Promise<UniverseAgentShelveSessionResult>;

	/**
	 * SessionService.Unshelve unary (restore a shelved session). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` is sent as-is. No Conversation roster / UI. ≠ Shelve / Resume / Delete.
	 */
	unshelveSession?(request: UniverseAgentUnshelveSessionRequest): Promise<UniverseAgentUnshelveSessionResult>;

	/**
	 * SessionService.Purge unary (permanently erase a session). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` is sent as-is. No Conversation roster / UI. ≠ Delete / Shelve / Unshelve / Export.
	 */
	purgeSession?(request: UniverseAgentPurgeSessionRequest): Promise<UniverseAgentPurgeSessionResult>;

	/**
	 * SessionService.Export unary (dump a session as markdown/json). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `format` are sent as-is. No Conversation roster / UI.
	 * ≠ Shelve / Unshelve / Resume / Delete.
	 */
	exportSession?(request: UniverseAgentExportSessionRequest): Promise<UniverseAgentExportSessionResult>;

	/**
	 * SessionService.ResolveTurn unary (turn→CHAT envelope lookup). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `turnId` / `currentLeafTurnId` are sent as-is. No Conversation
	 * roster / UI. ≠ ResolveAnchor / GetHistory / Export.
	 */
	resolveTurn?(request: UniverseAgentResolveTurnRequest): Promise<UniverseAgentResolveTurnResult>;

	/**
	 * AgentService.Status unary (StatusResponse.agent → AgentInfo). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ Session.Info / Agent.Tree / FetchAgentStatus fold.
	 */
	getAgentStatus?(request: UniverseAgentAgentStatusRequest): Promise<UniverseAgentAgentStatusResult>;

	/**
	 * AgentService.Todo unary (TodoResponse.items → TodoItem[]). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ Status / Tree / Compact.
	 */
	getTodo?(request: UniverseAgentTodoRequest): Promise<UniverseAgentTodoResult>;

	/**
	 * AgentService.Compact unary (manual context compaction). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ Todo / Status / Tree / FetchToolUsageDetail.
	 */
	compact?(request: UniverseAgentCompactRequest): Promise<UniverseAgentCompactResult>;

	/**
	 * SessionService.ResolveAnchor unary (ADR-317 §7.2 three-state hit / tombstone /
	 * expired). Optional so Web / tests can omit it. Catalog + node transport only
	 * this slice; empty `sessionId` / `envelopeId` / `currentLeafTurnId` are sent
	 * as-is. No Conversation roster / UI. ≠ ResolveTurn / GetHistory / Compact.
	 */
	resolveAnchor?(request: UniverseAgentResolveAnchorRequest): Promise<UniverseAgentResolveAnchorResult>;

	/**
	 * AgentService.Usage unary (UsageResponse token totals + per-agent rows).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `agentId` are sent as-is (empty agentId =
	 * session rollup). No Conversation roster / UI.
	 * ≠ Todo / Status / Tree / Compact / List.
	 */
	getUsage?(request: UniverseAgentUsageRequest): Promise<UniverseAgentUsageResult>;

	/**
	 * AgentService.List unary (ListAgentsResponse.agents → AgentInfo[]). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` is sent as-is. No Conversation roster / UI.
	 * ≠ Tree / Status / ListAgentProfiles / ListSnapshots.
	 */
	listAgents?(request: UniverseAgentListAgentsRequest): Promise<UniverseAgentListAgentsResult>;

	/**
	 * AgentService.History unary (HistoryResponse.entries + total). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ Session.GetHistory / Compact / Usage / ListSnapshots.
	 */
	getAgentHistory?(request: UniverseAgentAgentHistoryRequest): Promise<UniverseAgentAgentHistoryResult>;

	/**
	 * AgentService.Pause unary (PauseResponse.success → ok). Optional so Web /
	 * tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ PauseQueue / Cancel / SuspendLoop / Resume / Back.
	 */
	pauseAgent?(request: UniverseAgentPauseAgentRequest): Promise<UniverseAgentPauseAgentResult>;

	/**
	 * AgentService.Back unary (revert to parent turn / delete current leaf).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `agentId` / `operationId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ Pause / PauseQueue / Prune / DeleteMessage / Reset / Branch.
	 */
	back?(request: UniverseAgentBackRequest): Promise<UniverseAgentBackResult>;

	/**
	 * AgentService.Prune unary (drop inactive conversation branches). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ Reset / Back / Compact / History / DeleteMessage.
	 */
	prune?(request: UniverseAgentPruneRequest): Promise<UniverseAgentPruneResult>;

	/**
	 * AgentService.Reset unary (ResetResponse.success → ok). Optional so Web /
	 * tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ ResetAgentProfile / Prune / Branch / Back / Pause.
	 */
	resetAgent?(request: UniverseAgentResetAgentRequest): Promise<UniverseAgentResetAgentResult>;

	/**
	 * AgentService.Branch unary (switch conversation branch / list when
	 * branchIndex = -1). Optional so Web / tests can omit it. Catalog + node
	 * transport only this slice; empty `sessionId` / `agentId` / `turnId` are
	 * sent as-is. No Conversation roster / UI.
	 * ≠ Reset / Back / Prune / EditMessage / Fork.
	 */
	branch?(request: UniverseAgentBranchRequest): Promise<UniverseAgentBranchResult>;

	/**
	 * AgentService.SuspendLoop unary (SuspendLoopResponse.success → ok). Optional
	 * so Web / tests can omit it. Catalog + node transport only this slice;
	 * empty `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ Pause / PauseQueue / Cancel / Resume / ResumeLoop / Branch / StopLoop.
	 */
	suspendLoop?(request: UniverseAgentSuspendLoopRequest): Promise<UniverseAgentSuspendLoopResult>;

	/**
	 * AgentService.ResumeLoop unary (ResumeLoopResponse.success → ok). Optional
	 * so Web / tests can omit it. Catalog + node transport only this slice;
	 * empty `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ Pause / PauseQueue / Cancel / Resume / ResumeQueue / Session.Resume /
	 * SuspendLoop / Branch / StopLoop.
	 */
	resumeLoop?(request: UniverseAgentResumeLoopRequest): Promise<UniverseAgentResumeLoopResult>;

	/**
	 * AgentService.StopLoop unary (StopLoopResponse.success → ok). Optional
	 * so Web / tests can omit it. Catalog + node transport only this slice;
	 * empty `sessionId` / `agentId` / `detail` are sent as-is. No Conversation
	 * roster / UI.
	 * ≠ Pause / Cancel / SuspendLoop / Resume / ResumeLoop / Branch.
	 */
	stopLoop?(request: UniverseAgentStopLoopRequest): Promise<UniverseAgentStopLoopResult>;

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
	 * AgentService.RunToolInBackground unary (RunToolInBackgroundResponse.success
	 * → ok). Optional so Web / tests can omit it. Catalog + node transport only
	 * this slice; empty `sessionId` / `agentId` / `toolCallId` are sent as-is.
	 * No Conversation roster / UI.
	 * ≠ CancelToolCall / StopShellTask / Cancel / Resume.
	 */
	runToolInBackground?(request: UniverseAgentRunToolInBackgroundRequest): Promise<UniverseAgentRunToolInBackgroundResult>;

	/**
	 * AgentService.StopShellTask unary (StopShellTaskResponse.success → ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `taskId` are sent as-is. No Conversation
	 * roster / UI.
	 * ≠ CancelToolCall / RunToolInBackground / Cancel / StopLoop.
	 */
	stopShellTask?(request: UniverseAgentStopShellTaskRequest): Promise<UniverseAgentStopShellTaskResult>;

	/**
	 * AgentService.SendShellSessionClientControl unary
	 * (SendShellSessionClientControlResponse.success → ok). Optional so Web /
	 * tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `toolCallId` / `refId` / `controlPayloadJson` are sent as-is.
	 * No Conversation roster / UI.
	 * ≠ StopShellTask / SubscribeToolDetail / FetchToolUsageDetail /
	 * CancelToolCall / RunToolInBackground.
	 */
	sendShellSessionClientControl?(request: UniverseAgentSendShellSessionClientControlRequest): Promise<UniverseAgentSendShellSessionClientControlResult>;

	/**
	 * AgentService.FetchToolUsageDetail unary (FetchToolUsageDetailResponse.success
	 * → ok). Optional so Web / tests can omit it. Catalog + node transport only
	 * this slice; empty `sessionId` / `toolCallId` are sent as-is. No Conversation
	 * roster / UI.
	 * ≠ FetchToolDetail / SubscribeToolDetail / Usage / Compact.
	 */
	fetchToolUsageDetail?(request: UniverseAgentFetchToolUsageDetailRequest): Promise<UniverseAgentFetchToolUsageDetailResult>;

	/**
	 * AgentService.FireTriggerWebhook unary (FireTriggerWebhookResponse.status /
	 * event_id / reason). Optional so Web / tests can omit it. Catalog + node
	 * transport only this slice; empty `sessionId` / `triggerId` / `payloadJson`
	 * are sent as-is. No Conversation roster / UI.
	 * ≠ FetchToolUsageDetail / SubscribeToolDetail / SwitchWorkDir.
	 */
	fireTriggerWebhook?(request: UniverseAgentFireTriggerWebhookRequest): Promise<UniverseAgentFireTriggerWebhookResult>;

	/**
	 * AgentService.InstallSessionDemoFake unary (InstallSessionDemoFakeResponse.success
	 * → ok). Optional so Web / tests can omit it. Catalog + node transport only
	 * this slice; empty `sessionId` / `playbookId` / `contentType` / `queuesPayload`
	 * are sent as-is. No Conversation roster / UI.
	 * ≠ FireTriggerWebhook / ClearSessionDemoFake / ChatSync / SyncInputDelivery.
	 */
	installSessionDemoFake?(request: UniverseAgentInstallSessionDemoFakeRequest): Promise<UniverseAgentInstallSessionDemoFakeResult>;

	/**
	 * AgentService.ClearSessionDemoFake unary (ClearSessionDemoFakeResponse.success
	 * → ok). Optional so Web / tests can omit it. Catalog + node transport only
	 * this slice; empty `sessionId` is sent as-is. No Conversation roster / UI.
	 * ≠ InstallSessionDemoFake / FireTriggerWebhook / ChatSync / SyncInputDelivery.
	 */
	clearSessionDemoFake?(request: UniverseAgentClearSessionDemoFakeRequest): Promise<UniverseAgentClearSessionDemoFakeResult>;

	/**
	 * AgentService.SwitchWorkDir unary (SwitchWorkDirResponse.success → ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `agentId` / `newWorkDir` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ FireTriggerWebhook / TestModelProfile / Connect.work_dir.
	 */
	switchWorkDir?(request: UniverseAgentSwitchWorkDirRequest): Promise<UniverseAgentSwitchWorkDirResult>;

	/**
	 * AgentService.TestModelProfile unary (TestModelProfileResponse.success → ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `providerId` / `modelId` / `apiKey` / `baseUrl` / `protocol`
	 * are sent as-is. No Conversation / Engine Preferences UI.
	 * ≠ SwitchWorkDir / ListModels / SwitchModel / Config.Get / Config.Set.
	 */
	testModelProfile?(request: UniverseAgentTestModelProfileRequest): Promise<UniverseAgentTestModelProfileResult>;

	/**
	 * ConfigService.Set unary (SetConfigResponse.success → ok). Optional so Web
	 * / tests can omit it. Catalog + node transport only this slice; empty
	 * `key` / `value` / `scope` / `sessionId` are sent as-is. No Conversation
	 * roster / Engine Preferences UI.
	 * ≠ Get / Watch / ListModels / SwitchModel.
	 */
	setConfig?(request: UniverseAgentSetConfigRequest): Promise<UniverseAgentSetConfigResult>;

	/**
	 * ConfigService.SetModelPreferences unary. Optional so Web / tests can
	 * omit it. Catalog + node transport only this slice; empty `sessionId` /
	 * `maxCost` / `minSpeed` / `strategy` and `minLevel` 0 are sent as-is.
	 * No Conversation roster / Engine Preferences UI.
	 * ≠ GetModelPreferences / ResolveModel / SwitchModel / ListModels / Get / Set.
	 */
	setModelPreferences?(request: UniverseAgentSetModelPreferencesRequest): Promise<UniverseAgentSetModelPreferencesResult>;

	/**
	 * PermissionService.SetSessionGoal unary (Inbox Goal). Optional so Web / tests
	 * can omit it; engine roster no-ops when absent.
	 */
	setSessionGoal?(request: UniverseAgentSetSessionGoalRequest): Promise<UniverseAgentSetSessionGoalResult>;

	/** PermissionService.CancelSessionGoal unary. Optional with `setSessionGoal`. */
	cancelSessionGoal?(request: UniverseAgentCancelSessionGoalRequest): Promise<UniverseAgentCancelSessionGoalResult>;

	/**
	 * PermissionService.Respond unary (permission seat reply). Optional so Web /
	 * tests can omit it. ConversationEngineRosterService.resolveConfirmation
	 * forwards this when connected; disconnected / stub still posts Chat-arm
	 * `permissionRespond`.
	 */
	respondPermission?(request: UniverseAgentRespondPermissionRequest): Promise<UniverseAgentRespondPermissionResult>;

	/**
	 * PermissionService.SyncPermissionRule unary (session-scoped tool rule upsert).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `toolName` / `scope` / `reason` are sent as-is.
	 * No Conversation roster / UI.
	 * ≠ Respond / SetSessionGoal / PromotePermissionRule / GetSessionRules / SetPermissionMode.
	 */
	syncPermissionRule?(request: UniverseAgentSyncPermissionRuleRequest): Promise<UniverseAgentSyncPermissionRuleResult>;

	/**
	 * PermissionService.PromotePermissionRule unary (PromoteRuleResponse.success
	 * → ok). Optional so Web / tests can omit it. Catalog + node transport only
	 * this slice; empty `toolName` / `scope` are sent as-is. `action` uses typed
	 * `RuleAction` wire. No Conversation roster / UI.
	 * ≠ Respond / SetSessionGoal / SyncPermissionRule / GetSessionRules.
	 */
	promotePermissionRule?(request: UniverseAgentPromotePermissionRuleRequest): Promise<UniverseAgentPromotePermissionRuleResult>;

	/**
	 * PermissionService.GetSessionRules unary (session rule list). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` is sent as-is. No Conversation roster / UI.
	 * ≠ SetSessionGoal / CancelSessionGoal / Respond / SyncPermissionRule / PromotePermissionRule.
	 */
	getSessionRules?(request: UniverseAgentGetSessionRulesRequest): Promise<UniverseAgentGetSessionRulesResult>;

	/**
	 * PermissionService.SetPermissionMode unary (session Ask/Agent/Permit
	 * gate; ≠ SetSessionGoal). Optional so Web / tests can omit it. Catalog +
	 * node transport only this slice; empty `sessionId` is sent as-is.
	 * `mode` uses typed `SessionToolPermissionModeProto` wire. No Conversation
	 * roster / UI.
	 * ≠ SetSessionGoal / CancelSessionGoal / Respond / SyncPermissionRule /
	 * PromotePermissionRule / GetSessionRules.
	 */
	setPermissionMode?(request: UniverseAgentSetPermissionModeRequest): Promise<UniverseAgentSetPermissionModeResult>;

	/**
	 * TeamService.TaskUpdate unary (blackboard task status overwrite). Optional
	 * so Web / tests can omit it. Catalog + node transport only this slice;
	 * empty `sessionId` / `agentId` / `taskId` / `newStatus` / `message` are
	 * sent as-is. No Conversation roster / UI / Navigator Team.
	 * ≠ TaskList / TaskCancel / MemberStatus / TeamInfo / SetPermissionMode.
	 */
	taskUpdate?(request: UniverseAgentTaskUpdateRequest): Promise<UniverseAgentTaskUpdateResult>;

	/**
	 * TeamService.TaskCancel unary (blackboard task cancel). Optional so Web /
	 * tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` / `taskId` are sent as-is. No Conversation roster
	 * / UI / Navigator Team.
	 * ≠ TaskList / TaskUpdate / MemberStatus / TeamInfo / SetPermissionMode.
	 */
	taskCancel?(request: UniverseAgentTaskCancelRequest): Promise<UniverseAgentTaskCancelResult>;

	/**
	 * TeamService.MessageMember unary (Manager→Member mailbox). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice;
	 * empty `sessionId` / `agentId` / `memberName` / `content` are sent
	 * as-is. No Conversation roster / UI / Navigator Team.
	 * ≠ TaskUpdate / TaskList / TaskCancel / MemberStatus / TeamInfo / CreateTeam.
	 */
	messageMember?(request: UniverseAgentMessageMemberRequest): Promise<UniverseAgentMessageMemberResult>;

	/**
	 * TeamService.CreateTeam unary (Task Group create). Optional so Web /
	 * tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` / `taskDescriptions` are sent as-is. No
	 * Conversation roster / UI / Navigator Team.
	 * ≠ TaskList / TaskUpdate / TaskCancel / MessageMember / MemberStatus /
	 * TeamInfo / StartMember.
	 */
	createTeam?(request: UniverseAgentCreateTeamRequest): Promise<UniverseAgentCreateTeamResult>;

	/**
	 * TeamService.StartMember unary (Manager starts a member). Optional so Web
	 * / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` / `memberName` / `presetId` / `systemPrompt` /
	 * `modelType` are sent as-is. No Conversation roster / UI / Navigator Team.
	 * ≠ CreateTeam / TaskUpdate / TaskCancel / MessageMember / KillMember /
	 * MemberStatus / TeamInfo.
	 */
	startMember?(request: UniverseAgentStartMemberRequest): Promise<UniverseAgentStartMemberResult>;
	/**
	 * TeamService.KillMember unary (Manager terminates a member). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice;
	 * empty `sessionId` / `agentId` / `memberName` are sent as-is. No
	 * Conversation roster / UI / Navigator Team.
	 * ≠ StartMember / CreateTeam / TaskCancel / MessageMember / MemberStatus /
	 * TeamInfo / Agent.Kill.
	 */
	killMember?(request: UniverseAgentKillMemberRequest): Promise<UniverseAgentKillMemberResult>;

	/**
	 * TeamService.Abort unary (abort entire Team). Optional so Web / tests can
	 * omit it. Catalog + node transport only this slice; empty `sessionId` /
	 * `agentId` / `reason` and `teamId` 0 are sent as-is. No Conversation
	 * roster / UI / Navigator Team.
	 * ≠ KillMember / CreateTeam / StartMember / MessageMember / TaskCancel /
	 * TeamInfo.
	 */
	abort?(request: UniverseAgentAbortTeamRequest): Promise<UniverseAgentAbortTeamResult>;

	/**
	 * AgentService.RespondQuestion unary (ADR-325 ask_user reply). Optional so
	 * Web / tests can omit it. ConversationEngineRosterService.respondQuestion
	 * forwards this when connected; disconnected / stub still posts Chat-arm
	 * `questionRespond`.
	 */
	respondQuestion?(request: UniverseAgentRespondQuestionRequest): Promise<UniverseAgentRespondQuestionResult>;

	/** AgentService.EnqueueQueueItem. Engine roster forwards when connected. */
	enqueueQueueItem(request: UniverseAgentEnqueueQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.InsertQueueItem unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `opId` / `clientMessageId` / `beforeItemId`
	 * are sent as-is. No Conversation roster / UI.
	 * ≠ EnqueueQueueItem / ReorderQueue / EditQueueItem / SubscribeToolDetail.
	 */
	insertQueueItem?(request: UniverseAgentInsertQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.ReorderQueue unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `opId` / `itemIds` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ EnqueueQueueItem / InsertQueueItem / EditQueueItem / DeleteQueueItem.
	 */
	reorderQueue?(request: UniverseAgentReorderQueueRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.DeleteQueueItem unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `itemId` / `opId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ ReorderQueue / InsertQueueItem / RetryQueueItem / EditQueueItem.
	 */
	deleteQueueItem?(request: UniverseAgentDeleteQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.RetryQueueItem unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `itemId` / `opId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ DeleteQueueItem / ReorderQueue / InsertQueueItem / EditQueueItem /
	 * RetryAllFailed.
	 */
	retryQueueItem?(request: UniverseAgentRetryQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.RetryAllFailed unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `opId` are sent as-is. No Conversation roster /
	 * UI.
	 * ≠ RetryQueueItem / RetryQueueItemUpload / DeleteQueueItem / ReorderQueue.
	 */
	retryAllFailed?(request: UniverseAgentRetryAllFailedRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.RetryQueueItemUpload unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `itemId` / `opId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ RetryQueueItem / RetryAllFailed / DeleteQueueItem / PinQueueItem.
	 */
	retryQueueItemUpload?(request: UniverseAgentRetryQueueItemUploadRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.PinQueueItem unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `itemId` / `opId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ RetryQueueItem / RetryQueueItemUpload / DeleteQueueItem /
	 * SetQueueItemLocked.
	 */
	pinQueueItem?(request: UniverseAgentPinQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.SetQueueItemLocked unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `itemId` / `opId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ PinQueueItem / InjectQueueItem / RetryQueueItemUpload / DeleteQueueItem.
	 */
	setQueueItemLocked?(request: UniverseAgentSetQueueItemLockedRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.InjectQueueItem unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `itemId` / `opId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ PinQueueItem / SetQueueItemLocked / RetryQueueItemUpload /
	 * DeleteQueueItem.
	 */
	injectQueueItem?(request: UniverseAgentInjectQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/**
	 * AgentService.SetQueueItemForkAnchor unary (QueueMutationResponse.ok).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `itemId` / `opId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ PinQueueItem / SetQueueItemLocked / InjectQueueItem / HoldQueueItem.
	 */
	setQueueItemForkAnchor?(request: UniverseAgentSetQueueItemForkAnchorRequest): Promise<UniverseAgentQueueMutationResult>;

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
	 * omit it; engine roster no-ops when absent. Connected Kill action / roster
	 * `killSubAgent` forwards this unary. Empty `agentId` is sent as-is (not
	 * defaulted to `root`). Distinct from Cancel / CancelToolCall.
	 */
	killAgent?(request: UniverseAgentKillAgentRequest): Promise<UniverseAgentKillAgentResult>;

	/**
	 * AgentService.DeleteMessage unary (delete turn + subtree). Optional so Web /
	 * tests can omit it. ConversationEngineRosterService.deleteTurn forwards this
	 * when connected; empty `turnId` / disconnected / stub stay local or no-op.
	 */
	deleteMessage?(request: UniverseAgentDeleteMessageRequest): Promise<UniverseAgentDeleteMessageResult>;

	/**
	 * AgentService.EditMessage unary (edit user-turn text; ≠ EditQueueItem).
	 * Optional so Web / tests can omit it. ConversationEngineRosterService
	 * `updateUserTurnText` forwards this when connected; empty `turnId` /
	 * empty text / disconnected / stub stay local or no-op.
	 */
	editMessage?(request: UniverseAgentEditMessageRequest): Promise<UniverseAgentEditMessageResult>;

	/**
	 * AgentService.SendClientToolResponse unary (ADR-325 client-tool reply).
	 * Optional so Web / tests can omit it. ConversationEngineRosterService
	 * `respondClientTool` forwards this when connected; empty `callId` /
	 * disconnected / stub stay local Chat-arm `clientToolRespond` or no-op.
	 */
	sendClientToolResponse?(request: UniverseAgentSendClientToolResponseRequest): Promise<UniverseAgentSendClientToolResponseResult>;

	/**
	 * AgentService.ListSnapshots unary (session checkpoints). Optional so Web /
	 * tests can omit it. Conversation SessionBar extra control lists rows when
	 * connected; SessionBar History stays the turn-index MessageNavigator.
	 */
	listSnapshots?(request: UniverseAgentListSnapshotsRequest): Promise<UniverseAgentListSnapshotsResult>;

	/**
	 * AgentService.ListLoopSnapshots unary (LOOP_SNAPSHOT envelopes). Optional
	 * so Web / tests can omit it. Catalog + node transport only this slice;
	 * SessionBar History / Snapshots overlay stay unchanged. Empty sessionId /
	 * loopId go on the wire as-is.
	 */
	listLoopSnapshots?(request: UniverseAgentListLoopSnapshotsRequest): Promise<UniverseAgentListLoopSnapshotsResult>;

	/**
	 * AgentService.CreateSnapshot unary (persist a session checkpoint). Optional
	 * so Web / tests can omit it. ConversationEngineRosterService
	 * `createSnapshot` forwards this when connected; empty `sessionId` /
	 * disconnected / missing hook do not send. Empty title is sent as-is.
	 * SessionBar History stays the turn index.
	 */
	createSnapshot?(request: UniverseAgentCreateSnapshotRequest): Promise<UniverseAgentCreateSnapshotResult>;

	/**
	 * AgentService.RestoreSnapshot unary (restore a session checkpoint). Optional
	 * so Web / tests can omit it. Conversation SessionBar snapshots overlay
	 * Restore forwards this when connected; empty snapshotId / disconnected /
	 * no hook do not send. SessionBar History stays the turn index.
	 */
	restoreSnapshot?(request: UniverseAgentRestoreSnapshotRequest): Promise<UniverseAgentRestoreSnapshotResult>;

	/**
	 * AgentService.DeleteSnapshot unary (drop a session checkpoint). Optional
	 * so Web / tests can omit it. Conversation SessionBar snapshots overlay
	 * Delete confirms then forwards this when connected; empty snapshotId /
	 * disconnected / no hook do not send. SessionBar History stays the turn index.
	 */
	deleteSnapshot?(request: UniverseAgentDeleteSnapshotRequest): Promise<UniverseAgentDeleteSnapshotResult>;

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
	 * AgentService.ChatSync unary (Gateway sync Chat).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `agentId` / `idempotencyKey` /
	 * `lastKnownMessageIds` / `sessionInput.messageId` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ Chat / SyncInputDelivery / ContinueGeneration / Resume.
	 */
	chatSync?(request: UniverseAgentChatSyncRequest): Promise<UniverseAgentChatSyncResult>;

	/**
	 * AgentService.SyncInputDelivery unary (disconnect input-delivery replay).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` / `lastKnownMessageIds` are sent as-is. No
	 * Conversation roster / UI.
	 * ≠ Chat / ChatSync / ContinueGeneration / Resume.
	 */
	syncInputDelivery?(request: UniverseAgentSyncInputDeliveryRequest): Promise<UniverseAgentSyncInputDeliveryResult>;

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

	/**
	 * AgentService.Regenerate server-stream (`stream ChatResponse`). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` / `turnId` / `messageId` are sent as-is. No
	 * Conversation roster / UI. ≠ ContinueGeneration / ADR-029 regenerateTurn.
	 */
	openRegenerateStream?(
		request: UniverseAgentRegenerateRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentRegenerateStream;

	/**
	 * AgentService.Resume server-stream (`stream ChatResponse`). Optional so
	 * Web / tests can omit it. Catalog + node transport only this slice; empty
	 * `sessionId` / `agentId` are sent as-is. No Conversation roster / UI.
	 * ≠ Pause / ContinueGeneration / ResumeLoop / ResumeQueue / Session.Resume.
	 */
	openResumeStream?(
		request: UniverseAgentResumeRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentResumeStream;

	/**
	 * AgentService.SubscribeToolDetail server-stream
	 * (`stream SubscribeToolDetailChunk`). Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` / `toolCallId`
	 * / `refId` are sent as-is. No Conversation roster / UI.
	 * ≠ FetchToolDetail / FetchToolUsageDetail / SendShellSessionClientControl.
	 */
	openSubscribeToolDetailStream?(
		request: UniverseAgentSubscribeToolDetailRequest,
		onResponse: (response: UniverseAgentSubscribeToolDetailChunk) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentSubscribeToolDetailStream;

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

	/**
	 * ToolService.ListCommands unary (empty request). Optional so Web /
	 * tests can omit it. Catalog + node transport only this slice; empty
	 * `name` / `agent` / `model` / `skill_source` are mapped as-is.
	 * No Conversation roster / UI / Engine Preferences / Composer.
	 * ≠ ListSkills / ListTools / ToolInfo / GetCommandDef / ResolveModel.
	 */
	listCommands?(): Promise<UniverseAgentListCommandsResult>;

	/**
	 * ToolService.GetCommandDef unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `commandName` /
	 * `name` / `agent` / `model` / `template` / `mcp_server_id` /
	 * `mcp_prompt_name` / `skill_source` are mapped as-is.
	 * No Conversation roster / UI / Engine Preferences / Composer.
	 * ≠ ListCommands / ListSkills / ListTools / ToolInfo / ResolveModel.
	 */
	getCommandDef?(request: UniverseAgentGetCommandDefRequest): Promise<UniverseAgentGetCommandDefResult>;

	/**
	 * FileService.ListFiles unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `path` /
	 * `sessionId` / `pattern` are sent as-is. `recursive` false /
	 * `maxResults` 0 are sent as-is. No Conversation roster / UI /
	 * Explorer / Engine Preferences.
	 * ≠ ReadFile / GetFileInfo / WriteFile / ForceWriteFile / AgentMerge.
	 */
	listFiles?(request: UniverseAgentListFilesRequest): Promise<UniverseAgentListFilesResult>;

	/**
	 * FileService.ReadFile unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `path` / `sessionId`
	 * are sent as-is. Proto fields only (`start_line` / `end_line` /
	 * `max_bytes` 0 as-is). No Conversation roster / UI / Engine
	 * Preferences / Composer. ≠ ListFiles / GetFileInfo / WriteFile.
	 */
	readFile?(request: UniverseAgentReadFileRequest): Promise<UniverseAgentReadFileResult>;

	/**
	 * FileService.GetFileInfo unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `path` / `sessionId`
	 * are sent as-is. Proto `file` FileEntry only. No Conversation roster /
	 * UI / Explorer / Engine Preferences / Composer.
	 * ≠ ListFiles / ReadFile / WriteFile / ForceWriteFile / AgentMerge.
	 */
	getFileInfo?(request: UniverseAgentGetFileInfoRequest): Promise<UniverseAgentGetFileInfoResult>;

	/**
	 * FileService.WriteFile unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `path` / `sessionId`
	 * / `baseHash` are sent as-is. Empty `content` / `baseContent` sent
	 * as-is. Proto fields only. No Conversation roster / UI / Engine
	 * Preferences / Composer.
	 * ≠ ListFiles / ReadFile / GetFileInfo / ForceWriteFile / AgentMerge.
	 */
	writeFile?(request: UniverseAgentWriteFileRequest): Promise<UniverseAgentWriteFileResult>;

	/**
	 * FileService.ForceWriteFile unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `path` / `sessionId`
	 * are sent as-is. Empty `content` sent as-is. Proto fields only
	 * (`ForceWriteFileRequest` / `WriteFileResponse`). No Conversation
	 * roster / UI / Engine Preferences / Composer.
	 * ≠ ListFiles / ReadFile / GetFileInfo / WriteFile / AgentMerge.
	 */
	forceWriteFile?(request: UniverseAgentForceWriteFileRequest): Promise<UniverseAgentWriteFileResult>;

	/**
	 * FileService.AgentMerge unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` / `path`
	 * are sent as-is. Empty `baseContent` / `currentContent` / `userContent`
	 * sent as-is. Proto fields only. No Conversation roster / UI / Engine
	 * Preferences / Composer.
	 * ≠ ListFiles / ReadFile / GetFileInfo / WriteFile / ForceWriteFile.
	 */
	agentMerge?(request: UniverseAgentAgentMergeRequest): Promise<UniverseAgentAgentMergeResult>;

	/**
	 * GitService.ReadGitSummary unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` is sent
	 * as-is. Proto fields only (`supported` / `reason` / `branch` /
	 * `change_count`). No Conversation roster / UI / SCM / Engine
	 * Preferences / Composer.
	 * ≠ ReadGitChanges / ReadGitFileDiff / WriteGitStagePaths /
	 * WriteGitCommit / WriteGitApplyHunks.
	 */
	readGitSummary?(request: UniverseAgentReadGitSummaryRequest): Promise<UniverseAgentReadGitSummaryResult>;

	/**
	 * GitService.ReadGitChanges unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` is sent
	 * as-is. Empty `path` / `old_path` / `kind` / `index_state` / `reason`
	 * / `branch` mapped as-is. Proto fields only
	 * (`ReadGitChangesRequest` / `ReadGitChangesResponse` +
	 * `GitChangeEntryProto`). No Conversation roster / UI / Sources Review
	 * / Engine Preferences / Composer.
	 * ≠ ReadGitSummary / ReadGitFileDiff / WriteGitStagePaths /
	 * WriteGitCommit / WriteGitApplyHunks.
	 */
	readGitChanges?(request: UniverseAgentReadGitChangesRequest): Promise<UniverseAgentReadGitChangesResult>;

	/**
	 * GitService.ReadGitFileDiff unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` / `path`
	 * / `indexState` are sent as-is. Proto fields only (`supported` /
	 * `reason` / `path` / `unified_diff`). No Conversation roster / UI /
	 * SCM / Engine Preferences / Composer.
	 * ≠ ReadGitSummary / ReadGitChanges / WriteGitStagePaths /
	 * WriteGitCommit / WriteGitApplyHunks.
	 */
	readGitFileDiff?(request: UniverseAgentReadGitFileDiffRequest): Promise<UniverseAgentReadGitFileDiffResult>;

	/**
	 * GitService.WriteGitStagePaths unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` is sent
	 * as-is. Empty `commands` / empty `argv` sent as-is. Proto fields only
	 * (`supported` / `reason` / `success` / `error_message` / `exit_code` /
	 * `stdout`). No Conversation roster / UI / SCM / Engine Preferences /
	 * Composer.
	 * ≠ ReadGitSummary / ReadGitChanges / ReadGitFileDiff / WriteGitCommit /
	 * WriteGitApplyHunks.
	 */
	writeGitStagePaths?(request: UniverseAgentWriteGitStagePathsRequest): Promise<UniverseAgentWriteGitWriteResult>;

	/**
	 * GitService.WriteGitCommit unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` is sent
	 * as-is. Empty `message` sent as-is. `signOff` / `amend` false sent
	 * as-is. Proto fields only (`WriteGitCommitRequest` /
	 * `WriteGitWriteResponse`: `supported` / `reason` / `success` /
	 * `error_message` / `exit_code` / `stdout`). No Conversation roster /
	 * UI / SCM / Engine Preferences / Composer.
	 * ≠ ReadGitSummary / ReadGitChanges / ReadGitFileDiff /
	 * WriteGitStagePaths / WriteGitApplyHunks.
	 */
	writeGitCommit?(request: UniverseAgentWriteGitCommitRequest): Promise<UniverseAgentWriteGitWriteResult>;

	/**
	 * GitService.WriteGitApplyHunks unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` is sent
	 * as-is. Empty `argv` / empty `patches` sent as-is. Proto fields only
	 * (`supported` / `reason` / `success` / `error_message` / `exit_code` /
	 * `stdout`). No Conversation roster / UI / SCM / Engine Preferences /
	 * Composer.
	 * ≠ ReadGitSummary / ReadGitChanges / ReadGitFileDiff / WriteGitStagePaths /
	 * WriteGitCommit.
	 */
	writeGitApplyHunks?(request: UniverseAgentWriteGitApplyHunksRequest): Promise<UniverseAgentWriteGitWriteResult>;

	/**
	 * TokenUsageService.GetSessionUsage unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `sessionId` is sent
	 * as-is. Empty `currency` / zero token counts mapped as-is. Proto
	 * fields only (`GetSessionUsageRequest` / `GetSessionUsageResponse` +
	 * `TokenUsageData`). No Conversation roster / UI / Engine Preferences /
	 * Composer.
	 * ≠ GetGlobalUsage / Agent.Usage.
	 */
	getSessionUsage?(request: UniverseAgentGetSessionUsageRequest): Promise<UniverseAgentGetSessionUsageResult>;

	/**
	 * TokenUsageService.GetGlobalUsage unary. Optional so Web / tests can
	 * omit it. Catalog + node transport only this slice; empty request
	 * `{}`. Empty `currency` mapped as-is. Proto fields only
	 * (`GetGlobalUsageRequest` / `GetGlobalUsageResponse` +
	 * `TokenUsageData`). No Conversation roster / UI / Engine Preferences /
	 * Composer.
	 * ≠ GetSessionUsage / Agent.Usage.
	 */
	getGlobalUsage?(): Promise<UniverseAgentGetGlobalUsageResult>;

	/**
	 * MemoryService.Save unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `scope` / `content` /
	 * `category` are sent as-is. Proto fields only (`MemorySaveRequest` /
	 * `MemorySaveResponse`: `success` / `message` / `file_path`). No
	 * Conversation roster / UI / Engine Preferences / Composer / Memory pane.
	 * ≠ Search / SearchDeep / Read / List / Delete / Reflect / Rebuild /
	 * Revert / History.
	 */
	saveMemory?(request: UniverseAgentSaveMemoryRequest): Promise<UniverseAgentSaveMemoryResult>;

	/**
	 * MemoryService.Search unary. Optional so Web / tests can omit it.
	 * Catalog + node transport only this slice; empty `scope` / `query` /
	 * `keywords` are sent as-is. `limit` 0 sent as-is. Empty `category` /
	 * `filename` / `title` / `snippet` / `scope` mapped as-is. Proto
	 * fields only (`MemorySearchRequest` / `MemorySearchResponse` +
	 * `MemorySearchResult`). No Conversation roster / UI / Engine
	 * Preferences / Composer.
	 * ≠ Save / SearchDeep / Read / List / Delete / Reflect / Rebuild /
	 * Revert / History.
	 */
	searchMemory?(request: UniverseAgentMemorySearchRequest): Promise<UniverseAgentMemorySearchResult>;

	/**
	 * ConfigService.SetPermissionPolicy unary (session/tool Ask/Agent/Permit
	 * policy write). Optional so Web / tests can omit it. Catalog + node
	 * transport only this slice; empty `sessionId` / `toolName` are sent
	 * as-is. `policy` uses typed `PermissionPolicy` wire. No Conversation
	 * roster / UI / Engine Preferences / Composer.
	 * ≠ SwitchModel / ListModels / Get / Set / GetModelPreferences /
	 * SetModelPreferences / SetPermissionMode.
	 */
	setPermissionPolicy?(request: UniverseAgentSetPermissionPolicyRequest): Promise<UniverseAgentSetPermissionPolicyResult>;

	/** ConfigService.ListModels — always `include_disabled=true` (Engine Model registry). */
	listModels(): Promise<UniverseAgentListModelsResult>;

	/**
	 * ConfigService.Get unary (generic config read). Optional so Web / tests
	 * can omit it. Catalog + node transport only this slice; empty `key` /
	 * `scope` / `sessionId` are sent as-is. No Conversation roster / UI /
	 * Engine Preferences.
	 * ≠ Set / Watch / ListModels / SwitchModel / TestModelProfile.
	 */
	getConfig?(request: UniverseAgentGetConfigRequest): Promise<UniverseAgentGetConfigResult>;

	/**
	 * ConfigService.SwitchModel unary (session-scoped model switch). Optional
	 * so Web / tests can omit it. Catalog + node transport only this slice;
	 * empty `sessionId` / `agentId` / `modelType` / `modelId` are sent as-is.
	 * No Conversation roster / UI / Engine Preferences / Composer.
	 * ≠ ListModels / TestModelProfile / Config.Get / Config.Set /
	 * GetModelPreferences / SetModelPreferences / SetPermissionPolicy.
	 */
	switchModel?(request: UniverseAgentSwitchModelRequest): Promise<UniverseAgentSwitchModelResult>;

	/**
	 * ConfigService.GetModelPreferences unary (session model-strategy prefs).
	 * Optional so Web / tests can omit it. Catalog + node transport only this
	 * slice; empty `sessionId` is sent as-is. No Conversation roster / UI /
	 * Engine Preferences / Composer.
	 * ≠ SetModelPreferences / SwitchModel / ListModels / Get / Set /
	 * SetPermissionPolicy.
	 */
	getModelPreferences?(request: UniverseAgentGetModelPreferencesRequest): Promise<UniverseAgentGetModelPreferencesResult>;

	/**
	 * ConfigService.ResolveModel unary (preview model resolution; does not
	 * switch). Optional so Web / tests can omit it. Catalog + node
	 * transport only this slice; empty `sessionId` / `type` are sent as-is.
	 * No Conversation roster / UI / Engine Preferences / Composer.
	 * ≠ ListModels / SwitchModel / Config.Get / Config.Set /
	 * GetModelPreferences / SetModelPreferences / Watch.
	 */
	resolveModel?(request: UniverseAgentResolveModelRequest): Promise<UniverseAgentResolveModelResult>;

	/**
	 * ConfigService.Watch server-stream (`stream ConfigChangedEvent`).
	 * Optional so Web / tests can omit it. Catalog + node transport only
	 * this slice; empty `keys` are sent as-is. No Conversation roster /
	 * UI / Engine Preferences.
	 * ≠ Get / Set / ListModels / SwitchModel / GetCommandDef.
	 */
	openWatchConfigStream?(
		request: UniverseAgentWatchConfigRequest,
		onResponse: (response: UniverseAgentConfigChangedEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentWatchConfigStream;
}
