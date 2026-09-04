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
	UniverseAgentToolInfoRequest,
	UniverseAgentToolInfoResult,
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

	async listModels() {
		return { models: [] };
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
