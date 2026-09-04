/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
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
	UniverseAgentListModelsResult,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentAgentTreeNode,
	UniverseAgentFetchToolDetailRequest,
	UniverseAgentFetchToolDetailWireResult,
	UniverseAgentTeamInfo,
	UniverseAgentTeamMemberInfo,
	UniverseAgentTeamTaskInfo,
} from '../../common/universeAgentTypes.js';

export type { UniverseAgentConnectResult } from '../../common/universeAgentTypes.js';

export interface UniverseAgentAuthNonceRequest {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
}

export interface UniverseAgentAuthNonceResult {
	readonly authNonce: Uint8Array;
	readonly engineIdentityId: string;
	readonly engineCertFingerprint: string;
	readonly expiresAtMs?: number;
}

export interface UniverseAgentDeviceAuthConnectRequest {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
	readonly authNonce: Uint8Array;
	readonly signature: Uint8Array;
	readonly protocolVersion: string;
	readonly pairingPhase?: 'provisional' | 'formal';
}

/** gRPC status codes used by capability probe and transport classification. */
export const GrpcStatusCode = {
	OK: 0,
	UNIMPLEMENTED: 12,
	UNAVAILABLE: 14,
	DEADLINE_EXCEEDED: 4,
} as const;

export class UniverseAgentTransportError extends Error {

	constructor(
		readonly code: number,
		message: string,
	) {
		super(message);
		this.name = 'UniverseAgentTransportError';
	}
}

export function isTransportFailureCode(code: number): boolean {
	return code === GrpcStatusCode.UNAVAILABLE
		|| code === GrpcStatusCode.DEADLINE_EXCEEDED;
}

/**
 * Injectable gRPC transport surface. Production uses @grpc/grpc-js; tests inject mocks.
 */
export interface IUniverseAgentGrpcTransport {

	readonly isChannelAlive: boolean;

	connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult>;

	getAuthNonce(request: UniverseAgentAuthNonceRequest): Promise<UniverseAgentAuthNonceResult>;

	connectWithDeviceAuth(request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult>;

	close(): void;

	probeRpc(service: string, method: string): Promise<number>;

	listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult>;

	createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult>;

	deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void>;

	/** SessionService.Info unary (snake_case `session_id`). Empty ids sent as-is. */
	getSessionInfo(request: UniverseAgentSessionInfoRequest): Promise<UniverseAgentSessionInfoResult>;

	/** SessionService.Resume unary (snake_case `session_id`). Empty ids sent as-is. */
	resumeSession(request: UniverseAgentResumeSessionRequest): Promise<UniverseAgentResumeSessionResult>;

	/** SessionService.Prewarm unary (snake_case `session_ids`). Empty ids sent as-is. */
	prewarmSessions(request: UniverseAgentPrewarmSessionsRequest): Promise<UniverseAgentPrewarmSessionsResult>;

	/** SessionService.Shelve unary (snake_case `session_id`). Empty ids sent as-is. */
	shelveSession(request: UniverseAgentShelveSessionRequest): Promise<UniverseAgentShelveSessionResult>;
	/** SessionService.Unshelve unary (snake_case `session_id`). Empty ids sent as-is. */
	unshelveSession(request: UniverseAgentUnshelveSessionRequest): Promise<UniverseAgentUnshelveSessionResult>;
	/** SessionService.Purge unary (snake_case `session_id`). Empty ids sent as-is. */
	purgeSession(request: UniverseAgentPurgeSessionRequest): Promise<UniverseAgentPurgeSessionResult>;
	/** SessionService.Export unary (snake_case `session_id`/`format`). Empty ids sent as-is. */
	exportSession(request: UniverseAgentExportSessionRequest): Promise<UniverseAgentExportSessionResult>;
	/** SessionService.ResolveTurn unary (snake_case `session_id`/`turn_id`/`current_leaf_turn_id`). Empty ids sent as-is. */
	resolveTurn(request: UniverseAgentResolveTurnRequest): Promise<UniverseAgentResolveTurnResult>;
	/** AgentService.Status unary (snake_case `session_id`/`agent_id`). Empty ids sent as-is. */
	getAgentStatus(request: UniverseAgentAgentStatusRequest): Promise<UniverseAgentAgentStatusResult>;
	/** AgentService.Compact unary (snake_case `session_id`/`agent_id`). Empty ids sent as-is. */
	compact(request: UniverseAgentCompactRequest): Promise<UniverseAgentCompactResult>;

	/** AgentService.Todo unary (snake_case `session_id`/`agent_id`). Empty ids sent as-is. */
	getTodo(request: UniverseAgentTodoRequest): Promise<UniverseAgentTodoResult>;
	/** SessionService.ResolveAnchor unary. Empty ids sent as-is. */
	resolveAnchor(request: UniverseAgentResolveAnchorRequest): Promise<UniverseAgentResolveAnchorResult>;

	/** AgentService.Usage unary (snake_case `session_id`/`agent_id`). Empty ids sent as-is. */
	getUsage(request: UniverseAgentUsageRequest): Promise<UniverseAgentUsageResult>;
	/** AgentService.History unary (snake_case `session_id`/`agent_id`/`limit`/`offset`). Empty ids sent as-is. */
	getAgentHistory(request: UniverseAgentAgentHistoryRequest): Promise<UniverseAgentAgentHistoryResult>;
	/** AgentService.Prune unary (snake_case `session_id`/`agent_id`). Empty ids sent as-is. */
	prune(request: UniverseAgentPruneRequest): Promise<UniverseAgentPruneResult>;
	/** AgentService.Reset unary (snake_case `session_id`/`agent_id`/`clear_profile_only`). Empty ids sent as-is. */
	resetAgent(request: UniverseAgentResetAgentRequest): Promise<UniverseAgentResetAgentResult>;
	/** AgentService.Branch unary (snake_case `session_id`/`agent_id`/`branch_index`/`turn_id`). Empty ids sent as-is. */
	branch(request: UniverseAgentBranchRequest): Promise<UniverseAgentBranchResult>;
	/** AgentService.SuspendLoop unary (snake_case `session_id`/`agent_id`). Empty ids sent as-is. */
	suspendLoop(request: UniverseAgentSuspendLoopRequest): Promise<UniverseAgentSuspendLoopResult>;
	/** AgentService.ResumeLoop unary (snake_case `session_id`/`agent_id`). Empty ids sent as-is. */
	resumeLoop(request: UniverseAgentResumeLoopRequest): Promise<UniverseAgentResumeLoopResult>;
	/** AgentService.StopLoop unary (snake_case `session_id`/`agent_id`/`detail`). Empty ids sent as-is. */
	stopLoop(request: UniverseAgentStopLoopRequest): Promise<UniverseAgentStopLoopResult>;

	/** AgentService.List unary (snake_case `session_id`). Empty ids sent as-is. */
	listAgents(request: UniverseAgentListAgentsRequest): Promise<UniverseAgentListAgentsResult>;
	/** AgentService.Back unary (snake_case `session_id`/`agent_id`/`operation_id`). Empty ids sent as-is. */
	back(request: UniverseAgentBackRequest): Promise<UniverseAgentBackResult>;

	/** AgentService.Pause unary (snake_case `session_id`/`agent_id`). Empty ids sent as-is. */
	pauseAgent(request: UniverseAgentPauseAgentRequest): Promise<UniverseAgentPauseAgentResult>;

	renameSession(request: UniverseAgentRenameSessionRequest): Promise<UniverseAgentRenameSessionResult>;

	cancelGeneration(request: UniverseAgentCancelGenerationRequest): Promise<UniverseAgentCancelGenerationResult>;

	cancelToolCall(request: UniverseAgentCancelToolCallRequest): Promise<UniverseAgentCancelToolCallResult>;
	/** AgentService.RunToolInBackground unary (snake_case `session_id`/`agent_id`/`tool_call_id`). Empty ids sent as-is. */
	runToolInBackground(request: UniverseAgentRunToolInBackgroundRequest): Promise<UniverseAgentRunToolInBackgroundResult>;
	/** AgentService.StopShellTask unary (snake_case `session_id`/`task_id`). Empty ids sent as-is. */
	stopShellTask(request: UniverseAgentStopShellTaskRequest): Promise<UniverseAgentStopShellTaskResult>;
	/** AgentService.SendShellSessionClientControl unary (snake_case `session_id`/`tool_call_id`/`ref_id`/`control_payload_json`). Empty ids sent as-is. */
	sendShellSessionClientControl(request: UniverseAgentSendShellSessionClientControlRequest): Promise<UniverseAgentSendShellSessionClientControlResult>;
	/** AgentService.FetchToolUsageDetail unary (snake_case `session_id`/`tool_call_id`). Empty ids sent as-is. */
	fetchToolUsageDetail(request: UniverseAgentFetchToolUsageDetailRequest): Promise<UniverseAgentFetchToolUsageDetailResult>;
	/** AgentService.FireTriggerWebhook unary (snake_case `session_id`/`trigger_id`/`payload_json`). Empty ids sent as-is. */
	fireTriggerWebhook(request: UniverseAgentFireTriggerWebhookRequest): Promise<UniverseAgentFireTriggerWebhookResult>;
	/** AgentService.InstallSessionDemoFake unary (snake_case `session_id`/`queues_payload`/`content_type`/`playbook_id`). Empty ids sent as-is. */
	installSessionDemoFake(request: UniverseAgentInstallSessionDemoFakeRequest): Promise<UniverseAgentInstallSessionDemoFakeResult>;
	/** AgentService.ClearSessionDemoFake unary (snake_case `session_id`). Empty ids sent as-is. */
	clearSessionDemoFake(request: UniverseAgentClearSessionDemoFakeRequest): Promise<UniverseAgentClearSessionDemoFakeResult>;
	/** AgentService.SwitchWorkDir unary (snake_case `session_id`/`agent_id`/`new_work_dir`). Empty ids sent as-is. */
	switchWorkDir(request: UniverseAgentSwitchWorkDirRequest): Promise<UniverseAgentSwitchWorkDirResult>;
	/** AgentService.TestModelProfile unary (snake_case `provider_id`/`model_id`/`api_key`/`base_url`/`protocol`/`params`). Empty ids sent as-is. */
	testModelProfile(request: UniverseAgentTestModelProfileRequest): Promise<UniverseAgentTestModelProfileResult>;
	/** ConfigService.Set unary (snake_case `key`/`value`/`scope`/`session_id`). Empty ids sent as-is. */
	setConfig(request: UniverseAgentSetConfigRequest): Promise<UniverseAgentSetConfigResult>;

	setSessionGoal(request: UniverseAgentSetSessionGoalRequest): Promise<UniverseAgentSetSessionGoalResult>;

	cancelSessionGoal(request: UniverseAgentCancelSessionGoalRequest): Promise<UniverseAgentCancelSessionGoalResult>;

	respondPermission(request: UniverseAgentRespondPermissionRequest): Promise<UniverseAgentRespondPermissionResult>;
	/** PermissionService.SyncPermissionRule unary (snake_case `session_id`/`tool_name`/`scope`/`action`/`reason`). Empty ids sent as-is. */
	syncPermissionRule(request: UniverseAgentSyncPermissionRuleRequest): Promise<UniverseAgentSyncPermissionRuleResult>;

	/** PermissionService.PromotePermissionRule unary (snake_case `tool_name`/`scope`/`action`). Empty ids sent as-is. */
	promotePermissionRule(request: UniverseAgentPromotePermissionRuleRequest): Promise<UniverseAgentPromotePermissionRuleResult>;

	/** PermissionService.GetSessionRules unary (snake_case `session_id`). Empty ids sent as-is. */
	getSessionRules(request: UniverseAgentGetSessionRulesRequest): Promise<UniverseAgentGetSessionRulesResult>;

	/** PermissionService.SetPermissionMode unary (snake_case `session_id`/`mode`). Empty ids sent as-is. */
	setPermissionMode(request: UniverseAgentSetPermissionModeRequest): Promise<UniverseAgentSetPermissionModeResult>;
	/** TeamService.TaskUpdate unary (snake_case `session_id`/`agent_id`/`task_id`/`new_status`/`message`). Empty ids sent as-is. */
	taskUpdate(request: UniverseAgentTaskUpdateRequest): Promise<UniverseAgentTaskUpdateResult>;

	/** TeamService.TaskCancel unary (snake_case `session_id`/`agent_id`/`task_id`). Empty ids sent as-is. */
	taskCancel(request: UniverseAgentTaskCancelRequest): Promise<UniverseAgentTaskCancelResult>;

	/** TeamService.MessageMember unary (snake_case `session_id`/`agent_id`/`member_name`/`content`). Empty ids sent as-is. */
	messageMember(request: UniverseAgentMessageMemberRequest): Promise<UniverseAgentMessageMemberResult>;
	/** TeamService.CreateTeam unary (snake_case `session_id`/`agent_id`/`task_descriptions`). Empty ids sent as-is. */
	createTeam(request: UniverseAgentCreateTeamRequest): Promise<UniverseAgentCreateTeamResult>;

	/** TeamService.StartMember unary (snake_case `session_id`/`agent_id`/`member_name`/`preset_id`/`system_prompt`/`model_type`/`dynamic`). Empty ids sent as-is. */
	startMember(request: UniverseAgentStartMemberRequest): Promise<UniverseAgentStartMemberResult>;

	respondQuestion(request: UniverseAgentRespondQuestionRequest): Promise<UniverseAgentRespondQuestionResult>;

	enqueueQueueItem(request: UniverseAgentEnqueueQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.InsertQueueItem unary (snake_case `session_id`/`op_id`/`client_message_id`/`text`/`priority`/`before_item_id`). Empty ids sent as-is. */
	insertQueueItem(request: UniverseAgentInsertQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.ReorderQueue unary (snake_case `session_id`/`op_id`/`item_ids`). Empty ids sent as-is. */
	reorderQueue(request: UniverseAgentReorderQueueRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.DeleteQueueItem unary (snake_case `session_id`/`item_id`/`op_id`). Empty ids sent as-is. */
	deleteQueueItem(request: UniverseAgentDeleteQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.RetryQueueItem unary (snake_case `session_id`/`item_id`/`op_id`). Empty ids sent as-is. */
	retryQueueItem(request: UniverseAgentRetryQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.RetryAllFailed unary (snake_case `session_id`/`op_id`). Empty ids sent as-is. */
	retryAllFailed(request: UniverseAgentRetryAllFailedRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.RetryQueueItemUpload unary (snake_case `session_id`/`item_id`/`op_id`). Empty ids sent as-is. */
	retryQueueItemUpload(request: UniverseAgentRetryQueueItemUploadRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.PinQueueItem unary (snake_case `session_id`/`item_id`/`op_id`). Empty ids sent as-is. */
	pinQueueItem(request: UniverseAgentPinQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.SetQueueItemLocked unary (snake_case `session_id`/`item_id`/`op_id`/`locked`). Empty ids sent as-is. */
	setQueueItemLocked(request: UniverseAgentSetQueueItemLockedRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.InjectQueueItem unary (snake_case `session_id`/`item_id`/`op_id`). Empty ids sent as-is. */
	injectQueueItem(request: UniverseAgentInjectQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	/** AgentService.SetQueueItemForkAnchor unary (snake_case `session_id`/`item_id`/`op_id`/`fork_from_turn_id`/`fork_from_preview`). Empty ids sent as-is. */
	setQueueItemForkAnchor(request: UniverseAgentSetQueueItemForkAnchorRequest): Promise<UniverseAgentQueueMutationResult>;

	pauseQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult>;

	resumeQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult>;

	clearQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult>;

	holdQueueItem(request: UniverseAgentHoldQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	releaseQueueItemHold(request: UniverseAgentQueueItemRefRequest): Promise<UniverseAgentQueueMutationResult>;

	editQueueItem(request: UniverseAgentEditQueueItemRequest): Promise<UniverseAgentQueueMutationResult>;

	forkAgent(request: UniverseAgentForkAgentRequest): Promise<UniverseAgentForkAgentResult>;

	killAgent(request: UniverseAgentKillAgentRequest): Promise<UniverseAgentKillAgentResult>;

	deleteMessage(request: UniverseAgentDeleteMessageRequest): Promise<UniverseAgentDeleteMessageResult>;

	editMessage(request: UniverseAgentEditMessageRequest): Promise<UniverseAgentEditMessageResult>;

	sendClientToolResponse(request: UniverseAgentSendClientToolResponseRequest): Promise<UniverseAgentSendClientToolResponseResult>;

	listSnapshots(request: UniverseAgentListSnapshotsRequest): Promise<UniverseAgentListSnapshotsResult>;

	listLoopSnapshots(request: UniverseAgentListLoopSnapshotsRequest): Promise<UniverseAgentListLoopSnapshotsResult>;

	createSnapshot(request: UniverseAgentCreateSnapshotRequest): Promise<UniverseAgentCreateSnapshotResult>;

	restoreSnapshot(request: UniverseAgentRestoreSnapshotRequest): Promise<UniverseAgentRestoreSnapshotResult>;

	deleteSnapshot(request: UniverseAgentDeleteSnapshotRequest): Promise<UniverseAgentDeleteSnapshotResult>;

	getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult>;

	subscribeSessionEventStream(
		sessionId: string,
		listener: (event: UniverseAgentSessionEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void };

	chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void>;

	/** AgentService.ChatSync unary (snake_case `session_id`/`agent_id`/`session_input`/`timeout_seconds`/`last_known_message_ids`/`idempotency_key`). Empty ids sent as-is. */
	chatSync(request: UniverseAgentChatSyncRequest): Promise<UniverseAgentChatSyncResult>;

	/** AgentService.SyncInputDelivery unary (snake_case `session_id`/`last_known_message_ids`). Empty ids sent as-is. */
	syncInputDelivery(request: UniverseAgentSyncInputDeliveryRequest): Promise<UniverseAgentSyncInputDeliveryResult>;

	openChatStream(
		sessionId: string,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentChatStream;

	openContinuationStream(
		request: UniverseAgentContinueGenerationRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentContinuationStream;

	/** AgentService.Regenerate server-stream (snake_case ids). Empty ids sent as-is. */
	openRegenerateStream(
		request: UniverseAgentRegenerateRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentRegenerateStream;

	/** AgentService.Resume server-stream (snake_case ids). Empty ids sent as-is. */
	openResumeStream(
		request: UniverseAgentResumeRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentResumeStream;

	/** AgentService.SubscribeToolDetail server-stream (snake_case ids). Empty ids sent as-is. */
	openSubscribeToolDetailStream(
		request: UniverseAgentSubscribeToolDetailRequest,
		onResponse: (response: UniverseAgentSubscribeToolDetailChunk) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentSubscribeToolDetailStream;

	listSkills(): Promise<UniverseAgentListSkillsResult>;

	setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult>;

	getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult>;

	saveSkillContent(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult>;

	listAgentProfiles(request: UniverseAgentListAgentProfilesRequest): Promise<UniverseAgentListAgentProfilesResult>;

	saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult>;

	deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult>;

	resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult>;

	listMcpServers(request: UniverseAgentListMcpServersRequest): Promise<UniverseAgentListMcpServersResult>;

	getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult>;

	getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult>;

	listPlugins(): Promise<UniverseAgentListPluginsResult>;

	getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult>;

	enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult>;

	reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult>;

	unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult>;

	scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult>;

	addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult>;

	updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult>;

	removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult>;

	toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult>;

	listTools(): Promise<UniverseAgentListToolsResult>;

	/** ToolService.ToolInfo unary (snake_case `tool_name`). */
	getToolInfo(request: UniverseAgentToolInfoRequest): Promise<UniverseAgentToolInfoResult>;

	/** ConfigService.ListModels — always `include_disabled=true`. */
	listModels(): Promise<UniverseAgentListModelsResult>;

	/** Host-only: AgentService.Tree (m6 §11 A1). */
	fetchAgentTree(sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined>;

	/** Host-only: AgentService.FetchToolDetail (M7 P2a). Always `subscribe=false`. */
	fetchToolDetail(request: UniverseAgentFetchToolDetailRequest): Promise<UniverseAgentFetchToolDetailWireResult>;

	memberStatus(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamMemberInfo[]>;

	taskList(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamTaskInfo[]>;

	teamInfo(sessionId: string, agentId: string, teamId: number): Promise<UniverseAgentTeamInfo | undefined>;
}

/** Service / method paths aligned with UniverseAgent grpc-api proto package names. */
export const UniverseAgentGrpcServices = {
	System: {
		service: 'universeagent.system.v1.SystemService',
		Connect: 'Connect',
		GetAuthNonce: 'GetAuthNonce',
	},
	Session: {
		service: 'universeagent.session.v1.SessionService',
		List: 'List',
		Create: 'Create',
		Delete: 'Delete',
		Info: 'Info',
		Resume: 'Resume',
		Prewarm: 'Prewarm',
		Shelve: 'Shelve',
		Unshelve: 'Unshelve',
		Purge: 'Purge',
		Export: 'Export',
		ResolveTurn: 'ResolveTurn',
		ResolveAnchor: 'ResolveAnchor',
		GetHistory: 'GetHistory',
		SessionEventStream: 'SessionEventStream',
	},
	Permission: {
		service: 'universeagent.session.v1.PermissionService',
		SetSessionGoal: 'SetSessionGoal',
		CancelSessionGoal: 'CancelSessionGoal',
		Respond: 'Respond',
		SyncPermissionRule: 'SyncPermissionRule',
		PromotePermissionRule: 'PromotePermissionRule',
		GetSessionRules: 'GetSessionRules',
		SetPermissionMode: 'SetPermissionMode',
	},
	Agent: {
		service: 'universeagent.agent.v1.AgentService',
		Chat: 'Chat',
		ChatSync: 'ChatSync',
		SyncInputDelivery: 'SyncInputDelivery',
		ContinueGeneration: 'ContinueGeneration',
		Regenerate: 'Regenerate',
		Rename: 'Rename',
		Cancel: 'Cancel',
		CancelToolCall: 'CancelToolCall',
		RunToolInBackground: 'RunToolInBackground',
		StopShellTask: 'StopShellTask',
		SendShellSessionClientControl: 'SendShellSessionClientControl',
		FetchToolUsageDetail: 'FetchToolUsageDetail',
		FireTriggerWebhook: 'FireTriggerWebhook',
		InstallSessionDemoFake: 'InstallSessionDemoFake',
		ClearSessionDemoFake: 'ClearSessionDemoFake',
		SwitchWorkDir: 'SwitchWorkDir',
		TestModelProfile: 'TestModelProfile',
		EnqueueQueueItem: 'EnqueueQueueItem',
		InsertQueueItem: 'InsertQueueItem',
		ReorderQueue: 'ReorderQueue',
		DeleteQueueItem: 'DeleteQueueItem',
		RetryQueueItem: 'RetryQueueItem',
		RetryAllFailed: 'RetryAllFailed',
		RetryQueueItemUpload: 'RetryQueueItemUpload',
		PinQueueItem: 'PinQueueItem',
		SetQueueItemLocked: 'SetQueueItemLocked',
		InjectQueueItem: 'InjectQueueItem',
		SetQueueItemForkAnchor: 'SetQueueItemForkAnchor',
		PauseQueue: 'PauseQueue',
		ResumeQueue: 'ResumeQueue',
		ClearQueue: 'ClearQueue',
		HoldQueueItem: 'HoldQueueItem',
		ReleaseQueueItemHold: 'ReleaseQueueItemHold',
		EditQueueItem: 'EditQueueItem',
		Fork: 'Fork',
		Kill: 'Kill',
		DeleteMessage: 'DeleteMessage',
		EditMessage: 'EditMessage',
		RespondQuestion: 'RespondQuestion',
		SendClientToolResponse: 'SendClientToolResponse',
		ListSnapshots: 'ListSnapshots',
		ListLoopSnapshots: 'ListLoopSnapshots',
		CreateSnapshot: 'CreateSnapshot',
		RestoreSnapshot: 'RestoreSnapshot',
		DeleteSnapshot: 'DeleteSnapshot',
		Status: 'Status',
		Todo: 'Todo',
		Compact: 'Compact',
		Usage: 'Usage',
		List: 'List',
		History: 'History',
		Pause: 'Pause',
		Resume: 'Resume',
		Back: 'Back',
		Prune: 'Prune',
		Reset: 'Reset',
		Branch: 'Branch',
		SuspendLoop: 'SuspendLoop',
		ResumeLoop: 'ResumeLoop',
		StopLoop: 'StopLoop',
		Tree: 'Tree',
		ListAgentProfiles: 'ListAgentProfiles',
		SaveAgentProfile: 'SaveAgentProfile',
		DeleteAgentProfile: 'DeleteAgentProfile',
		ResetAgentProfile: 'ResetAgentProfile',
		FetchToolDetail: 'FetchToolDetail',
		SubscribeToolDetail: 'SubscribeToolDetail',
	},
	Mcp: {
		service: 'universeagent.mcp.v1.McpService',
		ListMcpServers: 'ListMcpServers',
		GetMcpServerStatuses: 'GetMcpServerStatuses',
		GetMcpServerTools: 'GetMcpServerTools',
		ToggleMcpServer: 'ToggleMcpServer',
		AddMcpServer: 'AddMcpServer',
		UpdateMcpServer: 'UpdateMcpServer',
		RemoveMcpServer: 'RemoveMcpServer',
	},
	Plugin: {
		service: 'universeagent.plugin.v1.PluginService',
		List: 'List',
		Info: 'Info',
		Enable: 'Enable',
		Reload: 'Reload',
		Unload: 'Unload',
		ScanNew: 'ScanNew',
	},
	Config: {
		service: 'universeagent.config.v1.ConfigService',
		ListModels: 'ListModels',
		Set: 'Set',
	},
	Team: {
		service: 'universeagent.team.v1.TeamService',
		MemberStatus: 'MemberStatus',
		TaskList: 'TaskList',
		TaskUpdate: 'TaskUpdate',
		TaskCancel: 'TaskCancel',
		MessageMember: 'MessageMember',
		CreateTeam: 'CreateTeam',
		StartMember: 'StartMember',
		TeamInfo: 'TeamInfo',
	},
	Tool: {
		service: 'universeagent.tool.v1.ToolService',
		ListSkills: 'ListSkills',
		SkillInfo: 'SkillInfo',
		SetSkillEnabled: 'SetSkillEnabled',
		SaveSkillContent: 'SaveSkillContent',
		ListTools: 'ListTools',
		ToolInfo: 'ToolInfo',
	},
} as const;

/** ConnectResponse.capabilities.methods advertisement key for SaveSkillContent. */
export const UniverseAgentSaveSkillContentMethodKey = 'ToolService.SaveSkillContent';

/** ConnectResponse.capabilities.methods advertisement key for FetchToolDetail. */
export const UniverseAgentFetchToolDetailMethodKey = 'AgentService.FetchToolDetail';
