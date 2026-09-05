/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentChatSyncInputDeliveryEvent,
	UniverseAgentChatSyncRequest,
	UniverseAgentChatSyncResult,
	UniverseAgentChatSyncSessionInput,
	UniverseAgentChatSyncToolResult,
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
	UniverseAgentPrewarmSessionEntry,
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
	UniverseAgentTodoItem,
	UniverseAgentCompactRequest,
	UniverseAgentCompactResult,
	UniverseAgentAnchorResolveScope,
	UniverseAgentEnvelopeAnchor,
	UniverseAgentEnvelopeRecordPresence,
	UniverseAgentResolveAnchorRequest,
	UniverseAgentResolveAnchorResult,
	UniverseAgentUsageRequest,
	UniverseAgentUsageResult,
	UniverseAgentAgentHistoryRequest,
	UniverseAgentAgentHistoryResult,
	UniverseAgentAgentHistoryEntry,
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
	UniverseAgentAgentUsage,
	UniverseAgentRecentRequestSpan,
	UniverseAgentContextWindowInfo,
	UniverseAgentSessionUsageInfo,
	UniverseAgentFixedOverheadInfo,
	UniverseAgentSystemPromptPartInfo,
	UniverseAgentMessageBreakdownInfo,
	UniverseAgentCompactInfo,
	UniverseAgentCacheInfo,
	UniverseAgentModelUsage,
	UniverseAgentAgentUsageDetail,
	UniverseAgentProfileUsage,
	UniverseAgentListAgentsRequest,
	UniverseAgentListAgentsResult,
	UniverseAgentPauseAgentRequest,
	UniverseAgentPauseAgentResult,
	UniverseAgentBackRequest,
	UniverseAgentBackResult,
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
	UniverseAgentContextSourceUsage,
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
	UniverseAgentPermissionRuleAction,
	UniverseAgentSyncPermissionRuleRequest,
	UniverseAgentSyncPermissionRuleResult,
	UniverseAgentPromotePermissionRuleRequest,
	UniverseAgentPromotePermissionRuleResult,
	UniverseAgentGetSessionRulesRequest,
	UniverseAgentGetSessionRulesResult,
	UniverseAgentSessionRule,
	UniverseAgentSessionToolPermissionMode,
	UniverseAgentSetPermissionModeRequest,
	UniverseAgentSetPermissionModeResult,
	UniverseAgentPermissionPolicy,
	UniverseAgentSetPermissionPolicyRequest,
	UniverseAgentSetPermissionPolicyResult,
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
	UniverseAgentQuestionAnswer,
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
	UniverseAgentQueueHoldReason,
	UniverseAgentQueueItemRefRequest,
	UniverseAgentQueueMutationResult,
	UniverseAgentQueuePriority,
	UniverseAgentQueueRefRequest,
	UniverseAgentForkAgentRequest,
	UniverseAgentForkAgentResult,
	UniverseAgentKillAgentRequest,
	UniverseAgentKillAgentResult,
	UniverseAgentDeleteMessageRequest,
	UniverseAgentDeleteMessageResult,
	UniverseAgentEditMessageRequest,
	UniverseAgentEditMessageResult,
	UniverseAgentCanvasRef,
	UniverseAgentSendClientToolResponseRequest,
	UniverseAgentSendClientToolResponseResult,
	UniverseAgentListSnapshotsRequest,
	UniverseAgentListSnapshotsResult,
	UniverseAgentListLoopSnapshotsRequest,
	UniverseAgentListLoopSnapshotsResult,
	UniverseAgentLoopSnapshotRecord,
	UniverseAgentCreateSnapshotRequest,
	UniverseAgentCreateSnapshotResult,
	UniverseAgentSessionSnapshotInfo,
	UniverseAgentRestoreSnapshotRequest,
	UniverseAgentRestoreSnapshotResult,
	UniverseAgentDeleteSnapshotRequest,
	UniverseAgentDeleteSnapshotResult,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentListSkillsResult,
	UniverseAgentSessionEvent,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentSkillSource,
	UniverseAgentSkillSummary,
	UniverseAgentListAgentProfilesRequest,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentAgentProfileSource,
	UniverseAgentAgentProfileSummary,
	UniverseAgentAgentProfileDetail,
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
	UniverseAgentMcpRuntimeStatus,
	UniverseAgentMcpServerStatus,
	UniverseAgentMcpToolDefinition,
	UniverseAgentListPluginsResult,
	UniverseAgentPluginInfoResult,
	UniverseAgentEnablePluginResult,
	UniverseAgentReloadPluginResult,
	UniverseAgentUnloadPluginResult,
	UniverseAgentScanNewPluginsResult,
	UniverseAgentPluginStatus,
	UniverseAgentPluginSummary,
	UniverseAgentPluginHookEntry,
	UniverseAgentMcpServerOrigin,
	UniverseAgentMcpTransport,
	UniverseAgentMcpServerSummary,
	UniverseAgentMcpServerConfig,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentAddMcpServerRequest,
	UniverseAgentAddMcpServerResult,
	UniverseAgentUpdateMcpServerRequest,
	UniverseAgentUpdateMcpServerResult,
	UniverseAgentRemoveMcpServerRequest,
	UniverseAgentRemoveMcpServerResult,
	UniverseAgentListToolsResult,
	UniverseAgentToolInfoRequest,
	UniverseAgentToolInfoResult,
	UniverseAgentSlashCommandSource,
	UniverseAgentCommandSummary,
	UniverseAgentListCommandsResult,
	UniverseAgentGetCommandDefRequest,
	UniverseAgentGetCommandDefResult,
	UniverseAgentFileEntry,
	UniverseAgentListFilesRequest,
	UniverseAgentListFilesResult,
	UniverseAgentReadFileRequest,
	UniverseAgentReadFileResult,
	UniverseAgentGetFileInfoRequest,
	UniverseAgentGetFileInfoResult,
	UniverseAgentWriteFileRequest,
	UniverseAgentWriteFileResult,
	UniverseAgentWriteFileStatus,
	UniverseAgentForceWriteFileRequest,
	UniverseAgentAgentMergeRequest,
	UniverseAgentAgentMergeResult,
	UniverseAgentReadGitSummaryRequest,
	UniverseAgentReadGitSummaryResult,
	UniverseAgentGitChangeEntry,
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
	UniverseAgentTokenUsageData,
	UniverseAgentSaveMemoryRequest,
	UniverseAgentSaveMemoryResult,
	UniverseAgentMemorySearchRequest,
	UniverseAgentMemorySearchResult,
	UniverseAgentMemorySearchEntry,
	UniverseAgentMemorySearchDeepRequest,
	UniverseAgentMemorySearchDeepResult,
	UniverseAgentReadMemoryRequest,
	UniverseAgentReadMemoryResult,
	UniverseAgentMemoryFileMetadata,
	UniverseAgentMemoryListRequest,
	UniverseAgentMemoryListResult,
	UniverseAgentMemoryCategoryInfo,
	UniverseAgentMemoryFileSummary,
	UniverseAgentDeleteMemoryRequest,
	UniverseAgentDeleteMemoryResult,
	UniverseAgentReflectMemoryRequest,
	UniverseAgentReflectMemoryResult,
	UniverseAgentMemoryReflectDiagnosis,
	UniverseAgentMemoryRebuildRequest,
	UniverseAgentMemoryRebuildEvent,
	UniverseAgentMemoryRebuildStream,
	UniverseAgentRevertMemoryRequest,
	UniverseAgentRevertMemoryResult,
	UniverseAgentMemoryHistoryRequest,
	UniverseAgentMemoryHistoryResult,
	UniverseAgentMemoryChangeEntry,
	UniverseAgentContextVariableListRequest,
	UniverseAgentContextVariableListResult,
	UniverseAgentContextVariableReadRequest,
	UniverseAgentContextVariableReadResult,
	UniverseAgentListNodesRequest,
	UniverseAgentListNodesResult,
	UniverseAgentGetNodeRequest,
	UniverseAgentListConfigsResult,
	UniverseAgentGetRemoteAgentConfigRequest,
	UniverseAgentSaveRemoteAgentConfigRequest,
	UniverseAgentSaveRemoteAgentConfigResult,
	UniverseAgentResetErrorRequest,
	UniverseAgentResetErrorResult,
	UniverseAgentReloadRemoteAgentsResult,
	UniverseAgentCreateRemoteSessionRequest,
	UniverseAgentCreateRemoteSessionResult,
	UniverseAgentDestroyRemoteSessionRequest,
	UniverseAgentDestroyRemoteSessionResult,
	UniverseAgentGetRemoteSessionStatusRequest,
	UniverseAgentGetRemoteSessionStatusResult,
	UniverseAgentRemotePendingPermission,
	UniverseAgentRemotePendingQuestion,
	UniverseAgentGetRemoteSessionHistoryRequest,
	UniverseAgentGetRemoteSessionHistoryResult,
	UniverseAgentRemoteChatMessage,
	UniverseAgentResumeRemoteSessionRequest,
	UniverseAgentResumeRemoteSessionResult,
	UniverseAgentCancelRemoteSessionRequest,
	UniverseAgentCancelRemoteSessionResult,
	UniverseAgentRemoteChatRequest,
	UniverseAgentRemoteChatResponse,
	UniverseAgentRemoteChatResult,
	UniverseAgentRemoteChatStream,
	UniverseAgentRemoteProgressEvent,
	UniverseAgentRemoteResponse,
	UniverseAgentRemoteAgentAuthConfig,
	UniverseAgentRemoteAgentCapabilities,
	UniverseAgentRemoteAgentConfig,
	UniverseAgentRemoteAgentEndpoint,
	UniverseAgentRemoteAgentHealthCheckConfig,
	UniverseAgentRemoteAgentInfo,
	UniverseAgentRemoteAgentLoadMetrics,
	UniverseAgentRemoteAgentModelInfo,
	UniverseAgentRemoteAgentPermissionBudget,
	UniverseAgentRemoteAgentPermissionDelegate,
	UniverseAgentRemoteAgentArgCondition,
	UniverseAgentRemoteAgentWhitelistEntry,
	UniverseAgentContextVariableEntry,
	UniverseAgentCheckConnectionRequest,
	UniverseAgentConnectionReport,
	UniverseAgentSetMaintenanceRequest,
	UniverseAgentSetMaintenanceResult,
	UniverseAgentExitMaintenanceRequest,
	UniverseAgentExitMaintenanceResult,
	UniverseAgentDeleteRemoteAgentConfigRequest,
	UniverseAgentDeleteRemoteAgentConfigResult,
	UniverseAgentValidationError,
	UniverseAgentContextVariableEntrySummary,
	UniverseAgentContextVariableScope,
	UniverseAgentGetUploadProgressRequest,
	UniverseAgentGetUploadProgressResult,
	UniverseAgentUploadChunk,
	UniverseAgentUploadAttachmentResult,
	UniverseAgentUploadAttachmentStream,
	UniverseAgentDownloadAttachmentRequest,
	UniverseAgentDownloadChunk,
	UniverseAgentDownloadAttachmentStream,
	UniverseAgentPtyClientMessage,
	UniverseAgentPtyServerMessage,
	UniverseAgentPtyStream,
	UniverseAgentHealthCheckResult,
	UniverseAgentDoctorCheck,
	UniverseAgentDoctorResult,
	UniverseAgentShutdownRequest,
	UniverseAgentShutdownResult,
	UniverseAgentDeviceInfo,
	UniverseAgentListDevicesResult,
	UniverseAgentPairApproveRequest,
	UniverseAgentPairApproveResult,
	UniverseAgentPairRejectRequest,
	UniverseAgentPairRejectResult,
	UniverseAgentRevokeRequest,
	UniverseAgentRevokeResult,
	UniverseAgentRotateTokenRequest,
	UniverseAgentRotateTokenResult,
	UniverseAgentPendingPairInfo,
	UniverseAgentListPendingResult,
	UniverseAgentListTriggersRequest,
	UniverseAgentListTriggersResult,
	UniverseAgentUpsertTriggerRequest,
	UniverseAgentUpsertTriggerResult,
	UniverseAgentDeleteTriggerRequest,
	UniverseAgentDeleteTriggerResult,
	UniverseAgentSetTriggerEnabledRequest,
	UniverseAgentSetTriggerEnabledResult,
	UniverseAgentFireTriggerRequest,
	UniverseAgentFireTriggerResult,
	UniverseAgentTrigger,
	UniverseAgentTriggerDeliveryTarget,
	UniverseAgentClipboardEntryType,
	UniverseAgentWriteClipboardRequest,
	UniverseAgentWriteClipboardResult,
	UniverseAgentReadClipboardRequest,
	UniverseAgentReadClipboardResult,
	UniverseAgentListClipboardRequest,
	UniverseAgentListClipboardResult,
	UniverseAgentClearClipboardRequest,
	UniverseAgentClearClipboardResult,
	UniverseAgentClipboardEntry,
	UniverseAgentClipboardEntrySummary,
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
	UniverseAgentModelEntry,
	UniverseAgentToolSummary,
	UniverseAgentAgentTreeNode,
	UniverseAgentFetchToolDetailRequest,
	UniverseAgentFetchToolDetailWireResult,
	UniverseAgentTeamInfo,
	UniverseAgentTeamMemberInfo,
} from '../../common/universeAgentTypes.js';
import type { UniverseAgentAuthNonceResult } from './grpcTransport.js';

export interface ConnectResponseWire {
	session_token?: string;
	work_dir?: string;
	pairing_nonce?: string;
	sas_code?: string;
	capabilities?: {
		methods?: string[];
		events?: string[];
	};
}

export interface AuthNonceResponseWire {
	auth_nonce?: string;
	engine_identity_id?: string;
	engine_cert_fingerprint?: string;
	expires_at_ms?: number;
}

export interface DeviceAuthWire {
	client_identity_id?: string;
	client_public_key?: string;
	auth_nonce?: string;
	signature?: string;
}

export interface ListSessionsResponseWire {
	sessions?: Array<{
		session_id?: string;
		title?: string;
		status?: string;
		created_at?: number;
		last_accessed_at?: number;
		turn_count?: number;
		model?: string;
	}>;
	total_count?: number;
}

export interface CreateSessionResponseWire {
	session_id?: string;
}

export interface SessionInfoResponseWire {
	session_id?: string;
	root_agent?: AgentInfoWire;
	created_at?: number;
	last_accessed_at?: number;
	provider?: string;
	model?: string;
}

export interface ResumeSessionResponseWire {
	success?: boolean;
	message?: string;
	root_agent?: AgentInfoWire;
}

export interface PrewarmSessionEntryWire {
	session_id?: string;
	outcome?: string | number;
	message?: string;
}

export interface PrewarmSessionsResponseWire {
	entries?: PrewarmSessionEntryWire[];
}

export interface ShelveSessionResponseWire {
	success?: boolean;
	message?: string;
}

export interface UnshelveSessionResponseWire {
	success?: boolean;
	message?: string;
}

export interface PurgeSessionResponseWire {
	success?: boolean;
	message?: string;
}

export interface ExportSessionResponseWire {
	content?: string;
	format?: string;
}

export interface ResolveTurnHitWire {
	envelope?: unknown;
	presence?: string | number;
	generation?: number | string;
}

export interface ResolveTurnTombstoneWire {
	session_id?: string;
	envelope_id?: string;
	seq?: number | string;
	turn_id?: string;
	generation?: number | string;
}

export interface ResolveTurnExpiredWire {
	anchor?: {
		session_id?: string;
		envelope_id?: string;
		generation?: number | string;
	};
}

export interface ResolveTurnResponseWire {
	hit?: ResolveTurnHitWire;
	tombstone?: ResolveTurnTombstoneWire;
	expired?: ResolveTurnExpiredWire;
}

export interface StatusResponseWire {
	agent?: AgentInfoWire;
}

export interface CompactResponseWire {
	success?: boolean;
	message?: string;
	tokens_before?: number;
	tokens_after?: number;
	outcome?: string | number;
	reject_reason?: string;
}

export interface ListAgentsResponseWire {
	agents?: AgentInfoWire[];
}

export interface BackResponseWire {
	success?: boolean;
	message?: string;
	current_turn_id?: string;
}

const CompactOutcomeByNumber: Record<number, string> = {
	0: 'COMPACT_OUTCOME_UNSPECIFIED',
	1: 'COMPACT_OUTCOME_STARTED',
	2: 'COMPACT_OUTCOME_SUCCEEDED',
	3: 'COMPACT_OUTCOME_FAILED',
	4: 'COMPACT_OUTCOME_APPLIED_PENDING_RETRY',
	5: 'COMPACT_OUTCOME_APPLIED_DURABILITY_FAILED',
	6: 'COMPACT_OUTCOME_APPLIED_IN_FLIGHT',
	7: 'COMPACT_OUTCOME_APPLIED_NOT_CONFIGURED',
};

const ContextSourceTypeByNumber: Record<number, string> = {
	0: 'CONTEXT_SOURCE_TYPE_UNSPECIFIED',
	1: 'CONTEXT_SOURCE_TYPE_SELF_HISTORY',
	2: 'CONTEXT_SOURCE_TYPE_PARENT_INSTRUCTION',
	3: 'CONTEXT_SOURCE_TYPE_AGENT_MESSAGE',
	4: 'CONTEXT_SOURCE_TYPE_BLACKBOARD',
	5: 'CONTEXT_SOURCE_TYPE_TOOL_RESULT',
	6: 'CONTEXT_SOURCE_TYPE_SYSTEM',
};

export interface ContextSourceUsageWire {
	source_type?: string | number;
	source_agent_id?: string;
	source_scope_id?: string;
	message_id?: string;
	estimated_tokens?: number | string;
}

export interface FetchToolUsageDetailResponseWire {
	success?: boolean;
	tool_call_id?: string;
	context_sources?: ContextSourceUsageWire[];
	error_message?: string;
}

const FireTriggerWebhookStatusByNumber: Record<number, string> = {
	0: 'FIRE_TRIGGER_WEBHOOK_STATUS_UNSPECIFIED',
	1: 'FIRE_TRIGGER_WEBHOOK_STATUS_QUEUED',
	2: 'FIRE_TRIGGER_WEBHOOK_STATUS_EXECUTED',
	3: 'FIRE_TRIGGER_WEBHOOK_STATUS_REJECTED',
	4: 'FIRE_TRIGGER_WEBHOOK_STATUS_SKIPPED',
};

const ToolDetailContentModeByNumber: Record<number, string> = {
	0: 'TOOL_DETAIL_CONTENT_MODE_UNSPECIFIED',
	1: 'TOOL_DETAIL_CONTENT_MODE_FULL_SNAPSHOT',
	2: 'TOOL_DETAIL_CONTENT_MODE_APPEND_SLICE',
};

export interface SubscribeToolDetailChunkWire {
	success?: boolean;
	error_message?: string;
	content?: string;
	revision?: number | string;
	truncated?: boolean;
	total_bytes?: number | string;
	mime_type?: string;
	eof?: boolean;
	content_mode?: string | number;
}

const UploadErrorCodeByNumber: Record<number, string> = {
	0: 'UPLOAD_ERROR_NONE',
	1: 'UPLOAD_ERROR_CHECKSUM_MISMATCH',
	2: 'UPLOAD_ERROR_DISK_FULL',
	3: 'UPLOAD_ERROR_PERMISSION_DENIED',
	4: 'UPLOAD_ERROR_INVALID_OFFSET',
	5: 'UPLOAD_ERROR_FILE_TOO_LARGE',
	6: 'UPLOAD_ERROR_INTERNAL',
	7: 'UPLOAD_ERROR_AUTH_FAILED',
};

export interface UploadResponseWire {
	success?: boolean;
	file_path?: string;
	checksum_sha256?: string;
	error_message?: string;
	error_code?: string | number;
}

export interface ConfigChangedEventWire {
	key?: string;
	old_value?: string;
	new_value?: string;
	scope?: string;
	timestamp?: number | string;
}
export interface SessionSnapshotInfoWire {
	id?: string;
	session_id?: string;
	title?: string;
	description?: string;
	created_at?: number;
	turn_count?: number;
	token_count?: number;
	model_id?: string;
	is_auto?: boolean;
}

export interface ListSnapshotsResponseWire {
	snapshots?: SessionSnapshotInfoWire[];
}

export interface LoopSnapshotRecordWire {
	timestamp?: number;
	turn_id?: string;
	loop_id?: string;
	iteration?: number;
	max_iterations?: number;
	goal?: string;
	exit_condition?: string;
	tmp_file_relative_path?: string;
	is_exit?: boolean;
	self_supervise?: string;
	terminal_reason?: string;
}

export interface ListLoopSnapshotsResponseWire {
	snapshots?: LoopSnapshotRecordWire[];
}

export interface CreateSnapshotResponseWire {
	success?: boolean;
	snapshot?: SessionSnapshotInfoWire;
	error_message?: string;
}

export interface RestoreSnapshotResponseWire {
	success?: boolean;
	error_message?: string;
}

export interface DeleteSnapshotResponseWire {
	success?: boolean;
	error_message?: string;
}

export interface TodoItemWire {
	id?: string;
	content?: string;
	status?: string;
	priority?: number;
	require_confirm?: boolean;
	blocked?: string;
}

export interface TodoResponseWire {
	items?: TodoItemWire[];
}

export interface SessionRuleWire {
	id?: string;
	tool_name?: string;
	scope?: string;
	action?: string | number;
	reason?: string;
	created_at?: number | string;
	expires_at?: number | string;
	source?: string | number;
}

export interface GetSessionRulesResponseWire {
	rules?: SessionRuleWire[];
}

export interface EnvelopeAnchorWire {
	session_id?: string;
	envelope_id?: string;
	generation?: number | string;
}

export interface AnchorHitWire {
	envelope?: unknown;
	presence?: number | string;
	generation?: number | string;
}

export interface AnchorTombstoneWire {
	session_id?: string;
	envelope_id?: string;
	seq?: number | string;
	turn_id?: string;
	generation?: number | string;
}

export interface AnchorExpiredWire {
	anchor?: EnvelopeAnchorWire;
}

export interface ResolveAnchorResponseWire {
	hit?: AnchorHitWire;
	tombstone?: AnchorTombstoneWire;
	expired?: AnchorExpiredWire;
}

export interface AgentUsageWire {
	agent_id?: string;
	input_tokens?: number;
	output_tokens?: number;
	turns?: number;
}

export interface RecentRequestSpanWire {
	profile_id?: string;
	provider?: string;
	model_id?: string;
	input_tokens?: number;
	output_tokens?: number;
	prefill_ms?: number;
	decode_ms?: number;
	completed_at_ms?: number;
	usage_kind?: string;
}

export interface FixedOverheadInfoWire {
	tool_definition_tokens?: number;
	tool_definition_count?: number;
	skill_inject_tokens?: number;
	mcp_tool_tokens?: number;
	memory_inject_tokens?: number;
	rules_inject_tokens?: number;
}

export interface SystemPromptPartInfoWire {
	id?: string;
	label?: string;
	tokens?: number;
	cache_scope?: string;
	volatility?: string;
}

export interface MessageBreakdownInfoWire {
	system_prompt_tokens?: number;
	user_message_count?: number;
	user_message_tokens?: number;
	assistant_count?: number;
	assistant_tokens?: number;
	tool_result_count?: number;
	tool_result_tokens?: number;
	compact_notice_count?: number;
	compact_notice_tokens?: number;
}

export interface CompactInfoWire {
	compact_count?: number;
	last_compact_tokens_before?: number;
	last_compact_tokens_after?: number;
	last_compact_time_ms?: number;
}

export interface CacheInfoWire {
	total_cache_read_tokens?: number;
	total_cache_creation_tokens?: number;
}

export interface ContextWindowInfoWire {
	context_window_size?: number;
	estimated_context_tokens?: number;
	model_name?: string;
	message_count?: number;
	breakdown?: MessageBreakdownInfoWire;
	compact?: CompactInfoWire;
	cache?: CacheInfoWire;
	fixed_overhead?: FixedOverheadInfoWire;
	system_prompt_parts?: SystemPromptPartInfoWire[];
}

export interface ModelUsageWire {
	model_id?: string;
	model_name?: string;
	provider?: string;
	input_tokens?: number;
	output_tokens?: number;
	thinking_tokens?: number;
	total_tokens?: number;
	turn_count?: number;
}

export interface AgentUsageDetailWire {
	agent_id?: string;
	agent_type?: string;
	model_id?: string;
	input_tokens?: number;
	output_tokens?: number;
	thinking_tokens?: number;
	total_tokens?: number;
	turn_count?: number;
}

export interface ProfileUsageWire {
	profile_id?: string;
	profile_name?: string;
	provider?: string;
	model_id?: string;
	chat_input_tokens?: number;
	chat_output_tokens?: number;
	compact_input_tokens?: number;
	compact_output_tokens?: number;
	thinking_tokens?: number;
	cache_read_tokens?: number;
	cache_creation_tokens?: number;
	total_tokens?: number;
	conversation_turn_count?: number;
	llm_request_count?: number;
	compact_request_count?: number;
	has_post_switch_chat?: boolean;
	recall_input_tokens?: number;
	recall_output_tokens?: number;
	recall_request_count?: number;
}

export interface SessionUsageInfoWire {
	total_input_tokens?: number;
	total_output_tokens?: number;
	total_thinking_tokens?: number;
	total_cache_read_tokens?: number;
	total_cache_creation_tokens?: number;
	total_tokens?: number;
	total_turns?: number;
	model_usages?: ModelUsageWire[];
	agent_details?: AgentUsageDetailWire[];
	profile_usages?: ProfileUsageWire[];
}

export interface UsageResponseWire {
	total_input_tokens?: number;
	total_output_tokens?: number;
	total_turns?: number;
	agent_usages?: AgentUsageWire[];
	context_window?: ContextWindowInfoWire;
	session_usage?: SessionUsageInfoWire;
	recent_request_spans?: RecentRequestSpanWire[];
}

export interface HistoryEntryWire {
	role?: string;
	content?: string;
	timestamp?: number | string;
	agent_id?: string;
}

export interface HistoryResponseWire {
	entries?: HistoryEntryWire[];
	total?: number;
}

export interface PruneResponseWire {
	success?: boolean;
	message?: string;
	removed_count?: number;
}

export interface BranchResponseWire {
	success?: boolean;
	message?: string;
	current_branch?: number;
	total_branches?: number;
	current_turn_id?: string;
}

export interface QueueMutationResponseWire {
	ok?: boolean;
	error?: string;
	op_id?: string;
	item_id?: string;
}

const ClipboardEntryTypeByNumber: Record<number, UniverseAgentClipboardEntryType> = {
	0: 'CLIPBOARD_TEXT',
	1: 'CLIPBOARD_FILE_PATH',
	2: 'CLIPBOARD_URL',
};

export function mapClipboardEntryType(value: string | number | undefined): UniverseAgentClipboardEntryType {
	if (typeof value === 'number') {
		return ClipboardEntryTypeByNumber[value] ?? 'CLIPBOARD_TEXT';
	}
	if (value === 'CLIPBOARD_FILE_PATH' || value === 'CLIPBOARD_URL' || value === 'CLIPBOARD_TEXT') {
		return value;
	}
	return 'CLIPBOARD_TEXT';
}
export interface GetHistoryResponseWire {
	envelopes?: Array<{ cursor_seq?: string; payload?: unknown }>;
	next_cursor_seq?: string;
}
export function mapConnectResponse(wire: ConnectResponseWire): UniverseAgentConnectResult {
	return {
		sessionToken: wire.session_token,
		workDir: wire.work_dir,
		pairingNonce: wire.pairing_nonce,
		sasCode: wire.sas_code,
		methods: wire.capabilities?.methods ?? [],
		events: wire.capabilities?.events ?? [],
	};
}

export function bytesToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(value: string | undefined): Uint8Array {
	if (!value) {
		return new Uint8Array(0);
	}
	return Uint8Array.from(Buffer.from(value, 'base64'));
}

export function mapAuthNonceResponse(wire: AuthNonceResponseWire): UniverseAgentAuthNonceResult {
	return {
		authNonce: base64ToBytes(wire.auth_nonce),
		engineIdentityId: wire.engine_identity_id ?? '',
		engineCertFingerprint: wire.engine_cert_fingerprint ?? '',
		expiresAtMs: wire.expires_at_ms,
	};
}

export function mapSessionInfoResponse(wire: SessionInfoResponseWire): UniverseAgentSessionInfoResult {
	return {
		sessionId: wire.session_id ?? '',
		rootAgent: mapAgentTreeNode(wire.root_agent),
		createdAt: wire.created_at ?? 0,
		lastAccessedAt: wire.last_accessed_at ?? 0,
		provider: wire.provider ?? '',
		model: wire.model ?? '',
	};
}

export function mapShelveSessionResponse(wire: ShelveSessionResponseWire): UniverseAgentShelveSessionResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

export function mapListSessionsResponse(wire: ListSessionsResponseWire): UniverseAgentListSessionsResult {
	return {
		sessions: (wire.sessions ?? []).map(session => ({
			sessionId: session.session_id ?? '',
			title: session.title,
			status: session.status,
			createdAt: session.created_at,
			lastAccessedAt: session.last_accessed_at,
			turnCount: session.turn_count,
			model: session.model,
		})),
		totalCount: wire.total_count,
	};
}

export function mapSessionSnapshotInfo(snapshot: SessionSnapshotInfoWire | undefined): UniverseAgentSessionSnapshotInfo {
	return {
		id: snapshot?.id ?? '',
		sessionId: snapshot?.session_id ?? '',
		title: snapshot?.title ?? '',
		description: snapshot?.description,
		createdAt: snapshot?.created_at,
		turnCount: snapshot?.turn_count,
		tokenCount: snapshot?.token_count,
		modelId: snapshot?.model_id,
		isAuto: snapshot?.is_auto,
	};
}

export function mapListSnapshotsResponse(wire: ListSnapshotsResponseWire): UniverseAgentListSnapshotsResult {
	return {
		snapshots: (wire.snapshots ?? []).map(snapshot => mapSessionSnapshotInfo(snapshot)),
	};
}

export function mapLoopSnapshotRecord(record: LoopSnapshotRecordWire | undefined): UniverseAgentLoopSnapshotRecord {
	return {
		timestamp: record?.timestamp,
		turnId: record?.turn_id ?? '',
		loopId: record?.loop_id ?? '',
		iteration: record?.iteration,
		maxIterations: record?.max_iterations,
		goal: record?.goal ?? '',
		exitCondition: record?.exit_condition ?? '',
		tmpFileRelativePath: record?.tmp_file_relative_path ?? '',
		isExit: record?.is_exit,
		selfSupervise: record?.self_supervise,
		terminalReason: record?.terminal_reason,
	};
}

export function mapListLoopSnapshotsResponse(wire: ListLoopSnapshotsResponseWire): UniverseAgentListLoopSnapshotsResult {
	return {
		snapshots: (wire.snapshots ?? []).map(record => mapLoopSnapshotRecord(record)),
	};
}

export function mapCreateSnapshotResponse(wire: CreateSnapshotResponseWire): UniverseAgentCreateSnapshotResult {
	const snapshot = wire.snapshot ? mapSessionSnapshotInfo(wire.snapshot) : undefined;
	return {
		ok: wire.success === true,
		message: wire.error_message,
		...(snapshot ? { snapshot } : {}),
	};
}

export function mapResumeSessionResponse(wire: ResumeSessionResponseWire): UniverseAgentResumeSessionResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		rootAgent: mapAgentTreeNode(wire.root_agent),
	};
}

const PrewarmSessionOutcomeByNumber: Record<number, string> = {
	0: 'PREWARM_SESSION_OUTCOME_UNSPECIFIED',
	1: 'PREWARM_SESSION_OUTCOME_ALREADY_RESTORED',
	2: 'PREWARM_SESSION_OUTCOME_RESTORED',
	3: 'PREWARM_SESSION_OUTCOME_SKIPPED',
	4: 'PREWARM_SESSION_OUTCOME_FAILED',
};

export function mapPrewarmSessionOutcome(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return '';
	}
	if (typeof value === 'number') {
		return PrewarmSessionOutcomeByNumber[value] ?? String(value);
	}
	return value;
}

export function mapPrewarmSessionEntry(wire: PrewarmSessionEntryWire | undefined): UniverseAgentPrewarmSessionEntry {
	return {
		sessionId: wire?.session_id ?? '',
		outcome: mapPrewarmSessionOutcome(wire?.outcome),
		message: wire?.message ?? '',
	};
}

export function mapPrewarmSessionsResponse(wire: PrewarmSessionsResponseWire): UniverseAgentPrewarmSessionsResult {
	return {
		entries: (wire.entries ?? []).map(entry => mapPrewarmSessionEntry(entry)),
	};
}

export function mapUnshelveSessionResponse(wire: UnshelveSessionResponseWire): UniverseAgentUnshelveSessionResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

export function mapPurgeSessionResponse(wire: PurgeSessionResponseWire): UniverseAgentPurgeSessionResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

export function mapExportSessionResponse(wire: ExportSessionResponseWire): UniverseAgentExportSessionResult {
	return {
		content: wire.content ?? '',
		format: wire.format ?? '',
	};
}

export function mapOptionalWireInt(value: number | string | undefined): number | undefined {
	if (value === undefined || value === '') {
		return undefined;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : undefined;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

export function mapWireInt(value: number | string | undefined): number {
	return mapOptionalWireInt(value) ?? 0;
}

export function mapResolveTurnResponse(wire: ResolveTurnResponseWire): UniverseAgentResolveTurnResult {
	if (wire.hit) {
		const generation = mapOptionalWireInt(wire.hit.generation);
		return {
			kind: 'hit',
			envelope: wire.hit.envelope !== undefined && wire.hit.envelope !== null ? wire.hit.envelope : {},
			presence: mapEnvelopeRecordPresence(wire.hit.presence),
			...(generation !== undefined ? { generation } : {}),
		};
	}
	if (wire.tombstone) {
		const turnId = wire.tombstone.turn_id;
		const generation = mapOptionalWireInt(wire.tombstone.generation);
		return {
			kind: 'tombstone',
			sessionId: wire.tombstone.session_id ?? '',
			envelopeId: wire.tombstone.envelope_id ?? '',
			seq: mapWireInt(wire.tombstone.seq),
			...(turnId !== undefined ? { turnId } : {}),
			...(generation !== undefined ? { generation } : {}),
		};
	}
	if (wire.expired) {
		const anchor = wire.expired.anchor;
		const generation = mapOptionalWireInt(anchor?.generation);
		return {
			kind: 'expired',
			sessionId: anchor?.session_id ?? '',
			envelopeId: anchor?.envelope_id ?? '',
			...(generation !== undefined ? { generation } : {}),
		};
	}
	return { kind: 'unspecified' };
}

export function mapStatusResponse(wire: StatusResponseWire): UniverseAgentAgentStatusResult {
	return {
		agent: mapAgentTreeNode(wire.agent),
	};
}

export function mapCompactOutcome(value: string | number | undefined): string | undefined {
	if (value === undefined || value === '') {
		return undefined;
	}
	if (typeof value === 'number') {
		return CompactOutcomeByNumber[value] ?? String(value);
	}
	return value;
}

export function mapContextSourceType(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return 'CONTEXT_SOURCE_TYPE_UNSPECIFIED';
	}
	if (typeof value === 'number') {
		return ContextSourceTypeByNumber[value] ?? String(value);
	}
	return value;
}

export function mapFireTriggerWebhookStatus(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return '';
	}
	if (typeof value === 'number') {
		return FireTriggerWebhookStatusByNumber[value] ?? String(value);
	}
	return value;
}

export function mapContextSourceUsage(item: ContextSourceUsageWire | undefined): UniverseAgentContextSourceUsage {
	return {
		sourceType: mapContextSourceType(item?.source_type),
		sourceAgentId: item?.source_agent_id,
		sourceScopeId: item?.source_scope_id,
		messageId: item?.message_id,
		estimatedTokens: requiredInt64(item?.estimated_tokens),
	};
}

export function mapToolDetailContentMode(value: string | number | undefined): string {
	if (value === undefined) {
		return 'TOOL_DETAIL_CONTENT_MODE_UNSPECIFIED';
	}
	if (typeof value === 'number') {
		return ToolDetailContentModeByNumber[value] ?? String(value);
	}
	return value;
}

export function mapUploadErrorCode(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return 'UPLOAD_ERROR_NONE';
	}
	if (typeof value === 'number') {
		return UploadErrorCodeByNumber[value] ?? String(value);
	}
	return value;
}


export function mapUploadResponse(wire: UploadResponseWire): UniverseAgentUploadAttachmentResult {
	return {
		success: wire.success === true,
		filePath: wire.file_path ?? '',
		checksumSha256: wire.checksum_sha256 ?? '',
		errorMessage: wire.error_message ?? '',
		errorCode: mapUploadErrorCode(wire.error_code),
	};
}

export function mapSubscribeToolDetailChunk(wire: SubscribeToolDetailChunkWire): UniverseAgentSubscribeToolDetailChunk {
	const totalBytes = optionalInt64(wire.total_bytes);
	return {
		success: wire.success === true,
		errorMessage: wire.error_message ?? '',
		content: wire.content ?? '',
		revision: requiredInt64(wire.revision),
		truncated: wire.truncated === true,
		...(totalBytes !== undefined ? { totalBytes } : {}),
		...(wire.mime_type !== undefined ? { mimeType: wire.mime_type } : {}),
		eof: wire.eof === true,
		contentMode: mapToolDetailContentMode(wire.content_mode),
	};
}

export function mapConfigChangedEvent(wire: ConfigChangedEventWire): UniverseAgentConfigChangedEvent {
	return {
		key: wire.key ?? '',
		oldValue: wire.old_value ?? '',
		newValue: wire.new_value ?? '',
		scope: wire.scope ?? '',
		timestamp: requiredInt64(wire.timestamp),
	};
}

export function mapFetchToolUsageDetailResponse(wire: FetchToolUsageDetailResponseWire): UniverseAgentFetchToolUsageDetailResult {
	return {
		ok: wire.success === true,
		toolCallId: wire.tool_call_id ?? '',
		contextSources: (wire.context_sources ?? []).map(item => mapContextSourceUsage(item)),
		message: wire.error_message,
	};
}

export function mapCompactResponse(wire: CompactResponseWire): UniverseAgentCompactResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		tokensBefore: wire.tokens_before,
		tokensAfter: wire.tokens_after,
		outcome: mapCompactOutcome(wire.outcome),
		rejectReason: wire.reject_reason,
	};
}

export function mapRestoreSnapshotResponse(wire: RestoreSnapshotResponseWire): UniverseAgentRestoreSnapshotResult {
	return {
		ok: wire.success === true,
		message: wire.error_message,
	};
}

export function mapDeleteSnapshotResponse(wire: DeleteSnapshotResponseWire): UniverseAgentDeleteSnapshotResult {
	return {
		ok: wire.success === true,
		message: wire.error_message,
	};
}

export function mapTodoItem(item: TodoItemWire | undefined): UniverseAgentTodoItem {
	return {
		id: item?.id ?? '',
		content: item?.content ?? '',
		status: item?.status ?? '',
		priority: item?.priority ?? 0,
		requireConfirm: item?.require_confirm === true,
		blocked: item?.blocked ?? '',
	};
}

export function mapTodoResponse(wire: TodoResponseWire): UniverseAgentTodoResult {
	return {
		items: (wire.items ?? []).map(item => mapTodoItem(item)),
	};
}

const RuleActionByNumber: Record<number, string> = {
	0: 'RULE_ACTION_UNSPECIFIED',
	1: 'ALLOW',
	2: 'DENY',
};

const RuleSourceByNumber: Record<number, string> = {
	0: 'RULE_SOURCE_UNSPECIFIED',
	1: 'USER_INTERACTIVE',
	2: 'LLM_REQUESTED',
	3: 'GLOBAL_INHERITED',
	4: 'SERVER_SYNCED',
};

export function mapRuleEnum(value: string | number | undefined, byNumber: Record<number, string>): string {
	if (value === undefined || value === '') {
		return '';
	}
	if (typeof value === 'number') {
		return byNumber[value] ?? String(value);
	}
	return value;
}

export function mapSessionRule(wire: SessionRuleWire | undefined): UniverseAgentSessionRule {
	return {
		id: wire?.id ?? '',
		toolName: wire?.tool_name ?? '',
		scope: wire?.scope ?? '',
		action: mapRuleEnum(wire?.action, RuleActionByNumber),
		reason: wire?.reason ?? '',
		createdAt: requiredInt64(wire?.created_at),
		expiresAt: optionalInt64(wire?.expires_at),
		source: mapRuleEnum(wire?.source, RuleSourceByNumber),
	};
}

export function mapGetSessionRulesResponse(wire: GetSessionRulesResponseWire): UniverseAgentGetSessionRulesResult {
	return {
		rules: (wire.rules ?? []).map(rule => mapSessionRule(rule)),
	};
}

function optionalInt64(value: number | string | undefined): number | undefined {
	if (value === undefined || value === '') {
		return undefined;
	}
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : undefined;
}

export function requiredInt64(value: number | string | undefined): number {
	return optionalInt64(value) ?? 0;
}



export function mapEnvelopeAnchor(wire: EnvelopeAnchorWire | undefined): UniverseAgentEnvelopeAnchor {
	const generation = optionalInt64(wire?.generation);
	return {
		sessionId: wire?.session_id ?? '',
		envelopeId: wire?.envelope_id ?? '',
		...(generation !== undefined ? { generation } : {}),
	};
}

export function mapEnvelopeRecordPresence(value: number | string | undefined): UniverseAgentEnvelopeRecordPresence {
	if (value === 1 || value === 'ENVELOPE_RECORD_PRESENCE_ACTIVE_ON_PATH') {
		return 'ENVELOPE_RECORD_PRESENCE_ACTIVE_ON_PATH';
	}
	if (value === 2 || value === 'ENVELOPE_RECORD_PRESENCE_ACTIVE_OFF_PATH') {
		return 'ENVELOPE_RECORD_PRESENCE_ACTIVE_OFF_PATH';
	}
	if (value === 3 || value === 'ENVELOPE_RECORD_PRESENCE_ARCHIVED') {
		return 'ENVELOPE_RECORD_PRESENCE_ARCHIVED';
	}
	return 'ENVELOPE_RECORD_PRESENCE_UNSPECIFIED';
}

export function mapResolveAnchorResponse(wire: ResolveAnchorResponseWire): UniverseAgentResolveAnchorResult {
	if (wire.hit) {
		const generation = optionalInt64(wire.hit.generation);
		return {
			hit: {
				envelope: wire.hit.envelope ?? {},
				presence: mapEnvelopeRecordPresence(wire.hit.presence),
				...(generation !== undefined ? { generation } : {}),
			},
		};
	}
	if (wire.tombstone) {
		const generation = optionalInt64(wire.tombstone.generation);
		return {
			tombstone: {
				sessionId: wire.tombstone.session_id ?? '',
				envelopeId: wire.tombstone.envelope_id ?? '',
				seq: requiredInt64(wire.tombstone.seq),
				...(wire.tombstone.turn_id !== undefined ? { turnId: wire.tombstone.turn_id } : {}),
				...(generation !== undefined ? { generation } : {}),
			},
		};
	}
	if (wire.expired) {
		return {
			expired: {
				anchor: mapEnvelopeAnchor(wire.expired.anchor),
			},
		};
	}
	return {};
}

export function mapAgentUsage(item: AgentUsageWire | undefined): UniverseAgentAgentUsage {
	return {
		agentId: item?.agent_id ?? '',
		inputTokens: item?.input_tokens ?? 0,
		outputTokens: item?.output_tokens ?? 0,
		turns: item?.turns ?? 0,
	};
}

export function mapRecentRequestSpan(item: RecentRequestSpanWire | undefined): UniverseAgentRecentRequestSpan {
	return {
		profileId: item?.profile_id ?? '',
		provider: item?.provider ?? '',
		modelId: item?.model_id ?? '',
		inputTokens: item?.input_tokens ?? 0,
		outputTokens: item?.output_tokens ?? 0,
		prefillMs: item?.prefill_ms ?? 0,
		decodeMs: item?.decode_ms ?? 0,
		completedAtMs: item?.completed_at_ms ?? 0,
		usageKind: item?.usage_kind ?? '',
	};
}

export function mapFixedOverheadInfo(wire: FixedOverheadInfoWire): UniverseAgentFixedOverheadInfo {
	return {
		toolDefinitionTokens: wire.tool_definition_tokens ?? 0,
		toolDefinitionCount: wire.tool_definition_count ?? 0,
		skillInjectTokens: wire.skill_inject_tokens ?? 0,
		mcpToolTokens: wire.mcp_tool_tokens ?? 0,
		memoryInjectTokens: wire.memory_inject_tokens ?? 0,
		rulesInjectTokens: wire.rules_inject_tokens ?? 0,
	};
}

export function mapSystemPromptPart(item: SystemPromptPartInfoWire | undefined): UniverseAgentSystemPromptPartInfo {
	return {
		id: item?.id ?? '',
		label: item?.label ?? '',
		tokens: item?.tokens ?? 0,
		cacheScope: item?.cache_scope ?? '',
		volatility: item?.volatility ?? '',
	};
}

export function mapMessageBreakdown(wire: MessageBreakdownInfoWire): UniverseAgentMessageBreakdownInfo {
	return {
		systemPromptTokens: wire.system_prompt_tokens ?? 0,
		userMessageCount: wire.user_message_count ?? 0,
		userMessageTokens: wire.user_message_tokens ?? 0,
		assistantCount: wire.assistant_count ?? 0,
		assistantTokens: wire.assistant_tokens ?? 0,
		toolResultCount: wire.tool_result_count ?? 0,
		toolResultTokens: wire.tool_result_tokens ?? 0,
		compactNoticeCount: wire.compact_notice_count ?? 0,
		compactNoticeTokens: wire.compact_notice_tokens ?? 0,
	};
}

export function mapCompactInfo(wire: CompactInfoWire): UniverseAgentCompactInfo {
	return {
		compactCount: wire.compact_count ?? 0,
		lastCompactTokensBefore: wire.last_compact_tokens_before ?? 0,
		lastCompactTokensAfter: wire.last_compact_tokens_after ?? 0,
		lastCompactTimeMs: wire.last_compact_time_ms ?? 0,
	};
}

export function mapCacheInfo(wire: CacheInfoWire): UniverseAgentCacheInfo {
	return {
		totalCacheReadTokens: wire.total_cache_read_tokens ?? 0,
		totalCacheCreationTokens: wire.total_cache_creation_tokens ?? 0,
	};
}

export function mapContextWindowInfo(wire: ContextWindowInfoWire): UniverseAgentContextWindowInfo {
	return {
		contextWindowSize: wire.context_window_size ?? 0,
		estimatedContextTokens: wire.estimated_context_tokens ?? 0,
		modelName: wire.model_name ?? '',
		messageCount: wire.message_count ?? 0,
		breakdown: wire.breakdown ? mapMessageBreakdown(wire.breakdown) : undefined,
		compact: wire.compact ? mapCompactInfo(wire.compact) : undefined,
		cache: wire.cache ? mapCacheInfo(wire.cache) : undefined,
		fixedOverhead: wire.fixed_overhead ? mapFixedOverheadInfo(wire.fixed_overhead) : undefined,
		systemPromptParts: (wire.system_prompt_parts ?? []).map(part => mapSystemPromptPart(part)),
	};
}

export function mapModelUsage(item: ModelUsageWire | undefined): UniverseAgentModelUsage {
	return {
		modelId: item?.model_id ?? '',
		modelName: item?.model_name ?? '',
		provider: item?.provider ?? '',
		inputTokens: item?.input_tokens ?? 0,
		outputTokens: item?.output_tokens ?? 0,
		thinkingTokens: item?.thinking_tokens ?? 0,
		totalTokens: item?.total_tokens ?? 0,
		turnCount: item?.turn_count ?? 0,
	};
}

export function mapAgentUsageDetail(item: AgentUsageDetailWire | undefined): UniverseAgentAgentUsageDetail {
	return {
		agentId: item?.agent_id ?? '',
		agentType: item?.agent_type ?? '',
		modelId: item?.model_id ?? '',
		inputTokens: item?.input_tokens ?? 0,
		outputTokens: item?.output_tokens ?? 0,
		thinkingTokens: item?.thinking_tokens ?? 0,
		totalTokens: item?.total_tokens ?? 0,
		turnCount: item?.turn_count ?? 0,
	};
}

export function mapProfileUsage(item: ProfileUsageWire | undefined): UniverseAgentProfileUsage {
	return {
		profileId: item?.profile_id ?? '',
		profileName: item?.profile_name ?? '',
		provider: item?.provider ?? '',
		modelId: item?.model_id ?? '',
		chatInputTokens: item?.chat_input_tokens ?? 0,
		chatOutputTokens: item?.chat_output_tokens ?? 0,
		compactInputTokens: item?.compact_input_tokens ?? 0,
		compactOutputTokens: item?.compact_output_tokens ?? 0,
		thinkingTokens: item?.thinking_tokens ?? 0,
		cacheReadTokens: item?.cache_read_tokens ?? 0,
		cacheCreationTokens: item?.cache_creation_tokens ?? 0,
		totalTokens: item?.total_tokens ?? 0,
		conversationTurnCount: item?.conversation_turn_count ?? 0,
		llmRequestCount: item?.llm_request_count ?? 0,
		compactRequestCount: item?.compact_request_count ?? 0,
		hasPostSwitchChat: item?.has_post_switch_chat === true,
		recallInputTokens: item?.recall_input_tokens ?? 0,
		recallOutputTokens: item?.recall_output_tokens ?? 0,
		recallRequestCount: item?.recall_request_count ?? 0,
	};
}

export function mapSessionUsageInfo(wire: SessionUsageInfoWire): UniverseAgentSessionUsageInfo {
	return {
		totalInputTokens: wire.total_input_tokens ?? 0,
		totalOutputTokens: wire.total_output_tokens ?? 0,
		totalThinkingTokens: wire.total_thinking_tokens ?? 0,
		totalCacheReadTokens: wire.total_cache_read_tokens ?? 0,
		totalCacheCreationTokens: wire.total_cache_creation_tokens ?? 0,
		totalTokens: wire.total_tokens ?? 0,
		totalTurns: wire.total_turns ?? 0,
		modelUsages: (wire.model_usages ?? []).map(item => mapModelUsage(item)),
		agentDetails: (wire.agent_details ?? []).map(item => mapAgentUsageDetail(item)),
		profileUsages: (wire.profile_usages ?? []).map(item => mapProfileUsage(item)),
	};
}

export function mapUsageResponse(wire: UsageResponseWire): UniverseAgentUsageResult {
	return {
		totalInputTokens: wire.total_input_tokens ?? 0,
		totalOutputTokens: wire.total_output_tokens ?? 0,
		totalTurns: wire.total_turns ?? 0,
		agentUsages: (wire.agent_usages ?? []).map(item => mapAgentUsage(item)),
		contextWindow: wire.context_window ? mapContextWindowInfo(wire.context_window) : undefined,
		sessionUsage: wire.session_usage ? mapSessionUsageInfo(wire.session_usage) : undefined,
		recentRequestSpans: (wire.recent_request_spans ?? []).map(item => mapRecentRequestSpan(item)),
	};
}

export function mapHistoryEntry(item: HistoryEntryWire | undefined): UniverseAgentAgentHistoryEntry {
	return {
		role: item?.role ?? '',
		content: item?.content ?? '',
		timestamp: requiredInt64(item?.timestamp),
		agentId: item?.agent_id ?? '',
	};
}

export function mapHistoryResponse(wire: HistoryResponseWire): UniverseAgentAgentHistoryResult {
	return {
		entries: (wire.entries ?? []).map(item => mapHistoryEntry(item)),
		total: wire.total ?? 0,
	};
}

export function mapPruneResponse(wire: PruneResponseWire): UniverseAgentPruneResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		removedCount: wire.removed_count ?? 0,
	};
}

export function mapBranchResponse(wire: BranchResponseWire): UniverseAgentBranchResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		currentBranch: wire.current_branch ?? 0,
		totalBranches: wire.total_branches ?? 0,
		currentTurnId: wire.current_turn_id,
	};
}



export function mapChatSyncToolResult(item: {
	tool_id?: string;
	tool_name?: string;
	is_error?: boolean;
	content?: string;
	duration_ms?: number | string;
} | undefined): UniverseAgentChatSyncToolResult {
	return {
		toolId: item?.tool_id ?? '',
		toolName: item?.tool_name ?? '',
		isError: item?.is_error === true,
		content: item?.content ?? '',
		durationMs: requiredInt64(item?.duration_ms),
	};
}

export function mapChatSyncInputDeliveryEvent(item: {
	message_id?: string;
	status?: number;
	error_code?: string;
	error_message?: string;
} | undefined): UniverseAgentChatSyncInputDeliveryEvent {
	return {
		messageId: item?.message_id ?? '',
		status: item?.status ?? 0,
		errorCode: item?.error_code ?? '',
		errorMessage: item?.error_message ?? '',
	};
}

export function mapChatSyncResponse(wire: {
	session_id?: string;
	agent_id?: string;
	text?: string;
	stop_reason?: string;
	input_tokens?: number | string;
	output_tokens?: number | string;
	turn_count?: number;
	tool_results?: Array<{
		tool_id?: string;
		tool_name?: string;
		is_error?: boolean;
		content?: string;
		duration_ms?: number | string;
	}>;
	error?: string;
	input_delivery_events?: Array<{
		message_id?: string;
		status?: number;
		error_code?: string;
		error_message?: string;
	}>;
}): UniverseAgentChatSyncResult {
	return {
		sessionId: wire.session_id ?? '',
		agentId: wire.agent_id ?? '',
		text: wire.text ?? '',
		stopReason: wire.stop_reason ?? '',
		inputTokens: requiredInt64(wire.input_tokens),
		outputTokens: requiredInt64(wire.output_tokens),
		turnCount: wire.turn_count ?? 0,
		toolResults: (wire.tool_results ?? []).map(item => mapChatSyncToolResult(item)),
		error: wire.error ?? '',
		inputDeliveryEvents: (wire.input_delivery_events ?? []).map(item => mapChatSyncInputDeliveryEvent(item)),
	};
}


export function mapSyncInputDeliveryResponse(wire: {
	input_delivery_events?: Array<{
		message_id?: string;
		status?: number;
		error_code?: string;
		error_message?: string;
	}>;
}): UniverseAgentSyncInputDeliveryResult {
	return {
		inputDeliveryEvents: (wire.input_delivery_events ?? []).map(item => mapChatSyncInputDeliveryEvent(item)),
	};
}

export function mapGetHistoryResponse(wire: GetHistoryResponseWire): UniverseAgentGetHistoryResult {
	return {
		envelopes: (wire.envelopes ?? []).map(envelope => ({
			cursorSeq: envelope.cursor_seq ?? '',
			payload: envelope.payload !== undefined && envelope.payload !== null ? envelope.payload : envelope,
		})),
		nextCursorSeq: wire.next_cursor_seq,
	};
}

export interface AgentInfoWire {
	agent_id?: string;
	name?: string;
	type?: string;
	status?: string;
	model?: string;
	turn_count?: number;
	created_at?: number;
	children?: AgentInfoWire[];
}

export interface AgentTreeResponseWire {
	root?: AgentInfoWire;
}

export interface FetchToolDetailResponseWire {
	success?: boolean;
	content?: string;
	truncated?: boolean;
	total_bytes?: number;
	error_message?: string;
}

export function mapAgentTreeNode(wire: AgentInfoWire | undefined): UniverseAgentAgentTreeNode | undefined {
	if (!wire) {
		return undefined;
	}
	return {
		agentId: wire.agent_id ?? 'root',
		name: wire.name ?? '',
		type: wire.type ?? 'AGENT_TYPE_UNKNOWN',
		status: wire.status ?? 'AGENT_STATUS_UNKNOWN',
		model: wire.model ?? '',
		turnCount: wire.turn_count ?? 0,
		createdAt: wire.created_at ?? 0,
		children: (wire.children ?? []).map(child => mapAgentTreeNode(child)!).filter(Boolean),
	};
}

export function mapListAgentsResponse(wire: ListAgentsResponseWire): UniverseAgentListAgentsResult {
	return {
		agents: (wire.agents ?? []).flatMap(agent => {
			const mapped = mapAgentTreeNode(agent);
			return mapped ? [mapped] : [];
		}),
	};
}

export function mapBackResponse(wire: BackResponseWire): UniverseAgentBackResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		currentTurnId: wire.current_turn_id,
	};
}

