/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as grpc from '@grpc/grpc-js';
import type {
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentChatSyncRequest,
	UniverseAgentChatSyncResult,
	UniverseAgentChatSyncSessionInput,
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
	UniverseAgentAnchorResolveScope,
	UniverseAgentResolveAnchorRequest,
	UniverseAgentResolveAnchorResult,
	UniverseAgentUsageRequest,
	UniverseAgentUsageResult,
	UniverseAgentAgentHistoryRequest,
	UniverseAgentAgentHistoryResult,
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
	UniverseAgentSessionEvent,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentListAgentProfilesRequest,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentAgentProfileSource,
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
	UniverseAgentListPluginsResult,
	UniverseAgentPluginInfoResult,
	UniverseAgentEnablePluginResult,
	UniverseAgentReloadPluginResult,
	UniverseAgentUnloadPluginResult,
	UniverseAgentScanNewPluginsResult,
	UniverseAgentMcpTransport,
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
	UniverseAgentMemorySearchDeepRequest,
	UniverseAgentMemorySearchDeepResult,
	UniverseAgentReadMemoryRequest,
	UniverseAgentReadMemoryResult,
	UniverseAgentMemoryListRequest,
	UniverseAgentMemoryListResult,
	UniverseAgentDeleteMemoryRequest,
	UniverseAgentDeleteMemoryResult,
	UniverseAgentReflectMemoryRequest,
	UniverseAgentReflectMemoryResult,
	UniverseAgentMemoryRebuildRequest,
	UniverseAgentMemoryRebuildEvent,
	UniverseAgentMemoryRebuildStream,
	UniverseAgentRevertMemoryRequest,
	UniverseAgentRevertMemoryResult,
	UniverseAgentMemoryHistoryRequest,
	UniverseAgentMemoryHistoryResult,
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
	UniverseAgentGetRemoteSessionHistoryRequest,
	UniverseAgentGetRemoteSessionHistoryResult,
	UniverseAgentResumeRemoteSessionRequest,
	UniverseAgentResumeRemoteSessionResult,
	UniverseAgentCancelRemoteSessionRequest,
	UniverseAgentCancelRemoteSessionResult,
	UniverseAgentRemoteChatRequest,
	UniverseAgentRemoteChatResponse,
	UniverseAgentRemoteChatStream,
	UniverseAgentRemoteResponse,
	UniverseAgentRemoteAgentConfig,
	UniverseAgentRemoteAgentInfo,
	UniverseAgentCheckConnectionRequest,
	UniverseAgentConnectionReport,
	UniverseAgentSetMaintenanceRequest,
	UniverseAgentSetMaintenanceResult,
	UniverseAgentExitMaintenanceRequest,
	UniverseAgentExitMaintenanceResult,
	UniverseAgentDeleteRemoteAgentConfigRequest,
	UniverseAgentDeleteRemoteAgentConfigResult,
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
	UniverseAgentDoctorResult,
	UniverseAgentShutdownRequest,
	UniverseAgentShutdownResult,
	UniverseAgentListDevicesResult,
	UniverseAgentPairApproveRequest,
	UniverseAgentPairApproveResult,
	UniverseAgentPairRejectRequest,
	UniverseAgentPairRejectResult,
	UniverseAgentRevokeRequest,
	UniverseAgentRevokeResult,
	UniverseAgentRotateTokenRequest,
	UniverseAgentRotateTokenResult,
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
} from './grpcTransport.js';
import { createPinnedChannelOptions, createPinnedTlsChannelCredentials, type UniverseAgentPinnedTlsTarget } from '../universeAgentChannel.js';
import {
	base64ToBytes,
	bytesToBase64,
	mapAddMcpServerResponse,
	mapAgentMergeResponse,
	mapAgentTreeNode,
	mapAuthNonceResponse,
	mapBackResponse,
	mapBranchResponse,
	mapCancelRemoteSessionResponse,
	mapChatSyncResponse,
	mapClipboardClearResponse,
	mapClipboardListResponse,
	mapClipboardReadResponse,
	mapClipboardWriteResponse,
	mapCompactResponse,
	mapConfigChangedEvent,
	mapConnectResponse,
	mapConnectionReport,
	mapContextVariableListResponse,
	mapContextVariableReadResponse,
	mapCreateRemoteSessionResponse,
	mapCreateSnapshotResponse,
	mapDeleteAgentProfileResponse,
	mapDeleteRemoteAgentConfigResponse,
	mapDeleteSnapshotResponse,
	mapDeleteTriggerResponse,
	mapDestroyRemoteSessionResponse,
	mapDoctorResponse,
	mapDownloadChunk,
	mapExitMaintenanceResponse,
	mapExportSessionResponse,
	mapFetchToolUsageDetailResponse,
	mapFireTriggerResponse,
	mapFireTriggerWebhookStatus,
	mapGetCommandDefResponse,
	mapGetFileInfoResponse,
	mapGetGlobalUsageResponse,
	mapGetHistoryResponse,
	mapGetMcpServerStatusesResponse,
	mapGetMcpServerToolsResponse,
	mapGetRemoteSessionHistoryResponse,
	mapGetRemoteSessionStatusResponse,
	mapGetSessionRulesResponse,
	mapGetSessionUsageResponse,
	mapHealthCheckResponse,
	mapHistoryResponse,
	mapListAgentProfilesResponse,
	mapListAgentsResponse,
	mapListCommandsResponse,
	mapListConfigsResponse,
	mapListDevicesResponse,
	mapListFilesResponse,
	mapListLoopSnapshotsResponse,
	mapListMcpServersResponse,
	mapListModelsResponse,
	mapListNodesResponse,
	mapListPendingResponse,
	mapListPluginsResponse,
	mapListSessionsResponse,
	mapListSkillsResponse,
	mapListSnapshotsResponse,
	mapListToolsResponse,
	mapListTriggersResponse,
	mapMemberInfo,
	mapTaskInfo,
	mapMemoryDeleteResponse,
	mapMemoryHistoryResponse,
	mapMemoryListResponse,
	mapMemoryReadResponse,
	mapMemoryRebuildEvent,
	mapMemoryReflectResponse,
	mapMemoryRevertResponse,
	mapMemorySaveResponse,
	mapMemorySearchDeepResponse,
	mapMemorySearchResponse,
	mapPairApproveResponse,
	mapPairRejectResponse,
	mapPluginInfoResponse,
	mapPluginSummary,
	mapPrewarmSessionsResponse,
	mapPruneResponse,
	mapPtyServerMessage,
	mapPurgeSessionResponse,
	mapReadFileResponse,
	mapReadGitChangesResponse,
	mapReadGitFileDiffResponse,
	mapReadGitSummaryResponse,
	mapReloadRemoteAgentsResponse,
	mapRemoteAgentConfig,
	mapRemoteAgentInfo,
	mapRemoteChatResponse,
	mapRemoveMcpServerResponse,
	mapResetAgentProfileResponse,
	mapResetErrorResponse,
	mapResolveAnchorResponse,
	mapResolveModelResponse,
	mapResolveTurnResponse,
	mapRestoreSnapshotResponse,
	mapResumeRemoteSessionResponse,
	mapResumeSessionResponse,
	mapRevokeResponse,
	mapRotateTokenResponse,
	mapSaveAgentProfileResponse,
	mapSaveRemoteAgentConfigResponse,
	mapSaveSkillContentResponse,
	mapSessionInfoResponse,
	mapSetMaintenanceResponse,
	mapSetSkillEnabledResponse,
	mapSetTriggerEnabledResponse,
	mapShelveSessionResponse,
	mapShutdownResponse,
	mapSkillInfoResponse,
	mapStatusResponse,
	mapSubscribeToolDetailChunk,
	mapSyncInputDeliveryResponse,
	mapTodoResponse,
	mapToggleMcpServerResponse,
	mapToolInfoResponse,
	mapUnshelveSessionResponse,
	mapUpdateMcpServerResponse,
	mapUploadProgressResponse,
	mapUploadResponse,
	mapUpsertTriggerResponse,
	mapUsageResponse,
	mapWriteFileResponse,
	mapWriteGitWriteResponse,
} from './grpcClientMappers.js';
import {
	makeUnaryClient,
	makeServerStreamClient,
	makeClientStreamClient,
	makeResidentBidiStreamClient,
	makeResidentBidiHandleClient,
	makeBidiStreamClient,
	grpcErrorCode,
} from './grpcClientCalls.js';
import type {
	AddMcpServerResponseWire,
	AgentMergeResponseWire,
	AgentTreeResponseWire,
	AuthNonceResponseWire,
	BackResponseWire,
	BranchResponseWire,
	CancelRemoteSessionResponseWire,
	ClipboardClearResponseWire,
	ClipboardListResponseWire,
	ClipboardReadResponseWire,
	ClipboardWriteResponseWire,
	CompactResponseWire,
	ConfigChangedEventWire,
	ConnectResponseWire,
	ConnectionReportWire,
	ContextVariableListResponseWire,
	ContextVariableReadResponseWire,
	CreateRemoteSessionResponseWire,
	CreateSessionResponseWire,
	CreateSnapshotResponseWire,
	DeleteAgentProfileResponseWire,
	DeleteRemoteAgentConfigResponseWire,
	DeleteSnapshotResponseWire,
	DeliveryTargetDtoWire,
	DestroyRemoteSessionResponseWire,
	DeviceAuthWire,
	DoctorResponseWire,
	DownloadChunkWire,
	EnablePluginResponseWire,
	ExitMaintenanceResponseWire,
	ExportSessionResponseWire,
	FetchToolDetailResponseWire,
	FetchToolUsageDetailResponseWire,
	FireTriggerResponseWire,
	GetCommandDefResponseWire,
	GetFileInfoResponseWire,
	GetGlobalUsageResponseWire,
	GetHistoryResponseWire,
	GetMcpServerStatusesResponseWire,
	GetMcpServerToolsResponseWire,
	GetRemoteSessionHistoryResponseWire,
	GetRemoteSessionStatusResponseWire,
	GetSessionRulesResponseWire,
	GetSessionUsageResponseWire,
	HealthCheckResponseWire,
	HistoryResponseWire,
	ListAgentProfilesResponseWire,
	ListAgentsResponseWire,
	ListCommandsResponseWire,
	ListConfigsResponseWire,
	ListDevicesResponseWire,
	ListFilesResponseWire,
	ListLoopSnapshotsResponseWire,
	ListMcpServersResponseWire,
	ListModelsResponseWire,
	ListNodesResponseWire,
	ListPendingResponseWire,
	ListPluginsResponseWire,
	ListSessionsResponseWire,
	ListSkillsResponseWire,
	ListSnapshotsResponseWire,
	ListToolsResponseWire,
	ListTriggersResponseWire,
	MemberStatusResponseWire,
	MemoryDeleteResponseWire,
	MemoryHistoryResponseWire,
	MemoryListResponseWire,
	MemoryReadResponseWire,
	MemoryRebuildEventWire,
	MemoryReflectResponseWire,
	MemoryRevertResponseWire,
	MemorySaveResponseWire,
	MemorySearchDeepResponseWire,
	MemorySearchResponseWire,
	PairApproveResponseWire,
	PairRejectResponseWire,
	PluginInfoResponseWire,
	PrewarmSessionsResponseWire,
	PruneResponseWire,
	PtyServerMessageWire,
	PurgeSessionResponseWire,
	QueueMutationResponseWire,
	ReadFileResponseWire,
	ReadGitChangesResponseWire,
	ReadGitFileDiffResponseWire,
	ReadGitSummaryResponseWire,
	ReloadPluginResponseWire,
	ReloadRemoteAgentsResponseWire,
	RemoteAgentConfigWire,
	RemoteAgentInfoWire,
	RemoteChatResponseWire,
	RemoteResponseWire,
	RemoveMcpServerResponseWire,
	ResetAgentProfileResponseWire,
	ResetErrorResponseWire,
	ResolveAnchorResponseWire,
	ResolveModelResponseWire,
	ResolveTurnResponseWire,
	RestoreSnapshotResponseWire,
	ResumeRemoteSessionResponseWire,
	ResumeSessionResponseWire,
	RevokeDeviceResponseWire,
	RotateTokenResponseWire,
	SaveAgentProfileResponseWire,
	SaveRemoteAgentConfigResponseWire,
	SaveSkillContentResponseWire,
	ScanNewPluginsResponseWire,
	SessionInfoResponseWire,
	SetMaintenanceResponseWire,
	SetSkillEnabledResponseWire,
	SetTriggerEnabledResponseWire,
	ShelveSessionResponseWire,
	ShutdownResponseWire,
	SkillInfoResponseWire,
	StatusResponseWire,
	SubscribeToolDetailChunkWire,
	TaskListResponseWire,
	TeamInfoResponseWire,
	TodoResponseWire,
	ToggleMcpServerResponseWire,
	ToolInfoResponseWire,
	TriggerDtoWire,
	UnloadPluginResponseWire,
	UnshelveSessionResponseWire,
	UpdateMcpServerResponseWire,
	UploadProgressResponseWire,
	UploadResponseWire,
	UpsertTriggerResponseWire,
	UsageResponseWire,
	WriteFileResponseWire,
	WriteGitWriteResponseWire,
} from './grpcClientMappers.js';

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
function syncInputDeliveryRequestWire(request: UniverseAgentSyncInputDeliveryRequest): Record<string, unknown> {
	return {
		session_id: request.sessionId,
		last_known_message_ids: request.lastKnownMessageIds ?? [],
	};
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
function encodeRemoteResponse(response: UniverseAgentRemoteResponse): RemoteResponseWire {
	return {
		type: response.type,
		request_id: response.requestId,
		...(response.permission !== undefined ? {
			permission: {
				decision: response.permission.decision,
				reason: response.permission.reason,
			},
		} : {}),
		...(response.questionAnswersJson !== undefined ? {
			question_answers_json: response.questionAnswersJson,
		} : {}),
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
function mapPtyClientMessageWire(message: UniverseAgentPtyClientMessage): Record<string, unknown> {
	const wire: Record<string, unknown> = {};
	if (message.openSession !== undefined) {
		const open = message.openSession;
		wire.open_session = {
			engine_session_id: open.engineSessionId,
			client_session_id: open.clientSessionId,
			tab_id: open.tabId,
			shell_args: [...open.shellArgs],
			environment: { ...open.environment },
			columns: open.columns,
			rows: open.rows,
			...(open.workingDirectory !== undefined ? { working_directory: open.workingDirectory } : {}),
			...(open.shellCommand !== undefined ? { shell_command: open.shellCommand } : {}),
			...(open.initialCommand !== undefined ? { initial_command: open.initialCommand } : {}),
		};
	}
	if (message.resize !== undefined) {
		wire.resize = {
			columns: message.resize.columns,
			rows: message.resize.rows,
		};
	}
	if (message.write !== undefined) {
		wire.write = {
			data: bytesToBase64(message.write.data),
		};
	}
	if (message.close !== undefined) {
		wire.close = {
			interrupt_only: message.close.interruptOnly,
		};
	}
	return wire;
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

	openRemoteChatStream(
		request: UniverseAgentRemoteChatRequest,
		onResponse: (response: UniverseAgentRemoteChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentRemoteChatStream {
		const stream = makeServerStreamClient<Record<string, unknown>, RemoteChatResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.RemoteChat,
		);
		return stream({
			call_id: request.callId,
			task: request.task,
			responses: request.responses.map(encodeRemoteResponse),
			override_pending: request.overridePending,
		}, wire => onResponse(mapRemoteChatResponse(wire)), onClosed);
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
	async cancelRemoteSession(request: UniverseAgentCancelRemoteSessionRequest): Promise<UniverseAgentCancelRemoteSessionResult> {
		const unary = makeUnaryClient<Record<string, unknown>, CancelRemoteSessionResponseWire>(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.CancelRemoteSession,
		);
		const wire = await unary({
			call_id: request.callId,
			reason: request.reason,
		});
		return mapCancelRemoteSessionResponse(wire);
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

	openPtyStream(
		onResponse: (response: UniverseAgentPtyServerMessage) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentPtyStream {
		const stream = makeResidentBidiHandleClient<Record<string, unknown>, PtyServerMessageWire>(
			this._channel,
			UniverseAgentGrpcServices.Pty.service,
			UniverseAgentGrpcServices.Pty.PtyStream,
		);
		const handle = stream(wire => onResponse(mapPtyServerMessage(wire)), onClosed);
		return {
			write(message: UniverseAgentPtyClientMessage): void {
				handle.write(mapPtyClientMessageWire(message));
			},
			end(): void {
				handle.end();
			},
			dispose(): void {
				handle.dispose();
			},
		};
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

