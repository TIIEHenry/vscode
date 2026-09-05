/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as grpc from '@grpc/grpc-js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { createStreamCloseGate } from '../../common/sessionStreamClose.js';
import type {
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
	UniverseAgentSessionStreamCloseCause,
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
	UniverseAgentTeamTaskInfo,
} from '../../common/universeAgentTypes.js';
import {
	GrpcStatusCode,
	IUniverseAgentGrpcTransport,
	UniverseAgentAuthNonceRequest,
	UniverseAgentAuthNonceResult,
	UniverseAgentDeviceAuthConnectRequest,
	UniverseAgentGrpcServices,
	UniverseAgentTransportError,
} from './grpcTransport.js';
import { createPinnedChannelOptions, createPinnedTlsChannelCredentials, type UniverseAgentPinnedTlsTarget } from '../universeAgentChannel.js';

interface ConnectResponseWire {
	session_token?: string;
	work_dir?: string;
	pairing_nonce?: string;
	sas_code?: string;
	capabilities?: {
		methods?: string[];
		events?: string[];
	};
}

interface AuthNonceResponseWire {
	auth_nonce?: string;
	engine_identity_id?: string;
	engine_cert_fingerprint?: string;
	expires_at_ms?: number;
}

interface DeviceAuthWire {
	client_identity_id?: string;
	client_public_key?: string;
	auth_nonce?: string;
	signature?: string;
}

interface ListSessionsResponseWire {
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

interface CreateSessionResponseWire {
	session_id?: string;
}

interface SessionInfoResponseWire {
	session_id?: string;
	root_agent?: AgentInfoWire;
	created_at?: number;
	last_accessed_at?: number;
	provider?: string;
	model?: string;
}

interface ResumeSessionResponseWire {
	success?: boolean;
	message?: string;
	root_agent?: AgentInfoWire;
}

interface PrewarmSessionEntryWire {
	session_id?: string;
	outcome?: string | number;
	message?: string;
}

interface PrewarmSessionsResponseWire {
	entries?: PrewarmSessionEntryWire[];
}

interface ShelveSessionResponseWire {
	success?: boolean;
	message?: string;
}

interface UnshelveSessionResponseWire {
	success?: boolean;
	message?: string;
}

interface PurgeSessionResponseWire {
	success?: boolean;
	message?: string;
}

interface ExportSessionResponseWire {
	content?: string;
	format?: string;
}

interface ResolveTurnHitWire {
	envelope?: unknown;
	presence?: string | number;
	generation?: number | string;
}

interface ResolveTurnTombstoneWire {
	session_id?: string;
	envelope_id?: string;
	seq?: number | string;
	turn_id?: string;
	generation?: number | string;
}

interface ResolveTurnExpiredWire {
	anchor?: {
		session_id?: string;
		envelope_id?: string;
		generation?: number | string;
	};
}

interface ResolveTurnResponseWire {
	hit?: ResolveTurnHitWire;
	tombstone?: ResolveTurnTombstoneWire;
	expired?: ResolveTurnExpiredWire;
}

interface StatusResponseWire {
	agent?: AgentInfoWire;
}

interface CompactResponseWire {
	success?: boolean;
	message?: string;
	tokens_before?: number;
	tokens_after?: number;
	outcome?: string | number;
	reject_reason?: string;
}

interface ListAgentsResponseWire {
	agents?: AgentInfoWire[];
}

interface BackResponseWire {
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

interface ContextSourceUsageWire {
	source_type?: string | number;
	source_agent_id?: string;
	source_scope_id?: string;
	message_id?: string;
	estimated_tokens?: number | string;
}

interface FetchToolUsageDetailResponseWire {
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

interface SubscribeToolDetailChunkWire {
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

interface UploadResponseWire {
	success?: boolean;
	file_path?: string;
	checksum_sha256?: string;
	error_message?: string;
	error_code?: string | number;
}

interface ConfigChangedEventWire {
	key?: string;
	old_value?: string;
	new_value?: string;
	scope?: string;
	timestamp?: number | string;
}
interface SessionSnapshotInfoWire {
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

interface ListSnapshotsResponseWire {
	snapshots?: SessionSnapshotInfoWire[];
}

interface LoopSnapshotRecordWire {
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

interface ListLoopSnapshotsResponseWire {
	snapshots?: LoopSnapshotRecordWire[];
}

interface CreateSnapshotResponseWire {
	success?: boolean;
	snapshot?: SessionSnapshotInfoWire;
	error_message?: string;
}

interface RestoreSnapshotResponseWire {
	success?: boolean;
	error_message?: string;
}

interface DeleteSnapshotResponseWire {
	success?: boolean;
	error_message?: string;
}

interface TodoItemWire {
	id?: string;
	content?: string;
	status?: string;
	priority?: number;
	require_confirm?: boolean;
	blocked?: string;
}

interface TodoResponseWire {
	items?: TodoItemWire[];
}

interface SessionRuleWire {
	id?: string;
	tool_name?: string;
	scope?: string;
	action?: string | number;
	reason?: string;
	created_at?: number | string;
	expires_at?: number | string;
	source?: string | number;
}

interface GetSessionRulesResponseWire {
	rules?: SessionRuleWire[];
}

interface EnvelopeAnchorWire {
	session_id?: string;
	envelope_id?: string;
	generation?: number | string;
}

interface AnchorHitWire {
	envelope?: unknown;
	presence?: number | string;
	generation?: number | string;
}

interface AnchorTombstoneWire {
	session_id?: string;
	envelope_id?: string;
	seq?: number | string;
	turn_id?: string;
	generation?: number | string;
}

interface AnchorExpiredWire {
	anchor?: EnvelopeAnchorWire;
}

interface ResolveAnchorResponseWire {
	hit?: AnchorHitWire;
	tombstone?: AnchorTombstoneWire;
	expired?: AnchorExpiredWire;
}

interface AgentUsageWire {
	agent_id?: string;
	input_tokens?: number;
	output_tokens?: number;
	turns?: number;
}

interface RecentRequestSpanWire {
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

interface FixedOverheadInfoWire {
	tool_definition_tokens?: number;
	tool_definition_count?: number;
	skill_inject_tokens?: number;
	mcp_tool_tokens?: number;
	memory_inject_tokens?: number;
	rules_inject_tokens?: number;
}

interface SystemPromptPartInfoWire {
	id?: string;
	label?: string;
	tokens?: number;
	cache_scope?: string;
	volatility?: string;
}

interface MessageBreakdownInfoWire {
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

interface CompactInfoWire {
	compact_count?: number;
	last_compact_tokens_before?: number;
	last_compact_tokens_after?: number;
	last_compact_time_ms?: number;
}

interface CacheInfoWire {
	total_cache_read_tokens?: number;
	total_cache_creation_tokens?: number;
}

interface ContextWindowInfoWire {
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

interface ModelUsageWire {
	model_id?: string;
	model_name?: string;
	provider?: string;
	input_tokens?: number;
	output_tokens?: number;
	thinking_tokens?: number;
	total_tokens?: number;
	turn_count?: number;
}

interface AgentUsageDetailWire {
	agent_id?: string;
	agent_type?: string;
	model_id?: string;
	input_tokens?: number;
	output_tokens?: number;
	thinking_tokens?: number;
	total_tokens?: number;
	turn_count?: number;
}

interface ProfileUsageWire {
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

interface SessionUsageInfoWire {
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

interface UsageResponseWire {
	total_input_tokens?: number;
	total_output_tokens?: number;
	total_turns?: number;
	agent_usages?: AgentUsageWire[];
	context_window?: ContextWindowInfoWire;
	session_usage?: SessionUsageInfoWire;
	recent_request_spans?: RecentRequestSpanWire[];
}

interface HistoryEntryWire {
	role?: string;
	content?: string;
	timestamp?: number | string;
	agent_id?: string;
}

interface HistoryResponseWire {
	entries?: HistoryEntryWire[];
	total?: number;
}

interface PruneResponseWire {
	success?: boolean;
	message?: string;
	removed_count?: number;
}

interface BranchResponseWire {
	success?: boolean;
	message?: string;
	current_branch?: number;
	total_branches?: number;
	current_turn_id?: string;
}

interface QueueMutationResponseWire {
	ok?: boolean;
	error?: string;
	op_id?: string;
	item_id?: string;
}

function queueRefWire(request: UniverseAgentQueueRefRequest): Record<string, unknown> {
	return {
		session_id: request.sessionId,
		op_id: request.opId ?? '',
	};
}

function queueItemRefWire(request: UniverseAgentQueueItemRefRequest): Record<string, unknown> {
	return {
		...queueRefWire(request),
		item_id: request.itemId,
	};
}

function queueHoldReasonWire(reason: UniverseAgentQueueHoldReason): number {
	return reason === 'EDITING' ? 1 : 0;
}

function queuePriorityWire(priority: UniverseAgentQueuePriority | undefined): number {
	switch (priority) {
		case 'HIGH':
			return 1;
		case 'LOW':
			return 2;
		default:
			return 0;
	}
}

function permissionRuleActionWire(action: UniverseAgentPermissionRuleAction): number {
	switch (action) {
		case 'ALLOW':
			return 1;
		case 'DENY':
			return 2;
		default:
			return 0;
	}
}

function sessionToolPermissionModeWire(mode: UniverseAgentSessionToolPermissionMode): number {
	switch (mode) {
		case 'SESSION_TOOL_PERMISSION_MODE_ASK':
			return 1;
		case 'SESSION_TOOL_PERMISSION_MODE_AGENT':
			return 2;
		case 'SESSION_TOOL_PERMISSION_MODE_PERMIT':
			return 3;
		default:
			return 0;
	}
}

function permissionPolicyWire(policy: UniverseAgentPermissionPolicy): number {
	switch (policy) {
		case 'PERMISSION_POLICY_ASK':
			return 1;
		case 'PERMISSION_POLICY_AGENT':
			return 2;
		case 'PERMISSION_POLICY_PERMIT':
			return 3;
		default:
			return 0;
	}
}

function clipboardEntryTypeWire(type: UniverseAgentClipboardEntryType): number {
	switch (type) {
		case 'CLIPBOARD_FILE_PATH':
			return 1;
		case 'CLIPBOARD_URL':
			return 2;
		default:
			return 0;
	}
}

const ClipboardEntryTypeByNumber: Record<number, UniverseAgentClipboardEntryType> = {
	0: 'CLIPBOARD_TEXT',
	1: 'CLIPBOARD_FILE_PATH',
	2: 'CLIPBOARD_URL',
};

function mapClipboardEntryType(value: string | number | undefined): UniverseAgentClipboardEntryType {
	if (typeof value === 'number') {
		return ClipboardEntryTypeByNumber[value] ?? 'CLIPBOARD_TEXT';
	}
	if (value === 'CLIPBOARD_FILE_PATH' || value === 'CLIPBOARD_URL' || value === 'CLIPBOARD_TEXT') {
		return value;
	}
	return 'CLIPBOARD_TEXT';
}

function questionAnswersWire(
	answers: Readonly<Record<string, UniverseAgentQuestionAnswer>> | undefined,
): Record<string, { selected_labels: string[] }> {
	const wire: Record<string, { selected_labels: string[] }> = {};
	if (!answers) {
		return wire;
	}
	for (const [itemId, answer] of Object.entries(answers)) {
		wire[itemId] = { selected_labels: [...answer.selectedLabels] };
	}
	return wire;
}

function canvasRefsWire(refs: readonly UniverseAgentCanvasRef[] | undefined): Array<{
	canvas_id: string;
	revision_id: string;
	title: string;
	source_hash?: string;
}> {
	return (refs ?? []).map(ref => ({
		canvas_id: ref.canvasId,
		revision_id: ref.revisionId,
		title: ref.title,
		...(ref.sourceHash !== undefined ? { source_hash: ref.sourceHash } : {}),
	}));
}

interface GetHistoryResponseWire {
	envelopes?: Array<{ cursor_seq?: string; payload?: unknown }>;
	next_cursor_seq?: string;
}

function grpcErrorCode(error: grpc.ServiceError | null | undefined): number {
	return error?.code ?? GrpcStatusCode.OK;
}

function makeUnaryClient<TRequest, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (request: TRequest) => Promise<TResponse> {
	const path = `/${servicePath}/${method}`;
	return (request: TRequest) => new Promise<TResponse>((resolve, reject) => {
		channel.makeUnaryRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
			request,
			(error, response) => {
				if (error) {
					reject(new UniverseAgentTransportError(error.code, error.message));
					return;
				}
				resolve(response as TResponse);
			},
		);
	});
}

function makeServerStreamClient<TRequest, TEvent>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (
	request: TRequest,
	listener: (event: TEvent) => void,
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
) => { dispose(): void } {
	const path = `/${servicePath}/${method}`;
	return (request, listener, onClosed) => {
		const disposables = new DisposableStore();
		const gate = createStreamCloseGate(onClosed);
		const call = channel.makeServerStreamRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TEvent,
			request,
		);
		call.on('data', (data: TEvent) => listener(data));
		call.on('error', (error: grpc.ServiceError) => {
			if (gate.closed) {
				return;
			}
			const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
			gate.finish({ kind: 'error', message });
		});
		call.on('end', () => {
			gate.finish({ kind: 'remote' });
		});
		disposables.add({
			dispose: () => {
				gate.closeLocal();
				call.cancel();
			},
		});
		return disposables;
	};
}

function makeClientStreamClient<TChunk, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (
	onResponse: (response: TResponse) => void,
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
) => { write(chunk: TChunk): void; end(): void; dispose(): void } {
	const path = `/${servicePath}/${method}`;
	return (onResponse, onClosed) => {
		const gate = createStreamCloseGate(onClosed);
		const call = channel.makeClientStreamRequest(
			path,
			(value: TChunk) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
			(error: grpc.ServiceError | null, response?: TResponse) => {
				if (gate.closed) {
					return;
				}
				if (error) {
					const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
					gate.finish({ kind: 'error', message });
					return;
				}
				if (response !== undefined) {
					onResponse(response);
				}
				gate.finish({ kind: 'remote' });
			},
		);
		return {
			write(chunk: TChunk): void {
				if (gate.closed) {
					return;
				}
				call.write(chunk);
			},
			end(): void {
				if (gate.closed) {
					return;
				}
				call.end();
			},
			dispose(): void {
				if (gate.closed) {
					call.cancel();
					return;
				}
				gate.closeLocal();
				call.cancel();
			},
		};
	};
}

function makeResidentBidiStreamClient<TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (
	sessionId: string,
	onResponse: (response: TResponse) => void,
	onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
) => UniverseAgentChatStream {
	const path = `/${servicePath}/${method}`;
	return (sessionId, onResponse, onClosed) => {
		const call = channel.makeBidiStreamRequest(
			path,
			(value: Record<string, unknown>) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
		);
		const gate = createStreamCloseGate(onClosed);
		call.on('data', (data: TResponse) => onResponse(data));
		call.on('error', (error: grpc.ServiceError) => {
			if (gate.closed) {
				return;
			}
			const message = typeof error?.message === 'string' && error.message ? error.message : 'stream error';
			gate.finish({ kind: 'error', message });
		});
		call.on('end', () => {
			gate.finish({ kind: 'remote' });
		});
		return {
			write(payload: unknown): void {
				if (gate.closed) {
					return;
				}
				call.write({ session_id: sessionId, payload });
			},
			dispose(): void {
				if (gate.closed) {
					call.cancel();
					return;
				}
				gate.closeLocal();
				call.end();
				call.cancel();
			},
		};
	};
}

function makeBidiStreamClient<TRequest, TResponse>(
	channel: grpc.Client,
	servicePath: string,
	method: string,
): (request: TRequest, onResponse: (response: TResponse) => void) => Promise<void> {
	const path = `/${servicePath}/${method}`;
	return (request: TRequest, onResponse: (response: TResponse) => void) => new Promise<void>((resolve, reject) => {
		const call = channel.makeBidiStreamRequest(
			path,
			(value: TRequest) => Buffer.from(JSON.stringify(value ?? {})),
			(buffer: Buffer) => JSON.parse(buffer.toString('utf8')) as TResponse,
		);
		call.on('data', (data: TResponse) => onResponse(data));
		call.on('error', (error: grpc.ServiceError) => reject(new UniverseAgentTransportError(error.code, error.message)));
		call.on('end', () => resolve());
		call.write(request);
		call.end();
	});
}

function mapConnectResponse(wire: ConnectResponseWire): UniverseAgentConnectResult {
	return {
		sessionToken: wire.session_token,
		workDir: wire.work_dir,
		pairingNonce: wire.pairing_nonce,
		sasCode: wire.sas_code,
		methods: wire.capabilities?.methods ?? [],
		events: wire.capabilities?.events ?? [],
	};
}

function bytesToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(value: string | undefined): Uint8Array {
	if (!value) {
		return new Uint8Array(0);
	}
	return Uint8Array.from(Buffer.from(value, 'base64'));
}

function mapAuthNonceResponse(wire: AuthNonceResponseWire): UniverseAgentAuthNonceResult {
	return {
		authNonce: base64ToBytes(wire.auth_nonce),
		engineIdentityId: wire.engine_identity_id ?? '',
		engineCertFingerprint: wire.engine_cert_fingerprint ?? '',
		expiresAtMs: wire.expires_at_ms,
	};
}

function mapSessionInfoResponse(wire: SessionInfoResponseWire): UniverseAgentSessionInfoResult {
	return {
		sessionId: wire.session_id ?? '',
		rootAgent: mapAgentTreeNode(wire.root_agent),
		createdAt: wire.created_at ?? 0,
		lastAccessedAt: wire.last_accessed_at ?? 0,
		provider: wire.provider ?? '',
		model: wire.model ?? '',
	};
}

function mapShelveSessionResponse(wire: ShelveSessionResponseWire): UniverseAgentShelveSessionResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

function mapListSessionsResponse(wire: ListSessionsResponseWire): UniverseAgentListSessionsResult {
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

function mapSessionSnapshotInfo(snapshot: SessionSnapshotInfoWire | undefined): UniverseAgentSessionSnapshotInfo {
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

function mapListSnapshotsResponse(wire: ListSnapshotsResponseWire): UniverseAgentListSnapshotsResult {
	return {
		snapshots: (wire.snapshots ?? []).map(snapshot => mapSessionSnapshotInfo(snapshot)),
	};
}

function mapLoopSnapshotRecord(record: LoopSnapshotRecordWire | undefined): UniverseAgentLoopSnapshotRecord {
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

function mapListLoopSnapshotsResponse(wire: ListLoopSnapshotsResponseWire): UniverseAgentListLoopSnapshotsResult {
	return {
		snapshots: (wire.snapshots ?? []).map(record => mapLoopSnapshotRecord(record)),
	};
}

function mapCreateSnapshotResponse(wire: CreateSnapshotResponseWire): UniverseAgentCreateSnapshotResult {
	const snapshot = wire.snapshot ? mapSessionSnapshotInfo(wire.snapshot) : undefined;
	return {
		ok: wire.success === true,
		message: wire.error_message,
		...(snapshot ? { snapshot } : {}),
	};
}

function mapResumeSessionResponse(wire: ResumeSessionResponseWire): UniverseAgentResumeSessionResult {
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

function mapPrewarmSessionOutcome(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return '';
	}
	if (typeof value === 'number') {
		return PrewarmSessionOutcomeByNumber[value] ?? String(value);
	}
	return value;
}

function mapPrewarmSessionEntry(wire: PrewarmSessionEntryWire | undefined): UniverseAgentPrewarmSessionEntry {
	return {
		sessionId: wire?.session_id ?? '',
		outcome: mapPrewarmSessionOutcome(wire?.outcome),
		message: wire?.message ?? '',
	};
}

function mapPrewarmSessionsResponse(wire: PrewarmSessionsResponseWire): UniverseAgentPrewarmSessionsResult {
	return {
		entries: (wire.entries ?? []).map(entry => mapPrewarmSessionEntry(entry)),
	};
}

function mapUnshelveSessionResponse(wire: UnshelveSessionResponseWire): UniverseAgentUnshelveSessionResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

function mapPurgeSessionResponse(wire: PurgeSessionResponseWire): UniverseAgentPurgeSessionResult {
	return {
		ok: wire.success === true,
		message: wire.message,
	};
}

function mapExportSessionResponse(wire: ExportSessionResponseWire): UniverseAgentExportSessionResult {
	return {
		content: wire.content ?? '',
		format: wire.format ?? '',
	};
}

function mapOptionalWireInt(value: number | string | undefined): number | undefined {
	if (value === undefined || value === '') {
		return undefined;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : undefined;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function mapWireInt(value: number | string | undefined): number {
	return mapOptionalWireInt(value) ?? 0;
}

function mapResolveTurnResponse(wire: ResolveTurnResponseWire): UniverseAgentResolveTurnResult {
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

function mapStatusResponse(wire: StatusResponseWire): UniverseAgentAgentStatusResult {
	return {
		agent: mapAgentTreeNode(wire.agent),
	};
}

function mapCompactOutcome(value: string | number | undefined): string | undefined {
	if (value === undefined || value === '') {
		return undefined;
	}
	if (typeof value === 'number') {
		return CompactOutcomeByNumber[value] ?? String(value);
	}
	return value;
}

function mapContextSourceType(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return 'CONTEXT_SOURCE_TYPE_UNSPECIFIED';
	}
	if (typeof value === 'number') {
		return ContextSourceTypeByNumber[value] ?? String(value);
	}
	return value;
}

function mapFireTriggerWebhookStatus(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return '';
	}
	if (typeof value === 'number') {
		return FireTriggerWebhookStatusByNumber[value] ?? String(value);
	}
	return value;
}

function mapContextSourceUsage(item: ContextSourceUsageWire | undefined): UniverseAgentContextSourceUsage {
	return {
		sourceType: mapContextSourceType(item?.source_type),
		sourceAgentId: item?.source_agent_id,
		sourceScopeId: item?.source_scope_id,
		messageId: item?.message_id,
		estimatedTokens: requiredInt64(item?.estimated_tokens),
	};
}

function mapToolDetailContentMode(value: string | number | undefined): string {
	if (value === undefined) {
		return 'TOOL_DETAIL_CONTENT_MODE_UNSPECIFIED';
	}
	if (typeof value === 'number') {
		return ToolDetailContentModeByNumber[value] ?? String(value);
	}
	return value;
}

function mapUploadErrorCode(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return 'UPLOAD_ERROR_NONE';
	}
	if (typeof value === 'number') {
		return UploadErrorCodeByNumber[value] ?? String(value);
	}
	return value;
}

function mapUploadChunkWire(chunk: UniverseAgentUploadChunk): Record<string, unknown> {
	const wire: Record<string, unknown> = {
		offset: chunk.offset,
	};
	if (chunk.header) {
		wire.header = {
			transfer_id: chunk.header.transferId,
			filename: chunk.header.filename,
			total_size: chunk.header.totalSize,
			mime_type: chunk.header.mimeType,
			checksum_sha256: chunk.header.checksumSha256,
			is_precompressed: chunk.header.isPrecompressed,
			session_id: chunk.header.sessionId,
			chunk_size: chunk.header.chunkSize,
			...(chunk.header.queueItemId !== undefined ? { queue_item_id: chunk.header.queueItemId } : {}),
		};
	}
	if (chunk.chunk !== undefined) {
		wire.chunk = bytesToBase64(chunk.chunk);
	}
	return wire;
}

function mapUploadResponse(wire: UploadResponseWire): UniverseAgentUploadAttachmentResult {
	return {
		success: wire.success === true,
		filePath: wire.file_path ?? '',
		checksumSha256: wire.checksum_sha256 ?? '',
		errorMessage: wire.error_message ?? '',
		errorCode: mapUploadErrorCode(wire.error_code),
	};
}

function mapSubscribeToolDetailChunk(wire: SubscribeToolDetailChunkWire): UniverseAgentSubscribeToolDetailChunk {
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

function mapConfigChangedEvent(wire: ConfigChangedEventWire): UniverseAgentConfigChangedEvent {
	return {
		key: wire.key ?? '',
		oldValue: wire.old_value ?? '',
		newValue: wire.new_value ?? '',
		scope: wire.scope ?? '',
		timestamp: requiredInt64(wire.timestamp),
	};
}

function mapFetchToolUsageDetailResponse(wire: FetchToolUsageDetailResponseWire): UniverseAgentFetchToolUsageDetailResult {
	return {
		ok: wire.success === true,
		toolCallId: wire.tool_call_id ?? '',
		contextSources: (wire.context_sources ?? []).map(item => mapContextSourceUsage(item)),
		message: wire.error_message,
	};
}

function mapCompactResponse(wire: CompactResponseWire): UniverseAgentCompactResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		tokensBefore: wire.tokens_before,
		tokensAfter: wire.tokens_after,
		outcome: mapCompactOutcome(wire.outcome),
		rejectReason: wire.reject_reason,
	};
}

function mapRestoreSnapshotResponse(wire: RestoreSnapshotResponseWire): UniverseAgentRestoreSnapshotResult {
	return {
		ok: wire.success === true,
		message: wire.error_message,
	};
}

function mapDeleteSnapshotResponse(wire: DeleteSnapshotResponseWire): UniverseAgentDeleteSnapshotResult {
	return {
		ok: wire.success === true,
		message: wire.error_message,
	};
}

function mapTodoItem(item: TodoItemWire | undefined): UniverseAgentTodoItem {
	return {
		id: item?.id ?? '',
		content: item?.content ?? '',
		status: item?.status ?? '',
		priority: item?.priority ?? 0,
		requireConfirm: item?.require_confirm === true,
		blocked: item?.blocked ?? '',
	};
}

function mapTodoResponse(wire: TodoResponseWire): UniverseAgentTodoResult {
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

function mapRuleEnum(value: string | number | undefined, byNumber: Record<number, string>): string {
	if (value === undefined || value === '') {
		return '';
	}
	if (typeof value === 'number') {
		return byNumber[value] ?? String(value);
	}
	return value;
}

function mapSessionRule(wire: SessionRuleWire | undefined): UniverseAgentSessionRule {
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

function mapGetSessionRulesResponse(wire: GetSessionRulesResponseWire): UniverseAgentGetSessionRulesResult {
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

function requiredInt64(value: number | string | undefined): number {
	return optionalInt64(value) ?? 0;
}

function anchorResolveScopeWire(scope: UniverseAgentAnchorResolveScope): number {
	switch (scope) {
		case 'ANCHOR_RESOLVE_SCOPE_ACTIVE':
			return 1;
		case 'ANCHOR_RESOLVE_SCOPE_OFF_PATH':
			return 2;
		case 'ANCHOR_RESOLVE_SCOPE_INCLUDING_ARCHIVED':
			return 3;
		default:
			return 0;
	}
}

function resolveAnchorRequestWire(request: UniverseAgentResolveAnchorRequest): Record<string, unknown> {
	const anchor: Record<string, unknown> = {
		session_id: request.anchor.sessionId,
		envelope_id: request.anchor.envelopeId,
	};
	if (request.anchor.generation !== undefined) {
		anchor.generation = request.anchor.generation;
	}
	const wire: Record<string, unknown> = {
		anchor,
		scope: anchorResolveScopeWire(request.scope),
	};
	if (request.currentLeafTurnId !== undefined) {
		wire.current_leaf_turn_id = request.currentLeafTurnId;
	}
	return wire;
}

function mapEnvelopeAnchor(wire: EnvelopeAnchorWire | undefined): UniverseAgentEnvelopeAnchor {
	const generation = optionalInt64(wire?.generation);
	return {
		sessionId: wire?.session_id ?? '',
		envelopeId: wire?.envelope_id ?? '',
		...(generation !== undefined ? { generation } : {}),
	};
}

function mapEnvelopeRecordPresence(value: number | string | undefined): UniverseAgentEnvelopeRecordPresence {
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

function mapResolveAnchorResponse(wire: ResolveAnchorResponseWire): UniverseAgentResolveAnchorResult {
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

function mapAgentUsage(item: AgentUsageWire | undefined): UniverseAgentAgentUsage {
	return {
		agentId: item?.agent_id ?? '',
		inputTokens: item?.input_tokens ?? 0,
		outputTokens: item?.output_tokens ?? 0,
		turns: item?.turns ?? 0,
	};
}

function mapRecentRequestSpan(item: RecentRequestSpanWire | undefined): UniverseAgentRecentRequestSpan {
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

function mapFixedOverheadInfo(wire: FixedOverheadInfoWire): UniverseAgentFixedOverheadInfo {
	return {
		toolDefinitionTokens: wire.tool_definition_tokens ?? 0,
		toolDefinitionCount: wire.tool_definition_count ?? 0,
		skillInjectTokens: wire.skill_inject_tokens ?? 0,
		mcpToolTokens: wire.mcp_tool_tokens ?? 0,
		memoryInjectTokens: wire.memory_inject_tokens ?? 0,
		rulesInjectTokens: wire.rules_inject_tokens ?? 0,
	};
}

function mapSystemPromptPart(item: SystemPromptPartInfoWire | undefined): UniverseAgentSystemPromptPartInfo {
	return {
		id: item?.id ?? '',
		label: item?.label ?? '',
		tokens: item?.tokens ?? 0,
		cacheScope: item?.cache_scope ?? '',
		volatility: item?.volatility ?? '',
	};
}

function mapMessageBreakdown(wire: MessageBreakdownInfoWire): UniverseAgentMessageBreakdownInfo {
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

function mapCompactInfo(wire: CompactInfoWire): UniverseAgentCompactInfo {
	return {
		compactCount: wire.compact_count ?? 0,
		lastCompactTokensBefore: wire.last_compact_tokens_before ?? 0,
		lastCompactTokensAfter: wire.last_compact_tokens_after ?? 0,
		lastCompactTimeMs: wire.last_compact_time_ms ?? 0,
	};
}

function mapCacheInfo(wire: CacheInfoWire): UniverseAgentCacheInfo {
	return {
		totalCacheReadTokens: wire.total_cache_read_tokens ?? 0,
		totalCacheCreationTokens: wire.total_cache_creation_tokens ?? 0,
	};
}

function mapContextWindowInfo(wire: ContextWindowInfoWire): UniverseAgentContextWindowInfo {
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

function mapModelUsage(item: ModelUsageWire | undefined): UniverseAgentModelUsage {
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

function mapAgentUsageDetail(item: AgentUsageDetailWire | undefined): UniverseAgentAgentUsageDetail {
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

function mapProfileUsage(item: ProfileUsageWire | undefined): UniverseAgentProfileUsage {
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

function mapSessionUsageInfo(wire: SessionUsageInfoWire): UniverseAgentSessionUsageInfo {
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

function mapUsageResponse(wire: UsageResponseWire): UniverseAgentUsageResult {
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

function mapHistoryEntry(item: HistoryEntryWire | undefined): UniverseAgentAgentHistoryEntry {
	return {
		role: item?.role ?? '',
		content: item?.content ?? '',
		timestamp: requiredInt64(item?.timestamp),
		agentId: item?.agent_id ?? '',
	};
}

function mapHistoryResponse(wire: HistoryResponseWire): UniverseAgentAgentHistoryResult {
	return {
		entries: (wire.entries ?? []).map(item => mapHistoryEntry(item)),
		total: wire.total ?? 0,
	};
}

function mapPruneResponse(wire: PruneResponseWire): UniverseAgentPruneResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		removedCount: wire.removed_count ?? 0,
	};
}

function mapBranchResponse(wire: BranchResponseWire): UniverseAgentBranchResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		currentBranch: wire.current_branch ?? 0,
		totalBranches: wire.total_branches ?? 0,
		currentTurnId: wire.current_turn_id,
	};
}

function chatSyncSessionInputWire(input: UniverseAgentChatSyncSessionInput): Record<string, unknown> {
	const wire: Record<string, unknown> = {
		message_id: input.messageId,
		text: input.text,
	};
	if (input.delivery !== undefined) {
		wire.delivery = input.delivery;
	}
	if (input.modelProfileId !== undefined) {
		wire.model_profile_id = input.modelProfileId;
	}
	if (input.systemPrompt !== undefined) {
		wire.system_prompt = input.systemPrompt;
	}
	if (input.memoryEnabled !== undefined) {
		wire.memory_enabled = input.memoryEnabled;
	}
	if (input.thinkingEnabled !== undefined) {
		wire.thinking_enabled = input.thinkingEnabled;
	}
	if (input.replyToId !== undefined) {
		wire.reply_to_id = input.replyToId;
	}
	if (input.operationId !== undefined) {
		wire.operation_id = input.operationId;
	}
	if (input.skillName !== undefined) {
		wire.skill_name = input.skillName;
	}
	if (input.skillScope !== undefined) {
		wire.skill_scope = input.skillScope;
	}
	if (input.skillCommandText !== undefined) {
		wire.skill_command_text = input.skillCommandText;
	}
	return wire;
}

function chatSyncRequestWire(request: UniverseAgentChatSyncRequest): Record<string, unknown> {
	const wire: Record<string, unknown> = {
		session_id: request.sessionId,
		agent_id: request.agentId,
		last_known_message_ids: request.lastKnownMessageIds ?? [],
		idempotency_key: request.idempotencyKey ?? '',
	};
	if (request.timeoutSeconds !== undefined) {
		wire.timeout_seconds = request.timeoutSeconds;
	}
	if (request.sessionInput) {
		wire.session_input = chatSyncSessionInputWire(request.sessionInput);
	}
	return wire;
}

function mapChatSyncToolResult(item: {
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

function mapChatSyncInputDeliveryEvent(item: {
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

function mapChatSyncResponse(wire: {
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

function syncInputDeliveryRequestWire(request: UniverseAgentSyncInputDeliveryRequest): Record<string, unknown> {
	return {
		session_id: request.sessionId,
		last_known_message_ids: request.lastKnownMessageIds ?? [],
	};
}

function mapSyncInputDeliveryResponse(wire: {
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

function mapGetHistoryResponse(wire: GetHistoryResponseWire): UniverseAgentGetHistoryResult {
	return {
		envelopes: (wire.envelopes ?? []).map(envelope => ({
			cursorSeq: envelope.cursor_seq ?? '',
			payload: envelope.payload !== undefined && envelope.payload !== null ? envelope.payload : envelope,
		})),
		nextCursorSeq: wire.next_cursor_seq,
	};
}

interface ListSkillsResponseWire {
	skills?: Array<{
		name?: string;
		description?: string;
		source?: string;
		enabled?: boolean;
		slash_enabled?: boolean;
	}>;
}

interface SetSkillEnabledResponseWire {
	ok?: boolean;
	reason?: string;
}

interface SaveSkillContentResponseWire {
	ok?: boolean;
	reason?: string;
}

interface SkillInfoResponseWire {
	name?: string;
	content?: string;
	source?: string;
	enabled?: boolean;
}

function mapSkillSource(source: string | undefined): UniverseAgentSkillSource {
	switch (source?.toLowerCase()) {
		case 'bundled':
			return 'bundled';
		case 'user':
			return 'user';
		case 'project':
			return 'project';
		default:
			return 'unknown';
	}
}

function mapSkillSummary(wire: NonNullable<ListSkillsResponseWire['skills']>[number]): UniverseAgentSkillSummary {
	return {
		name: wire.name ?? '',
		description: wire.description,
		source: mapSkillSource(wire.source),
		enabled: wire.enabled === true,
		slashEnabled: wire.slash_enabled,
	};
}

function mapListSkillsResponse(wire: ListSkillsResponseWire): UniverseAgentListSkillsResult {
	return {
		skills: (wire.skills ?? []).map(mapSkillSummary),
	};
}

function mapSetSkillEnabledResponse(wire: SetSkillEnabledResponseWire): UniverseAgentSetSkillEnabledResult {
	return {
		ok: wire.ok === true,
		reason: wire.reason,
	};
}

function mapSaveSkillContentResponse(wire: SaveSkillContentResponseWire): UniverseAgentSaveSkillContentResult {
	return {
		ok: wire.ok === true,
		reason: wire.reason,
	};
}

function mapSkillInfoResponse(wire: SkillInfoResponseWire): UniverseAgentSkillInfoResult {
	return {
		name: wire.name ?? '',
		content: wire.content ?? '',
		source: mapSkillSource(wire.source),
		enabled: wire.enabled === true,
	};
}

interface ListAgentProfilesResponseWire {
	profiles?: Array<{
		id?: string;
		name?: string;
		source?: string;
		summary?: string;
		enabled?: boolean;
		disabled_tools?: string[];
		enabled_tools?: string[];
		whitelist_mode?: boolean;
		description?: string;
		system_prompt?: string;
		permission_mode?: string;
		usage?: string;
		detail_level?: string;
		builtin_default?: boolean;
	}>;
}

function mapAgentProfileSource(source: string | undefined): UniverseAgentAgentProfileSource {
	switch (source?.toLowerCase()) {
		case 'built_in':
		case 'builtin':
			return 'built_in';
		case 'user':
			return 'user';
		case 'project':
			return 'project';
		default:
			return 'unknown';
	}
}

function mapAgentProfileSourceToWire(source: UniverseAgentAgentProfileSource | undefined): string | undefined {
	if (!source) {
		return undefined;
	}
	switch (source) {
		case 'built_in':
			return 'BUILT_IN';
		case 'user':
			return 'USER';
		case 'project':
			return 'PROJECT';
		default:
			return undefined;
	}
}

function mapAgentProfileDetail(wire: NonNullable<ListAgentProfilesResponseWire['profiles']>[number]): UniverseAgentAgentProfileDetail {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		description: wire.description,
		systemPrompt: wire.system_prompt,
		disabledTools: wire.disabled_tools,
		enabledTools: wire.enabled_tools,
		permissionMode: wire.permission_mode,
		summary: wire.summary,
		usage: wire.usage,
		detailLevel: wire.detail_level,
		source: mapAgentProfileSource(wire.source),
		enabled: wire.enabled,
		whitelistMode: wire.whitelist_mode,
		builtinDefault: wire.builtin_default,
	};
}

function mapAgentProfileSummary(wire: NonNullable<ListAgentProfilesResponseWire['profiles']>[number]): UniverseAgentAgentProfileSummary {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		source: mapAgentProfileSource(wire.source),
		summary: wire.summary,
		enabled: wire.enabled,
		disabledTools: wire.disabled_tools,
		enabledTools: wire.enabled_tools,
		whitelistMode: wire.whitelist_mode,
	};
}

function mapAgentProfileDetailToWire(profile: UniverseAgentAgentProfileDetail): Record<string, unknown> {
	const wire: Record<string, unknown> = {
		id: profile.id,
		name: profile.name,
	};
	if (profile.description !== undefined) {
		wire.description = profile.description;
	}
	if (profile.systemPrompt !== undefined) {
		wire.system_prompt = profile.systemPrompt;
	}
	if (profile.disabledTools !== undefined) {
		wire.disabled_tools = [...profile.disabledTools];
	}
	if (profile.enabledTools !== undefined) {
		wire.enabled_tools = [...profile.enabledTools];
	}
	if (profile.permissionMode !== undefined) {
		wire.permission_mode = profile.permissionMode;
	}
	if (profile.summary !== undefined) {
		wire.summary = profile.summary;
	}
	if (profile.usage !== undefined) {
		wire.usage = profile.usage;
	}
	if (profile.detailLevel !== undefined) {
		wire.detail_level = profile.detailLevel;
	}
	const source = mapAgentProfileSourceToWire(profile.source);
	if (source !== undefined) {
		wire.source = source;
	}
	if (profile.enabled !== undefined) {
		wire.enabled = profile.enabled;
	}
	if (profile.whitelistMode !== undefined) {
		wire.whitelist_mode = profile.whitelistMode;
	}
	if (profile.builtinDefault !== undefined) {
		wire.builtin_default = profile.builtinDefault;
	}
	return wire;
}

function mapListAgentProfilesResponse(wire: ListAgentProfilesResponseWire): UniverseAgentListAgentProfilesResult {
	return {
		profiles: (wire.profiles ?? []).map(mapAgentProfileSummary),
	};
}

interface SaveAgentProfileResponseWire {
	profile?: ListAgentProfilesResponseWire['profiles'] extends (infer T)[] | undefined ? T : never;
}

function mapSaveAgentProfileResponse(wire: SaveAgentProfileResponseWire): UniverseAgentSaveAgentProfileResult {
	const profileWire = wire.profile;
	if (!profileWire) {
		return { profile: { id: '', name: '' } };
	}
	return { profile: mapAgentProfileDetail(profileWire) };
}

interface DeleteAgentProfileResponseWire {
	success?: boolean;
}

function mapDeleteAgentProfileResponse(wire: DeleteAgentProfileResponseWire): UniverseAgentDeleteAgentProfileResult {
	return { ok: wire.success === true };
}

interface ResetAgentProfileResponseWire {
	success?: boolean;
	profile?: NonNullable<ListAgentProfilesResponseWire['profiles']>[number];
}

function mapResetAgentProfileResponse(wire: ResetAgentProfileResponseWire): UniverseAgentResetAgentProfileResult {
	return {
		ok: wire.success === true,
		profile: wire.profile ? mapAgentProfileDetail(wire.profile) : undefined,
	};
}

function mapMcpTransportToWire(transport: UniverseAgentMcpTransport): string {
	switch (transport) {
		case 'stdio':
			return 'STDIO';
		case 'sse':
			return 'SSE';
		case 'streamable_http':
			return 'STREAMABLE_HTTP';
		default:
			return 'STDIO';
	}
}

function mapMcpServerConfigToWire(config: UniverseAgentMcpServerConfig): Record<string, unknown> {
	const wire: Record<string, unknown> = {
		name: config.name,
		transport: mapMcpTransportToWire(config.transport),
	};
	if (config.id !== undefined) {
		wire.id = config.id;
	}
	if (config.command !== undefined) {
		wire.command = config.command;
	}
	if (config.args !== undefined) {
		wire.args = [...config.args];
	}
	if (config.env !== undefined) {
		wire.env = { ...config.env };
	}
	if (config.url !== undefined) {
		wire.url = config.url;
	}
	if (config.enabled !== undefined) {
		wire.enabled = config.enabled;
	}
	return wire;
}

function mapMcpServerConfigFromWire(wire: Record<string, unknown> | undefined): UniverseAgentMcpServerConfig | undefined {
	if (!wire) {
		return undefined;
	}
	return {
		id: typeof wire.id === 'string' ? wire.id : undefined,
		name: typeof wire.name === 'string' ? wire.name : '',
		transport: mapMcpTransport(typeof wire.transport === 'string' ? wire.transport : undefined),
		command: typeof wire.command === 'string' ? wire.command : undefined,
		args: Array.isArray(wire.args) ? wire.args.filter((arg): arg is string => typeof arg === 'string') : undefined,
		env: wire.env && typeof wire.env === 'object' ? wire.env as Record<string, string> : undefined,
		url: typeof wire.url === 'string' ? wire.url : undefined,
		enabled: wire.enabled === true,
	};
}

interface AddMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	assigned_id?: string;
}

function mapAddMcpServerResponse(wire: AddMcpServerResponseWire): UniverseAgentAddMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		assignedId: wire.assigned_id,
	};
}

interface UpdateMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	updated_config?: Record<string, unknown>;
}

function mapUpdateMcpServerResponse(wire: UpdateMcpServerResponseWire): UniverseAgentUpdateMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		config: mapMcpServerConfigFromWire(wire.updated_config),
	};
}

interface RemoveMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	removed_name?: string;
}

function mapRemoveMcpServerResponse(wire: RemoveMcpServerResponseWire): UniverseAgentRemoveMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		removedName: wire.removed_name,
	};
}

interface ListMcpServersResponseWire {
	servers?: Array<{
		id?: string;
		name?: string;
		transport?: string;
		origin?: string;
		enabled?: boolean;
		effective_enabled?: boolean;
		has_project_override?: boolean;
	}>;
}

function mapMcpOrigin(origin: string | undefined): UniverseAgentMcpServerOrigin {
	switch (origin?.toLowerCase()) {
		case 'global':
			return 'global';
		case 'project':
			return 'project';
		default:
			return 'unknown';
	}
}

function mapMcpTransport(transport: string | undefined): UniverseAgentMcpTransport {
	switch (transport?.toLowerCase()) {
		case 'stdio':
			return 'stdio';
		case 'sse':
			return 'sse';
		case 'streamable_http':
			return 'streamable_http';
		default:
			return 'unknown';
	}
}

function mapMcpServerSummary(wire: NonNullable<ListMcpServersResponseWire['servers']>[number]): UniverseAgentMcpServerSummary {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		transport: mapMcpTransport(wire.transport),
		origin: mapMcpOrigin(wire.origin),
		enabled: wire.enabled === true,
		effectiveEnabled: wire.effective_enabled,
		hasProjectOverride: wire.has_project_override,
	};
}

function mapListMcpServersResponse(wire: ListMcpServersResponseWire): UniverseAgentListMcpServersResult {
	return {
		servers: (wire.servers ?? []).map(mapMcpServerSummary),
	};
}

function readEpochMs(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
		return value;
	}
	if (typeof value === 'string' && value) {
		const parsed = Number(value);
		if (Number.isFinite(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return undefined;
}

function mapMcpRuntimeStatus(status: unknown): UniverseAgentMcpRuntimeStatus {
	if (typeof status === 'number') {
		switch (status) {
			case 1:
				return 'disconnected';
			case 2:
				return 'connecting';
			case 3:
				return 'connected';
			case 4:
				return 'error';
			default:
				return 'failed';
		}
	}
	const normalized = String(status ?? '').toUpperCase();
	if (normalized === 'MCP_STATUS_DISCONNECTED' || normalized === 'DISCONNECTED') {
		return 'disconnected';
	}
	if (normalized === 'MCP_STATUS_CONNECTING' || normalized === 'CONNECTING') {
		return 'connecting';
	}
	if (normalized === 'MCP_STATUS_CONNECTED' || normalized === 'CONNECTED') {
		return 'connected';
	}
	if (normalized === 'MCP_STATUS_ERROR' || normalized === 'ERROR') {
		return 'error';
	}
	return 'failed';
}

interface GetMcpServerStatusesResponseWire {
	statuses?: Array<{
		server_id?: string;
		status?: unknown;
		error_message?: string;
		last_connected_at?: number | string;
	}>;
	checked_at?: number | string;
}

function mapMcpServerStatus(wire: NonNullable<GetMcpServerStatusesResponseWire['statuses']>[number]): UniverseAgentMcpServerStatus {
	return {
		serverId: wire.server_id ?? '',
		status: mapMcpRuntimeStatus(wire.status),
		errorMessage: wire.error_message,
		lastConnectedAt: readEpochMs(wire.last_connected_at),
	};
}

function mapGetMcpServerStatusesResponse(wire: GetMcpServerStatusesResponseWire): UniverseAgentGetMcpServerStatusesResult {
	return {
		statuses: (wire.statuses ?? []).map(mapMcpServerStatus),
		checkedAt: readEpochMs(wire.checked_at),
	};
}

interface GetMcpServerToolsResponseWire {
	tools?: Array<{
		name?: string;
		description?: string;
		input_schema_json?: string;
	}>;
	total?: number;
	cached_at?: number | string;
}

function mapMcpToolDefinition(wire: NonNullable<GetMcpServerToolsResponseWire['tools']>[number]): UniverseAgentMcpToolDefinition {
	return {
		name: wire.name ?? '',
		description: wire.description,
		inputSchemaJson: wire.input_schema_json,
	};
}

function mapGetMcpServerToolsResponse(wire: GetMcpServerToolsResponseWire): UniverseAgentGetMcpServerToolsResult {
	return {
		tools: (wire.tools ?? []).map(mapMcpToolDefinition),
		total: wire.total,
		cachedAt: readEpochMs(wire.cached_at),
	};
}

function mapPluginStatus(status: unknown): UniverseAgentPluginStatus {
	if (typeof status === 'number') {
		switch (status) {
			case 0:
				return 'active';
			case 1:
				return 'disabled';
			case 2:
				return 'error';
			default:
				return 'unknown';
		}
	}
	const normalized = String(status ?? '').toUpperCase();
	if (normalized === 'PLUGIN_ACTIVE' || normalized === 'ACTIVE') {
		return 'active';
	}
	if (normalized === 'PLUGIN_DISABLED' || normalized === 'DISABLED') {
		return 'disabled';
	}
	if (normalized === 'PLUGIN_ERROR' || normalized === 'ERROR') {
		return 'error';
	}
	return 'unknown';
}

interface PluginSummaryWire {
	id?: string;
	display_name?: string;
	version?: string;
	source?: string;
	hook_count?: number;
	status?: unknown;
	loaded_at?: number | string;
}

function mapPluginSummary(wire: PluginSummaryWire | undefined): UniverseAgentPluginSummary {
	return {
		id: wire?.id ?? '',
		displayName: wire?.display_name ?? '',
		version: wire?.version ?? '',
		source: wire?.source ?? '',
		hookCount: wire?.hook_count ?? 0,
		status: mapPluginStatus(wire?.status),
		loadedAt: readEpochMs(wire?.loaded_at),
	};
}

interface ListPluginsResponseWire {
	plugins?: PluginSummaryWire[];
}

function mapListPluginsResponse(wire: ListPluginsResponseWire): UniverseAgentListPluginsResult {
	return {
		plugins: (wire.plugins ?? []).map(mapPluginSummary),
	};
}

interface PluginHookEntryWire {
	hook_type?: string;
	priority?: number;
	class_name?: string;
}

interface PluginInfoResponseWire {
	summary?: PluginSummaryWire;
	hooks?: PluginHookEntryWire[];
	config?: Record<string, string>;
	error_message?: string;
}

function mapPluginHookEntry(wire: PluginHookEntryWire): UniverseAgentPluginHookEntry {
	return {
		hookType: wire.hook_type ?? '',
		priority: wire.priority ?? 0,
		className: wire.class_name ?? '',
	};
}

function mapPluginInfoResponse(wire: PluginInfoResponseWire): UniverseAgentPluginInfoResult {
	return {
		summary: mapPluginSummary(wire.summary),
		hooks: (wire.hooks ?? []).map(mapPluginHookEntry),
		config: wire.config,
		errorMessage: wire.error_message,
	};
}

interface EnablePluginResponseWire {
	plugin?: PluginSummaryWire;
}

interface ReloadPluginResponseWire {
	plugin?: PluginSummaryWire;
}

interface UnloadPluginResponseWire {
	removed_hook_count?: number;
}

interface ScanNewPluginsResponseWire {
	new_plugins?: PluginSummaryWire[];
	skipped_count?: number;
}

interface ToggleMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
}

function mapToggleMcpServerResponse(wire: ToggleMcpServerResponseWire): UniverseAgentToggleMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
	};
}

interface ListToolsResponseWire {
	tools?: Array<{
		name?: string;
		description?: string;
		category?: string;
		destructive?: boolean;
		requires_permission?: boolean;
	}>;
}

function mapToolSummary(wire: NonNullable<ListToolsResponseWire['tools']>[number]): UniverseAgentToolSummary {
	return {
		name: wire.name ?? '',
		description: wire.description,
		category: wire.category,
		destructive: wire.destructive,
		requiresPermission: wire.requires_permission,
	};
}

function mapListToolsResponse(wire: ListToolsResponseWire): UniverseAgentListToolsResult {
	return {
		tools: (wire.tools ?? []).map(mapToolSummary),
	};
}

interface ToolInfoResponseWire {
	name?: string;
	description?: string;
	category?: string;
	input_schema_json?: string;
	destructive?: boolean;
	requires_permission?: boolean;
	aliases?: string[];
}

function mapToolInfoResponse(wire: ToolInfoResponseWire): UniverseAgentToolInfoResult {
	return {
		name: wire.name ?? '',
		description: wire.description,
		category: wire.category,
		inputSchemaJson: wire.input_schema_json,
		destructive: wire.destructive,
		requiresPermission: wire.requires_permission,
		aliases: wire.aliases ?? [],
	};
}

interface ListCommandsResponseWire {
	commands?: Array<{
		name?: string;
		description?: string;
		source?: string | number;
		slash_enabled?: boolean;
		agent?: string;
		model?: string;
		subtask?: boolean;
		skill_source?: string;
	}>;
	total?: number;
}

const SlashCommandSourceByNumber: Record<number, UniverseAgentSlashCommandSource> = {
	0: 'SLASH_COMMAND_SOURCE_UNSPECIFIED',
	1: 'SLASH_COMMAND_SOURCE_SKILL',
	2: 'SLASH_COMMAND_SOURCE_CONFIG',
	3: 'SLASH_COMMAND_SOURCE_BUILTIN',
	4: 'SLASH_COMMAND_SOURCE_MCP',
};

function mapSlashCommandSource(value: string | number | undefined): UniverseAgentSlashCommandSource {
	return mapRuleEnum(value, SlashCommandSourceByNumber) as UniverseAgentSlashCommandSource;
}

function mapCommandSummary(wire: NonNullable<ListCommandsResponseWire['commands']>[number]): UniverseAgentCommandSummary {
	return {
		name: wire.name ?? '',
		description: wire.description,
		source: mapSlashCommandSource(wire.source),
		slashEnabled: wire.slash_enabled === true,
		agent: wire.agent ?? '',
		model: wire.model ?? '',
		subtask: wire.subtask === true,
		skillSource: wire.skill_source ?? '',
	};
}

function mapListCommandsResponse(wire: ListCommandsResponseWire): UniverseAgentListCommandsResult {
	return {
		commands: (wire.commands ?? []).map(mapCommandSummary),
		total: wire.total ?? 0,
	};
}

interface GetCommandDefResponseWire {
	name?: string;
	description?: string;
	source?: string | number;
	template?: string;
	agent?: string;
	model?: string;
	subtask?: boolean;
	mcp_server_id?: string;
	mcp_prompt_name?: string;
	mcp_argument_names?: string[];
	skill_source?: string;
}

function mapGetCommandDefResponse(wire: GetCommandDefResponseWire): UniverseAgentGetCommandDefResult {
	return {
		name: wire.name ?? '',
		description: wire.description,
		source: mapSlashCommandSource(wire.source),
		template: wire.template ?? '',
		agent: wire.agent ?? '',
		model: wire.model ?? '',
		subtask: wire.subtask === true,
		mcpServerId: wire.mcp_server_id ?? '',
		mcpPromptName: wire.mcp_prompt_name ?? '',
		mcpArgumentNames: wire.mcp_argument_names ?? [],
		skillSource: wire.skill_source ?? '',
	};
}

interface ListFilesResponseWire {
	entries?: Array<{
		name?: string;
		path?: string;
		is_directory?: boolean;
		size?: number | string;
		last_modified?: number | string;
		mime_type?: string;
	}>;
	total?: number;
}

function mapFileEntry(wire: NonNullable<ListFilesResponseWire['entries']>[number]): UniverseAgentFileEntry {
	return {
		name: wire.name ?? '',
		path: wire.path ?? '',
		isDirectory: wire.is_directory === true,
		size: requiredInt64(wire.size),
		lastModified: requiredInt64(wire.last_modified),
		mimeType: wire.mime_type ?? '',
	};
}

function mapListFilesResponse(wire: ListFilesResponseWire): UniverseAgentListFilesResult {
	return {
		entries: (wire.entries ?? []).map(mapFileEntry),
		total: wire.total ?? 0,
	};
}

interface ReadFileResponseWire {
	content?: string;
	total_size?: number | string;
	mime_type?: string;
	line_count?: number | string;
	content_hash?: string;
}

function mapReadFileResponse(wire: ReadFileResponseWire): UniverseAgentReadFileResult {
	return {
		content: base64ToBytes(wire.content),
		totalSize: requiredInt64(wire.total_size),
		mimeType: wire.mime_type ?? '',
		lineCount: requiredInt64(wire.line_count),
		contentHash: wire.content_hash ?? '',
	};
}

interface GetFileInfoResponseWire {
	file?: NonNullable<ListFilesResponseWire['entries']>[number];
}

function mapGetFileInfoResponse(wire: GetFileInfoResponseWire): UniverseAgentGetFileInfoResult {
	return {
		file: mapFileEntry(wire.file ?? {}),
	};
}

interface WriteFileResponseWire {
	status?: string | number;
	new_hash?: string;
	size?: number | string;
	modified_at?: number | string;
	current_content?: string;
	current_hash?: string;
	merged_content?: string;
}

const WriteFileStatusByNumber: Record<number, UniverseAgentWriteFileStatus> = {
	0: 'SAVED',
	1: 'MERGED',
	2: 'CONFLICT',
};

function mapWriteFileStatus(value: string | number | undefined): UniverseAgentWriteFileStatus {
	if (typeof value === 'number') {
		return WriteFileStatusByNumber[value] ?? 'SAVED';
	}
	if (value === 'MERGED' || value === 'CONFLICT' || value === 'SAVED') {
		return value;
	}
	return 'SAVED';
}

function mapWriteFileResponse(wire: WriteFileResponseWire): UniverseAgentWriteFileResult {
	return {
		status: mapWriteFileStatus(wire.status),
		newHash: wire.new_hash ?? '',
		size: requiredInt64(wire.size),
		modifiedAt: requiredInt64(wire.modified_at),
		currentContent: base64ToBytes(wire.current_content),
		currentHash: wire.current_hash ?? '',
		mergedContent: base64ToBytes(wire.merged_content),
	};
}

interface AgentMergeResponseWire {
	accepted?: boolean;
}

function mapAgentMergeResponse(wire: AgentMergeResponseWire): UniverseAgentAgentMergeResult {
	return {
		accepted: wire.accepted === true,
	};
}

interface ReadGitSummaryResponseWire {
	supported?: boolean;
	reason?: string;
	branch?: string;
	change_count?: number | string;
}

function mapReadGitSummaryResponse(wire: ReadGitSummaryResponseWire): UniverseAgentReadGitSummaryResult {
	return {
		supported: wire.supported === true,
		reason: wire.reason ?? '',
		branch: wire.branch ?? '',
		changeCount: requiredInt64(wire.change_count),
	};
}

interface GitChangeEntryWire {
	path?: string;
	old_path?: string;
	kind?: string;
	index_state?: string;
}

interface ReadGitChangesResponseWire {
	supported?: boolean;
	reason?: string;
	branch?: string;
	entries?: GitChangeEntryWire[];
}

function mapGitChangeEntry(wire: GitChangeEntryWire): UniverseAgentGitChangeEntry {
	return {
		path: wire.path ?? '',
		oldPath: wire.old_path ?? '',
		kind: wire.kind ?? '',
		indexState: wire.index_state ?? '',
	};
}

function mapReadGitChangesResponse(wire: ReadGitChangesResponseWire): UniverseAgentReadGitChangesResult {
	return {
		supported: wire.supported === true,
		reason: wire.reason ?? '',
		branch: wire.branch ?? '',
		entries: (wire.entries ?? []).map(mapGitChangeEntry),
	};
}

interface ReadGitFileDiffResponseWire {
	supported?: boolean;
	reason?: string;
	path?: string;
	unified_diff?: string;
}

function mapReadGitFileDiffResponse(wire: ReadGitFileDiffResponseWire): UniverseAgentReadGitFileDiffResult {
	return {
		supported: wire.supported === true,
		reason: wire.reason ?? '',
		path: wire.path ?? '',
		unifiedDiff: wire.unified_diff ?? '',
	};
}

interface WriteGitWriteResponseWire {
	supported?: boolean;
	reason?: string;
	success?: boolean;
	error_message?: string;
	exit_code?: number | string;
	stdout?: string;
}

function mapWriteGitWriteResponse(wire: WriteGitWriteResponseWire): UniverseAgentWriteGitWriteResult {
	return {
		supported: wire.supported === true,
		reason: wire.reason ?? '',
		success: wire.success === true,
		errorMessage: wire.error_message ?? '',
		exitCode: requiredInt64(wire.exit_code),
		stdout: wire.stdout ?? '',
	};
}

interface TokenUsageDataWire {
	input_tokens?: number | string;
	output_tokens?: number | string;
	thinking_tokens?: number | string;
	cache_read_tokens?: number | string;
	cache_write_tokens?: number | string;
	total_cost_micros?: number | string;
	currency?: string;
	request_count?: number | string;
}

interface GetSessionUsageResponseWire {
	usage?: TokenUsageDataWire;
}

interface GetGlobalUsageResponseWire {
	usage?: TokenUsageDataWire;
}

function mapTokenUsageData(wire: TokenUsageDataWire | undefined): UniverseAgentTokenUsageData {
	return {
		inputTokens: requiredInt64(wire?.input_tokens),
		outputTokens: requiredInt64(wire?.output_tokens),
		thinkingTokens: requiredInt64(wire?.thinking_tokens),
		cacheReadTokens: requiredInt64(wire?.cache_read_tokens),
		cacheWriteTokens: requiredInt64(wire?.cache_write_tokens),
		totalCostMicros: requiredInt64(wire?.total_cost_micros),
		currency: wire?.currency ?? '',
		requestCount: requiredInt64(wire?.request_count),
	};
}

function mapGetSessionUsageResponse(wire: GetSessionUsageResponseWire): UniverseAgentGetSessionUsageResult {
	return {
		usage: mapTokenUsageData(wire.usage ?? {}),
	};
}

function mapGetGlobalUsageResponse(wire: GetGlobalUsageResponseWire): UniverseAgentGetGlobalUsageResult {
	return {
		usage: mapTokenUsageData(wire.usage),
	};
}

interface MemorySaveResponseWire {
	success?: boolean;
	message?: string;
	file_path?: string;
}

function mapMemorySaveResponse(wire: MemorySaveResponseWire): UniverseAgentSaveMemoryResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
		filePath: wire.file_path ?? '',
	};
}

interface MemorySearchResultWire {
	category?: string;
	filename?: string;
	title?: string;
	score?: number | string;
	snippet?: string;
	forgot?: boolean;
	scope?: string;
}

interface MemorySearchResponseWire {
	results?: MemorySearchResultWire[];
}

function requiredDouble(value: number | string | undefined): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

function mapMemorySearchEntry(wire: MemorySearchResultWire): UniverseAgentMemorySearchEntry {
	return {
		category: wire.category ?? '',
		filename: wire.filename ?? '',
		title: wire.title ?? '',
		score: requiredDouble(wire.score),
		snippet: wire.snippet ?? '',
		forgot: wire.forgot === true,
		scope: wire.scope ?? '',
	};
}

function mapMemorySearchResponse(wire: MemorySearchResponseWire): UniverseAgentMemorySearchResult {
	return {
		results: (wire.results ?? []).map(mapMemorySearchEntry),
	};
}

interface MemorySearchDeepResponseWire {
	results?: MemorySearchResultWire[];
	searched_categories?: Array<string | undefined>;
}

function mapMemorySearchDeepResponse(wire: MemorySearchDeepResponseWire): UniverseAgentMemorySearchDeepResult {
	return {
		results: (wire.results ?? []).map(mapMemorySearchEntry),
		searchedCategories: (wire.searched_categories ?? []).map(category => category ?? ''),
	};
}

interface MemoryFileMetadataWire {
	category?: string;
	filename?: string;
	title?: string;
	tags?: string[];
	created_at?: number | string;
	updated_at?: number | string;
	version?: number | string;
}

interface MemoryReadResponseWire {
	content?: string;
	metadata?: MemoryFileMetadataWire;
}

function mapMemoryFileMetadata(wire: MemoryFileMetadataWire | undefined): UniverseAgentMemoryFileMetadata {
	return {
		category: wire?.category ?? '',
		filename: wire?.filename ?? '',
		title: wire?.title ?? '',
		tags: [...(wire?.tags ?? [])],
		createdAt: requiredInt64(wire?.created_at),
		updatedAt: requiredInt64(wire?.updated_at),
		version: requiredInt64(wire?.version),
	};
}

function mapMemoryReadResponse(wire: MemoryReadResponseWire): UniverseAgentReadMemoryResult {
	return {
		content: wire.content ?? '',
		metadata: mapMemoryFileMetadata(wire.metadata),
	};
}

interface MemoryFileSummaryWire {
	filename?: string;
	title?: string;
	updated_at?: number | string;
}

interface MemoryCategoryInfoWire {
	category?: string;
	files?: MemoryFileSummaryWire[];
	file_count?: number | string;
}

interface MemoryListResponseWire {
	categories?: MemoryCategoryInfoWire[];
}

function mapMemoryFileSummary(wire: MemoryFileSummaryWire): UniverseAgentMemoryFileSummary {
	return {
		filename: wire.filename ?? '',
		title: wire.title ?? '',
		updatedAt: requiredInt64(wire.updated_at),
	};
}

function mapMemoryCategoryInfo(wire: MemoryCategoryInfoWire): UniverseAgentMemoryCategoryInfo {
	return {
		category: wire.category ?? '',
		files: (wire.files ?? []).map(mapMemoryFileSummary),
		fileCount: requiredInt64(wire.file_count),
	};
}

function mapMemoryListResponse(wire: MemoryListResponseWire): UniverseAgentMemoryListResult {
	return {
		categories: (wire.categories ?? []).map(mapMemoryCategoryInfo),
	};
}

interface MemoryDeleteResponseWire {
	success?: boolean;
	message?: string;
}

function mapMemoryDeleteResponse(wire: MemoryDeleteResponseWire): UniverseAgentDeleteMemoryResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

interface MemoryReflectDiagnosisWire {
	type?: string;
	category?: string;
	filename?: string;
	description?: string;
	suggestion?: string;
}

interface MemoryReflectResponseWire {
	diagnoses?: MemoryReflectDiagnosisWire[];
	summary?: string;
}

function mapMemoryReflectDiagnosis(wire: MemoryReflectDiagnosisWire): UniverseAgentMemoryReflectDiagnosis {
	return {
		type: wire.type ?? '',
		category: wire.category ?? '',
		filename: wire.filename ?? '',
		description: wire.description ?? '',
		suggestion: wire.suggestion ?? '',
	};
}

function mapMemoryReflectResponse(wire: MemoryReflectResponseWire): UniverseAgentReflectMemoryResult {
	return {
		diagnoses: (wire.diagnoses ?? []).map(mapMemoryReflectDiagnosis),
		summary: wire.summary ?? '',
	};
}

interface MemoryRebuildEventWire {
	phase?: string;
	message?: string;
	progress?: number | string;
	files_processed?: number | string;
	files_total?: number | string;
}

function mapMemoryRebuildEvent(wire: MemoryRebuildEventWire): UniverseAgentMemoryRebuildEvent {
	return {
		phase: wire.phase ?? '',
		message: wire.message ?? '',
		progress: requiredInt64(wire.progress),
		filesProcessed: requiredInt64(wire.files_processed),
		filesTotal: requiredInt64(wire.files_total),
	};
}

interface MemoryRevertResponseWire {
	success?: boolean;
	message?: string;
	reverted_to_version?: number | string;
}

function mapMemoryRevertResponse(wire: MemoryRevertResponseWire): UniverseAgentRevertMemoryResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
		revertedToVersion: requiredInt64(wire.reverted_to_version),
	};
}

interface MemoryChangeEntryWire {
	version?: number | string;
	change_type?: string;
	summary?: string;
	timestamp?: number | string;
	author?: string;
}

interface MemoryHistoryResponseWire {
	changes?: MemoryChangeEntryWire[];
}

function mapMemoryChangeEntry(wire: MemoryChangeEntryWire): UniverseAgentMemoryChangeEntry {
	return {
		version: requiredInt64(wire.version),
		changeType: wire.change_type ?? '',
		summary: wire.summary ?? '',
		timestamp: requiredInt64(wire.timestamp),
		author: wire.author ?? '',
	};
}

function mapMemoryHistoryResponse(wire: MemoryHistoryResponseWire): UniverseAgentMemoryHistoryResult {
	return {
		changes: (wire.changes ?? []).map(mapMemoryChangeEntry),
	};
}

const ContextVariableScopeByNumber: Record<number, UniverseAgentContextVariableScope> = {
	0: 'VARIABLE_GLOBAL',
	1: 'VARIABLE_LOCAL',
};

function mapContextVariableScope(value: string | number | undefined): UniverseAgentContextVariableScope {
	if (typeof value === 'number') {
		return ContextVariableScopeByNumber[value] ?? 'VARIABLE_GLOBAL';
	}
	if (value === 'VARIABLE_LOCAL' || value === 'VARIABLE_GLOBAL') {
		return value;
	}
	return 'VARIABLE_GLOBAL';
}

interface ContextVariableEntrySummaryWire {
	name?: string;
	scope?: string | number;
	updated_by?: string;
	updated_at?: number | string;
	content_preview?: string;
}

interface ContextVariableListResponseWire {
	current?: ContextVariableEntrySummaryWire[];
	inherited?: ContextVariableEntrySummaryWire[];
}

function mapContextVariableEntrySummary(wire: ContextVariableEntrySummaryWire): UniverseAgentContextVariableEntrySummary {
	return {
		name: wire.name ?? '',
		scope: mapContextVariableScope(wire.scope),
		updatedBy: wire.updated_by ?? '',
		updatedAt: requiredInt64(wire.updated_at),
		contentPreview: wire.content_preview ?? '',
	};
}

function mapContextVariableListResponse(wire: ContextVariableListResponseWire): UniverseAgentContextVariableListResult {
	return {
		current: (wire.current ?? []).map(mapContextVariableEntrySummary),
		inherited: (wire.inherited ?? []).map(mapContextVariableEntrySummary),
	};
}

interface ContextVariableEntryWire {
	name?: string;
	content?: string;
	scope?: string | number;
	updated_by?: string;
	updated_at?: number | string;
}

interface ContextVariableReadResponseWire {
	entry?: ContextVariableEntryWire;
}

function mapContextVariableEntry(wire: ContextVariableEntryWire | undefined): UniverseAgentContextVariableEntry {
	return {
		name: wire?.name ?? '',
		content: wire?.content ?? '',
		scope: mapContextVariableScope(wire?.scope),
		updatedBy: wire?.updated_by ?? '',
		updatedAt: requiredInt64(wire?.updated_at),
	};
}

function mapContextVariableReadResponse(wire: ContextVariableReadResponseWire): UniverseAgentContextVariableReadResult {
	return {
		entry: mapContextVariableEntry(wire.entry),
	};
}

interface RemoteAgentModelInfoWire {
	id?: string;
	name?: string;
	provider?: string;
	max_tokens?: number | string;
	enabled?: boolean;
}

interface RemoteAgentCapabilitiesWire {
	models?: RemoteAgentModelInfoWire[];
	tools?: string[];
	modes?: string[];
	server_version?: string;
	protocol_version?: string;
	properties?: { [key: string]: string };
}

interface RemoteAgentLoadMetricsWire {
	active_sessions?: number | string;
	queue_depth?: number | string;
	cpu_percent?: number | string;
	memory_used_mb?: number | string;
}

interface RemoteAgentInfoWire {
	id?: string;
	name?: string;
	description?: string;
	status?: string;
	endpoint?: string;
	tags?: string[];
	capabilities?: RemoteAgentCapabilitiesWire;
	load?: RemoteAgentLoadMetricsWire;
	last_heartbeat_at?: number | string;
}

interface ListNodesResponseWire {
	nodes?: RemoteAgentInfoWire[];
	total?: number | string;
	online_count?: number | string;
}

interface ValidationErrorWire {
	code?: string | number;
	field?: string;
	message?: string;
	suggestion?: string;
}

interface ConnectionReportWire {
	reachable?: boolean;
	authenticated?: boolean;
	can_create_session?: boolean;
	latency_ms?: number | string;
	capabilities?: RemoteAgentCapabilitiesWire;
	errors?: ValidationErrorWire[];
	load?: RemoteAgentLoadMetricsWire;
}

const ConnectionErrorCodeByNumber: Record<number, string> = {
	0: 'ERROR_CODE_UNSPECIFIED',
	1: 'CONNECT_TIMEOUT',
	2: 'CONNECT_REFUSED',
	3: 'TLS_HANDSHAKE_FAIL',
	4: 'DNS_RESOLVE_FAIL',
	10: 'PROTOCOL_VERSION_MISMATCH',
	11: 'MALFORMED_RESPONSE',
	20: 'UNAUTHENTICATED',
	21: 'FORBIDDEN',
	22: 'API_KEY_EXPIRED',
	23: 'AUTH_UNRESOLVED',
	30: 'MODEL_UNAVAILABLE',
	31: 'TOOL_DISABLED',
	32: 'MODE_UNSUPPORTED',
	40: 'QUOTA_EXCEEDED',
	41: 'MAX_SESSIONS_REACHED',
	42: 'BUDGET_EXHAUSTED',
	50: 'PARAM_INVALID',
	51: 'PARAM_MISSING',
};

function mapConnectionErrorCode(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return '';
	}
	if (typeof value === 'number') {
		return ConnectionErrorCodeByNumber[value] ?? String(value);
	}
	return value;
}
function mapRemoteAgentProperties(wire: { [key: string]: string } | undefined): { readonly [key: string]: string } {
	if (!wire) {
		return {};
	}
	const out: { [key: string]: string } = {};
	for (const [key, value] of Object.entries(wire)) {
		out[key] = value ?? '';
	}
	return out;
}

function mapRemoteAgentModelInfo(wire: RemoteAgentModelInfoWire): UniverseAgentRemoteAgentModelInfo {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		provider: wire.provider ?? '',
		maxTokens: requiredInt64(wire.max_tokens),
		enabled: wire.enabled === true,
	};
}

function emptyRemoteAgentCapabilities(): UniverseAgentRemoteAgentCapabilities {
	return {
		models: [],
		tools: [],
		modes: [],
		serverVersion: '',
		protocolVersion: '',
		properties: {},
	};
}

function mapRemoteAgentCapabilities(wire: RemoteAgentCapabilitiesWire | undefined): UniverseAgentRemoteAgentCapabilities {
	if (!wire) {
		return emptyRemoteAgentCapabilities();
	}
	return {
		models: (wire.models ?? []).map(mapRemoteAgentModelInfo),
		tools: [...(wire.tools ?? [])],
		modes: [...(wire.modes ?? [])],
		serverVersion: wire.server_version ?? '',
		protocolVersion: wire.protocol_version ?? '',
		properties: mapRemoteAgentProperties(wire.properties),
	};
}

function emptyRemoteAgentLoadMetrics(): UniverseAgentRemoteAgentLoadMetrics {
	return {
		activeSessions: 0,
		queueDepth: 0,
		cpuPercent: 0,
		memoryUsedMb: 0,
	};
}

function mapRemoteAgentLoadMetrics(wire: RemoteAgentLoadMetricsWire | undefined): UniverseAgentRemoteAgentLoadMetrics {
	if (!wire) {
		return emptyRemoteAgentLoadMetrics();
	}
	return {
		activeSessions: requiredInt64(wire.active_sessions),
		queueDepth: requiredInt64(wire.queue_depth),
		cpuPercent: requiredInt64(wire.cpu_percent),
		memoryUsedMb: requiredInt64(wire.memory_used_mb),
	};
}

function mapRemoteAgentInfo(wire: RemoteAgentInfoWire): UniverseAgentRemoteAgentInfo {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		description: wire.description ?? '',
		status: wire.status ?? '',
		endpoint: wire.endpoint ?? '',
		tags: [...(wire.tags ?? [])],
		capabilities: mapRemoteAgentCapabilities(wire.capabilities),
		load: mapRemoteAgentLoadMetrics(wire.load),
		lastHeartbeatAt: requiredInt64(wire.last_heartbeat_at),
	};
}

function mapListNodesResponse(wire: ListNodesResponseWire): UniverseAgentListNodesResult {
	return {
		nodes: (wire.nodes ?? []).map(mapRemoteAgentInfo),
		total: requiredInt64(wire.total),
		onlineCount: requiredInt64(wire.online_count),
	};
}

function mapValidationError(wire: ValidationErrorWire): UniverseAgentValidationError {
	return {
		code: mapConnectionErrorCode(wire.code),
		field: wire.field ?? '',
		message: wire.message ?? '',
		suggestion: wire.suggestion ?? '',
	};
}

function mapConnectionReport(wire: ConnectionReportWire): UniverseAgentConnectionReport {
	return {
		reachable: wire.reachable === true,
		authenticated: wire.authenticated === true,
		canCreateSession: wire.can_create_session === true,
		latencyMs: requiredInt64(wire.latency_ms),
		capabilities: mapRemoteAgentCapabilities(wire.capabilities),
		errors: (wire.errors ?? []).map(mapValidationError),
		load: mapRemoteAgentLoadMetrics(wire.load),
	};
}

interface SetMaintenanceResponseWire {
	success?: boolean;
}

function mapSetMaintenanceResponse(wire: SetMaintenanceResponseWire): UniverseAgentSetMaintenanceResult {
	return {
		success: wire.success === true,
	};
}

interface ExitMaintenanceResponseWire {
	success?: boolean;
}

function mapExitMaintenanceResponse(wire: ExitMaintenanceResponseWire): UniverseAgentExitMaintenanceResult {
	return {
		success: wire.success === true,
	};
}

interface DeleteRemoteAgentConfigResponseWire {
	success?: boolean;
}

function mapDeleteRemoteAgentConfigResponse(wire: DeleteRemoteAgentConfigResponseWire): UniverseAgentDeleteRemoteAgentConfigResult {
	return {
		success: wire.success === true,
	};
}

interface ReloadRemoteAgentsResponseWire {
	success?: boolean;
	added?: string[];
	removed?: string[];
	changed?: string[];
	errors?: string[];
	duration_ms?: number | string;
}

function mapReloadRemoteAgentsResponse(wire: ReloadRemoteAgentsResponseWire): UniverseAgentReloadRemoteAgentsResult {
	return {
		success: wire.success === true,
		added: (wire.added ?? []).map(id => id ?? ''),
		removed: (wire.removed ?? []).map(id => id ?? ''),
		changed: (wire.changed ?? []).map(id => id ?? ''),
		errors: (wire.errors ?? []).map(id => id ?? ''),
		durationMs: requiredInt64(wire.duration_ms),
	};
}

interface RemotePendingPermissionWire {
	request_id?: string;
	tool_name?: string;
	path?: string;
	command?: string;
	arguments_json?: string;
	danger_level?: string;
	bubble_target?: string;
}

interface RemotePendingQuestionWire {
	question_id?: string;
	questions_json?: string;
}

interface GetRemoteSessionStatusResponseWire {
	status?: string;
	call_id?: string;
	progress?: string;
	elapsed_ms?: number | string;
	expires_at?: number | string;
	pending_permissions?: RemotePendingPermissionWire[];
	pending_questions?: RemotePendingQuestionWire[];
}

function mapRemotePendingPermission(wire: RemotePendingPermissionWire): UniverseAgentRemotePendingPermission {
	return {
		requestId: wire.request_id ?? '',
		toolName: wire.tool_name ?? '',
		path: wire.path ?? '',
		command: wire.command ?? '',
		argumentsJson: wire.arguments_json ?? '',
		dangerLevel: wire.danger_level ?? '',
		bubbleTarget: wire.bubble_target ?? '',
	};
}

function mapRemotePendingQuestion(wire: RemotePendingQuestionWire): UniverseAgentRemotePendingQuestion {
	return {
		questionId: wire.question_id ?? '',
		questionsJson: wire.questions_json ?? '',
	};
}

function mapGetRemoteSessionStatusResponse(wire: GetRemoteSessionStatusResponseWire): UniverseAgentGetRemoteSessionStatusResult {
	return {
		status: wire.status ?? '',
		callId: wire.call_id ?? '',
		progress: wire.progress ?? '',
		elapsedMs: requiredInt64(wire.elapsed_ms),
		expiresAt: requiredInt64(wire.expires_at),
		pendingPermissions: (wire.pending_permissions ?? []).map(mapRemotePendingPermission),
		pendingQuestions: (wire.pending_questions ?? []).map(mapRemotePendingQuestion),
	};
}

interface RemoteToolCallWire {
	id?: string;
	name?: string;
	arguments?: string;
}

interface RemoteSystemMessageWire {
	content?: string;
}

interface RemoteUserMessageWire {
	content?: string;
}

interface RemoteAssistantMessageWire {
	content?: string;
	tool_calls?: RemoteToolCallWire[];
}

interface RemoteToolResultMessageWire {
	tool_call_id?: string;
	tool_name?: string;
	content?: string;
	is_error?: boolean;
}

interface RemoteChatMessageWire {
	system?: RemoteSystemMessageWire;
	user?: RemoteUserMessageWire;
	assistant?: RemoteAssistantMessageWire;
	tool_result?: RemoteToolResultMessageWire;
}

interface GetRemoteSessionHistoryResponseWire {
	messages?: RemoteChatMessageWire[];
	version?: number | string;
	has_more?: boolean;
}

function mapRemoteChatMessage(wire: RemoteChatMessageWire): UniverseAgentRemoteChatMessage {
	return {
		...(wire.system !== undefined ? { system: { content: wire.system.content ?? '' } } : {}),
		...(wire.user !== undefined ? { user: { content: wire.user.content ?? '' } } : {}),
		...(wire.assistant !== undefined ? {
			assistant: {
				content: wire.assistant.content ?? '',
				toolCalls: (wire.assistant.tool_calls ?? []).map(call => ({
					id: call.id ?? '',
					name: call.name ?? '',
					arguments: call.arguments ?? '',
				})),
			},
		} : {}),
		...(wire.tool_result !== undefined ? {
			toolResult: {
				toolCallId: wire.tool_result.tool_call_id ?? '',
				toolName: wire.tool_result.tool_name ?? '',
				content: wire.tool_result.content ?? '',
				isError: wire.tool_result.is_error === true,
			},
		} : {}),
	};
}

function mapGetRemoteSessionHistoryResponse(wire: GetRemoteSessionHistoryResponseWire): UniverseAgentGetRemoteSessionHistoryResult {
	return {
		messages: (wire.messages ?? []).map(mapRemoteChatMessage),
		version: requiredInt64(wire.version),
		hasMore: wire.has_more === true,
	};
}

interface RemoteAgentEndpointWire {
	host?: string;
	port?: number | string;
	tls?: boolean;
	tls_cert_path?: string;
}

interface RemoteAgentAuthConfigWire {
	type?: string;
	api_key_ref?: string;
	token_ref?: string;
}

interface RemoteAgentArgConditionWire {
	field?: string;
	operator?: string;
	value?: string;
}

interface RemoteAgentWhitelistEntryWire {
	tool_name?: string;
	arg_conditions?: RemoteAgentArgConditionWire[];
}

interface RemoteAgentPermissionBudgetWire {
	max_tool_calls?: number | string;
	max_tokens?: number | string;
	timeout_ms?: number | string;
	window_ms?: number | string;
	max_bubble_to_user_per_day?: number | string;
}

interface RemoteAgentPermissionDelegateWire {
	mode?: string;
	whitelist?: RemoteAgentWhitelistEntryWire[];
	budget?: RemoteAgentPermissionBudgetWire;
	timeout_policy?: string;
	fallback?: string;
	bubble_target?: string;
}

interface RemoteAgentHealthCheckConfigWire {
	interval_ms?: number | string;
	timeout_ms?: number | string;
	unhealthy_threshold?: number | string;
	healthy_threshold?: number | string;
	use_watch?: boolean;
	degraded_error_rate_threshold?: number | string;
	degraded_p99_latency_ms?: number | string;
}

interface RemoteAgentConfigWire {
	id?: string;
	name?: string;
	description?: string;
	enabled?: boolean;
	endpoint?: RemoteAgentEndpointWire;
	auth?: RemoteAgentAuthConfigWire;
	tags?: string[];
	max_concurrent_sessions?: number | string;
	session_lifecycle?: string;
	default_permission_delegate?: RemoteAgentPermissionDelegateWire;
	health_check?: RemoteAgentHealthCheckConfigWire;
}

interface ListConfigsResponseWire {
	configs?: RemoteAgentConfigWire[];
}

function emptyRemoteAgentEndpoint(): UniverseAgentRemoteAgentEndpoint {
	return {
		host: '',
		port: 0,
		tls: false,
		tlsCertPath: '',
	};
}

function mapRemoteAgentEndpoint(wire: RemoteAgentEndpointWire | undefined): UniverseAgentRemoteAgentEndpoint {
	if (!wire) {
		return emptyRemoteAgentEndpoint();
	}
	return {
		host: wire.host ?? '',
		port: requiredInt64(wire.port),
		tls: wire.tls === true,
		tlsCertPath: wire.tls_cert_path ?? '',
	};
}

function emptyRemoteAgentAuthConfig(): UniverseAgentRemoteAgentAuthConfig {
	return {
		type: '',
		apiKeyRef: '',
		tokenRef: '',
	};
}

function mapRemoteAgentAuthConfig(wire: RemoteAgentAuthConfigWire | undefined): UniverseAgentRemoteAgentAuthConfig {
	if (!wire) {
		return emptyRemoteAgentAuthConfig();
	}
	return {
		type: wire.type ?? '',
		apiKeyRef: wire.api_key_ref ?? '',
		tokenRef: wire.token_ref ?? '',
	};
}

function mapRemoteAgentArgCondition(wire: RemoteAgentArgConditionWire): UniverseAgentRemoteAgentArgCondition {
	return {
		field: wire.field ?? '',
		operator: wire.operator ?? '',
		value: wire.value ?? '',
	};
}

function mapRemoteAgentWhitelistEntry(wire: RemoteAgentWhitelistEntryWire): UniverseAgentRemoteAgentWhitelistEntry {
	return {
		toolName: wire.tool_name ?? '',
		argConditions: (wire.arg_conditions ?? []).map(mapRemoteAgentArgCondition),
	};
}

function emptyRemoteAgentPermissionBudget(): UniverseAgentRemoteAgentPermissionBudget {
	return {
		maxToolCalls: 0,
		maxTokens: 0,
		timeoutMs: 0,
		windowMs: 0,
		maxBubbleToUserPerDay: 0,
	};
}

function mapRemoteAgentPermissionBudget(wire: RemoteAgentPermissionBudgetWire | undefined): UniverseAgentRemoteAgentPermissionBudget {
	if (!wire) {
		return emptyRemoteAgentPermissionBudget();
	}
	return {
		maxToolCalls: requiredInt64(wire.max_tool_calls),
		maxTokens: requiredInt64(wire.max_tokens),
		timeoutMs: requiredInt64(wire.timeout_ms),
		windowMs: requiredInt64(wire.window_ms),
		maxBubbleToUserPerDay: requiredInt64(wire.max_bubble_to_user_per_day),
	};
}

function emptyRemoteAgentPermissionDelegate(): UniverseAgentRemoteAgentPermissionDelegate {
	return {
		mode: '',
		whitelist: [],
		budget: emptyRemoteAgentPermissionBudget(),
		timeoutPolicy: '',
		fallback: '',
		bubbleTarget: '',
	};
}

function mapRemoteAgentPermissionDelegate(wire: RemoteAgentPermissionDelegateWire | undefined): UniverseAgentRemoteAgentPermissionDelegate {
	if (!wire) {
		return emptyRemoteAgentPermissionDelegate();
	}
	return {
		mode: wire.mode ?? '',
		whitelist: (wire.whitelist ?? []).map(mapRemoteAgentWhitelistEntry),
		budget: mapRemoteAgentPermissionBudget(wire.budget),
		timeoutPolicy: wire.timeout_policy ?? '',
		fallback: wire.fallback ?? '',
		bubbleTarget: wire.bubble_target ?? '',
	};
}

function emptyRemoteAgentHealthCheckConfig(): UniverseAgentRemoteAgentHealthCheckConfig {
	return {
		intervalMs: 0,
		timeoutMs: 0,
		unhealthyThreshold: 0,
		healthyThreshold: 0,
		useWatch: false,
		degradedErrorRateThreshold: 0,
		degradedP99LatencyMs: 0,
	};
}

function mapRemoteAgentHealthCheckConfig(wire: RemoteAgentHealthCheckConfigWire | undefined): UniverseAgentRemoteAgentHealthCheckConfig {
	if (!wire) {
		return emptyRemoteAgentHealthCheckConfig();
	}
	return {
		intervalMs: requiredInt64(wire.interval_ms),
		timeoutMs: requiredInt64(wire.timeout_ms),
		unhealthyThreshold: requiredInt64(wire.unhealthy_threshold),
		healthyThreshold: requiredInt64(wire.healthy_threshold),
		useWatch: wire.use_watch === true,
		degradedErrorRateThreshold: requiredDouble(wire.degraded_error_rate_threshold),
		degradedP99LatencyMs: requiredInt64(wire.degraded_p99_latency_ms),
	};
}

function mapRemoteAgentConfig(wire: RemoteAgentConfigWire): UniverseAgentRemoteAgentConfig {
	return {
		id: wire.id ?? '',
		name: wire.name ?? '',
		description: wire.description ?? '',
		enabled: wire.enabled === true,
		endpoint: mapRemoteAgentEndpoint(wire.endpoint),
		auth: mapRemoteAgentAuthConfig(wire.auth),
		tags: [...(wire.tags ?? [])],
		maxConcurrentSessions: requiredInt64(wire.max_concurrent_sessions),
		sessionLifecycle: wire.session_lifecycle ?? '',
		defaultPermissionDelegate: mapRemoteAgentPermissionDelegate(wire.default_permission_delegate),
		healthCheck: mapRemoteAgentHealthCheckConfig(wire.health_check),
	};
}

function mapListConfigsResponse(wire: ListConfigsResponseWire): UniverseAgentListConfigsResult {
	return {
		configs: (wire.configs ?? []).map(mapRemoteAgentConfig),
	};
}

function encodeRemoteAgentConfig(config: UniverseAgentRemoteAgentConfig): RemoteAgentConfigWire {
	return {
		id: config.id,
		name: config.name,
		description: config.description,
		enabled: config.enabled,
		endpoint: {
			host: config.endpoint.host,
			port: config.endpoint.port,
			tls: config.endpoint.tls,
			tls_cert_path: config.endpoint.tlsCertPath,
		},
		auth: {
			type: config.auth.type,
			api_key_ref: config.auth.apiKeyRef,
			token_ref: config.auth.tokenRef,
		},
		tags: [...config.tags],
		max_concurrent_sessions: config.maxConcurrentSessions,
		session_lifecycle: config.sessionLifecycle,
		default_permission_delegate: {
			mode: config.defaultPermissionDelegate.mode,
			whitelist: config.defaultPermissionDelegate.whitelist.map(entry => ({
				tool_name: entry.toolName,
				arg_conditions: entry.argConditions.map(condition => ({
					field: condition.field,
					operator: condition.operator,
					value: condition.value,
				})),
			})),
			budget: {
				max_tool_calls: config.defaultPermissionDelegate.budget.maxToolCalls,
				max_tokens: config.defaultPermissionDelegate.budget.maxTokens,
				timeout_ms: config.defaultPermissionDelegate.budget.timeoutMs,
				window_ms: config.defaultPermissionDelegate.budget.windowMs,
				max_bubble_to_user_per_day: config.defaultPermissionDelegate.budget.maxBubbleToUserPerDay,
			},
			timeout_policy: config.defaultPermissionDelegate.timeoutPolicy,
			fallback: config.defaultPermissionDelegate.fallback,
			bubble_target: config.defaultPermissionDelegate.bubbleTarget,
		},
		health_check: {
			interval_ms: config.healthCheck.intervalMs,
			timeout_ms: config.healthCheck.timeoutMs,
			unhealthy_threshold: config.healthCheck.unhealthyThreshold,
			healthy_threshold: config.healthCheck.healthyThreshold,
			use_watch: config.healthCheck.useWatch,
			degraded_error_rate_threshold: config.healthCheck.degradedErrorRateThreshold,
			degraded_p99_latency_ms: config.healthCheck.degradedP99LatencyMs,
		},
	};
}

interface SaveRemoteAgentConfigResponseWire {
	success?: boolean;
	message?: string;
	connection_test?: ConnectionReportWire;
	async_test_id?: string;
}

function mapSaveRemoteAgentConfigResponse(wire: SaveRemoteAgentConfigResponseWire): UniverseAgentSaveRemoteAgentConfigResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
		connectionTest: mapConnectionReport(wire.connection_test ?? {}),
		asyncTestId: wire.async_test_id ?? '',
	};
}

interface ResetErrorResponseWire {
	success?: boolean;
}

function mapResetErrorResponse(wire: ResetErrorResponseWire): UniverseAgentResetErrorResult {
	return {
		success: wire.success === true,
	};
}

interface CreateRemoteSessionResponseWire {
	call_id?: string;
	status?: string;
	created_at?: number | string;
	expires_at?: number | string;
}

function mapCreateRemoteSessionResponse(wire: CreateRemoteSessionResponseWire): UniverseAgentCreateRemoteSessionResult {
	return {
		callId: wire.call_id ?? '',
		status: wire.status ?? '',
		createdAt: requiredInt64(wire.created_at),
		expiresAt: requiredInt64(wire.expires_at),
	};
}

interface DestroyRemoteSessionResponseWire {
	success?: boolean;
	message?: string;
}

function mapDestroyRemoteSessionResponse(wire: DestroyRemoteSessionResponseWire): UniverseAgentDestroyRemoteSessionResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

interface ResumeRemoteSessionResponseWire {
	success?: boolean;
	call_id?: string;
	status?: string;
	message?: string;
	expires_at?: number | string;
}

function mapResumeRemoteSessionResponse(wire: ResumeRemoteSessionResponseWire): UniverseAgentResumeRemoteSessionResult {
	return {
		success: wire.success === true,
		callId: wire.call_id ?? '',
		status: wire.status ?? '',
		message: wire.message ?? '',
		expiresAt: requiredInt64(wire.expires_at),
	};
}

interface UploadProgressResponseWire {
	exists?: boolean;
	bytes_received?: number | string;
	partial_path?: string;
}

function mapUploadProgressResponse(wire: UploadProgressResponseWire): UniverseAgentGetUploadProgressResult {
	return {
		exists: wire.exists === true,
		bytesReceived: requiredInt64(wire.bytes_received),
		partialPath: wire.partial_path ?? '',
	};
}

interface ShutdownResponseWire {
	accepted?: boolean;
	message?: string;
}

function mapShutdownResponse(wire: ShutdownResponseWire): UniverseAgentShutdownResult {
	return {
		accepted: wire.accepted === true,
		message: wire.message ?? '',
	};
}

interface ClipboardWriteResponseWire {
	clip_id?: string;
}

function mapClipboardWriteResponse(wire: ClipboardWriteResponseWire): UniverseAgentWriteClipboardResult {
	return {
		clipId: wire.clip_id ?? '',
	};
}

interface ClipboardEntryWire {
	clip_id?: string;
	label?: string;
	type?: string | number;
	content?: string;
	created_by?: string;
	created_at?: number | string;
}

interface ClipboardReadResponseWire {
	entry?: ClipboardEntryWire;
}

function mapClipboardEntry(wire: ClipboardEntryWire | undefined): UniverseAgentClipboardEntry {
	return {
		clipId: wire?.clip_id ?? '',
		label: wire?.label ?? '',
		type: mapClipboardEntryType(wire?.type),
		content: wire?.content ?? '',
		createdBy: wire?.created_by ?? '',
		createdAt: requiredInt64(wire?.created_at),
	};
}

function mapClipboardReadResponse(wire: ClipboardReadResponseWire): UniverseAgentReadClipboardResult {
	return {
		entry: mapClipboardEntry(wire.entry),
	};
}

interface ClipboardEntrySummaryWire {
	clip_id?: string;
	label?: string;
	type?: string | number;
	created_by?: string;
	created_at?: number | string;
}

interface ClipboardListResponseWire {
	entries?: ClipboardEntrySummaryWire[];
}

function mapClipboardEntrySummary(wire: ClipboardEntrySummaryWire): UniverseAgentClipboardEntrySummary {
	return {
		clipId: wire.clip_id ?? '',
		label: wire.label ?? '',
		type: mapClipboardEntryType(wire.type),
		createdBy: wire.created_by ?? '',
		createdAt: requiredInt64(wire.created_at),
	};
}

function mapClipboardListResponse(wire: ClipboardListResponseWire): UniverseAgentListClipboardResult {
	return {
		entries: (wire.entries ?? []).map(mapClipboardEntrySummary),
	};
}

interface ClipboardClearResponseWire {
	removed_count?: number;
}

function mapClipboardClearResponse(wire: ClipboardClearResponseWire): UniverseAgentClearClipboardResult {
	return {
		removedCount: wire.removed_count ?? 0,
	};
}

interface DownloadChunkWire {
	offset?: number | string;
	data?: string;
	total_size?: number | string;
	is_last?: boolean;
	checksum_sha256?: string;
}

function mapDownloadChunk(wire: DownloadChunkWire): UniverseAgentDownloadChunk {
	return {
		offset: requiredInt64(wire.offset),
		data: base64ToBytes(wire.data),
		totalSize: requiredInt64(wire.total_size),
		isLast: wire.is_last === true,
		checksumSha256: wire.checksum_sha256 ?? '',
	};
}

interface HealthCheckResponseWire {
	status?: string;
	version?: string;
	active_sessions?: number | string;
	uptime_ms?: number | string;
}

function mapHealthCheckResponse(wire: HealthCheckResponseWire): UniverseAgentHealthCheckResult {
	return {
		status: wire.status ?? '',
		version: wire.version ?? '',
		activeSessions: requiredInt64(wire.active_sessions),
		uptimeMs: requiredInt64(wire.uptime_ms),
	};
}

interface DoctorCheckWire {
	name?: string;
	passed?: boolean;
	message?: string;
	fix_hint?: string;
}

interface DoctorResponseWire {
	checks?: DoctorCheckWire[];
	all_passed?: boolean;
}

function mapDoctorCheck(wire: DoctorCheckWire): UniverseAgentDoctorCheck {
	return {
		name: wire.name ?? '',
		passed: wire.passed === true,
		message: wire.message ?? '',
		fixHint: wire.fix_hint ?? '',
	};
}

function mapDoctorResponse(wire: DoctorResponseWire): UniverseAgentDoctorResult {
	return {
		checks: (wire.checks ?? []).map(mapDoctorCheck),
		allPassed: wire.all_passed === true,
	};
}

interface DeviceInfoWire {
	device_id?: string;
	display_name?: string;
	role?: string;
	platform?: string;
	paired_at?: number | string;
	last_seen_at?: number | string;
	active?: boolean;
}

interface ListDevicesResponseWire {
	devices?: DeviceInfoWire[];
}

function mapDeviceInfo(wire: DeviceInfoWire): UniverseAgentDeviceInfo {
	return {
		deviceId: wire.device_id ?? '',
		displayName: wire.display_name ?? '',
		role: wire.role ?? '',
		platform: wire.platform ?? '',
		pairedAt: requiredInt64(wire.paired_at),
		lastSeenAt: requiredInt64(wire.last_seen_at),
		active: wire.active === true,
	};
}

function mapListDevicesResponse(wire: ListDevicesResponseWire): UniverseAgentListDevicesResult {
	return {
		devices: (wire.devices ?? []).map(mapDeviceInfo),
	};
}

interface PairApproveResponseWire {
	success?: boolean;
	device_id?: string;
	message?: string;
}

function mapPairApproveResponse(wire: PairApproveResponseWire): UniverseAgentPairApproveResult {
	return {
		success: wire.success === true,
		deviceId: wire.device_id ?? '',
		message: wire.message ?? '',
	};
}

interface PairRejectResponseWire {
	success?: boolean;
	message?: string;
}

function mapPairRejectResponse(wire: PairRejectResponseWire): UniverseAgentPairRejectResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

interface RevokeDeviceResponseWire {
	success?: boolean;
	message?: string;
}

function mapRevokeResponse(wire: RevokeDeviceResponseWire): UniverseAgentRevokeResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

interface RotateTokenResponseWire {
	success?: boolean;
	message?: string;
}

function mapRotateTokenResponse(wire: RotateTokenResponseWire): UniverseAgentRotateTokenResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

interface PendingPairInfoWire {
	pairing_code?: string;
	device_id?: string;
	display_name?: string;
	platform?: string;
	requested_at?: number | string;
	expires_in_seconds?: number;
}

interface ListPendingResponseWire {
	pending?: PendingPairInfoWire[];
}

function mapPendingPairInfo(wire: PendingPairInfoWire): UniverseAgentPendingPairInfo {
	return {
		pairingCode: wire.pairing_code ?? '',
		deviceId: wire.device_id ?? '',
		displayName: wire.display_name ?? '',
		platform: wire.platform ?? '',
		requestedAt: requiredInt64(wire.requested_at),
		expiresInSeconds: wire.expires_in_seconds ?? 0,
	};
}

function mapListPendingResponse(wire: ListPendingResponseWire): UniverseAgentListPendingResult {
	return {
		pending: (wire.pending ?? []).map(mapPendingPairInfo),
	};
}

interface BoundSessionTargetWire {
	session_id?: string;
}

interface NewSessionTargetWire {
	engine_profile_id?: string;
}

interface DeliveryTargetDtoWire {
	self?: Record<string, unknown>;
	bound_session?: BoundSessionTargetWire;
	new_session?: NewSessionTargetWire;
}

interface TriggerDtoWire {
	trigger_id?: string;
	name?: string;
	type?: string;
	prompt_template?: string;
	enabled?: boolean;
	pause_reason?: string;
	target?: DeliveryTargetDtoWire;
	interval_ms?: number | string;
	cron_expression?: string;
	run_at_epoch_ms?: number | string;
}

interface ListTriggersResponseWire {
	triggers?: TriggerDtoWire[];
}

function mapDeliveryTarget(wire: DeliveryTargetDtoWire | undefined): UniverseAgentTriggerDeliveryTarget {
	if (wire?.self !== undefined && wire.self !== null) {
		return { kind: 'self' };
	}
	if (wire?.bound_session !== undefined && wire.bound_session !== null) {
		return {
			kind: 'boundSession',
			sessionId: wire.bound_session.session_id ?? '',
		};
	}
	if (wire?.new_session !== undefined && wire.new_session !== null) {
		return {
			kind: 'newSession',
			engineProfileId: wire.new_session.engine_profile_id ?? '',
		};
	}
	return { kind: 'unspecified' };
}

function mapTriggerDto(wire: TriggerDtoWire): UniverseAgentTrigger {
	return {
		triggerId: wire.trigger_id ?? '',
		name: wire.name ?? '',
		type: wire.type ?? '',
		promptTemplate: wire.prompt_template ?? '',
		enabled: wire.enabled === true,
		pauseReason: wire.pause_reason ?? '',
		target: mapDeliveryTarget(wire.target),
		intervalMs: requiredInt64(wire.interval_ms),
		cronExpression: wire.cron_expression ?? '',
		runAtEpochMs: requiredInt64(wire.run_at_epoch_ms),
	};
}

function mapListTriggersResponse(wire: ListTriggersResponseWire): UniverseAgentListTriggersResult {
	return {
		triggers: (wire.triggers ?? []).map(mapTriggerDto),
	};
}

interface UpsertTriggerResponseWire {
	trigger?: TriggerDtoWire;
}

function deliveryTargetWire(target: UniverseAgentTriggerDeliveryTarget): DeliveryTargetDtoWire {
	if (target.kind === 'self') {
		return { self: {} };
	}
	if (target.kind === 'boundSession') {
		return { bound_session: { session_id: target.sessionId } };
	}
	if (target.kind === 'newSession') {
		return { new_session: { engine_profile_id: target.engineProfileId } };
	}
	return {};
}

function triggerDtoWire(trigger: UniverseAgentTrigger): TriggerDtoWire {
	return {
		trigger_id: trigger.triggerId,
		name: trigger.name,
		type: trigger.type,
		prompt_template: trigger.promptTemplate,
		enabled: trigger.enabled,
		pause_reason: trigger.pauseReason,
		target: deliveryTargetWire(trigger.target),
		interval_ms: trigger.intervalMs,
		cron_expression: trigger.cronExpression,
		run_at_epoch_ms: trigger.runAtEpochMs,
	};
}

function mapUpsertTriggerResponse(wire: UpsertTriggerResponseWire): UniverseAgentUpsertTriggerResult {
	return {
		trigger: mapTriggerDto(wire.trigger ?? {}),
	};
}

function mapDeleteTriggerResponse(_wire: Record<string, unknown>): UniverseAgentDeleteTriggerResult {
	return {};
}

interface SetTriggerEnabledResponseWire {
	trigger?: TriggerDtoWire;
}

function mapSetTriggerEnabledResponse(wire: SetTriggerEnabledResponseWire): UniverseAgentSetTriggerEnabledResult {
	return {
		trigger: mapTriggerDto(wire.trigger ?? {}),
	};
}

interface FireTriggerResponseWire {
	status?: string;
	event_id?: string;
	reason?: string;
}

function mapFireTriggerResponse(wire: FireTriggerResponseWire): UniverseAgentFireTriggerResult {
	return {
		status: wire.status ?? '',
		eventId: wire.event_id ?? '',
		reason: wire.reason ?? '',
	};
}

interface ListModelsResponseWire {
	models?: Array<{
		id?: string;
		type?: string;
		enabled?: boolean;
		level?: number;
		description?: string;
		cost?: string;
		speed?: string;
		provider?: string;
		model_id?: string;
	}>;
}

function mapModelEntry(wire: NonNullable<ListModelsResponseWire['models']>[number]): UniverseAgentModelEntry {
	return {
		id: wire.id ?? '',
		type: wire.type ?? '',
		enabled: wire.enabled === true,
		level: typeof wire.level === 'number' && Number.isFinite(wire.level) ? wire.level : 0,
		description: wire.description,
		cost: wire.cost,
		speed: wire.speed,
		provider: wire.provider ?? '',
		modelId: wire.model_id ?? '',
	};
}

function mapListModelsResponse(wire: ListModelsResponseWire): UniverseAgentListModelsResult {
	return {
		models: (wire.models ?? []).map(mapModelEntry),
	};
}

interface ResolveModelResponseWire {
	selected?: NonNullable<ListModelsResponseWire['models']>[number];
	candidates?: NonNullable<ListModelsResponseWire['models']>;
	filtered?: NonNullable<ListModelsResponseWire['models']>;
}

function mapResolveModelResponse(wire: ResolveModelResponseWire): UniverseAgentResolveModelResult {
	return {
		...(wire.selected ? { selected: mapModelEntry(wire.selected) } : {}),
		candidates: (wire.candidates ?? []).map(mapModelEntry),
		filtered: (wire.filtered ?? []).map(mapModelEntry),
	};
}

interface AgentInfoWire {
	agent_id?: string;
	name?: string;
	type?: string;
	status?: string;
	model?: string;
	turn_count?: number;
	created_at?: number;
	children?: AgentInfoWire[];
}

interface AgentTreeResponseWire {
	root?: AgentInfoWire;
}

interface FetchToolDetailResponseWire {
	success?: boolean;
	content?: string;
	truncated?: boolean;
	total_bytes?: number;
	error_message?: string;
}

function mapAgentTreeNode(wire: AgentInfoWire | undefined): UniverseAgentAgentTreeNode | undefined {
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

function mapListAgentsResponse(wire: ListAgentsResponseWire): UniverseAgentListAgentsResult {
	return {
		agents: (wire.agents ?? []).flatMap(agent => {
			const mapped = mapAgentTreeNode(agent);
			return mapped ? [mapped] : [];
		}),
	};
}

function mapBackResponse(wire: BackResponseWire): UniverseAgentBackResult {
	return {
		ok: wire.success === true,
		message: wire.message,
		currentTurnId: wire.current_turn_id,
	};
}

interface MemberInfoWire {
	member_name?: string;
	member_agent_id?: string;
	status?: string;
	preset?: string;
	dynamic?: string;
	turn_count?: number;
}

interface MemberStatusResponseWire {
	members?: MemberInfoWire[];
}

interface BlackboardTaskWire {
	task_id?: string;
	owner?: string;
	description?: string;
	status?: string;
	blocked_by?: string;
	last_message?: string;
	subject?: string;
}

interface TaskListResponseWire {
	tasks?: BlackboardTaskWire[];
}

interface TeamInfoResponseWire {
	team_id?: number;
	status?: string;
}

function mapMemberInfo(wire: MemberInfoWire): UniverseAgentTeamMemberInfo {
	return {
		memberName: wire.member_name ?? '',
		memberAgentId: wire.member_agent_id ?? '',
		status: wire.status ?? '',
		preset: wire.preset ?? '',
		dynamic: wire.dynamic ?? '',
		turnCount: wire.turn_count ?? 0,
	};
}

function mapTaskInfo(wire: BlackboardTaskWire): UniverseAgentTeamTaskInfo {
	return {
		taskId: wire.task_id ?? '',
		subject: wire.subject ?? '',
		owner: wire.owner ?? '',
		status: wire.status ?? '',
		blockedBy: wire.blocked_by ?? '',
		lastMessage: wire.last_message ?? '',
		description: wire.description ?? '',
	};
}

export interface GrpcUniverseAgentClientOptions {
	readonly address: string;
	readonly credentials?: grpc.ChannelCredentials;
	readonly channelOptions?: grpc.ChannelOptions;
}

/**
 * Hand-written @grpc/grpc-js client using JSON marshalling for v1 transport primitives.
 */
export class GrpcUniverseAgentClient implements IUniverseAgentGrpcTransport {

	private readonly _channel: grpc.Client;
	private _alive = true;

	constructor(options: GrpcUniverseAgentClientOptions) {
		this._channel = new grpc.Client(
			options.address,
			options.credentials ?? grpc.credentials.createInsecure(),
			options.channelOptions,
		);
	}

	get isChannelAlive(): boolean {
		return this._alive;
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ConnectResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Connect,
		);
		const wire = await unary({
			client_id: request.clientId,
			protocol_version: request.protocolVersion,
			work_dir: request.workDir,
		});
		return mapConnectResponse(wire);
	}

	async getAuthNonce(request: UniverseAgentAuthNonceRequest): Promise<UniverseAgentAuthNonceResult> {
		const unary = makeUnaryClient<Record<string, unknown>, AuthNonceResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.GetAuthNonce,
		);
		const wire = await unary({
			client_identity_id: request.clientIdentityId,
			client_public_key: bytesToBase64(request.clientPublicKey),
		});
		return mapAuthNonceResponse(wire);
	}

	async healthCheck(): Promise<UniverseAgentHealthCheckResult> {
		const unary = makeUnaryClient<Record<string, unknown>, HealthCheckResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.HealthCheck,
		);
		const wire = await unary({});
		return mapHealthCheckResponse(wire);
	}

	async shutdown(request: UniverseAgentShutdownRequest): Promise<UniverseAgentShutdownResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ShutdownResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Shutdown,
		);
		const wire = await unary({
			force: request.force,
			grace_period_ms: request.gracePeriodMs,
		});
		return mapShutdownResponse(wire);
	}

	async writeClipboard(request: UniverseAgentWriteClipboardRequest): Promise<UniverseAgentWriteClipboardResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ClipboardWriteResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Clipboard.service,
			UniverseAgentGrpcServices.Clipboard.Write,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			label: request.label,
			type: clipboardEntryTypeWire(request.type),
			content: request.content,
			file_path: request.filePath,
			url: request.url,
		});
		return mapClipboardWriteResponse(wire);
	}

	async readClipboard(request: UniverseAgentReadClipboardRequest): Promise<UniverseAgentReadClipboardResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ClipboardReadResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Clipboard.service,
			UniverseAgentGrpcServices.Clipboard.Read,
		);
		const wire = await unary({
			session_id: request.sessionId,
			clip_id: request.clipId,
		});
		return mapClipboardReadResponse(wire);
	}

	async listClipboard(request: UniverseAgentListClipboardRequest): Promise<UniverseAgentListClipboardResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ClipboardListResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Clipboard.service,
			UniverseAgentGrpcServices.Clipboard.List,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapClipboardListResponse(wire);
	}

	async clearClipboard(request: UniverseAgentClearClipboardRequest): Promise<UniverseAgentClearClipboardResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ClipboardClearResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Clipboard.service,
			UniverseAgentGrpcServices.Clipboard.Clear,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapClipboardClearResponse(wire);
	}

	async connectWithDeviceAuth(request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ConnectResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Connect,
		);
		const deviceAuth: DeviceAuthWire = {
			client_identity_id: request.clientIdentityId,
			client_public_key: bytesToBase64(request.clientPublicKey),
			auth_nonce: bytesToBase64(request.authNonce),
			signature: bytesToBase64(request.signature),
		};
		const payload: Record<string, unknown> = {
			protocol_version: request.protocolVersion,
			device_auth: deviceAuth,
		};
		if (request.pairingPhase === 'formal') {
			payload.supported_tools = [];
		}
		const wire = await unary(payload);
		return mapConnectResponse(wire);
	}

	close(): void {
		if (this._alive) {
			this._alive = false;
			this._channel.close();
		}
	}

	async probeRpc(service: string, method: string): Promise<number> {
		return new Promise<number>(resolve => {
			const path = `/${service}/${method}`;
			this._channel.makeUnaryRequest(
				path,
				() => Buffer.from('{}'),
				(buffer: Buffer) => buffer,
				{},
				(error: grpc.ServiceError | null) => resolve(grpcErrorCode(error)),
			);
		});
	}

	async listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListSessionsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.List,
		);
		const wire = await unary({
			limit: request.limit,
			offset: request.offset,
		});
		return mapListSessionsResponse(wire);
	}

	async createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, CreateSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Create,
		);
		const wire = await unary({
			title: request.title,
			model: request.model,
		});
		return { sessionId: wire.session_id ?? '' };
	}

	async deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void> {
		const unary = makeUnaryClient<Record<string, unknown>, Record<string, never>>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Delete,
		);
		await unary({ session_id: request.sessionId });
	}

	async getSessionInfo(request: UniverseAgentSessionInfoRequest): Promise<UniverseAgentSessionInfoResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SessionInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Info,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapSessionInfoResponse(wire);
	}

	async resumeSession(request: UniverseAgentResumeSessionRequest): Promise<UniverseAgentResumeSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ResumeSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Resume,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapResumeSessionResponse(wire);
	}

	async prewarmSessions(request: UniverseAgentPrewarmSessionsRequest): Promise<UniverseAgentPrewarmSessionsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, PrewarmSessionsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Prewarm,
		);
		const wire = await unary({
			session_ids: request.sessionIds,
		});
		return mapPrewarmSessionsResponse(wire);
	}

	async shelveSession(request: UniverseAgentShelveSessionRequest): Promise<UniverseAgentShelveSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ShelveSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Shelve,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapShelveSessionResponse(wire);
	}

	async unshelveSession(request: UniverseAgentUnshelveSessionRequest): Promise<UniverseAgentUnshelveSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, UnshelveSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Unshelve,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapUnshelveSessionResponse(wire);
	}

	async purgeSession(request: UniverseAgentPurgeSessionRequest): Promise<UniverseAgentPurgeSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, PurgeSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Purge,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapPurgeSessionResponse(wire);
	}

	async exportSession(request: UniverseAgentExportSessionRequest): Promise<UniverseAgentExportSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ExportSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Export,
		);
		const wire = await unary({
			session_id: request.sessionId,
			format: request.format,
		});
		return mapExportSessionResponse(wire);
	}

	async resolveTurn(request: UniverseAgentResolveTurnRequest): Promise<UniverseAgentResolveTurnResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ResolveTurnResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.ResolveTurn,
		);
		const wire = await unary({
			session_id: request.sessionId,
			turn_id: request.turnId,
			current_leaf_turn_id: request.currentLeafTurnId,
		});
		return mapResolveTurnResponse(wire);
	}

	async getAgentStatus(request: UniverseAgentAgentStatusRequest): Promise<UniverseAgentAgentStatusResult> {
		const unary = makeUnaryClient<Record<string, unknown>, StatusResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Status,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return mapStatusResponse(wire);
	}

	async getTodo(request: UniverseAgentTodoRequest): Promise<UniverseAgentTodoResult> {
		const unary = makeUnaryClient<Record<string, unknown>, TodoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Todo,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return mapTodoResponse(wire);
	}

	async compact(request: UniverseAgentCompactRequest): Promise<UniverseAgentCompactResult> {
		const unary = makeUnaryClient<Record<string, unknown>, CompactResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Compact,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return mapCompactResponse(wire);
	}

	async resolveAnchor(request: UniverseAgentResolveAnchorRequest): Promise<UniverseAgentResolveAnchorResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ResolveAnchorResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.ResolveAnchor,
		);
		const wire = await unary(resolveAnchorRequestWire(request));
		return mapResolveAnchorResponse(wire);
	}

	async getUsage(request: UniverseAgentUsageRequest): Promise<UniverseAgentUsageResult> {
		const unary = makeUnaryClient<Record<string, unknown>, UsageResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Usage,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return mapUsageResponse(wire);
	}

	async listAgents(request: UniverseAgentListAgentsRequest): Promise<UniverseAgentListAgentsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListAgentsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.List,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapListAgentsResponse(wire);
	}

	async getAgentHistory(request: UniverseAgentAgentHistoryRequest): Promise<UniverseAgentAgentHistoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, HistoryResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.History,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			limit: request.limit,
			offset: request.offset,
		});
		return mapHistoryResponse(wire);
	}

	async pauseAgent(request: UniverseAgentPauseAgentRequest): Promise<UniverseAgentPauseAgentResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Pause,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async back(request: UniverseAgentBackRequest): Promise<UniverseAgentBackResult> {
		const unary = makeUnaryClient<Record<string, unknown>, BackResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Back,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			operation_id: request.operationId,
		});
		return mapBackResponse(wire);
	}

	async prune(request: UniverseAgentPruneRequest): Promise<UniverseAgentPruneResult> {
		const unary = makeUnaryClient<Record<string, unknown>, PruneResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Prune,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return mapPruneResponse(wire);
	}

	async resetAgent(request: UniverseAgentResetAgentRequest): Promise<UniverseAgentResetAgentResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Reset,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			clear_profile_only: request.clearProfileOnly === true,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async branch(request: UniverseAgentBranchRequest): Promise<UniverseAgentBranchResult> {
		const unary = makeUnaryClient<Record<string, unknown>, BranchResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Branch,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			branch_index: request.branchIndex,
			turn_id: request.turnId,
		});
		return mapBranchResponse(wire);
	}

	async suspendLoop(request: UniverseAgentSuspendLoopRequest): Promise<UniverseAgentSuspendLoopResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SuspendLoop,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async resumeLoop(request: UniverseAgentResumeLoopRequest): Promise<UniverseAgentResumeLoopResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ResumeLoop,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async stopLoop(request: UniverseAgentStopLoopRequest): Promise<UniverseAgentStopLoopResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.StopLoop,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			detail: request.detail,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async renameSession(request: UniverseAgentRenameSessionRequest): Promise<UniverseAgentRenameSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Rename,
		);
		const wire = await unary({
			session_id: request.sessionId,
			title: request.title,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async cancelGeneration(request: UniverseAgentCancelGenerationRequest): Promise<UniverseAgentCancelGenerationResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Cancel,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async cancelToolCall(request: UniverseAgentCancelToolCallRequest): Promise<UniverseAgentCancelToolCallResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.CancelToolCall,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId?.trim() || 'root',
			tool_call_id: request.toolCallId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async runToolInBackground(request: UniverseAgentRunToolInBackgroundRequest): Promise<UniverseAgentRunToolInBackgroundResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string; reason_code?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.RunToolInBackground,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			tool_call_id: request.toolCallId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
			reasonCode: wire.reason_code,
		};
	}

	async stopShellTask(request: UniverseAgentStopShellTaskRequest): Promise<UniverseAgentStopShellTaskResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.StopShellTask,
		);
		const wire = await unary({
			session_id: request.sessionId,
			task_id: request.taskId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async sendShellSessionClientControl(request: UniverseAgentSendShellSessionClientControlRequest): Promise<UniverseAgentSendShellSessionClientControlResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			success?: boolean;
			error_message?: string;
			error_code?: string;
			debounced?: boolean;
			delivered_to_subscribe?: boolean;
		}>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SendShellSessionClientControl,
		);
		const wire = await unary({
			session_id: request.sessionId,
			tool_call_id: request.toolCallId,
			ref_id: request.refId,
			control_payload_json: request.controlPayloadJson,
		});
		return {
			ok: wire.success === true,
			message: wire.error_message,
			errorCode: wire.error_code,
			debounced: wire.debounced,
			deliveredToSubscribe: wire.delivered_to_subscribe,
		};
	}

	async fetchToolUsageDetail(request: UniverseAgentFetchToolUsageDetailRequest): Promise<UniverseAgentFetchToolUsageDetailResult> {
		const unary = makeUnaryClient<Record<string, unknown>, FetchToolUsageDetailResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.FetchToolUsageDetail,
		);
		const wire = await unary({
			session_id: request.sessionId,
			tool_call_id: request.toolCallId,
		});
		return mapFetchToolUsageDetailResponse(wire);
	}

	async fireTriggerWebhook(request: UniverseAgentFireTriggerWebhookRequest): Promise<UniverseAgentFireTriggerWebhookResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			status?: string | number;
			event_id?: string;
			reason?: string;
		}>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.FireTriggerWebhook,
		);
		const wire = await unary({
			session_id: request.sessionId,
			trigger_id: request.triggerId,
			payload_json: request.payloadJson,
		});
		return {
			status: mapFireTriggerWebhookStatus(wire.status),
			eventId: wire.event_id ?? '',
			reason: wire.reason ?? '',
		};
	}

	async installSessionDemoFake(request: UniverseAgentInstallSessionDemoFakeRequest): Promise<UniverseAgentInstallSessionDemoFakeResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			success?: boolean;
			message?: string;
			reason_code?: string;
		}>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.InstallSessionDemoFake,
		);
		const wire = await unary({
			session_id: request.sessionId,
			queues_payload: bytesToBase64(request.queuesPayload),
			content_type: request.contentType,
			playbook_id: request.playbookId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
			reasonCode: wire.reason_code ?? '',
		};
	}

	async clearSessionDemoFake(request: UniverseAgentClearSessionDemoFakeRequest): Promise<UniverseAgentClearSessionDemoFakeResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			success?: boolean;
			message?: string;
			reason_code?: string;
		}>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ClearSessionDemoFake,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
			reasonCode: wire.reason_code ?? '',
		};
	}

	async switchWorkDir(request: UniverseAgentSwitchWorkDirRequest): Promise<UniverseAgentSwitchWorkDirResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			success?: boolean;
			previous_work_dir?: string;
			current_work_dir?: string;
			message?: string;
		}>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SwitchWorkDir,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			new_work_dir: request.newWorkDir,
		});
		return {
			ok: wire.success === true,
			previousWorkDir: wire.previous_work_dir ?? '',
			currentWorkDir: wire.current_work_dir ?? '',
			message: wire.message,
		};
	}

	async testModelProfile(request: UniverseAgentTestModelProfileRequest): Promise<UniverseAgentTestModelProfileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			success?: boolean;
			error_message?: string;
		}>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.TestModelProfile,
		);
		const wire = await unary({
			provider_id: request.providerId,
			model_id: request.modelId,
			api_key: request.apiKey,
			base_url: request.baseUrl,
			protocol: request.protocol,
			params: request.params,
		});
		return {
			ok: wire.success === true,
			message: wire.error_message,
		};
	}


	async setSessionGoal(request: UniverseAgentSetSessionGoalRequest): Promise<UniverseAgentSetSessionGoalResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; error?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.SetSessionGoal,
		);
		const wire = await unary({
			session_id: request.sessionId,
			goal: request.goal,
		});
		return {
			ok: wire.success === true,
			message: wire.error,
		};
	}

	async cancelSessionGoal(request: UniverseAgentCancelSessionGoalRequest): Promise<UniverseAgentCancelSessionGoalResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; error?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.CancelSessionGoal,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return {
			ok: wire.success === true,
			message: wire.error,
		};
	}

	async respondPermission(request: UniverseAgentRespondPermissionRequest): Promise<UniverseAgentRespondPermissionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; error?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.Respond,
		);
		const wire = await unary({
			session_id: request.sessionId,
			request_id: request.requestId,
			granted: request.granted === true,
			metadata_json: request.metadataJson ?? '',
		});
		return {
			ok: wire.success === true,
			message: wire.error,
		};
	}

	async syncPermissionRule(request: UniverseAgentSyncPermissionRuleRequest): Promise<UniverseAgentSyncPermissionRuleResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; rule_id?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.SyncPermissionRule,
		);
		const wire = await unary({
			session_id: request.sessionId,
			tool_name: request.toolName,
			scope: request.scope,
			action: permissionRuleActionWire(request.action),
			reason: request.reason,
		});
		return {
			ok: wire.success === true,
			ruleId: wire.rule_id ?? '',
		};
	}

	async promotePermissionRule(request: UniverseAgentPromotePermissionRuleRequest): Promise<UniverseAgentPromotePermissionRuleResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean }>(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.PromotePermissionRule,
		);
		const wire = await unary({
			tool_name: request.toolName,
			scope: request.scope,
			action: permissionRuleActionWire(request.action),
		});
		return {
			ok: wire.success === true,
		};
	}

	async getSessionRules(request: UniverseAgentGetSessionRulesRequest): Promise<UniverseAgentGetSessionRulesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetSessionRulesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.GetSessionRules,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapGetSessionRulesResponse(wire);
	}

	async setPermissionMode(request: UniverseAgentSetPermissionModeRequest): Promise<UniverseAgentSetPermissionModeResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; error?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.SetPermissionMode,
		);
		const wire = await unary({
			session_id: request.sessionId,
			mode: sessionToolPermissionModeWire(request.mode),
		});
		return {
			ok: wire.success === true,
			message: wire.error,
		};
	}

	async taskUpdate(request: UniverseAgentTaskUpdateRequest): Promise<UniverseAgentTaskUpdateResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TaskUpdate,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			task_id: request.taskId,
			new_status: request.newStatus,
			message: request.message,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async taskCancel(request: UniverseAgentTaskCancelRequest): Promise<UniverseAgentTaskCancelResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TaskCancel,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			task_id: request.taskId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async messageMember(request: UniverseAgentMessageMemberRequest): Promise<UniverseAgentMessageMemberResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.MessageMember,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			member_name: request.memberName,
			content: request.content,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async createTeam(request: UniverseAgentCreateTeamRequest): Promise<UniverseAgentCreateTeamResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { team_id?: number; member_count?: number }>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.CreateTeam,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			task_descriptions: request.taskDescriptions,
		});
		return {
			teamId: wire.team_id ?? 0,
			memberCount: wire.member_count ?? 0,
		};
	}

	async startMember(request: UniverseAgentStartMemberRequest): Promise<UniverseAgentStartMemberResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { member_agent_id?: string; member_name?: string; dynamic?: boolean }>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.StartMember,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			member_name: request.memberName,
			preset_id: request.presetId,
			system_prompt: request.systemPrompt,
			model_type: request.modelType,
			dynamic: request.dynamic,
		});
		return {
			memberAgentId: wire.member_agent_id ?? '',
			memberName: wire.member_name ?? '',
			dynamic: wire.dynamic === true,
		};
	}

	async killMember(request: UniverseAgentKillMemberRequest): Promise<UniverseAgentKillMemberResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.KillMember,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			member_name: request.memberName,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async abort(request: UniverseAgentAbortTeamRequest): Promise<UniverseAgentAbortTeamResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string; stopped_members?: string[] }>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.Abort,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			team_id: request.teamId,
			reason: request.reason,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
			stoppedMembers: wire.stopped_members ?? [],
		};
	}

	async respondQuestion(request: UniverseAgentRespondQuestionRequest): Promise<UniverseAgentRespondQuestionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; error?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.RespondQuestion,
		);
		const wire = await unary({
			session_id: request.sessionId,
			response: {
				question_id: request.questionId,
				answers: questionAnswersWire(request.answers),
				custom_text: request.customText ?? '',
			},
		});
		return {
			ok: wire.success === true,
			message: wire.error,
		};
	}

	async enqueueQueueItem(request: UniverseAgentEnqueueQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.EnqueueQueueItem, {
			session_id: request.sessionId,
			op_id: request.opId ?? '',
			client_message_id: request.clientMessageId ?? '',
			text: request.text,
			priority: queuePriorityWire(request.priority),
		});
	}

	async insertQueueItem(request: UniverseAgentInsertQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.InsertQueueItem, {
			session_id: request.sessionId,
			op_id: request.opId ?? '',
			client_message_id: request.clientMessageId ?? '',
			text: request.text,
			priority: queuePriorityWire(request.priority),
			before_item_id: request.beforeItemId ?? '',
		});
	}

	async reorderQueue(request: UniverseAgentReorderQueueRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.ReorderQueue, {
			session_id: request.sessionId,
			op_id: request.opId ?? '',
			item_ids: request.itemIds ?? [],
		});
	}

	async deleteQueueItem(request: UniverseAgentDeleteQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.DeleteQueueItem, queueItemRefWire(request));
	}

	async retryQueueItem(request: UniverseAgentRetryQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.RetryQueueItem, queueItemRefWire(request));
	}

	async retryAllFailed(request: UniverseAgentRetryAllFailedRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.RetryAllFailed, queueRefWire(request));
	}

	async retryQueueItemUpload(request: UniverseAgentRetryQueueItemUploadRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.RetryQueueItemUpload, queueItemRefWire(request));
	}

	async pinQueueItem(request: UniverseAgentPinQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.PinQueueItem, queueItemRefWire(request));
	}

	async setQueueItemLocked(request: UniverseAgentSetQueueItemLockedRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.SetQueueItemLocked, {
			...queueItemRefWire(request),
			locked: request.locked,
		});
	}

	async injectQueueItem(request: UniverseAgentInjectQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.InjectQueueItem, queueItemRefWire(request));
	}

	async setQueueItemForkAnchor(request: UniverseAgentSetQueueItemForkAnchorRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.SetQueueItemForkAnchor, {
			...queueItemRefWire(request),
			fork_from_turn_id: request.forkFromTurnId ?? '',
			fork_from_preview: request.forkFromPreview ?? '',
		});
	}

	async pauseQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.PauseQueue, queueRefWire(request));
	}

	async resumeQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.ResumeQueue, queueRefWire(request));
	}

	async clearQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.ClearQueue, queueRefWire(request));
	}

	async holdQueueItem(request: UniverseAgentHoldQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.HoldQueueItem, {
			...queueItemRefWire(request),
			reason: queueHoldReasonWire(request.reason),
		});
	}

	async releaseQueueItemHold(request: UniverseAgentQueueItemRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.ReleaseQueueItemHold, queueItemRefWire(request));
	}

	async editQueueItem(request: UniverseAgentEditQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.EditQueueItem, {
			...queueItemRefWire(request),
			text: request.text,
		});
	}

	private async _queueMutation(method: string, wire: Record<string, unknown>): Promise<UniverseAgentQueueMutationResult> {
		const unary = makeUnaryClient<Record<string, unknown>, QueueMutationResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			method,
		);
		const result = await unary(wire);
		return {
			ok: result.ok === true,
			error: result.error,
			opId: result.op_id,
			itemId: result.item_id,
		};
	}

	async forkAgent(request: UniverseAgentForkAgentRequest): Promise<UniverseAgentForkAgentResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; agent_id?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Fork,
		);
		const wire = await unary({
			session_id: request.sessionId,
			parent_agent_id: request.parentAgentId?.trim() || 'root',
			name: request.name ?? '',
			task: request.task ?? '',
			model_type: request.modelType ?? '',
			system_prompt: request.systemPrompt ?? '',
		});
		const agentId = wire.agent_id?.trim();
		return {
			ok: wire.success === true,
			...(agentId ? { agentId } : {}),
		};
	}

	async killAgent(request: UniverseAgentKillAgentRequest): Promise<UniverseAgentKillAgentResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Kill,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			force: request.force === true,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async deleteMessage(request: UniverseAgentDeleteMessageRequest): Promise<UniverseAgentDeleteMessageResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string; current_turn_id?: string; removed_turn_count?: number }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.DeleteMessage,
		);
		const wire = await unary({
			session_id: request.sessionId,
			turn_id: request.turnId,
			agent_id: request.agentId?.trim() || 'root',
			operation_id: request.operationId ?? '',
		});
		const currentTurnId = wire.current_turn_id?.trim();
		return {
			ok: wire.success === true,
			message: wire.message,
			...(currentTurnId ? { currentTurnId } : {}),
			...(typeof wire.removed_turn_count === 'number' ? { removedTurnCount: wire.removed_turn_count } : {}),
		};
	}

	async editMessage(request: UniverseAgentEditMessageRequest): Promise<UniverseAgentEditMessageResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.EditMessage,
		);
		const wire = await unary({
			session_id: request.sessionId,
			turn_id: request.turnId,
			new_content: request.newContent,
			agent_id: request.agentId?.trim() || 'root',
			operation_id: request.operationId ?? '',
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async sendClientToolResponse(request: UniverseAgentSendClientToolResponseRequest): Promise<UniverseAgentSendClientToolResponseResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; error?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SendClientToolResponse,
		);
		const wire = await unary({
			session_id: request.sessionId,
			response: {
				call_id: request.callId,
				is_error: request.isError === true,
				content: request.content ?? '',
				metadata_json: request.metadataJson ?? '',
				canvas_refs: canvasRefsWire(request.canvasRefs),
			},
		});
		return {
			ok: wire.success === true,
			message: wire.error,
		};
	}

	async listSnapshots(request: UniverseAgentListSnapshotsRequest): Promise<UniverseAgentListSnapshotsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListSnapshotsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ListSnapshots,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapListSnapshotsResponse(wire);
	}

	async listLoopSnapshots(request: UniverseAgentListLoopSnapshotsRequest): Promise<UniverseAgentListLoopSnapshotsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListLoopSnapshotsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ListLoopSnapshots,
		);
		const wire = await unary({
			session_id: request.sessionId,
			loop_id: request.loopId,
		});
		return mapListLoopSnapshotsResponse(wire);
	}

	async createSnapshot(request: UniverseAgentCreateSnapshotRequest): Promise<UniverseAgentCreateSnapshotResult> {
		const unary = makeUnaryClient<Record<string, unknown>, CreateSnapshotResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.CreateSnapshot,
		);
		const wire = await unary({
			session_id: request.sessionId,
			title: request.title,
			description: request.description ?? '',
		});
		return mapCreateSnapshotResponse(wire);
	}

	async restoreSnapshot(request: UniverseAgentRestoreSnapshotRequest): Promise<UniverseAgentRestoreSnapshotResult> {
		const unary = makeUnaryClient<Record<string, unknown>, RestoreSnapshotResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.RestoreSnapshot,
		);
		const wire = await unary({
			session_id: request.sessionId,
			snapshot_id: request.snapshotId,
		});
		return mapRestoreSnapshotResponse(wire);
	}

	async deleteSnapshot(request: UniverseAgentDeleteSnapshotRequest): Promise<UniverseAgentDeleteSnapshotResult> {
		const unary = makeUnaryClient<Record<string, unknown>, DeleteSnapshotResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.DeleteSnapshot,
		);
		const wire = await unary({
			session_id: request.sessionId,
			snapshot_id: request.snapshotId,
		});
		return mapDeleteSnapshotResponse(wire);
	}

	async getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetHistoryResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.GetHistory,
		);
		const wire = await unary({
			session_id: request.sessionId,
			cursor_seq: request.cursorSeq,
			limit: request.limit,
		});
		return mapGetHistoryResponse(wire);
	}

	subscribeSessionEventStream(
		sessionId: string,
		listener: (event: UniverseAgentSessionEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		const stream = makeServerStreamClient<Record<string, unknown>, UniverseAgentSessionEvent>(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.SessionEventStream,
		);
		return stream({ session_id: sessionId }, listener, onClosed);
	}

	async chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
		const bidi = makeBidiStreamClient<Record<string, unknown>, UniverseAgentChatResponse>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Chat,
		);
		await bidi({ session_id: request.sessionId, payload: request.payload }, onResponse);
	}

	async chatSync(request: UniverseAgentChatSyncRequest): Promise<UniverseAgentChatSyncResult> {
		const unary = makeUnaryClient<Record<string, unknown>, Parameters<typeof mapChatSyncResponse>[0]>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ChatSync,
		);
		const wire = await unary(chatSyncRequestWire(request));
		return mapChatSyncResponse(wire);
	}

	async syncInputDelivery(request: UniverseAgentSyncInputDeliveryRequest): Promise<UniverseAgentSyncInputDeliveryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, Parameters<typeof mapSyncInputDeliveryResponse>[0]>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SyncInputDelivery,
		);
		const wire = await unary(syncInputDeliveryRequestWire(request));
		return mapSyncInputDeliveryResponse(wire);
	}

	openChatStream(
		sessionId: string,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentChatStream {
		const open = makeResidentBidiStreamClient<UniverseAgentChatResponse>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Chat,
		);
		return open(sessionId, onResponse, onClosed);
	}

	openContinuationStream(
		request: UniverseAgentContinueGenerationRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentContinuationStream {
		const stream = makeServerStreamClient<Record<string, unknown>, UniverseAgentChatResponse>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ContinueGeneration,
		);
		return stream({
			session_id: request.sessionId,
			agent_id: request.agentId,
			turn_id: request.turnId,
			message_id: request.messageId,
		}, onResponse, onClosed);
	}

	openRegenerateStream(
		request: UniverseAgentRegenerateRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentRegenerateStream {
		const stream = makeServerStreamClient<Record<string, unknown>, UniverseAgentChatResponse>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Regenerate,
		);
		return stream({
			session_id: request.sessionId,
			agent_id: request.agentId,
			turn_id: request.turnId,
			message_id: request.messageId,
		}, onResponse, onClosed);
	}

	openResumeStream(
		request: UniverseAgentResumeRequest,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentResumeStream {
		const stream = makeServerStreamClient<Record<string, unknown>, UniverseAgentChatResponse>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Resume,
		);
		return stream({
			session_id: request.sessionId,
			agent_id: request.agentId,
		}, onResponse, onClosed);
	}

	openSubscribeToolDetailStream(
		request: UniverseAgentSubscribeToolDetailRequest,
		onResponse: (response: UniverseAgentSubscribeToolDetailChunk) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentSubscribeToolDetailStream {
		const stream = makeServerStreamClient<Record<string, unknown>, SubscribeToolDetailChunkWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SubscribeToolDetail,
		);
		return stream({
			session_id: request.sessionId,
			tool_call_id: request.toolCallId,
			detail_kind: request.detailKind,
			ref_id: request.refId,
			from_revision: request.fromRevision,
			...(request.mimeType !== undefined ? { mime_type: request.mimeType } : {}),
			...(request.tailBytes !== undefined ? { tail_bytes: request.tailBytes } : {}),
		}, wire => onResponse(mapSubscribeToolDetailChunk(wire)), onClosed);
	}

	async listSkills(): Promise<UniverseAgentListSkillsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListSkillsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ListSkills,
		);
		const wire = await unary({});
		return mapListSkillsResponse(wire);
	}

	async setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SetSkillEnabledResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SetSkillEnabled,
		);
		const wire = await unary({
			skill_name: request.skillName,
			enabled: request.enabled,
		});
		return mapSetSkillEnabledResponse(wire);
	}

	async getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SkillInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SkillInfo,
		);
		const wire = await unary({ skill_name: request.skillName });
		return mapSkillInfoResponse(wire);
	}

	async saveSkillContent(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SaveSkillContentResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SaveSkillContent,
		);
		const wire = await unary({
			skill_name: request.skillName,
			content: request.content,
		});
		return mapSaveSkillContentResponse(wire);
	}

	async listAgentProfiles(request: UniverseAgentListAgentProfilesRequest): Promise<UniverseAgentListAgentProfilesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListAgentProfilesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ListAgentProfiles,
		);
		const payload: Record<string, unknown> = {};
		if (request.projectPath) {
			payload.project_path = request.projectPath;
		}
		const wire = await unary(payload);
		return mapListAgentProfilesResponse(wire);
	}

	async saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SaveAgentProfileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SaveAgentProfile,
		);
		const wire = await unary({
			profile: mapAgentProfileDetailToWire(request.profile),
		});
		return mapSaveAgentProfileResponse(wire);
	}

	async deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, DeleteAgentProfileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.DeleteAgentProfile,
		);
		const wire = await unary({ id: request.id });
		return mapDeleteAgentProfileResponse(wire);
	}

	async resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ResetAgentProfileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ResetAgentProfile,
		);
		const wire = await unary({ id: request.id });
		return mapResetAgentProfileResponse(wire);
	}

	async listMcpServers(request: UniverseAgentListMcpServersRequest): Promise<UniverseAgentListMcpServersResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListMcpServersResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.ListMcpServers,
		);
		const payload: Record<string, unknown> = {};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		if (request.enabledOnly !== undefined) {
			payload.enabled_only = request.enabledOnly;
		}
		const wire = await unary(payload);
		return mapListMcpServersResponse(wire);
	}

	async getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetMcpServerStatusesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.GetMcpServerStatuses,
		);
		const payload: Record<string, unknown> = {};
		if (serverIds && serverIds.length > 0) {
			payload.server_ids = [...serverIds];
		}
		const wire = await unary(payload);
		return mapGetMcpServerStatusesResponse(wire);
	}

	async getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetMcpServerToolsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.GetMcpServerTools,
		);
		const wire = await unary({
			server_id: serverId,
			force_refresh: forceRefresh === true,
		});
		return mapGetMcpServerToolsResponse(wire);
	}

	async listPlugins(): Promise<UniverseAgentListPluginsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListPluginsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.List,
		);
		const wire = await unary({});
		return mapListPluginsResponse(wire);
	}

	async getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult> {
		const unary = makeUnaryClient<Record<string, unknown>, PluginInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Info,
		);
		const wire = await unary({ plugin_id: id });
		return mapPluginInfoResponse(wire);
	}

	async enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult> {
		const unary = makeUnaryClient<Record<string, unknown>, EnablePluginResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Enable,
		);
		const wire = await unary({
			plugin_id: id,
			enabled: enabled !== false,
		});
		return { plugin: mapPluginSummary(wire.plugin) };
	}

	async reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ReloadPluginResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Reload,
		);
		const wire = await unary({ plugin_id: id });
		return { plugin: mapPluginSummary(wire.plugin) };
	}

	async unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult> {
		const unary = makeUnaryClient<Record<string, unknown>, UnloadPluginResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Unload,
		);
		const wire = await unary({ plugin_id: id });
		return { removedHookCount: wire.removed_hook_count ?? 0 };
	}

	async scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ScanNewPluginsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.ScanNew,
		);
		const wire = await unary({});
		return {
			newPlugins: (wire.new_plugins ?? []).map(mapPluginSummary),
			skippedCount: wire.skipped_count ?? 0,
		};
	}

	async toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ToggleMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.ToggleMcpServer,
		);
		const payload: Record<string, unknown> = {
			server_id: request.id,
			enabled: request.enabled,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapToggleMcpServerResponse(wire);
	}

	async addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, AddMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.AddMcpServer,
		);
		const payload: Record<string, unknown> = {
			config: mapMcpServerConfigToWire(request.config),
			test_connection: request.testConnection === true,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapAddMcpServerResponse(wire);
	}

	async updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, UpdateMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.UpdateMcpServer,
		);
		const payload: Record<string, unknown> = {
			server_id: request.serverId,
			config: mapMcpServerConfigToWire(request.config),
			restart_connection: request.restartConnection === true,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapUpdateMcpServerResponse(wire);
	}

	async removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, RemoveMcpServerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.RemoveMcpServer,
		);
		const payload: Record<string, unknown> = {
			server_id: request.serverId,
			force: request.force === true,
			scope: request.scope,
		};
		if (request.workDir) {
			payload.work_dir = request.workDir;
		}
		const wire = await unary(payload);
		return mapRemoveMcpServerResponse(wire);
	}

	async listTools(): Promise<UniverseAgentListToolsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListToolsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ListTools,
		);
		const wire = await unary({});
		return mapListToolsResponse(wire);
	}

	async getToolInfo(request: UniverseAgentToolInfoRequest): Promise<UniverseAgentToolInfoResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ToolInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ToolInfo,
		);
		const wire = await unary({ tool_name: request.toolName });
		return mapToolInfoResponse(wire);
	}

	async listCommands(): Promise<UniverseAgentListCommandsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListCommandsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ListCommands,
		);
		const wire = await unary({});
		return mapListCommandsResponse(wire);
	}

	async getCommandDef(request: UniverseAgentGetCommandDefRequest): Promise<UniverseAgentGetCommandDefResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetCommandDefResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.GetCommandDef,
		);
		const wire = await unary({ command_name: request.commandName });
		return mapGetCommandDefResponse(wire);
	}

	async listFiles(request: UniverseAgentListFilesRequest): Promise<UniverseAgentListFilesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListFilesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.ListFiles,
		);
		const wire = await unary({
			path: request.path,
			session_id: request.sessionId,
			recursive: request.recursive,
			pattern: request.pattern,
			max_results: request.maxResults,
		});
		return mapListFilesResponse(wire);
	}

	async readFile(request: UniverseAgentReadFileRequest): Promise<UniverseAgentReadFileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ReadFileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.ReadFile,
		);
		const wire = await unary({
			path: request.path,
			session_id: request.sessionId,
			start_line: request.startLine,
			end_line: request.endLine,
			max_bytes: request.maxBytes,
		});
		return mapReadFileResponse(wire);
	}

	async getFileInfo(request: UniverseAgentGetFileInfoRequest): Promise<UniverseAgentGetFileInfoResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetFileInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.GetFileInfo,
		);
		const wire = await unary({
			path: request.path,
			session_id: request.sessionId,
		});
		return mapGetFileInfoResponse(wire);
	}

	async writeFile(request: UniverseAgentWriteFileRequest): Promise<UniverseAgentWriteFileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, WriteFileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.WriteFile,
		);
		const wire = await unary({
			path: request.path,
			content: bytesToBase64(request.content),
			base_hash: request.baseHash,
			session_id: request.sessionId,
			base_content: bytesToBase64(request.baseContent),
		});
		return mapWriteFileResponse(wire);
	}

	async forceWriteFile(request: UniverseAgentForceWriteFileRequest): Promise<UniverseAgentWriteFileResult> {
		const unary = makeUnaryClient<Record<string, unknown>, WriteFileResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.ForceWriteFile,
		);
		const wire = await unary({
			path: request.path,
			content: bytesToBase64(request.content),
			session_id: request.sessionId,
		});
		return mapWriteFileResponse(wire);
	}

	async agentMerge(request: UniverseAgentAgentMergeRequest): Promise<UniverseAgentAgentMergeResult> {
		const unary = makeUnaryClient<Record<string, unknown>, AgentMergeResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.AgentMerge,
		);
		const wire = await unary({
			session_id: request.sessionId,
			path: request.path,
			base_content: bytesToBase64(request.baseContent),
			current_content: bytesToBase64(request.currentContent),
			user_content: bytesToBase64(request.userContent),
		});
		return mapAgentMergeResponse(wire);
	}

	async readGitSummary(request: UniverseAgentReadGitSummaryRequest): Promise<UniverseAgentReadGitSummaryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ReadGitSummaryResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.ReadGitSummary,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapReadGitSummaryResponse(wire);
	}

	async readGitChanges(request: UniverseAgentReadGitChangesRequest): Promise<UniverseAgentReadGitChangesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ReadGitChangesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.ReadGitChanges,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapReadGitChangesResponse(wire);
	}

	async readGitFileDiff(request: UniverseAgentReadGitFileDiffRequest): Promise<UniverseAgentReadGitFileDiffResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ReadGitFileDiffResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.ReadGitFileDiff,
		);
		const wire = await unary({
			session_id: request.sessionId,
			path: request.path,
			index_state: request.indexState,
		});
		return mapReadGitFileDiffResponse(wire);
	}

	async writeGitStagePaths(request: UniverseAgentWriteGitStagePathsRequest): Promise<UniverseAgentWriteGitWriteResult> {
		const unary = makeUnaryClient<Record<string, unknown>, WriteGitWriteResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.WriteGitStagePaths,
		);
		const wire = await unary({
			session_id: request.sessionId,
			commands: request.commands.map(command => ({ argv: [...command.argv] })),
		});
		return mapWriteGitWriteResponse(wire);
	}

	async writeGitCommit(request: UniverseAgentWriteGitCommitRequest): Promise<UniverseAgentWriteGitWriteResult> {
		const unary = makeUnaryClient<Record<string, unknown>, WriteGitWriteResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.WriteGitCommit,
		);
		const wire = await unary({
			session_id: request.sessionId,
			message: request.message,
			sign_off: request.signOff,
			amend: request.amend,
		});
		return mapWriteGitWriteResponse(wire);
	}

	async writeGitApplyHunks(request: UniverseAgentWriteGitApplyHunksRequest): Promise<UniverseAgentWriteGitWriteResult> {
		const unary = makeUnaryClient<Record<string, unknown>, WriteGitWriteResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.WriteGitApplyHunks,
		);
		const wire = await unary({
			session_id: request.sessionId,
			argv: [...request.argv],
			patches: [...request.patches],
		});
		return mapWriteGitWriteResponse(wire);
	}

	async getSessionUsage(request: UniverseAgentGetSessionUsageRequest): Promise<UniverseAgentGetSessionUsageResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetSessionUsageResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.TokenUsage.service,
			UniverseAgentGrpcServices.TokenUsage.GetSessionUsage,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return mapGetSessionUsageResponse(wire);
	}

	async getGlobalUsage(): Promise<UniverseAgentGetGlobalUsageResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetGlobalUsageResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.TokenUsage.service,
			UniverseAgentGrpcServices.TokenUsage.GetGlobalUsage,
		);
		const wire = await unary({});
		return mapGetGlobalUsageResponse(wire);
	}

	async saveMemory(request: UniverseAgentSaveMemoryRequest): Promise<UniverseAgentSaveMemoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemorySaveResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Save,
		);
		const wire = await unary({
			scope: request.scope,
			content: request.content,
			category: request.category,
		});
		return mapMemorySaveResponse(wire);
	}

	async searchMemory(request: UniverseAgentMemorySearchRequest): Promise<UniverseAgentMemorySearchResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemorySearchResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Search,
		);
		const wire = await unary({
			scope: request.scope,
			query: request.query,
			keywords: [...request.keywords],
			limit: request.limit,
		});
		return mapMemorySearchResponse(wire);
	}

	async searchDeepMemory(request: UniverseAgentMemorySearchDeepRequest): Promise<UniverseAgentMemorySearchDeepResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemorySearchDeepResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.SearchDeep,
		);
		const wire = await unary({
			scope: request.scope,
			query: request.query,
			keywords: [...request.keywords],
			categories: [...request.categories],
			limit: request.limit,
			include_content: request.includeContent,
		});
		return mapMemorySearchDeepResponse(wire);
	}

	async readMemory(request: UniverseAgentReadMemoryRequest): Promise<UniverseAgentReadMemoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemoryReadResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Read,
		);
		const wire = await unary({
			scope: request.scope,
			category: request.category,
			filename: request.filename,
			section: request.section,
			mode: request.mode,
			forgot: request.forgot,
		});
		return mapMemoryReadResponse(wire);
	}

	async listMemory(request: UniverseAgentMemoryListRequest): Promise<UniverseAgentMemoryListResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemoryListResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.List,
		);
		const wire = await unary({
			scope: request.scope,
			category: request.category,
		});
		return mapMemoryListResponse(wire);
	}

	async deleteMemory(request: UniverseAgentDeleteMemoryRequest): Promise<UniverseAgentDeleteMemoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemoryDeleteResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Delete,
		);
		const wire = await unary({
			scope: request.scope,
			category: request.category,
			filename: request.filename,
		});
		return mapMemoryDeleteResponse(wire);
	}

	async reflectMemory(request: UniverseAgentReflectMemoryRequest): Promise<UniverseAgentReflectMemoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemoryReflectResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Reflect,
		);
		const wire = await unary({
			scope: request.scope,
			categories: [...request.categories],
		});
		return mapMemoryReflectResponse(wire);
	}

	openRebuildMemoryStream(
		request: UniverseAgentMemoryRebuildRequest,
		onResponse: (response: UniverseAgentMemoryRebuildEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentMemoryRebuildStream {
		const stream = makeServerStreamClient<Record<string, unknown>, MemoryRebuildEventWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Rebuild,
		);
		return stream({
			scope: request.scope,
			dry_run: request.dryRun,
		}, wire => onResponse(mapMemoryRebuildEvent(wire)), onClosed);
	}

	async revertMemory(request: UniverseAgentRevertMemoryRequest): Promise<UniverseAgentRevertMemoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemoryRevertResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Revert,
		);
		const wire = await unary({
			scope: request.scope,
			category: request.category,
			filename: request.filename,
			target_version: request.targetVersion,
		});
		return mapMemoryRevertResponse(wire);
	}

	async historyMemory(request: UniverseAgentMemoryHistoryRequest): Promise<UniverseAgentMemoryHistoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, MemoryHistoryResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.History,
		);
		const wire = await unary({
			scope: request.scope,
			category: request.category,
			filename: request.filename,
			limit: request.limit,
		});
		return mapMemoryHistoryResponse(wire);
	}

	async listContextVariable(request: UniverseAgentContextVariableListRequest): Promise<UniverseAgentContextVariableListResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ContextVariableListResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.ContextVariable.service,
			UniverseAgentGrpcServices.ContextVariable.List,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
		});
		return mapContextVariableListResponse(wire);
	}

	async readContextVariable(request: UniverseAgentContextVariableReadRequest): Promise<UniverseAgentContextVariableReadResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ContextVariableReadResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.ContextVariable.service,
			UniverseAgentGrpcServices.ContextVariable.Read,
		);
		const wire = await unary({
			session_id: request.sessionId,
			name: request.name,
			agent_id: request.agentId,
		});
		return mapContextVariableReadResponse(wire);
	}

	async listNodes(request: UniverseAgentListNodesRequest): Promise<UniverseAgentListNodesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListNodesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ListNodes,
		);
		const wire = await unary({
			filter_status: [...request.filterStatus],
			filter_tags: [...request.filterTags],
		});
		return mapListNodesResponse(wire);
	}

	async getNode(request: UniverseAgentGetNodeRequest): Promise<UniverseAgentRemoteAgentInfo> {
		const unary = makeUnaryClient<Record<string, unknown>, RemoteAgentInfoWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.GetNode,
		);
		const wire = await unary({
			node_id: request.nodeId,
		});
		return mapRemoteAgentInfo(wire);
	}

	async checkConnection(request: UniverseAgentCheckConnectionRequest): Promise<UniverseAgentConnectionReport> {
		const unary = makeUnaryClient<Record<string, unknown>, ConnectionReportWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.CheckConnection,
		);
		const wire = await unary({
			node_id: request.nodeId,
			session_params: {
				preferred_model: request.sessionParams.preferredModel,
				required_tools: [...request.sessionParams.requiredTools],
				mode: request.sessionParams.mode,
				max_tokens: request.sessionParams.maxTokens,
				max_turns: request.sessionParams.maxTurns,
				system_prompt_suffix: request.sessionParams.systemPromptSuffix,
				max_execution_time_ms: request.sessionParams.maxExecutionTimeMs,
			},
		});
		return mapConnectionReport(wire);
	}

	async setMaintenance(request: UniverseAgentSetMaintenanceRequest): Promise<UniverseAgentSetMaintenanceResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SetMaintenanceResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.SetMaintenance,
		);
		const wire = await unary({
			node_id: request.nodeId,
		});
		return mapSetMaintenanceResponse(wire);
	}

	async exitMaintenance(request: UniverseAgentExitMaintenanceRequest): Promise<UniverseAgentExitMaintenanceResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ExitMaintenanceResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ExitMaintenance,
		);
		const wire = await unary({
			node_id: request.nodeId,
		});
		return mapExitMaintenanceResponse(wire);
	}

	async listConfigs(): Promise<UniverseAgentListConfigsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListConfigsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ListConfigs,
		);
		const wire = await unary({});
		return mapListConfigsResponse(wire);
	}

	async getRemoteAgentConfig(request: UniverseAgentGetRemoteAgentConfigRequest): Promise<UniverseAgentRemoteAgentConfig> {
		const unary = makeUnaryClient<Record<string, unknown>, RemoteAgentConfigWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.GetConfig,
		);
		const wire = await unary({
			node_id: request.nodeId,
		});
		return mapRemoteAgentConfig(wire);
	}

	async saveRemoteAgentConfig(request: UniverseAgentSaveRemoteAgentConfigRequest): Promise<UniverseAgentSaveRemoteAgentConfigResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SaveRemoteAgentConfigResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.SaveConfig,
		);
		const wire = await unary({
			config: encodeRemoteAgentConfig(request.config),
			skip_connection_test: request.skipConnectionTest,
			async_test: request.asyncTest,
		});
		return mapSaveRemoteAgentConfigResponse(wire);
	}

	async resetError(request: UniverseAgentResetErrorRequest): Promise<UniverseAgentResetErrorResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ResetErrorResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ResetError,
		);
		const wire = await unary({
			node_id: request.nodeId,
		});
		return mapResetErrorResponse(wire);
	}

	async deleteRemoteAgentConfig(request: UniverseAgentDeleteRemoteAgentConfigRequest): Promise<UniverseAgentDeleteRemoteAgentConfigResult> {
		const unary = makeUnaryClient<Record<string, unknown>, DeleteRemoteAgentConfigResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.DeleteConfig,
		);
		const wire = await unary({
			node_id: request.nodeId,
		});
		return mapDeleteRemoteAgentConfigResponse(wire);
	}

	async reloadRemoteAgents(): Promise<UniverseAgentReloadRemoteAgentsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ReloadRemoteAgentsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.Reload,
		);
		const wire = await unary({});
		return mapReloadRemoteAgentsResponse(wire);
	}

	async createRemoteSession(request: UniverseAgentCreateRemoteSessionRequest): Promise<UniverseAgentCreateRemoteSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, CreateRemoteSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.CreateRemoteSession,
		);
		const wire = await unary({
			node_id: request.nodeId,
			mode: request.mode,
			session_params: {
				preferred_model: request.sessionParams.preferredModel,
				required_tools: [...request.sessionParams.requiredTools],
				mode: request.sessionParams.mode,
				max_tokens: request.sessionParams.maxTokens,
				max_turns: request.sessionParams.maxTurns,
				system_prompt_suffix: request.sessionParams.systemPromptSuffix,
				max_execution_time_ms: request.sessionParams.maxExecutionTimeMs,
			},
		});
		return mapCreateRemoteSessionResponse(wire);
	}

	async destroyRemoteSession(request: UniverseAgentDestroyRemoteSessionRequest): Promise<UniverseAgentDestroyRemoteSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, DestroyRemoteSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.DestroyRemoteSession,
		);
		const wire = await unary({
			call_id: request.callId,
		});
		return mapDestroyRemoteSessionResponse(wire);
	}

	async getRemoteSessionStatus(request: UniverseAgentGetRemoteSessionStatusRequest): Promise<UniverseAgentGetRemoteSessionStatusResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetRemoteSessionStatusResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.GetRemoteSessionStatus,
		);
		const wire = await unary({
			call_id: request.callId,
		});
		return mapGetRemoteSessionStatusResponse(wire);
	}

	async getRemoteSessionHistory(request: UniverseAgentGetRemoteSessionHistoryRequest): Promise<UniverseAgentGetRemoteSessionHistoryResult> {
		const unary = makeUnaryClient<Record<string, unknown>, GetRemoteSessionHistoryResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.GetRemoteSessionHistory,
		);
		const wire = await unary({
			call_id: request.callId,
			since_version: request.sinceVersion,
			page_size: request.pageSize,
		});
		return mapGetRemoteSessionHistoryResponse(wire);
	}
	async resumeRemoteSession(request: UniverseAgentResumeRemoteSessionRequest): Promise<UniverseAgentResumeRemoteSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ResumeRemoteSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ResumeRemoteSession,
		);
		const wire = await unary({
			call_id: request.callId,
			node_id: request.nodeId,
		});
		return mapResumeRemoteSessionResponse(wire);
	}

	async getUploadProgress(request: UniverseAgentGetUploadProgressRequest): Promise<UniverseAgentGetUploadProgressResult> {
		const unary = makeUnaryClient<Record<string, unknown>, UploadProgressResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.FileTransfer.service,
			UniverseAgentGrpcServices.FileTransfer.GetUploadProgress,
		);
		const wire = await unary({
			transfer_id: request.transferId,
			session_id: request.sessionId,
		});
		return mapUploadProgressResponse(wire);
	}

	openUploadAttachmentStream(
		onResponse: (response: UniverseAgentUploadAttachmentResult) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentUploadAttachmentStream {
		const stream = makeClientStreamClient<Record<string, unknown>, UploadResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.FileTransfer.service,
			UniverseAgentGrpcServices.FileTransfer.UploadAttachment,
		);
		const handle = stream(wire => onResponse(mapUploadResponse(wire)), onClosed);
		return {
			write(chunk: UniverseAgentUploadChunk): void {
				handle.write(mapUploadChunkWire(chunk));
			},
			end(): void {
				handle.end();
			},
			dispose(): void {
				handle.dispose();
			},
		};
	}

	openDownloadAttachmentStream(
		request: UniverseAgentDownloadAttachmentRequest,
		onResponse: (response: UniverseAgentDownloadChunk) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentDownloadAttachmentStream {
		const stream = makeServerStreamClient<Record<string, unknown>, DownloadChunkWire>(
			this._channel,
			UniverseAgentGrpcServices.FileTransfer.service,
			UniverseAgentGrpcServices.FileTransfer.DownloadAttachment,
		);
		return stream({
			file_path: request.filePath,
			offset: request.offset,
			max_bytes: request.maxBytes,
			session_id: request.sessionId,
			artifact_id: request.artifactId,
		}, wire => onResponse(mapDownloadChunk(wire)), onClosed);
	}

	async doctor(): Promise<UniverseAgentDoctorResult> {
		const unary = makeUnaryClient<Record<string, unknown>, DoctorResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Doctor,
		);
		const wire = await unary({});
		return mapDoctorResponse(wire);
	}

	async listDevices(): Promise<UniverseAgentListDevicesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListDevicesResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.ListDevices,
		);
		const wire = await unary({});
		return mapListDevicesResponse(wire);
	}

	async pairApprove(request: UniverseAgentPairApproveRequest): Promise<UniverseAgentPairApproveResult> {
		const unary = makeUnaryClient<Record<string, unknown>, PairApproveResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.PairApprove,
		);
		const wire = await unary({
			pairing_code: request.pairingCode,
			display_name: request.displayName,
			role: request.role,
		});
		return mapPairApproveResponse(wire);
	}

	async pairReject(request: UniverseAgentPairRejectRequest): Promise<UniverseAgentPairRejectResult> {
		const unary = makeUnaryClient<Record<string, unknown>, PairRejectResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.PairReject,
		);
		const wire = await unary({
			pairing_code: request.pairingCode,
		});
		return mapPairRejectResponse(wire);
	}

	async revoke(request: UniverseAgentRevokeRequest): Promise<UniverseAgentRevokeResult> {
		const unary = makeUnaryClient<Record<string, unknown>, RevokeDeviceResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.Revoke,
		);
		const wire = await unary({
			device_id: request.deviceId,
		});
		return mapRevokeResponse(wire);
	}

	async rotateToken(request: UniverseAgentRotateTokenRequest): Promise<UniverseAgentRotateTokenResult> {
		const unary = makeUnaryClient<Record<string, unknown>, RotateTokenResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.RotateToken,
		);
		const wire = await unary({
			device_id: request.deviceId,
		});
		return mapRotateTokenResponse(wire);
	}

	async listPending(): Promise<UniverseAgentListPendingResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListPendingResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.ListPending,
		);
		const wire = await unary({});
		return mapListPendingResponse(wire);
	}

	async listTriggers(request: UniverseAgentListTriggersRequest): Promise<UniverseAgentListTriggersResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListTriggersResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.ListTriggers,
		);
		const wire = await unary({
			scope: request.scope,
			scope_id: request.scopeId,
			type_filter: request.typeFilter,
		});
		return mapListTriggersResponse(wire);
	}

	async upsertTrigger(request: UniverseAgentUpsertTriggerRequest): Promise<UniverseAgentUpsertTriggerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, UpsertTriggerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.UpsertTrigger,
		);
		const wire = await unary({
			scope: request.scope,
			scope_id: request.scopeId,
			trigger: triggerDtoWire(request.trigger),
		});
		return mapUpsertTriggerResponse(wire);
	}

	async deleteTrigger(request: UniverseAgentDeleteTriggerRequest): Promise<UniverseAgentDeleteTriggerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, Record<string, unknown>>(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.DeleteTrigger,
		);
		const wire = await unary({
			scope: request.scope,
			scope_id: request.scopeId,
			trigger_id: request.triggerId,
		});
		return mapDeleteTriggerResponse(wire);
	}

	async setTriggerEnabled(request: UniverseAgentSetTriggerEnabledRequest): Promise<UniverseAgentSetTriggerEnabledResult> {
		const unary = makeUnaryClient<Record<string, unknown>, SetTriggerEnabledResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.SetTriggerEnabled,
		);
		const wire = await unary({
			scope: request.scope,
			scope_id: request.scopeId,
			trigger_id: request.triggerId,
			enabled: request.enabled,
		});
		return mapSetTriggerEnabledResponse(wire);
	}

	async fireTrigger(request: UniverseAgentFireTriggerRequest): Promise<UniverseAgentFireTriggerResult> {
		const unary = makeUnaryClient<Record<string, unknown>, FireTriggerResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.FireTrigger,
		);
		const wire = await unary({
			scope: request.scope,
			scope_id: request.scopeId,
			trigger_id: request.triggerId,
		});
		return mapFireTriggerResponse(wire);
	}

	async setPermissionPolicy(request: UniverseAgentSetPermissionPolicyRequest): Promise<UniverseAgentSetPermissionPolicyResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.SetPermissionPolicy,
		);
		const wire = await unary({
			session_id: request.sessionId,
			tool_name: request.toolName,
			policy: permissionPolicyWire(request.policy),
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async listModels(): Promise<UniverseAgentListModelsResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ListModelsResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.ListModels,
		);
		const wire = await unary({ include_disabled: true });
		return mapListModelsResponse(wire);
	}

	async getConfig(request: UniverseAgentGetConfigRequest): Promise<UniverseAgentGetConfigResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { values?: Record<string, string>; scope?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.Get,
		);
		const wire = await unary({
			key: request.key,
			scope: request.scope,
			session_id: request.sessionId,
		});
		return {
			values: wire.values && typeof wire.values === 'object' ? wire.values : {},
			scope: wire.scope ?? '',
		};
	}

	async getModelPreferences(request: UniverseAgentGetModelPreferencesRequest): Promise<UniverseAgentGetModelPreferencesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			min_level?: number;
			max_cost?: string;
			min_speed?: string;
			strategy?: string;
		}>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.GetModelPreferences,
		);
		const wire = await unary({
			session_id: request.sessionId,
		});
		return {
			minLevel: wire.min_level ?? 0,
			maxCost: wire.max_cost ?? '',
			minSpeed: wire.min_speed ?? '',
			strategy: wire.strategy ?? '',
		};
	}

	async setConfig(request: UniverseAgentSetConfigRequest): Promise<UniverseAgentSetConfigResult> {
		const unary = makeUnaryClient<Record<string, unknown>, { success?: boolean; message?: string }>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.Set,
		);
		const wire = await unary({
			key: request.key,
			value: request.value,
			scope: request.scope,
			session_id: request.sessionId,
		});
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async switchModel(request: UniverseAgentSwitchModelRequest): Promise<UniverseAgentSwitchModelResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			resolved_model_id?: string;
			provider?: string;
			level?: number;
			cost?: string;
			speed?: string;
		}>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.SwitchModel,
		);
		const wire = await unary({
			session_id: request.sessionId,
			agent_id: request.agentId,
			model_type: request.modelType,
			model_id: request.modelId,
		});
		return {
			resolvedModelId: wire.resolved_model_id ?? '',
			provider: wire.provider ?? '',
			level: wire.level ?? 0,
			cost: wire.cost ?? '',
			speed: wire.speed ?? '',
		};
	}

	async setModelPreferences(request: UniverseAgentSetModelPreferencesRequest): Promise<UniverseAgentSetModelPreferencesResult> {
		const unary = makeUnaryClient<Record<string, unknown>, {
			preferences?: { min_level?: number; max_cost?: string; min_speed?: string; strategy?: string };
		}>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.SetModelPreferences,
		);
		const wire = await unary({
			session_id: request.sessionId,
			min_level: request.minLevel,
			max_cost: request.maxCost,
			min_speed: request.minSpeed,
			strategy: request.strategy,
		});
		const prefs = wire.preferences;
		return {
			minLevel: prefs?.min_level ?? 0,
			maxCost: prefs?.max_cost ?? '',
			minSpeed: prefs?.min_speed ?? '',
			strategy: prefs?.strategy ?? '',
		};
	}

	async resolveModel(request: UniverseAgentResolveModelRequest): Promise<UniverseAgentResolveModelResult> {
		const unary = makeUnaryClient<Record<string, unknown>, ResolveModelResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.ResolveModel,
		);
		const wire = await unary({
			session_id: request.sessionId,
			type: request.type,
		});
		return mapResolveModelResponse(wire);
	}

	openWatchConfigStream(
		request: UniverseAgentWatchConfigRequest,
		onResponse: (response: UniverseAgentConfigChangedEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentWatchConfigStream {
		const stream = makeServerStreamClient<Record<string, unknown>, ConfigChangedEventWire>(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.Watch,
		);
		return stream({
			keys: request.keys,
		}, wire => onResponse(mapConfigChangedEvent(wire)), onClosed);
	}

	async fetchToolDetail(request: UniverseAgentFetchToolDetailRequest): Promise<UniverseAgentFetchToolDetailWireResult> {
		const unary = makeUnaryClient<Record<string, unknown>, FetchToolDetailResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.FetchToolDetail,
		);
		const wire = await unary({
			session_id: request.sessionId,
			tool_call_id: request.toolCallId,
			detail_kind: request.detailKind,
			ref_id: request.refId,
			subscribe: false,
		});
		return {
			success: wire.success === true,
			content: wire.content ?? '',
			truncated: wire.truncated === true,
			...(typeof wire.total_bytes === 'number' && Number.isFinite(wire.total_bytes)
				? { totalBytes: wire.total_bytes }
				: {}),
			...(wire.error_message ? { errorMessage: wire.error_message } : {}),
		};
	}

	async fetchAgentTree(sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined> {
		const unary = makeUnaryClient<Record<string, unknown>, AgentTreeResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Tree,
		);
		const wire = await unary({ session_id: sessionId });
		return mapAgentTreeNode(wire.root);
	}

	async memberStatus(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamMemberInfo[]> {
		const unary = makeUnaryClient<Record<string, unknown>, MemberStatusResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.MemberStatus,
		);
		const wire = await unary({ session_id: sessionId, agent_id: agentId });
		return (wire.members ?? []).map(mapMemberInfo);
	}

	async taskList(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamTaskInfo[]> {
		const unary = makeUnaryClient<Record<string, unknown>, TaskListResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TaskList,
		);
		const wire = await unary({ session_id: sessionId, agent_id: agentId });
		return (wire.tasks ?? []).map(mapTaskInfo);
	}

	async teamInfo(sessionId: string, agentId: string, teamId: number): Promise<UniverseAgentTeamInfo | undefined> {
		const unary = makeUnaryClient<Record<string, unknown>, TeamInfoResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TeamInfo,
		);
		const wire = await unary({ session_id: sessionId, agent_id: agentId, team_id: teamId });
		if (wire.team_id === undefined) {
			return undefined;
		}
		return { teamId: wire.team_id, status: wire.status ?? '' };
	}
}

export function createGrpcUniverseAgentClient(address: string): IUniverseAgentGrpcTransport {
	return new GrpcUniverseAgentClient({ address });
}

export function createPinnedGrpcUniverseAgentClient(target: UniverseAgentPinnedTlsTarget): IUniverseAgentGrpcTransport {
	return new GrpcUniverseAgentClient({
		address: target.address,
		credentials: createPinnedTlsChannelCredentials(target.tls),
		channelOptions: createPinnedChannelOptions(target.sslTargetNameOverride),
	});
}
