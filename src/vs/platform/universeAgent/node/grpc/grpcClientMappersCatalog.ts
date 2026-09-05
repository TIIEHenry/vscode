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
import {
	base64ToBytes,
	mapClipboardEntryType,
	mapRuleEnum,
	requiredInt64,
} from './grpcClientMappersSession.js';

export interface ListSkillsResponseWire {
	skills?: Array<{
		name?: string;
		description?: string;
		source?: string;
		enabled?: boolean;
		slash_enabled?: boolean;
	}>;
}

export interface SetSkillEnabledResponseWire {
	ok?: boolean;
	reason?: string;
}

export interface SaveSkillContentResponseWire {
	ok?: boolean;
	reason?: string;
}

export interface SkillInfoResponseWire {
	name?: string;
	content?: string;
	source?: string;
	enabled?: boolean;
}

export function mapSkillSource(source: string | undefined): UniverseAgentSkillSource {
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

export function mapSkillSummary(wire: NonNullable<ListSkillsResponseWire['skills']>[number]): UniverseAgentSkillSummary {
	return {
		name: wire.name ?? '',
		description: wire.description,
		source: mapSkillSource(wire.source),
		enabled: wire.enabled === true,
		slashEnabled: wire.slash_enabled,
	};
}

export function mapListSkillsResponse(wire: ListSkillsResponseWire): UniverseAgentListSkillsResult {
	return {
		skills: (wire.skills ?? []).map(mapSkillSummary),
	};
}

export function mapSetSkillEnabledResponse(wire: SetSkillEnabledResponseWire): UniverseAgentSetSkillEnabledResult {
	return {
		ok: wire.ok === true,
		reason: wire.reason,
	};
}

export function mapSaveSkillContentResponse(wire: SaveSkillContentResponseWire): UniverseAgentSaveSkillContentResult {
	return {
		ok: wire.ok === true,
		reason: wire.reason,
	};
}

export function mapSkillInfoResponse(wire: SkillInfoResponseWire): UniverseAgentSkillInfoResult {
	return {
		name: wire.name ?? '',
		content: wire.content ?? '',
		source: mapSkillSource(wire.source),
		enabled: wire.enabled === true,
	};
}

export interface ListAgentProfilesResponseWire {
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

export function mapAgentProfileSource(source: string | undefined): UniverseAgentAgentProfileSource {
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


export function mapAgentProfileDetail(wire: NonNullable<ListAgentProfilesResponseWire['profiles']>[number]): UniverseAgentAgentProfileDetail {
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

export function mapAgentProfileSummary(wire: NonNullable<ListAgentProfilesResponseWire['profiles']>[number]): UniverseAgentAgentProfileSummary {
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


export function mapListAgentProfilesResponse(wire: ListAgentProfilesResponseWire): UniverseAgentListAgentProfilesResult {
	return {
		profiles: (wire.profiles ?? []).map(mapAgentProfileSummary),
	};
}

export interface SaveAgentProfileResponseWire {
	profile?: ListAgentProfilesResponseWire['profiles'] extends (infer T)[] | undefined ? T : never;
}

export function mapSaveAgentProfileResponse(wire: SaveAgentProfileResponseWire): UniverseAgentSaveAgentProfileResult {
	const profileWire = wire.profile;
	if (!profileWire) {
		return { profile: { id: '', name: '' } };
	}
	return { profile: mapAgentProfileDetail(profileWire) };
}

export interface DeleteAgentProfileResponseWire {
	success?: boolean;
}

export function mapDeleteAgentProfileResponse(wire: DeleteAgentProfileResponseWire): UniverseAgentDeleteAgentProfileResult {
	return { ok: wire.success === true };
}

export interface ResetAgentProfileResponseWire {
	success?: boolean;
	profile?: NonNullable<ListAgentProfilesResponseWire['profiles']>[number];
}

export function mapResetAgentProfileResponse(wire: ResetAgentProfileResponseWire): UniverseAgentResetAgentProfileResult {
	return {
		ok: wire.success === true,
		profile: wire.profile ? mapAgentProfileDetail(wire.profile) : undefined,
	};
}



export function mapMcpServerConfigFromWire(wire: Record<string, unknown> | undefined): UniverseAgentMcpServerConfig | undefined {
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

export interface AddMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	assigned_id?: string;
}

export function mapAddMcpServerResponse(wire: AddMcpServerResponseWire): UniverseAgentAddMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		assignedId: wire.assigned_id,
	};
}

export interface UpdateMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	updated_config?: Record<string, unknown>;
}

export function mapUpdateMcpServerResponse(wire: UpdateMcpServerResponseWire): UniverseAgentUpdateMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		config: mapMcpServerConfigFromWire(wire.updated_config),
	};
}

export interface RemoveMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
	removed_name?: string;
}

export function mapRemoveMcpServerResponse(wire: RemoveMcpServerResponseWire): UniverseAgentRemoveMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
		removedName: wire.removed_name,
	};
}

export interface ListMcpServersResponseWire {
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

export function mapMcpOrigin(origin: string | undefined): UniverseAgentMcpServerOrigin {
	switch (origin?.toLowerCase()) {
		case 'global':
			return 'global';
		case 'project':
			return 'project';
		default:
			return 'unknown';
	}
}

export function mapMcpTransport(transport: string | undefined): UniverseAgentMcpTransport {
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

export function mapMcpServerSummary(wire: NonNullable<ListMcpServersResponseWire['servers']>[number]): UniverseAgentMcpServerSummary {
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

export function mapListMcpServersResponse(wire: ListMcpServersResponseWire): UniverseAgentListMcpServersResult {
	return {
		servers: (wire.servers ?? []).map(mapMcpServerSummary),
	};
}

export function readEpochMs(value: unknown): number | undefined {
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

export function mapMcpRuntimeStatus(status: unknown): UniverseAgentMcpRuntimeStatus {
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

export interface GetMcpServerStatusesResponseWire {
	statuses?: Array<{
		server_id?: string;
		status?: unknown;
		error_message?: string;
		last_connected_at?: number | string;
	}>;
	checked_at?: number | string;
}

export function mapMcpServerStatus(wire: NonNullable<GetMcpServerStatusesResponseWire['statuses']>[number]): UniverseAgentMcpServerStatus {
	return {
		serverId: wire.server_id ?? '',
		status: mapMcpRuntimeStatus(wire.status),
		errorMessage: wire.error_message,
		lastConnectedAt: readEpochMs(wire.last_connected_at),
	};
}

export function mapGetMcpServerStatusesResponse(wire: GetMcpServerStatusesResponseWire): UniverseAgentGetMcpServerStatusesResult {
	return {
		statuses: (wire.statuses ?? []).map(mapMcpServerStatus),
		checkedAt: readEpochMs(wire.checked_at),
	};
}

export interface GetMcpServerToolsResponseWire {
	tools?: Array<{
		name?: string;
		description?: string;
		input_schema_json?: string;
	}>;
	total?: number;
	cached_at?: number | string;
}

export function mapMcpToolDefinition(wire: NonNullable<GetMcpServerToolsResponseWire['tools']>[number]): UniverseAgentMcpToolDefinition {
	return {
		name: wire.name ?? '',
		description: wire.description,
		inputSchemaJson: wire.input_schema_json,
	};
}

export function mapGetMcpServerToolsResponse(wire: GetMcpServerToolsResponseWire): UniverseAgentGetMcpServerToolsResult {
	return {
		tools: (wire.tools ?? []).map(mapMcpToolDefinition),
		total: wire.total,
		cachedAt: readEpochMs(wire.cached_at),
	};
}

export function mapPluginStatus(status: unknown): UniverseAgentPluginStatus {
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

export interface PluginSummaryWire {
	id?: string;
	display_name?: string;
	version?: string;
	source?: string;
	hook_count?: number;
	status?: unknown;
	loaded_at?: number | string;
}

export function mapPluginSummary(wire: PluginSummaryWire | undefined): UniverseAgentPluginSummary {
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

export interface ListPluginsResponseWire {
	plugins?: PluginSummaryWire[];
}

export function mapListPluginsResponse(wire: ListPluginsResponseWire): UniverseAgentListPluginsResult {
	return {
		plugins: (wire.plugins ?? []).map(mapPluginSummary),
	};
}

export interface PluginHookEntryWire {
	hook_type?: string;
	priority?: number;
	class_name?: string;
}

export interface PluginInfoResponseWire {
	summary?: PluginSummaryWire;
	hooks?: PluginHookEntryWire[];
	config?: Record<string, string>;
	error_message?: string;
}

export function mapPluginHookEntry(wire: PluginHookEntryWire): UniverseAgentPluginHookEntry {
	return {
		hookType: wire.hook_type ?? '',
		priority: wire.priority ?? 0,
		className: wire.class_name ?? '',
	};
}

export function mapPluginInfoResponse(wire: PluginInfoResponseWire): UniverseAgentPluginInfoResult {
	return {
		summary: mapPluginSummary(wire.summary),
		hooks: (wire.hooks ?? []).map(mapPluginHookEntry),
		config: wire.config,
		errorMessage: wire.error_message,
	};
}

export interface EnablePluginResponseWire {
	plugin?: PluginSummaryWire;
}

export interface ReloadPluginResponseWire {
	plugin?: PluginSummaryWire;
}

export interface UnloadPluginResponseWire {
	removed_hook_count?: number;
}

export interface ScanNewPluginsResponseWire {
	new_plugins?: PluginSummaryWire[];
	skipped_count?: number;
}

export interface ToggleMcpServerResponseWire {
	success?: boolean;
	error_message?: string;
}

export function mapToggleMcpServerResponse(wire: ToggleMcpServerResponseWire): UniverseAgentToggleMcpServerResult {
	return {
		ok: wire.success === true,
		reason: wire.error_message,
	};
}

export interface ListToolsResponseWire {
	tools?: Array<{
		name?: string;
		description?: string;
		category?: string;
		destructive?: boolean;
		requires_permission?: boolean;
	}>;
}

export function mapToolSummary(wire: NonNullable<ListToolsResponseWire['tools']>[number]): UniverseAgentToolSummary {
	return {
		name: wire.name ?? '',
		description: wire.description,
		category: wire.category,
		destructive: wire.destructive,
		requiresPermission: wire.requires_permission,
	};
}

export function mapListToolsResponse(wire: ListToolsResponseWire): UniverseAgentListToolsResult {
	return {
		tools: (wire.tools ?? []).map(mapToolSummary),
	};
}

export interface ToolInfoResponseWire {
	name?: string;
	description?: string;
	category?: string;
	input_schema_json?: string;
	destructive?: boolean;
	requires_permission?: boolean;
	aliases?: string[];
}

export function mapToolInfoResponse(wire: ToolInfoResponseWire): UniverseAgentToolInfoResult {
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

export interface ListCommandsResponseWire {
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

export function mapSlashCommandSource(value: string | number | undefined): UniverseAgentSlashCommandSource {
	return mapRuleEnum(value, SlashCommandSourceByNumber) as UniverseAgentSlashCommandSource;
}

export function mapCommandSummary(wire: NonNullable<ListCommandsResponseWire['commands']>[number]): UniverseAgentCommandSummary {
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

export function mapListCommandsResponse(wire: ListCommandsResponseWire): UniverseAgentListCommandsResult {
	return {
		commands: (wire.commands ?? []).map(mapCommandSummary),
		total: wire.total ?? 0,
	};
}

export interface GetCommandDefResponseWire {
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

export function mapGetCommandDefResponse(wire: GetCommandDefResponseWire): UniverseAgentGetCommandDefResult {
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

export interface ListFilesResponseWire {
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

export function mapFileEntry(wire: NonNullable<ListFilesResponseWire['entries']>[number]): UniverseAgentFileEntry {
	return {
		name: wire.name ?? '',
		path: wire.path ?? '',
		isDirectory: wire.is_directory === true,
		size: requiredInt64(wire.size),
		lastModified: requiredInt64(wire.last_modified),
		mimeType: wire.mime_type ?? '',
	};
}

export function mapListFilesResponse(wire: ListFilesResponseWire): UniverseAgentListFilesResult {
	return {
		entries: (wire.entries ?? []).map(mapFileEntry),
		total: wire.total ?? 0,
	};
}

export interface ReadFileResponseWire {
	content?: string;
	total_size?: number | string;
	mime_type?: string;
	line_count?: number | string;
	content_hash?: string;
}

export function mapReadFileResponse(wire: ReadFileResponseWire): UniverseAgentReadFileResult {
	return {
		content: base64ToBytes(wire.content),
		totalSize: requiredInt64(wire.total_size),
		mimeType: wire.mime_type ?? '',
		lineCount: requiredInt64(wire.line_count),
		contentHash: wire.content_hash ?? '',
	};
}

export interface GetFileInfoResponseWire {
	file?: NonNullable<ListFilesResponseWire['entries']>[number];
}

export function mapGetFileInfoResponse(wire: GetFileInfoResponseWire): UniverseAgentGetFileInfoResult {
	return {
		file: mapFileEntry(wire.file ?? {}),
	};
}

export interface WriteFileResponseWire {
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

export function mapWriteFileStatus(value: string | number | undefined): UniverseAgentWriteFileStatus {
	if (typeof value === 'number') {
		return WriteFileStatusByNumber[value] ?? 'SAVED';
	}
	if (value === 'MERGED' || value === 'CONFLICT' || value === 'SAVED') {
		return value;
	}
	return 'SAVED';
}

export function mapWriteFileResponse(wire: WriteFileResponseWire): UniverseAgentWriteFileResult {
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

export interface AgentMergeResponseWire {
	accepted?: boolean;
}

export function mapAgentMergeResponse(wire: AgentMergeResponseWire): UniverseAgentAgentMergeResult {
	return {
		accepted: wire.accepted === true,
	};
}

export interface ReadGitSummaryResponseWire {
	supported?: boolean;
	reason?: string;
	branch?: string;
	change_count?: number | string;
}

export function mapReadGitSummaryResponse(wire: ReadGitSummaryResponseWire): UniverseAgentReadGitSummaryResult {
	return {
		supported: wire.supported === true,
		reason: wire.reason ?? '',
		branch: wire.branch ?? '',
		changeCount: requiredInt64(wire.change_count),
	};
}

export interface GitChangeEntryWire {
	path?: string;
	old_path?: string;
	kind?: string;
	index_state?: string;
}

export interface ReadGitChangesResponseWire {
	supported?: boolean;
	reason?: string;
	branch?: string;
	entries?: GitChangeEntryWire[];
}

export function mapGitChangeEntry(wire: GitChangeEntryWire): UniverseAgentGitChangeEntry {
	return {
		path: wire.path ?? '',
		oldPath: wire.old_path ?? '',
		kind: wire.kind ?? '',
		indexState: wire.index_state ?? '',
	};
}

export function mapReadGitChangesResponse(wire: ReadGitChangesResponseWire): UniverseAgentReadGitChangesResult {
	return {
		supported: wire.supported === true,
		reason: wire.reason ?? '',
		branch: wire.branch ?? '',
		entries: (wire.entries ?? []).map(mapGitChangeEntry),
	};
}

export interface ReadGitFileDiffResponseWire {
	supported?: boolean;
	reason?: string;
	path?: string;
	unified_diff?: string;
}

export function mapReadGitFileDiffResponse(wire: ReadGitFileDiffResponseWire): UniverseAgentReadGitFileDiffResult {
	return {
		supported: wire.supported === true,
		reason: wire.reason ?? '',
		path: wire.path ?? '',
		unifiedDiff: wire.unified_diff ?? '',
	};
}

export interface WriteGitWriteResponseWire {
	supported?: boolean;
	reason?: string;
	success?: boolean;
	error_message?: string;
	exit_code?: number | string;
	stdout?: string;
}

export function mapWriteGitWriteResponse(wire: WriteGitWriteResponseWire): UniverseAgentWriteGitWriteResult {
	return {
		supported: wire.supported === true,
		reason: wire.reason ?? '',
		success: wire.success === true,
		errorMessage: wire.error_message ?? '',
		exitCode: requiredInt64(wire.exit_code),
		stdout: wire.stdout ?? '',
	};
}

export interface TokenUsageDataWire {
	input_tokens?: number | string;
	output_tokens?: number | string;
	thinking_tokens?: number | string;
	cache_read_tokens?: number | string;
	cache_write_tokens?: number | string;
	total_cost_micros?: number | string;
	currency?: string;
	request_count?: number | string;
}

export interface GetSessionUsageResponseWire {
	usage?: TokenUsageDataWire;
}

export interface GetGlobalUsageResponseWire {
	usage?: TokenUsageDataWire;
}

export function mapTokenUsageData(wire: TokenUsageDataWire | undefined): UniverseAgentTokenUsageData {
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

export function mapGetSessionUsageResponse(wire: GetSessionUsageResponseWire): UniverseAgentGetSessionUsageResult {
	return {
		usage: mapTokenUsageData(wire.usage ?? {}),
	};
}

export function mapGetGlobalUsageResponse(wire: GetGlobalUsageResponseWire): UniverseAgentGetGlobalUsageResult {
	return {
		usage: mapTokenUsageData(wire.usage),
	};
}

export interface MemorySaveResponseWire {
	success?: boolean;
	message?: string;
	file_path?: string;
}

export function mapMemorySaveResponse(wire: MemorySaveResponseWire): UniverseAgentSaveMemoryResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
		filePath: wire.file_path ?? '',
	};
}

export interface MemorySearchResultWire {
	category?: string;
	filename?: string;
	title?: string;
	score?: number | string;
	snippet?: string;
	forgot?: boolean;
	scope?: string;
}

export interface MemorySearchResponseWire {
	results?: MemorySearchResultWire[];
}

export function requiredDouble(value: number | string | undefined): number {
	const n = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(n) ? n : 0;
}

export function mapMemorySearchEntry(wire: MemorySearchResultWire): UniverseAgentMemorySearchEntry {
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

export function mapMemorySearchResponse(wire: MemorySearchResponseWire): UniverseAgentMemorySearchResult {
	return {
		results: (wire.results ?? []).map(mapMemorySearchEntry),
	};
}

export interface MemorySearchDeepResponseWire {
	results?: MemorySearchResultWire[];
	searched_categories?: Array<string | undefined>;
}

export function mapMemorySearchDeepResponse(wire: MemorySearchDeepResponseWire): UniverseAgentMemorySearchDeepResult {
	return {
		results: (wire.results ?? []).map(mapMemorySearchEntry),
		searchedCategories: (wire.searched_categories ?? []).map(category => category ?? ''),
	};
}

export interface MemoryFileMetadataWire {
	category?: string;
	filename?: string;
	title?: string;
	tags?: string[];
	created_at?: number | string;
	updated_at?: number | string;
	version?: number | string;
}

export interface MemoryReadResponseWire {
	content?: string;
	metadata?: MemoryFileMetadataWire;
}

export function mapMemoryFileMetadata(wire: MemoryFileMetadataWire | undefined): UniverseAgentMemoryFileMetadata {
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

export function mapMemoryReadResponse(wire: MemoryReadResponseWire): UniverseAgentReadMemoryResult {
	return {
		content: wire.content ?? '',
		metadata: mapMemoryFileMetadata(wire.metadata),
	};
}

export interface MemoryFileSummaryWire {
	filename?: string;
	title?: string;
	updated_at?: number | string;
}

export interface MemoryCategoryInfoWire {
	category?: string;
	files?: MemoryFileSummaryWire[];
	file_count?: number | string;
}

export interface MemoryListResponseWire {
	categories?: MemoryCategoryInfoWire[];
}

export function mapMemoryFileSummary(wire: MemoryFileSummaryWire): UniverseAgentMemoryFileSummary {
	return {
		filename: wire.filename ?? '',
		title: wire.title ?? '',
		updatedAt: requiredInt64(wire.updated_at),
	};
}

export function mapMemoryCategoryInfo(wire: MemoryCategoryInfoWire): UniverseAgentMemoryCategoryInfo {
	return {
		category: wire.category ?? '',
		files: (wire.files ?? []).map(mapMemoryFileSummary),
		fileCount: requiredInt64(wire.file_count),
	};
}

export function mapMemoryListResponse(wire: MemoryListResponseWire): UniverseAgentMemoryListResult {
	return {
		categories: (wire.categories ?? []).map(mapMemoryCategoryInfo),
	};
}

export interface MemoryDeleteResponseWire {
	success?: boolean;
	message?: string;
}

export function mapMemoryDeleteResponse(wire: MemoryDeleteResponseWire): UniverseAgentDeleteMemoryResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

export interface MemoryReflectDiagnosisWire {
	type?: string;
	category?: string;
	filename?: string;
	description?: string;
	suggestion?: string;
}

export interface MemoryReflectResponseWire {
	diagnoses?: MemoryReflectDiagnosisWire[];
	summary?: string;
}

export function mapMemoryReflectDiagnosis(wire: MemoryReflectDiagnosisWire): UniverseAgentMemoryReflectDiagnosis {
	return {
		type: wire.type ?? '',
		category: wire.category ?? '',
		filename: wire.filename ?? '',
		description: wire.description ?? '',
		suggestion: wire.suggestion ?? '',
	};
}

export function mapMemoryReflectResponse(wire: MemoryReflectResponseWire): UniverseAgentReflectMemoryResult {
	return {
		diagnoses: (wire.diagnoses ?? []).map(mapMemoryReflectDiagnosis),
		summary: wire.summary ?? '',
	};
}

export interface MemoryRebuildEventWire {
	phase?: string;
	message?: string;
	progress?: number | string;
	files_processed?: number | string;
	files_total?: number | string;
}

export function mapMemoryRebuildEvent(wire: MemoryRebuildEventWire): UniverseAgentMemoryRebuildEvent {
	return {
		phase: wire.phase ?? '',
		message: wire.message ?? '',
		progress: requiredInt64(wire.progress),
		filesProcessed: requiredInt64(wire.files_processed),
		filesTotal: requiredInt64(wire.files_total),
	};
}

export interface MemoryRevertResponseWire {
	success?: boolean;
	message?: string;
	reverted_to_version?: number | string;
}

export function mapMemoryRevertResponse(wire: MemoryRevertResponseWire): UniverseAgentRevertMemoryResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
		revertedToVersion: requiredInt64(wire.reverted_to_version),
	};
}

export interface MemoryChangeEntryWire {
	version?: number | string;
	change_type?: string;
	summary?: string;
	timestamp?: number | string;
	author?: string;
}

export interface MemoryHistoryResponseWire {
	changes?: MemoryChangeEntryWire[];
}

export function mapMemoryChangeEntry(wire: MemoryChangeEntryWire): UniverseAgentMemoryChangeEntry {
	return {
		version: requiredInt64(wire.version),
		changeType: wire.change_type ?? '',
		summary: wire.summary ?? '',
		timestamp: requiredInt64(wire.timestamp),
		author: wire.author ?? '',
	};
}

export function mapMemoryHistoryResponse(wire: MemoryHistoryResponseWire): UniverseAgentMemoryHistoryResult {
	return {
		changes: (wire.changes ?? []).map(mapMemoryChangeEntry),
	};
}

const ContextVariableScopeByNumber: Record<number, UniverseAgentContextVariableScope> = {
	0: 'VARIABLE_GLOBAL',
	1: 'VARIABLE_LOCAL',
};

export function mapContextVariableScope(value: string | number | undefined): UniverseAgentContextVariableScope {
	if (typeof value === 'number') {
		return ContextVariableScopeByNumber[value] ?? 'VARIABLE_GLOBAL';
	}
	if (value === 'VARIABLE_LOCAL' || value === 'VARIABLE_GLOBAL') {
		return value;
	}
	return 'VARIABLE_GLOBAL';
}

export interface ContextVariableEntrySummaryWire {
	name?: string;
	scope?: string | number;
	updated_by?: string;
	updated_at?: number | string;
	content_preview?: string;
}

export interface ContextVariableListResponseWire {
	current?: ContextVariableEntrySummaryWire[];
	inherited?: ContextVariableEntrySummaryWire[];
}

export function mapContextVariableEntrySummary(wire: ContextVariableEntrySummaryWire): UniverseAgentContextVariableEntrySummary {
	return {
		name: wire.name ?? '',
		scope: mapContextVariableScope(wire.scope),
		updatedBy: wire.updated_by ?? '',
		updatedAt: requiredInt64(wire.updated_at),
		contentPreview: wire.content_preview ?? '',
	};
}

export function mapContextVariableListResponse(wire: ContextVariableListResponseWire): UniverseAgentContextVariableListResult {
	return {
		current: (wire.current ?? []).map(mapContextVariableEntrySummary),
		inherited: (wire.inherited ?? []).map(mapContextVariableEntrySummary),
	};
}

export interface ContextVariableEntryWire {
	name?: string;
	content?: string;
	scope?: string | number;
	updated_by?: string;
	updated_at?: number | string;
}

export interface ContextVariableReadResponseWire {
	entry?: ContextVariableEntryWire;
}

export function mapContextVariableEntry(wire: ContextVariableEntryWire | undefined): UniverseAgentContextVariableEntry {
	return {
		name: wire?.name ?? '',
		content: wire?.content ?? '',
		scope: mapContextVariableScope(wire?.scope),
		updatedBy: wire?.updated_by ?? '',
		updatedAt: requiredInt64(wire?.updated_at),
	};
}

export function mapContextVariableReadResponse(wire: ContextVariableReadResponseWire): UniverseAgentContextVariableReadResult {
	return {
		entry: mapContextVariableEntry(wire.entry),
	};
}

export interface RemoteAgentModelInfoWire {
	id?: string;
	name?: string;
	provider?: string;
	max_tokens?: number | string;
	enabled?: boolean;
}

export interface RemoteAgentCapabilitiesWire {
	models?: RemoteAgentModelInfoWire[];
	tools?: string[];
	modes?: string[];
	server_version?: string;
	protocol_version?: string;
	properties?: { [key: string]: string };
}

export interface RemoteAgentLoadMetricsWire {
	active_sessions?: number | string;
	queue_depth?: number | string;
	cpu_percent?: number | string;
	memory_used_mb?: number | string;
}

export interface RemoteAgentInfoWire {
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

export interface ListNodesResponseWire {
	nodes?: RemoteAgentInfoWire[];
	total?: number | string;
	online_count?: number | string;
}

export interface ValidationErrorWire {
	code?: string | number;
	field?: string;
	message?: string;
	suggestion?: string;
}

export interface ConnectionReportWire {
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

export function mapConnectionErrorCode(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return '';
	}
	if (typeof value === 'number') {
		return ConnectionErrorCodeByNumber[value] ?? String(value);
	}
	return value;
}
export function mapRemoteAgentProperties(wire: { [key: string]: string } | undefined): { readonly [key: string]: string } {
	if (!wire) {
		return {};
	}
	const out: { [key: string]: string } = {};
	for (const [key, value] of Object.entries(wire)) {
		out[key] = value ?? '';
	}
	return out;
}

export function mapRemoteAgentModelInfo(wire: RemoteAgentModelInfoWire): UniverseAgentRemoteAgentModelInfo {
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

export function mapRemoteAgentCapabilities(wire: RemoteAgentCapabilitiesWire | undefined): UniverseAgentRemoteAgentCapabilities {
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

export function mapRemoteAgentLoadMetrics(wire: RemoteAgentLoadMetricsWire | undefined): UniverseAgentRemoteAgentLoadMetrics {
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

export function mapRemoteAgentInfo(wire: RemoteAgentInfoWire): UniverseAgentRemoteAgentInfo {
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

export function mapListNodesResponse(wire: ListNodesResponseWire): UniverseAgentListNodesResult {
	return {
		nodes: (wire.nodes ?? []).map(mapRemoteAgentInfo),
		total: requiredInt64(wire.total),
		onlineCount: requiredInt64(wire.online_count),
	};
}

export function mapValidationError(wire: ValidationErrorWire): UniverseAgentValidationError {
	return {
		code: mapConnectionErrorCode(wire.code),
		field: wire.field ?? '',
		message: wire.message ?? '',
		suggestion: wire.suggestion ?? '',
	};
}

export function mapConnectionReport(wire: ConnectionReportWire): UniverseAgentConnectionReport {
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

export interface SetMaintenanceResponseWire {
	success?: boolean;
}

export function mapSetMaintenanceResponse(wire: SetMaintenanceResponseWire): UniverseAgentSetMaintenanceResult {
	return {
		success: wire.success === true,
	};
}

export interface ExitMaintenanceResponseWire {
	success?: boolean;
}

export function mapExitMaintenanceResponse(wire: ExitMaintenanceResponseWire): UniverseAgentExitMaintenanceResult {
	return {
		success: wire.success === true,
	};
}

export interface DeleteRemoteAgentConfigResponseWire {
	success?: boolean;
}

export function mapDeleteRemoteAgentConfigResponse(wire: DeleteRemoteAgentConfigResponseWire): UniverseAgentDeleteRemoteAgentConfigResult {
	return {
		success: wire.success === true,
	};
}

export interface ReloadRemoteAgentsResponseWire {
	success?: boolean;
	added?: string[];
	removed?: string[];
	changed?: string[];
	errors?: string[];
	duration_ms?: number | string;
}

export function mapReloadRemoteAgentsResponse(wire: ReloadRemoteAgentsResponseWire): UniverseAgentReloadRemoteAgentsResult {
	return {
		success: wire.success === true,
		added: (wire.added ?? []).map(id => id ?? ''),
		removed: (wire.removed ?? []).map(id => id ?? ''),
		changed: (wire.changed ?? []).map(id => id ?? ''),
		errors: (wire.errors ?? []).map(id => id ?? ''),
		durationMs: requiredInt64(wire.duration_ms),
	};
}

export interface RemotePendingPermissionWire {
	request_id?: string;
	tool_name?: string;
	path?: string;
	command?: string;
	arguments_json?: string;
	danger_level?: string;
	bubble_target?: string;
}

export interface RemotePendingQuestionWire {
	question_id?: string;
	questions_json?: string;
}

export interface GetRemoteSessionStatusResponseWire {
	status?: string;
	call_id?: string;
	progress?: string;
	elapsed_ms?: number | string;
	expires_at?: number | string;
	pending_permissions?: RemotePendingPermissionWire[];
	pending_questions?: RemotePendingQuestionWire[];
}

export function mapRemotePendingPermission(wire: RemotePendingPermissionWire): UniverseAgentRemotePendingPermission {
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

export function mapRemotePendingQuestion(wire: RemotePendingQuestionWire): UniverseAgentRemotePendingQuestion {
	return {
		questionId: wire.question_id ?? '',
		questionsJson: wire.questions_json ?? '',
	};
}

export function mapGetRemoteSessionStatusResponse(wire: GetRemoteSessionStatusResponseWire): UniverseAgentGetRemoteSessionStatusResult {
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

export interface RemoteToolCallWire {
	id?: string;
	name?: string;
	arguments?: string;
}

export interface RemoteSystemMessageWire {
	content?: string;
}

export interface RemoteUserMessageWire {
	content?: string;
}

export interface RemoteAssistantMessageWire {
	content?: string;
	tool_calls?: RemoteToolCallWire[];
}

export interface RemoteToolResultMessageWire {
	tool_call_id?: string;
	tool_name?: string;
	content?: string;
	is_error?: boolean;
}

export interface RemoteChatMessageWire {
	system?: RemoteSystemMessageWire;
	user?: RemoteUserMessageWire;
	assistant?: RemoteAssistantMessageWire;
	tool_result?: RemoteToolResultMessageWire;
}

export interface GetRemoteSessionHistoryResponseWire {
	messages?: RemoteChatMessageWire[];
	version?: number | string;
	has_more?: boolean;
}

export function mapRemoteChatMessage(wire: RemoteChatMessageWire): UniverseAgentRemoteChatMessage {
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

export function mapGetRemoteSessionHistoryResponse(wire: GetRemoteSessionHistoryResponseWire): UniverseAgentGetRemoteSessionHistoryResult {
	return {
		messages: (wire.messages ?? []).map(mapRemoteChatMessage),
		version: requiredInt64(wire.version),
		hasMore: wire.has_more === true,
	};
}

export interface RemotePermissionDecisionWire {
	decision?: string;
	reason?: string;
}

export interface RemoteResponseWire {
	type?: string;
	request_id?: string;
	permission?: RemotePermissionDecisionWire;
	question_answers_json?: string;
}

export interface RemoteChatResultWire {
	status?: string;
	call_id?: string;
	output?: string;
	error_message?: string;
	error_code?: string;
	pending_permissions?: RemotePendingPermissionWire[];
	pending_questions?: RemotePendingQuestionWire[];
	progress?: string;
	completed_steps?: number | string;
	total_steps_estimate?: number | string;
	messages?: RemoteChatMessageWire[];
}

export interface RemoteProgressEventWire {
	call_id?: string;
	timestamp?: number | string;
	elapsed_ms?: number | string;
	progress?: string;
	completed_steps?: number | string;
	total_steps_estimate?: number | string;
}

export interface RemoteChatResponseWire {
	result?: RemoteChatResultWire;
	progress?: RemoteProgressEventWire;
}


export function mapRemoteChatResult(wire: RemoteChatResultWire): UniverseAgentRemoteChatResult {
	return {
		status: wire.status ?? '',
		callId: wire.call_id ?? '',
		output: wire.output ?? '',
		errorMessage: wire.error_message ?? '',
		errorCode: wire.error_code ?? '',
		pendingPermissions: (wire.pending_permissions ?? []).map(mapRemotePendingPermission),
		pendingQuestions: (wire.pending_questions ?? []).map(mapRemotePendingQuestion),
		progress: wire.progress ?? '',
		completedSteps: requiredInt64(wire.completed_steps),
		totalStepsEstimate: requiredInt64(wire.total_steps_estimate),
		messages: (wire.messages ?? []).map(mapRemoteChatMessage),
	};
}

export function mapRemoteProgressEvent(wire: RemoteProgressEventWire): UniverseAgentRemoteProgressEvent {
	return {
		callId: wire.call_id ?? '',
		timestamp: requiredInt64(wire.timestamp),
		elapsedMs: requiredInt64(wire.elapsed_ms),
		progress: wire.progress ?? '',
		completedSteps: requiredInt64(wire.completed_steps),
		totalStepsEstimate: requiredInt64(wire.total_steps_estimate),
	};
}

export function mapRemoteChatResponse(wire: RemoteChatResponseWire): UniverseAgentRemoteChatResponse {
	return {
		...(wire.result !== undefined ? { result: mapRemoteChatResult(wire.result) } : {}),
		...(wire.progress !== undefined ? { progress: mapRemoteProgressEvent(wire.progress) } : {}),
	};
}

export interface RemoteAgentEndpointWire {
	host?: string;
	port?: number | string;
	tls?: boolean;
	tls_cert_path?: string;
}

export interface RemoteAgentAuthConfigWire {
	type?: string;
	api_key_ref?: string;
	token_ref?: string;
}

export interface RemoteAgentArgConditionWire {
	field?: string;
	operator?: string;
	value?: string;
}

export interface RemoteAgentWhitelistEntryWire {
	tool_name?: string;
	arg_conditions?: RemoteAgentArgConditionWire[];
}

export interface RemoteAgentPermissionBudgetWire {
	max_tool_calls?: number | string;
	max_tokens?: number | string;
	timeout_ms?: number | string;
	window_ms?: number | string;
	max_bubble_to_user_per_day?: number | string;
}

export interface RemoteAgentPermissionDelegateWire {
	mode?: string;
	whitelist?: RemoteAgentWhitelistEntryWire[];
	budget?: RemoteAgentPermissionBudgetWire;
	timeout_policy?: string;
	fallback?: string;
	bubble_target?: string;
}

export interface RemoteAgentHealthCheckConfigWire {
	interval_ms?: number | string;
	timeout_ms?: number | string;
	unhealthy_threshold?: number | string;
	healthy_threshold?: number | string;
	use_watch?: boolean;
	degraded_error_rate_threshold?: number | string;
	degraded_p99_latency_ms?: number | string;
}

export interface RemoteAgentConfigWire {
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

export interface ListConfigsResponseWire {
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

export function mapRemoteAgentEndpoint(wire: RemoteAgentEndpointWire | undefined): UniverseAgentRemoteAgentEndpoint {
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

export function mapRemoteAgentAuthConfig(wire: RemoteAgentAuthConfigWire | undefined): UniverseAgentRemoteAgentAuthConfig {
	if (!wire) {
		return emptyRemoteAgentAuthConfig();
	}
	return {
		type: wire.type ?? '',
		apiKeyRef: wire.api_key_ref ?? '',
		tokenRef: wire.token_ref ?? '',
	};
}

export function mapRemoteAgentArgCondition(wire: RemoteAgentArgConditionWire): UniverseAgentRemoteAgentArgCondition {
	return {
		field: wire.field ?? '',
		operator: wire.operator ?? '',
		value: wire.value ?? '',
	};
}

export function mapRemoteAgentWhitelistEntry(wire: RemoteAgentWhitelistEntryWire): UniverseAgentRemoteAgentWhitelistEntry {
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

export function mapRemoteAgentPermissionBudget(wire: RemoteAgentPermissionBudgetWire | undefined): UniverseAgentRemoteAgentPermissionBudget {
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

export function mapRemoteAgentPermissionDelegate(wire: RemoteAgentPermissionDelegateWire | undefined): UniverseAgentRemoteAgentPermissionDelegate {
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

export function mapRemoteAgentHealthCheckConfig(wire: RemoteAgentHealthCheckConfigWire | undefined): UniverseAgentRemoteAgentHealthCheckConfig {
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

export function mapRemoteAgentConfig(wire: RemoteAgentConfigWire): UniverseAgentRemoteAgentConfig {
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

export function mapListConfigsResponse(wire: ListConfigsResponseWire): UniverseAgentListConfigsResult {
	return {
		configs: (wire.configs ?? []).map(mapRemoteAgentConfig),
	};
}


export interface SaveRemoteAgentConfigResponseWire {
	success?: boolean;
	message?: string;
	connection_test?: ConnectionReportWire;
	async_test_id?: string;
}

export function mapSaveRemoteAgentConfigResponse(wire: SaveRemoteAgentConfigResponseWire): UniverseAgentSaveRemoteAgentConfigResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
		connectionTest: mapConnectionReport(wire.connection_test ?? {}),
		asyncTestId: wire.async_test_id ?? '',
	};
}

export interface ResetErrorResponseWire {
	success?: boolean;
}

export function mapResetErrorResponse(wire: ResetErrorResponseWire): UniverseAgentResetErrorResult {
	return {
		success: wire.success === true,
	};
}

export interface CreateRemoteSessionResponseWire {
	call_id?: string;
	status?: string;
	created_at?: number | string;
	expires_at?: number | string;
}

export function mapCreateRemoteSessionResponse(wire: CreateRemoteSessionResponseWire): UniverseAgentCreateRemoteSessionResult {
	return {
		callId: wire.call_id ?? '',
		status: wire.status ?? '',
		createdAt: requiredInt64(wire.created_at),
		expiresAt: requiredInt64(wire.expires_at),
	};
}

export interface DestroyRemoteSessionResponseWire {
	success?: boolean;
	message?: string;
}

export function mapDestroyRemoteSessionResponse(wire: DestroyRemoteSessionResponseWire): UniverseAgentDestroyRemoteSessionResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

export interface ResumeRemoteSessionResponseWire {
	success?: boolean;
	call_id?: string;
	status?: string;
	message?: string;
	expires_at?: number | string;
}

export function mapResumeRemoteSessionResponse(wire: ResumeRemoteSessionResponseWire): UniverseAgentResumeRemoteSessionResult {
	return {
		success: wire.success === true,
		callId: wire.call_id ?? '',
		status: wire.status ?? '',
		message: wire.message ?? '',
		expiresAt: requiredInt64(wire.expires_at),
	};
}
export interface CancelRemoteSessionResponseWire {
	success?: boolean;
	call_id?: string;
	status?: string;
	message?: string;
}

export function mapCancelRemoteSessionResponse(wire: CancelRemoteSessionResponseWire): UniverseAgentCancelRemoteSessionResult {
	return {
		success: wire.success === true,
		callId: wire.call_id ?? '',
		status: wire.status ?? '',
		message: wire.message ?? '',
	};
}
export interface UploadProgressResponseWire {
	exists?: boolean;
	bytes_received?: number | string;
	partial_path?: string;
}

export function mapUploadProgressResponse(wire: UploadProgressResponseWire): UniverseAgentGetUploadProgressResult {
	return {
		exists: wire.exists === true,
		bytesReceived: requiredInt64(wire.bytes_received),
		partialPath: wire.partial_path ?? '',
	};
}

export interface ShutdownResponseWire {
	accepted?: boolean;
	message?: string;
}

export function mapShutdownResponse(wire: ShutdownResponseWire): UniverseAgentShutdownResult {
	return {
		accepted: wire.accepted === true,
		message: wire.message ?? '',
	};
}

export interface ClipboardWriteResponseWire {
	clip_id?: string;
}

export function mapClipboardWriteResponse(wire: ClipboardWriteResponseWire): UniverseAgentWriteClipboardResult {
	return {
		clipId: wire.clip_id ?? '',
	};
}

export interface ClipboardEntryWire {
	clip_id?: string;
	label?: string;
	type?: string | number;
	content?: string;
	created_by?: string;
	created_at?: number | string;
}

export interface ClipboardReadResponseWire {
	entry?: ClipboardEntryWire;
}

export function mapClipboardEntry(wire: ClipboardEntryWire | undefined): UniverseAgentClipboardEntry {
	return {
		clipId: wire?.clip_id ?? '',
		label: wire?.label ?? '',
		type: mapClipboardEntryType(wire?.type),
		content: wire?.content ?? '',
		createdBy: wire?.created_by ?? '',
		createdAt: requiredInt64(wire?.created_at),
	};
}

export function mapClipboardReadResponse(wire: ClipboardReadResponseWire): UniverseAgentReadClipboardResult {
	return {
		entry: mapClipboardEntry(wire.entry),
	};
}

export interface ClipboardEntrySummaryWire {
	clip_id?: string;
	label?: string;
	type?: string | number;
	created_by?: string;
	created_at?: number | string;
}

export interface ClipboardListResponseWire {
	entries?: ClipboardEntrySummaryWire[];
}

export function mapClipboardEntrySummary(wire: ClipboardEntrySummaryWire): UniverseAgentClipboardEntrySummary {
	return {
		clipId: wire.clip_id ?? '',
		label: wire.label ?? '',
		type: mapClipboardEntryType(wire.type),
		createdBy: wire.created_by ?? '',
		createdAt: requiredInt64(wire.created_at),
	};
}

export function mapClipboardListResponse(wire: ClipboardListResponseWire): UniverseAgentListClipboardResult {
	return {
		entries: (wire.entries ?? []).map(mapClipboardEntrySummary),
	};
}

export interface ClipboardClearResponseWire {
	removed_count?: number;
}

export function mapClipboardClearResponse(wire: ClipboardClearResponseWire): UniverseAgentClearClipboardResult {
	return {
		removedCount: wire.removed_count ?? 0,
	};
}

export interface DownloadChunkWire {
	offset?: number | string;
	data?: string;
	total_size?: number | string;
	is_last?: boolean;
	checksum_sha256?: string;
}

export function mapDownloadChunk(wire: DownloadChunkWire): UniverseAgentDownloadChunk {
	return {
		offset: requiredInt64(wire.offset),
		data: base64ToBytes(wire.data),
		totalSize: requiredInt64(wire.total_size),
		isLast: wire.is_last === true,
		checksumSha256: wire.checksum_sha256 ?? '',
	};
}

export interface PtyOpenSessionResponseWire {
	success?: boolean;
	pty_session_id?: string;
	working_directory?: string;
	title?: string;
	failure_reason?: string | number;
	error_message?: string;
}

export interface PtyReadWire {
	data?: string;
}

export interface PtySessionClosedWire {
	exit_code?: number | string;
	title?: string;
}

export interface PtyErrorWire {
	code?: string | number;
	message?: string;
}

export interface PtyServerMessageWire {
	open_session_response?: PtyOpenSessionResponseWire;
	read?: PtyReadWire;
	session_closed?: PtySessionClosedWire;
	error?: PtyErrorWire;
}

const PtyOpenFailureReasonByNumber: Record<number, string> = {
	0: 'PTY_OPEN_FAILURE_UNSPECIFIED',
	1: 'PTY_OPEN_SESSION_NOT_FOUND',
	2: 'PTY_OPEN_SHELL_NOT_FOUND',
	3: 'PTY_OPEN_PERMISSION_DENIED',
	4: 'PTY_OPEN_SPAWN_FAILED',
};
const PtyErrorCodeByNumber: Record<number, string> = {
	0: 'PTY_ERROR_UNSPECIFIED',
	1: 'PTY_ERROR_SESSION_NOT_FOUND',
	2: 'PTY_ERROR_PERMISSION_DENIED',
	3: 'PTY_ERROR_INTERNAL',
};

export function mapPtyOpenFailureReason(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return 'PTY_OPEN_FAILURE_UNSPECIFIED';
	}
	if (typeof value === 'number') {
		return PtyOpenFailureReasonByNumber[value] ?? String(value);
	}
	return value;
}

export function mapPtyErrorCode(value: string | number | undefined): string {
	if (value === undefined || value === '') {
		return 'PTY_ERROR_UNSPECIFIED';
	}
	if (typeof value === 'number') {
		return PtyErrorCodeByNumber[value] ?? String(value);
	}
	return value;
}


export function mapPtyServerMessage(wire: PtyServerMessageWire): UniverseAgentPtyServerMessage {
	return {
		...(wire.open_session_response !== undefined ? {
			openSessionResponse: {
				success: wire.open_session_response.success === true,
				ptySessionId: wire.open_session_response.pty_session_id ?? '',
				...(wire.open_session_response.working_directory !== undefined ? { workingDirectory: wire.open_session_response.working_directory } : {}),
				...(wire.open_session_response.title !== undefined ? { title: wire.open_session_response.title } : {}),
				failureReason: mapPtyOpenFailureReason(wire.open_session_response.failure_reason),
				...(wire.open_session_response.error_message !== undefined ? { errorMessage: wire.open_session_response.error_message } : {}),
			},
		} : {}),
		...(wire.read !== undefined ? {
			read: {
				data: base64ToBytes(wire.read.data),
			},
		} : {}),
		...(wire.session_closed !== undefined ? {
			sessionClosed: {
				exitCode: requiredInt64(wire.session_closed.exit_code),
				...(wire.session_closed.title !== undefined ? { title: wire.session_closed.title } : {}),
			},
		} : {}),
		...(wire.error !== undefined ? {
			error: {
				code: mapPtyErrorCode(wire.error.code),
				message: wire.error.message ?? '',
			},
		} : {}),
	};
}

export interface HealthCheckResponseWire {
	status?: string;
	version?: string;
	active_sessions?: number | string;
	uptime_ms?: number | string;
}

export function mapHealthCheckResponse(wire: HealthCheckResponseWire): UniverseAgentHealthCheckResult {
	return {
		status: wire.status ?? '',
		version: wire.version ?? '',
		activeSessions: requiredInt64(wire.active_sessions),
		uptimeMs: requiredInt64(wire.uptime_ms),
	};
}

export interface DoctorCheckWire {
	name?: string;
	passed?: boolean;
	message?: string;
	fix_hint?: string;
}

export interface DoctorResponseWire {
	checks?: DoctorCheckWire[];
	all_passed?: boolean;
}

export function mapDoctorCheck(wire: DoctorCheckWire): UniverseAgentDoctorCheck {
	return {
		name: wire.name ?? '',
		passed: wire.passed === true,
		message: wire.message ?? '',
		fixHint: wire.fix_hint ?? '',
	};
}

export function mapDoctorResponse(wire: DoctorResponseWire): UniverseAgentDoctorResult {
	return {
		checks: (wire.checks ?? []).map(mapDoctorCheck),
		allPassed: wire.all_passed === true,
	};
}

export interface DeviceInfoWire {
	device_id?: string;
	display_name?: string;
	role?: string;
	platform?: string;
	paired_at?: number | string;
	last_seen_at?: number | string;
	active?: boolean;
}

export interface ListDevicesResponseWire {
	devices?: DeviceInfoWire[];
}

export function mapDeviceInfo(wire: DeviceInfoWire): UniverseAgentDeviceInfo {
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

export function mapListDevicesResponse(wire: ListDevicesResponseWire): UniverseAgentListDevicesResult {
	return {
		devices: (wire.devices ?? []).map(mapDeviceInfo),
	};
}

export interface PairApproveResponseWire {
	success?: boolean;
	device_id?: string;
	message?: string;
}

export function mapPairApproveResponse(wire: PairApproveResponseWire): UniverseAgentPairApproveResult {
	return {
		success: wire.success === true,
		deviceId: wire.device_id ?? '',
		message: wire.message ?? '',
	};
}

export interface PairRejectResponseWire {
	success?: boolean;
	message?: string;
}

export function mapPairRejectResponse(wire: PairRejectResponseWire): UniverseAgentPairRejectResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

export interface RevokeDeviceResponseWire {
	success?: boolean;
	message?: string;
}

export function mapRevokeResponse(wire: RevokeDeviceResponseWire): UniverseAgentRevokeResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

export interface RotateTokenResponseWire {
	success?: boolean;
	message?: string;
}

export function mapRotateTokenResponse(wire: RotateTokenResponseWire): UniverseAgentRotateTokenResult {
	return {
		success: wire.success === true,
		message: wire.message ?? '',
	};
}

export interface PendingPairInfoWire {
	pairing_code?: string;
	device_id?: string;
	display_name?: string;
	platform?: string;
	requested_at?: number | string;
	expires_in_seconds?: number;
}

export interface ListPendingResponseWire {
	pending?: PendingPairInfoWire[];
}

export function mapPendingPairInfo(wire: PendingPairInfoWire): UniverseAgentPendingPairInfo {
	return {
		pairingCode: wire.pairing_code ?? '',
		deviceId: wire.device_id ?? '',
		displayName: wire.display_name ?? '',
		platform: wire.platform ?? '',
		requestedAt: requiredInt64(wire.requested_at),
		expiresInSeconds: wire.expires_in_seconds ?? 0,
	};
}

export function mapListPendingResponse(wire: ListPendingResponseWire): UniverseAgentListPendingResult {
	return {
		pending: (wire.pending ?? []).map(mapPendingPairInfo),
	};
}

export interface BoundSessionTargetWire {
	session_id?: string;
}

export interface NewSessionTargetWire {
	engine_profile_id?: string;
}

export interface DeliveryTargetDtoWire {
	self?: Record<string, unknown>;
	bound_session?: BoundSessionTargetWire;
	new_session?: NewSessionTargetWire;
}

export interface TriggerDtoWire {
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

export interface ListTriggersResponseWire {
	triggers?: TriggerDtoWire[];
}

export function mapDeliveryTarget(wire: DeliveryTargetDtoWire | undefined): UniverseAgentTriggerDeliveryTarget {
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

export function mapTriggerDto(wire: TriggerDtoWire): UniverseAgentTrigger {
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

export function mapListTriggersResponse(wire: ListTriggersResponseWire): UniverseAgentListTriggersResult {
	return {
		triggers: (wire.triggers ?? []).map(mapTriggerDto),
	};
}

export interface UpsertTriggerResponseWire {
	trigger?: TriggerDtoWire;
}



export function mapUpsertTriggerResponse(wire: UpsertTriggerResponseWire): UniverseAgentUpsertTriggerResult {
	return {
		trigger: mapTriggerDto(wire.trigger ?? {}),
	};
}

export function mapDeleteTriggerResponse(_wire: Record<string, unknown>): UniverseAgentDeleteTriggerResult {
	return {};
}

export interface SetTriggerEnabledResponseWire {
	trigger?: TriggerDtoWire;
}

export function mapSetTriggerEnabledResponse(wire: SetTriggerEnabledResponseWire): UniverseAgentSetTriggerEnabledResult {
	return {
		trigger: mapTriggerDto(wire.trigger ?? {}),
	};
}

export interface FireTriggerResponseWire {
	status?: string;
	event_id?: string;
	reason?: string;
}

export function mapFireTriggerResponse(wire: FireTriggerResponseWire): UniverseAgentFireTriggerResult {
	return {
		status: wire.status ?? '',
		eventId: wire.event_id ?? '',
		reason: wire.reason ?? '',
	};
}

export interface ListModelsResponseWire {
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

export function mapModelEntry(wire: NonNullable<ListModelsResponseWire['models']>[number]): UniverseAgentModelEntry {
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

export function mapListModelsResponse(wire: ListModelsResponseWire): UniverseAgentListModelsResult {
	return {
		models: (wire.models ?? []).map(mapModelEntry),
	};
}

export interface ResolveModelResponseWire {
	selected?: NonNullable<ListModelsResponseWire['models']>[number];
	candidates?: NonNullable<ListModelsResponseWire['models']>;
	filtered?: NonNullable<ListModelsResponseWire['models']>;
}

export function mapResolveModelResponse(wire: ResolveModelResponseWire): UniverseAgentResolveModelResult {
	return {
		...(wire.selected ? { selected: mapModelEntry(wire.selected) } : {}),
		candidates: (wire.candidates ?? []).map(mapModelEntry),
		filtered: (wire.filtered ?? []).map(mapModelEntry),
	};
}

