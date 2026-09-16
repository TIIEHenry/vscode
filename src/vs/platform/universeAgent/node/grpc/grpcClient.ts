/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as grpc from '@grpc/grpc-js';
import type {
	UniverseAgentSessionStreamCloseCause,
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
	UniverseAgentSessionEvent,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentListAgentProfilesRequest,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentListProviderStatusResult,
	UniverseAgentUpsertProviderCredentialsRequest,
	UniverseAgentClearProviderCredentialsRequest,
	UniverseAgentProviderStatus,
	UniverseAgentListProjectRulesRequest,
	UniverseAgentListProjectRulesResult,
	UniverseAgentUpsertProjectRuleRequest,
	UniverseAgentDeleteProjectRuleRequest,
	UniverseAgentDeleteProjectRuleResult,
	UniverseAgentProjectRule,
	UniverseAgentListHookPointsResult,
	UniverseAgentListTeamsResult,
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
	UniverseAgentWriteClipboardRequest,
	UniverseAgentWriteClipboardResult,
	UniverseAgentReadClipboardRequest,
	UniverseAgentReadClipboardResult,
	UniverseAgentListClipboardRequest,
	UniverseAgentListClipboardResult,
	UniverseAgentClearClipboardRequest,
	UniverseAgentClearClipboardResult,
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
	IUniverseAgentGrpcTransport,
	UniverseAgentAuthNonceRequest,
	UniverseAgentAuthNonceResult,
	UniverseAgentDeviceAuthConnectRequest,
	UniverseAgentGrpcServices,
} from './grpcTransport.js';
import { createPinnedChannelOptions, createPinnedTlsChannelCredentials, loadedGrpcModule, type UniverseAgentPinnedTlsTarget } from '../universeAgentChannel.js';
import {
	bytesToBase64,
	mapAddMcpServerResponse,
	mapAgentMergeResponse,
	mapAgentTreeNode,
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
	mapGetMcpServerStatusesResponse,
	mapGetMcpServerToolsResponse,
	mapGetRemoteSessionHistoryResponse,
	mapGetRemoteSessionStatusResponse,
	mapGetSessionRulesResponse,
	mapGetSessionUsageResponse,
	mapHealthCheckResponse,
	mapHistoryResponse,
	mapListAgentProfilesResponse,
	mapListHookPointsResponse,
	mapListProjectRulesResponse,
	mapListProviderStatusResponse,
	mapListTeamsResponse,
	mapProjectRule,
	mapProviderStatus,
	mapDeleteProjectRuleResponse,
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
	type ConfigChangedEventWire,
	type ConnectResponseWire,
	type DownloadChunkWire,
	type MemoryRebuildEventWire,
	type PtyServerMessageWire,
	type RemoteChatResponseWire,
	type RemoteResponseWire,
	type ResolveAnchorResponseWire,
	type ResolveTurnResponseWire,
	type SaveSkillContentResponseWire,
	type SubscribeToolDetailChunkWire,
	type UploadResponseWire,
} from './grpcClientMappers.js';
import {
	makeUnaryClient,
	makeUnaryBytesClient,
	makeServerStreamClient,
	makeClientStreamClient,
	makeResidentBidiBytesHandleClient,
	makeResidentBidiHandleClient,
	makeBidiBytesClient,
	asUnaryProtoBytes,
	grpcErrorCode,
	applyDefaultUnaryDeadline,
} from './grpcClientCalls.js';
import {
	decodeAuthNonceResponse,
	decodeConnectResponse,
	encodeAuthNonceRequest,
	encodeDeviceAuthConnectRequest,
} from './grpcHandshakeWire.js';
import {
	decodeDoctorResponse,
	decodeHealthCheckResponse,
	decodeShutdownResponse,
	encodeDoctorRequest,
	encodeHealthCheckRequest,
	encodeShutdownRequest,
} from './grpcSystemUnaryWire.js';
import {
	decodeListPendingResponse,
	decodePairApproveResponse,
	decodePairRejectResponse,
	decodeRevokeResponse,
	decodeRotateTokenResponse,
	encodeListPendingRequest,
	encodePairApproveRequest,
	encodePairRejectRequest,
	encodeRevokeRequest,
	encodeRotateTokenRequest,
} from './grpcDevicePairUnaryWire.js';
import {
	decodeDeleteTriggerResponse,
	decodeFireTriggerResponse,
	decodeListTriggersResponse,
	decodeSetTriggerEnabledResponse,
	decodeUpsertTriggerResponse,
	encodeDeleteTriggerRequest,
	encodeFireTriggerRequest,
	encodeListTriggersRequest,
	encodeSetTriggerEnabledRequest,
	encodeUpsertTriggerRequest,
} from './grpcTriggerUnaryWire.js';
import {
	decodeExportSessionResponse,
	decodePrewarmSessionsResponse,
	decodePurgeSessionResponse,
	decodeShelveSessionResponse,
	decodeUnshelveSessionResponse,
	encodeExportSessionRequest,
	encodePrewarmSessionsRequest,
	encodePurgeSessionRequest,
	encodeShelveSessionRequest,
	encodeUnshelveSessionRequest,
} from './grpcSessionLifecycleUnaryWire.js';
import {
	decodeFireTriggerWebhookResponse,
	decodeInstallSessionDemoFakeResponse,
	encodeFireTriggerWebhookRequest,
	encodeInstallSessionDemoFakeRequest,
} from './grpcFireTriggerWebhookUnaryWire.js';
import {
	decodeClearSessionDemoFakeResponse,
	encodeClearSessionDemoFakeRequest,
} from './grpcClearSessionDemoFakeUnaryWire.js';
import {
	decodeSwitchWorkDirResponse,
	encodeSwitchWorkDirRequest,
} from './grpcSwitchWorkDirUnaryWire.js';
import {
	decodeCompactResponse,
	encodeCompactRequest,
} from './grpcCompactUnaryWire.js';
import {
	decodeTodoResponse,
	encodeTodoRequest,
} from './grpcTodoUnaryWire.js';
import {
	decodeUsageResponse,
	encodeUsageRequest,
} from './grpcUsageUnaryWire.js';
import {
	decodeStatusResponse,
	encodeStatusRequest,
} from './grpcStatusUnaryWire.js';
import {
	decodePauseResponse,
	encodePauseRequest,
} from './grpcPauseUnaryWire.js';
import {
	decodeHistoryResponse,
	encodeHistoryRequest,
} from './grpcAgentHistoryUnaryWire.js';
import {
	decodeBackResponse,
	encodeBackRequest,
} from './grpcBackUnaryWire.js';
import {
	decodePruneResponse,
	encodePruneRequest,
} from './grpcPruneUnaryWire.js';
import {
	decodeBranchResponse,
	encodeBranchRequest,
} from './grpcBranchUnaryWire.js';
import {
	decodeResetResponse,
	encodeResetRequest,
} from './grpcResetUnaryWire.js';
import {
	decodeTestModelProfileResponse,
	encodeTestModelProfileRequest,
} from './grpcTestModelProfileUnaryWire.js';
import {
	decodeSuspendLoopResponse,
	encodeSuspendLoopRequest,
} from './grpcSuspendLoopUnaryWire.js';
import {
	decodeResumeLoopResponse,
	encodeResumeLoopRequest,
} from './grpcResumeLoopUnaryWire.js';
import {
	decodeStopLoopResponse,
	encodeStopLoopRequest,
} from './grpcStopLoopUnaryWire.js';
import {
	decodeRunToolInBackgroundResponse,
	encodeRunToolInBackgroundRequest,
} from './grpcRunToolInBackgroundUnaryWire.js';
import {
	decodeStopShellTaskResponse,
	encodeStopShellTaskRequest,
} from './grpcStopShellTaskUnaryWire.js';
import {
	decodeSendShellSessionClientControlResponse,
	encodeSendShellSessionClientControlRequest,
} from './grpcSendShellSessionClientControlUnaryWire.js';
import {
	decodeListLoopSnapshotsResponse,
	encodeListLoopSnapshotsRequest,
} from './grpcListLoopSnapshotsUnaryWire.js';
import {
	decodeFetchToolUsageDetailResponse,
	encodeFetchToolUsageDetailRequest,
} from './grpcFetchToolUsageDetailUnaryWire.js';
import {
	decodeListNodesResponse,
	encodeListNodesRequest,
} from './grpcListNodesUnaryWire.js';
import {
	decodeGetNodeResponse,
	encodeGetNodeRequest,
} from './grpcGetNodeUnaryWire.js';
import {
	decodeSetMaintenanceResponse,
	encodeSetMaintenanceRequest,
} from './grpcSetMaintenanceUnaryWire.js';
import {
	decodeExitMaintenanceResponse,
	encodeExitMaintenanceRequest,
} from './grpcExitMaintenanceUnaryWire.js';
import {
	decodeResetErrorResponse,
	encodeResetErrorRequest,
} from './grpcResetErrorUnaryWire.js';
import {
	decodeListConfigsResponse,
	encodeListConfigsRequest,
} from './grpcListConfigsUnaryWire.js';
import {
	decodeGetConfigResponse as decodeGetConfigResponseFromRemoteAgent,
	encodeGetConfigRequest as encodeGetConfigRequestFromRemoteAgent,
} from './grpcGetConfigUnaryWire.js';
import {
	decodeDeleteConfigResponse,
	encodeDeleteConfigRequest,
} from './grpcDeleteConfigUnaryWire.js';
import {
	decodeReloadRemoteAgentsResponse,
	encodeReloadRemoteAgentsRequest,
} from './grpcReloadRemoteAgentsUnaryWire.js';
import {
	decodeDestroyRemoteSessionResponse,
	encodeDestroyRemoteSessionRequest,
} from './grpcDestroyRemoteSessionUnaryWire.js';
import {
	decodeCancelRemoteSessionResponse,
	encodeCancelRemoteSessionRequest,
} from './grpcCancelRemoteSessionUnaryWire.js';
import {
	decodeResumeRemoteSessionResponse,
	encodeResumeRemoteSessionRequest,
} from './grpcResumeRemoteSessionUnaryWire.js';
import {
	decodeCheckConnectionResponse,
	encodeCheckConnectionRequest,
} from './grpcCheckConnectionUnaryWire.js';
import {
	decodeSaveConfigResponse,
	encodeSaveConfigRequest,
} from './grpcSaveConfigUnaryWire.js';
import {
	decodeCreateRemoteSessionResponse,
	encodeCreateRemoteSessionRequest,
} from './grpcCreateRemoteSessionUnaryWire.js';
import {
	decodeGetRemoteSessionStatusResponse,
	encodeGetRemoteSessionStatusRequest,
} from './grpcGetRemoteSessionStatusUnaryWire.js';
import {
	decodeGetRemoteSessionHistoryResponse,
	encodeGetRemoteSessionHistoryRequest,
} from './grpcGetRemoteSessionHistoryUnaryWire.js';
import {
	decodeGetUploadProgressResponse,
	encodeGetUploadProgressRequest,
} from './grpcGetUploadProgressUnaryWire.js';
import {
	decodeResolveModelResponse,
	encodeResolveModelRequest,
} from './grpcResolveModelUnaryWire.js';
import {
	decodeChatResponse,
	decodeCreateSessionResponse,
	decodeCreateSnapshotResponse,
	decodeDeleteMessageResponse,
	decodeDeleteSnapshotResponse,
	decodeFetchToolDetailResponse,
	decodeForkAgentResponse,
	decodeGetHistoryResponse,
	decodeListSnapshotsResponse,
	decodeRestoreSnapshotResponse,
	decodeResumeSessionResponse,
	decodeSessionStreamEvent,
	encodeCancelGenerationRequest,
	encodeCancelToolCallRequest,
	encodeChatRequest,
	encodeCreateSessionRequest,
	encodeCreateSnapshotRequest,
	encodeDeleteMessageRequest,
	encodeDeleteSnapshotRequest,
	encodeEditMessageRequest,
	encodeFetchToolDetailRequest,
	encodeForkAgentRequest,
	encodeGetHistoryRequest,
	encodeKillAgentRequest,
	encodeListSnapshotsRequest,
	encodeRenameSessionRequest,
	encodeRestoreSnapshotRequest,
	encodeResumeSessionRequest,
	encodeSessionStreamHandshake,
} from './grpcSessionAttachWire.js';
import {
	decodeAgentTreeResponse,
	decodeListAgentProfilesResponse,
	decodeListAgentsResponse,
	decodeListDevicesResponse,
	decodeListHookPointsResponse,
	decodeListModelsResponse,
	decodeListProjectRulesResponse,
	decodeListProviderStatusResponse,
	decodeListSessionsResponse,
	decodeListSkillsResponse,
	decodeListTeamsResponse,
	decodeListToolsResponse,
	decodeMemberStatusResponse,
	decodeProjectRuleResponse,
	decodeProviderStatus,
	decodeResetAgentProfileResponse,
	decodeSaveAgentProfileResponse,
	decodeSessionInfoResponse,
	decodeSwitchModelResponse,
	decodeTaskListResponse,
	decodeTeamInfoResponse,
	decodeDeleteAgentProfileResponse,
	decodeDeleteProjectRuleResponse,
	decodeGetCommandDefResponse,
	decodeGetSessionRulesResponse,
	decodeListCommandsResponse,
	decodePromotePermissionRuleResponse,
	decodeQueueMutationResponse,
	decodeSetSkillEnabledResponse,
	decodeSkillInfoResponse,
	decodeSyncPermissionRuleResponse,
	decodeToolInfoResponse,
	encodeAgentTreeRequest,
	encodeCancelSessionGoalRequest,
	encodeClearProviderCredentialsRequest,
	encodeDeleteAgentProfileRequest,
	encodeDeleteProjectRuleRequest,
	encodeDeleteSessionRequest,
	encodeEditQueueItemRequest,
	encodeEnqueueQueueItemRequest,
	encodeGetCommandDefRequest,
	encodeGetSessionRulesRequest,
	encodeHoldQueueItemRequest,
	encodeInsertQueueItemRequest,
	encodeListAgentProfilesRequest,
	encodeListAgentsRequest,
	encodeListCommandsRequest,
	encodeListDevicesRequest,
	encodeListHookPointsRequest,
	encodeListModelsRequest,
	encodeListProjectRulesRequest,
	encodeListProviderStatusRequest,
	encodeListSessionsRequest,
	encodeListSkillsRequest,
	encodeListTeamsRequest,
	encodeListToolsRequest,
	encodeMemberStatusRequest,
	encodeProbeRpcRequest,
	encodePromotePermissionRuleRequest,
	encodeQueueItemRefRequest,
	encodeQueueRefRequest,
	encodeReorderQueueRequest,
	encodeResetAgentProfileRequest,
	encodeRespondPermissionRequest,
	encodeSaveAgentProfileRequest,
	encodeSessionInfoRequest,
	encodeSetSkillEnabledRequest,
	encodeSkillInfoRequest,
	encodeSetPermissionModeRequest,
	encodeSetQueueItemForkAnchorRequest,
	encodeSetQueueItemLockedRequest,
	encodeSetSessionGoalRequest,
	encodeSwitchModelRequest,
	encodeSyncPermissionRuleRequest,
	encodeTaskListRequest,
	encodeTeamInfoRequest,
	encodeToolInfoRequest,
	encodeUpsertProjectRuleRequest,
	encodeUpsertProviderCredentialsRequest,
} from './grpcCatalogUnaryWire.js';
import {
	decodeClipboardClearResponse,
	decodeClipboardListResponse,
	decodeClipboardReadResponse,
	decodeClipboardWriteResponse,
	encodeClipboardClearRequest,
	encodeClipboardListRequest,
	encodeClipboardReadRequest,
	encodeClipboardWriteRequest,
} from './grpcClipboardUnaryWire.js';
import {
	decodeReadGitChangesResponse,
	decodeReadGitFileDiffResponse,
	decodeReadGitSummaryResponse,
	decodeWriteGitWriteResponse,
	encodeReadGitChangesRequest,
	encodeReadGitFileDiffRequest,
	encodeReadGitSummaryRequest,
	encodeWriteGitApplyHunksRequest,
	encodeWriteGitCommitRequest,
	encodeWriteGitStagePathsRequest,
} from './grpcGitUnaryWire.js';
import {
	decodeMemoryDeleteResponse,
	decodeMemoryHistoryResponse,
	decodeMemoryListResponse,
	decodeMemoryReadResponse,
	decodeMemoryReflectResponse,
	decodeMemoryRevertResponse,
	decodeMemorySaveResponse,
	decodeMemorySearchDeepResponse,
	decodeMemorySearchResponse,
	encodeMemoryDeleteRequest,
	encodeMemoryHistoryRequest,
	encodeMemoryListRequest,
	encodeMemoryReadRequest,
	encodeMemoryReflectRequest,
	encodeMemoryRevertRequest,
	encodeMemorySaveRequest,
	encodeMemorySearchDeepRequest,
	encodeMemorySearchRequest,
} from './grpcMemoryUnaryWire.js';
import {
	decodeContextVariableListResponse,
	decodeContextVariableReadResponse,
	encodeContextVariableListRequest,
	encodeContextVariableReadRequest,
} from './grpcContextVariableUnaryWire.js';
import {
	decodeGetGlobalUsageResponse,
	decodeGetSessionUsageResponse,
	encodeGetGlobalUsageRequest,
	encodeGetSessionUsageRequest,
} from './grpcTokenUsageUnaryWire.js';
import {
	decodeGetConfigResponse,
	decodeSetConfigResponse,
	encodeGetConfigRequest,
	encodeSetConfigRequest,
} from './grpcConfigUnaryWire.js';
import {
	decodeGetModelPreferencesResponse,
	decodeSetModelPreferencesResponse,
	encodeGetModelPreferencesRequest,
	encodeSetModelPreferencesRequest,
} from './grpcModelPreferencesUnaryWire.js';
import {
	decodeSetPermissionPolicyResponse,
	encodeSetPermissionPolicyRequest,
} from './grpcConfigPermissionUnaryWire.js';
import {
	decodeAgentMergeResponse,
	decodeGetFileInfoResponse,
	decodeListFilesResponse,
	decodeReadFileResponse,
	decodeWriteFileResponse,
	encodeAgentMergeRequest,
	encodeForceWriteFileRequest,
	encodeGetFileInfoRequest,
	encodeListFilesRequest,
	encodeReadFileRequest,
	encodeWriteFileRequest,
} from './grpcFileUnaryWire.js';
import {
	decodeChatSyncResponse,
	decodeSyncInputDeliveryResponse,
	encodeChatSyncRequest,
	encodeSyncInputDeliveryRequest,
} from './grpcChatSyncUnaryWire.js';
import {
	decodeAbortTeamResponse,
	decodeCreateTeamResponse,
	decodeKillMemberResponse,
	decodeMessageMemberResponse,
	decodeStartMemberResponse,
	decodeTaskCancelResponse,
	decodeTaskUpdateResponse,
	encodeAbortTeamRequest,
	encodeCreateTeamRequest,
	encodeKillMemberRequest,
	encodeMessageMemberRequest,
	encodeStartMemberRequest,
	encodeTaskCancelRequest,
	encodeTaskUpdateRequest,
} from './grpcTeamUnaryWire.js';
import {
	decodeAddMcpServerResponse,
	decodeEnablePluginResponse,
	decodeGetMcpServerStatusesResponse,
	decodeGetMcpServerToolsResponse,
	decodeListMcpServersResponse,
	decodeListPluginsResponse,
	decodePluginInfoResponse,
	decodeReloadPluginResponse,
	decodeRemoveMcpServerResponse,
	decodeScanNewPluginsResponse,
	decodeToggleMcpServerResponse,
	decodeUnloadPluginResponse,
	decodeUpdateMcpServerResponse,
	encodeAddMcpServerRequest,
	encodeEnablePluginRequest,
	encodeGetMcpServerStatusesRequest,
	encodeGetMcpServerToolsRequest,
	encodeListMcpServersRequest,
	encodeListPluginsRequest,
	encodePluginInfoRequest,
	encodeReloadPluginRequest,
	encodeRemoveMcpServerRequest,
	encodeScanNewPluginsRequest,
	encodeToggleMcpServerRequest,
	encodeUnloadPluginRequest,
	encodeUpdateMcpServerRequest,
} from './grpcMcpPluginUnaryWire.js';
import {
	decodeRespondQuestionResponse,
	decodeSendClientToolResponseResponse,
	encodeRespondQuestionRequest,
	encodeSendClientToolResponseRequest,
} from './grpcAgentQuestionToolWire.js';

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

export interface GrpcUniverseAgentClientOptions {
	readonly address: string;
	readonly credentials?: grpc.ChannelCredentials;
	readonly channelOptions?: grpc.ChannelOptions;
	/** Default unary deadline in ms. Default 30_000; `0` disables. */
	readonly unaryDeadlineMs?: number;
}

/**
 * Hand-written @grpc/grpc-js client using JSON marshalling for v1 transport primitives.
 */
export class GrpcUniverseAgentClient implements IUniverseAgentGrpcTransport {

	private readonly _channel: grpc.Client;
	private _alive = true;

	constructor(options: GrpcUniverseAgentClientOptions) {
		const grpcModule = loadedGrpcModule();
		const unaryDeadlineMs = options.unaryDeadlineMs ?? 30_000;
		this._channel = new grpcModule.Client(
			options.address,
			options.credentials ?? grpcModule.credentials.createInsecure(),
			{
				...options.channelOptions,
				callInvocationTransformer: (props) => {
					const withDeadline = applyDefaultUnaryDeadline(props, unaryDeadlineMs, Date.now());
					const existing = (options.channelOptions as { callInvocationTransformer?: (next: typeof props) => typeof props } | undefined)?.callInvocationTransformer;
					return existing ? existing(withDeadline) : withDeadline;
				},
			},
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.GetAuthNonce,
			decodeAuthNonceResponse,
		);
		return unary(encodeAuthNonceRequest(request));
	}

	async healthCheck(): Promise<UniverseAgentHealthCheckResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.HealthCheck,
			decodeHealthCheckResponse,
		);
		return mapHealthCheckResponse(await unary(encodeHealthCheckRequest()));
	}

	async shutdown(request: UniverseAgentShutdownRequest): Promise<UniverseAgentShutdownResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Shutdown,
			decodeShutdownResponse,
		);
		return mapShutdownResponse(await unary(encodeShutdownRequest(request)));
	}

	async writeClipboard(request: UniverseAgentWriteClipboardRequest): Promise<UniverseAgentWriteClipboardResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Clipboard.service,
			UniverseAgentGrpcServices.Clipboard.Write,
			decodeClipboardWriteResponse,
		);
		return mapClipboardWriteResponse(await unary(encodeClipboardWriteRequest(request)));
	}

	async readClipboard(request: UniverseAgentReadClipboardRequest): Promise<UniverseAgentReadClipboardResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Clipboard.service,
			UniverseAgentGrpcServices.Clipboard.Read,
			decodeClipboardReadResponse,
		);
		return mapClipboardReadResponse(await unary(encodeClipboardReadRequest(request)));
	}

	async listClipboard(request: UniverseAgentListClipboardRequest): Promise<UniverseAgentListClipboardResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Clipboard.service,
			UniverseAgentGrpcServices.Clipboard.List,
			decodeClipboardListResponse,
		);
		return mapClipboardListResponse(await unary(encodeClipboardListRequest(request)));
	}

	async clearClipboard(request: UniverseAgentClearClipboardRequest): Promise<UniverseAgentClearClipboardResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Clipboard.service,
			UniverseAgentGrpcServices.Clipboard.Clear,
			decodeClipboardClearResponse,
		);
		return mapClipboardClearResponse(await unary(encodeClipboardClearRequest(request)));
	}

	async connectWithDeviceAuth(request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Connect,
			decodeConnectResponse,
		);
		return unary(encodeDeviceAuthConnectRequest(request));
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
				asUnaryProtoBytes,
				(buffer: Buffer) => buffer,
				encodeProbeRpcRequest(),
				(error: grpc.ServiceError | null) => resolve(grpcErrorCode(error)),
			);
		});
	}

	async listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.List,
			decodeListSessionsResponse,
		);
		return mapListSessionsResponse(await unary(encodeListSessionsRequest(request)));
	}

	async createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Create,
			decodeCreateSessionResponse,
		);
		return unary(encodeCreateSessionRequest(request));
	}

	async deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Delete,
			() => undefined,
		);
		await unary(encodeDeleteSessionRequest(request.sessionId));
	}

	async getSessionInfo(request: UniverseAgentSessionInfoRequest): Promise<UniverseAgentSessionInfoResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Info,
			decodeSessionInfoResponse,
		);
		return mapSessionInfoResponse(await unary(encodeSessionInfoRequest(request.sessionId)));
	}

	async resumeSession(request: UniverseAgentResumeSessionRequest): Promise<UniverseAgentResumeSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Resume,
			decodeResumeSessionResponse,
		);
		return unary(encodeResumeSessionRequest(request));
	}

	async prewarmSessions(request: UniverseAgentPrewarmSessionsRequest): Promise<UniverseAgentPrewarmSessionsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Prewarm,
			decodePrewarmSessionsResponse,
		);
		return mapPrewarmSessionsResponse(await unary(encodePrewarmSessionsRequest(request)));
	}

	async shelveSession(request: UniverseAgentShelveSessionRequest): Promise<UniverseAgentShelveSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Shelve,
			decodeShelveSessionResponse,
		);
		return mapShelveSessionResponse(await unary(encodeShelveSessionRequest(request)));
	}

	async unshelveSession(request: UniverseAgentUnshelveSessionRequest): Promise<UniverseAgentUnshelveSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Unshelve,
			decodeUnshelveSessionResponse,
		);
		return mapUnshelveSessionResponse(await unary(encodeUnshelveSessionRequest(request)));
	}

	async purgeSession(request: UniverseAgentPurgeSessionRequest): Promise<UniverseAgentPurgeSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Purge,
			decodePurgeSessionResponse,
		);
		return mapPurgeSessionResponse(await unary(encodePurgeSessionRequest(request)));
	}

	async exportSession(request: UniverseAgentExportSessionRequest): Promise<UniverseAgentExportSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.Export,
			decodeExportSessionResponse,
		);
		return mapExportSessionResponse(await unary(encodeExportSessionRequest(request)));
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Status,
			decodeStatusResponse,
		);
		return mapStatusResponse(await unary(encodeStatusRequest(request)));
	}

	async getTodo(request: UniverseAgentTodoRequest): Promise<UniverseAgentTodoResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Todo,
			decodeTodoResponse,
		);
		return mapTodoResponse(await unary(encodeTodoRequest(request)));
	}

	async compact(request: UniverseAgentCompactRequest): Promise<UniverseAgentCompactResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Compact,
			decodeCompactResponse,
		);
		return mapCompactResponse(await unary(encodeCompactRequest(request)));
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Usage,
			decodeUsageResponse,
		);
		return mapUsageResponse(await unary(encodeUsageRequest(request)));
	}

	async listAgents(request: UniverseAgentListAgentsRequest): Promise<UniverseAgentListAgentsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.List,
			decodeListAgentsResponse,
		);
		return mapListAgentsResponse(await unary(encodeListAgentsRequest(request.sessionId)));
	}

	async getAgentHistory(request: UniverseAgentAgentHistoryRequest): Promise<UniverseAgentAgentHistoryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.History,
			decodeHistoryResponse,
		);
		return mapHistoryResponse(await unary(encodeHistoryRequest(request)));
	}

	async pauseAgent(request: UniverseAgentPauseAgentRequest): Promise<UniverseAgentPauseAgentResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Pause,
			decodePauseResponse,
		);
		const wire = await unary(encodePauseRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async back(request: UniverseAgentBackRequest): Promise<UniverseAgentBackResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Back,
			decodeBackResponse,
		);
		return mapBackResponse(await unary(encodeBackRequest(request)));
	}

	async prune(request: UniverseAgentPruneRequest): Promise<UniverseAgentPruneResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Prune,
			decodePruneResponse,
		);
		return mapPruneResponse(await unary(encodePruneRequest(request)));
	}

	async resetAgent(request: UniverseAgentResetAgentRequest): Promise<UniverseAgentResetAgentResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Reset,
			decodeResetResponse,
		);
		const wire = await unary(encodeResetRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async branch(request: UniverseAgentBranchRequest): Promise<UniverseAgentBranchResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Branch,
			decodeBranchResponse,
		);
		return mapBranchResponse(await unary(encodeBranchRequest(request)));
	}

	async suspendLoop(request: UniverseAgentSuspendLoopRequest): Promise<UniverseAgentSuspendLoopResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SuspendLoop,
			decodeSuspendLoopResponse,
		);
		const wire = await unary(encodeSuspendLoopRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async resumeLoop(request: UniverseAgentResumeLoopRequest): Promise<UniverseAgentResumeLoopResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ResumeLoop,
			decodeResumeLoopResponse,
		);
		const wire = await unary(encodeResumeLoopRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async stopLoop(request: UniverseAgentStopLoopRequest): Promise<UniverseAgentStopLoopResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.StopLoop,
			decodeStopLoopResponse,
		);
		const wire = await unary(encodeStopLoopRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async renameSession(request: UniverseAgentRenameSessionRequest): Promise<UniverseAgentRenameSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Rename,
			decodeResumeSessionResponse,
		);
		return unary(encodeRenameSessionRequest(request));
	}

	async cancelGeneration(request: UniverseAgentCancelGenerationRequest): Promise<UniverseAgentCancelGenerationResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Cancel,
			decodeResumeSessionResponse,
		);
		return unary(encodeCancelGenerationRequest(request));
	}

	async cancelToolCall(request: UniverseAgentCancelToolCallRequest): Promise<UniverseAgentCancelToolCallResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.CancelToolCall,
			decodeResumeSessionResponse,
		);
		return unary(encodeCancelToolCallRequest(request));
	}

	async runToolInBackground(request: UniverseAgentRunToolInBackgroundRequest): Promise<UniverseAgentRunToolInBackgroundResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.RunToolInBackground,
			decodeRunToolInBackgroundResponse,
		);
		const wire = await unary(encodeRunToolInBackgroundRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
			reasonCode: wire.reason_code,
		};
	}

	async stopShellTask(request: UniverseAgentStopShellTaskRequest): Promise<UniverseAgentStopShellTaskResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.StopShellTask,
			decodeStopShellTaskResponse,
		);
		const wire = await unary(encodeStopShellTaskRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async sendShellSessionClientControl(request: UniverseAgentSendShellSessionClientControlRequest): Promise<UniverseAgentSendShellSessionClientControlResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SendShellSessionClientControl,
			decodeSendShellSessionClientControlResponse,
		);
		const wire = await unary(encodeSendShellSessionClientControlRequest(request));
		return {
			ok: wire.success === true,
			message: wire.error_message,
			errorCode: wire.error_code,
			debounced: wire.debounced,
			deliveredToSubscribe: wire.delivered_to_subscribe,
		};
	}

	async fetchToolUsageDetail(request: UniverseAgentFetchToolUsageDetailRequest): Promise<UniverseAgentFetchToolUsageDetailResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.FetchToolUsageDetail,
			decodeFetchToolUsageDetailResponse,
		);
		return mapFetchToolUsageDetailResponse(await unary(encodeFetchToolUsageDetailRequest(request)));
	}

	async fireTriggerWebhook(request: UniverseAgentFireTriggerWebhookRequest): Promise<UniverseAgentFireTriggerWebhookResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.FireTriggerWebhook,
			decodeFireTriggerWebhookResponse,
		);
		const wire = await unary(encodeFireTriggerWebhookRequest(request));
		return {
			status: mapFireTriggerWebhookStatus(wire.status),
			eventId: wire.event_id ?? '',
			reason: wire.reason ?? '',
		};
	}

	async installSessionDemoFake(request: UniverseAgentInstallSessionDemoFakeRequest): Promise<UniverseAgentInstallSessionDemoFakeResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.InstallSessionDemoFake,
			decodeInstallSessionDemoFakeResponse,
		);
		const wire = await unary(encodeInstallSessionDemoFakeRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
			reasonCode: wire.reason_code ?? '',
		};
	}

	async clearSessionDemoFake(request: UniverseAgentClearSessionDemoFakeRequest): Promise<UniverseAgentClearSessionDemoFakeResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ClearSessionDemoFake,
			decodeClearSessionDemoFakeResponse,
		);
		const wire = await unary(encodeClearSessionDemoFakeRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
			reasonCode: wire.reason_code ?? '',
		};
	}

	async switchWorkDir(request: UniverseAgentSwitchWorkDirRequest): Promise<UniverseAgentSwitchWorkDirResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SwitchWorkDir,
			decodeSwitchWorkDirResponse,
		);
		const wire = await unary(encodeSwitchWorkDirRequest(request));
		return {
			ok: wire.success === true,
			previousWorkDir: wire.previous_work_dir ?? '',
			currentWorkDir: wire.current_work_dir ?? '',
			message: wire.message,
		};
	}

	async testModelProfile(request: UniverseAgentTestModelProfileRequest): Promise<UniverseAgentTestModelProfileResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.TestModelProfile,
			decodeTestModelProfileResponse,
		);
		const wire = await unary(encodeTestModelProfileRequest(request));
		return {
			ok: wire.success === true,
			message: wire.error_message,
		};
	}


	async setSessionGoal(request: UniverseAgentSetSessionGoalRequest): Promise<UniverseAgentSetSessionGoalResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.SetSessionGoal,
			decodeResumeSessionResponse,
		);
		return unary(encodeSetSessionGoalRequest(request));
	}

	async cancelSessionGoal(request: UniverseAgentCancelSessionGoalRequest): Promise<UniverseAgentCancelSessionGoalResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.CancelSessionGoal,
			decodeResumeSessionResponse,
		);
		return unary(encodeCancelSessionGoalRequest(request));
	}

	async respondPermission(request: UniverseAgentRespondPermissionRequest): Promise<UniverseAgentRespondPermissionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.Respond,
			decodeResumeSessionResponse,
		);
		return unary(encodeRespondPermissionRequest(request));
	}

	async syncPermissionRule(request: UniverseAgentSyncPermissionRuleRequest): Promise<UniverseAgentSyncPermissionRuleResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.SyncPermissionRule,
			decodeSyncPermissionRuleResponse,
		);
		return unary(encodeSyncPermissionRuleRequest(
			request.sessionId,
			request.toolName,
			request.scope,
			permissionRuleActionWire(request.action),
			request.reason,
		));
	}

	async promotePermissionRule(request: UniverseAgentPromotePermissionRuleRequest): Promise<UniverseAgentPromotePermissionRuleResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.PromotePermissionRule,
			decodePromotePermissionRuleResponse,
		);
		return unary(encodePromotePermissionRuleRequest(
			request.toolName,
			request.scope,
			permissionRuleActionWire(request.action),
		));
	}

	async getSessionRules(request: UniverseAgentGetSessionRulesRequest): Promise<UniverseAgentGetSessionRulesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.GetSessionRules,
			decodeGetSessionRulesResponse,
		);
		return mapGetSessionRulesResponse(await unary(encodeGetSessionRulesRequest(request.sessionId)));
	}

	async setPermissionMode(request: UniverseAgentSetPermissionModeRequest): Promise<UniverseAgentSetPermissionModeResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Permission.service,
			UniverseAgentGrpcServices.Permission.SetPermissionMode,
			decodeResumeSessionResponse,
		);
		return unary(encodeSetPermissionModeRequest(request.sessionId, sessionToolPermissionModeWire(request.mode)));
	}

	async taskUpdate(request: UniverseAgentTaskUpdateRequest): Promise<UniverseAgentTaskUpdateResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TaskUpdate,
			decodeTaskUpdateResponse,
		);
		return unary(encodeTaskUpdateRequest(request));
	}

	async taskCancel(request: UniverseAgentTaskCancelRequest): Promise<UniverseAgentTaskCancelResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TaskCancel,
			decodeTaskCancelResponse,
		);
		return unary(encodeTaskCancelRequest(request));
	}

	async messageMember(request: UniverseAgentMessageMemberRequest): Promise<UniverseAgentMessageMemberResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.MessageMember,
			decodeMessageMemberResponse,
		);
		return unary(encodeMessageMemberRequest(request));
	}

	async createTeam(request: UniverseAgentCreateTeamRequest): Promise<UniverseAgentCreateTeamResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.CreateTeam,
			decodeCreateTeamResponse,
		);
		return unary(encodeCreateTeamRequest(request));
	}

	async startMember(request: UniverseAgentStartMemberRequest): Promise<UniverseAgentStartMemberResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.StartMember,
			decodeStartMemberResponse,
		);
		return unary(encodeStartMemberRequest(request));
	}

	async killMember(request: UniverseAgentKillMemberRequest): Promise<UniverseAgentKillMemberResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.KillMember,
			decodeKillMemberResponse,
		);
		return unary(encodeKillMemberRequest(request));
	}

	async abort(request: UniverseAgentAbortTeamRequest): Promise<UniverseAgentAbortTeamResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.Abort,
			decodeAbortTeamResponse,
		);
		return unary(encodeAbortTeamRequest(request));
	}

	async respondQuestion(request: UniverseAgentRespondQuestionRequest): Promise<UniverseAgentRespondQuestionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.RespondQuestion,
			decodeRespondQuestionResponse,
		);
		return unary(encodeRespondQuestionRequest(request));
	}

	async enqueueQueueItem(request: UniverseAgentEnqueueQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.EnqueueQueueItem, encodeEnqueueQueueItemRequest(request));
	}

	async insertQueueItem(request: UniverseAgentInsertQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.InsertQueueItem, encodeInsertQueueItemRequest(request));
	}

	async reorderQueue(request: UniverseAgentReorderQueueRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.ReorderQueue, encodeReorderQueueRequest(request));
	}

	async deleteQueueItem(request: UniverseAgentDeleteQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.DeleteQueueItem, encodeQueueItemRefRequest(request));
	}

	async retryQueueItem(request: UniverseAgentRetryQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.RetryQueueItem, encodeQueueItemRefRequest(request));
	}

	async retryAllFailed(request: UniverseAgentRetryAllFailedRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.RetryAllFailed, encodeQueueRefRequest(request));
	}

	async retryQueueItemUpload(request: UniverseAgentRetryQueueItemUploadRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.RetryQueueItemUpload, encodeQueueItemRefRequest(request));
	}

	async pinQueueItem(request: UniverseAgentPinQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.PinQueueItem, encodeQueueItemRefRequest(request));
	}

	async setQueueItemLocked(request: UniverseAgentSetQueueItemLockedRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.SetQueueItemLocked, encodeSetQueueItemLockedRequest(request));
	}

	async injectQueueItem(request: UniverseAgentInjectQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.InjectQueueItem, encodeQueueItemRefRequest(request));
	}

	async setQueueItemForkAnchor(request: UniverseAgentSetQueueItemForkAnchorRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.SetQueueItemForkAnchor, encodeSetQueueItemForkAnchorRequest(request));
	}

	async pauseQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.PauseQueue, encodeQueueRefRequest(request));
	}

	async resumeQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.ResumeQueue, encodeQueueRefRequest(request));
	}

	async clearQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.ClearQueue, encodeQueueRefRequest(request));
	}

	async holdQueueItem(request: UniverseAgentHoldQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.HoldQueueItem, encodeHoldQueueItemRequest(request));
	}

	async releaseQueueItemHold(request: UniverseAgentQueueItemRefRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.ReleaseQueueItemHold, encodeQueueItemRefRequest(request));
	}

	async editQueueItem(request: UniverseAgentEditQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		return this._queueMutation(UniverseAgentGrpcServices.Agent.EditQueueItem, encodeEditQueueItemRequest(request));
	}

	private async _queueMutation(method: string, requestBytes: Uint8Array): Promise<UniverseAgentQueueMutationResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			method,
			decodeQueueMutationResponse,
		);
		return unary(requestBytes);
	}

	async forkAgent(request: UniverseAgentForkAgentRequest): Promise<UniverseAgentForkAgentResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Fork,
			decodeForkAgentResponse,
		);
		return unary(encodeForkAgentRequest(request));
	}

	async killAgent(request: UniverseAgentKillAgentRequest): Promise<UniverseAgentKillAgentResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Kill,
			decodeResumeSessionResponse,
		);
		return unary(encodeKillAgentRequest(request));
	}

	async deleteMessage(request: UniverseAgentDeleteMessageRequest): Promise<UniverseAgentDeleteMessageResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.DeleteMessage,
			decodeDeleteMessageResponse,
		);
		return unary(encodeDeleteMessageRequest(request));
	}

	async editMessage(request: UniverseAgentEditMessageRequest): Promise<UniverseAgentEditMessageResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.EditMessage,
			decodeResumeSessionResponse,
		);
		return unary(encodeEditMessageRequest(request));
	}

	async sendClientToolResponse(request: UniverseAgentSendClientToolResponseRequest): Promise<UniverseAgentSendClientToolResponseResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SendClientToolResponse,
			decodeSendClientToolResponseResponse,
		);
		return unary(encodeSendClientToolResponseRequest(request));
	}

	async listSnapshots(request: UniverseAgentListSnapshotsRequest): Promise<UniverseAgentListSnapshotsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ListSnapshots,
			decodeListSnapshotsResponse,
		);
		return mapListSnapshotsResponse(await unary(encodeListSnapshotsRequest(request)));
	}

	async listLoopSnapshots(request: UniverseAgentListLoopSnapshotsRequest): Promise<UniverseAgentListLoopSnapshotsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ListLoopSnapshots,
			decodeListLoopSnapshotsResponse,
		);
		return mapListLoopSnapshotsResponse(await unary(encodeListLoopSnapshotsRequest(request)));
	}

	async createSnapshot(request: UniverseAgentCreateSnapshotRequest): Promise<UniverseAgentCreateSnapshotResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.CreateSnapshot,
			decodeCreateSnapshotResponse,
		);
		return mapCreateSnapshotResponse(await unary(encodeCreateSnapshotRequest(request)));
	}

	async restoreSnapshot(request: UniverseAgentRestoreSnapshotRequest): Promise<UniverseAgentRestoreSnapshotResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.RestoreSnapshot,
			decodeRestoreSnapshotResponse,
		);
		return mapRestoreSnapshotResponse(await unary(encodeRestoreSnapshotRequest(request)));
	}

	async deleteSnapshot(request: UniverseAgentDeleteSnapshotRequest): Promise<UniverseAgentDeleteSnapshotResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.DeleteSnapshot,
			decodeDeleteSnapshotResponse,
		);
		return mapDeleteSnapshotResponse(await unary(encodeDeleteSnapshotRequest(request)));
	}

	async getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.GetHistory,
			decodeGetHistoryResponse,
		);
		return unary(encodeGetHistoryRequest(request));
	}

	subscribeSessionEventStream(
		sessionId: string,
		listener: (event: UniverseAgentSessionEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		const open = makeResidentBidiBytesHandleClient(
			this._channel,
			UniverseAgentGrpcServices.Session.service,
			UniverseAgentGrpcServices.Session.SessionEventStream,
			decodeSessionStreamEvent,
		);
		const handle = open(listener, onClosed);
		handle.write(encodeSessionStreamHandshake(sessionId));
		return { dispose: () => handle.dispose() };
	}

	async chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
		const bidi = makeBidiBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Chat,
			decodeChatResponse,
		);
		await bidi(encodeChatRequest(request.sessionId, request.payload), onResponse);
	}

	async chatSync(request: UniverseAgentChatSyncRequest): Promise<UniverseAgentChatSyncResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ChatSync,
			decodeChatSyncResponse,
		);
		return mapChatSyncResponse(await unary(encodeChatSyncRequest(request)));
	}

	async syncInputDelivery(request: UniverseAgentSyncInputDeliveryRequest): Promise<UniverseAgentSyncInputDeliveryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SyncInputDelivery,
			decodeSyncInputDeliveryResponse,
		);
		return mapSyncInputDeliveryResponse(await unary(encodeSyncInputDeliveryRequest(request)));
	}

	openChatStream(
		sessionId: string,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentChatStream {
		const open = makeResidentBidiBytesHandleClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Chat,
			decodeChatResponse,
		);
		const handle = open(onResponse, onClosed);
		return {
			write(payload: unknown): void {
				handle.write(encodeChatRequest(sessionId, payload));
			},
			dispose(): void {
				handle.dispose();
			},
		};
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ListSkills,
			decodeListSkillsResponse,
		);
		return mapListSkillsResponse(await unary(encodeListSkillsRequest()));
	}

	async setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SetSkillEnabled,
			decodeSetSkillEnabledResponse,
		);
		return mapSetSkillEnabledResponse(await unary(encodeSetSkillEnabledRequest(request)));
	}

	async getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.SkillInfo,
			decodeSkillInfoResponse,
		);
		return mapSkillInfoResponse(await unary(encodeSkillInfoRequest(request)));
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ListAgentProfiles,
			decodeListAgentProfilesResponse,
		);
		return mapListAgentProfilesResponse(await unary(encodeListAgentProfilesRequest(request.projectPath)));
	}

	async saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.SaveAgentProfile,
			decodeSaveAgentProfileResponse,
		);
		return mapSaveAgentProfileResponse(await unary(encodeSaveAgentProfileRequest(request.profile)));
	}

	async deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.DeleteAgentProfile,
			decodeDeleteAgentProfileResponse,
		);
		return mapDeleteAgentProfileResponse(await unary(encodeDeleteAgentProfileRequest(request.id)));
	}

	async resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ResetAgentProfile,
			decodeResetAgentProfileResponse,
		);
		return mapResetAgentProfileResponse(await unary(encodeResetAgentProfileRequest(request.id)));
	}

	async listMcpServers(request: UniverseAgentListMcpServersRequest): Promise<UniverseAgentListMcpServersResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.ListMcpServers,
			decodeListMcpServersResponse,
		);
		return mapListMcpServersResponse(await unary(encodeListMcpServersRequest(request)));
	}

	async getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.GetMcpServerStatuses,
			decodeGetMcpServerStatusesResponse,
		);
		return mapGetMcpServerStatusesResponse(await unary(encodeGetMcpServerStatusesRequest(serverIds)));
	}

	async getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.GetMcpServerTools,
			decodeGetMcpServerToolsResponse,
		);
		return mapGetMcpServerToolsResponse(await unary(encodeGetMcpServerToolsRequest(serverId, forceRefresh)));
	}

	async listPlugins(): Promise<UniverseAgentListPluginsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.List,
			decodeListPluginsResponse,
		);
		return mapListPluginsResponse(await unary(encodeListPluginsRequest()));
	}

	async getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Info,
			decodePluginInfoResponse,
		);
		return mapPluginInfoResponse(await unary(encodePluginInfoRequest(id)));
	}

	async enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Enable,
			decodeEnablePluginResponse,
		);
		const wire = await unary(encodeEnablePluginRequest(id, enabled));
		return { plugin: mapPluginSummary(wire.plugin) };
	}

	async reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Reload,
			decodeReloadPluginResponse,
		);
		const wire = await unary(encodeReloadPluginRequest(id));
		return { plugin: mapPluginSummary(wire.plugin) };
	}

	async unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.Unload,
			decodeUnloadPluginResponse,
		);
		const wire = await unary(encodeUnloadPluginRequest(id));
		return { removedHookCount: wire.removed_hook_count ?? 0 };
	}

	async scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Plugin.service,
			UniverseAgentGrpcServices.Plugin.ScanNew,
			decodeScanNewPluginsResponse,
		);
		const wire = await unary(encodeScanNewPluginsRequest());
		return {
			newPlugins: (wire.new_plugins ?? []).map(mapPluginSummary),
			skippedCount: wire.skipped_count ?? 0,
		};
	}

	async toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.ToggleMcpServer,
			decodeToggleMcpServerResponse,
		);
		return mapToggleMcpServerResponse(await unary(encodeToggleMcpServerRequest(request)));
	}

	async addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.AddMcpServer,
			decodeAddMcpServerResponse,
		);
		return mapAddMcpServerResponse(await unary(encodeAddMcpServerRequest(request)));
	}

	async updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.UpdateMcpServer,
			decodeUpdateMcpServerResponse,
		);
		return mapUpdateMcpServerResponse(await unary(encodeUpdateMcpServerRequest(request)));
	}

	async removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Mcp.service,
			UniverseAgentGrpcServices.Mcp.RemoveMcpServer,
			decodeRemoveMcpServerResponse,
		);
		return mapRemoveMcpServerResponse(await unary(encodeRemoveMcpServerRequest(request)));
	}

	async listTools(): Promise<UniverseAgentListToolsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ListTools,
			decodeListToolsResponse,
		);
		return mapListToolsResponse(await unary(encodeListToolsRequest()));
	}

	async getToolInfo(request: UniverseAgentToolInfoRequest): Promise<UniverseAgentToolInfoResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ToolInfo,
			decodeToolInfoResponse,
		);
		return mapToolInfoResponse(await unary(encodeToolInfoRequest(request)));
	}

	async listCommands(): Promise<UniverseAgentListCommandsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.ListCommands,
			decodeListCommandsResponse,
		);
		return mapListCommandsResponse(await unary(encodeListCommandsRequest()));
	}

	async getCommandDef(request: UniverseAgentGetCommandDefRequest): Promise<UniverseAgentGetCommandDefResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Tool.service,
			UniverseAgentGrpcServices.Tool.GetCommandDef,
			decodeGetCommandDefResponse,
		);
		return mapGetCommandDefResponse(await unary(encodeGetCommandDefRequest(request)));
	}

	async listFiles(request: UniverseAgentListFilesRequest): Promise<UniverseAgentListFilesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.ListFiles,
			decodeListFilesResponse,
		);
		return mapListFilesResponse(await unary(encodeListFilesRequest(request)));
	}

	async readFile(request: UniverseAgentReadFileRequest): Promise<UniverseAgentReadFileResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.ReadFile,
			decodeReadFileResponse,
		);
		return mapReadFileResponse(await unary(encodeReadFileRequest(request)));
	}

	async getFileInfo(request: UniverseAgentGetFileInfoRequest): Promise<UniverseAgentGetFileInfoResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.GetFileInfo,
			decodeGetFileInfoResponse,
		);
		return mapGetFileInfoResponse(await unary(encodeGetFileInfoRequest(request)));
	}

	async writeFile(request: UniverseAgentWriteFileRequest): Promise<UniverseAgentWriteFileResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.WriteFile,
			decodeWriteFileResponse,
		);
		return mapWriteFileResponse(await unary(encodeWriteFileRequest(request)));
	}

	async forceWriteFile(request: UniverseAgentForceWriteFileRequest): Promise<UniverseAgentWriteFileResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.ForceWriteFile,
			decodeWriteFileResponse,
		);
		return mapWriteFileResponse(await unary(encodeForceWriteFileRequest(request)));
	}

	async agentMerge(request: UniverseAgentAgentMergeRequest): Promise<UniverseAgentAgentMergeResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.File.service,
			UniverseAgentGrpcServices.File.AgentMerge,
			decodeAgentMergeResponse,
		);
		return mapAgentMergeResponse(await unary(encodeAgentMergeRequest(request)));
	}

	async readGitSummary(request: UniverseAgentReadGitSummaryRequest): Promise<UniverseAgentReadGitSummaryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.ReadGitSummary,
			decodeReadGitSummaryResponse,
		);
		return mapReadGitSummaryResponse(await unary(encodeReadGitSummaryRequest(request)));
	}

	async readGitChanges(request: UniverseAgentReadGitChangesRequest): Promise<UniverseAgentReadGitChangesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.ReadGitChanges,
			decodeReadGitChangesResponse,
		);
		return mapReadGitChangesResponse(await unary(encodeReadGitChangesRequest(request)));
	}

	async readGitFileDiff(request: UniverseAgentReadGitFileDiffRequest): Promise<UniverseAgentReadGitFileDiffResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.ReadGitFileDiff,
			decodeReadGitFileDiffResponse,
		);
		return mapReadGitFileDiffResponse(await unary(encodeReadGitFileDiffRequest(request)));
	}

	async writeGitStagePaths(request: UniverseAgentWriteGitStagePathsRequest): Promise<UniverseAgentWriteGitWriteResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.WriteGitStagePaths,
			decodeWriteGitWriteResponse,
		);
		return mapWriteGitWriteResponse(await unary(encodeWriteGitStagePathsRequest(request)));
	}

	async writeGitCommit(request: UniverseAgentWriteGitCommitRequest): Promise<UniverseAgentWriteGitWriteResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.WriteGitCommit,
			decodeWriteGitWriteResponse,
		);
		return mapWriteGitWriteResponse(await unary(encodeWriteGitCommitRequest(request)));
	}

	async writeGitApplyHunks(request: UniverseAgentWriteGitApplyHunksRequest): Promise<UniverseAgentWriteGitWriteResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Git.service,
			UniverseAgentGrpcServices.Git.WriteGitApplyHunks,
			decodeWriteGitWriteResponse,
		);
		return mapWriteGitWriteResponse(await unary(encodeWriteGitApplyHunksRequest(request)));
	}

	async getSessionUsage(request: UniverseAgentGetSessionUsageRequest): Promise<UniverseAgentGetSessionUsageResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.TokenUsage.service,
			UniverseAgentGrpcServices.TokenUsage.GetSessionUsage,
			decodeGetSessionUsageResponse,
		);
		return mapGetSessionUsageResponse(await unary(encodeGetSessionUsageRequest(request)));
	}

	async getGlobalUsage(): Promise<UniverseAgentGetGlobalUsageResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.TokenUsage.service,
			UniverseAgentGrpcServices.TokenUsage.GetGlobalUsage,
			decodeGetGlobalUsageResponse,
		);
		return mapGetGlobalUsageResponse(await unary(encodeGetGlobalUsageRequest()));
	}

	async saveMemory(request: UniverseAgentSaveMemoryRequest): Promise<UniverseAgentSaveMemoryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Save,
			decodeMemorySaveResponse,
		);
		return mapMemorySaveResponse(await unary(encodeMemorySaveRequest(request)));
	}

	async searchMemory(request: UniverseAgentMemorySearchRequest): Promise<UniverseAgentMemorySearchResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Search,
			decodeMemorySearchResponse,
		);
		return mapMemorySearchResponse(await unary(encodeMemorySearchRequest(request)));
	}

	async searchDeepMemory(request: UniverseAgentMemorySearchDeepRequest): Promise<UniverseAgentMemorySearchDeepResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.SearchDeep,
			decodeMemorySearchDeepResponse,
		);
		return mapMemorySearchDeepResponse(await unary(encodeMemorySearchDeepRequest(request)));
	}

	async readMemory(request: UniverseAgentReadMemoryRequest): Promise<UniverseAgentReadMemoryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Read,
			decodeMemoryReadResponse,
		);
		return mapMemoryReadResponse(await unary(encodeMemoryReadRequest(request)));
	}

	async listMemory(request: UniverseAgentMemoryListRequest): Promise<UniverseAgentMemoryListResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.List,
			decodeMemoryListResponse,
		);
		return mapMemoryListResponse(await unary(encodeMemoryListRequest(request)));
	}

	async deleteMemory(request: UniverseAgentDeleteMemoryRequest): Promise<UniverseAgentDeleteMemoryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Delete,
			decodeMemoryDeleteResponse,
		);
		return mapMemoryDeleteResponse(await unary(encodeMemoryDeleteRequest(request)));
	}

	async reflectMemory(request: UniverseAgentReflectMemoryRequest): Promise<UniverseAgentReflectMemoryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Reflect,
			decodeMemoryReflectResponse,
		);
		return mapMemoryReflectResponse(await unary(encodeMemoryReflectRequest(request)));
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.Revert,
			decodeMemoryRevertResponse,
		);
		return mapMemoryRevertResponse(await unary(encodeMemoryRevertRequest(request)));
	}

	async historyMemory(request: UniverseAgentMemoryHistoryRequest): Promise<UniverseAgentMemoryHistoryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Memory.service,
			UniverseAgentGrpcServices.Memory.History,
			decodeMemoryHistoryResponse,
		);
		return mapMemoryHistoryResponse(await unary(encodeMemoryHistoryRequest(request)));
	}

	async listContextVariable(request: UniverseAgentContextVariableListRequest): Promise<UniverseAgentContextVariableListResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.ContextVariable.service,
			UniverseAgentGrpcServices.ContextVariable.List,
			decodeContextVariableListResponse,
		);
		return mapContextVariableListResponse(await unary(encodeContextVariableListRequest(request)));
	}

	async readContextVariable(request: UniverseAgentContextVariableReadRequest): Promise<UniverseAgentContextVariableReadResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.ContextVariable.service,
			UniverseAgentGrpcServices.ContextVariable.Read,
			decodeContextVariableReadResponse,
		);
		return mapContextVariableReadResponse(await unary(encodeContextVariableReadRequest(request)));
	}

	async listNodes(request: UniverseAgentListNodesRequest): Promise<UniverseAgentListNodesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ListNodes,
			decodeListNodesResponse,
		);
		return mapListNodesResponse(await unary(encodeListNodesRequest(request)));
	}

	async getNode(request: UniverseAgentGetNodeRequest): Promise<UniverseAgentRemoteAgentInfo> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.GetNode,
			decodeGetNodeResponse,
		);
		return mapRemoteAgentInfo(await unary(encodeGetNodeRequest(request)));
	}

	async checkConnection(request: UniverseAgentCheckConnectionRequest): Promise<UniverseAgentConnectionReport> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.CheckConnection,
			decodeCheckConnectionResponse,
		);
		return mapConnectionReport(await unary(encodeCheckConnectionRequest(request)));
	}

	async setMaintenance(request: UniverseAgentSetMaintenanceRequest): Promise<UniverseAgentSetMaintenanceResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.SetMaintenance,
			decodeSetMaintenanceResponse,
		);
		return mapSetMaintenanceResponse(await unary(encodeSetMaintenanceRequest(request)));
	}

	async exitMaintenance(request: UniverseAgentExitMaintenanceRequest): Promise<UniverseAgentExitMaintenanceResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ExitMaintenance,
			decodeExitMaintenanceResponse,
		);
		return mapExitMaintenanceResponse(await unary(encodeExitMaintenanceRequest(request)));
	}

	async listConfigs(): Promise<UniverseAgentListConfigsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ListConfigs,
			decodeListConfigsResponse,
		);
		return mapListConfigsResponse(await unary(encodeListConfigsRequest()));
	}

	async getRemoteAgentConfig(request: UniverseAgentGetRemoteAgentConfigRequest): Promise<UniverseAgentRemoteAgentConfig> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.GetConfig,
			decodeGetConfigResponseFromRemoteAgent,
		);
		return mapRemoteAgentConfig(await unary(encodeGetConfigRequestFromRemoteAgent(request)));
	}

	async saveRemoteAgentConfig(request: UniverseAgentSaveRemoteAgentConfigRequest): Promise<UniverseAgentSaveRemoteAgentConfigResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.SaveConfig,
			decodeSaveConfigResponse,
		);
		return mapSaveRemoteAgentConfigResponse(await unary(encodeSaveConfigRequest(request)));
	}

	async resetError(request: UniverseAgentResetErrorRequest): Promise<UniverseAgentResetErrorResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ResetError,
			decodeResetErrorResponse,
		);
		return mapResetErrorResponse(await unary(encodeResetErrorRequest(request)));
	}

	async deleteRemoteAgentConfig(request: UniverseAgentDeleteRemoteAgentConfigRequest): Promise<UniverseAgentDeleteRemoteAgentConfigResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.DeleteConfig,
			decodeDeleteConfigResponse,
		);
		return mapDeleteRemoteAgentConfigResponse(await unary(encodeDeleteConfigRequest(request)));
	}

	async reloadRemoteAgents(): Promise<UniverseAgentReloadRemoteAgentsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.Reload,
			decodeReloadRemoteAgentsResponse,
		);
		return mapReloadRemoteAgentsResponse(await unary(encodeReloadRemoteAgentsRequest()));
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.CreateRemoteSession,
			decodeCreateRemoteSessionResponse,
		);
		return mapCreateRemoteSessionResponse(await unary(encodeCreateRemoteSessionRequest(request)));
	}

	async destroyRemoteSession(request: UniverseAgentDestroyRemoteSessionRequest): Promise<UniverseAgentDestroyRemoteSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.DestroyRemoteSession,
			decodeDestroyRemoteSessionResponse,
		);
		return mapDestroyRemoteSessionResponse(await unary(encodeDestroyRemoteSessionRequest(request)));
	}

	async getRemoteSessionStatus(request: UniverseAgentGetRemoteSessionStatusRequest): Promise<UniverseAgentGetRemoteSessionStatusResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.GetRemoteSessionStatus,
			decodeGetRemoteSessionStatusResponse,
		);
		return mapGetRemoteSessionStatusResponse(await unary(encodeGetRemoteSessionStatusRequest(request)) as Parameters<typeof mapGetRemoteSessionStatusResponse>[0]);
	}

	async getRemoteSessionHistory(request: UniverseAgentGetRemoteSessionHistoryRequest): Promise<UniverseAgentGetRemoteSessionHistoryResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.GetRemoteSessionHistory,
			decodeGetRemoteSessionHistoryResponse,
		);
		return mapGetRemoteSessionHistoryResponse(await unary(encodeGetRemoteSessionHistoryRequest(request)));
	}
	async resumeRemoteSession(request: UniverseAgentResumeRemoteSessionRequest): Promise<UniverseAgentResumeRemoteSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.ResumeRemoteSession,
			decodeResumeRemoteSessionResponse,
		);
		return mapResumeRemoteSessionResponse(await unary(encodeResumeRemoteSessionRequest(request)));
	}
	async cancelRemoteSession(request: UniverseAgentCancelRemoteSessionRequest): Promise<UniverseAgentCancelRemoteSessionResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.RemoteAgent.service,
			UniverseAgentGrpcServices.RemoteAgent.CancelRemoteSession,
			decodeCancelRemoteSessionResponse,
		);
		return mapCancelRemoteSessionResponse(await unary(encodeCancelRemoteSessionRequest(request)));
	}

	async getUploadProgress(request: UniverseAgentGetUploadProgressRequest): Promise<UniverseAgentGetUploadProgressResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.FileTransfer.service,
			UniverseAgentGrpcServices.FileTransfer.GetUploadProgress,
			decodeGetUploadProgressResponse,
		);
		return mapUploadProgressResponse(await unary(encodeGetUploadProgressRequest(request)));
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.Doctor,
			decodeDoctorResponse,
		);
		return mapDoctorResponse(await unary(encodeDoctorRequest()));
	}

	async listDevices(): Promise<UniverseAgentListDevicesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.ListDevices,
			decodeListDevicesResponse,
		);
		return mapListDevicesResponse(await unary(encodeListDevicesRequest()));
	}

	async pairApprove(request: UniverseAgentPairApproveRequest): Promise<UniverseAgentPairApproveResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.PairApprove,
			decodePairApproveResponse,
		);
		return mapPairApproveResponse(await unary(encodePairApproveRequest(request)));
	}

	async pairReject(request: UniverseAgentPairRejectRequest): Promise<UniverseAgentPairRejectResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.PairReject,
			decodePairRejectResponse,
		);
		return mapPairRejectResponse(await unary(encodePairRejectRequest(request)));
	}

	async revoke(request: UniverseAgentRevokeRequest): Promise<UniverseAgentRevokeResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.Revoke,
			decodeRevokeResponse,
		);
		return mapRevokeResponse(await unary(encodeRevokeRequest(request)));
	}

	async rotateToken(request: UniverseAgentRotateTokenRequest): Promise<UniverseAgentRotateTokenResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.RotateToken,
			decodeRotateTokenResponse,
		);
		return mapRotateTokenResponse(await unary(encodeRotateTokenRequest(request)));
	}

	async listPending(): Promise<UniverseAgentListPendingResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Device.service,
			UniverseAgentGrpcServices.Device.ListPending,
			decodeListPendingResponse,
		);
		return mapListPendingResponse(await unary(encodeListPendingRequest()));
	}

	async listTriggers(request: UniverseAgentListTriggersRequest): Promise<UniverseAgentListTriggersResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.ListTriggers,
			decodeListTriggersResponse,
		);
		return mapListTriggersResponse(await unary(encodeListTriggersRequest(request)));
	}

	async upsertTrigger(request: UniverseAgentUpsertTriggerRequest): Promise<UniverseAgentUpsertTriggerResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.UpsertTrigger,
			decodeUpsertTriggerResponse,
		);
		return mapUpsertTriggerResponse(await unary(encodeUpsertTriggerRequest(request)));
	}

	async deleteTrigger(request: UniverseAgentDeleteTriggerRequest): Promise<UniverseAgentDeleteTriggerResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.DeleteTrigger,
			decodeDeleteTriggerResponse,
		);
		return mapDeleteTriggerResponse(await unary(encodeDeleteTriggerRequest(request)));
	}

	async setTriggerEnabled(request: UniverseAgentSetTriggerEnabledRequest): Promise<UniverseAgentSetTriggerEnabledResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.SetTriggerEnabled,
			decodeSetTriggerEnabledResponse,
		);
		return mapSetTriggerEnabledResponse(await unary(encodeSetTriggerEnabledRequest(request)));
	}

	async fireTrigger(request: UniverseAgentFireTriggerRequest): Promise<UniverseAgentFireTriggerResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Trigger.service,
			UniverseAgentGrpcServices.Trigger.FireTrigger,
			decodeFireTriggerResponse,
		);
		return mapFireTriggerResponse(await unary(encodeFireTriggerRequest(request)));
	}

	async setPermissionPolicy(request: UniverseAgentSetPermissionPolicyRequest): Promise<UniverseAgentSetPermissionPolicyResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.SetPermissionPolicy,
			decodeSetPermissionPolicyResponse,
		);
		const wire = await unary(encodeSetPermissionPolicyRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async listModels(): Promise<UniverseAgentListModelsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.ListModels,
			decodeListModelsResponse,
		);
		return mapListModelsResponse(await unary(encodeListModelsRequest()));
	}

	async getConfig(request: UniverseAgentGetConfigRequest): Promise<UniverseAgentGetConfigResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.Get,
			decodeGetConfigResponse,
		);
		const wire = await unary(encodeGetConfigRequest(request));
		return {
			values: wire.values && typeof wire.values === 'object' ? wire.values : {},
			scope: wire.scope ?? '',
		};
	}

	async getModelPreferences(request: UniverseAgentGetModelPreferencesRequest): Promise<UniverseAgentGetModelPreferencesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.GetModelPreferences,
			decodeGetModelPreferencesResponse,
		);
		const wire = await unary(encodeGetModelPreferencesRequest(request));
		return {
			minLevel: wire.min_level ?? 0,
			maxCost: wire.max_cost ?? '',
			minSpeed: wire.min_speed ?? '',
			strategy: wire.strategy ?? '',
		};
	}

	async setConfig(request: UniverseAgentSetConfigRequest): Promise<UniverseAgentSetConfigResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.Set,
			decodeSetConfigResponse,
		);
		const wire = await unary(encodeSetConfigRequest(request));
		return {
			ok: wire.success === true,
			message: wire.message,
		};
	}

	async switchModel(request: UniverseAgentSwitchModelRequest): Promise<UniverseAgentSwitchModelResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.SwitchModel,
			decodeSwitchModelResponse,
		);
		return unary(encodeSwitchModelRequest(request));
	}

	async setModelPreferences(request: UniverseAgentSetModelPreferencesRequest): Promise<UniverseAgentSetModelPreferencesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.SetModelPreferences,
			decodeSetModelPreferencesResponse,
		);
		const wire = await unary(encodeSetModelPreferencesRequest(request));
		const prefs = wire.preferences;
		return {
			minLevel: prefs?.min_level ?? 0,
			maxCost: prefs?.max_cost ?? '',
			minSpeed: prefs?.min_speed ?? '',
			strategy: prefs?.strategy ?? '',
		};
	}

	async resolveModel(request: UniverseAgentResolveModelRequest): Promise<UniverseAgentResolveModelResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Config.service,
			UniverseAgentGrpcServices.Config.ResolveModel,
			decodeResolveModelResponse,
		);
		return mapResolveModelResponse(await unary(encodeResolveModelRequest(request)) as Parameters<typeof mapResolveModelResponse>[0]);
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.FetchToolDetail,
			decodeFetchToolDetailResponse,
		);
		const wire = await unary(encodeFetchToolDetailRequest(request));
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
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.Tree,
			decodeAgentTreeResponse,
		);
		const wire = await unary(encodeAgentTreeRequest(sessionId));
		return mapAgentTreeNode(wire.root);
	}

	async memberStatus(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamMemberInfo[]> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.MemberStatus,
			decodeMemberStatusResponse,
		);
		const wire = await unary(encodeMemberStatusRequest(sessionId, agentId));
		return (wire.members ?? []).map(mapMemberInfo);
	}

	async taskList(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamTaskInfo[]> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TaskList,
			decodeTaskListResponse,
		);
		const wire = await unary(encodeTaskListRequest(sessionId, agentId));
		return (wire.tasks ?? []).map(mapTaskInfo);
	}

	async teamInfo(sessionId: string, agentId: string, teamId: number): Promise<UniverseAgentTeamInfo | undefined> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.TeamInfo,
			decodeTeamInfoResponse,
		);
		const wire = await unary(encodeTeamInfoRequest(sessionId, agentId, teamId));
		if (wire.team_id === undefined) {
			return undefined;
		}
		return { teamId: wire.team_id, status: wire.status ?? '' };
	}

	async listProviderStatus(): Promise<UniverseAgentListProviderStatusResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ListProviderStatus,
			decodeListProviderStatusResponse,
		);
		return mapListProviderStatusResponse(await unary(encodeListProviderStatusRequest()));
	}

	async upsertProviderCredentials(request: UniverseAgentUpsertProviderCredentialsRequest): Promise<UniverseAgentProviderStatus> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.UpsertProviderCredentials,
			decodeProviderStatus,
		);
		return mapProviderStatus(await unary(encodeUpsertProviderCredentialsRequest(request)));
	}

	async clearProviderCredentials(request: UniverseAgentClearProviderCredentialsRequest): Promise<UniverseAgentProviderStatus> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Agent.service,
			UniverseAgentGrpcServices.Agent.ClearProviderCredentials,
			decodeProviderStatus,
		);
		return mapProviderStatus(await unary(encodeClearProviderCredentialsRequest(request)));
	}

	async listProjectRules(request: UniverseAgentListProjectRulesRequest): Promise<UniverseAgentListProjectRulesResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.ProjectRule.service,
			UniverseAgentGrpcServices.ProjectRule.List,
			decodeListProjectRulesResponse,
		);
		return mapListProjectRulesResponse(await unary(encodeListProjectRulesRequest(request)));
	}

	async upsertProjectRule(request: UniverseAgentUpsertProjectRuleRequest): Promise<UniverseAgentProjectRule> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.ProjectRule.service,
			UniverseAgentGrpcServices.ProjectRule.Upsert,
			decodeProjectRuleResponse,
		);
		return mapProjectRule(await unary(encodeUpsertProjectRuleRequest(request)));
	}

	async deleteProjectRule(request: UniverseAgentDeleteProjectRuleRequest): Promise<UniverseAgentDeleteProjectRuleResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.ProjectRule.service,
			UniverseAgentGrpcServices.ProjectRule.Delete,
			decodeDeleteProjectRuleResponse,
		);
		return mapDeleteProjectRuleResponse(await unary(encodeDeleteProjectRuleRequest(request)));
	}

	async listHookPoints(): Promise<UniverseAgentListHookPointsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.System.service,
			UniverseAgentGrpcServices.System.ListHookPoints,
			decodeListHookPointsResponse,
		);
		return mapListHookPointsResponse(await unary(encodeListHookPointsRequest()));
	}

	async listTeams(sessionId: string): Promise<UniverseAgentListTeamsResult> {
		const unary = makeUnaryBytesClient(
			this._channel,
			UniverseAgentGrpcServices.Team.service,
			UniverseAgentGrpcServices.Team.ListTeams,
			decodeListTeamsResponse,
		);
		return mapListTeamsResponse(await unary(encodeListTeamsRequest(sessionId)));
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

