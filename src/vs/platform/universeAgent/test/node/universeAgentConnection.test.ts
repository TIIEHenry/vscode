/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type {
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentChatSyncRequest,
	UniverseAgentChatSyncResult,
	UniverseAgentSyncInputDeliveryRequest,
	UniverseAgentSyncInputDeliveryResult,
	UniverseAgentChatStream,
	UniverseAgentContinueGenerationRequest,
	UniverseAgentRegenerateRequest,
	UniverseAgentResumeRequest,
	UniverseAgentSubscribeToolDetailRequest,
	UniverseAgentSubscribeToolDetailChunk,
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
	UniverseAgentGetConfigRequest,
	UniverseAgentGetConfigResult,
	UniverseAgentSwitchModelRequest,
	UniverseAgentSwitchModelResult,
	UniverseAgentResolveModelRequest,
	UniverseAgentResolveModelResult,
	UniverseAgentWatchConfigRequest,
	UniverseAgentConfigChangedEvent,
	UniverseAgentUploadChunk,
	UniverseAgentUploadAttachmentResult,
	UniverseAgentSetPermissionPolicyRequest,
	UniverseAgentSetPermissionPolicyResult,
	UniverseAgentGetModelPreferencesRequest,
	UniverseAgentGetModelPreferencesResult,
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
	UniverseAgentRevertMemoryRequest,
	UniverseAgentRevertMemoryResult,
	UniverseAgentMemoryHistoryRequest,
	UniverseAgentMemoryHistoryResult,
	UniverseAgentContextVariableListRequest,
	UniverseAgentContextVariableListResult,
	UniverseAgentContextVariableReadRequest,
	UniverseAgentContextVariableReadResult,
	UniverseAgentGetUploadProgressRequest,
	UniverseAgentGetUploadProgressResult,
	UniverseAgentShutdownRequest,
	UniverseAgentShutdownResult,
	UniverseAgentWriteClipboardRequest,
	UniverseAgentWriteClipboardResult,
	UniverseAgentReadClipboardRequest,
	UniverseAgentReadClipboardResult,
	UniverseAgentDownloadAttachmentRequest,
	UniverseAgentDownloadChunk,
	UniverseAgentHealthCheckResult,
	UniverseAgentDoctorResult,
	UniverseAgentListDevicesResult,
	UniverseAgentPairApproveRequest,
	UniverseAgentPairApproveResult,
	UniverseAgentPairRejectRequest,
	UniverseAgentPairRejectResult,
	UniverseAgentListTriggersRequest,
	UniverseAgentListTriggersResult,
	UniverseAgentUpsertTriggerRequest,
	UniverseAgentUpsertTriggerResult,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSessionEvent,
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
} from '../../common/universeAgentTypes.js';
import { GrpcStatusCode, IUniverseAgentGrpcTransport, UniverseAgentAuthNonceRequest, UniverseAgentAuthNonceResult, UniverseAgentDeviceAuthConnectRequest, UniverseAgentGrpcServices, UniverseAgentTransportError } from '../../node/grpc/grpcTransport.js';
import type { IUniverseAgentConnection } from '../../common/universeAgentConnection.js';
import { createStreamCloseGate } from '../../common/sessionStreamClose.js';
import { UniverseAgentConnectionService } from '../../node/universeAgentConnectionService.js';
import type { ConnectionProfile, IConnectionProfileStore } from '../../node/connectionProfileStore.js';
import type { IClientIdentityStore } from '../../node/clientIdentityTypes.js';
import { createEngineTrustRecord } from '../../node/engineTrustStore.js';
import type { ConnectionResolver } from '../../node/connectionResolver.js';
import type { PairingOrchestrator } from '../../node/pairingOrchestrator.js';
import { InMemoryHubSessionStore } from '../../node/hubSessionStore.js';
import type { ParsedAuthSessionV1 } from '../../node/hub/hub-auth-client.js';
import { randomUUID } from 'node:crypto';

class MockUniverseAgentGrpcTransport implements IUniverseAgentGrpcTransport {

	private _alive = true;

	constructor(
		private readonly handlers: {
			connect?: (request: UniverseAgentConnectRequest) => Promise<UniverseAgentConnectResult>;
			probeRpc?: (service: string, method: string) => Promise<number>;
			listSessions?: (request: UniverseAgentListSessionsRequest) => Promise<UniverseAgentListSessionsResult>;
			saveSkillContent?: (request: UniverseAgentSaveSkillContentRequest) => Promise<UniverseAgentSaveSkillContentResult>;
			fetchAgentTree?: (sessionId: string) => Promise<import('../../common/universeAgentTypes.js').UniverseAgentAgentTreeNode | undefined>;
		} = {},
	) { }

	get isChannelAlive(): boolean {
		return this._alive;
	}

	setChannelAlive(alive: boolean): void {
		this._alive = alive;
	}

	async connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		if (this.handlers.connect) {
			return this.handlers.connect(request);
		}
		return {
			sessionToken: 'token-1',
			workDir: '/tmp/work',
			methods: ['ToolService.ListSkills'],
			events: [],
		};
	}

	async getAuthNonce(_request: UniverseAgentAuthNonceRequest): Promise<UniverseAgentAuthNonceResult> {
		return {
			authNonce: new Uint8Array(32),
			engineIdentityId: 'engine-id',
			engineCertFingerprint: 'a'.repeat(64),
		};
	}

	async connectWithDeviceAuth(_request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult> {
		return {
			sessionToken: 'token-1',
			methods: [],
			events: [],
		};
	}

	close(): void {
		this._alive = false;
	}

	async probeRpc(service: string, method: string): Promise<number> {
		if (this.handlers.probeRpc) {
			return this.handlers.probeRpc(service, method);
		}
		return GrpcStatusCode.OK;
	}

	async listSessions(_request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		if (this.handlers.listSessions) {
			return this.handlers.listSessions(_request);
		}
		return { sessions: [], totalCount: 0 };
	}

	async createSession(_request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		return { sessionId: 'new-session' };
	}

	async deleteSession(_request: UniverseAgentDeleteSessionRequest): Promise<void> {
	}

	readonly getSessionInfoCalls: UniverseAgentSessionInfoRequest[] = [];
	getSessionInfoResult: UniverseAgentSessionInfoResult = {
		sessionId: '',
		createdAt: 0,
		lastAccessedAt: 0,
		provider: '',
		model: '',
	};

	async getSessionInfo(request: UniverseAgentSessionInfoRequest): Promise<UniverseAgentSessionInfoResult> {
		this.getSessionInfoCalls.push(request);
		return this.getSessionInfoResult;
	}

	readonly resumeSessionCalls: UniverseAgentResumeSessionRequest[] = [];
	resumeSessionResult: UniverseAgentResumeSessionResult = { ok: true };

	async resumeSession(request: UniverseAgentResumeSessionRequest): Promise<UniverseAgentResumeSessionResult> {
		this.resumeSessionCalls.push(request);
		return this.resumeSessionResult;
	}

	readonly prewarmSessionsCalls: UniverseAgentPrewarmSessionsRequest[] = [];
	prewarmSessionsResult: UniverseAgentPrewarmSessionsResult = { entries: [] };

	async prewarmSessions(request: UniverseAgentPrewarmSessionsRequest): Promise<UniverseAgentPrewarmSessionsResult> {
		this.prewarmSessionsCalls.push(request);
		return this.prewarmSessionsResult;
	}

	readonly shelveSessionCalls: UniverseAgentShelveSessionRequest[] = [];
	shelveSessionResult: UniverseAgentShelveSessionResult = { ok: true };

	async shelveSession(request: UniverseAgentShelveSessionRequest): Promise<UniverseAgentShelveSessionResult> {
		this.shelveSessionCalls.push(request);
		return this.shelveSessionResult;
	}

	readonly unshelveSessionCalls: UniverseAgentUnshelveSessionRequest[] = [];
	unshelveSessionResult: UniverseAgentUnshelveSessionResult = { ok: true };

	async unshelveSession(request: UniverseAgentUnshelveSessionRequest): Promise<UniverseAgentUnshelveSessionResult> {
		this.unshelveSessionCalls.push(request);
		return this.unshelveSessionResult;
	}

	readonly purgeSessionCalls: UniverseAgentPurgeSessionRequest[] = [];
	purgeSessionResult: UniverseAgentPurgeSessionResult = { ok: true };

	async purgeSession(request: UniverseAgentPurgeSessionRequest): Promise<UniverseAgentPurgeSessionResult> {
		this.purgeSessionCalls.push(request);
		return this.purgeSessionResult;
	}

	readonly exportSessionCalls: UniverseAgentExportSessionRequest[] = [];
	exportSessionResult: UniverseAgentExportSessionResult = { content: '', format: '' };

	async exportSession(request: UniverseAgentExportSessionRequest): Promise<UniverseAgentExportSessionResult> {
		this.exportSessionCalls.push(request);
		return this.exportSessionResult;
	}

	readonly resolveTurnCalls: UniverseAgentResolveTurnRequest[] = [];
	resolveTurnResult: UniverseAgentResolveTurnResult = { kind: 'unspecified' };

	async resolveTurn(request: UniverseAgentResolveTurnRequest): Promise<UniverseAgentResolveTurnResult> {
		this.resolveTurnCalls.push(request);
		return this.resolveTurnResult;
	}

	readonly getAgentStatusCalls: UniverseAgentAgentStatusRequest[] = [];
	getAgentStatusResult: UniverseAgentAgentStatusResult = {};

	async getAgentStatus(request: UniverseAgentAgentStatusRequest): Promise<UniverseAgentAgentStatusResult> {
		this.getAgentStatusCalls.push(request);
		return this.getAgentStatusResult;
	}

	readonly getTodoCalls: UniverseAgentTodoRequest[] = [];
	getTodoResult: UniverseAgentTodoResult = { items: [] };

	async getTodo(request: UniverseAgentTodoRequest): Promise<UniverseAgentTodoResult> {
		this.getTodoCalls.push(request);
		return this.getTodoResult;
	}

	readonly compactCalls: UniverseAgentCompactRequest[] = [];
	compactResult: UniverseAgentCompactResult = { ok: true };

	async compact(request: UniverseAgentCompactRequest): Promise<UniverseAgentCompactResult> {
		this.compactCalls.push(request);
		return this.compactResult;
	}

	readonly resolveAnchorCalls: UniverseAgentResolveAnchorRequest[] = [];
	resolveAnchorResult: UniverseAgentResolveAnchorResult = {};

	async resolveAnchor(request: UniverseAgentResolveAnchorRequest): Promise<UniverseAgentResolveAnchorResult> {
		this.resolveAnchorCalls.push(request);
		return this.resolveAnchorResult;
	}

	readonly getUsageCalls: UniverseAgentUsageRequest[] = [];
	getUsageResult: UniverseAgentUsageResult = {
		totalInputTokens: 0,
		totalOutputTokens: 0,
		totalTurns: 0,
		agentUsages: [],
		recentRequestSpans: [],
	};

	async getUsage(request: UniverseAgentUsageRequest): Promise<UniverseAgentUsageResult> {
		this.getUsageCalls.push(request);
		return this.getUsageResult;
	}

	readonly listAgentsCalls: UniverseAgentListAgentsRequest[] = [];
	listAgentsResult: UniverseAgentListAgentsResult = { agents: [] };

	async listAgents(request: UniverseAgentListAgentsRequest): Promise<UniverseAgentListAgentsResult> {
		this.listAgentsCalls.push(request);
		return this.listAgentsResult;
	}

	readonly getAgentHistoryCalls: UniverseAgentAgentHistoryRequest[] = [];
	getAgentHistoryResult: UniverseAgentAgentHistoryResult = { entries: [], total: 0 };

	async getAgentHistory(request: UniverseAgentAgentHistoryRequest): Promise<UniverseAgentAgentHistoryResult> {
		this.getAgentHistoryCalls.push(request);
		return this.getAgentHistoryResult;
	}

	readonly pauseAgentCalls: UniverseAgentPauseAgentRequest[] = [];
	pauseAgentResult: UniverseAgentPauseAgentResult = { ok: true };

	async pauseAgent(request: UniverseAgentPauseAgentRequest): Promise<UniverseAgentPauseAgentResult> {
		this.pauseAgentCalls.push(request);
		return this.pauseAgentResult;
	}

	readonly backCalls: UniverseAgentBackRequest[] = [];
	backResult: UniverseAgentBackResult = { ok: true };

	async back(request: UniverseAgentBackRequest): Promise<UniverseAgentBackResult> {
		this.backCalls.push(request);
		return this.backResult;
	}
	readonly pruneCalls: UniverseAgentPruneRequest[] = [];
	pruneResult: UniverseAgentPruneResult = { ok: true, removedCount: 0 };

	async prune(request: UniverseAgentPruneRequest): Promise<UniverseAgentPruneResult> {
		this.pruneCalls.push(request);
		return this.pruneResult;
	}
	readonly resetAgentCalls: UniverseAgentResetAgentRequest[] = [];
	resetAgentResult: UniverseAgentResetAgentResult = { ok: true };

	async resetAgent(request: UniverseAgentResetAgentRequest): Promise<UniverseAgentResetAgentResult> {
		this.resetAgentCalls.push(request);
		return this.resetAgentResult;
	}

	readonly branchCalls: UniverseAgentBranchRequest[] = [];
	branchResult: UniverseAgentBranchResult = { ok: true, currentBranch: 0, totalBranches: 0 };

	async branch(request: UniverseAgentBranchRequest): Promise<UniverseAgentBranchResult> {
		this.branchCalls.push(request);
		return this.branchResult;
	}

	readonly suspendLoopCalls: UniverseAgentSuspendLoopRequest[] = [];
	suspendLoopResult: UniverseAgentSuspendLoopResult = { ok: true };

	async suspendLoop(request: UniverseAgentSuspendLoopRequest): Promise<UniverseAgentSuspendLoopResult> {
		this.suspendLoopCalls.push(request);
		return this.suspendLoopResult;
	}

	readonly resumeLoopCalls: UniverseAgentResumeLoopRequest[] = [];
	resumeLoopResult: UniverseAgentResumeLoopResult = { ok: true };

	async resumeLoop(request: UniverseAgentResumeLoopRequest): Promise<UniverseAgentResumeLoopResult> {
		this.resumeLoopCalls.push(request);
		return this.resumeLoopResult;
	}

	readonly stopLoopCalls: UniverseAgentStopLoopRequest[] = [];
	stopLoopResult: UniverseAgentStopLoopResult = { ok: true };

	async stopLoop(request: UniverseAgentStopLoopRequest): Promise<UniverseAgentStopLoopResult> {
		this.stopLoopCalls.push(request);
		return this.stopLoopResult;
	}

	readonly renameCalls: UniverseAgentRenameSessionRequest[] = [];
	renameResult: UniverseAgentRenameSessionResult = { ok: true };

	async renameSession(request: UniverseAgentRenameSessionRequest): Promise<UniverseAgentRenameSessionResult> {
		this.renameCalls.push(request);
		return this.renameResult;
	}

	readonly cancelCalls: UniverseAgentCancelGenerationRequest[] = [];
	cancelResult: UniverseAgentCancelGenerationResult = { ok: true };

	async cancelGeneration(request: UniverseAgentCancelGenerationRequest): Promise<UniverseAgentCancelGenerationResult> {
		this.cancelCalls.push(request);
		return this.cancelResult;
	}

	readonly cancelToolCallCalls: UniverseAgentCancelToolCallRequest[] = [];
	cancelToolCallResult: UniverseAgentCancelToolCallResult = { ok: true };

	async cancelToolCall(request: UniverseAgentCancelToolCallRequest): Promise<UniverseAgentCancelToolCallResult> {
		this.cancelToolCallCalls.push(request);
		return this.cancelToolCallResult;
	}

	readonly runToolInBackgroundCalls: UniverseAgentRunToolInBackgroundRequest[] = [];
	runToolInBackgroundResult: UniverseAgentRunToolInBackgroundResult = { ok: true };

	async runToolInBackground(request: UniverseAgentRunToolInBackgroundRequest): Promise<UniverseAgentRunToolInBackgroundResult> {
		this.runToolInBackgroundCalls.push(request);
		return this.runToolInBackgroundResult;
	}

	readonly stopShellTaskCalls: UniverseAgentStopShellTaskRequest[] = [];
	stopShellTaskResult: UniverseAgentStopShellTaskResult = { ok: true };

	async stopShellTask(request: UniverseAgentStopShellTaskRequest): Promise<UniverseAgentStopShellTaskResult> {
		this.stopShellTaskCalls.push(request);
		return this.stopShellTaskResult;
	}

	readonly sendShellSessionClientControlCalls: UniverseAgentSendShellSessionClientControlRequest[] = [];
	sendShellSessionClientControlResult: UniverseAgentSendShellSessionClientControlResult = { ok: true };

	async sendShellSessionClientControl(request: UniverseAgentSendShellSessionClientControlRequest): Promise<UniverseAgentSendShellSessionClientControlResult> {
		this.sendShellSessionClientControlCalls.push(request);
		return this.sendShellSessionClientControlResult;
	}

	readonly fetchToolUsageDetailCalls: UniverseAgentFetchToolUsageDetailRequest[] = [];
	fetchToolUsageDetailResult: UniverseAgentFetchToolUsageDetailResult = { ok: true, toolCallId: '', contextSources: [] };

	async fetchToolUsageDetail(request: UniverseAgentFetchToolUsageDetailRequest): Promise<UniverseAgentFetchToolUsageDetailResult> {
		this.fetchToolUsageDetailCalls.push(request);
		return this.fetchToolUsageDetailResult;
	}

	readonly fireTriggerWebhookCalls: UniverseAgentFireTriggerWebhookRequest[] = [];
	fireTriggerWebhookResult: UniverseAgentFireTriggerWebhookResult = { status: '', eventId: '', reason: '' };

	async fireTriggerWebhook(request: UniverseAgentFireTriggerWebhookRequest): Promise<UniverseAgentFireTriggerWebhookResult> {
		this.fireTriggerWebhookCalls.push(request);
		return this.fireTriggerWebhookResult;
	}

	readonly installSessionDemoFakeCalls: UniverseAgentInstallSessionDemoFakeRequest[] = [];
	installSessionDemoFakeResult: UniverseAgentInstallSessionDemoFakeResult = { ok: true, reasonCode: '' };

	async installSessionDemoFake(request: UniverseAgentInstallSessionDemoFakeRequest): Promise<UniverseAgentInstallSessionDemoFakeResult> {
		this.installSessionDemoFakeCalls.push(request);
		return this.installSessionDemoFakeResult;
	}

	readonly clearSessionDemoFakeCalls: UniverseAgentClearSessionDemoFakeRequest[] = [];
	clearSessionDemoFakeResult: UniverseAgentClearSessionDemoFakeResult = { ok: true, reasonCode: '' };

	async clearSessionDemoFake(request: UniverseAgentClearSessionDemoFakeRequest): Promise<UniverseAgentClearSessionDemoFakeResult> {
		this.clearSessionDemoFakeCalls.push(request);
		return this.clearSessionDemoFakeResult;
	}

	readonly switchWorkDirCalls: UniverseAgentSwitchWorkDirRequest[] = [];
	switchWorkDirResult: UniverseAgentSwitchWorkDirResult = { ok: true, previousWorkDir: '', currentWorkDir: '' };

	async switchWorkDir(request: UniverseAgentSwitchWorkDirRequest): Promise<UniverseAgentSwitchWorkDirResult> {
		this.switchWorkDirCalls.push(request);
		return this.switchWorkDirResult;
	}

	readonly testModelProfileCalls: UniverseAgentTestModelProfileRequest[] = [];
	testModelProfileResult: UniverseAgentTestModelProfileResult = { ok: true };

	async testModelProfile(request: UniverseAgentTestModelProfileRequest): Promise<UniverseAgentTestModelProfileResult> {
		this.testModelProfileCalls.push(request);
		return this.testModelProfileResult;
	}

	readonly setConfigCalls: UniverseAgentSetConfigRequest[] = [];
	setConfigResult: UniverseAgentSetConfigResult = { ok: true };

	async setConfig(request: UniverseAgentSetConfigRequest): Promise<UniverseAgentSetConfigResult> {
		this.setConfigCalls.push(request);
		return this.setConfigResult;
	}

	readonly setModelPreferencesCalls: UniverseAgentSetModelPreferencesRequest[] = [];
	setModelPreferencesResult: UniverseAgentSetModelPreferencesResult = { minLevel: 0, maxCost: '', minSpeed: '', strategy: '' };

	async setModelPreferences(request: UniverseAgentSetModelPreferencesRequest): Promise<UniverseAgentSetModelPreferencesResult> {
		this.setModelPreferencesCalls.push(request);
		return this.setModelPreferencesResult;
	}

	readonly setGoalCalls: UniverseAgentSetSessionGoalRequest[] = [];
	setGoalResult: UniverseAgentSetSessionGoalResult = { ok: true };

	async setSessionGoal(request: UniverseAgentSetSessionGoalRequest): Promise<UniverseAgentSetSessionGoalResult> {
		this.setGoalCalls.push(request);
		return this.setGoalResult;
	}

	readonly cancelGoalCalls: UniverseAgentCancelSessionGoalRequest[] = [];
	cancelGoalResult: UniverseAgentCancelSessionGoalResult = { ok: true };

	async cancelSessionGoal(request: UniverseAgentCancelSessionGoalRequest): Promise<UniverseAgentCancelSessionGoalResult> {
		this.cancelGoalCalls.push(request);
		return this.cancelGoalResult;
	}

	readonly respondPermissionCalls: UniverseAgentRespondPermissionRequest[] = [];
	respondPermissionResult: UniverseAgentRespondPermissionResult = { ok: true };

	async respondPermission(request: UniverseAgentRespondPermissionRequest): Promise<UniverseAgentRespondPermissionResult> {
		this.respondPermissionCalls.push(request);
		return this.respondPermissionResult;
	}

	readonly syncPermissionRuleCalls: UniverseAgentSyncPermissionRuleRequest[] = [];
	syncPermissionRuleResult: UniverseAgentSyncPermissionRuleResult = { ok: true, ruleId: '' };

	async syncPermissionRule(request: UniverseAgentSyncPermissionRuleRequest): Promise<UniverseAgentSyncPermissionRuleResult> {
		this.syncPermissionRuleCalls.push(request);
		return this.syncPermissionRuleResult;
	}

	readonly promotePermissionRuleCalls: UniverseAgentPromotePermissionRuleRequest[] = [];
	promotePermissionRuleResult: UniverseAgentPromotePermissionRuleResult = { ok: true };

	async promotePermissionRule(request: UniverseAgentPromotePermissionRuleRequest): Promise<UniverseAgentPromotePermissionRuleResult> {
		this.promotePermissionRuleCalls.push(request);
		return this.promotePermissionRuleResult;
	}

	readonly getSessionRulesCalls: UniverseAgentGetSessionRulesRequest[] = [];
	getSessionRulesResult: UniverseAgentGetSessionRulesResult = { rules: [] };

	async getSessionRules(request: UniverseAgentGetSessionRulesRequest): Promise<UniverseAgentGetSessionRulesResult> {
		this.getSessionRulesCalls.push(request);
		return this.getSessionRulesResult;
	}

	readonly setPermissionModeCalls: UniverseAgentSetPermissionModeRequest[] = [];
	setPermissionModeResult: UniverseAgentSetPermissionModeResult = { ok: true };

	async setPermissionMode(request: UniverseAgentSetPermissionModeRequest): Promise<UniverseAgentSetPermissionModeResult> {
		this.setPermissionModeCalls.push(request);
		return this.setPermissionModeResult;
	}

	readonly taskUpdateCalls: UniverseAgentTaskUpdateRequest[] = [];
	taskUpdateResult: UniverseAgentTaskUpdateResult = { ok: true };

	async taskUpdate(request: UniverseAgentTaskUpdateRequest): Promise<UniverseAgentTaskUpdateResult> {
		this.taskUpdateCalls.push(request);
		return this.taskUpdateResult;
	}

	readonly taskCancelCalls: UniverseAgentTaskCancelRequest[] = [];
	taskCancelResult: UniverseAgentTaskCancelResult = { ok: true };

	async taskCancel(request: UniverseAgentTaskCancelRequest): Promise<UniverseAgentTaskCancelResult> {
		this.taskCancelCalls.push(request);
		return this.taskCancelResult;
	}

	readonly messageMemberCalls: UniverseAgentMessageMemberRequest[] = [];
	messageMemberResult: UniverseAgentMessageMemberResult = { ok: true };

	async messageMember(request: UniverseAgentMessageMemberRequest): Promise<UniverseAgentMessageMemberResult> {
		this.messageMemberCalls.push(request);
		return this.messageMemberResult;
	}

	readonly createTeamCalls: UniverseAgentCreateTeamRequest[] = [];
	createTeamResult: UniverseAgentCreateTeamResult = { teamId: 0, memberCount: 0 };

	async createTeam(request: UniverseAgentCreateTeamRequest): Promise<UniverseAgentCreateTeamResult> {
		this.createTeamCalls.push(request);
		return this.createTeamResult;
	}

	readonly startMemberCalls: UniverseAgentStartMemberRequest[] = [];
	startMemberResult: UniverseAgentStartMemberResult = { memberAgentId: '', memberName: '', dynamic: false };

	async startMember(request: UniverseAgentStartMemberRequest): Promise<UniverseAgentStartMemberResult> {
		this.startMemberCalls.push(request);
		return this.startMemberResult;
	}

	readonly killMemberCalls: UniverseAgentKillMemberRequest[] = [];
	killMemberResult: UniverseAgentKillMemberResult = { ok: true };

	async killMember(request: UniverseAgentKillMemberRequest): Promise<UniverseAgentKillMemberResult> {
		this.killMemberCalls.push(request);
		return this.killMemberResult;
	}

	readonly abortCalls: UniverseAgentAbortTeamRequest[] = [];
	abortResult: UniverseAgentAbortTeamResult = { ok: true, stoppedMembers: [] };

	async abort(request: UniverseAgentAbortTeamRequest): Promise<UniverseAgentAbortTeamResult> {
		this.abortCalls.push(request);
		return this.abortResult;
	}

	readonly switchModelCalls: UniverseAgentSwitchModelRequest[] = [];
	switchModelResult: UniverseAgentSwitchModelResult = {
		resolvedModelId: '',
		provider: '',
		level: 0,
		cost: '',
		speed: '',
	};

	async switchModel(request: UniverseAgentSwitchModelRequest): Promise<UniverseAgentSwitchModelResult> {
		this.switchModelCalls.push(request);
		return this.switchModelResult;
	}

	readonly resolveModelCalls: UniverseAgentResolveModelRequest[] = [];
	resolveModelResult: UniverseAgentResolveModelResult = { candidates: [], filtered: [] };

	async resolveModel(request: UniverseAgentResolveModelRequest): Promise<UniverseAgentResolveModelResult> {
		this.resolveModelCalls.push(request);
		return this.resolveModelResult;
	}

	readonly setPermissionPolicyCalls: UniverseAgentSetPermissionPolicyRequest[] = [];
	setPermissionPolicyResult: UniverseAgentSetPermissionPolicyResult = { ok: true };

	async setPermissionPolicy(request: UniverseAgentSetPermissionPolicyRequest): Promise<UniverseAgentSetPermissionPolicyResult> {
		this.setPermissionPolicyCalls.push(request);
		return this.setPermissionPolicyResult;
	}

	readonly respondQuestionCalls: UniverseAgentRespondQuestionRequest[] = [];
	respondQuestionResult: UniverseAgentRespondQuestionResult = { ok: true };

	async respondQuestion(request: UniverseAgentRespondQuestionRequest): Promise<UniverseAgentRespondQuestionResult> {
		this.respondQuestionCalls.push(request);
		return this.respondQuestionResult;
	}

	readonly enqueueCalls: UniverseAgentEnqueueQueueItemRequest[] = [];
	readonly insertCalls: UniverseAgentInsertQueueItemRequest[] = [];
	readonly reorderCalls: UniverseAgentReorderQueueRequest[] = [];
	readonly deleteCalls: UniverseAgentDeleteQueueItemRequest[] = [];
	readonly retryCalls: UniverseAgentRetryQueueItemRequest[] = [];
	readonly retryAllFailedCalls: UniverseAgentRetryAllFailedRequest[] = [];
	readonly retryQueueItemUploadCalls: UniverseAgentRetryQueueItemUploadRequest[] = [];
	readonly pinCalls: UniverseAgentPinQueueItemRequest[] = [];
	readonly setQueueItemLockedCalls: UniverseAgentSetQueueItemLockedRequest[] = [];
	readonly injectCalls: UniverseAgentInjectQueueItemRequest[] = [];
	readonly setQueueItemForkAnchorCalls: UniverseAgentSetQueueItemForkAnchorRequest[] = [];
	readonly pauseCalls: UniverseAgentQueueRefRequest[] = [];
	readonly resumeCalls: UniverseAgentQueueRefRequest[] = [];
	readonly clearCalls: UniverseAgentQueueRefRequest[] = [];
	readonly holdCalls: UniverseAgentHoldQueueItemRequest[] = [];
	readonly releaseHoldCalls: UniverseAgentQueueItemRefRequest[] = [];
	readonly editCalls: UniverseAgentEditQueueItemRequest[] = [];
	queueResult: UniverseAgentQueueMutationResult = { ok: true };

	async enqueueQueueItem(request: UniverseAgentEnqueueQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		this.enqueueCalls.push(request);
		return this.queueResult;
	}

	async insertQueueItem(request: UniverseAgentInsertQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		this.insertCalls.push(request);
		return this.queueResult;
	}

	async reorderQueue(request: UniverseAgentReorderQueueRequest): Promise<UniverseAgentQueueMutationResult> {
		this.reorderCalls.push(request);
		return this.queueResult;
	}

	async deleteQueueItem(request: UniverseAgentDeleteQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		this.deleteCalls.push(request);
		return this.queueResult;
	}

	async retryQueueItem(request: UniverseAgentRetryQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		this.retryCalls.push(request);
		return this.queueResult;
	}

	async retryAllFailed(request: UniverseAgentRetryAllFailedRequest): Promise<UniverseAgentQueueMutationResult> {
		this.retryAllFailedCalls.push(request);
		return this.queueResult;
	}

	async retryQueueItemUpload(request: UniverseAgentRetryQueueItemUploadRequest): Promise<UniverseAgentQueueMutationResult> {
		this.retryQueueItemUploadCalls.push(request);
		return this.queueResult;
	}

	async pinQueueItem(request: UniverseAgentPinQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		this.pinCalls.push(request);
		return this.queueResult;
	}

	async setQueueItemLocked(request: UniverseAgentSetQueueItemLockedRequest): Promise<UniverseAgentQueueMutationResult> {
		this.setQueueItemLockedCalls.push(request);
		return this.queueResult;
	}

	async injectQueueItem(request: UniverseAgentInjectQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		this.injectCalls.push(request);
		return this.queueResult;
	}

	async setQueueItemForkAnchor(request: UniverseAgentSetQueueItemForkAnchorRequest): Promise<UniverseAgentQueueMutationResult> {
		this.setQueueItemForkAnchorCalls.push(request);
		return this.queueResult;
	}

	async pauseQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		this.pauseCalls.push(request);
		return this.queueResult;
	}

	async resumeQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		this.resumeCalls.push(request);
		return this.queueResult;
	}

	async clearQueue(request: UniverseAgentQueueRefRequest): Promise<UniverseAgentQueueMutationResult> {
		this.clearCalls.push(request);
		return this.queueResult;
	}

	async holdQueueItem(request: UniverseAgentHoldQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		this.holdCalls.push(request);
		return this.queueResult;
	}

	async releaseQueueItemHold(request: UniverseAgentQueueItemRefRequest): Promise<UniverseAgentQueueMutationResult> {
		this.releaseHoldCalls.push(request);
		return this.queueResult;
	}

	async editQueueItem(request: UniverseAgentEditQueueItemRequest): Promise<UniverseAgentQueueMutationResult> {
		this.editCalls.push(request);
		return this.queueResult;
	}

	readonly forkCalls: UniverseAgentForkAgentRequest[] = [];
	forkResult: UniverseAgentForkAgentResult = { ok: true, agentId: 'sub:reviewer' };

	async forkAgent(request: UniverseAgentForkAgentRequest): Promise<UniverseAgentForkAgentResult> {
		this.forkCalls.push(request);
		return this.forkResult;
	}

	readonly killCalls: UniverseAgentKillAgentRequest[] = [];
	killResult: UniverseAgentKillAgentResult = { ok: true };

	async killAgent(request: UniverseAgentKillAgentRequest): Promise<UniverseAgentKillAgentResult> {
		this.killCalls.push(request);
		return this.killResult;
	}

	readonly deleteMessageCalls: UniverseAgentDeleteMessageRequest[] = [];
	deleteMessageResult: UniverseAgentDeleteMessageResult = { ok: true };

	async deleteMessage(request: UniverseAgentDeleteMessageRequest): Promise<UniverseAgentDeleteMessageResult> {
		this.deleteMessageCalls.push(request);
		return this.deleteMessageResult;
	}

	readonly editMessageCalls: UniverseAgentEditMessageRequest[] = [];
	editMessageResult: UniverseAgentEditMessageResult = { ok: true };

	async editMessage(request: UniverseAgentEditMessageRequest): Promise<UniverseAgentEditMessageResult> {
		this.editMessageCalls.push(request);
		return this.editMessageResult;
	}

	readonly sendClientToolResponseCalls: UniverseAgentSendClientToolResponseRequest[] = [];
	sendClientToolResponseResult: UniverseAgentSendClientToolResponseResult = { ok: true };

	async sendClientToolResponse(request: UniverseAgentSendClientToolResponseRequest): Promise<UniverseAgentSendClientToolResponseResult> {
		this.sendClientToolResponseCalls.push(request);
		return this.sendClientToolResponseResult;
	}

	readonly listSnapshotsCalls: UniverseAgentListSnapshotsRequest[] = [];
	listSnapshotsResult: UniverseAgentListSnapshotsResult = { snapshots: [] };

	async listSnapshots(request: UniverseAgentListSnapshotsRequest): Promise<UniverseAgentListSnapshotsResult> {
		this.listSnapshotsCalls.push(request);
		return this.listSnapshotsResult;
	}

	readonly listLoopSnapshotsCalls: UniverseAgentListLoopSnapshotsRequest[] = [];
	listLoopSnapshotsResult: UniverseAgentListLoopSnapshotsResult = { snapshots: [] };

	async listLoopSnapshots(request: UniverseAgentListLoopSnapshotsRequest): Promise<UniverseAgentListLoopSnapshotsResult> {
		this.listLoopSnapshotsCalls.push(request);
		return this.listLoopSnapshotsResult;
	}

	readonly createSnapshotCalls: UniverseAgentCreateSnapshotRequest[] = [];
	createSnapshotResult: UniverseAgentCreateSnapshotResult = { ok: true };

	async createSnapshot(request: UniverseAgentCreateSnapshotRequest): Promise<UniverseAgentCreateSnapshotResult> {
		this.createSnapshotCalls.push(request);
		return this.createSnapshotResult;
	}

	readonly restoreSnapshotCalls: UniverseAgentRestoreSnapshotRequest[] = [];
	restoreSnapshotResult: UniverseAgentRestoreSnapshotResult = { ok: true };

	async restoreSnapshot(request: UniverseAgentRestoreSnapshotRequest): Promise<UniverseAgentRestoreSnapshotResult> {
		this.restoreSnapshotCalls.push(request);
		return this.restoreSnapshotResult;
	}

	readonly deleteSnapshotCalls: UniverseAgentDeleteSnapshotRequest[] = [];
	deleteSnapshotResult: UniverseAgentDeleteSnapshotResult = { ok: true };

	async deleteSnapshot(request: UniverseAgentDeleteSnapshotRequest): Promise<UniverseAgentDeleteSnapshotResult> {
		this.deleteSnapshotCalls.push(request);
		return this.deleteSnapshotResult;
	}

	async getHistory(_request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		return { envelopes: [] };
	}

	private _sessionStreamGate: ReturnType<typeof createStreamCloseGate> | undefined;

	subscribeSessionEventStream(
		_sessionId: string,
		_listener: (event: UniverseAgentSessionEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		const gate = createStreamCloseGate(onClosed);
		this._sessionStreamGate = gate;
		return {
			dispose: () => {
				gate.closeLocal();
				if (this._sessionStreamGate === gate) {
					this._sessionStreamGate = undefined;
				}
			},
		};
	}

	fireSessionStreamClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._sessionStreamGate?.finish(cause);
	}

	async chat(_request: UniverseAgentChatRequest, _onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
	}

	readonly chatSyncCalls: UniverseAgentChatSyncRequest[] = [];
	chatSyncResult: UniverseAgentChatSyncResult = {
		sessionId: '',
		agentId: '',
		text: '',
		stopReason: '',
		inputTokens: 0,
		outputTokens: 0,
		turnCount: 0,
		toolResults: [],
		error: '',
		inputDeliveryEvents: [],
	};

	async chatSync(request: UniverseAgentChatSyncRequest): Promise<UniverseAgentChatSyncResult> {
		this.chatSyncCalls.push(request);
		return this.chatSyncResult;
	}

	readonly syncInputDeliveryCalls: UniverseAgentSyncInputDeliveryRequest[] = [];
	syncInputDeliveryResult: UniverseAgentSyncInputDeliveryResult = {
		inputDeliveryEvents: [],
	};

	async syncInputDelivery(request: UniverseAgentSyncInputDeliveryRequest): Promise<UniverseAgentSyncInputDeliveryResult> {
		this.syncInputDeliveryCalls.push(request);
		return this.syncInputDeliveryResult;
	}

	private _chatGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly chatOpens: string[] = [];

	openChatStream(
		sessionId: string,
		_onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentChatStream {
		this.chatOpens.push(sessionId);
		const gate = createStreamCloseGate(onClosed);
		this._chatGate = gate;
		return {
			write() { },
			dispose: () => {
				gate.closeLocal();
				if (this._chatGate === gate) {
					this._chatGate = undefined;
				}
			},
		};
	}

	fireChatClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._chatGate?.finish(cause);
	}

	private _continuationGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly continuationOpens: UniverseAgentContinueGenerationRequest[] = [];

	openContinuationStream(
		request: UniverseAgentContinueGenerationRequest,
		_onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this.continuationOpens.push(request);
		const gate = createStreamCloseGate(onClosed);
		this._continuationGate = gate;
		return {
			dispose: () => {
				gate.closeLocal();
				if (this._continuationGate === gate) {
					this._continuationGate = undefined;
				}
			},
		};
	}

	fireContinuationClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._continuationGate?.finish(cause);
	}

	private _regenerateGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly regenerateOpens: UniverseAgentRegenerateRequest[] = [];

	openRegenerateStream(
		request: UniverseAgentRegenerateRequest,
		_onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this.regenerateOpens.push(request);
		const gate = createStreamCloseGate(onClosed);
		this._regenerateGate = gate;
		return {
			dispose: () => {
				gate.closeLocal();
				if (this._regenerateGate === gate) {
					this._regenerateGate = undefined;
				}
			},
		};
	}

	fireRegenerateClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._regenerateGate?.finish(cause);
	}

	private _resumeGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly resumeOpens: UniverseAgentResumeRequest[] = [];

	openResumeStream(
		request: UniverseAgentResumeRequest,
		_onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this.resumeOpens.push(request);
		const gate = createStreamCloseGate(onClosed);
		this._resumeGate = gate;
		return {
			dispose: () => {
				gate.closeLocal();
				if (this._resumeGate === gate) {
					this._resumeGate = undefined;
				}
			},
		};
	}

	fireResumeClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._resumeGate?.finish(cause);
	}

	private _subscribeToolDetailGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly subscribeToolDetailOpens: UniverseAgentSubscribeToolDetailRequest[] = [];

	openSubscribeToolDetailStream(
		request: UniverseAgentSubscribeToolDetailRequest,
		_onResponse: (response: UniverseAgentSubscribeToolDetailChunk) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this.subscribeToolDetailOpens.push(request);
		const gate = createStreamCloseGate(onClosed);
		this._subscribeToolDetailGate = gate;
		return {
			dispose: () => {
				gate.closeLocal();
				if (this._subscribeToolDetailGate === gate) {
					this._subscribeToolDetailGate = undefined;
				}
			},
		};
	}

	fireSubscribeToolDetailClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._subscribeToolDetailGate?.finish(cause);
	}

	private _watchConfigGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly watchConfigOpens: UniverseAgentWatchConfigRequest[] = [];

	openWatchConfigStream(
		request: UniverseAgentWatchConfigRequest,
		_onResponse: (response: UniverseAgentConfigChangedEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this.watchConfigOpens.push(request);
		const gate = createStreamCloseGate(onClosed);
		this._watchConfigGate = gate;
		return {
			dispose: () => {
				gate.closeLocal();
				if (this._watchConfigGate === gate) {
					this._watchConfigGate = undefined;
				}
			},
		};
	}

	fireWatchConfigClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._watchConfigGate?.finish(cause);
	}

	private _uploadAttachmentGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly uploadAttachmentWrites: UniverseAgentUploadChunk[] = [];
	uploadAttachmentOpenCount = 0;

	openUploadAttachmentStream(
		_onResponse: (response: UniverseAgentUploadAttachmentResult) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { write(chunk: UniverseAgentUploadChunk): void; end(): void; dispose(): void } {
		this.uploadAttachmentOpenCount++;
		const gate = createStreamCloseGate(onClosed);
		this._uploadAttachmentGate = gate;
		return {
			write: (chunk: UniverseAgentUploadChunk) => {
				this.uploadAttachmentWrites.push(chunk);
			},
			end: () => { },
			dispose: () => {
				gate.closeLocal();
				if (this._uploadAttachmentGate === gate) {
					this._uploadAttachmentGate = undefined;
				}
			},
		};
	}

	fireUploadAttachmentClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._uploadAttachmentGate?.finish(cause);
	}

	async listSkills() {
		return { skills: [] };
	}

	async setSkillEnabled() {
		return { ok: true };
	}

	async getSkillInfo() {
		return { name: '', content: '', source: 'unknown' as const, enabled: false };
	}

	async saveSkillContent(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult> {
		if (this.handlers.saveSkillContent) {
			return this.handlers.saveSkillContent(request);
		}
		return { ok: true };
	}

	async listAgentProfiles() {
		return { profiles: [] };
	}

	async saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest) {
		return { profile: request.profile };
	}

	async deleteAgentProfile() {
		return { ok: true };
	}

	async resetAgentProfile() {
		return { ok: true };
	}

	async listMcpServers() {
		return { servers: [] };
	}

	async getMcpServerStatuses() {
		return { statuses: [] };
	}

	async getMcpServerTools() {
		return { tools: [] };
	}

	async listPlugins() {
		return { plugins: [] };
	}

	async getPluginInfo() {
		return { summary: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const }, hooks: [] };
	}

	async enablePlugin() {
		return { plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } };
	}

	async reloadPlugin() {
		return { plugin: { id: '', displayName: '', version: '', source: '', hookCount: 0, status: 'unknown' as const } };
	}

	async unloadPlugin() {
		return { removedHookCount: 0 };
	}

	async scanNewPlugins() {
		return { newPlugins: [], skippedCount: 0 };
	}

	async toggleMcpServer() {
		return { ok: true };
	}

	async addMcpServer() {
		return { ok: true };
	}

	async updateMcpServer() {
		return { ok: true };
	}

	async removeMcpServer() {
		return { ok: true };
	}

	async listTools() {
		return { tools: [] };
	}

	readonly toolInfoCalls: UniverseAgentToolInfoRequest[] = [];
	toolInfoResult: UniverseAgentToolInfoResult = {
		name: 'bash',
		description: 'Run a command',
		category: 'shell',
		inputSchemaJson: '{"type":"object"}',
		destructive: true,
		requiresPermission: true,
		aliases: ['sh'],
	};

	async getToolInfo(request: UniverseAgentToolInfoRequest): Promise<UniverseAgentToolInfoResult> {
		this.toolInfoCalls.push(request);
		return this.toolInfoResult;
	}

	listCommandsCalls = 0;
	listCommandsResult: UniverseAgentListCommandsResult = { commands: [], total: 0 };

	async listCommands(): Promise<UniverseAgentListCommandsResult> {
		this.listCommandsCalls += 1;
		return this.listCommandsResult;
	}

	readonly getCommandDefCalls: UniverseAgentGetCommandDefRequest[] = [];
	getCommandDefResult: UniverseAgentGetCommandDefResult = {
		name: '',
		source: '',
		template: '',
		agent: '',
		model: '',
		subtask: false,
		mcpServerId: '',
		mcpPromptName: '',
		mcpArgumentNames: [],
		skillSource: '',
	};

	async getCommandDef(request: UniverseAgentGetCommandDefRequest): Promise<UniverseAgentGetCommandDefResult> {
		this.getCommandDefCalls.push(request);
		return this.getCommandDefResult;
	}

	readonly listFilesCalls: UniverseAgentListFilesRequest[] = [];
	listFilesResult: UniverseAgentListFilesResult = { entries: [], total: 0 };

	async listFiles(request: UniverseAgentListFilesRequest): Promise<UniverseAgentListFilesResult> {
		this.listFilesCalls.push(request);
		return this.listFilesResult;
	}

	readonly readFileCalls: UniverseAgentReadFileRequest[] = [];
	readFileResult: UniverseAgentReadFileResult = {
		content: new Uint8Array(0),
		totalSize: 0,
		mimeType: '',
		lineCount: 0,
		contentHash: '',
	};

	async readFile(request: UniverseAgentReadFileRequest): Promise<UniverseAgentReadFileResult> {
		this.readFileCalls.push(request);
		return this.readFileResult;
	}

	readonly getFileInfoCalls: UniverseAgentGetFileInfoRequest[] = [];
	getFileInfoResult: UniverseAgentGetFileInfoResult = {
		file: {
			name: '',
			path: '',
			isDirectory: false,
			size: 0,
			lastModified: 0,
			mimeType: '',
		},
	};

	async getFileInfo(request: UniverseAgentGetFileInfoRequest): Promise<UniverseAgentGetFileInfoResult> {
		this.getFileInfoCalls.push(request);
		return this.getFileInfoResult;
	}

	readonly writeFileCalls: UniverseAgentWriteFileRequest[] = [];
	writeFileResult: UniverseAgentWriteFileResult = {
		status: 'SAVED',
		newHash: '',
		size: 0,
		modifiedAt: 0,
		currentContent: new Uint8Array(0),
		currentHash: '',
		mergedContent: new Uint8Array(0),
	};

	async writeFile(request: UniverseAgentWriteFileRequest): Promise<UniverseAgentWriteFileResult> {
		this.writeFileCalls.push(request);
		return this.writeFileResult;
	}

	readonly forceWriteFileCalls: UniverseAgentForceWriteFileRequest[] = [];
	forceWriteFileResult: UniverseAgentWriteFileResult = {
		status: 'SAVED',
		newHash: '',
		size: 0,
		modifiedAt: 0,
		currentContent: new Uint8Array(0),
		currentHash: '',
		mergedContent: new Uint8Array(0),
	};

	async forceWriteFile(request: UniverseAgentForceWriteFileRequest): Promise<UniverseAgentWriteFileResult> {
		this.forceWriteFileCalls.push(request);
		return this.forceWriteFileResult;
	}

	readonly agentMergeCalls: UniverseAgentAgentMergeRequest[] = [];
	agentMergeResult: UniverseAgentAgentMergeResult = {
		accepted: false,
	};

	async agentMerge(request: UniverseAgentAgentMergeRequest): Promise<UniverseAgentAgentMergeResult> {
		this.agentMergeCalls.push(request);
		return this.agentMergeResult;
	}

	readonly readGitSummaryCalls: UniverseAgentReadGitSummaryRequest[] = [];
	readGitSummaryResult: UniverseAgentReadGitSummaryResult = {
		supported: false,
		reason: '',
		branch: '',
		changeCount: 0,
	};

	async readGitSummary(request: UniverseAgentReadGitSummaryRequest): Promise<UniverseAgentReadGitSummaryResult> {
		this.readGitSummaryCalls.push(request);
		return this.readGitSummaryResult;
	}

	readonly readGitChangesCalls: UniverseAgentReadGitChangesRequest[] = [];
	readGitChangesResult: UniverseAgentReadGitChangesResult = {
		supported: false,
		reason: '',
		branch: '',
		entries: [],
	};

	async readGitChanges(request: UniverseAgentReadGitChangesRequest): Promise<UniverseAgentReadGitChangesResult> {
		this.readGitChangesCalls.push(request);
		return this.readGitChangesResult;
	}

	readonly readGitFileDiffCalls: UniverseAgentReadGitFileDiffRequest[] = [];
	readGitFileDiffResult: UniverseAgentReadGitFileDiffResult = {
		supported: false,
		reason: '',
		path: '',
		unifiedDiff: '',
	};

	async readGitFileDiff(request: UniverseAgentReadGitFileDiffRequest): Promise<UniverseAgentReadGitFileDiffResult> {
		this.readGitFileDiffCalls.push(request);
		return this.readGitFileDiffResult;
	}

	readonly writeGitStagePathsCalls: UniverseAgentWriteGitStagePathsRequest[] = [];
	writeGitStagePathsResult: UniverseAgentWriteGitWriteResult = {
		supported: false,
		reason: '',
		success: false,
		errorMessage: '',
		exitCode: 0,
		stdout: '',
	};

	async writeGitStagePaths(request: UniverseAgentWriteGitStagePathsRequest): Promise<UniverseAgentWriteGitWriteResult> {
		this.writeGitStagePathsCalls.push(request);
		return this.writeGitStagePathsResult;
	}

	readonly writeGitCommitCalls: UniverseAgentWriteGitCommitRequest[] = [];
	writeGitCommitResult: UniverseAgentWriteGitWriteResult = {
		supported: false,
		reason: '',
		success: false,
		errorMessage: '',
		exitCode: 0,
		stdout: '',
	};

	async writeGitCommit(request: UniverseAgentWriteGitCommitRequest): Promise<UniverseAgentWriteGitWriteResult> {
		this.writeGitCommitCalls.push(request);
		return this.writeGitCommitResult;
	}

	readonly writeGitApplyHunksCalls: UniverseAgentWriteGitApplyHunksRequest[] = [];
	writeGitApplyHunksResult: UniverseAgentWriteGitWriteResult = {
		supported: false,
		reason: '',
		success: false,
		errorMessage: '',
		exitCode: 0,
		stdout: '',
	};

	async writeGitApplyHunks(request: UniverseAgentWriteGitApplyHunksRequest): Promise<UniverseAgentWriteGitWriteResult> {
		this.writeGitApplyHunksCalls.push(request);
		return this.writeGitApplyHunksResult;
	}

	readonly getSessionUsageCalls: UniverseAgentGetSessionUsageRequest[] = [];
	getSessionUsageResult: UniverseAgentGetSessionUsageResult = {
		usage: {
			inputTokens: 0,
			outputTokens: 0,
			thinkingTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			totalCostMicros: 0,
			currency: '',
			requestCount: 0,
		},
	};

	getGlobalUsageCalls = 0;
	getGlobalUsageResult: UniverseAgentGetGlobalUsageResult = {
		usage: {
			inputTokens: 0,
			outputTokens: 0,
			thinkingTokens: 0,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			totalCostMicros: 0,
			currency: '',
			requestCount: 0,
		},
	};

	async getSessionUsage(request: UniverseAgentGetSessionUsageRequest): Promise<UniverseAgentGetSessionUsageResult> {
		this.getSessionUsageCalls.push(request);
		return this.getSessionUsageResult;
	}

	async getGlobalUsage(): Promise<UniverseAgentGetGlobalUsageResult> {
		this.getGlobalUsageCalls++;
		return this.getGlobalUsageResult;
	}

	readonly saveMemoryCalls: UniverseAgentSaveMemoryRequest[] = [];
	saveMemoryResult: UniverseAgentSaveMemoryResult = {
		success: false,
		message: '',
		filePath: '',
	};

	async saveMemory(request: UniverseAgentSaveMemoryRequest): Promise<UniverseAgentSaveMemoryResult> {
		this.saveMemoryCalls.push(request);
		return this.saveMemoryResult;
	}

	readonly searchMemoryCalls: UniverseAgentMemorySearchRequest[] = [];
	searchMemoryResult: UniverseAgentMemorySearchResult = {
		results: [],
	};

	async searchMemory(request: UniverseAgentMemorySearchRequest): Promise<UniverseAgentMemorySearchResult> {
		this.searchMemoryCalls.push(request);
		return this.searchMemoryResult;
	}

	readonly searchDeepMemoryCalls: UniverseAgentMemorySearchDeepRequest[] = [];
	searchDeepMemoryResult: UniverseAgentMemorySearchDeepResult = {
		results: [],
		searchedCategories: [],
	};

	async searchDeepMemory(request: UniverseAgentMemorySearchDeepRequest): Promise<UniverseAgentMemorySearchDeepResult> {
		this.searchDeepMemoryCalls.push(request);
		return this.searchDeepMemoryResult;
	}

	readonly readMemoryCalls: UniverseAgentReadMemoryRequest[] = [];
	readMemoryResult: UniverseAgentReadMemoryResult = {
		content: '',
		metadata: {
			category: '',
			filename: '',
			title: '',
			tags: [],
			createdAt: 0,
			updatedAt: 0,
			version: 0,
		},
	};

	async readMemory(request: UniverseAgentReadMemoryRequest): Promise<UniverseAgentReadMemoryResult> {
		this.readMemoryCalls.push(request);
		return this.readMemoryResult;
	}

	readonly listMemoryCalls: UniverseAgentMemoryListRequest[] = [];
	listMemoryResult: UniverseAgentMemoryListResult = {
		categories: [],
	};

	async listMemory(request: UniverseAgentMemoryListRequest): Promise<UniverseAgentMemoryListResult> {
		this.listMemoryCalls.push(request);
		return this.listMemoryResult;
	}

	readonly deleteMemoryCalls: UniverseAgentDeleteMemoryRequest[] = [];
	deleteMemoryResult: UniverseAgentDeleteMemoryResult = {
		success: false,
		message: '',
	};

	async deleteMemory(request: UniverseAgentDeleteMemoryRequest): Promise<UniverseAgentDeleteMemoryResult> {
		this.deleteMemoryCalls.push(request);
		return this.deleteMemoryResult;
	}

	readonly reflectMemoryCalls: UniverseAgentReflectMemoryRequest[] = [];
	reflectMemoryResult: UniverseAgentReflectMemoryResult = {
		diagnoses: [],
		summary: '',
	};

	async reflectMemory(request: UniverseAgentReflectMemoryRequest): Promise<UniverseAgentReflectMemoryResult> {
		this.reflectMemoryCalls.push(request);
		return this.reflectMemoryResult;
	}

	private _rebuildMemoryGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly rebuildMemoryOpens: UniverseAgentMemoryRebuildRequest[] = [];

	openRebuildMemoryStream(
		request: UniverseAgentMemoryRebuildRequest,
		_onResponse: (response: UniverseAgentMemoryRebuildEvent) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this.rebuildMemoryOpens.push(request);
		const gate = createStreamCloseGate(onClosed);
		this._rebuildMemoryGate = gate;
		return {
			dispose: () => {
				gate.closeLocal();
				if (this._rebuildMemoryGate === gate) {
					this._rebuildMemoryGate = undefined;
				}
			},
		};
	}

	fireRebuildMemoryClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._rebuildMemoryGate?.finish(cause);
	}

	readonly revertMemoryCalls: UniverseAgentRevertMemoryRequest[] = [];
	revertMemoryResult: UniverseAgentRevertMemoryResult = {
		success: false,
		message: '',
		revertedToVersion: 0,
	};

	async revertMemory(request: UniverseAgentRevertMemoryRequest): Promise<UniverseAgentRevertMemoryResult> {
		this.revertMemoryCalls.push(request);
		return this.revertMemoryResult;
	}

	readonly historyMemoryCalls: UniverseAgentMemoryHistoryRequest[] = [];
	historyMemoryResult: UniverseAgentMemoryHistoryResult = {
		changes: [],
	};

	async historyMemory(request: UniverseAgentMemoryHistoryRequest): Promise<UniverseAgentMemoryHistoryResult> {
		this.historyMemoryCalls.push(request);
		return this.historyMemoryResult;
	}

	readonly listContextVariableCalls: UniverseAgentContextVariableListRequest[] = [];
	listContextVariableResult: UniverseAgentContextVariableListResult = {
		current: [],
		inherited: [],
	};

	async listContextVariable(request: UniverseAgentContextVariableListRequest): Promise<UniverseAgentContextVariableListResult> {
		this.listContextVariableCalls.push(request);
		return this.listContextVariableResult;
	}

	readonly readContextVariableCalls: UniverseAgentContextVariableReadRequest[] = [];
	readContextVariableResult: UniverseAgentContextVariableReadResult = {
		entry: {
			name: '',
			content: '',
			scope: 'VARIABLE_GLOBAL',
			updatedBy: '',
			updatedAt: 0,
		},
	};

	async readContextVariable(request: UniverseAgentContextVariableReadRequest): Promise<UniverseAgentContextVariableReadResult> {
		this.readContextVariableCalls.push(request);
		return this.readContextVariableResult;
	}

	readonly getUploadProgressCalls: UniverseAgentGetUploadProgressRequest[] = [];
	getUploadProgressResult: UniverseAgentGetUploadProgressResult = {
		exists: false,
		bytesReceived: 0,
		partialPath: '',
	};

	async getUploadProgress(request: UniverseAgentGetUploadProgressRequest): Promise<UniverseAgentGetUploadProgressResult> {
		this.getUploadProgressCalls.push(request);
		return this.getUploadProgressResult;
	}

	readonly shutdownCalls: UniverseAgentShutdownRequest[] = [];
	shutdownResult: UniverseAgentShutdownResult = {
		accepted: false,
		message: '',
	};

	async shutdown(request: UniverseAgentShutdownRequest): Promise<UniverseAgentShutdownResult> {
		this.shutdownCalls.push(request);
		return this.shutdownResult;
	}

	readonly writeClipboardCalls: UniverseAgentWriteClipboardRequest[] = [];
	writeClipboardResult: UniverseAgentWriteClipboardResult = {
		clipId: '',
	};

	async writeClipboard(request: UniverseAgentWriteClipboardRequest): Promise<UniverseAgentWriteClipboardResult> {
		this.writeClipboardCalls.push(request);
		return this.writeClipboardResult;
	}

	readonly readClipboardCalls: UniverseAgentReadClipboardRequest[] = [];
	readClipboardResult: UniverseAgentReadClipboardResult = {
		entry: {
			clipId: '',
			label: '',
			type: 'CLIPBOARD_TEXT',
			content: '',
			createdBy: '',
			createdAt: 0,
		},
	};

	async readClipboard(request: UniverseAgentReadClipboardRequest): Promise<UniverseAgentReadClipboardResult> {
		this.readClipboardCalls.push(request);
		return this.readClipboardResult;
	}

	private _downloadAttachmentGate: ReturnType<typeof createStreamCloseGate> | undefined;
	readonly downloadAttachmentOpens: UniverseAgentDownloadAttachmentRequest[] = [];

	openDownloadAttachmentStream(
		request: UniverseAgentDownloadAttachmentRequest,
		_onResponse: (response: UniverseAgentDownloadChunk) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): { dispose(): void } {
		this.downloadAttachmentOpens.push(request);
		const gate = createStreamCloseGate(onClosed);
		this._downloadAttachmentGate = gate;
		return {
			dispose: () => {
				gate.closeLocal();
				if (this._downloadAttachmentGate === gate) {
					this._downloadAttachmentGate = undefined;
				}
			},
		};
	}

	fireDownloadAttachmentClosed(cause: UniverseAgentSessionStreamCloseCause): void {
		this._downloadAttachmentGate?.finish(cause);
	}
	healthCheckCalls = 0;
	healthCheckResult: UniverseAgentHealthCheckResult = {
		status: '',
		version: '',
		activeSessions: 0,
		uptimeMs: 0,
	};

	async healthCheck(): Promise<UniverseAgentHealthCheckResult> {
		this.healthCheckCalls++;
		return this.healthCheckResult;
	}

	doctorCalls = 0;
	doctorResult: UniverseAgentDoctorResult = {
		checks: [],
		allPassed: false,
	};

	async doctor(): Promise<UniverseAgentDoctorResult> {
		this.doctorCalls++;
		return this.doctorResult;
	}

	listDevicesCalls = 0;
	listDevicesResult: UniverseAgentListDevicesResult = {
		devices: [],
	};

	async listDevices(): Promise<UniverseAgentListDevicesResult> {
		this.listDevicesCalls++;
		return this.listDevicesResult;
	}

	readonly pairApproveCalls: UniverseAgentPairApproveRequest[] = [];
	pairApproveResult: UniverseAgentPairApproveResult = {
		success: false,
		deviceId: '',
		message: '',
	};

	async pairApprove(request: UniverseAgentPairApproveRequest): Promise<UniverseAgentPairApproveResult> {
		this.pairApproveCalls.push(request);
		return this.pairApproveResult;
	}

	readonly pairRejectCalls: UniverseAgentPairRejectRequest[] = [];
	pairRejectResult: UniverseAgentPairRejectResult = {
		success: false,
		message: '',
	};

	async pairReject(request: UniverseAgentPairRejectRequest): Promise<UniverseAgentPairRejectResult> {
		this.pairRejectCalls.push(request);
		return this.pairRejectResult;
	}

	readonly listTriggersCalls: UniverseAgentListTriggersRequest[] = [];
	listTriggersResult: UniverseAgentListTriggersResult = {
		triggers: [],
	};

	async listTriggers(request: UniverseAgentListTriggersRequest): Promise<UniverseAgentListTriggersResult> {
		this.listTriggersCalls.push(request);
		return this.listTriggersResult;
	}

	readonly upsertTriggerCalls: UniverseAgentUpsertTriggerRequest[] = [];
	upsertTriggerResult: UniverseAgentUpsertTriggerResult = {
		trigger: {
			triggerId: '',
			name: '',
			type: '',
			promptTemplate: '',
			enabled: false,
			pauseReason: '',
			target: { kind: 'unspecified' },
			intervalMs: 0,
			cronExpression: '',
			runAtEpochMs: 0,
		},
	};

	async upsertTrigger(request: UniverseAgentUpsertTriggerRequest): Promise<UniverseAgentUpsertTriggerResult> {
		this.upsertTriggerCalls.push(request);
		return this.upsertTriggerResult;
	}

	async listModels() {
		return { models: [] };
	}

	readonly getConfigCalls: UniverseAgentGetConfigRequest[] = [];
	getConfigResult: UniverseAgentGetConfigResult = { values: {}, scope: '' };

	async getConfig(request: UniverseAgentGetConfigRequest): Promise<UniverseAgentGetConfigResult> {
		this.getConfigCalls.push(request);
		return this.getConfigResult;
	}

	readonly getModelPreferencesCalls: UniverseAgentGetModelPreferencesRequest[] = [];
	getModelPreferencesResult: UniverseAgentGetModelPreferencesResult = {
		minLevel: 0,
		maxCost: '',
		minSpeed: '',
		strategy: '',
	};

	async getModelPreferences(request: UniverseAgentGetModelPreferencesRequest): Promise<UniverseAgentGetModelPreferencesResult> {
		this.getModelPreferencesCalls.push(request);
		return this.getModelPreferencesResult;
	}

	async fetchAgentTree(sessionId: string) {
		if (this.handlers.fetchAgentTree) {
			return this.handlers.fetchAgentTree(sessionId);
		}
		return undefined;
	}

	async fetchToolDetail() {
		return { success: false, content: '', truncated: false };
	}

	async memberStatus() {
		return [];
	}

	async taskList() {
		return [];
	}

	async teamInfo() {
		return undefined;
	}
}

suite('UniverseAgentConnectionService', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('token + live channel => isEngineConnected === true', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(service.getTransportState(), 'ok');
		assert.strictEqual(service.getConnectionSnapshot().sessionToken, 'token-1');
		service.dispose();
	});

	test('subscribeSessionEventStream forwards transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		service.subscribeSessionEventStream('sess-1', () => { }, cause => seen.push(cause));
		transport.fireSessionStreamClosed({ kind: 'remote' });
		transport.fireSessionStreamClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);
		service.dispose();
	});

	test('subscribeSessionEventStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const sub = service.subscribeSessionEventStream('sess-1', () => { }, cause => seen.push(cause));
		sub.dispose();
		transport.fireSessionStreamClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('UniverseAgentGrpcServices lists Agent.ContinueGeneration', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ContinueGeneration, 'ContinueGeneration');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Regenerate', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Regenerate, 'Regenerate');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Rename', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Rename, 'Rename');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Cancel', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Cancel, 'Cancel');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.CancelToolCall', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.CancelToolCall, 'CancelToolCall');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.RunToolInBackground', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.RunToolInBackground, 'RunToolInBackground');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.StopShellTask', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.StopShellTask, 'StopShellTask');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.SendShellSessionClientControl', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.SendShellSessionClientControl, 'SendShellSessionClientControl');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.FetchToolUsageDetail', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.FetchToolUsageDetail, 'FetchToolUsageDetail');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.FireTriggerWebhook', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.FireTriggerWebhook, 'FireTriggerWebhook');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.InstallSessionDemoFake', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.InstallSessionDemoFake, 'InstallSessionDemoFake');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.ClearSessionDemoFake', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ClearSessionDemoFake, 'ClearSessionDemoFake');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.SwitchWorkDir', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.SwitchWorkDir, 'SwitchWorkDir');
	});

	test('UniverseAgentGrpcServices lists Agent.TestModelProfile', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.TestModelProfile, 'TestModelProfile');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Config.Set', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Config.Set, 'Set');
		assert.strictEqual(UniverseAgentGrpcServices.Config.service, 'universeagent.config.v1.ConfigService');
	});

	test('UniverseAgentGrpcServices lists Config.SetModelPreferences', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Config.SetModelPreferences, 'SetModelPreferences');
		assert.strictEqual(UniverseAgentGrpcServices.Config.service, 'universeagent.config.v1.ConfigService');
	});

	test('UniverseAgentGrpcServices lists Agent.SubscribeToolDetail', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.SubscribeToolDetail, 'SubscribeToolDetail');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Permission.SetSessionGoal', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Permission.SetSessionGoal, 'SetSessionGoal');
		assert.strictEqual(UniverseAgentGrpcServices.Permission.CancelSessionGoal, 'CancelSessionGoal');
		assert.strictEqual(UniverseAgentGrpcServices.Permission.service, 'universeagent.session.v1.PermissionService');
	});

	test('UniverseAgentGrpcServices lists Permission.Respond', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Permission.Respond, 'Respond');
		assert.strictEqual(UniverseAgentGrpcServices.Permission.service, 'universeagent.session.v1.PermissionService');
	});

	test('UniverseAgentGrpcServices lists Permission.SyncPermissionRule', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Permission.SyncPermissionRule, 'SyncPermissionRule');
		assert.strictEqual(UniverseAgentGrpcServices.Permission.service, 'universeagent.session.v1.PermissionService');
	});

	test('UniverseAgentGrpcServices lists Permission.PromotePermissionRule', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Permission.PromotePermissionRule, 'PromotePermissionRule');
		assert.strictEqual(UniverseAgentGrpcServices.Permission.service, 'universeagent.session.v1.PermissionService');
	});

	test('UniverseAgentGrpcServices lists Permission.GetSessionRules', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Permission.GetSessionRules, 'GetSessionRules');
		assert.strictEqual(UniverseAgentGrpcServices.Permission.service, 'universeagent.session.v1.PermissionService');
	});

	test('UniverseAgentGrpcServices lists Permission.SetPermissionMode', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Permission.SetPermissionMode, 'SetPermissionMode');
		assert.strictEqual(UniverseAgentGrpcServices.Permission.service, 'universeagent.session.v1.PermissionService');
	});

	test('UniverseAgentGrpcServices lists Team.TaskUpdate', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.TaskUpdate, 'TaskUpdate');
		assert.strictEqual(UniverseAgentGrpcServices.Team.service, 'universeagent.team.v1.TeamService');
	});

	test('UniverseAgentGrpcServices lists Team.TaskCancel', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.TaskCancel, 'TaskCancel');
		assert.strictEqual(UniverseAgentGrpcServices.Team.service, 'universeagent.team.v1.TeamService');
	});

	test('UniverseAgentGrpcServices lists Team.MessageMember', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.MessageMember, 'MessageMember');
		assert.strictEqual(UniverseAgentGrpcServices.Team.service, 'universeagent.team.v1.TeamService');
	});

	test('UniverseAgentGrpcServices lists Team.CreateTeam', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.CreateTeam, 'CreateTeam');
		assert.strictEqual(UniverseAgentGrpcServices.Team.service, 'universeagent.team.v1.TeamService');
	});

	test('UniverseAgentGrpcServices lists Team.StartMember', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.StartMember, 'StartMember');
		assert.strictEqual(UniverseAgentGrpcServices.Team.service, 'universeagent.team.v1.TeamService');
	});

	test('UniverseAgentGrpcServices lists Team.KillMember', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.KillMember, 'KillMember');
		assert.strictEqual(UniverseAgentGrpcServices.Team.service, 'universeagent.team.v1.TeamService');
	});

	test('UniverseAgentGrpcServices lists Team.Abort', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Team.Abort, 'Abort');
		assert.strictEqual(UniverseAgentGrpcServices.Team.service, 'universeagent.team.v1.TeamService');
	});

	test('UniverseAgentGrpcServices lists Config.Get', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Config.Get, 'Get');
		assert.strictEqual(UniverseAgentGrpcServices.Config.service, 'universeagent.config.v1.ConfigService');
	});

	test('UniverseAgentGrpcServices lists Config.SwitchModel', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Config.SwitchModel, 'SwitchModel');
		assert.strictEqual(UniverseAgentGrpcServices.Config.service, 'universeagent.config.v1.ConfigService');
	});

	test('UniverseAgentGrpcServices lists Config.ResolveModel', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Config.ResolveModel, 'ResolveModel');
		assert.strictEqual(UniverseAgentGrpcServices.Config.service, 'universeagent.config.v1.ConfigService');
	});

	test('UniverseAgentGrpcServices lists Config.Watch', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Config.Watch, 'Watch');
		assert.strictEqual(UniverseAgentGrpcServices.Config.service, 'universeagent.config.v1.ConfigService');
	});

	test('UniverseAgentGrpcServices lists Config.SetPermissionPolicy', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Config.SetPermissionPolicy, 'SetPermissionPolicy');
		assert.strictEqual(UniverseAgentGrpcServices.Config.service, 'universeagent.config.v1.ConfigService');
	});

	test('UniverseAgentGrpcServices lists Config.GetModelPreferences', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Config.GetModelPreferences, 'GetModelPreferences');
		assert.strictEqual(UniverseAgentGrpcServices.Config.service, 'universeagent.config.v1.ConfigService');
	});

	test('UniverseAgentGrpcServices lists Agent.InsertQueueItem', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.InsertQueueItem, 'InsertQueueItem');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.ReorderQueue', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ReorderQueue, 'ReorderQueue');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.DeleteQueueItem', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.DeleteQueueItem, 'DeleteQueueItem');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.RetryQueueItem', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.RetryQueueItem, 'RetryQueueItem');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.RetryAllFailed', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.RetryAllFailed, 'RetryAllFailed');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.RetryQueueItemUpload', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.RetryQueueItemUpload, 'RetryQueueItemUpload');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.PinQueueItem', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.PinQueueItem, 'PinQueueItem');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.SetQueueItemLocked', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.SetQueueItemLocked, 'SetQueueItemLocked');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.InjectQueueItem', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.InjectQueueItem, 'InjectQueueItem');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.SetQueueItemForkAnchor', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.SetQueueItemForkAnchor, 'SetQueueItemForkAnchor');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.ChatSync', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ChatSync, 'ChatSync');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.SyncInputDelivery', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.SyncInputDelivery, 'SyncInputDelivery');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent queue mutation family', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.EnqueueQueueItem, 'EnqueueQueueItem');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.PauseQueue, 'PauseQueue');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ResumeQueue, 'ResumeQueue');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ClearQueue, 'ClearQueue');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.HoldQueueItem, 'HoldQueueItem');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ReleaseQueueItemHold, 'ReleaseQueueItemHold');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.EditQueueItem, 'EditQueueItem');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Fork', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Fork, 'Fork');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Tool.ToolInfo', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Tool.ToolInfo, 'ToolInfo');
		assert.strictEqual(UniverseAgentGrpcServices.Tool.service, 'universeagent.tool.v1.ToolService');
	});

	test('UniverseAgentGrpcServices lists Tool.ListCommands', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Tool.ListCommands, 'ListCommands');
		assert.strictEqual(UniverseAgentGrpcServices.Tool.service, 'universeagent.tool.v1.ToolService');
	});

	test('UniverseAgentGrpcServices lists Tool.GetCommandDef', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Tool.GetCommandDef, 'GetCommandDef');
		assert.strictEqual(UniverseAgentGrpcServices.Tool.service, 'universeagent.tool.v1.ToolService');
	});

	test('UniverseAgentGrpcServices lists File.ListFiles', () => {
		assert.strictEqual(UniverseAgentGrpcServices.File.ListFiles, 'ListFiles');
		assert.strictEqual(UniverseAgentGrpcServices.File.service, 'universeagent.file.v1.FileService');
	});

	test('UniverseAgentGrpcServices lists File.ReadFile', () => {
		assert.strictEqual(UniverseAgentGrpcServices.File.ReadFile, 'ReadFile');
		assert.strictEqual(UniverseAgentGrpcServices.File.service, 'universeagent.file.v1.FileService');
	});

	test('UniverseAgentGrpcServices lists File.GetFileInfo', () => {
		assert.strictEqual(UniverseAgentGrpcServices.File.GetFileInfo, 'GetFileInfo');
		assert.strictEqual(UniverseAgentGrpcServices.File.service, 'universeagent.file.v1.FileService');
	});

	test('UniverseAgentGrpcServices lists File.WriteFile', () => {
		assert.strictEqual(UniverseAgentGrpcServices.File.WriteFile, 'WriteFile');
		assert.strictEqual(UniverseAgentGrpcServices.File.service, 'universeagent.file.v1.FileService');
	});

	test('UniverseAgentGrpcServices lists File.ForceWriteFile', () => {
		assert.strictEqual(UniverseAgentGrpcServices.File.ForceWriteFile, 'ForceWriteFile');
		assert.strictEqual(UniverseAgentGrpcServices.File.service, 'universeagent.file.v1.FileService');
	});

	test('UniverseAgentGrpcServices lists File.AgentMerge', () => {
		assert.strictEqual(UniverseAgentGrpcServices.File.AgentMerge, 'AgentMerge');
		assert.strictEqual(UniverseAgentGrpcServices.File.service, 'universeagent.file.v1.FileService');
	});

	test('UniverseAgentGrpcServices lists Git.ReadGitSummary', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Git.ReadGitSummary, 'ReadGitSummary');
		assert.strictEqual(UniverseAgentGrpcServices.Git.service, 'universeagent.git.v1.GitService');
	});

	test('UniverseAgentGrpcServices lists Git.ReadGitChanges', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Git.ReadGitChanges, 'ReadGitChanges');
		assert.strictEqual(UniverseAgentGrpcServices.Git.service, 'universeagent.git.v1.GitService');
	});

	test('UniverseAgentGrpcServices lists Git.ReadGitFileDiff', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Git.ReadGitFileDiff, 'ReadGitFileDiff');
		assert.strictEqual(UniverseAgentGrpcServices.Git.service, 'universeagent.git.v1.GitService');
	});

	test('UniverseAgentGrpcServices lists Git.WriteGitStagePaths', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Git.WriteGitStagePaths, 'WriteGitStagePaths');
		assert.strictEqual(UniverseAgentGrpcServices.Git.service, 'universeagent.git.v1.GitService');
	});

	test('UniverseAgentGrpcServices lists Git.WriteGitCommit', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Git.WriteGitCommit, 'WriteGitCommit');
		assert.strictEqual(UniverseAgentGrpcServices.Git.service, 'universeagent.git.v1.GitService');
	});

	test('UniverseAgentGrpcServices lists Git.WriteGitApplyHunks', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Git.WriteGitApplyHunks, 'WriteGitApplyHunks');
		assert.strictEqual(UniverseAgentGrpcServices.Git.service, 'universeagent.git.v1.GitService');
	});

	test('UniverseAgentGrpcServices lists TokenUsage.GetSessionUsage', () => {
		assert.strictEqual(UniverseAgentGrpcServices.TokenUsage.GetSessionUsage, 'GetSessionUsage');
		assert.strictEqual(UniverseAgentGrpcServices.TokenUsage.service, 'universeagent.tokenusage.v1.TokenUsageService');
	});

	test('UniverseAgentGrpcServices lists TokenUsage.GetGlobalUsage', () => {
		assert.strictEqual(UniverseAgentGrpcServices.TokenUsage.GetGlobalUsage, 'GetGlobalUsage');
		assert.strictEqual(UniverseAgentGrpcServices.TokenUsage.service, 'universeagent.tokenusage.v1.TokenUsageService');
	});

	test('UniverseAgentGrpcServices lists Memory.Save', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.Save, 'Save');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.Search', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.Search, 'Search');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.SearchDeep', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.SearchDeep, 'SearchDeep');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.Read', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.Read, 'Read');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.List', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.List, 'List');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.Delete', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.Delete, 'Delete');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.Reflect', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.Reflect, 'Reflect');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.Rebuild', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.Rebuild, 'Rebuild');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.Revert', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.Revert, 'Revert');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists Memory.History', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Memory.History, 'History');
		assert.strictEqual(UniverseAgentGrpcServices.Memory.service, 'universeagent.memory.v1.MemoryService');
	});

	test('UniverseAgentGrpcServices lists ContextVariable.List', () => {
		assert.strictEqual(UniverseAgentGrpcServices.ContextVariable.List, 'List');
		assert.strictEqual(UniverseAgentGrpcServices.ContextVariable.service, 'universeagent.contextvariable.v1.ContextVariableService');
	});

	test('UniverseAgentGrpcServices lists ContextVariable.Read', () => {
		assert.strictEqual(UniverseAgentGrpcServices.ContextVariable.Read, 'Read');
		assert.strictEqual(UniverseAgentGrpcServices.ContextVariable.service, 'universeagent.contextvariable.v1.ContextVariableService');
	});

	test('UniverseAgentGrpcServices lists FileTransfer.GetUploadProgress', () => {
		assert.strictEqual(UniverseAgentGrpcServices.FileTransfer.GetUploadProgress, 'GetUploadProgress');
		assert.strictEqual(UniverseAgentGrpcServices.FileTransfer.service, 'universeagent.filetransfer.v1.FileTransferService');
	});

	test('UniverseAgentGrpcServices lists FileTransfer.UploadAttachment', () => {
		assert.strictEqual(UniverseAgentGrpcServices.FileTransfer.UploadAttachment, 'UploadAttachment');
		assert.strictEqual(UniverseAgentGrpcServices.FileTransfer.service, 'universeagent.filetransfer.v1.FileTransferService');
	});

	test('UniverseAgentGrpcServices lists FileTransfer.DownloadAttachment', () => {
		assert.strictEqual(UniverseAgentGrpcServices.FileTransfer.DownloadAttachment, 'DownloadAttachment');
		assert.strictEqual(UniverseAgentGrpcServices.FileTransfer.service, 'universeagent.filetransfer.v1.FileTransferService');
	});

	test('UniverseAgentGrpcServices lists System.HealthCheck', () => {
		assert.strictEqual(UniverseAgentGrpcServices.System.HealthCheck, 'HealthCheck');
		assert.strictEqual(UniverseAgentGrpcServices.System.service, 'universeagent.system.v1.SystemService');
	});

	test('UniverseAgentGrpcServices lists System.Doctor', () => {
		assert.strictEqual(UniverseAgentGrpcServices.System.Doctor, 'Doctor');
		assert.strictEqual(UniverseAgentGrpcServices.System.service, 'universeagent.system.v1.SystemService');
	});

	test('UniverseAgentGrpcServices lists System.Shutdown', () => {
		assert.strictEqual(UniverseAgentGrpcServices.System.Shutdown, 'Shutdown');
		assert.strictEqual(UniverseAgentGrpcServices.System.service, 'universeagent.system.v1.SystemService');
	});

	test('UniverseAgentGrpcServices lists Device.ListDevices', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Device.ListDevices, 'ListDevices');
		assert.strictEqual(UniverseAgentGrpcServices.Device.service, 'universeagent.device.v1.DeviceService');
	});

	test('UniverseAgentGrpcServices lists Device.PairApprove', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Device.PairApprove, 'PairApprove');
		assert.strictEqual(UniverseAgentGrpcServices.Device.service, 'universeagent.device.v1.DeviceService');
	});

	test('UniverseAgentGrpcServices lists Device.PairReject', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Device.PairReject, 'PairReject');
		assert.strictEqual(UniverseAgentGrpcServices.Device.service, 'universeagent.device.v1.DeviceService');
	});

	test('UniverseAgentGrpcServices lists Trigger.ListTriggers', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Trigger.ListTriggers, 'ListTriggers');
		assert.strictEqual(UniverseAgentGrpcServices.Trigger.service, 'universeagent.trigger.v1.TriggerService');
	});

	test('UniverseAgentGrpcServices lists Trigger.UpsertTrigger', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Trigger.UpsertTrigger, 'UpsertTrigger');
		assert.strictEqual(UniverseAgentGrpcServices.Trigger.service, 'universeagent.trigger.v1.TriggerService');
	});

	test('UniverseAgentGrpcServices lists Clipboard.Write', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Clipboard.Write, 'Write');
		assert.strictEqual(UniverseAgentGrpcServices.Clipboard.service, 'universeagent.clipboard.v1.ClipboardService');
	});

	test('UniverseAgentGrpcServices lists Clipboard.Read', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Clipboard.Read, 'Read');
		assert.strictEqual(UniverseAgentGrpcServices.Clipboard.service, 'universeagent.clipboard.v1.ClipboardService');
	});

	test('UniverseAgentGrpcServices lists Agent.Kill', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Kill, 'Kill');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.DeleteMessage', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.DeleteMessage, 'DeleteMessage');
	});

	test('UniverseAgentGrpcServices lists Agent.EditMessage', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.EditMessage, 'EditMessage');
	});

	test('UniverseAgentGrpcServices lists Agent.RespondQuestion', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.RespondQuestion, 'RespondQuestion');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.SendClientToolResponse', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.SendClientToolResponse, 'SendClientToolResponse');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.ListSnapshots', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ListSnapshots, 'ListSnapshots');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.ListLoopSnapshots', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ListLoopSnapshots, 'ListLoopSnapshots');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.CreateSnapshot', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.CreateSnapshot, 'CreateSnapshot');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.RestoreSnapshot', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.RestoreSnapshot, 'RestoreSnapshot');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.DeleteSnapshot', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.DeleteSnapshot, 'DeleteSnapshot');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Session.Info', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.Info, 'Info');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Session.Resume', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.Resume, 'Resume');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Session.Prewarm', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.Prewarm, 'Prewarm');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Session.Shelve', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.Shelve, 'Shelve');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Session.Unshelve', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.Unshelve, 'Unshelve');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Session.Export', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.Export, 'Export');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Session.ResolveTurn', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.ResolveTurn, 'ResolveTurn');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Agent.Status', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Status, 'Status');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Session.Purge', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.Purge, 'Purge');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Agent.Todo', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Todo, 'Todo');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Compact', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Compact, 'Compact');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Session.ResolveAnchor', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Session.ResolveAnchor, 'ResolveAnchor');
		assert.strictEqual(UniverseAgentGrpcServices.Session.service, 'universeagent.session.v1.SessionService');
	});

	test('UniverseAgentGrpcServices lists Agent.Usage', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Usage, 'Usage');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.List', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.List, 'List');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.History', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.History, 'History');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Pause', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Pause, 'Pause');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Resume', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Resume, 'Resume');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Back', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Back, 'Back');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Prune', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Prune, 'Prune');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.SuspendLoop', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.SuspendLoop, 'SuspendLoop');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.ResumeLoop', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.ResumeLoop, 'ResumeLoop');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.StopLoop', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.StopLoop, 'StopLoop');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Reset', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Reset, 'Reset');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('UniverseAgentGrpcServices lists Agent.Branch', () => {
		assert.strictEqual(UniverseAgentGrpcServices.Agent.Branch, 'Branch');
		assert.strictEqual(UniverseAgentGrpcServices.Agent.service, 'universeagent.agent.v1.AgentService');
	});

	test('renameSession forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.renameSession({ sessionId: 'sess-1', title: 'New title' });
		assert.deepStrictEqual(transport.renameCalls, [{ sessionId: 'sess-1', title: 'New title' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.renameResult = { ok: false, message: 'not found' };
		const failed = await service.renameSession({ sessionId: 'sess-1', title: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not found' });
		assert.strictEqual(transport.renameCalls[1]?.title, '');
		service.dispose();
	});

	test('cancelGeneration forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.cancelGeneration({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.cancelCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.cancelResult = { ok: false, message: 'not running' };
		const failed = await service.cancelGeneration({ sessionId: 'sess-1', agentId: 'sub:a' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not running' });
		assert.strictEqual(transport.cancelCalls[1]?.agentId, 'sub:a');
		service.dispose();
	});

	test('cancelToolCall forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.cancelToolCall({ sessionId: 'sess-1', toolCallId: 'tc-1' });
		assert.deepStrictEqual(transport.cancelToolCallCalls, [{ sessionId: 'sess-1', toolCallId: 'tc-1' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.cancelToolCallResult = { ok: false, message: 'not in flight' };
		const failed = await service.cancelToolCall({ sessionId: 'sess-1', agentId: 'sub:a', toolCallId: 'tc-2' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not in flight' });
		assert.strictEqual(transport.cancelToolCallCalls[1]?.agentId, 'sub:a');
		assert.strictEqual(transport.cancelToolCallCalls[1]?.toolCallId, 'tc-2');
		service.dispose();
	});

	test('runToolInBackground forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.runToolInBackgroundResult = { ok: true, message: 'detached', reasonCode: '' };
		const result = await service.runToolInBackground({ sessionId: 'sess-1', agentId: 'root', toolCallId: 'tc-1' });
		assert.deepStrictEqual(transport.runToolInBackgroundCalls, [{ sessionId: 'sess-1', agentId: 'root', toolCallId: 'tc-1' }]);
		assert.deepStrictEqual(result, transport.runToolInBackgroundResult);

		transport.runToolInBackgroundResult = { ok: false, message: 'not in flight', reasonCode: 'NOT_IN_FLIGHT' };
		const empty = await service.runToolInBackground({ sessionId: '', agentId: '', toolCallId: '' });
		assert.deepStrictEqual(empty, transport.runToolInBackgroundResult);
		assert.strictEqual(transport.runToolInBackgroundCalls[1]?.sessionId, '');
		assert.strictEqual(transport.runToolInBackgroundCalls[1]?.agentId, '');
		assert.strictEqual(transport.runToolInBackgroundCalls[1]?.toolCallId, '');
		service.dispose();
	});

	test('stopShellTask forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.stopShellTaskResult = { ok: true, message: 'stopped' };
		const result = await service.stopShellTask({ sessionId: 'sess-1', taskId: 'task-1' });
		assert.deepStrictEqual(transport.stopShellTaskCalls, [{ sessionId: 'sess-1', taskId: 'task-1' }]);
		assert.deepStrictEqual(result, transport.stopShellTaskResult);

		transport.stopShellTaskResult = { ok: false, message: 'not found' };
		const empty = await service.stopShellTask({ sessionId: '', taskId: '' });
		assert.deepStrictEqual(empty, transport.stopShellTaskResult);
		assert.strictEqual(transport.stopShellTaskCalls[1]?.sessionId, '');
		assert.strictEqual(transport.stopShellTaskCalls[1]?.taskId, '');
		service.dispose();
	});

	test('sendShellSessionClientControl forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.sendShellSessionClientControlResult = {
			ok: true,
			message: '',
			errorCode: '',
			debounced: false,
			deliveredToSubscribe: true,
		};
		const result = await service.sendShellSessionClientControl({
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
			refId: 'shell-1',
			controlPayloadJson: '{"op":"resize"}',
		});
		assert.deepStrictEqual(transport.sendShellSessionClientControlCalls, [{
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
			refId: 'shell-1',
			controlPayloadJson: '{"op":"resize"}',
		}]);
		assert.deepStrictEqual(result, transport.sendShellSessionClientControlResult);

		transport.sendShellSessionClientControlResult = {
			ok: false,
			message: 'no subscribe',
			errorCode: 'NO_SUBSCRIBE',
			debounced: false,
			deliveredToSubscribe: false,
		};
		const empty = await service.sendShellSessionClientControl({
			sessionId: '',
			toolCallId: '',
			refId: '',
			controlPayloadJson: '',
		});
		assert.deepStrictEqual(empty, transport.sendShellSessionClientControlResult);
		assert.strictEqual(transport.sendShellSessionClientControlCalls[1]?.sessionId, '');
		assert.strictEqual(transport.sendShellSessionClientControlCalls[1]?.toolCallId, '');
		assert.strictEqual(transport.sendShellSessionClientControlCalls[1]?.refId, '');
		assert.strictEqual(transport.sendShellSessionClientControlCalls[1]?.controlPayloadJson, '');
		service.dispose();
	});

	test('fetchToolUsageDetail forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.fetchToolUsageDetailResult = {
			ok: true,
			toolCallId: 'tc-1',
			contextSources: [{
				sourceType: 'CONTEXT_SOURCE_TYPE_SELF_HISTORY',
				sourceAgentId: 'root',
				estimatedTokens: 12,
			}],
			message: '',
		};
		const usageResult = await service.fetchToolUsageDetail({ sessionId: 'sess-1', toolCallId: 'tc-1' });
		assert.deepStrictEqual(transport.fetchToolUsageDetailCalls, [{ sessionId: 'sess-1', toolCallId: 'tc-1' }]);
		assert.deepStrictEqual(usageResult, transport.fetchToolUsageDetailResult);

		transport.fetchToolUsageDetailResult = { ok: false, toolCallId: '', contextSources: [], message: 'not found' };
		const usageEmpty = await service.fetchToolUsageDetail({ sessionId: '', toolCallId: '' });
		assert.deepStrictEqual(usageEmpty, transport.fetchToolUsageDetailResult);
		assert.strictEqual(transport.fetchToolUsageDetailCalls[1]?.sessionId, '');
		assert.strictEqual(transport.fetchToolUsageDetailCalls[1]?.toolCallId, '');
		service.dispose();
	});

	test('fireTriggerWebhook forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.fireTriggerWebhookResult = {
			status: 'FIRE_TRIGGER_WEBHOOK_STATUS_QUEUED',
			eventId: 'evt-1',
			reason: '',
		};
		const result = await service.fireTriggerWebhook({
			sessionId: 'sess-1',
			triggerId: 'trig-1',
			payloadJson: '{"k":1}',
		});
		assert.deepStrictEqual(transport.fireTriggerWebhookCalls, [{
			sessionId: 'sess-1',
			triggerId: 'trig-1',
			payloadJson: '{"k":1}',
		}]);
		assert.deepStrictEqual(result, transport.fireTriggerWebhookResult);

		transport.fireTriggerWebhookResult = {
			status: 'FIRE_TRIGGER_WEBHOOK_STATUS_REJECTED',
			eventId: '',
			reason: 'not armed',
		};
		const empty = await service.fireTriggerWebhook({
			sessionId: '',
			triggerId: '',
			payloadJson: '',
		});
		assert.deepStrictEqual(empty, transport.fireTriggerWebhookResult);
		assert.strictEqual(transport.fireTriggerWebhookCalls[1]?.sessionId, '');
		assert.strictEqual(transport.fireTriggerWebhookCalls[1]?.triggerId, '');
		assert.strictEqual(transport.fireTriggerWebhookCalls[1]?.payloadJson, '');
		service.dispose();
	});

	test('switchWorkDir forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.switchWorkDirResult = {
			ok: true,
			previousWorkDir: '/old',
			currentWorkDir: '/new',
			message: 'switched',
		};
		const result = await service.switchWorkDir({
			sessionId: 'sess-1',
			agentId: 'root',
			newWorkDir: '/new',
		});
		assert.deepStrictEqual(transport.switchWorkDirCalls, [{
			sessionId: 'sess-1',
			agentId: 'root',
			newWorkDir: '/new',
		}]);
		assert.deepStrictEqual(result, transport.switchWorkDirResult);

		transport.switchWorkDirResult = {
			ok: false,
			previousWorkDir: '',
			currentWorkDir: '',
			message: 'empty',
		};
		const empty = await service.switchWorkDir({
			sessionId: '',
			agentId: '',
			newWorkDir: '',
		});
		assert.deepStrictEqual(empty, transport.switchWorkDirResult);
		assert.strictEqual(transport.switchWorkDirCalls[1]?.sessionId, '');
		assert.strictEqual(transport.switchWorkDirCalls[1]?.agentId, '');
		assert.strictEqual(transport.switchWorkDirCalls[1]?.newWorkDir, '');
		service.dispose();
	});

	test('testModelProfile forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.testModelProfileResult = { ok: true, message: '' };
		const result = await service.testModelProfile({
			providerId: 'openai',
			modelId: 'gpt-4',
			apiKey: 'sk-test',
			baseUrl: 'https://api.example',
			protocol: 'openai',
			params: { temperature: '0' },
		});
		assert.deepStrictEqual(transport.testModelProfileCalls, [{
			providerId: 'openai',
			modelId: 'gpt-4',
			apiKey: 'sk-test',
			baseUrl: 'https://api.example',
			protocol: 'openai',
			params: { temperature: '0' },
		}]);
		assert.deepStrictEqual(result, transport.testModelProfileResult);

		transport.testModelProfileResult = { ok: false, message: 'refused' };
		const empty = await service.testModelProfile({
			providerId: '',
			modelId: '',
			apiKey: '',
			baseUrl: '',
			protocol: '',
			params: {},
		});
		assert.deepStrictEqual(empty, transport.testModelProfileResult);
		assert.strictEqual(transport.testModelProfileCalls[1]?.providerId, '');
		assert.strictEqual(transport.testModelProfileCalls[1]?.modelId, '');
		assert.strictEqual(transport.testModelProfileCalls[1]?.apiKey, '');
		assert.strictEqual(transport.testModelProfileCalls[1]?.baseUrl, '');
		assert.strictEqual(transport.testModelProfileCalls[1]?.protocol, '');
		assert.deepStrictEqual(transport.testModelProfileCalls[1]?.params, {});
		service.dispose();
	});

	test('setConfig forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.setConfigResult = { ok: true, message: '' };
		const result = await service.setConfig({
			key: 'theme',
			value: 'dark',
			scope: 'session',
			sessionId: 'sess-1',
		});
		assert.deepStrictEqual(transport.setConfigCalls, [{
			key: 'theme',
			value: 'dark',
			scope: 'session',
			sessionId: 'sess-1',
		}]);
		assert.deepStrictEqual(result, transport.setConfigResult);

		transport.setConfigResult = { ok: false, message: 'refused' };
		const empty = await service.setConfig({
			key: '',
			value: '',
			scope: '',
			sessionId: '',
		});
		assert.deepStrictEqual(empty, transport.setConfigResult);
		assert.strictEqual(transport.setConfigCalls[1]?.key, '');
		assert.strictEqual(transport.setConfigCalls[1]?.value, '');
		assert.strictEqual(transport.setConfigCalls[1]?.scope, '');
		assert.strictEqual(transport.setConfigCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('setModelPreferences forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.setModelPreferencesResult = { minLevel: 5, maxCost: 'middle', minSpeed: 'fast', strategy: 'level' };
		const result = await service.setModelPreferences({
			sessionId: 'sess-1',
			minLevel: 5,
			maxCost: 'middle',
			minSpeed: 'fast',
			strategy: 'level',
		});
		assert.deepStrictEqual(transport.setModelPreferencesCalls, [{
			sessionId: 'sess-1',
			minLevel: 5,
			maxCost: 'middle',
			minSpeed: 'fast',
			strategy: 'level',
		}]);
		assert.deepStrictEqual(result, transport.setModelPreferencesResult);

		transport.setModelPreferencesResult = { minLevel: 0, maxCost: '', minSpeed: '', strategy: '' };
		const empty = await service.setModelPreferences({
			sessionId: '',
			minLevel: 0,
			maxCost: '',
			minSpeed: '',
			strategy: '',
		});
		assert.deepStrictEqual(empty, transport.setModelPreferencesResult);
		assert.strictEqual(transport.setModelPreferencesCalls[1]?.sessionId, '');
		assert.strictEqual(transport.setModelPreferencesCalls[1]?.minLevel, 0);
		assert.strictEqual(transport.setModelPreferencesCalls[1]?.maxCost, '');
		assert.strictEqual(transport.setModelPreferencesCalls[1]?.minSpeed, '');
		assert.strictEqual(transport.setModelPreferencesCalls[1]?.strategy, '');
		service.dispose();
	});


	test('setSessionGoal forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.setSessionGoal({ sessionId: 'sess-1', goal: 'Ship the slice' });
		assert.deepStrictEqual(transport.setGoalCalls, [{ sessionId: 'sess-1', goal: 'Ship the slice' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.setGoalResult = { ok: false, message: 'empty goal' };
		const failed = await service.setSessionGoal({ sessionId: 'sess-1', goal: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'empty goal' });
		assert.strictEqual(transport.setGoalCalls[1]?.goal, '');
		service.dispose();
	});

	test('cancelSessionGoal forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.cancelSessionGoal({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.cancelGoalCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.cancelGoalResult = { ok: false, message: 'no goal' };
		const failed = await service.cancelSessionGoal({ sessionId: 'sess-2' });
		assert.deepStrictEqual(failed, { ok: false, message: 'no goal' });
		assert.strictEqual(transport.cancelGoalCalls[1]?.sessionId, 'sess-2');
		service.dispose();
	});

	test('respondPermission forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.respondPermission({ sessionId: 'sess-1', requestId: 'req-1', granted: true });
		assert.deepStrictEqual(transport.respondPermissionCalls, [{ sessionId: 'sess-1', requestId: 'req-1', granted: true }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.respondPermissionResult = { ok: false, message: 'expired' };
		const failed = await service.respondPermission({ sessionId: 'sess-1', requestId: 'req-2', granted: false, metadataJson: '{"note":"deny"}' });
		assert.deepStrictEqual(failed, { ok: false, message: 'expired' });
		assert.strictEqual(transport.respondPermissionCalls[1]?.granted, false);
		assert.strictEqual(transport.respondPermissionCalls[1]?.metadataJson, '{"note":"deny"}');
		service.dispose();
	});

	test('syncPermissionRule forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.syncPermissionRuleResult = { ok: true, ruleId: 'rule-1' };
		const result = await service.syncPermissionRule({
			sessionId: 'sess-1',
			toolName: 'shell',
			scope: 'workdir',
			action: 'ALLOW',
			reason: 'ok',
		});
		assert.deepStrictEqual(transport.syncPermissionRuleCalls, [{
			sessionId: 'sess-1',
			toolName: 'shell',
			scope: 'workdir',
			action: 'ALLOW',
			reason: 'ok',
		}]);
		assert.deepStrictEqual(result, { ok: true, ruleId: 'rule-1' });

		const bash = await service.syncPermissionRule({
			sessionId: 'sess-1',
			toolName: 'bash',
			scope: 'session',
			action: 'ALLOW',
			reason: 'trusted',
		});
		assert.deepStrictEqual(transport.syncPermissionRuleCalls[1], {
			sessionId: 'sess-1',
			toolName: 'bash',
			scope: 'session',
			action: 'ALLOW',
			reason: 'trusted',
		});
		assert.deepStrictEqual(bash, { ok: true, ruleId: 'rule-1' });

		transport.syncPermissionRuleResult = { ok: false, ruleId: '' };
		const empty = await service.syncPermissionRule({
			sessionId: '',
			toolName: '',
			scope: '',
			action: 'RULE_ACTION_UNSPECIFIED',
			reason: '',
		});
		assert.deepStrictEqual(empty, { ok: false, ruleId: '' });
		assert.strictEqual(transport.syncPermissionRuleCalls[2]?.sessionId, '');
		assert.strictEqual(transport.syncPermissionRuleCalls[2]?.toolName, '');
		assert.strictEqual(transport.syncPermissionRuleCalls[2]?.scope, '');
		assert.strictEqual(transport.syncPermissionRuleCalls[2]?.reason, '');
		service.dispose();
	});

	test('promotePermissionRule forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.promotePermissionRuleResult = { ok: true };
		const promoteResult = await service.promotePermissionRule({
			toolName: 'shell',
			scope: 'workdir',
			action: 'ALLOW',
		});
		assert.deepStrictEqual(transport.promotePermissionRuleCalls, [{
			toolName: 'shell',
			scope: 'workdir',
			action: 'ALLOW',
		}]);
		assert.deepStrictEqual(promoteResult, { ok: true });

		transport.promotePermissionRuleResult = { ok: false };
		const promoteEmpty = await service.promotePermissionRule({
			toolName: '',
			scope: '',
			action: 'RULE_ACTION_UNSPECIFIED',
		});
		assert.deepStrictEqual(promoteEmpty, { ok: false });
		assert.strictEqual(transport.promotePermissionRuleCalls[1]?.toolName, '');
		assert.strictEqual(transport.promotePermissionRuleCalls[1]?.scope, '');
		assert.strictEqual(transport.promotePermissionRuleCalls[1]?.action, 'RULE_ACTION_UNSPECIFIED');
		service.dispose();
	});

	test('respondQuestion forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.respondQuestion({
			sessionId: 'sess-1',
			questionId: 'q-1',
			answers: { q_0: { selectedLabels: ['A'] } },
		});
		assert.strictEqual(transport.respondQuestionCalls.length, 1);
		assert.deepStrictEqual(transport.respondQuestionCalls[0], {
			sessionId: 'sess-1',
			questionId: 'q-1',
			answers: { q_0: { selectedLabels: ['A'] } },
		});
		assert.deepStrictEqual(result, { ok: true });

		transport.respondQuestionResult = { ok: false, message: 'expired' };
		const failed = await service.respondQuestion({
			sessionId: 'sess-1',
			questionId: '',
			customText: 'other',
		});
		assert.deepStrictEqual(failed, { ok: false, message: 'expired' });
		assert.strictEqual(transport.respondQuestionCalls[1]?.questionId, '');
		assert.strictEqual(transport.respondQuestionCalls[1]?.customText, 'other');
		service.dispose();
	});

	test('queue mutations forward request and map result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const enqueued = await service.enqueueQueueItem({ sessionId: 'sess-1', text: 'later', priority: 'HIGH', opId: 'op-1' });
		assert.deepStrictEqual(transport.enqueueCalls, [{ sessionId: 'sess-1', text: 'later', priority: 'HIGH', opId: 'op-1' }]);
		assert.deepStrictEqual(enqueued, { ok: true });

		await service.pauseQueue({ sessionId: 'sess-1' });
		await service.resumeQueue({ sessionId: 'sess-1' });
		await service.clearQueue({ sessionId: 'sess-1' });
		await service.holdQueueItem({ sessionId: 'sess-1', itemId: 'q-1', reason: 'EDITING' });
		await service.releaseQueueItemHold({ sessionId: 'sess-1', itemId: 'q-1' });
		await service.editQueueItem({ sessionId: 'sess-1', itemId: 'q-1', text: 'edited' });
		assert.deepStrictEqual(transport.pauseCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(transport.resumeCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(transport.clearCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(transport.holdCalls, [{ sessionId: 'sess-1', itemId: 'q-1', reason: 'EDITING' }]);
		assert.deepStrictEqual(transport.releaseHoldCalls, [{ sessionId: 'sess-1', itemId: 'q-1' }]);
		assert.deepStrictEqual(transport.editCalls, [{ sessionId: 'sess-1', itemId: 'q-1', text: 'edited' }]);

		transport.queueResult = { ok: false, error: 'busy' };
		const failed = await service.pauseQueue({ sessionId: 'sess-1' });
		assert.deepStrictEqual(failed, { ok: false, error: 'busy' });
		service.dispose();
	});

	test('insertQueueItem forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-new' };
		const result = await service.insertQueueItem({
			sessionId: 'sess-1',
			opId: 'op-1',
			clientMessageId: 'c-1',
			text: 'insert me',
			priority: 'HIGH',
			beforeItemId: 'q-2',
		});
		assert.deepStrictEqual(transport.insertCalls, [{
			sessionId: 'sess-1',
			opId: 'op-1',
			clientMessageId: 'c-1',
			text: 'insert me',
			priority: 'HIGH',
			beforeItemId: 'q-2',
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.insertQueueItem({
			sessionId: '',
			opId: '',
			clientMessageId: '',
			text: '',
			beforeItemId: '',
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.insertCalls[1]?.sessionId, '');
		assert.strictEqual(transport.insertCalls[1]?.opId, '');
		assert.strictEqual(transport.insertCalls[1]?.clientMessageId, '');
		assert.strictEqual(transport.insertCalls[1]?.beforeItemId, '');
		service.dispose();
	});

	test('reorderQueue forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-2' };
		const result = await service.reorderQueue({
			sessionId: 'sess-1',
			opId: 'op-1',
			itemIds: ['q-2', 'q-1'],
		});
		assert.deepStrictEqual(transport.reorderCalls, [{
			sessionId: 'sess-1',
			opId: 'op-1',
			itemIds: ['q-2', 'q-1'],
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.reorderQueue({
			sessionId: '',
			opId: '',
			itemIds: ['', ''],
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.reorderCalls[1]?.sessionId, '');
		assert.strictEqual(transport.reorderCalls[1]?.opId, '');
		assert.deepStrictEqual(transport.reorderCalls[1]?.itemIds, ['', '']);
		service.dispose();
	});

	test('deleteQueueItem forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-1' };
		const result = await service.deleteQueueItem({
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		});
		assert.deepStrictEqual(transport.deleteCalls, [{
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.deleteQueueItem({
			sessionId: '',
			itemId: '',
			opId: '',
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.deleteCalls[1]?.sessionId, '');
		assert.strictEqual(transport.deleteCalls[1]?.itemId, '');
		assert.strictEqual(transport.deleteCalls[1]?.opId, '');
		service.dispose();
	});

	test('retryQueueItem forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-1' };
		const result = await service.retryQueueItem({
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		});
		assert.deepStrictEqual(transport.retryCalls, [{
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.retryQueueItem({
			sessionId: '',
			itemId: '',
			opId: '',
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.retryCalls[1]?.sessionId, '');
		assert.strictEqual(transport.retryCalls[1]?.itemId, '');
		assert.strictEqual(transport.retryCalls[1]?.opId, '');
		service.dispose();
	});

	test('retryAllFailed forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1' };
		const result = await service.retryAllFailed({
			sessionId: 'sess-1',
			opId: 'op-1',
		});
		assert.deepStrictEqual(transport.retryAllFailedCalls, [{
			sessionId: 'sess-1',
			opId: 'op-1',
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.retryAllFailed({
			sessionId: '',
			opId: '',
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.retryAllFailedCalls[1]?.sessionId, '');
		assert.strictEqual(transport.retryAllFailedCalls[1]?.opId, '');
		service.dispose();
	});

	test('retryQueueItemUpload forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-1' };
		const result = await service.retryQueueItemUpload({
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		});
		assert.deepStrictEqual(transport.retryQueueItemUploadCalls, [{
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.retryQueueItemUpload({
			sessionId: '',
			itemId: '',
			opId: '',
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.retryQueueItemUploadCalls[1]?.sessionId, '');
		assert.strictEqual(transport.retryQueueItemUploadCalls[1]?.itemId, '');
		assert.strictEqual(transport.retryQueueItemUploadCalls[1]?.opId, '');
		service.dispose();
	});

	test('pinQueueItem forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-1' };
		const result = await service.pinQueueItem({
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		});
		assert.deepStrictEqual(transport.pinCalls, [{
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.pinQueueItem({
			sessionId: '',
			itemId: '',
			opId: '',
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.pinCalls[1]?.sessionId, '');
		assert.strictEqual(transport.pinCalls[1]?.itemId, '');
		assert.strictEqual(transport.pinCalls[1]?.opId, '');
		service.dispose();
	});

	test('setQueueItemLocked forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-1' };
		const result = await service.setQueueItemLocked({
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
			locked: true,
		});
		assert.deepStrictEqual(transport.setQueueItemLockedCalls, [{
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
			locked: true,
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.setQueueItemLocked({
			sessionId: '',
			itemId: '',
			opId: '',
			locked: false,
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.setQueueItemLockedCalls[1]?.sessionId, '');
		assert.strictEqual(transport.setQueueItemLockedCalls[1]?.itemId, '');
		assert.strictEqual(transport.setQueueItemLockedCalls[1]?.opId, '');
		assert.strictEqual(transport.setQueueItemLockedCalls[1]?.locked, false);
		service.dispose();
	});

	test('injectQueueItem forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-1' };
		const result = await service.injectQueueItem({
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		});
		assert.deepStrictEqual(transport.injectCalls, [{
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.injectQueueItem({
			sessionId: '',
			itemId: '',
			opId: '',
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.injectCalls[1]?.sessionId, '');
		assert.strictEqual(transport.injectCalls[1]?.itemId, '');
		assert.strictEqual(transport.injectCalls[1]?.opId, '');
		service.dispose();
	});

	test('setQueueItemForkAnchor forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.queueResult = { ok: true, opId: 'op-1', itemId: 'q-1' };
		const result = await service.setQueueItemForkAnchor({
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
			forkFromTurnId: 'turn-1',
			forkFromPreview: 'hello',
		});
		assert.deepStrictEqual(transport.setQueueItemForkAnchorCalls, [{
			sessionId: 'sess-1',
			itemId: 'q-1',
			opId: 'op-1',
			forkFromTurnId: 'turn-1',
			forkFromPreview: 'hello',
		}]);
		assert.deepStrictEqual(result, transport.queueResult);

		transport.queueResult = { ok: false, error: 'empty' };
		const empty = await service.setQueueItemForkAnchor({
			sessionId: '',
			itemId: '',
			opId: '',
			forkFromTurnId: '',
			forkFromPreview: '',
		});
		assert.deepStrictEqual(empty, transport.queueResult);
		assert.strictEqual(transport.setQueueItemForkAnchorCalls[1]?.sessionId, '');
		assert.strictEqual(transport.setQueueItemForkAnchorCalls[1]?.itemId, '');
		assert.strictEqual(transport.setQueueItemForkAnchorCalls[1]?.opId, '');
		assert.strictEqual(transport.setQueueItemForkAnchorCalls[1]?.forkFromTurnId, '');
		assert.strictEqual(transport.setQueueItemForkAnchorCalls[1]?.forkFromPreview, '');
		service.dispose();
	});

	test('chatSync forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.chatSyncResult = {
			sessionId: 'sess-1',
			agentId: 'root',
			text: 'ok',
			stopReason: 'end',
			inputTokens: 1,
			outputTokens: 2,
			turnCount: 1,
			toolResults: [],
			error: '',
			inputDeliveryEvents: [],
		};
		const result = await service.chatSync({
			sessionId: 'sess-1',
			agentId: 'root',
			idempotencyKey: 'idemp-1',
			lastKnownMessageIds: ['m-1'],
			sessionInput: { messageId: 'm-new', text: 'hi' },
		});
		assert.deepStrictEqual(transport.chatSyncCalls, [{
			sessionId: 'sess-1',
			agentId: 'root',
			idempotencyKey: 'idemp-1',
			lastKnownMessageIds: ['m-1'],
			sessionInput: { messageId: 'm-new', text: 'hi' },
		}]);
		assert.deepStrictEqual(result, transport.chatSyncResult);

		transport.chatSyncResult = {
			sessionId: '',
			agentId: '',
			text: '',
			stopReason: '',
			inputTokens: 0,
			outputTokens: 0,
			turnCount: 0,
			toolResults: [],
			error: 'empty',
			inputDeliveryEvents: [],
		};
		const empty = await service.chatSync({
			sessionId: '',
			agentId: '',
			idempotencyKey: '',
			lastKnownMessageIds: [''],
			sessionInput: { messageId: '', text: '' },
		});
		assert.deepStrictEqual(empty, transport.chatSyncResult);
		assert.strictEqual(transport.chatSyncCalls[1]?.sessionId, '');
		assert.strictEqual(transport.chatSyncCalls[1]?.agentId, '');
		assert.strictEqual(transport.chatSyncCalls[1]?.idempotencyKey, '');
		assert.deepStrictEqual(transport.chatSyncCalls[1]?.lastKnownMessageIds, ['']);
		assert.strictEqual(transport.chatSyncCalls[1]?.sessionInput?.messageId, '');
		service.dispose();
	});

	test('syncInputDelivery forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.syncInputDeliveryResult = {
			inputDeliveryEvents: [{
				messageId: 'm-1',
				status: 1,
				errorCode: '',
				errorMessage: '',
			}],
		};
		const result = await service.syncInputDelivery({
			sessionId: 'sess-1',
			lastKnownMessageIds: ['m-1'],
		});
		assert.deepStrictEqual(transport.syncInputDeliveryCalls, [{
			sessionId: 'sess-1',
			lastKnownMessageIds: ['m-1'],
		}]);
		assert.deepStrictEqual(result, transport.syncInputDeliveryResult);

		transport.syncInputDeliveryResult = {
			inputDeliveryEvents: [],
		};
		const empty = await service.syncInputDelivery({
			sessionId: '',
			lastKnownMessageIds: [''],
		});
		assert.deepStrictEqual(empty, transport.syncInputDeliveryResult);
		assert.strictEqual(transport.syncInputDeliveryCalls[1]?.sessionId, '');
		assert.deepStrictEqual(transport.syncInputDeliveryCalls[1]?.lastKnownMessageIds, ['']);
		service.dispose();
	});

	test('installSessionDemoFake forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.installSessionDemoFakeResult = { ok: true, message: 'ok', reasonCode: 'OK' };
		const queuesPayload = new Uint8Array([1, 2, 3]);
		const result = await service.installSessionDemoFake({
			sessionId: 'sess-1',
			queuesPayload,
			contentType: 'application/vnd.universe.scripted-queues.v1+json',
			playbookId: 'pb-1',
		});
		assert.deepStrictEqual(transport.installSessionDemoFakeCalls, [{
			sessionId: 'sess-1',
			queuesPayload,
			contentType: 'application/vnd.universe.scripted-queues.v1+json',
			playbookId: 'pb-1',
		}]);
		assert.deepStrictEqual(result, transport.installSessionDemoFakeResult);

		transport.installSessionDemoFakeResult = { ok: false, message: 'empty', reasonCode: 'INVALID_PAYLOAD' };
		const emptyPayload = new Uint8Array(0);
		const empty = await service.installSessionDemoFake({
			sessionId: '',
			queuesPayload: emptyPayload,
			contentType: '',
			playbookId: '',
		});
		assert.deepStrictEqual(empty, transport.installSessionDemoFakeResult);
		assert.strictEqual(transport.installSessionDemoFakeCalls[1]?.sessionId, '');
		assert.deepStrictEqual(transport.installSessionDemoFakeCalls[1]?.queuesPayload, emptyPayload);
		assert.strictEqual(transport.installSessionDemoFakeCalls[1]?.contentType, '');
		assert.strictEqual(transport.installSessionDemoFakeCalls[1]?.playbookId, '');
		service.dispose();
	});

	test('clearSessionDemoFake forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.clearSessionDemoFakeResult = { ok: true, message: 'ok', reasonCode: 'OK' };
		const result = await service.clearSessionDemoFake({
			sessionId: 'sess-1',
		});
		assert.deepStrictEqual(transport.clearSessionDemoFakeCalls, [{
			sessionId: 'sess-1',
		}]);
		assert.deepStrictEqual(result, transport.clearSessionDemoFakeResult);

		transport.clearSessionDemoFakeResult = { ok: false, message: 'empty', reasonCode: 'NOT_INSTALLED' };
		const empty = await service.clearSessionDemoFake({
			sessionId: '',
		});
		assert.deepStrictEqual(empty, transport.clearSessionDemoFakeResult);
		assert.strictEqual(transport.clearSessionDemoFakeCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('forkAgent forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.forkAgent({ sessionId: 'sess-1', name: 'reviewer', task: 'Review the diff' });
		assert.deepStrictEqual(transport.forkCalls, [{ sessionId: 'sess-1', name: 'reviewer', task: 'Review the diff' }]);
		assert.deepStrictEqual(result, { ok: true, agentId: 'sub:reviewer' });

		transport.forkResult = { ok: false };
		const failedFork = await service.forkAgent({ sessionId: 'sess-2', parentAgentId: 'sub:a' });
		assert.deepStrictEqual(failedFork, { ok: false });
		assert.strictEqual((transport.forkCalls as readonly UniverseAgentForkAgentRequest[])[1]?.parentAgentId, 'sub:a');
		service.dispose();
	});

	test('getToolInfo forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.getToolInfo({ toolName: 'bash' });
		assert.deepStrictEqual(transport.toolInfoCalls, [{ toolName: 'bash' }]);
		assert.deepStrictEqual(result, {
			name: 'bash',
			description: 'Run a command',
			category: 'shell',
			inputSchemaJson: '{"type":"object"}',
			destructive: true,
			requiresPermission: true,
			aliases: ['sh'],
		});

		transport.toolInfoResult = { name: '', aliases: [] };
		const missing = await service.getToolInfo({ toolName: 'missing' });
		assert.deepStrictEqual(missing, { name: '', aliases: [] });
		assert.strictEqual(transport.toolInfoCalls[1]?.toolName, 'missing');
		service.dispose();
	});

	test('killAgent forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.killAgent({ sessionId: 'sess-1', agentId: 'sub:reviewer', force: true });
		assert.deepStrictEqual(transport.killCalls, [{ sessionId: 'sess-1', agentId: 'sub:reviewer', force: true }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.killResult = { ok: false, message: 'not found' };
		const failedKill = await service.killAgent({ sessionId: 'sess-2', agentId: '' });
		assert.deepStrictEqual(failedKill, { ok: false, message: 'not found' });
		assert.strictEqual(transport.killCalls[1]?.agentId, '');
		service.dispose();
	});

	test('deleteMessage forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.deleteMessage({ sessionId: 'sess-1', turnId: 'turn-1', agentId: 'sub:a' });
		assert.deepStrictEqual(transport.deleteMessageCalls, [{ sessionId: 'sess-1', turnId: 'turn-1', agentId: 'sub:a' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.deleteMessageResult = { ok: false, message: 'not found' };
		const failed = await service.deleteMessage({ sessionId: 'sess-2', turnId: 'turn-2' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not found' });
		assert.strictEqual(transport.deleteMessageCalls[1]?.turnId, 'turn-2');
		service.dispose();
	});

	test('editMessage forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.editMessage({ sessionId: 'sess-1', turnId: 'turn-1', newContent: 'later', agentId: 'sub:a' });
		assert.deepStrictEqual(transport.editMessageCalls, [{ sessionId: 'sess-1', turnId: 'turn-1', newContent: 'later', agentId: 'sub:a' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.editMessageResult = { ok: false, message: 'not found' };
		const failed = await service.editMessage({ sessionId: 'sess-2', turnId: 'turn-2', newContent: 'nope' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not found' });
		assert.strictEqual(transport.editMessageCalls[1]?.turnId, 'turn-2');
		service.dispose();
	});

	test('sendClientToolResponse forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.sendClientToolResponse({
			sessionId: 'sess-1',
			callId: 'call-1',
			content: '{"ok":true}',
		});
		assert.deepStrictEqual([...transport.sendClientToolResponseCalls], [{
			sessionId: 'sess-1',
			callId: 'call-1',
			content: '{"ok":true}',
		}]);
		assert.deepStrictEqual(result, { ok: true });

		transport.sendClientToolResponseResult = { ok: false, message: 'expired' };
		const failed = await service.sendClientToolResponse({
			sessionId: 'sess-1',
			callId: '',
			isError: true,
			metadataJson: '{"note":"fail"}',
			canvasRefs: [{ canvasId: 'c1', revisionId: 'r1', title: 'Board' }],
		});
		assert.deepStrictEqual(failed, { ok: false, message: 'expired' });
		const second: UniverseAgentSendClientToolResponseRequest | undefined = transport.sendClientToolResponseCalls[1];
		assert.strictEqual(second?.callId, '');
		assert.strictEqual(second?.isError, true);
		assert.strictEqual(second?.metadataJson, '{"note":"fail"}');
		assert.deepStrictEqual(second?.canvasRefs, [{ canvasId: 'c1', revisionId: 'r1', title: 'Board' }]);
		service.dispose();
	});

	test('listSnapshots forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listSnapshotsResult = {
			snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', turnCount: 3 }],
		};
		const result = await service.listSnapshots({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.listSnapshotsCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, {
			snapshots: [{ id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', turnCount: 3 }],
		});

		transport.listSnapshotsResult = { snapshots: [] };
		const empty = await service.listSnapshots({ sessionId: '' });
		assert.deepStrictEqual(empty, { snapshots: [] });
		assert.strictEqual(transport.listSnapshotsCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('listLoopSnapshots forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listLoopSnapshotsResult = {
			snapshots: [{
				timestamp: 1_700_000_000,
				turnId: 'turn-1',
				loopId: 'loop-1',
				iteration: 2,
				maxIterations: 8,
				goal: 'finish',
				exitCondition: 'done',
				tmpFileRelativePath: 'tmp/loop.md',
				isExit: false,
			}],
		};
		const result = await service.listLoopSnapshots({ sessionId: 'sess-1', loopId: 'loop-1' });
		assert.deepStrictEqual(transport.listLoopSnapshotsCalls, [{ sessionId: 'sess-1', loopId: 'loop-1' }]);
		assert.deepStrictEqual(result, {
			snapshots: [{
				timestamp: 1_700_000_000,
				turnId: 'turn-1',
				loopId: 'loop-1',
				iteration: 2,
				maxIterations: 8,
				goal: 'finish',
				exitCondition: 'done',
				tmpFileRelativePath: 'tmp/loop.md',
				isExit: false,
			}],
		});

		transport.listLoopSnapshotsResult = { snapshots: [] };
		const empty = await service.listLoopSnapshots({ sessionId: '', loopId: '' });
		assert.deepStrictEqual(empty, { snapshots: [] });
		assert.strictEqual(transport.listLoopSnapshotsCalls[1]?.sessionId, '');
		assert.strictEqual(transport.listLoopSnapshotsCalls[1]?.loopId, '');
		service.dispose();
	});

	test('createSnapshot forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.createSnapshotResult = {
			ok: true,
			snapshot: { id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', description: 'note' },
		};
		const result = await service.createSnapshot({
			sessionId: 'sess-1',
			title: 'Before refactor',
			description: 'note',
		});
		assert.deepStrictEqual(transport.createSnapshotCalls, [{
			sessionId: 'sess-1',
			title: 'Before refactor',
			description: 'note',
		}]);
		assert.deepStrictEqual(result, {
			ok: true,
			snapshot: { id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', description: 'note' },
		});

		transport.createSnapshotResult = { ok: false, message: 'denied' };
		const failed = await service.createSnapshot({ sessionId: '', title: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'denied' });
		assert.strictEqual(transport.createSnapshotCalls[1]?.sessionId, '');
		assert.strictEqual(transport.createSnapshotCalls[1]?.title, '');
		service.dispose();
	});

	test('createSnapshot forwards turnCount snapshot and empty-title failure', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.createSnapshotResult = {
			ok: true,
			snapshot: { id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', turnCount: 3 },
		};
		const result = await service.createSnapshot({ sessionId: 'sess-1', title: 'Before refactor', description: 'checkpoint' });
		assert.deepStrictEqual(transport.createSnapshotCalls, [{ sessionId: 'sess-1', title: 'Before refactor', description: 'checkpoint' }]);
		assert.deepStrictEqual(result, {
			ok: true,
			snapshot: { id: 'snap-1', sessionId: 'sess-1', title: 'Before refactor', turnCount: 3 },
		});

		transport.createSnapshotResult = { ok: false, message: 'empty title' };
		const failed = await service.createSnapshot({ sessionId: '', title: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'empty title' });
		assert.strictEqual(transport.createSnapshotCalls[1]?.sessionId, '');
		assert.strictEqual(transport.createSnapshotCalls[1]?.title, '');
		service.dispose();
	});

	test('restoreSnapshot forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.restoreSnapshotResult = { ok: true };
		const result = await service.restoreSnapshot({ sessionId: 'sess-1', snapshotId: 'snap-1' });
		assert.deepStrictEqual(transport.restoreSnapshotCalls, [{ sessionId: 'sess-1', snapshotId: 'snap-1' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.restoreSnapshotResult = { ok: false, message: 'denied' };
		const failed = await service.restoreSnapshot({ sessionId: '', snapshotId: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'denied' });
		assert.strictEqual(transport.restoreSnapshotCalls[1]?.sessionId, '');
		assert.strictEqual(transport.restoreSnapshotCalls[1]?.snapshotId, '');
		service.dispose();
	});

	test('getSessionInfo forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getSessionInfoResult = {
			sessionId: 'sess-1',
			rootAgent: {
				agentId: 'root',
				name: 'Root',
				type: 'AGENT_TYPE_UNKNOWN',
				status: 'AGENT_STATUS_UNKNOWN',
				model: 'gpt',
				turnCount: 2,
				createdAt: 10,
				children: [],
			},
			createdAt: 100,
			lastAccessedAt: 200,
			provider: 'openai',
			model: 'gpt',
		};
		const result = await service.getSessionInfo({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.getSessionInfoCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, transport.getSessionInfoResult);

		transport.getSessionInfoResult = {
			sessionId: '',
			createdAt: 0,
			lastAccessedAt: 0,
			provider: '',
			model: '',
		};
		const empty = await service.getSessionInfo({ sessionId: '' });
		assert.deepStrictEqual(empty, transport.getSessionInfoResult);
		assert.strictEqual(transport.getSessionInfoCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('getSessionRules forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getSessionRulesResult = {
			rules: [{
				id: 'rule-1',
				toolName: 'bash',
				scope: 'session',
				action: 'ALLOW',
				reason: 'user',
				createdAt: 1,
				expiresAt: 2,
				source: 'USER_INTERACTIVE',
			}],
		};
		const result = await service.getSessionRules({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.getSessionRulesCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, transport.getSessionRulesResult);

		transport.getSessionRulesResult = { rules: [] };
		const empty = await service.getSessionRules({ sessionId: '' });
		assert.deepStrictEqual(empty, { rules: [] });
		assert.strictEqual(transport.getSessionRulesCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('setPermissionMode forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.setPermissionModeResult = { ok: true };
		const result = await service.setPermissionMode({
			sessionId: 'sess-1',
			mode: 'SESSION_TOOL_PERMISSION_MODE_ASK',
		});
		assert.deepStrictEqual(transport.setPermissionModeCalls, [{
			sessionId: 'sess-1',
			mode: 'SESSION_TOOL_PERMISSION_MODE_ASK',
		}]);
		assert.deepStrictEqual(result, { ok: true });

		transport.setPermissionModeResult = { ok: false, message: 'denied' };
		const empty = await service.setPermissionMode({
			sessionId: '',
			mode: 'SESSION_TOOL_PERMISSION_MODE_UNSPECIFIED',
		});
		assert.deepStrictEqual(empty, { ok: false, message: 'denied' });
		assert.strictEqual(transport.setPermissionModeCalls[1]?.sessionId, '');
		assert.strictEqual(transport.setPermissionModeCalls[1]?.mode, 'SESSION_TOOL_PERMISSION_MODE_UNSPECIFIED');
		service.dispose();
	});

	test('taskUpdate forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.taskUpdateResult = { ok: true, message: 'updated' };
		const result = await service.taskUpdate({
			sessionId: 'sess-1',
			agentId: 'agent-1',
			taskId: 'task-1',
			newStatus: 'COMPLETED',
			message: 'done',
		});
		assert.deepStrictEqual(transport.taskUpdateCalls, [{
			sessionId: 'sess-1',
			agentId: 'agent-1',
			taskId: 'task-1',
			newStatus: 'COMPLETED',
			message: 'done',
		}]);
		assert.deepStrictEqual(result, { ok: true, message: 'updated' });

		transport.taskUpdateResult = { ok: false, message: '' };
		const empty = await service.taskUpdate({
			sessionId: '',
			agentId: '',
			taskId: '',
			newStatus: '',
			message: '',
		});
		assert.deepStrictEqual(empty, { ok: false, message: '' });
		assert.strictEqual(transport.taskUpdateCalls[1]?.sessionId, '');
		assert.strictEqual(transport.taskUpdateCalls[1]?.agentId, '');
		assert.strictEqual(transport.taskUpdateCalls[1]?.taskId, '');
		assert.strictEqual(transport.taskUpdateCalls[1]?.newStatus, '');
		assert.strictEqual(transport.taskUpdateCalls[1]?.message, '');
		service.dispose();
	});

	test('taskCancel forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.taskCancelResult = { ok: true, message: 'cancelled' };
		const result = await service.taskCancel({
			sessionId: 'sess-1',
			agentId: 'agent-1',
			taskId: 'task-1',
		});
		assert.deepStrictEqual(transport.taskCancelCalls, [{
			sessionId: 'sess-1',
			agentId: 'agent-1',
			taskId: 'task-1',
		}]);
		assert.deepStrictEqual(result, { ok: true, message: 'cancelled' });

		transport.taskCancelResult = { ok: false, message: '' };
		const empty = await service.taskCancel({
			sessionId: '',
			agentId: '',
			taskId: '',
		});
		assert.deepStrictEqual(empty, { ok: false, message: '' });
		assert.strictEqual(transport.taskCancelCalls[1]?.sessionId, '');
		assert.strictEqual(transport.taskCancelCalls[1]?.agentId, '');
		assert.strictEqual(transport.taskCancelCalls[1]?.taskId, '');
		service.dispose();
	});

	test('messageMember forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.messageMemberResult = { ok: true, message: 'delivered' };
		const result = await service.messageMember({
			sessionId: 'sess-1',
			agentId: 'agent-1',
			memberName: 'worker',
			content: 'hello',
		});
		assert.deepStrictEqual(transport.messageMemberCalls, [{
			sessionId: 'sess-1',
			agentId: 'agent-1',
			memberName: 'worker',
			content: 'hello',
		}]);
		assert.deepStrictEqual(result, { ok: true, message: 'delivered' });

		transport.messageMemberResult = { ok: false, message: '' };
		const empty = await service.messageMember({
			sessionId: '',
			agentId: '',
			memberName: '',
			content: '',
		});
		assert.deepStrictEqual(empty, { ok: false, message: '' });
		assert.strictEqual(transport.messageMemberCalls[1]?.sessionId, '');
		assert.strictEqual(transport.messageMemberCalls[1]?.agentId, '');
		assert.strictEqual(transport.messageMemberCalls[1]?.memberName, '');
		assert.strictEqual(transport.messageMemberCalls[1]?.content, '');
		service.dispose();
	});

	test('createTeam forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.createTeamResult = { teamId: 7, memberCount: 3 };
		const result = await service.createTeam({
			sessionId: 'sess-1',
			agentId: 'agent-1',
			taskDescriptions: ['write tests', 'review'],
		});
		assert.deepStrictEqual(transport.createTeamCalls, [{
			sessionId: 'sess-1',
			agentId: 'agent-1',
			taskDescriptions: ['write tests', 'review'],
		}]);
		assert.deepStrictEqual(result, { teamId: 7, memberCount: 3 });

		transport.createTeamResult = { teamId: 0, memberCount: 0 };
		const empty = await service.createTeam({
			sessionId: '',
			agentId: '',
			taskDescriptions: ['', ''],
		});
		assert.deepStrictEqual(empty, { teamId: 0, memberCount: 0 });
		assert.strictEqual(transport.createTeamCalls[1]?.sessionId, '');
		assert.strictEqual(transport.createTeamCalls[1]?.agentId, '');
		assert.deepStrictEqual(transport.createTeamCalls[1]?.taskDescriptions, ['', '']);
		service.dispose();
	});

	test('getConfig forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getConfigResult = { values: { 'model.id': 'fast' }, scope: 'session' };
		const result = await service.getConfig({
			key: 'model.id',
			scope: 'session',
			sessionId: 'sess-1',
		});
		assert.deepStrictEqual(transport.getConfigCalls, [{
			key: 'model.id',
			scope: 'session',
			sessionId: 'sess-1',
		}]);
		assert.deepStrictEqual(result, { values: { 'model.id': 'fast' }, scope: 'session' });

		transport.getConfigResult = { values: {}, scope: '' };
		const empty = await service.getConfig({
			key: '',
			scope: '',
			sessionId: '',
		});
		assert.deepStrictEqual(empty, { values: {}, scope: '' });
		assert.strictEqual(transport.getConfigCalls[1]?.key, '');
		assert.strictEqual(transport.getConfigCalls[1]?.scope, '');
		assert.strictEqual(transport.getConfigCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('getModelPreferences forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getModelPreferencesResult = {
			minLevel: 5,
			maxCost: 'middle',
			minSpeed: 'low',
			strategy: 'level',
		};
		const result = await service.getModelPreferences({
			sessionId: 'sess-1',
		});
		assert.deepStrictEqual(transport.getModelPreferencesCalls, [{
			sessionId: 'sess-1',
		}]);
		assert.deepStrictEqual(result, transport.getModelPreferencesResult);

		transport.getModelPreferencesResult = {
			minLevel: 0,
			maxCost: '',
			minSpeed: '',
			strategy: '',
		};
		const empty = await service.getModelPreferences({
			sessionId: '',
		});
		assert.deepStrictEqual(empty, transport.getModelPreferencesResult);
		assert.strictEqual(transport.getModelPreferencesCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('startMember forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.startMemberResult = { memberAgentId: 'member-1', memberName: 'worker', dynamic: true };
		const result = await service.startMember({
			sessionId: 'sess-1',
			agentId: 'agent-1',
			memberName: 'worker',
			presetId: 'preset-1',
			systemPrompt: 'do work',
			modelType: 'fast',
			dynamic: true,
		});
		assert.deepStrictEqual(transport.startMemberCalls, [{
			sessionId: 'sess-1',
			agentId: 'agent-1',
			memberName: 'worker',
			presetId: 'preset-1',
			systemPrompt: 'do work',
			modelType: 'fast',
			dynamic: true,
		}]);
		assert.deepStrictEqual(result, { memberAgentId: 'member-1', memberName: 'worker', dynamic: true });

		transport.startMemberResult = { memberAgentId: '', memberName: '', dynamic: false };
		const empty = await service.startMember({
			sessionId: '',
			agentId: '',
			memberName: '',
			presetId: '',
			systemPrompt: '',
			modelType: '',
			dynamic: false,
		});
		assert.deepStrictEqual(empty, { memberAgentId: '', memberName: '', dynamic: false });
		assert.strictEqual(transport.startMemberCalls[1]?.sessionId, '');
		assert.strictEqual(transport.startMemberCalls[1]?.agentId, '');
		assert.strictEqual(transport.startMemberCalls[1]?.memberName, '');
		assert.strictEqual(transport.startMemberCalls[1]?.presetId, '');
		assert.strictEqual(transport.startMemberCalls[1]?.systemPrompt, '');
		assert.strictEqual(transport.startMemberCalls[1]?.modelType, '');
		assert.strictEqual(transport.startMemberCalls[1]?.dynamic, false);
		service.dispose();
	});

	test('killMember forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.killMemberResult = { ok: true, message: 'stopped' };
		const result = await service.killMember({
			sessionId: 'sess-1',
			agentId: 'agent-1',
			memberName: 'worker',
		});
		assert.deepStrictEqual(transport.killMemberCalls, [{
			sessionId: 'sess-1',
			agentId: 'agent-1',
			memberName: 'worker',
		}]);
		assert.deepStrictEqual(result, { ok: true, message: 'stopped' });

		transport.killMemberResult = { ok: false, message: '' };
		const empty = await service.killMember({
			sessionId: '',
			agentId: '',
			memberName: '',
		});
		assert.deepStrictEqual(empty, { ok: false, message: '' });
		assert.strictEqual(transport.killMemberCalls[1]?.sessionId, '');
		assert.strictEqual(transport.killMemberCalls[1]?.agentId, '');
		assert.strictEqual(transport.killMemberCalls[1]?.memberName, '');
		service.dispose();
	});

	test('abort forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.abortResult = { ok: true, message: 'aborted', stoppedMembers: ['worker'] };
		const result = await service.abort({
			sessionId: 'sess-1',
			agentId: 'agent-1',
			teamId: 7,
			reason: 'stop',
		});
		assert.deepStrictEqual(transport.abortCalls, [{
			sessionId: 'sess-1',
			agentId: 'agent-1',
			teamId: 7,
			reason: 'stop',
		}]);
		assert.deepStrictEqual(result, { ok: true, message: 'aborted', stoppedMembers: ['worker'] });

		transport.abortResult = { ok: false, message: '', stoppedMembers: [] };
		const empty = await service.abort({
			sessionId: '',
			agentId: '',
			teamId: 0,
			reason: '',
		});
		assert.deepStrictEqual(empty, { ok: false, message: '', stoppedMembers: [] });
		assert.strictEqual(transport.abortCalls[1]?.sessionId, '');
		assert.strictEqual(transport.abortCalls[1]?.agentId, '');
		assert.strictEqual(transport.abortCalls[1]?.teamId, 0);
		assert.strictEqual(transport.abortCalls[1]?.reason, '');
		service.dispose();
	});

	test('switchModel forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.switchModelResult = {
			resolvedModelId: 'claude-sonnet',
			provider: 'anthropic',
			level: 7,
			cost: 'middle',
			speed: 'fast',
		};
		const result = await service.switchModel({
			sessionId: 'sess-1',
			agentId: 'root',
			modelType: 'quality',
			modelId: '',
		});
		assert.deepStrictEqual(transport.switchModelCalls, [{
			sessionId: 'sess-1',
			agentId: 'root',
			modelType: 'quality',
			modelId: '',
		}]);
		assert.deepStrictEqual(result, {
			resolvedModelId: 'claude-sonnet',
			provider: 'anthropic',
			level: 7,
			cost: 'middle',
			speed: 'fast',
		});

		transport.switchModelResult = {
			resolvedModelId: '',
			provider: '',
			level: 0,
			cost: '',
			speed: '',
		};
		const empty = await service.switchModel({
			sessionId: '',
			agentId: '',
			modelType: '',
			modelId: '',
		});
		assert.deepStrictEqual(empty, {
			resolvedModelId: '',
			provider: '',
			level: 0,
			cost: '',
			speed: '',
		});
		assert.strictEqual(transport.switchModelCalls[1]?.sessionId, '');
		assert.strictEqual(transport.switchModelCalls[1]?.agentId, '');
		assert.strictEqual(transport.switchModelCalls[1]?.modelType, '');
		assert.strictEqual(transport.switchModelCalls[1]?.modelId, '');
		service.dispose();
	});

	test('resolveModel forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.resolveModelResult = {
			selected: {
				id: 'claude-sonnet',
				type: 'quality',
				enabled: true,
				level: 7,
				provider: 'anthropic',
				modelId: 'claude-sonnet-4',
			},
			candidates: [{
				id: 'claude-sonnet',
				type: 'quality',
				enabled: true,
				level: 7,
				provider: 'anthropic',
				modelId: 'claude-sonnet-4',
			}],
			filtered: [{
				id: 'haiku',
				type: 'fast',
				enabled: true,
				level: 3,
				provider: 'anthropic',
				modelId: 'claude-haiku',
			}],
		};
		const result = await service.resolveModel({
			sessionId: 'sess-1',
			type: 'quality',
		});
		assert.deepStrictEqual(transport.resolveModelCalls, [{
			sessionId: 'sess-1',
			type: 'quality',
		}]);
		assert.deepStrictEqual(result, transport.resolveModelResult);

		transport.resolveModelResult = { candidates: [], filtered: [] };
		const empty = await service.resolveModel({
			sessionId: '',
			type: '',
		});
		assert.deepStrictEqual(empty, { candidates: [], filtered: [] });
		assert.strictEqual(transport.resolveModelCalls[1]?.sessionId, '');
		assert.strictEqual(transport.resolveModelCalls[1]?.type, '');
		service.dispose();
	});

	test('listCommands forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listCommandsResult = {
			commands: [{
				name: 'review',
				description: 'Review the diff',
				source: 'SLASH_COMMAND_SOURCE_SKILL',
				slashEnabled: true,
				agent: 'code',
				model: 'default',
				subtask: false,
				skillSource: 'user',
			}],
			total: 1,
		};
		const result = await service.listCommands();
		assert.strictEqual(transport.listCommandsCalls, 1);
		assert.deepStrictEqual(result, transport.listCommandsResult);

		transport.listCommandsResult = {
			commands: [{
				name: '',
				description: '',
				source: '',
				slashEnabled: false,
				agent: '',
				model: '',
				subtask: false,
				skillSource: '',
			}],
			total: 0,
		};
		const empty = await service.listCommands();
		assert.strictEqual(transport.listCommandsCalls, 2);
		assert.strictEqual(empty.commands[0]?.name, '');
		assert.strictEqual(empty.commands[0]?.agent, '');
		assert.strictEqual(empty.commands[0]?.model, '');
		assert.strictEqual(empty.commands[0]?.skillSource, '');
		assert.strictEqual(empty.commands[0]?.source, '');
		assert.strictEqual(empty.total, 0);
		service.dispose();
	});

	test('getCommandDef forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getCommandDefResult = {
			name: 'review',
			description: 'Review the diff',
			source: 'SLASH_COMMAND_SOURCE_SKILL',
			template: 'Review $ARGUMENTS',
			agent: 'code',
			model: 'default',
			subtask: false,
			mcpServerId: 'mcp-1',
			mcpPromptName: 'review',
			mcpArgumentNames: ['path'],
			skillSource: 'user',
		};
		const result = await service.getCommandDef({ commandName: 'review' });
		assert.deepStrictEqual(transport.getCommandDefCalls, [{ commandName: 'review' }]);
		assert.deepStrictEqual(result, transport.getCommandDefResult);

		transport.getCommandDefResult = {
			name: '',
			description: '',
			source: '',
			template: '',
			agent: '',
			model: '',
			subtask: false,
			mcpServerId: '',
			mcpPromptName: '',
			mcpArgumentNames: [],
			skillSource: '',
		};
		const empty = await service.getCommandDef({ commandName: '' });
		assert.strictEqual(transport.getCommandDefCalls[1]?.commandName, '');
		assert.strictEqual(empty.name, '');
		assert.strictEqual(empty.agent, '');
		assert.strictEqual(empty.model, '');
		assert.strictEqual(empty.template, '');
		assert.strictEqual(empty.mcpServerId, '');
		assert.strictEqual(empty.mcpPromptName, '');
		assert.strictEqual(empty.skillSource, '');
		assert.strictEqual(empty.source, '');
		assert.deepStrictEqual(empty.mcpArgumentNames, []);
		service.dispose();
	});

	test('listFiles forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listFilesResult = {
			entries: [{
				name: 'readme.md',
				path: 'docs/readme.md',
				isDirectory: false,
				size: 128,
				lastModified: 1_700_000_000,
				mimeType: 'text/markdown',
			}],
			total: 1,
		};
		const result = await service.listFiles({
			path: 'docs',
			sessionId: 's1',
			recursive: true,
			pattern: '*.md',
			maxResults: 50,
		});
		assert.deepStrictEqual(transport.listFilesCalls, [{
			path: 'docs',
			sessionId: 's1',
			recursive: true,
			pattern: '*.md',
			maxResults: 50,
		}]);
		assert.deepStrictEqual(result, transport.listFilesResult);

		transport.listFilesResult = {
			entries: [{
				name: '',
				path: '',
				isDirectory: false,
				size: 0,
				lastModified: 0,
				mimeType: '',
			}],
			total: 0,
		};
		const empty = await service.listFiles({
			path: '',
			sessionId: '',
			recursive: false,
			pattern: '',
			maxResults: 0,
		});
		assert.strictEqual(transport.listFilesCalls[1]?.path, '');
		assert.strictEqual(transport.listFilesCalls[1]?.sessionId, '');
		assert.strictEqual(transport.listFilesCalls[1]?.pattern, '');
		assert.strictEqual(transport.listFilesCalls[1]?.recursive, false);
		assert.strictEqual(transport.listFilesCalls[1]?.maxResults, 0);
		assert.strictEqual(empty.entries[0]?.name, '');
		assert.strictEqual(empty.entries[0]?.path, '');
		assert.strictEqual(empty.entries[0]?.mimeType, '');
		assert.strictEqual(empty.total, 0);
		service.dispose();
	});

	test('readFile forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.readFileResult = {
			content: new Uint8Array([97, 98, 99]),
			totalSize: 3,
			mimeType: 'text/plain',
			lineCount: 1,
			contentHash: 'abc',
		};
		const request = { path: 'src/foo.ts', sessionId: 'sess-1', startLine: 1, endLine: 10, maxBytes: 1024 };
		const result = await service.readFile(request);
		assert.deepStrictEqual(transport.readFileCalls, [request]);
		assert.deepStrictEqual(result, transport.readFileResult);

		transport.readFileResult = {
			content: new Uint8Array(0),
			totalSize: 0,
			mimeType: '',
			lineCount: 0,
			contentHash: '',
		};
		const emptyRequest = { path: '', sessionId: '', startLine: 0, endLine: 0, maxBytes: 0 };
		const empty = await service.readFile(emptyRequest);
		assert.strictEqual(transport.readFileCalls[1]?.path, '');
		assert.strictEqual(transport.readFileCalls[1]?.sessionId, '');
		assert.strictEqual(transport.readFileCalls[1]?.startLine, 0);
		assert.strictEqual(transport.readFileCalls[1]?.endLine, 0);
		assert.strictEqual(transport.readFileCalls[1]?.maxBytes, 0);
		assert.deepStrictEqual(empty.content, new Uint8Array(0));
		assert.strictEqual(empty.mimeType, '');
		assert.strictEqual(empty.contentHash, '');
		service.dispose();
	});

	test('getFileInfo forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getFileInfoResult = {
			file: {
				name: 'readme.md',
				path: 'docs/readme.md',
				isDirectory: false,
				size: 128,
				lastModified: 1_700_000_000,
				mimeType: 'text/markdown',
			},
		};
		const request = { path: 'docs/readme.md', sessionId: 'sess-1' };
		const result = await service.getFileInfo(request);
		assert.deepStrictEqual(transport.getFileInfoCalls, [request]);
		assert.deepStrictEqual(result, transport.getFileInfoResult);

		transport.getFileInfoResult = {
			file: {
				name: '',
				path: '',
				isDirectory: false,
				size: 0,
				lastModified: 0,
				mimeType: '',
			},
		};
		const emptyRequest = { path: '', sessionId: '' };
		const empty = await service.getFileInfo(emptyRequest);
		assert.strictEqual(transport.getFileInfoCalls[1]?.path, '');
		assert.strictEqual(transport.getFileInfoCalls[1]?.sessionId, '');
		assert.strictEqual(empty.file.name, '');
		assert.strictEqual(empty.file.path, '');
		assert.strictEqual(empty.file.mimeType, '');
		assert.strictEqual(empty.file.isDirectory, false);
		assert.strictEqual(empty.file.size, 0);
		assert.strictEqual(empty.file.lastModified, 0);
		service.dispose();
	});

	test('writeFile forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.writeFileResult = {
			status: 'SAVED',
			newHash: 'hash-1',
			size: 3,
			modifiedAt: 100,
			currentContent: new Uint8Array([97, 98, 99]),
			currentHash: 'hash-1',
			mergedContent: new Uint8Array(0),
		};
		const writeRequest = {
			path: 'src/foo.ts',
			content: new Uint8Array([97, 98, 99]),
			baseHash: 'base-1',
			sessionId: 'sess-1',
			baseContent: new Uint8Array([97]),
		};
		const writeResult = await service.writeFile(writeRequest);
		assert.deepStrictEqual(transport.writeFileCalls, [writeRequest]);
		assert.deepStrictEqual(writeResult, transport.writeFileResult);

		transport.writeFileResult = {
			status: 'SAVED',
			newHash: '',
			size: 0,
			modifiedAt: 0,
			currentContent: new Uint8Array(0),
			currentHash: '',
			mergedContent: new Uint8Array(0),
		};
		const writeEmptyRequest = {
			path: '',
			content: new Uint8Array(0),
			baseHash: '',
			sessionId: '',
			baseContent: new Uint8Array(0),
		};
		const writeEmpty = await service.writeFile(writeEmptyRequest);
		assert.strictEqual(transport.writeFileCalls[1]?.path, '');
		assert.strictEqual(transport.writeFileCalls[1]?.sessionId, '');
		assert.strictEqual(transport.writeFileCalls[1]?.baseHash, '');
		assert.deepStrictEqual(transport.writeFileCalls[1]?.content, new Uint8Array(0));
		assert.deepStrictEqual(transport.writeFileCalls[1]?.baseContent, new Uint8Array(0));
		assert.strictEqual(writeEmpty.status, 'SAVED');
		assert.strictEqual(writeEmpty.newHash, '');
		assert.strictEqual(writeEmpty.currentHash, '');
		assert.deepStrictEqual(writeEmpty.currentContent, new Uint8Array(0));
		assert.deepStrictEqual(writeEmpty.mergedContent, new Uint8Array(0));
		service.dispose();
	});

	test('forceWriteFile forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.forceWriteFileResult = {
			status: 'SAVED',
			newHash: 'hash-1',
			size: 3,
			modifiedAt: 100,
			currentContent: new Uint8Array([97, 98, 99]),
			currentHash: 'hash-1',
			mergedContent: new Uint8Array(0),
		};
		const forceRequest = {
			path: 'src/foo.ts',
			content: new Uint8Array([97, 98, 99]),
			sessionId: 'sess-1',
		};
		const forceResult = await service.forceWriteFile(forceRequest);
		assert.deepStrictEqual(transport.forceWriteFileCalls, [forceRequest]);
		assert.deepStrictEqual(forceResult, transport.forceWriteFileResult);

		transport.forceWriteFileResult = {
			status: 'SAVED',
			newHash: '',
			size: 0,
			modifiedAt: 0,
			currentContent: new Uint8Array(0),
			currentHash: '',
			mergedContent: new Uint8Array(0),
		};
		const forceEmptyRequest = {
			path: '',
			content: new Uint8Array(0),
			sessionId: '',
		};
		const forceEmpty = await service.forceWriteFile(forceEmptyRequest);
		assert.strictEqual(transport.forceWriteFileCalls[1]?.path, '');
		assert.strictEqual(transport.forceWriteFileCalls[1]?.sessionId, '');
		assert.deepStrictEqual(transport.forceWriteFileCalls[1]?.content, new Uint8Array(0));
		assert.strictEqual(forceEmpty.status, 'SAVED');
		assert.strictEqual(forceEmpty.newHash, '');
		assert.strictEqual(forceEmpty.currentHash, '');
		assert.deepStrictEqual(forceEmpty.currentContent, new Uint8Array(0));
		assert.deepStrictEqual(forceEmpty.mergedContent, new Uint8Array(0));
		service.dispose();
	});

	test('agentMerge forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.agentMergeResult = { accepted: true };
		const mergeRequest = {
			sessionId: 'sess-1',
			path: 'src/foo.ts',
			baseContent: new Uint8Array([97]),
			currentContent: new Uint8Array([98]),
			userContent: new Uint8Array([99]),
		};
		const mergeResult = await service.agentMerge(mergeRequest);
		assert.deepStrictEqual(transport.agentMergeCalls, [mergeRequest]);
		assert.deepStrictEqual(mergeResult, transport.agentMergeResult);

		transport.agentMergeResult = { accepted: false };
		const mergeEmptyRequest = {
			sessionId: '',
			path: '',
			baseContent: new Uint8Array(0),
			currentContent: new Uint8Array(0),
			userContent: new Uint8Array(0),
		};
		const mergeEmpty = await service.agentMerge(mergeEmptyRequest);
		assert.strictEqual(transport.agentMergeCalls[1]?.sessionId, '');
		assert.strictEqual(transport.agentMergeCalls[1]?.path, '');
		assert.deepStrictEqual(transport.agentMergeCalls[1]?.baseContent, new Uint8Array(0));
		assert.deepStrictEqual(transport.agentMergeCalls[1]?.currentContent, new Uint8Array(0));
		assert.deepStrictEqual(transport.agentMergeCalls[1]?.userContent, new Uint8Array(0));
		assert.strictEqual(mergeEmpty.accepted, false);
		service.dispose();
	});

	test('readGitSummary forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.readGitSummaryResult = {
			supported: true,
			reason: '',
			branch: 'loop/A',
			changeCount: 3,
		};
		const request = { sessionId: 'sess-1' };
		const result = await service.readGitSummary(request);
		assert.deepStrictEqual(transport.readGitSummaryCalls, [request]);
		assert.deepStrictEqual(result, transport.readGitSummaryResult);

		transport.readGitSummaryResult = {
			supported: false,
			reason: '',
			branch: '',
			changeCount: 0,
		};
		const emptyRequest = { sessionId: '' };
		const empty = await service.readGitSummary(emptyRequest);
		assert.strictEqual(transport.readGitSummaryCalls[1]?.sessionId, '');
		assert.strictEqual(empty.supported, false);
		assert.strictEqual(empty.reason, '');
		assert.strictEqual(empty.branch, '');
		assert.strictEqual(empty.changeCount, 0);
		service.dispose();
	});

	test('readGitChanges forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.readGitChangesResult = {
			supported: true,
			reason: '',
			branch: 'main',
			entries: [{
				path: 'src/foo.ts',
				oldPath: '',
				kind: 'modified',
				indexState: 'unstaged',
			}],
		};
		const changesRequest = { sessionId: 'sess-1' };
		const changesResult = await service.readGitChanges(changesRequest);
		assert.deepStrictEqual(transport.readGitChangesCalls, [changesRequest]);
		assert.deepStrictEqual(changesResult, transport.readGitChangesResult);

		transport.readGitChangesResult = {
			supported: false,
			reason: '',
			branch: '',
			entries: [{
				path: '',
				oldPath: '',
				kind: '',
				indexState: '',
			}],
		};
		const changesEmptyRequest = { sessionId: '' };
		const changesEmpty = await service.readGitChanges(changesEmptyRequest);
		assert.strictEqual(transport.readGitChangesCalls[1]?.sessionId, '');
		assert.strictEqual(changesEmpty.supported, false);
		assert.strictEqual(changesEmpty.reason, '');
		assert.strictEqual(changesEmpty.branch, '');
		assert.strictEqual(changesEmpty.entries[0]?.path, '');
		assert.strictEqual(changesEmpty.entries[0]?.oldPath, '');
		assert.strictEqual(changesEmpty.entries[0]?.kind, '');
		assert.strictEqual(changesEmpty.entries[0]?.indexState, '');
		service.dispose();
	});

	test('readGitFileDiff forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.readGitFileDiffResult = {
			supported: true,
			reason: '',
			path: 'src/foo.ts',
			unifiedDiff: 'diff --git a/src/foo.ts b/src/foo.ts\n',
		};
		const request = { sessionId: 'sess-1', path: 'src/foo.ts', indexState: 'unstaged' };
		const result = await service.readGitFileDiff(request);
		assert.deepStrictEqual(transport.readGitFileDiffCalls, [request]);
		assert.deepStrictEqual(result, transport.readGitFileDiffResult);

		transport.readGitFileDiffResult = {
			supported: false,
			reason: '',
			path: '',
			unifiedDiff: '',
		};
		const emptyRequest = { sessionId: '', path: '', indexState: '' };
		const empty = await service.readGitFileDiff(emptyRequest);
		assert.strictEqual(transport.readGitFileDiffCalls[1]?.sessionId, '');
		assert.strictEqual(transport.readGitFileDiffCalls[1]?.path, '');
		assert.strictEqual(transport.readGitFileDiffCalls[1]?.indexState, '');
		assert.strictEqual(empty.supported, false);
		assert.strictEqual(empty.reason, '');
		assert.strictEqual(empty.path, '');
		assert.strictEqual(empty.unifiedDiff, '');
		service.dispose();
	});

	test('writeGitStagePaths forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.writeGitStagePathsResult = {
			supported: true,
			reason: '',
			success: true,
			errorMessage: '',
			exitCode: 0,
			stdout: 'staged',
		};
		const request = {
			sessionId: 'sess-1',
			commands: [{ argv: ['add', 'src/foo.ts'] }],
		};
		const result = await service.writeGitStagePaths(request);
		assert.deepStrictEqual(transport.writeGitStagePathsCalls, [request]);
		assert.deepStrictEqual(result, transport.writeGitStagePathsResult);

		transport.writeGitStagePathsResult = {
			supported: false,
			reason: '',
			success: false,
			errorMessage: '',
			exitCode: 0,
			stdout: '',
		};
		const emptyRequest = {
			sessionId: '',
			commands: [{ argv: [] }],
		};
		const empty = await service.writeGitStagePaths(emptyRequest);
		assert.strictEqual(transport.writeGitStagePathsCalls[1]?.sessionId, '');
		assert.deepStrictEqual(transport.writeGitStagePathsCalls[1]?.commands, [{ argv: [] }]);
		assert.strictEqual(empty.supported, false);
		assert.strictEqual(empty.reason, '');
		assert.strictEqual(empty.success, false);
		assert.strictEqual(empty.errorMessage, '');
		assert.strictEqual(empty.exitCode, 0);
		assert.strictEqual(empty.stdout, '');

		const emptyCommandsRequest = {
			sessionId: '',
			commands: [],
		};
		await service.writeGitStagePaths(emptyCommandsRequest);
		assert.strictEqual(transport.writeGitStagePathsCalls[2]?.sessionId, '');
		assert.deepStrictEqual(transport.writeGitStagePathsCalls[2]?.commands, []);
		service.dispose();
	});

	test('writeGitCommit forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.writeGitCommitResult = {
			supported: true,
			reason: '',
			success: true,
			errorMessage: '',
			exitCode: 0,
			stdout: 'committed',
		};
		const request = {
			sessionId: 'sess-1',
			message: 'fix: wire write',
			signOff: true,
			amend: false,
		};
		const result = await service.writeGitCommit(request);
		assert.deepStrictEqual(transport.writeGitCommitCalls, [request]);
		assert.deepStrictEqual(result, transport.writeGitCommitResult);

		transport.writeGitCommitResult = {
			supported: false,
			reason: '',
			success: false,
			errorMessage: '',
			exitCode: 0,
			stdout: '',
		};
		const emptyRequest = {
			sessionId: '',
			message: '',
			signOff: false,
			amend: false,
		};
		const empty = await service.writeGitCommit(emptyRequest);
		assert.strictEqual(transport.writeGitCommitCalls[1]?.sessionId, '');
		assert.strictEqual(transport.writeGitCommitCalls[1]?.message, '');
		assert.strictEqual(transport.writeGitCommitCalls[1]?.signOff, false);
		assert.strictEqual(transport.writeGitCommitCalls[1]?.amend, false);
		assert.strictEqual(empty.supported, false);
		assert.strictEqual(empty.reason, '');
		assert.strictEqual(empty.success, false);
		assert.strictEqual(empty.errorMessage, '');
		assert.strictEqual(empty.exitCode, 0);
		assert.strictEqual(empty.stdout, '');
		service.dispose();
	});

	test('writeGitApplyHunks forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.writeGitApplyHunksResult = {
			supported: true,
			reason: '',
			success: true,
			errorMessage: '',
			exitCode: 0,
			stdout: 'applied',
		};
		const request = {
			sessionId: 'sess-1',
			argv: ['apply', '--cached'],
			patches: ['diff --git a/src/foo.ts b/src/foo.ts\n'],
		};
		const result = await service.writeGitApplyHunks(request);
		assert.deepStrictEqual(transport.writeGitApplyHunksCalls, [request]);
		assert.deepStrictEqual(result, transport.writeGitApplyHunksResult);

		transport.writeGitApplyHunksResult = {
			supported: false,
			reason: '',
			success: false,
			errorMessage: '',
			exitCode: 0,
			stdout: '',
		};
		const emptyRequest = {
			sessionId: '',
			argv: [''],
			patches: [''],
		};
		const empty = await service.writeGitApplyHunks(emptyRequest);
		assert.strictEqual(transport.writeGitApplyHunksCalls[1]?.sessionId, '');
		assert.deepStrictEqual(transport.writeGitApplyHunksCalls[1]?.argv, ['']);
		assert.deepStrictEqual(transport.writeGitApplyHunksCalls[1]?.patches, ['']);
		assert.strictEqual(empty.supported, false);
		assert.strictEqual(empty.reason, '');
		assert.strictEqual(empty.success, false);
		assert.strictEqual(empty.errorMessage, '');
		assert.strictEqual(empty.exitCode, 0);
		assert.strictEqual(empty.stdout, '');

		const emptyListsRequest = {
			sessionId: '',
			argv: [],
			patches: [],
		};
		await service.writeGitApplyHunks(emptyListsRequest);
		assert.strictEqual(transport.writeGitApplyHunksCalls[2]?.sessionId, '');
		assert.deepStrictEqual(transport.writeGitApplyHunksCalls[2]?.argv, []);
		assert.deepStrictEqual(transport.writeGitApplyHunksCalls[2]?.patches, []);
		service.dispose();
	});

	test('getSessionUsage forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getSessionUsageResult = {
			usage: {
				inputTokens: 12,
				outputTokens: 34,
				thinkingTokens: 5,
				cacheReadTokens: 6,
				cacheWriteTokens: 7,
				totalCostMicros: 890,
				currency: 'USD',
				requestCount: 3,
			},
		};
		const request = { sessionId: 'sess-1' };
		const result = await service.getSessionUsage(request);
		assert.deepStrictEqual(transport.getSessionUsageCalls, [request]);
		assert.deepStrictEqual(result, transport.getSessionUsageResult);

		transport.getSessionUsageResult = {
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				thinkingTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalCostMicros: 0,
				currency: '',
				requestCount: 0,
			},
		};
		const emptyRequest = { sessionId: '' };
		const empty = await service.getSessionUsage(emptyRequest);
		assert.strictEqual(transport.getSessionUsageCalls[1]?.sessionId, '');
		assert.strictEqual(empty.usage.inputTokens, 0);
		assert.strictEqual(empty.usage.outputTokens, 0);
		assert.strictEqual(empty.usage.thinkingTokens, 0);
		assert.strictEqual(empty.usage.cacheReadTokens, 0);
		assert.strictEqual(empty.usage.cacheWriteTokens, 0);
		assert.strictEqual(empty.usage.totalCostMicros, 0);
		assert.strictEqual(empty.usage.currency, '');
		assert.strictEqual(empty.usage.requestCount, 0);
		service.dispose();
	});

	test('getGlobalUsage forwards empty request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getGlobalUsageResult = {
			usage: {
				inputTokens: 11,
				outputTokens: 22,
				thinkingTokens: 3,
				cacheReadTokens: 4,
				cacheWriteTokens: 5,
				totalCostMicros: 600,
				currency: 'USD',
				requestCount: 7,
			},
		};
		const result = await service.getGlobalUsage();
		assert.strictEqual(transport.getGlobalUsageCalls, 1);
		assert.deepStrictEqual(result, transport.getGlobalUsageResult);

		transport.getGlobalUsageResult = {
			usage: {
				inputTokens: 0,
				outputTokens: 0,
				thinkingTokens: 0,
				cacheReadTokens: 0,
				cacheWriteTokens: 0,
				totalCostMicros: 0,
				currency: '',
				requestCount: 0,
			},
		};
		const empty = await service.getGlobalUsage();
		assert.strictEqual(transport.getGlobalUsageCalls, 2);
		assert.strictEqual(empty.usage.currency, '');
		assert.strictEqual(empty.usage.inputTokens, 0);
		assert.strictEqual(empty.usage.requestCount, 0);
		service.dispose();
	});

	test('saveMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.saveMemoryResult = {
			success: true,
			message: 'saved',
			filePath: 'project/notes.md',
		};
		const request = {
			scope: 'project',
			content: 'remember this',
			category: 'notes',
		};
		const result = await service.saveMemory(request);
		assert.deepStrictEqual(transport.saveMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.saveMemoryResult);

		transport.saveMemoryResult = {
			success: false,
			message: '',
			filePath: '',
		};
		const emptyRequest = {
			scope: '',
			content: '',
			category: '',
		};
		const empty = await service.saveMemory(emptyRequest);
		assert.strictEqual(transport.saveMemoryCalls[1]?.scope, '');
		assert.strictEqual(transport.saveMemoryCalls[1]?.content, '');
		assert.strictEqual(transport.saveMemoryCalls[1]?.category, '');
		assert.strictEqual(empty.success, false);
		assert.strictEqual(empty.message, '');
		assert.strictEqual(empty.filePath, '');
		service.dispose();
	});

	test('searchMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.searchMemoryResult = {
			results: [{
				category: 'facts',
				filename: 'note.md',
				title: 'Note',
				score: 0.8,
				snippet: 'hit',
				forgot: false,
				scope: 'project',
			}],
		};
		const request = {
			scope: 'project',
			query: 'note',
			keywords: ['alpha'],
			limit: 10,
		};
		const result = await service.searchMemory(request);
		assert.deepStrictEqual(transport.searchMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.searchMemoryResult);

		transport.searchMemoryResult = {
			results: [{
				category: '',
				filename: '',
				title: '',
				score: 0,
				snippet: '',
				forgot: false,
				scope: '',
			}],
		};
		const emptyRequest = {
			scope: '',
			query: '',
			keywords: [''],
			limit: 0,
		};
		const empty = await service.searchMemory(emptyRequest);
		assert.strictEqual(transport.searchMemoryCalls[1]?.scope, '');
		assert.strictEqual(transport.searchMemoryCalls[1]?.query, '');
		assert.deepStrictEqual(transport.searchMemoryCalls[1]?.keywords, ['']);
		assert.strictEqual(transport.searchMemoryCalls[1]?.limit, 0);
		assert.strictEqual(empty.results[0]?.category, '');
		assert.strictEqual(empty.results[0]?.filename, '');
		assert.strictEqual(empty.results[0]?.title, '');
		assert.strictEqual(empty.results[0]?.score, 0);
		assert.strictEqual(empty.results[0]?.snippet, '');
		assert.strictEqual(empty.results[0]?.forgot, false);
		assert.strictEqual(empty.results[0]?.scope, '');

		const emptyListsRequest = {
			scope: '',
			query: '',
			keywords: [],
			limit: 0,
		};
		transport.searchMemoryResult = { results: [] };
		const emptyLists = await service.searchMemory(emptyListsRequest);
		assert.strictEqual(transport.searchMemoryCalls[2]?.scope, '');
		assert.deepStrictEqual(transport.searchMemoryCalls[2]?.keywords, []);
		assert.deepStrictEqual(emptyLists.results, []);
		service.dispose();
	});

	test('searchDeepMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.searchDeepMemoryResult = {
			results: [{
				category: 'facts',
				filename: 'note.md',
				title: 'Note',
				score: 0.8,
				snippet: 'hit',
				forgot: false,
				scope: 'project',
			}],
			searchedCategories: ['facts'],
		};
		const request = {
			scope: 'project',
			query: 'note',
			keywords: ['alpha'],
			categories: ['facts'],
			limit: 10,
			includeContent: true,
		};
		const result = await service.searchDeepMemory(request);
		assert.deepStrictEqual(transport.searchDeepMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.searchDeepMemoryResult);

		transport.searchDeepMemoryResult = {
			results: [{
				category: '',
				filename: '',
				title: '',
				score: 0,
				snippet: '',
				forgot: false,
				scope: '',
			}],
			searchedCategories: [''],
		};
		const emptyRequest = {
			scope: '',
			query: '',
			keywords: [''],
			categories: [''],
			limit: 0,
			includeContent: false,
		};
		const empty = await service.searchDeepMemory(emptyRequest);
		assert.strictEqual(transport.searchDeepMemoryCalls[1]?.scope, '');
		assert.strictEqual(transport.searchDeepMemoryCalls[1]?.query, '');
		assert.deepStrictEqual(transport.searchDeepMemoryCalls[1]?.keywords, ['']);
		assert.deepStrictEqual(transport.searchDeepMemoryCalls[1]?.categories, ['']);
		assert.strictEqual(transport.searchDeepMemoryCalls[1]?.limit, 0);
		assert.strictEqual(transport.searchDeepMemoryCalls[1]?.includeContent, false);
		assert.strictEqual(empty.results[0]?.category, '');
		assert.strictEqual(empty.results[0]?.filename, '');
		assert.strictEqual(empty.results[0]?.title, '');
		assert.strictEqual(empty.results[0]?.score, 0);
		assert.strictEqual(empty.results[0]?.snippet, '');
		assert.strictEqual(empty.results[0]?.forgot, false);
		assert.strictEqual(empty.results[0]?.scope, '');
		assert.deepStrictEqual(empty.searchedCategories, ['']);

		const emptyListsRequest = {
			scope: '',
			query: '',
			keywords: [],
			categories: [],
			limit: 0,
			includeContent: false,
		};
		transport.searchDeepMemoryResult = { results: [], searchedCategories: [] };
		const emptyLists = await service.searchDeepMemory(emptyListsRequest);
		assert.strictEqual(transport.searchDeepMemoryCalls[2]?.scope, '');
		assert.deepStrictEqual(transport.searchDeepMemoryCalls[2]?.keywords, []);
		assert.deepStrictEqual(transport.searchDeepMemoryCalls[2]?.categories, []);
		assert.strictEqual(transport.searchDeepMemoryCalls[2]?.includeContent, false);
		assert.deepStrictEqual(emptyLists.results, []);
		assert.deepStrictEqual(emptyLists.searchedCategories, []);
		service.dispose();
	});

	test('readMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.readMemoryResult = {
			content: '# notes',
			metadata: {
				category: 'notes',
				filename: 'project.md',
				title: 'Project',
				tags: ['keep'],
				createdAt: 10,
				updatedAt: 20,
				version: 2,
			},
		};
		const request = {
			scope: 'project',
			category: 'notes',
			filename: 'project.md',
			section: 'intro',
			mode: 'full',
			forgot: true,
		};
		const result = await service.readMemory(request);
		assert.deepStrictEqual(transport.readMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.readMemoryResult);

		transport.readMemoryResult = {
			content: '',
			metadata: {
				category: '',
				filename: '',
				title: '',
				tags: [],
				createdAt: 0,
				updatedAt: 0,
				version: 0,
			},
		};
		const emptyRequest = {
			scope: '',
			category: '',
			filename: '',
			section: '',
			mode: '',
			forgot: false,
		};
		const empty = await service.readMemory(emptyRequest);
		assert.strictEqual(transport.readMemoryCalls[1]?.scope, '');
		assert.strictEqual(transport.readMemoryCalls[1]?.category, '');
		assert.strictEqual(transport.readMemoryCalls[1]?.filename, '');
		assert.strictEqual(transport.readMemoryCalls[1]?.section, '');
		assert.strictEqual(transport.readMemoryCalls[1]?.mode, '');
		assert.strictEqual(transport.readMemoryCalls[1]?.forgot, false);
		assert.strictEqual(empty.content, '');
		assert.strictEqual(empty.metadata.category, '');
		assert.strictEqual(empty.metadata.filename, '');
		assert.strictEqual(empty.metadata.title, '');
		assert.deepStrictEqual(empty.metadata.tags, []);
		assert.strictEqual(empty.metadata.createdAt, 0);
		assert.strictEqual(empty.metadata.updatedAt, 0);
		assert.strictEqual(empty.metadata.version, 0);
		service.dispose();
	});

	test('listMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listMemoryResult = {
			categories: [{
				category: 'notes',
				files: [{
					filename: 'note.md',
					title: 'Note',
					updatedAt: 1,
				}],
				fileCount: 1,
			}],
		};
		const request = {
			scope: 'project',
			category: 'notes',
		};
		const result = await service.listMemory(request);
		assert.deepStrictEqual(transport.listMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.listMemoryResult);

		transport.listMemoryResult = {
			categories: [{
				category: '',
				files: [{
					filename: '',
					title: '',
					updatedAt: 0,
				}],
				fileCount: 0,
			}],
		};
		const emptyRequest = {
			scope: '',
			category: '',
		};
		const empty = await service.listMemory(emptyRequest);
		assert.strictEqual(transport.listMemoryCalls[1]?.scope, '');
		assert.strictEqual(transport.listMemoryCalls[1]?.category, '');
		assert.strictEqual(empty.categories[0]?.category, '');
		assert.strictEqual(empty.categories[0]?.fileCount, 0);
		assert.strictEqual(empty.categories[0]?.files[0]?.filename, '');
		assert.strictEqual(empty.categories[0]?.files[0]?.title, '');
		assert.strictEqual(empty.categories[0]?.files[0]?.updatedAt, 0);

		transport.listMemoryResult = { categories: [] };
		const emptyLists = await service.listMemory(emptyRequest);
		assert.strictEqual(transport.listMemoryCalls[2]?.scope, '');
		assert.strictEqual(transport.listMemoryCalls[2]?.category, '');
		assert.deepStrictEqual(emptyLists.categories, []);
		service.dispose();
	});

	test('deleteMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.deleteMemoryResult = {
			success: true,
			message: 'deleted',
		};
		const request = {
			scope: 'project',
			category: 'notes',
			filename: 'note.md',
		};
		const result = await service.deleteMemory(request);
		assert.deepStrictEqual(transport.deleteMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.deleteMemoryResult);

		transport.deleteMemoryResult = {
			success: false,
			message: '',
		};
		const emptyRequest = {
			scope: '',
			category: '',
			filename: '',
		};
		const empty = await service.deleteMemory(emptyRequest);
		assert.strictEqual(transport.deleteMemoryCalls[1]?.scope, '');
		assert.strictEqual(transport.deleteMemoryCalls[1]?.category, '');
		assert.strictEqual(transport.deleteMemoryCalls[1]?.filename, '');
		assert.strictEqual(empty.success, false);
		assert.strictEqual(empty.message, '');
		service.dispose();
	});

	test('reflectMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.reflectMemoryResult = {
			diagnoses: [{
				type: 'stale',
				category: 'notes',
				filename: 'old.md',
				description: 'outdated',
				suggestion: 'refresh',
			}],
			summary: 'one stale',
		};
		const request = {
			scope: 'project',
			categories: ['notes'],
		};
		const result = await service.reflectMemory(request);
		assert.deepStrictEqual(transport.reflectMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.reflectMemoryResult);

		transport.reflectMemoryResult = {
			diagnoses: [{
				type: '',
				category: '',
				filename: '',
				description: '',
				suggestion: '',
			}],
			summary: '',
		};
		const emptyRequest = {
			scope: '',
			categories: [''],
		};
		const empty = await service.reflectMemory(emptyRequest);
		assert.strictEqual(transport.reflectMemoryCalls[1]?.scope, '');
		assert.deepStrictEqual(transport.reflectMemoryCalls[1]?.categories, ['']);
		assert.strictEqual(empty.diagnoses[0]?.type, '');
		assert.strictEqual(empty.diagnoses[0]?.category, '');
		assert.strictEqual(empty.diagnoses[0]?.filename, '');
		assert.strictEqual(empty.diagnoses[0]?.description, '');
		assert.strictEqual(empty.diagnoses[0]?.suggestion, '');
		assert.strictEqual(empty.summary, '');

		const emptyListsRequest = {
			scope: '',
			categories: [],
		};
		transport.reflectMemoryResult = { diagnoses: [], summary: '' };
		const emptyLists = await service.reflectMemory(emptyListsRequest);
		assert.strictEqual(transport.reflectMemoryCalls[2]?.scope, '');
		assert.deepStrictEqual(transport.reflectMemoryCalls[2]?.categories, []);
		assert.deepStrictEqual(emptyLists.diagnoses, []);
		assert.strictEqual(emptyLists.summary, '');
		service.dispose();
	});

	test('revertMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.revertMemoryResult = {
			success: true,
			message: 'reverted',
			revertedToVersion: 3,
		};
		const request = {
			scope: 'project',
			category: 'notes',
			filename: 'note.md',
			targetVersion: 3,
		};
		const result = await service.revertMemory(request);
		assert.deepStrictEqual(transport.revertMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.revertMemoryResult);

		transport.revertMemoryResult = {
			success: false,
			message: '',
			revertedToVersion: 0,
		};
		const emptyRequest = {
			scope: '',
			category: '',
			filename: '',
			targetVersion: 0,
		};
		const empty = await service.revertMemory(emptyRequest);
		assert.strictEqual(transport.revertMemoryCalls[1]?.scope, '');
		assert.strictEqual(transport.revertMemoryCalls[1]?.category, '');
		assert.strictEqual(transport.revertMemoryCalls[1]?.filename, '');
		assert.strictEqual(transport.revertMemoryCalls[1]?.targetVersion, 0);
		assert.strictEqual(empty.success, false);
		assert.strictEqual(empty.message, '');
		assert.strictEqual(empty.revertedToVersion, 0);
		service.dispose();
	});

	test('historyMemory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.historyMemoryResult = {
			changes: [{
				version: 2,
				changeType: 'updated',
				summary: 'edited note',
				timestamp: 1_700_000_000,
				author: 'agent',
			}],
		};
		const request = {
			scope: 'project',
			category: 'notes',
			filename: 'note.md',
			limit: 20,
		};
		const result = await service.historyMemory(request);
		assert.deepStrictEqual(transport.historyMemoryCalls, [request]);
		assert.deepStrictEqual(result, transport.historyMemoryResult);

		transport.historyMemoryResult = {
			changes: [{
				version: 0,
				changeType: '',
				summary: '',
				timestamp: 0,
				author: '',
			}],
		};
		const emptyRequest = {
			scope: '',
			category: '',
			filename: '',
			limit: 0,
		};
		const empty = await service.historyMemory(emptyRequest);
		assert.strictEqual(transport.historyMemoryCalls[1]?.scope, '');
		assert.strictEqual(transport.historyMemoryCalls[1]?.category, '');
		assert.strictEqual(transport.historyMemoryCalls[1]?.filename, '');
		assert.strictEqual(transport.historyMemoryCalls[1]?.limit, 0);
		assert.strictEqual(empty.changes[0]?.version, 0);
		assert.strictEqual(empty.changes[0]?.changeType, '');
		assert.strictEqual(empty.changes[0]?.summary, '');
		assert.strictEqual(empty.changes[0]?.timestamp, 0);
		assert.strictEqual(empty.changes[0]?.author, '');

		transport.historyMemoryResult = { changes: [] };
		const emptyList = await service.historyMemory(emptyRequest);
		assert.deepStrictEqual(emptyList.changes, []);
		service.dispose();
	});

	test('listContextVariable forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listContextVariableResult = {
			current: [{
				name: 'cwd',
				scope: 'VARIABLE_LOCAL',
				updatedBy: 'root',
				updatedAt: 1_700_000_000,
				contentPreview: '/tmp',
			}],
			inherited: [{
				name: 'lang',
				scope: 'VARIABLE_GLOBAL',
				updatedBy: 'parent',
				updatedAt: 1_600_000_000,
				contentPreview: 'en',
			}],
		};
		const request = {
			sessionId: 'sess-1',
			agentId: 'agent-1',
		};
		const result = await service.listContextVariable(request);
		assert.deepStrictEqual(transport.listContextVariableCalls, [request]);
		assert.deepStrictEqual(result, transport.listContextVariableResult);

		transport.listContextVariableResult = {
			current: [{
				name: '',
				scope: 'VARIABLE_GLOBAL',
				updatedBy: '',
				updatedAt: 0,
				contentPreview: '',
			}],
			inherited: [{
				name: '',
				scope: 'VARIABLE_LOCAL',
				updatedBy: '',
				updatedAt: 0,
				contentPreview: '',
			}],
		};
		const emptyRequest = {
			sessionId: '',
			agentId: '',
		};
		const empty = await service.listContextVariable(emptyRequest);
		assert.strictEqual(transport.listContextVariableCalls[1]?.sessionId, '');
		assert.strictEqual(transport.listContextVariableCalls[1]?.agentId, '');
		assert.strictEqual(empty.current[0]?.name, '');
		assert.strictEqual(empty.current[0]?.scope, 'VARIABLE_GLOBAL');
		assert.strictEqual(empty.current[0]?.updatedBy, '');
		assert.strictEqual(empty.current[0]?.updatedAt, 0);
		assert.strictEqual(empty.current[0]?.contentPreview, '');
		assert.strictEqual(empty.inherited[0]?.name, '');
		assert.strictEqual(empty.inherited[0]?.scope, 'VARIABLE_LOCAL');
		assert.strictEqual(empty.inherited[0]?.updatedBy, '');
		assert.strictEqual(empty.inherited[0]?.updatedAt, 0);
		assert.strictEqual(empty.inherited[0]?.contentPreview, '');

		transport.listContextVariableResult = { current: [], inherited: [] };
		const emptyLists = await service.listContextVariable(emptyRequest);
		assert.deepStrictEqual(emptyLists.current, []);
		assert.deepStrictEqual(emptyLists.inherited, []);
		service.dispose();
	});

	test('readContextVariable forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.readContextVariableResult = {
			entry: {
				name: 'cwd',
				content: '/tmp',
				scope: 'VARIABLE_LOCAL',
				updatedBy: 'root',
				updatedAt: 1_700_000_000,
			},
		};
		const request = {
			sessionId: 'sess-1',
			name: 'cwd',
			agentId: 'agent-1',
		};
		const result = await service.readContextVariable(request);
		assert.deepStrictEqual(transport.readContextVariableCalls, [request]);
		assert.deepStrictEqual(result, transport.readContextVariableResult);

		transport.readContextVariableResult = {
			entry: {
				name: '',
				content: '',
				scope: 'VARIABLE_GLOBAL',
				updatedBy: '',
				updatedAt: 0,
			},
		};
		const emptyRequest = {
			sessionId: '',
			name: '',
			agentId: '',
		};
		const empty = await service.readContextVariable(emptyRequest);
		assert.strictEqual(transport.readContextVariableCalls[1]?.sessionId, '');
		assert.strictEqual(transport.readContextVariableCalls[1]?.name, '');
		assert.strictEqual(transport.readContextVariableCalls[1]?.agentId, '');
		assert.strictEqual(empty.entry.name, '');
		assert.strictEqual(empty.entry.content, '');
		assert.strictEqual(empty.entry.scope, 'VARIABLE_GLOBAL');
		assert.strictEqual(empty.entry.updatedBy, '');
		assert.strictEqual(empty.entry.updatedAt, 0);
		service.dispose();
	});

	test('getUploadProgress forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getUploadProgressResult = {
			exists: true,
			bytesReceived: 4096,
			partialPath: 'tmp/upload.bin',
		};
		const request = {
			transferId: 'xfer-1',
			sessionId: 'sess-1',
		};
		const result = await service.getUploadProgress(request);
		assert.deepStrictEqual(transport.getUploadProgressCalls, [request]);
		assert.deepStrictEqual(result, transport.getUploadProgressResult);

		transport.getUploadProgressResult = {
			exists: false,
			bytesReceived: 0,
			partialPath: '',
		};
		const emptyRequest = {
			transferId: '',
			sessionId: '',
		};
		const empty = await service.getUploadProgress(emptyRequest);
		assert.strictEqual(transport.getUploadProgressCalls[1]?.transferId, '');
		assert.strictEqual(transport.getUploadProgressCalls[1]?.sessionId, '');
		assert.strictEqual(empty.exists, false);
		assert.strictEqual(empty.bytesReceived, 0);
		assert.strictEqual(empty.partialPath, '');
		service.dispose();
	});

	test('healthCheck forwards empty request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.healthCheckResult = {
			status: 'SERVING',
			version: '1.2.3',
			activeSessions: 4,
			uptimeMs: 90000,
		};
		const result = await service.healthCheck();
		assert.strictEqual(transport.healthCheckCalls, 1);
		assert.deepStrictEqual(result, transport.healthCheckResult);

		transport.healthCheckResult = {
			status: '',
			version: '',
			activeSessions: 0,
			uptimeMs: 0,
		};
		const empty = await service.healthCheck();
		assert.strictEqual(transport.healthCheckCalls, 2);
		assert.strictEqual(empty.status, '');
		assert.strictEqual(empty.version, '');
		assert.strictEqual(empty.activeSessions, 0);
		assert.strictEqual(empty.uptimeMs, 0);
		service.dispose();
	});

	test('doctor forwards empty request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.doctorResult = {
			checks: [{
				name: 'tls',
				passed: true,
				message: 'ok',
				fixHint: 'none',
			}],
			allPassed: true,
		};
		const result = await service.doctor();
		assert.strictEqual(transport.doctorCalls, 1);
		assert.deepStrictEqual(result, transport.doctorResult);

		transport.doctorResult = {
			checks: [{
				name: '',
				passed: false,
				message: '',
				fixHint: '',
			}],
			allPassed: false,
		};
		const empty = await service.doctor();
		assert.strictEqual(transport.doctorCalls, 2);
		assert.strictEqual(empty.checks[0]?.name, '');
		assert.strictEqual(empty.checks[0]?.message, '');
		assert.strictEqual(empty.checks[0]?.fixHint, '');
		assert.strictEqual(empty.checks[0]?.passed, false);
		assert.strictEqual(empty.allPassed, false);
		service.dispose();
	});

	test('shutdown forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.shutdownResult = {
			accepted: true,
			message: 'shutting down',
		};
		const request = {
			force: true,
			gracePeriodMs: 15000,
		};
		const result = await service.shutdown(request);
		assert.deepStrictEqual(transport.shutdownCalls, [request]);
		assert.deepStrictEqual(result, transport.shutdownResult);

		transport.shutdownResult = {
			accepted: false,
			message: '',
		};
		const emptyRequest = {
			force: false,
			gracePeriodMs: 0,
		};
		const empty = await service.shutdown(emptyRequest);
		assert.strictEqual(transport.shutdownCalls[1]?.force, false);
		assert.strictEqual(transport.shutdownCalls[1]?.gracePeriodMs, 0);
		assert.strictEqual(empty.accepted, false);
		assert.strictEqual(empty.message, '');
		service.dispose();
	});

	test('listDevices forwards empty request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listDevicesResult = {
			devices: [{
				deviceId: 'dev-1',
				displayName: 'laptop',
				role: 'operator',
				platform: 'linux',
				pairedAt: 100,
				lastSeenAt: 200,
				active: true,
			}],
		};
		const result = await service.listDevices();
		assert.strictEqual(transport.listDevicesCalls, 1);
		assert.deepStrictEqual(result, transport.listDevicesResult);

		transport.listDevicesResult = {
			devices: [{
				deviceId: '',
				displayName: '',
				role: '',
				platform: '',
				pairedAt: 0,
				lastSeenAt: 0,
				active: false,
			}],
		};
		const empty = await service.listDevices();
		assert.strictEqual(transport.listDevicesCalls, 2);
		assert.strictEqual(empty.devices[0]?.deviceId, '');
		assert.strictEqual(empty.devices[0]?.displayName, '');
		assert.strictEqual(empty.devices[0]?.role, '');
		assert.strictEqual(empty.devices[0]?.platform, '');
		assert.strictEqual(empty.devices[0]?.pairedAt, 0);
		assert.strictEqual(empty.devices[0]?.lastSeenAt, 0);
		assert.strictEqual(empty.devices[0]?.active, false);
		service.dispose();
	});

	test('pairApprove forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.pairApproveResult = {
			success: true,
			deviceId: 'dev-1',
			message: 'approved',
		};
		const request = {
			pairingCode: '123456',
			displayName: 'laptop',
			role: 'operator',
		};
		const result = await service.pairApprove(request);
		assert.deepStrictEqual(transport.pairApproveCalls, [request]);
		assert.deepStrictEqual(result, transport.pairApproveResult);

		transport.pairApproveResult = {
			success: false,
			deviceId: '',
			message: '',
		};
		const emptyRequest = {
			pairingCode: '',
			displayName: '',
			role: '',
		};
		const empty = await service.pairApprove(emptyRequest);
		assert.strictEqual(transport.pairApproveCalls[1]?.pairingCode, '');
		assert.strictEqual(transport.pairApproveCalls[1]?.displayName, '');
		assert.strictEqual(transport.pairApproveCalls[1]?.role, '');
		assert.strictEqual(empty.success, false);
		assert.strictEqual(empty.deviceId, '');
		assert.strictEqual(empty.message, '');
		service.dispose();
	});

	test('pairReject forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.pairRejectResult = {
			success: true,
			message: 'rejected',
		};
		const request = {
			pairingCode: '123456',
		};
		const result = await service.pairReject(request);
		assert.deepStrictEqual(transport.pairRejectCalls, [request]);
		assert.deepStrictEqual(result, transport.pairRejectResult);

		transport.pairRejectResult = {
			success: false,
			message: '',
		};
		const emptyRequest = {
			pairingCode: '',
		};
		const empty = await service.pairReject(emptyRequest);
		assert.strictEqual(transport.pairRejectCalls[1]?.pairingCode, '');
		assert.strictEqual(empty.success, false);
		assert.strictEqual(empty.message, '');
		service.dispose();
	});

	test('listTriggers forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listTriggersResult = {
			triggers: [{
				triggerId: 'trg-1',
				name: 'nightly',
				type: 'schedule',
				promptTemplate: 'run',
				enabled: true,
				pauseReason: 'paused',
				target: { kind: 'boundSession', sessionId: 'sess-1' },
				intervalMs: 60_000,
				cronExpression: '0 * * * *',
				runAtEpochMs: 1,
			}],
		};
		const request = {
			scope: 'session',
			scopeId: 'sess-1',
			typeFilter: 'schedule',
		};
		const result = await service.listTriggers(request);
		assert.deepStrictEqual(transport.listTriggersCalls, [request]);
		assert.deepStrictEqual(result, transport.listTriggersResult);

		transport.listTriggersResult = {
			triggers: [{
				triggerId: '',
				name: '',
				type: '',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'newSession', engineProfileId: '' },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			}],
		};
		const emptyRequest = {
			scope: '',
			scopeId: '',
			typeFilter: '',
		};
		const empty = await service.listTriggers(emptyRequest);
		assert.strictEqual(transport.listTriggersCalls[1]?.scope, '');
		assert.strictEqual(transport.listTriggersCalls[1]?.scopeId, '');
		assert.strictEqual(transport.listTriggersCalls[1]?.typeFilter, '');
		assert.strictEqual(empty.triggers[0]?.triggerId, '');
		assert.strictEqual(empty.triggers[0]?.name, '');
		assert.strictEqual(empty.triggers[0]?.type, '');
		assert.strictEqual(empty.triggers[0]?.promptTemplate, '');
		assert.strictEqual(empty.triggers[0]?.pauseReason, '');
		assert.strictEqual(empty.triggers[0]?.cronExpression, '');
		assert.strictEqual(empty.triggers[0]?.enabled, false);
		assert.strictEqual(empty.triggers[0]?.intervalMs, 0);
		assert.strictEqual(empty.triggers[0]?.runAtEpochMs, 0);
		assert.deepStrictEqual(empty.triggers[0]?.target, { kind: 'newSession', engineProfileId: '' });

		transport.listTriggersResult = { triggers: [] };
		const emptyLists = await service.listTriggers(emptyRequest);
		assert.strictEqual(transport.listTriggersCalls[2]?.scope, '');
		assert.strictEqual(transport.listTriggersCalls[2]?.scopeId, '');
		assert.strictEqual(transport.listTriggersCalls[2]?.typeFilter, '');
		assert.deepStrictEqual(emptyLists.triggers, []);
		service.dispose();
	});

	test('upsertTrigger forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.upsertTriggerResult = {
			trigger: {
				triggerId: 'trg-1',
				name: 'nightly',
				type: 'schedule',
				promptTemplate: 'run',
				enabled: true,
				pauseReason: 'paused',
				target: { kind: 'boundSession', sessionId: 'sess-1' },
				intervalMs: 60_000,
				cronExpression: '0 * * * *',
				runAtEpochMs: 1,
			},
		};
		const request = {
			scope: 'session',
			scopeId: 'sess-1',
			trigger: {
				triggerId: 'trg-1',
				name: 'nightly',
				type: 'schedule',
				promptTemplate: 'run',
				enabled: true,
				pauseReason: 'paused',
				target: { kind: 'boundSession' as const, sessionId: 'sess-1' },
				intervalMs: 60_000,
				cronExpression: '0 * * * *',
				runAtEpochMs: 1,
			},
		};
		const result = await service.upsertTrigger(request);
		assert.deepStrictEqual(transport.upsertTriggerCalls, [request]);
		assert.deepStrictEqual(result, transport.upsertTriggerResult);

		transport.upsertTriggerResult = {
			trigger: {
				triggerId: '',
				name: '',
				type: '',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'newSession', engineProfileId: '' },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			},
		};
		const emptyRequest = {
			scope: '',
			scopeId: '',
			trigger: {
				triggerId: '',
				name: '',
				type: '',
				promptTemplate: '',
				enabled: false,
				pauseReason: '',
				target: { kind: 'newSession' as const, engineProfileId: '' },
				intervalMs: 0,
				cronExpression: '',
				runAtEpochMs: 0,
			},
		};
		const empty = await service.upsertTrigger(emptyRequest);
		assert.strictEqual(transport.upsertTriggerCalls[1]?.scope, '');
		assert.strictEqual(transport.upsertTriggerCalls[1]?.scopeId, '');
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.triggerId, '');
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.name, '');
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.type, '');
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.promptTemplate, '');
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.pauseReason, '');
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.cronExpression, '');
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.enabled, false);
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.intervalMs, 0);
		assert.strictEqual(transport.upsertTriggerCalls[1]?.trigger.runAtEpochMs, 0);
		assert.deepStrictEqual(transport.upsertTriggerCalls[1]?.trigger.target, { kind: 'newSession', engineProfileId: '' });
		assert.strictEqual(empty.trigger.triggerId, '');
		assert.strictEqual(empty.trigger.name, '');
		assert.strictEqual(empty.trigger.type, '');
		assert.strictEqual(empty.trigger.promptTemplate, '');
		assert.strictEqual(empty.trigger.pauseReason, '');
		assert.strictEqual(empty.trigger.cronExpression, '');
		assert.strictEqual(empty.trigger.enabled, false);
		assert.strictEqual(empty.trigger.intervalMs, 0);
		assert.strictEqual(empty.trigger.runAtEpochMs, 0);
		assert.deepStrictEqual(empty.trigger.target, { kind: 'newSession', engineProfileId: '' });
		service.dispose();
	});

	test('writeClipboard forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.writeClipboardResult = {
			clipId: 'clip-1',
		};
		const request = {
			sessionId: 'sess-1',
			agentId: 'agent-1',
			label: 'note',
			type: 'CLIPBOARD_TEXT' as const,
			content: 'hello',
			filePath: '',
			url: '',
		};
		const result = await service.writeClipboard(request);
		assert.deepStrictEqual(transport.writeClipboardCalls, [request]);
		assert.deepStrictEqual(result, transport.writeClipboardResult);

		transport.writeClipboardResult = {
			clipId: '',
		};
		const emptyRequest = {
			sessionId: '',
			agentId: '',
			label: '',
			type: 'CLIPBOARD_TEXT' as const,
			content: '',
			filePath: '',
			url: '',
		};
		const empty = await service.writeClipboard(emptyRequest);
		assert.strictEqual(transport.writeClipboardCalls[1]?.sessionId, '');
		assert.strictEqual(transport.writeClipboardCalls[1]?.agentId, '');
		assert.strictEqual(transport.writeClipboardCalls[1]?.label, '');
		assert.strictEqual(transport.writeClipboardCalls[1]?.content, '');
		assert.strictEqual(transport.writeClipboardCalls[1]?.filePath, '');
		assert.strictEqual(transport.writeClipboardCalls[1]?.url, '');
		assert.strictEqual(empty.clipId, '');
		service.dispose();
	});

	test('readClipboard forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.readClipboardResult = {
			entry: {
				clipId: 'clip-1',
				label: 'note',
				type: 'CLIPBOARD_TEXT',
				content: 'hello',
				createdBy: 'agent-1',
				createdAt: 1,
			},
		};
		const request = {
			sessionId: 'sess-1',
			clipId: 'clip-1',
		};
		const result = await service.readClipboard(request);
		assert.deepStrictEqual(transport.readClipboardCalls, [request]);
		assert.deepStrictEqual(result, transport.readClipboardResult);

		transport.readClipboardResult = {
			entry: {
				clipId: '',
				label: '',
				type: 'CLIPBOARD_TEXT',
				content: '',
				createdBy: '',
				createdAt: 0,
			},
		};
		const emptyRequest = {
			sessionId: '',
			clipId: '',
		};
		const empty = await service.readClipboard(emptyRequest);
		assert.strictEqual(transport.readClipboardCalls[1]?.sessionId, '');
		assert.strictEqual(transport.readClipboardCalls[1]?.clipId, '');
		assert.strictEqual(empty.entry.clipId, '');
		assert.strictEqual(empty.entry.label, '');
		assert.strictEqual(empty.entry.content, '');
		assert.strictEqual(empty.entry.createdBy, '');
		assert.strictEqual(empty.entry.createdAt, 0);
		service.dispose();
	});

	test('setPermissionPolicy forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.setPermissionPolicyResult = { ok: true, message: 'applied' };
		const result = await service.setPermissionPolicy({
			sessionId: 'sess-1',
			toolName: 'shell',
			policy: 'PERMISSION_POLICY_ASK',
		});
		assert.deepStrictEqual(transport.setPermissionPolicyCalls, [{
			sessionId: 'sess-1',
			toolName: 'shell',
			policy: 'PERMISSION_POLICY_ASK',
		}]);
		assert.deepStrictEqual(result, { ok: true, message: 'applied' });

		transport.setPermissionPolicyResult = { ok: false, message: '' };
		const empty = await service.setPermissionPolicy({
			sessionId: '',
			toolName: '',
			policy: 'PERMISSION_POLICY_UNSPECIFIED',
		});
		assert.deepStrictEqual(empty, { ok: false, message: '' });
		assert.strictEqual(transport.setPermissionPolicyCalls[1]?.sessionId, '');
		assert.strictEqual(transport.setPermissionPolicyCalls[1]?.toolName, '');
		assert.strictEqual(transport.setPermissionPolicyCalls[1]?.policy, 'PERMISSION_POLICY_UNSPECIFIED');
		service.dispose();
	});

	test('getTodo forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getTodoResult = {
			items: [{
				id: 'todo-1',
				content: 'wire catalog',
				status: 'in_progress',
				priority: 1,
				requireConfirm: true,
				blocked: 'need review',
			}],
		};
		const result = await service.getTodo({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.getTodoCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, transport.getTodoResult);

		transport.getTodoResult = { items: [] };
		const empty = await service.getTodo({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, { items: [] });
		assert.strictEqual(transport.getTodoCalls[1]?.sessionId, '');
		assert.strictEqual(transport.getTodoCalls[1]?.agentId, '');
		service.dispose();
	});

	test('resolveAnchor forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.resolveAnchorResult = {
			hit: {
				envelope: { id: 'env-1' },
				presence: 'ENVELOPE_RECORD_PRESENCE_ACTIVE_ON_PATH',
				generation: 2,
			},
		};
		const result = await service.resolveAnchor({
			anchor: { sessionId: 'sess-1', envelopeId: 'env-1', generation: 2 },
			scope: 'ANCHOR_RESOLVE_SCOPE_ACTIVE',
			currentLeafTurnId: 'turn-1',
		});
		assert.deepStrictEqual(transport.resolveAnchorCalls, [{
			anchor: { sessionId: 'sess-1', envelopeId: 'env-1', generation: 2 },
			scope: 'ANCHOR_RESOLVE_SCOPE_ACTIVE',
			currentLeafTurnId: 'turn-1',
		}]);
		assert.deepStrictEqual(result, transport.resolveAnchorResult);

		transport.resolveAnchorResult = {
			expired: { anchor: { sessionId: '', envelopeId: '' } },
		};
		const empty = await service.resolveAnchor({
			anchor: { sessionId: '', envelopeId: '' },
			scope: 'ANCHOR_RESOLVE_SCOPE_UNSPECIFIED',
			currentLeafTurnId: '',
		});
		assert.deepStrictEqual(empty, transport.resolveAnchorResult);
		assert.strictEqual(transport.resolveAnchorCalls[1]?.anchor.sessionId, '');
		assert.strictEqual(transport.resolveAnchorCalls[1]?.anchor.envelopeId, '');
		assert.strictEqual(transport.resolveAnchorCalls[1]?.currentLeafTurnId, '');
		service.dispose();
	});

	test('getUsage forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getUsageResult = {
			totalInputTokens: 12,
			totalOutputTokens: 34,
			totalTurns: 2,
			agentUsages: [{
				agentId: 'root',
				inputTokens: 12,
				outputTokens: 34,
				turns: 2,
			}],
			recentRequestSpans: [{
				profileId: 'p1',
				provider: 'openai',
				modelId: 'gpt',
				inputTokens: 8,
				outputTokens: 16,
				prefillMs: 1,
				decodeMs: 2,
				completedAtMs: 3,
				usageKind: 'chat',
			}],
		};
		const result = await service.getUsage({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.getUsageCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, transport.getUsageResult);

		transport.getUsageResult = {
			totalInputTokens: 0,
			totalOutputTokens: 0,
			totalTurns: 0,
			agentUsages: [],
			recentRequestSpans: [],
		};
		const empty = await service.getUsage({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, transport.getUsageResult);
		assert.strictEqual(transport.getUsageCalls[1]?.sessionId, '');
		assert.strictEqual(transport.getUsageCalls[1]?.agentId, '');
		service.dispose();
	});

	test('getAgentHistory forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getAgentHistoryResult = {
			entries: [{
				role: 'user',
				content: 'hello',
				timestamp: 1,
				agentId: 'root',
			}],
			total: 1,
		};
		const result = await service.getAgentHistory({ sessionId: 'sess-1', agentId: 'root', limit: 20, offset: 0 });
		assert.deepStrictEqual(transport.getAgentHistoryCalls, [{ sessionId: 'sess-1', agentId: 'root', limit: 20, offset: 0 }]);
		assert.deepStrictEqual(result, transport.getAgentHistoryResult);

		transport.getAgentHistoryResult = { entries: [], total: 0 };
		const empty = await service.getAgentHistory({ sessionId: '', agentId: '', limit: 0, offset: 0 });
		assert.deepStrictEqual(empty, transport.getAgentHistoryResult);
		assert.strictEqual(transport.getAgentHistoryCalls[1]?.sessionId, '');
		assert.strictEqual(transport.getAgentHistoryCalls[1]?.agentId, '');
		service.dispose();
	});

	test('prune forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.pruneResult = { ok: true, message: 'pruned', removedCount: 3 };
		const result = await service.prune({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.pruneCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, transport.pruneResult);

		transport.pruneResult = { ok: false, message: 'busy', removedCount: 0 };
		const empty = await service.prune({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, transport.pruneResult);
		assert.strictEqual(transport.pruneCalls[1]?.sessionId, '');
		assert.strictEqual(transport.pruneCalls[1]?.agentId, '');
		service.dispose();
	});

	test('resetAgent forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.resetAgentResult = { ok: true, message: 'reset' };
		const result = await service.resetAgent({ sessionId: 'sess-1', agentId: 'root', clearProfileOnly: true });
		assert.deepStrictEqual(transport.resetAgentCalls, [{ sessionId: 'sess-1', agentId: 'root', clearProfileOnly: true }]);
		assert.deepStrictEqual(result, transport.resetAgentResult);

		transport.resetAgentResult = { ok: false, message: 'already empty' };
		const empty = await service.resetAgent({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, transport.resetAgentResult);
		assert.strictEqual(transport.resetAgentCalls[1]?.sessionId, '');
		assert.strictEqual(transport.resetAgentCalls[1]?.agentId, '');
		service.dispose();
	});

	test('branch forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.branchResult = { ok: true, message: 'switched', currentBranch: 2, totalBranches: 3, currentTurnId: 'turn-9' };
		const result = await service.branch({ sessionId: 'sess-1', agentId: 'root', branchIndex: 1, turnId: 'turn-1' });
		assert.deepStrictEqual(transport.branchCalls, [{ sessionId: 'sess-1', agentId: 'root', branchIndex: 1, turnId: 'turn-1' }]);
		assert.deepStrictEqual(result, transport.branchResult);

		transport.branchResult = { ok: false, message: 'no branch', currentBranch: 0, totalBranches: 0 };
		const empty = await service.branch({ sessionId: '', agentId: '', branchIndex: -1, turnId: '' });
		assert.deepStrictEqual(empty, transport.branchResult);
		assert.strictEqual(transport.branchCalls[1]?.sessionId, '');
		assert.strictEqual(transport.branchCalls[1]?.agentId, '');
		assert.strictEqual(transport.branchCalls[1]?.branchIndex, -1);
		assert.strictEqual(transport.branchCalls[1]?.turnId, '');
		service.dispose();
	});

	test('shelveSession forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.shelveSession({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.shelveSessionCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.shelveSessionResult = { ok: false, message: 'not found' };
		const failed = await service.shelveSession({ sessionId: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not found' });
		assert.strictEqual(transport.shelveSessionCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('purgeSession forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.purgeSession({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.purgeSessionCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.purgeSessionResult = { ok: false, message: 'not found' };
		const failed = await service.purgeSession({ sessionId: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not found' });
		assert.strictEqual(transport.purgeSessionCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('deleteSnapshot forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.deleteSnapshotResult = { ok: true };
		const result = await service.deleteSnapshot({ sessionId: 'sess-1', snapshotId: 'snap-1' });
		assert.deepStrictEqual(transport.deleteSnapshotCalls, [{ sessionId: 'sess-1', snapshotId: 'snap-1' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.deleteSnapshotResult = { ok: false, message: 'denied' };
		const failed = await service.deleteSnapshot({ sessionId: '', snapshotId: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'denied' });
		assert.strictEqual(transport.deleteSnapshotCalls[1]?.sessionId, '');
		assert.strictEqual(transport.deleteSnapshotCalls[1]?.snapshotId, '');
		service.dispose();
	});

	test('resumeSession forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.resumeSessionResult = {
			ok: true,
			rootAgent: {
				agentId: 'root',
				name: 'Root',
				type: 'AGENT_TYPE_UNKNOWN',
				status: 'AGENT_STATUS_UNKNOWN',
				model: 'gpt',
				turnCount: 2,
				createdAt: 10,
				children: [],
			},
		};
		const result = await service.resumeSession({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.resumeSessionCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, transport.resumeSessionResult);

		transport.resumeSessionResult = { ok: false, message: 'not found' };
		const failed = await service.resumeSession({ sessionId: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not found' });
		assert.strictEqual(transport.resumeSessionCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('unshelveSession forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const result = await service.unshelveSession({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.unshelveSessionCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, { ok: true });

		transport.unshelveSessionResult = { ok: false, message: 'not found' };
		const failed = await service.unshelveSession({ sessionId: '' });
		assert.deepStrictEqual(failed, { ok: false, message: 'not found' });
		assert.strictEqual(transport.unshelveSessionCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('prewarmSessions forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.prewarmSessionsResult = {
			entries: [{ sessionId: 'sess-1', outcome: 'PREWARM_SESSION_OUTCOME_RESTORED', message: 'ok' }],
		};
		const result = await service.prewarmSessions({ sessionIds: ['sess-1'] });
		assert.deepStrictEqual(transport.prewarmSessionsCalls, [{ sessionIds: ['sess-1'] }]);
		assert.deepStrictEqual(result, transport.prewarmSessionsResult);

		transport.prewarmSessionsResult = { entries: [] };
		const empty = await service.prewarmSessions({ sessionIds: [''] });
		assert.deepStrictEqual(empty, transport.prewarmSessionsResult);
		assert.deepStrictEqual(transport.prewarmSessionsCalls[1]?.sessionIds, ['']);
		service.dispose();
	});

	test('exportSession forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.exportSessionResult = { content: '# sess', format: 'markdown' };
		const result = await service.exportSession({ sessionId: 'sess-1', format: 'markdown' });
		assert.deepStrictEqual(transport.exportSessionCalls, [{ sessionId: 'sess-1', format: 'markdown' }]);
		assert.deepStrictEqual(result, { content: '# sess', format: 'markdown' });

		transport.exportSessionResult = { content: '', format: '' };
		const empty = await service.exportSession({ sessionId: '', format: '' });
		assert.deepStrictEqual(empty, { content: '', format: '' });
		assert.strictEqual(transport.exportSessionCalls[1]?.sessionId, '');
		assert.strictEqual(transport.exportSessionCalls[1]?.format, '');
		service.dispose();
	});

	test('resolveTurn forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.resolveTurnResult = {
			kind: 'hit',
			envelope: { id: 'env-1' },
			presence: 'ENVELOPE_RECORD_PRESENCE_ACTIVE_OFF_PATH',
			generation: 2,
		};
		const result = await service.resolveTurn({ sessionId: 'sess-1', turnId: 'turn-1', currentLeafTurnId: 'leaf-1' });
		assert.deepStrictEqual(transport.resolveTurnCalls, [{ sessionId: 'sess-1', turnId: 'turn-1', currentLeafTurnId: 'leaf-1' }]);
		assert.deepStrictEqual(result, transport.resolveTurnResult);

		transport.resolveTurnResult = { kind: 'expired', sessionId: '', envelopeId: '' };
		const empty = await service.resolveTurn({ sessionId: '', turnId: '', currentLeafTurnId: '' });
		assert.deepStrictEqual(empty, transport.resolveTurnResult);
		assert.strictEqual(transport.resolveTurnCalls[1]?.sessionId, '');
		assert.strictEqual(transport.resolveTurnCalls[1]?.turnId, '');
		assert.strictEqual(transport.resolveTurnCalls[1]?.currentLeafTurnId, '');
		service.dispose();
	});

	test('getAgentStatus forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.getAgentStatusResult = {
			agent: {
				agentId: 'root',
				name: 'Root',
				type: 'AGENT_TYPE_UNKNOWN',
				status: 'AGENT_STATUS_IDLE',
				model: 'gpt',
				turnCount: 2,
				createdAt: 10,
				children: [],
			},
		};
		const result = await service.getAgentStatus({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.getAgentStatusCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, transport.getAgentStatusResult);

		transport.getAgentStatusResult = {};
		const empty = await service.getAgentStatus({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, transport.getAgentStatusResult);
		assert.strictEqual(transport.getAgentStatusCalls[1]?.sessionId, '');
		assert.strictEqual(transport.getAgentStatusCalls[1]?.agentId, '');
		service.dispose();
	});

	test('compact forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.compactResult = {
			ok: true,
			message: 'compacted',
			tokensBefore: 1200,
			tokensAfter: 400,
			outcome: 'COMPACT_OUTCOME_SUCCEEDED',
			rejectReason: '',
		};
		const result = await service.compact({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.compactCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, transport.compactResult);

		transport.compactResult = { ok: false, message: 'busy', outcome: 'COMPACT_OUTCOME_FAILED', rejectReason: 'ADMISSION_BUSY' };
		const empty = await service.compact({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, transport.compactResult);
		assert.strictEqual(transport.compactCalls[1]?.sessionId, '');
		assert.strictEqual(transport.compactCalls[1]?.agentId, '');
		service.dispose();
	});

	test('listAgents forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.listAgentsResult = {
			agents: [{
				agentId: 'root',
				name: 'Root',
				type: 'AGENT_TYPE_UNKNOWN',
				status: 'AGENT_STATUS_IDLE',
				model: 'gpt',
				turnCount: 2,
				createdAt: 10,
				children: [],
			}],
		};
		const result = await service.listAgents({ sessionId: 'sess-1' });
		assert.deepStrictEqual(transport.listAgentsCalls, [{ sessionId: 'sess-1' }]);
		assert.deepStrictEqual(result, transport.listAgentsResult);

		transport.listAgentsResult = { agents: [] };
		const empty = await service.listAgents({ sessionId: '' });
		assert.deepStrictEqual(empty, { agents: [] });
		assert.strictEqual(transport.listAgentsCalls[1]?.sessionId, '');
		service.dispose();
	});

	test('pauseAgent forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.pauseAgentResult = { ok: true, message: 'paused' };
		const result = await service.pauseAgent({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.pauseAgentCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, transport.pauseAgentResult);

		transport.pauseAgentResult = { ok: false, message: 'already idle' };
		const empty = await service.pauseAgent({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, transport.pauseAgentResult);
		assert.strictEqual(transport.pauseAgentCalls[1]?.sessionId, '');
		assert.strictEqual(transport.pauseAgentCalls[1]?.agentId, '');
		service.dispose();
	});

	test('suspendLoop forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.suspendLoopResult = { ok: true, message: 'suspended' };
		const result = await service.suspendLoop({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.suspendLoopCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, transport.suspendLoopResult);

		transport.suspendLoopResult = { ok: false, message: 'already suspended' };
		const empty = await service.suspendLoop({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, transport.suspendLoopResult);
		assert.strictEqual(transport.suspendLoopCalls[1]?.sessionId, '');
		assert.strictEqual(transport.suspendLoopCalls[1]?.agentId, '');
		service.dispose();
	});

	test('resumeLoop forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.resumeLoopResult = { ok: true, message: 'resumed' };
		const result = await service.resumeLoop({ sessionId: 'sess-1', agentId: 'root' });
		assert.deepStrictEqual(transport.resumeLoopCalls, [{ sessionId: 'sess-1', agentId: 'root' }]);
		assert.deepStrictEqual(result, transport.resumeLoopResult);

		transport.resumeLoopResult = { ok: false, message: 'not suspended' };
		const empty = await service.resumeLoop({ sessionId: '', agentId: '' });
		assert.deepStrictEqual(empty, transport.resumeLoopResult);
		assert.strictEqual(transport.resumeLoopCalls[1]?.sessionId, '');
		assert.strictEqual(transport.resumeLoopCalls[1]?.agentId, '');
		service.dispose();
	});

	test('stopLoop forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.stopLoopResult = { ok: true, message: 'stopped' };
		const result = await service.stopLoop({ sessionId: 'sess-1', agentId: 'root', detail: 'user_stop' });
		assert.deepStrictEqual(transport.stopLoopCalls, [{ sessionId: 'sess-1', agentId: 'root', detail: 'user_stop' }]);
		assert.deepStrictEqual(result, transport.stopLoopResult);

		transport.stopLoopResult = { ok: false, message: 'not in loop' };
		const empty = await service.stopLoop({ sessionId: '', agentId: '', detail: '' });
		assert.deepStrictEqual(empty, transport.stopLoopResult);
		assert.strictEqual(transport.stopLoopCalls[1]?.sessionId, '');
		assert.strictEqual(transport.stopLoopCalls[1]?.agentId, '');
		assert.strictEqual(transport.stopLoopCalls[1]?.detail, '');
		service.dispose();
	});

	test('back forwards request and maps result', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		transport.backResult = { ok: true, message: 'backed', currentTurnId: 'turn-parent' };
		const result = await service.back({ sessionId: 'sess-1', agentId: 'root', operationId: 'op-1' });
		assert.deepStrictEqual(transport.backCalls, [{ sessionId: 'sess-1', agentId: 'root', operationId: 'op-1' }]);
		assert.deepStrictEqual(result, transport.backResult);

		transport.backResult = { ok: false, message: 'empty leaf', currentTurnId: '' };
		const empty = await service.back({ sessionId: '', agentId: '', operationId: '' });
		assert.deepStrictEqual(empty, transport.backResult);
		assert.strictEqual(transport.backCalls[1]?.sessionId, '');
		assert.strictEqual(transport.backCalls[1]?.agentId, '');
		assert.strictEqual(transport.backCalls[1]?.operationId, '');
		service.dispose();
	});

	test('openChatStream forwards transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openChatStream('sess-1', () => { }, cause => seen.push(cause));
		assert.deepStrictEqual(transport.chatOpens, ['sess-1']);
		transport.fireChatClosed({ kind: 'remote' });
		transport.fireChatClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);
		handle.dispose();
		service.dispose();
	});

	test('openChatStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openChatStream('sess-1', () => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireChatClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('openContinuationStream forwards request and transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openContinuationStream({
			sessionId: 'sess-1',
			agentId: 'agent-a',
			turnId: 'turn-9',
			messageId: 'msg-3',
		}, () => { }, cause => seen.push(cause));
		assert.deepStrictEqual(transport.continuationOpens, [{
			sessionId: 'sess-1',
			agentId: 'agent-a',
			turnId: 'turn-9',
			messageId: 'msg-3',
		}]);
		transport.fireContinuationClosed({ kind: 'remote' });
		transport.fireContinuationClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);
		handle.dispose();
		service.dispose();
	});

	test('openContinuationStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openContinuationStream({
			sessionId: 'sess-1',
			agentId: 'agent-a',
			turnId: 'turn-9',
			messageId: 'msg-3',
		}, () => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireContinuationClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('openRegenerateStream forwards request and transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openRegenerateStream({
			sessionId: 'sess-1',
			agentId: 'agent-a',
			turnId: 'turn-9',
			messageId: 'msg-3',
		}, () => { }, cause => seen.push(cause));
		assert.deepStrictEqual(transport.regenerateOpens, [{
			sessionId: 'sess-1',
			agentId: 'agent-a',
			turnId: 'turn-9',
			messageId: 'msg-3',
		}]);
		transport.fireRegenerateClosed({ kind: 'remote' });
		transport.fireRegenerateClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);

		service.openRegenerateStream({
			sessionId: '',
			agentId: '',
			turnId: '',
			messageId: '',
		}, () => { });
		assert.strictEqual(transport.regenerateOpens[1]?.sessionId, '');
		assert.strictEqual(transport.regenerateOpens[1]?.agentId, '');
		assert.strictEqual(transport.regenerateOpens[1]?.turnId, '');
		assert.strictEqual(transport.regenerateOpens[1]?.messageId, '');
		handle.dispose();
		service.dispose();
	});

	test('openRegenerateStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openRegenerateStream({
			sessionId: 'sess-1',
			agentId: 'agent-a',
			turnId: 'turn-9',
			messageId: 'msg-3',
		}, () => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireRegenerateClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('openResumeStream forwards request and transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openResumeStream({
			sessionId: 'sess-1',
			agentId: 'agent-a',
		}, () => { }, cause => seen.push(cause));
		assert.deepStrictEqual(transport.resumeOpens, [{
			sessionId: 'sess-1',
			agentId: 'agent-a',
		}]);
		transport.fireResumeClosed({ kind: 'remote' });
		transport.fireResumeClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);

		service.openResumeStream({
			sessionId: '',
			agentId: '',
		}, () => { });
		assert.strictEqual(transport.resumeOpens[1]?.sessionId, '');
		assert.strictEqual(transport.resumeOpens[1]?.agentId, '');
		handle.dispose();
		service.dispose();
	});

	test('openResumeStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openResumeStream({
			sessionId: 'sess-1',
			agentId: 'agent-a',
		}, () => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireResumeClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('openSubscribeToolDetailStream forwards request and transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openSubscribeToolDetailStream({
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
			detailKind: 2,
			refId: 'ref-9',
			fromRevision: 3,
		}, () => { }, cause => seen.push(cause));
		assert.deepStrictEqual(transport.subscribeToolDetailOpens, [{
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
			detailKind: 2,
			refId: 'ref-9',
			fromRevision: 3,
		}]);
		transport.fireSubscribeToolDetailClosed({ kind: 'remote' });
		transport.fireSubscribeToolDetailClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);

		service.openSubscribeToolDetailStream({
			sessionId: '',
			toolCallId: '',
			detailKind: 0,
			refId: '',
			fromRevision: 0,
		}, () => { });
		assert.strictEqual(transport.subscribeToolDetailOpens[1]?.sessionId, '');
		assert.strictEqual(transport.subscribeToolDetailOpens[1]?.toolCallId, '');
		assert.strictEqual(transport.subscribeToolDetailOpens[1]?.refId, '');
		handle.dispose();
		service.dispose();
	});

	test('openSubscribeToolDetailStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openSubscribeToolDetailStream({
			sessionId: 'sess-1',
			toolCallId: 'tc-1',
			detailKind: 0,
			refId: 'ref-1',
			fromRevision: 0,
		}, () => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireSubscribeToolDetailClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('openRebuildMemoryStream forwards request and transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openRebuildMemoryStream({
			scope: 'project',
			dryRun: true,
		}, () => { }, cause => seen.push(cause));
		assert.deepStrictEqual(transport.rebuildMemoryOpens, [{
			scope: 'project',
			dryRun: true,
		}]);
		transport.fireRebuildMemoryClosed({ kind: 'remote' });
		transport.fireRebuildMemoryClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);

		service.openRebuildMemoryStream({
			scope: '',
			dryRun: false,
		}, () => { });
		assert.strictEqual(transport.rebuildMemoryOpens[1]?.scope, '');
		assert.strictEqual(transport.rebuildMemoryOpens[1]?.dryRun, false);
		handle.dispose();
		service.dispose();
	});

	test('openRebuildMemoryStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openRebuildMemoryStream({
			scope: '',
			dryRun: false,
		}, () => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireRebuildMemoryClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('openWatchConfigStream forwards request and transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openWatchConfigStream({
			keys: ['model.id', ''],
		}, () => { }, cause => seen.push(cause));
		assert.deepStrictEqual(transport.watchConfigOpens, [{
			keys: ['model.id', ''],
		}]);
		transport.fireWatchConfigClosed({ kind: 'remote' });
		transport.fireWatchConfigClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);

		service.openWatchConfigStream({
			keys: [],
		}, () => { });
		assert.deepStrictEqual(transport.watchConfigOpens[1]?.keys, []);
		handle.dispose();
		service.dispose();
	});

	test('openWatchConfigStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openWatchConfigStream({
			keys: [''],
		}, () => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireWatchConfigClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('openUploadAttachmentStream forwards writes and transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openUploadAttachmentStream(() => { }, cause => seen.push(cause));
		assert.strictEqual(transport.uploadAttachmentOpenCount, 1);
		handle.write({
			header: {
				transferId: 'xfer-1',
				filename: 'a.bin',
				totalSize: 3,
				mimeType: 'application/octet-stream',
				checksumSha256: 'abc',
				isPrecompressed: false,
				sessionId: 'sess-1',
				chunkSize: 2,
				queueItemId: 'q-1',
			},
			offset: 0,
		});
		handle.write({
			chunk: new Uint8Array([1, 2, 3]),
			offset: 0,
		});
		assert.deepStrictEqual(transport.uploadAttachmentWrites, [{
			header: {
				transferId: 'xfer-1',
				filename: 'a.bin',
				totalSize: 3,
				mimeType: 'application/octet-stream',
				checksumSha256: 'abc',
				isPrecompressed: false,
				sessionId: 'sess-1',
				chunkSize: 2,
				queueItemId: 'q-1',
			},
			offset: 0,
		}, {
			chunk: new Uint8Array([1, 2, 3]),
			offset: 0,
		}]);
		transport.fireUploadAttachmentClosed({ kind: 'remote' });
		transport.fireUploadAttachmentClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);

		const empty = service.openUploadAttachmentStream(() => { });
		empty.write({
			header: {
				transferId: '',
				filename: '',
				totalSize: 0,
				mimeType: '',
				checksumSha256: '',
				isPrecompressed: false,
				sessionId: '',
				chunkSize: 0,
				queueItemId: '',
			},
			chunk: new Uint8Array(0),
			offset: 0,
		});
		assert.strictEqual(transport.uploadAttachmentWrites[2]?.header?.transferId, '');
		assert.strictEqual(transport.uploadAttachmentWrites[2]?.header?.filename, '');
		assert.strictEqual(transport.uploadAttachmentWrites[2]?.header?.sessionId, '');
		assert.strictEqual(transport.uploadAttachmentWrites[2]?.header?.queueItemId, '');
		assert.deepStrictEqual(transport.uploadAttachmentWrites[2]?.chunk, new Uint8Array(0));
		handle.dispose();
		empty.dispose();
		service.dispose();
	});

	test('openUploadAttachmentStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openUploadAttachmentStream(() => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireUploadAttachmentClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('openDownloadAttachmentStream forwards request and transport onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openDownloadAttachmentStream({
			filePath: 'att/a.bin',
			offset: 8,
			maxBytes: 64,
			sessionId: 'sess-1',
			artifactId: 'art-1',
		}, () => { }, cause => seen.push(cause));
		assert.deepStrictEqual(transport.downloadAttachmentOpens, [{
			filePath: 'att/a.bin',
			offset: 8,
			maxBytes: 64,
			sessionId: 'sess-1',
			artifactId: 'art-1',
		}]);
		transport.fireDownloadAttachmentClosed({ kind: 'remote' });
		transport.fireDownloadAttachmentClosed({ kind: 'error', message: 'late' });
		assert.deepStrictEqual(seen, [{ kind: 'remote' }]);

		service.openDownloadAttachmentStream({
			filePath: '',
			offset: 0,
			maxBytes: 0,
			sessionId: '',
			artifactId: '',
		}, () => { });
		assert.strictEqual(transport.downloadAttachmentOpens[1]?.filePath, '');
		assert.strictEqual(transport.downloadAttachmentOpens[1]?.offset, 0);
		assert.strictEqual(transport.downloadAttachmentOpens[1]?.maxBytes, 0);
		assert.strictEqual(transport.downloadAttachmentOpens[1]?.sessionId, '');
		assert.strictEqual(transport.downloadAttachmentOpens[1]?.artifactId, '');
		handle.dispose();
		service.dispose();
	});

	test('openDownloadAttachmentStream dispose silences later onClosed', async () => {
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const seen: UniverseAgentSessionStreamCloseCause[] = [];
		const handle = service.openDownloadAttachmentStream({
			filePath: '',
			offset: 0,
			maxBytes: 0,
			sessionId: '',
			artifactId: '',
		}, () => { }, cause => seen.push(cause));
		handle.dispose();
		transport.fireDownloadAttachmentClosed({ kind: 'error', message: 'CANCELLED' });
		assert.deepStrictEqual(seen, []);
		service.dispose();
	});

	test('pairing-pending => isEngineConnected === false', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				pairingNonce: 'nonce-1',
				sasCode: 'ABCD-EFGH',
				methods: ['ToolService.ListSkills'],
				events: [],
			}),
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		assert.strictEqual(service.isEngineConnected(), false);
		assert.strictEqual(service.getConnectionSnapshot().pairingPending, true);
		service.dispose();
	});

	test('GrpcCapabilityProbe UNIMPLEMENTED on skills => UNSUPPORTED', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['ToolService.ListSkills'],
				events: [],
			}),
			probeRpc: async () => GrpcStatusCode.UNIMPLEMENTED,
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		assert.strictEqual(service.getCapabilitySnapshot().skills.support, 'UNSUPPORTED');
		assert.strictEqual(service.getCapabilitySnapshot().skills.reason, 'UNIMPLEMENTED');
		service.dispose();
	});

	test('transport failure => transport failed rather than empty list', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: [],
				events: [],
			}),
			listSessions: async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.UNAVAILABLE, 'engine unavailable');
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		await assert.rejects(
			() => service.listSessions({ limit: 10 }),
			(error: unknown) => error instanceof UniverseAgentTransportError,
		);
		assert.strictEqual(service.getTransportState(), 'failed');
		service.dispose();
	});

	test('onDidFileMutation fires joined records from host', () => {
		const service = new UniverseAgentConnectionService({
			createTransport: () => new MockUniverseAgentGrpcTransport(),
		});
		const records: unknown[] = [];
		store.add(service.onDidFileMutation(r => records.push(r)));
		service.notifyFileMutation({
			sessionId: 's1',
			toolCallId: 'tc',
			turnId: 't1',
			agentId: 'a1',
			path: 'p.ts',
			operation: 'edit',
		});
		assert.strictEqual(records.length, 1);
		service.dispose();
	});

	test('onDidTurnSettle fires from host notifyTurnSettle', () => {
		const service = new UniverseAgentConnectionService({
			createTransport: () => new MockUniverseAgentGrpcTransport(),
		});
		const signals: unknown[] = [];
		store.add(service.onDidTurnSettle(s => signals.push(s)));
		service.notifyTurnSettle({
			sessionId: 's1',
			runtimeTurnId: 'runtime-1',
			assistantTurnId: 'assistant-1',
		});
		assert.deepStrictEqual(signals, [{
			sessionId: 's1',
			runtimeTurnId: 'runtime-1',
			assistantTurnId: 'assistant-1',
		}]);
		service.dispose();
	});

	test('agentTree UNIMPLEMENTED probe → UNSUPPORTED capability', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['AgentService.Tree'],
				events: [],
			}),
			probeRpc: async (_service, method) => {
				if (method === 'Tree') {
					return GrpcStatusCode.UNIMPLEMENTED;
				}
				return GrpcStatusCode.OK;
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		assert.strictEqual(service.getCapabilitySnapshot().agentTree.support, 'UNSUPPORTED');
		service.dispose();
	});

	test('AgentService.Tree non-UNIMPLEMENTED failure sets isAgentTreeFetchFailed (D21)', async () => {
		let treeMode: 'fail' | 'ok' = 'fail';
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['AgentService.Tree'],
				events: [],
			}),
			probeRpc: async () => GrpcStatusCode.OK,
			fetchAgentTree: async () => {
				if (treeMode === 'fail') {
					throw new UniverseAgentTransportError(13, 'tree boom');
				}
				return {
					agentId: 'root',
					name: 'Root',
					type: 'AGENT_TYPE_ROOT',
					status: 'AGENT_STATUS_IDLE',
					model: '',
					turnCount: 0,
					createdAt: 0,
					children: [],
				};
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });
		assert.strictEqual(service.isAgentTreeFetchFailed(), false);
		assert.strictEqual(service.getTransportState(), 'ok');

		await assert.rejects(() => service.fetchAgentTree('s1'));
		assert.strictEqual(service.isAgentTreeFetchFailed(), true);
		assert.strictEqual(service.getTransportState(), 'ok');
		assert.strictEqual(service.isEngineConnected(), true);

		treeMode = 'ok';
		const root = await service.fetchAgentTree('s1');
		assert.ok(root);
		assert.strictEqual(service.isAgentTreeFetchFailed(), false);
		service.dispose();
	});

	test('AgentService.Tree UNIMPLEMENTED does not set isAgentTreeFetchFailed', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['AgentService.Tree'],
				events: [],
			}),
			probeRpc: async () => GrpcStatusCode.OK,
			fetchAgentTree: async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.UNIMPLEMENTED, 'no tree');
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });
		await assert.rejects(() => service.fetchAgentTree('s1'));
		assert.strictEqual(service.isAgentTreeFetchFailed(), false);
		assert.strictEqual(service.isAgentTreeUnsupported(), true);
		service.dispose();
	});

	test('disconnect clears isAgentTreeFetchFailed (D21)', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['AgentService.Tree'],
				events: [],
			}),
			probeRpc: async () => GrpcStatusCode.OK,
			fetchAgentTree: async () => {
				throw new UniverseAgentTransportError(13, 'tree boom');
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });
		await assert.rejects(() => service.fetchAgentTree('s1'));
		assert.strictEqual(service.isAgentTreeFetchFailed(), true);

		await service.disconnect();
		assert.strictEqual(service.isAgentTreeFetchFailed(), false);
		service.dispose();
	});

	test('isAgentTreeFetchFailed flip fires onDidChangeConnection (D21)', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['AgentService.Tree'],
				events: [],
			}),
			probeRpc: async () => GrpcStatusCode.OK,
			fetchAgentTree: async () => {
				throw new UniverseAgentTransportError(13, 'tree boom');
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		let fires = 0;
		store.add(service.onDidChangeConnection(() => { fires++; }));
		const before = fires;
		await assert.rejects(() => service.fetchAgentTree('s1'));
		assert.strictEqual(service.isAgentTreeFetchFailed(), true);
		assert.ok(fires > before, 'tree-fetch failure must notify connection listeners');
		service.dispose();
	});

	test('Hub signedIn does not set isEngineConnected (H4a connection-state honesty)', async () => {
		const hubSessionStore = new InMemoryHubSessionStore();
		const service = new UniverseAgentConnectionService({ hubSessionStore });
		await hubSessionStore.applyAuthSession('https://hub.example.com', {
			accessToken: 'token',
			expiresIn: 3600,
			csrfToken: 'csrf',
			mustChangePassword: false,
			user: { id: 'u1', email: 'a@example.com', role: 'user', status: 'active' },
		}, Date.now());
		service.setActiveHubBaseUrl('https://hub.example.com');

		assert.strictEqual(service.getAuthStatus().kind, 'signedIn');
		assert.strictEqual(service.isEngineConnected(), false);
		assert.strictEqual(service.getConnectionPhase().kind, 'disconnected');
		service.dispose();
	});

	test('SaveSkillContent advertised + probe OK => saveSkillContent writes via transport', async () => {
		let saved: UniverseAgentSaveSkillContentRequest | undefined;
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['ToolService.ListSkills', 'ToolService.SaveSkillContent'],
				events: [],
			}),
			probeRpc: async (_service, method) => {
				if (method === UniverseAgentGrpcServices.Tool.SaveSkillContent) {
					return GrpcStatusCode.OK;
				}
				return GrpcStatusCode.OK;
			},
			saveSkillContent: async (request) => {
				saved = request;
				return { ok: true };
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const connection: IUniverseAgentConnection = service;
		assert.strictEqual(typeof connection.saveSkillContent, 'function');
		const result = await connection.saveSkillContent!({
			skillName: 'demo-skill',
			content: '# Demo',
		});
		assert.strictEqual(result.ok, true);
		assert.deepStrictEqual(saved, { skillName: 'demo-skill', content: '# Demo' });
		service.dispose();
	});

	test('SaveSkillContent UNIMPLEMENTED probe => saveSkillContent absent', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['ToolService.ListSkills', 'ToolService.SaveSkillContent'],
				events: [],
			}),
			probeRpc: async (_service, method) => {
				if (method === UniverseAgentGrpcServices.Tool.SaveSkillContent) {
					return GrpcStatusCode.UNIMPLEMENTED;
				}
				return GrpcStatusCode.OK;
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const connection: IUniverseAgentConnection = service;
		assert.strictEqual(connection.saveSkillContent, undefined);
		service.dispose();
	});

	test('saveSkillContent runtime UNIMPLEMENTED => ok false without throwing', async () => {
		const transport = new MockUniverseAgentGrpcTransport({
			connect: async () => ({
				sessionToken: 'token-1',
				methods: ['ToolService.ListSkills', 'ToolService.SaveSkillContent'],
				events: [],
			}),
			probeRpc: async (_service, method) => {
				if (method === UniverseAgentGrpcServices.Tool.SaveSkillContent) {
					return GrpcStatusCode.OK;
				}
				return GrpcStatusCode.OK;
			},
			saveSkillContent: async () => {
				throw new UniverseAgentTransportError(GrpcStatusCode.UNIMPLEMENTED, 'SaveSkillContent not implemented');
			},
		});
		const service = new UniverseAgentConnectionService({
			createTransport: () => transport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });

		const connection: IUniverseAgentConnection = service;
		const result = await connection.saveSkillContent!({
			skillName: 'demo-skill',
			content: '# Demo',
		});
		assert.strictEqual(result.ok, false);
		assert.strictEqual(result.reason, 'UNIMPLEMENTED');
		assert.strictEqual(connection.saveSkillContent, undefined);
		service.dispose();
	});
});

suite('UniverseAgentConnectionService probeConnectionProfile (GC-3)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const identityStore: IClientIdentityStore = {
		getState: async () => ({
			kind: 'ready',
			identity: {
				clientIdentityId: 'a'.repeat(64),
				clientPublicKey: new Uint8Array(32),
				privateKeyPkcs8: new Uint8Array(32),
			},
		}),
		getOrCreateIdentity: async () => ({
			kind: 'ready',
			identity: {
				clientIdentityId: 'a'.repeat(64),
				clientPublicKey: new Uint8Array(32),
				privateKeyPkcs8: new Uint8Array(32),
			},
		}),
		createSigner: async () => undefined,
	};

	test('resolver failure code passes through', async () => {
		const mockResolver = {
			resolve: async () => ({
				ok: false as const,
				code: 'hub_device_revoked' as const,
				reason: 'device revoked',
				allowRelayFallback: false,
			}),
			createIssueRelayTicketHook: () => async () => ({ ok: false as const, code: 'hub_session_required' as const, reason: 'test' }),
		};
		const service = new UniverseAgentConnectionService({
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			clientIdentityStore: identityStore,
			createTransport: () => new MockUniverseAgentGrpcTransport(),
		});
		const result = await service.probeConnectionProfile('profile-1');
		assert.deepStrictEqual(result, { ok: false, code: 'hub_device_revoked', reason: 'device revoked' });
		service.dispose();
	});

	test('getAuthNonce success leaves phase and live transport unchanged', async () => {
		let connectCalls = 0;
		let probeTransportClosed = false;
		class ProbeMockTransport extends MockUniverseAgentGrpcTransport {
			override close(): void {
				probeTransportClosed = true;
				super.close();
			}

			override async connect(): Promise<UniverseAgentConnectResult> {
				connectCalls++;
				return super.connect({ clientId: 'x', protocolVersion: '1' });
			}

			override async connectWithDeviceAuth(): Promise<UniverseAgentConnectResult> {
				connectCalls++;
				return super.connectWithDeviceAuth({
					clientIdentityId: 'a'.repeat(64),
					clientPublicKey: new Uint8Array(32),
					authNonce: new Uint8Array(32),
					signature: new Uint8Array(64),
					protocolVersion: '1',
				});
			}
		}

		const liveTransport = new ProbeMockTransport();
		const mockResolver = {
			resolve: async () => ({
				ok: true as const,
				allowRelayFallback: false,
				endpoint: {
					attemptId: 'a1',
					authority: '203.0.113.10:7443',
					port: 7443,
					resolvedIp: '203.0.113.10',
					servername: '203.0.113.10',
					relayTicketId: null,
					tls: null,
					expiresAtMs: Date.now() + 60_000,
					path: 'direct' as const,
				},
			}),
			createIssueRelayTicketHook: () => async () => ({ ok: false as const, code: 'hub_session_required' as const, reason: 'test' }),
		};
		const service = new UniverseAgentConnectionService({
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			clientIdentityStore: identityStore,
			createTransport: address => address === '203.0.113.10:7443' ? new ProbeMockTransport() : liveTransport,
		});

		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });
		const phaseBefore = service.getConnectionPhase();
		const transportBefore = (service as unknown as { _transport: MockUniverseAgentGrpcTransport })._transport;

		const result = await service.probeConnectionProfile('profile-1');
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.path, 'direct');
			assert.strictEqual(result.authority, '203.0.113.10:7443');
			assert.ok(result.latencyMs >= 0);
		}
		assert.strictEqual(connectCalls, 1, 'probe must not invoke Connect');
		assert.strictEqual(probeTransportClosed, true);
		assert.strictEqual(service.getConnectionPhase(), phaseBefore);
		assert.strictEqual((service as unknown as { _transport: MockUniverseAgentGrpcTransport })._transport, transportBefore);
		service.dispose();
	});
});

const PAIRING_PROFILE_ID = '11111111-1111-4111-8111-111111111111';

class PairingTestProfileStore implements IConnectionProfileStore {
	constructor(private profile: ConnectionProfile) { }

	list(): ConnectionProfile[] {
		return [this.profile];
	}

	get(profileId: string): ConnectionProfile | undefined {
		return profileId === this.profile.profileId ? this.profile : undefined;
	}

	put(profile: ConnectionProfile): void {
		this.profile = profile;
	}

	remove(_profileId: string): void {
	}

	createDraft(input: {
		readonly displayName: string;
		readonly target: ConnectionProfile['target'];
		readonly allowPrivateNetwork?: boolean;
	}): ConnectionProfile {
		return {
			profileId: PAIRING_PROFILE_ID,
			displayName: input.displayName,
			target: input.target,
			trust: null,
			state: 'pairingPending',
			allowPrivateNetwork: input.allowPrivateNetwork ?? false,
		};
	}
}

function createHubDevicePairingProfile(): ConnectionProfile {
	return {
		profileId: PAIRING_PROFILE_ID,
		displayName: 'Studio',
		target: {
			kind: 'hubDevice',
			hubBaseUrl: 'https://hub.example.com',
			accountId: 'usr_1',
			hubDeviceId: 'dev-1',
		},
		trust: null,
		state: 'pairingPending',
		allowPrivateNetwork: false,
	};
}

suite('UniverseAgentConnectionService pairing (GC-1b)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('hubDevice without trust returns pairingPending with handshake sasCode', async () => {
		const profile = createHubDevicePairingProfile();
		const profileStore = new PairingTestProfileStore(profile);
		const mockResolver = {
			resolve: async (_profileId: string, options?: { readonly forPairing?: boolean }) => {
				if (options?.forPairing) {
					return {
						ok: true as const,
						allowRelayFallback: true,
						endpoint: {
							attemptId: 'a1',
							authority: 'relay.example.com',
							port: 443,
							resolvedIp: '203.0.113.1',
							servername: 'relay.example.com',
							relayTicketId: 'ticket-1',
							tls: null,
							expiresAtMs: Date.now() + 60_000,
							path: 'hubRelay' as const,
						},
					};
				}
				return {
					ok: false as const,
					code: 'pairing_required' as const,
					reason: 'pairing required',
					allowRelayFallback: true,
				};
			},
			createIssueRelayTicketHook: () => async () => ({ ok: false as const, code: 'hub_session_required' as const, reason: 'test' }),
		};
		const mockOrchestrator = {
			startPairing: async () => ({
				ok: true as const,
				awaitingUserConfirm: true,
				snapshot: {
					phase: 'awaiting_sas_confirm' as const,
					profileId: PAIRING_PROFILE_ID,
					sasCode: 'ABCD-EFGH',
					engineIdentityId: 'eng-handshake-id',
					sessionTokenInstalled: false,
				},
			}),
			confirmSas: async () => ({ ok: false as const, code: 'unused', reason: 'unused' }),
			confirmRecoverTrust: async () => ({ ok: false as const, code: 'unused', reason: 'unused' }),
			getSnapshot: () => undefined,
			abandonRecoverTrust: () => { },
		};

		const service = new UniverseAgentConnectionService({
			connectionProfileStore: profileStore,
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			pairingOrchestrator: mockOrchestrator as unknown as PairingOrchestrator,
		});

		const result = await service.connectProfile(PAIRING_PROFILE_ID);
		assert.strictEqual(result.ok, true);
		if (result.ok) {
			assert.strictEqual(result.pairingPending, true);
			assert.strictEqual(result.sasCode, 'ABCD-EFGH');
			assert.strictEqual(result.engineIdentityId, 'eng-handshake-id');
		}
		assert.notStrictEqual(service.getConnectionPhase().kind, 'connected');
		service.dispose();
	});

	test('confirmPairing writes trust; cancelPairing leaves trust null', async () => {
		const leafDer = new Uint8Array([1, 2, 3, 4]);
		const trust = createEngineTrustRecord({
			leafDer,
			engineIdentityId: 'eng-handshake-id',
			establishedAt: Date.now(),
		});
		let profile = createHubDevicePairingProfile();
		const profileStore = new PairingTestProfileStore(profile);
		let confirmCalls = 0;
		const mockOrchestrator = {
			startPairing: async () => ({
				ok: true as const,
				awaitingUserConfirm: true,
				snapshot: {
					phase: 'awaiting_sas_confirm' as const,
					profileId: PAIRING_PROFILE_ID,
					sasCode: 'ABCD-EFGH',
					engineIdentityId: 'eng-handshake-id',
					sessionTokenInstalled: false,
				},
			}),
			confirmSas: async () => {
				confirmCalls++;
				profileStore.put({ ...profile, trust, state: 'active' });
				return {
					ok: true as const,
					snapshot: {
						phase: 'idle' as const,
						profileId: PAIRING_PROFILE_ID,
						sessionTokenInstalled: false,
					},
					trust,
					sessionToken: 'session-token',
				};
			},
			confirmRecoverTrust: async () => ({ ok: false as const, code: 'no_recover_trust', reason: 'test' }),
			getSnapshot: () => ({
				phase: 'awaiting_sas_confirm' as const,
				profileId: PAIRING_PROFILE_ID,
				sasCode: 'ABCD-EFGH',
				engineIdentityId: 'eng-handshake-id',
				sessionTokenInstalled: false,
			}),
			abandonRecoverTrust: () => { },
		};
		const mockResolver = {
			resolve: async (_profileId: string, options?: { readonly forPairing?: boolean }) => {
				if (options?.forPairing || profileStore.get(PAIRING_PROFILE_ID)?.trust) {
					return {
						ok: true as const,
						allowRelayFallback: true,
						endpoint: {
							attemptId: 'a1',
							authority: 'relay.example.com',
							port: 443,
							resolvedIp: '203.0.113.1',
							servername: 'relay.example.com',
							relayTicketId: 'ticket-1',
							tls: profileStore.get(PAIRING_PROFILE_ID)?.trust ? {
								trustAnchorLeafDer: leafDer,
								expectedLeafSha256Hex: trust.leafSha256Hex,
								hostnameVerification: 'replaced-by-pin' as const,
							} : null,
							expiresAtMs: Date.now() + 60_000,
							path: 'hubRelay' as const,
						},
					};
				}
				return {
					ok: false as const,
					code: 'pairing_required' as const,
					reason: 'pairing required',
					allowRelayFallback: true,
				};
			},
			createIssueRelayTicketHook: () => async () => ({ ok: false as const, code: 'hub_session_required' as const, reason: 'test' }),
		};

		const service = new UniverseAgentConnectionService({
			connectionProfileStore: profileStore,
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			pairingOrchestrator: mockOrchestrator as unknown as PairingOrchestrator,
			clientIdentityStore: {
				getState: async () => ({ kind: 'encryption_unavailable' as const }),
				getOrCreateIdentity: async () => ({ kind: 'encryption_unavailable' as const }),
				createSigner: async () => undefined,
			},
		});

		await service.connectProfile(PAIRING_PROFILE_ID);
		await service.confirmPairing();
		assert.strictEqual(confirmCalls, 1);
		assert.strictEqual(profileStore.get(PAIRING_PROFILE_ID)?.trust?.engineIdentityId, 'eng-handshake-id');

		profile = createHubDevicePairingProfile();
		const cancelStore = new PairingTestProfileStore(profile);
		const cancelService = new UniverseAgentConnectionService({
			connectionProfileStore: cancelStore,
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			pairingOrchestrator: mockOrchestrator as unknown as PairingOrchestrator,
		});
		await cancelService.connectProfile(PAIRING_PROFILE_ID);
		await cancelService.cancelPairing();
		assert.strictEqual(cancelStore.get(PAIRING_PROFILE_ID)?.trust, null);
		assert.strictEqual(cancelService.getConnectionPhase().kind, 'closed');
		cancelService.dispose();
		service.dispose();
	});

	test('S4 recoverTrust branch does not install session token on startPairing', async () => {
		const profileStore = new PairingTestProfileStore(createHubDevicePairingProfile());
		const mockOrchestrator = {
			startPairing: async () => ({
				ok: true as const,
				awaitingUserConfirm: true,
				snapshot: {
					phase: 'recover_trust' as const,
					profileId: PAIRING_PROFILE_ID,
					engineIdentityId: 'eng-recover',
					leafSha256Hex: 'b'.repeat(64),
					sessionTokenInstalled: false,
				},
			}),
			confirmSas: async () => ({ ok: false as const, code: 'no_active_pairing', reason: 'test' }),
			confirmRecoverTrust: async () => ({ ok: true as const, snapshot: { phase: 'idle' as const, profileId: PAIRING_PROFILE_ID, sessionTokenInstalled: false } }),
			getSnapshot: () => ({
				phase: 'recover_trust' as const,
				profileId: PAIRING_PROFILE_ID,
				engineIdentityId: 'eng-recover',
				leafSha256Hex: 'b'.repeat(64),
				sessionTokenInstalled: false,
			}),
			abandonRecoverTrust: () => { },
		};
		const mockResolver = {
			resolve: async (_profileId: string, options?: { readonly forPairing?: boolean }) => {
				if (options?.forPairing) {
					return {
						ok: true as const,
						allowRelayFallback: true,
						endpoint: {
							attemptId: 'a1',
							authority: 'relay.example.com',
							port: 443,
							resolvedIp: '203.0.113.1',
							servername: 'relay.example.com',
							relayTicketId: 'ticket-1',
							tls: null,
							expiresAtMs: Date.now() + 60_000,
							path: 'hubRelay' as const,
						},
					};
				}
				return { ok: false as const, code: 'pairing_required' as const, reason: 'pairing', allowRelayFallback: true };
			},
			createIssueRelayTicketHook: () => async () => ({ ok: false as const, code: 'hub_session_required' as const, reason: 'test' }),
		};
		const service = new UniverseAgentConnectionService({
			connectionProfileStore: profileStore,
			connectionResolver: mockResolver as unknown as ConnectionResolver,
			pairingOrchestrator: mockOrchestrator as unknown as PairingOrchestrator,
		});

		const started = await service.connectProfile(PAIRING_PROFILE_ID);
		assert.strictEqual(started.ok, true);
		if (started.ok) {
			assert.strictEqual(started.pairingPending, true);
			assert.strictEqual(started.recoverTrust, true);
			assert.strictEqual(started.engineIdentityId, 'eng-recover');
			assert.strictEqual(started.leafSha256Hex, 'b'.repeat(64));
			assert.strictEqual(started.sessionToken, undefined);
			assert.strictEqual(started.sasCode, undefined);
		}
		assert.strictEqual(service.isEngineConnected(), false);
		service.dispose();
	});
});

class RevokeTestProfileStore implements IConnectionProfileStore {
	private profiles: ConnectionProfile[] = [];

	list(): ConnectionProfile[] {
		return [...this.profiles];
	}

	get(profileId: string): ConnectionProfile | undefined {
		return this.profiles.find(p => p.profileId === profileId);
	}

	put(profile: ConnectionProfile): void {
		this.profiles = this.profiles.filter(p => p.profileId !== profile.profileId);
		this.profiles.push(profile);
	}

	remove(profileId: string): void {
		this.profiles = this.profiles.filter(p => p.profileId !== profileId);
	}

	createDraft(input: {
		readonly displayName: string;
		readonly target: ConnectionProfile['target'];
		readonly allowPrivateNetwork?: boolean;
	}): ConnectionProfile {
		return {
			profileId: randomUUID(),
			displayName: input.displayName,
			target: input.target,
			trust: null,
			state: 'active',
			allowPrivateNetwork: input.allowPrivateNetwork ?? false,
		};
	}
}

suite('UniverseAgentConnectionService revokeDevice disconnect (GC-2)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const HUB_BASE = 'https://hub.example.com';
	const FIXTURE_NOW_MS = 1_700_000_000_000;
	const FIXTURE_SESSION: ParsedAuthSessionV1 = {
		accessToken: 'hub-access-token',
		expiresIn: 900,
		csrfToken: 'csrf-token',
		mustChangePassword: false,
		user: {
			id: 'usr_1',
			email: 'user@example.com',
			role: 'USER',
			status: 'ACTIVE',
		},
	};

	async function createConnectedHubDeviceService(hubDeviceId: string): Promise<{
		readonly service: UniverseAgentConnectionService;
		readonly profileId: string;
		readonly transport: MockUniverseAgentGrpcTransport;
	}> {
		const profileStore = new RevokeTestProfileStore();
		const profile = profileStore.createDraft({
			displayName: 'Studio',
			target: { kind: 'hubDevice', hubBaseUrl: HUB_BASE, accountId: 'usr_1', hubDeviceId },
		});
		profileStore.put({ ...profile, state: 'active', trust: null });
		const hubSessionStore = new InMemoryHubSessionStore();
		await hubSessionStore.applyAuthSession(HUB_BASE, FIXTURE_SESSION, FIXTURE_NOW_MS, 'refresh-token');
		const transport = new MockUniverseAgentGrpcTransport();
		const service = new UniverseAgentConnectionService({
			hubSessionStore,
			connectionProfileStore: profileStore,
			nowMs: () => FIXTURE_NOW_MS,
			skipStartupRestore: true,
			createTransport: () => transport,
			http: {
				fetch: async (url: string) => {
					if (url.includes('/revoke')) {
						return { status: 200, json: async () => ({}) };
					}
					if (url.includes('/devices')) {
						return { status: 200, json: async () => ({ devices: [] }) };
					}
					throw new Error(`unexpected fetch url: ${url}`);
				},
			},
		});
		service.setActiveHubBaseUrl(HUB_BASE);
		await service.connect({ clientId: 'vscode-test', protocolVersion: '1' });
		(service as unknown as { _activeProfileId: string })._activeProfileId = profile.profileId;
		assert.strictEqual(service.isEngineConnected(), true);
		return { service, profileId: profile.profileId, transport };
	}

	test('revoke of connected hubDevice profile disconnects once', async () => {
		const { service, profileId, transport } = await createConnectedHubDeviceService('dev-1');
		let closeCount = 0;
		const originalClose = transport.close.bind(transport);
		(transport as { close(): void }).close = () => {
			closeCount++;
			originalClose();
		};

		const result = await service.revokeDevice('dev-1');
		assert.strictEqual(result.ok, true);
		assert.strictEqual(service.isEngineConnected(), false);
		assert.strictEqual(service.getConnectionPhase().kind, 'closed');
		assert.strictEqual(closeCount, 1);
		const stored = (service as unknown as { _connectionProfileStore: IConnectionProfileStore })._connectionProfileStore.get(profileId);
		assert.strictEqual(stored?.state, 'revoked');
		service.dispose();
	});

	test('revoke of a different hubDevice does not disconnect', async () => {
		const { service, transport } = await createConnectedHubDeviceService('dev-active');
		let closeCount = 0;
		const originalClose = transport.close.bind(transport);
		(transport as { close(): void }).close = () => {
			closeCount++;
			originalClose();
		};

		const result = await service.revokeDevice('dev-other');
		assert.strictEqual(result.ok, true);
		assert.strictEqual(service.isEngineConnected(), true);
		assert.strictEqual(closeCount, 0);
		service.dispose();
	});
});
