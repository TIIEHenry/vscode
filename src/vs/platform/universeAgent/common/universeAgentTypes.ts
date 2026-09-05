/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Transport health separate from capability three-state (m6 §5). */
export type UniverseAgentTransportState = 'idle' | 'ok' | 'failed';

/** Keys consumed by Engine page capability matrix (customizations-engine §2). */
export type UniverseAgentCapabilityKey =
	| 'skills'
	| 'mcp'
	| 'mcpRuntime'
	| 'plugins'
	| 'models'
	| 'providerConfig'
	| 'globalRules'
	| 'agentProfiles'
	| 'projectRules'
	| 'tools'
	| 'hooksMetadata'
	| 'agentTree'
	| 'team';

export type UniverseAgentCapabilitySupport = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

export interface UniverseAgentCapabilityEntry {
	readonly support: UniverseAgentCapabilitySupport;
	readonly reason?: string;
}

export type UniverseAgentCapabilitySnapshot = Readonly<Record<UniverseAgentCapabilityKey, UniverseAgentCapabilityEntry>>;

export interface UniverseAgentConnectRequest {
	readonly clientId: string;
	readonly protocolVersion: string;
	readonly workDir?: string;
}

export interface UniverseAgentConnectResult {
	readonly sessionToken?: string;
	readonly workDir?: string;
	readonly pairingNonce?: string;
	readonly sasCode?: string;
	readonly methods: readonly string[];
	readonly events: readonly string[];
}

export interface UniverseAgentSessionSummary {
	readonly sessionId: string;
	readonly title?: string;
	readonly status?: string;
	readonly createdAt?: number;
	readonly lastAccessedAt?: number;
	readonly turnCount?: number;
	readonly model?: string;
}

export interface UniverseAgentListSessionsRequest {
	readonly limit?: number;
	readonly offset?: number;
}

export interface UniverseAgentListSessionsResult {
	readonly sessions: readonly UniverseAgentSessionSummary[];
	readonly totalCount?: number;
}

export interface UniverseAgentCreateSessionRequest {
	readonly title?: string;
	readonly model?: string;
}

export interface UniverseAgentCreateSessionResult {
	readonly sessionId: string;
}

export interface UniverseAgentDeleteSessionRequest {
	readonly sessionId: string;
}

/** SessionService.Info — session metadata + root AgentInfo (≠ List / Create / Resume). */
export interface UniverseAgentSessionInfoRequest {
	readonly sessionId: string;
}

export interface UniverseAgentSessionInfoResult {
	readonly sessionId: string;
	readonly rootAgent?: UniverseAgentAgentTreeNode;
	readonly createdAt: number;
	readonly lastAccessedAt: number;
	readonly provider: string;
	readonly model: string;
}

/** SessionService.Resume — restore a persisted session (≠ Agent.ResumeQueue / Chat resume). */
export interface UniverseAgentResumeSessionRequest {
	readonly sessionId: string;
}

export interface UniverseAgentResumeSessionResult {
	readonly ok: boolean;
	readonly message?: string;
	readonly rootAgent?: UniverseAgentAgentTreeNode;
}

/** SessionService.Prewarm — explicit session restore batch (≠ Resume / Shelve / Unshelve / List). */
export interface UniverseAgentPrewarmSessionsRequest {
	/** Proto `session_ids`. Empty list / empty ids sent as-is. */
	readonly sessionIds: readonly string[];
}

export interface UniverseAgentPrewarmSessionEntry {
	readonly sessionId: string;
	/** PrewarmSessionOutcomeProto name, e.g. `PREWARM_SESSION_OUTCOME_RESTORED`. */
	readonly outcome: string;
	readonly message: string;
}

export interface UniverseAgentPrewarmSessionsResult {
	readonly entries: readonly UniverseAgentPrewarmSessionEntry[];
}

/** SessionService.Shelve — park a session without deleting it (≠ Delete / Unshelve / Resume). */
export interface UniverseAgentShelveSessionRequest {
	readonly sessionId: string;
}

export interface UniverseAgentShelveSessionResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** SessionService.Unshelve — restore a shelved session to the listed set (≠ Shelve / Resume / Delete). */
export interface UniverseAgentUnshelveSessionRequest {
	readonly sessionId: string;
}

export interface UniverseAgentUnshelveSessionResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** SessionService.Purge — permanently erase a session (≠ Delete / Shelve / Unshelve / Export). */
export interface UniverseAgentPurgeSessionRequest {
	readonly sessionId: string;
}

export interface UniverseAgentPurgeSessionResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** SessionService.Export — dump a session as markdown/json (≠ Shelve / Unshelve / Resume / Delete). */
export interface UniverseAgentExportSessionRequest {
	readonly sessionId: string;
	readonly format: string;
}

export interface UniverseAgentExportSessionResult {
	readonly content: string;
	readonly format: string;
}

/** SessionService.ResolveTurn — turn→CHAT envelope lookup (≠ ResolveAnchor / GetHistory / Export). */
export interface UniverseAgentResolveTurnRequest {
	readonly sessionId: string;
	readonly turnId: string;
	readonly currentLeafTurnId: string;
}

export interface UniverseAgentResolveTurnHit {
	readonly kind: 'hit';
	readonly envelope: unknown;
	readonly presence: string;
	readonly generation?: number;
}

export interface UniverseAgentResolveTurnTombstone {
	readonly kind: 'tombstone';
	readonly sessionId: string;
	readonly envelopeId: string;
	readonly seq: number;
	readonly turnId?: string;
	readonly generation?: number;
}

export interface UniverseAgentResolveTurnExpired {
	readonly kind: 'expired';
	readonly sessionId: string;
	readonly envelopeId: string;
	readonly generation?: number;
}

export interface UniverseAgentResolveTurnUnspecified {
	readonly kind: 'unspecified';
}

export type UniverseAgentResolveTurnResult =
	| UniverseAgentResolveTurnHit
	| UniverseAgentResolveTurnTombstone
	| UniverseAgentResolveTurnExpired
	| UniverseAgentResolveTurnUnspecified;

/** AgentService.Status — current AgentInfo for one session agent (≠ Session.Info / Tree). */
export interface UniverseAgentAgentStatusRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentAgentStatusResult {
	readonly agent?: UniverseAgentAgentTreeNode;
}

/** AgentService.Todo — current TODO list for one session agent (≠ Status / Tree). */
export interface UniverseAgentTodoRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

/** AgentService.Compact — manual context compaction (≠ Todo / Status / Tree). */
export interface UniverseAgentCompactRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentTodoItem {
	readonly id: string;
	readonly content: string;
	readonly status: string;
	readonly priority: number;
	readonly requireConfirm: boolean;
	readonly blocked: string;
}

export interface UniverseAgentTodoResult {
	readonly items: readonly UniverseAgentTodoItem[];
}

export interface UniverseAgentCompactResult {
	readonly ok: boolean;
	readonly message?: string;
	readonly tokensBefore?: number;
	readonly tokensAfter?: number;
	/** CompactOutcomeProto name, e.g. `COMPACT_OUTCOME_SUCCEEDED`. */
	readonly outcome?: string;
	readonly rejectReason?: string;
}

/** SessionService.ResolveAnchor — record-layer envelope anchor (ADR-317 §7.2; ≠ ResolveTurn / GetHistory). */
export interface UniverseAgentEnvelopeAnchor {
	readonly sessionId: string;
	readonly envelopeId: string;
	readonly generation?: number;
}

export type UniverseAgentAnchorResolveScope =
	| 'ANCHOR_RESOLVE_SCOPE_UNSPECIFIED'
	| 'ANCHOR_RESOLVE_SCOPE_ACTIVE'
	| 'ANCHOR_RESOLVE_SCOPE_OFF_PATH'
	| 'ANCHOR_RESOLVE_SCOPE_INCLUDING_ARCHIVED';

export type UniverseAgentEnvelopeRecordPresence =
	| 'ENVELOPE_RECORD_PRESENCE_UNSPECIFIED'
	| 'ENVELOPE_RECORD_PRESENCE_ACTIVE_ON_PATH'
	| 'ENVELOPE_RECORD_PRESENCE_ACTIVE_OFF_PATH'
	| 'ENVELOPE_RECORD_PRESENCE_ARCHIVED';

export interface UniverseAgentResolveAnchorRequest {
	readonly anchor: UniverseAgentEnvelopeAnchor;
	readonly scope: UniverseAgentAnchorResolveScope;
	readonly currentLeafTurnId?: string;
}

export interface UniverseAgentAnchorHit {
	/** MessageEnvelopeProto wire object; opaque this catalog slice. */
	readonly envelope: unknown;
	readonly presence: UniverseAgentEnvelopeRecordPresence;
	readonly generation?: number;
}

export interface UniverseAgentAnchorTombstone {
	readonly sessionId: string;
	readonly envelopeId: string;
	readonly seq: number;
	readonly turnId?: string;
	readonly generation?: number;
}

export interface UniverseAgentAnchorExpired {
	readonly anchor: UniverseAgentEnvelopeAnchor;
}

export interface UniverseAgentResolveAnchorResult {
	readonly hit?: UniverseAgentAnchorHit;
	readonly tombstone?: UniverseAgentAnchorTombstone;
	readonly expired?: UniverseAgentAnchorExpired;
}

/** AgentService.Usage — token usage for one session (empty agentId = session rollup). ≠ Todo / Status / Compact. */
export interface UniverseAgentUsageRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentAgentUsage {
	readonly agentId: string;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly turns: number;
}

export interface UniverseAgentRecentRequestSpan {
	readonly profileId: string;
	readonly provider: string;
	readonly modelId: string;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly prefillMs: number;
	readonly decodeMs: number;
	readonly completedAtMs: number;
	readonly usageKind: string;
}

export interface UniverseAgentFixedOverheadInfo {
	readonly toolDefinitionTokens: number;
	readonly toolDefinitionCount: number;
	readonly skillInjectTokens: number;
	readonly mcpToolTokens: number;
	readonly memoryInjectTokens: number;
	readonly rulesInjectTokens: number;
}

export interface UniverseAgentSystemPromptPartInfo {
	readonly id: string;
	readonly label: string;
	readonly tokens: number;
	readonly cacheScope: string;
	readonly volatility: string;
}

export interface UniverseAgentMessageBreakdownInfo {
	readonly systemPromptTokens: number;
	readonly userMessageCount: number;
	readonly userMessageTokens: number;
	readonly assistantCount: number;
	readonly assistantTokens: number;
	readonly toolResultCount: number;
	readonly toolResultTokens: number;
	readonly compactNoticeCount: number;
	readonly compactNoticeTokens: number;
}

export interface UniverseAgentCompactInfo {
	readonly compactCount: number;
	readonly lastCompactTokensBefore: number;
	readonly lastCompactTokensAfter: number;
	readonly lastCompactTimeMs: number;
}

export interface UniverseAgentCacheInfo {
	readonly totalCacheReadTokens: number;
	readonly totalCacheCreationTokens: number;
}

export interface UniverseAgentContextWindowInfo {
	readonly contextWindowSize: number;
	readonly estimatedContextTokens: number;
	readonly modelName: string;
	readonly messageCount: number;
	readonly breakdown?: UniverseAgentMessageBreakdownInfo;
	readonly compact?: UniverseAgentCompactInfo;
	readonly cache?: UniverseAgentCacheInfo;
	readonly fixedOverhead?: UniverseAgentFixedOverheadInfo;
	readonly systemPromptParts: readonly UniverseAgentSystemPromptPartInfo[];
}

export interface UniverseAgentModelUsage {
	readonly modelId: string;
	readonly modelName: string;
	readonly provider: string;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly thinkingTokens: number;
	readonly totalTokens: number;
	readonly turnCount: number;
}

export interface UniverseAgentAgentUsageDetail {
	readonly agentId: string;
	readonly agentType: string;
	readonly modelId: string;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly thinkingTokens: number;
	readonly totalTokens: number;
	readonly turnCount: number;
}

export interface UniverseAgentProfileUsage {
	readonly profileId: string;
	readonly profileName: string;
	readonly provider: string;
	readonly modelId: string;
	readonly chatInputTokens: number;
	readonly chatOutputTokens: number;
	readonly compactInputTokens: number;
	readonly compactOutputTokens: number;
	readonly thinkingTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheCreationTokens: number;
	readonly totalTokens: number;
	readonly conversationTurnCount: number;
	readonly llmRequestCount: number;
	readonly compactRequestCount: number;
	readonly hasPostSwitchChat: boolean;
	readonly recallInputTokens: number;
	readonly recallOutputTokens: number;
	readonly recallRequestCount: number;
}

export interface UniverseAgentSessionUsageInfo {
	readonly totalInputTokens: number;
	readonly totalOutputTokens: number;
	readonly totalThinkingTokens: number;
	readonly totalCacheReadTokens: number;
	readonly totalCacheCreationTokens: number;
	readonly totalTokens: number;
	readonly totalTurns: number;
	readonly modelUsages: readonly UniverseAgentModelUsage[];
	readonly agentDetails: readonly UniverseAgentAgentUsageDetail[];
	readonly profileUsages: readonly UniverseAgentProfileUsage[];
}

export interface UniverseAgentUsageResult {
	readonly totalInputTokens: number;
	readonly totalOutputTokens: number;
	readonly totalTurns: number;
	readonly agentUsages: readonly UniverseAgentAgentUsage[];
	readonly contextWindow?: UniverseAgentContextWindowInfo;
	readonly sessionUsage?: UniverseAgentSessionUsageInfo;
	readonly recentRequestSpans: readonly UniverseAgentRecentRequestSpan[];
}

/** AgentService.List — flat AgentInfo roster for one session (≠ Tree / Status / ListAgentProfiles). */
export interface UniverseAgentListAgentsRequest {
	readonly sessionId: string;
}

export interface UniverseAgentListAgentsResult {
	readonly agents: readonly UniverseAgentAgentTreeNode[];
}

/** AgentService.History — paginated agent transcript (≠ Session.GetHistory). */
export interface UniverseAgentAgentHistoryRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly limit: number;
	readonly offset: number;
}

export interface UniverseAgentAgentHistoryEntry {
	readonly role: string;
	readonly content: string;
	readonly timestamp: number;
	readonly agentId: string;
}

export interface UniverseAgentAgentHistoryResult {
	readonly entries: readonly UniverseAgentAgentHistoryEntry[];
	readonly total: number;
}

/** AgentService.Pause — pause agent generation (≠ PauseQueue / Cancel / SuspendLoop / Resume / Back). */
export interface UniverseAgentPauseAgentRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentPauseAgentResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.Back — revert to parent turn / delete current leaf (≠ Pause / PauseQueue / Prune / DeleteMessage). */
export interface UniverseAgentBackRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly operationId: string;
}

export interface UniverseAgentBackResult {
	readonly ok: boolean;
	readonly message?: string;
	readonly currentTurnId?: string;
}

/** AgentService.Prune — drop inactive conversation branches (≠ Reset / Back / Compact). */
export interface UniverseAgentPruneRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentPruneResult {
	readonly ok: boolean;
	readonly message?: string;
	readonly removedCount: number;
}

/** AgentService.Reset — reset conversation tree (≠ ResetAgentProfile / Prune / Branch / Back). */
export interface UniverseAgentResetAgentRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** true: only drop runtime profile binding (allow profile switch). */
	readonly clearProfileOnly?: boolean;
}

export interface UniverseAgentResetAgentResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.Branch — switch conversation branch / list when branchIndex = -1 (≠ Reset / Back / Prune / EditMessage / Fork). */
export interface UniverseAgentBranchRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** 0-based branch to switch to; -1 lists only. */
	readonly branchIndex: number;
	/** Empty = parent of the current active leaf. */
	readonly turnId: string;
}

export interface UniverseAgentBranchResult {
	readonly ok: boolean;
	readonly message?: string;
	/** 1-based current active branch index. */
	readonly currentBranch: number;
	readonly totalBranches: number;
	readonly currentTurnId?: string;
}

/** AgentService.SuspendLoop — hang loop control-flow (≠ Pause / PauseQueue / Cancel / Resume / ResumeLoop / Branch / StopLoop). */
export interface UniverseAgentSuspendLoopRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentSuspendLoopResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.ResumeLoop — resume hung loop control-flow (≠ Pause / PauseQueue / Cancel / Resume / ResumeQueue / Session.Resume / SuspendLoop / Branch / StopLoop). */
export interface UniverseAgentResumeLoopRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentResumeLoopResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.StopLoop — terminate loop control-flow (≠ Pause / Cancel / SuspendLoop / Resume / ResumeLoop / Branch). */
export interface UniverseAgentStopLoopRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** Empty sent as-is. */
	readonly detail: string;
}

export interface UniverseAgentStopLoopResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.Rename request; empty `title` clears a custom session title. */
export interface UniverseAgentRenameSessionRequest {
	readonly sessionId: string;
	readonly title: string;
}

export interface UniverseAgentRenameSessionResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.Cancel request; session-turn stop (Inbox Stop). Distinct from CancelToolCall. */
export interface UniverseAgentCancelGenerationRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentCancelGenerationResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.CancelToolCall — per-tool cancel (≠ session-turn Cancel). */
export interface UniverseAgentCancelToolCallRequest {
	readonly sessionId: string;
	/** Owning agent; empty/omitted wires as `root`. */
	readonly agentId?: string;
	readonly toolCallId: string;
}

export interface UniverseAgentCancelToolCallResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.RunToolInBackground — mid-flight sync→async promote (≠ CancelToolCall / StopShellTask / Cancel / Resume). */
export interface UniverseAgentRunToolInBackgroundRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly toolCallId: string;
}

export interface UniverseAgentRunToolInBackgroundResult {
	readonly ok: boolean;
	readonly message?: string;
	/** Proto `reason_code`; empty when success. */
	readonly reasonCode?: string;
}

/** AgentService.StopShellTask — stop ShellTask / subprocess after promote (≠ CancelToolCall / RunToolInBackground / Cancel / StopLoop). */
export interface UniverseAgentStopShellTaskRequest {
	readonly sessionId: string;
	readonly taskId: string;
}

export interface UniverseAgentStopShellTaskResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.SendShellSessionClientControl — SHELL_SESSION_BUFFER CONTROL upstream (resize / detach / resync) (≠ StopShellTask / SubscribeToolDetail / FetchToolUsageDetail / CancelToolCall / RunToolInBackground). */
export interface UniverseAgentSendShellSessionClientControlRequest {
	readonly sessionId: string;
	readonly toolCallId: string;
	/** Proto `ref_id` (engine_shell_session_id). Empty sent as-is. */
	readonly refId: string;
	/** Proto `control_payload_json`. Empty sent as-is. */
	readonly controlPayloadJson: string;
}

export interface UniverseAgentSendShellSessionClientControlResult {
	readonly ok: boolean;
	/** Proto `error_message`. */
	readonly message?: string;
	readonly errorCode?: string;
	readonly debounced?: boolean;
	readonly deliveredToSubscribe?: boolean;
}

/** AgentService.FetchToolUsageDetail — on-demand context-source usage (≠ FetchToolDetail / SubscribeToolDetail / Usage / Compact). */
export interface UniverseAgentFetchToolUsageDetailRequest {
	readonly sessionId: string;
	readonly toolCallId: string;
}

/** Proto `ContextSourceUsageProto`. `sourceType` is ContextSourceTypeProto name. */
export interface UniverseAgentContextSourceUsage {
	readonly sourceType: string;
	readonly sourceAgentId?: string;
	readonly sourceScopeId?: string;
	readonly messageId?: string;
	readonly estimatedTokens: number;
}

export interface UniverseAgentFetchToolUsageDetailResult {
	readonly ok: boolean;
	readonly toolCallId: string;
	readonly contextSources: readonly UniverseAgentContextSourceUsage[];
	/** Proto `error_message`. */
	readonly message?: string;
}

/** AgentService.FireTriggerWebhook — D-TF-1 webhook ingress (≠ FetchToolUsageDetail / SubscribeToolDetail / SwitchWorkDir). */
export interface UniverseAgentFireTriggerWebhookRequest {
	readonly sessionId: string;
	readonly triggerId: string;
	/** Proto `payload_json`. Empty sent as-is. */
	readonly payloadJson: string;
}

export interface UniverseAgentFireTriggerWebhookResult {
	/** FireTriggerWebhookStatus name, e.g. `FIRE_TRIGGER_WEBHOOK_STATUS_QUEUED`. */
	readonly status: string;
	readonly eventId: string;
	readonly reason: string;
}

/** AgentService.InstallSessionDemoFake — ADR-264 session-scoped Demo Fake LLM install (≠ FireTriggerWebhook / ClearSessionDemoFake / ChatSync / SyncInputDelivery). */
export interface UniverseAgentInstallSessionDemoFakeRequest {
	readonly sessionId: string;
	/** Proto `queues_payload` (bytes). Empty sent as-is. */
	readonly queuesPayload: Uint8Array;
	/** Proto `content_type`. Empty sent as-is. */
	readonly contentType: string;
	/** Proto `playbook_id`. Empty sent as-is. */
	readonly playbookId: string;
}

export interface UniverseAgentInstallSessionDemoFakeResult {
	readonly ok: boolean;
	readonly message?: string;
	/** Proto `reason_code`. */
	readonly reasonCode: string;
}

/** AgentService.ClearSessionDemoFake — ADR-264 session-scoped Demo Fake LLM clear (≠ InstallSessionDemoFake / FireTriggerWebhook / ChatSync / SyncInputDelivery). */
export interface UniverseAgentClearSessionDemoFakeRequest {
	readonly sessionId: string;
}

export interface UniverseAgentClearSessionDemoFakeResult {
	readonly ok: boolean;
	readonly message?: string;
	/** Proto `reason_code`. */
	readonly reasonCode: string;
}

/** AgentService.SwitchWorkDir — change agent work dir (≠ FireTriggerWebhook / TestModelProfile / Connect.work_dir). */
export interface UniverseAgentSwitchWorkDirRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** Proto `new_work_dir`. Empty sent as-is. */
	readonly newWorkDir: string;
}

export interface UniverseAgentSwitchWorkDirResult {
	readonly ok: boolean;
	readonly previousWorkDir: string;
	readonly currentWorkDir: string;
	readonly message?: string;
}

/** AgentService.TestModelProfile — model-profile connectivity probe (≠ SwitchWorkDir / ListModels / SwitchModel / Config.Get / Config.Set). */
export interface UniverseAgentTestModelProfileRequest {
	readonly providerId: string;
	readonly modelId: string;
	/** Proto `api_key`. Empty sent as-is. */
	readonly apiKey: string;
	/** Proto `base_url`. Empty sent as-is. */
	readonly baseUrl: string;
	readonly protocol: string;
	/** Proto `params` map. Empty sent as-is. */
	readonly params: Readonly<Record<string, string>>;
}

export interface UniverseAgentTestModelProfileResult {
	readonly ok: boolean;
	/** Proto `error_message`. */
	readonly message?: string;
}

/** ConfigService.Set — generic KV write (≠ Get / Watch / ListModels / SwitchModel). */
export interface UniverseAgentSetConfigRequest {
	readonly key: string;
	/** Proto `value`. Empty sent as-is. */
	readonly value: string;
	/** Proto `scope`. Empty sent as-is. */
	readonly scope: string;
	/** Proto `session_id`. Empty sent as-is. */
	readonly sessionId: string;
}

export interface UniverseAgentSetConfigResult {
	readonly ok: boolean;
	/** Proto `message`. */
	readonly message?: string;
}

/** ConfigService.SetModelPreferences — session model-strategy write (≠ GetModelPreferences / ResolveModel / SwitchModel / ListModels / Get / Set). */
export interface UniverseAgentSetModelPreferencesRequest {
	readonly sessionId: string;
	/** Proto `min_level`. 0 sent as-is. */
	readonly minLevel: number;
	/** Proto `max_cost`. Empty sent as-is. */
	readonly maxCost: string;
	/** Proto `min_speed`. Empty sent as-is. */
	readonly minSpeed: string;
	/** Proto `strategy`. Empty sent as-is. */
	readonly strategy: string;
}

export interface UniverseAgentSetModelPreferencesResult {
	readonly minLevel: number;
	readonly maxCost: string;
	readonly minSpeed: string;
	readonly strategy: string;
}


/** PermissionService.SetSessionGoal request (Inbox Goal). */
export interface UniverseAgentSetSessionGoalRequest {
	readonly sessionId: string;
	readonly goal: string;
}

export interface UniverseAgentSetSessionGoalResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** PermissionService.CancelSessionGoal request. */
export interface UniverseAgentCancelSessionGoalRequest {
	readonly sessionId: string;
}

export interface UniverseAgentCancelSessionGoalResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** PermissionService.Respond — unary permission reply (connected roster forwards; stub still uses Chat-arm permissionRespond). */
export interface UniverseAgentRespondPermissionRequest {
	readonly sessionId: string;
	readonly requestId: string;
	/** Proto `granted`; allow=true, deny=false. */
	readonly granted: boolean;
	readonly metadataJson?: string;
}

export interface UniverseAgentRespondPermissionResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** PermissionService.SyncPermissionRule — session-scoped tool rule upsert (≠ Respond / SetSessionGoal / PromotePermissionRule / GetSessionRules / SetPermissionMode). */
export type UniverseAgentPermissionRuleAction = 'RULE_ACTION_UNSPECIFIED' | 'ALLOW' | 'DENY';

export interface UniverseAgentSyncPermissionRuleRequest {
	readonly sessionId: string;
	readonly toolName: string;
	readonly scope: string;
	/** Proto `RuleAction` (`ALLOW` / `DENY` / `RULE_ACTION_UNSPECIFIED`). Wired to enum number. */
	readonly action: UniverseAgentPermissionRuleAction;
	/** Proto `reason`. Empty sent as-is. */
	readonly reason: string;
}

export interface UniverseAgentSyncPermissionRuleResult {
	readonly ok: boolean;
	/** Proto `rule_id`. Empty returned as-is. */
	readonly ruleId: string;
}

/** PermissionService.PromotePermissionRule — promote a tool rule to global config (≠ Respond / SetSessionGoal / SyncPermissionRule / GetSessionRules). */
export interface UniverseAgentPromotePermissionRuleRequest {
	readonly toolName: string;
	readonly scope: string;
	/** Proto `RuleAction` (`ALLOW` / `DENY` / `RULE_ACTION_UNSPECIFIED`). Wired to enum number. */
	readonly action: UniverseAgentPermissionRuleAction;
}

export interface UniverseAgentPromotePermissionRuleResult {
	readonly ok: boolean;
}

/** PermissionService.GetSessionRules — list session permission rules (≠ SetSessionGoal / CancelSessionGoal / Respond / SyncPermissionRule / PromotePermissionRule). */
export interface UniverseAgentGetSessionRulesRequest {
	readonly sessionId: string;
}

export interface UniverseAgentSessionRule {
	readonly id: string;
	readonly toolName: string;
	readonly scope: string;
	/** RuleAction name, e.g. `ALLOW`. */
	readonly action: string;
	readonly reason: string;
	readonly createdAt: number;
	readonly expiresAt?: number;
	/** RuleSource name, e.g. `USER_INTERACTIVE`. */
	readonly source: string;
}

export interface UniverseAgentGetSessionRulesResult {
	readonly rules: readonly UniverseAgentSessionRule[];
}

/** PermissionService.SetPermissionMode — session-scoped Ask/Agent/Permit gate (≠ SetSessionGoal / CancelSessionGoal / Respond / SyncPermissionRule / PromotePermissionRule / GetSessionRules). */
export type UniverseAgentSessionToolPermissionMode =
	| 'SESSION_TOOL_PERMISSION_MODE_UNSPECIFIED'
	| 'SESSION_TOOL_PERMISSION_MODE_ASK'
	| 'SESSION_TOOL_PERMISSION_MODE_AGENT'
	| 'SESSION_TOOL_PERMISSION_MODE_PERMIT';

export interface UniverseAgentSetPermissionModeRequest {
	readonly sessionId: string;
	/** Proto `SessionToolPermissionModeProto`. Wired to enum number. */
	readonly mode: UniverseAgentSessionToolPermissionMode;
}

export interface UniverseAgentSetPermissionModeResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** TeamService.TaskUpdate — Manager overwrite of blackboard task status (≠ TaskList / TaskCancel / MemberStatus / TeamInfo / SetPermissionMode). */
export interface UniverseAgentTaskUpdateRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly taskId: string;
	/** Proto `new_status`. Empty sent as-is. */
	readonly newStatus: string;
	/** Proto `message`. Empty sent as-is. */
	readonly message: string;
}

export interface UniverseAgentTaskUpdateResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** TeamService.TaskCancel — Manager cancel of blackboard task (≠ TaskList / TaskUpdate / MemberStatus / TeamInfo / SetPermissionMode). */
export interface UniverseAgentTaskCancelRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly taskId: string;
}

export interface UniverseAgentTaskCancelResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** TeamService.MessageMember — Manager→Member mailbox (≠ TaskUpdate / TaskList / TaskCancel / MemberStatus / TeamInfo / CreateTeam). */
export interface UniverseAgentMessageMemberRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** Proto `member_name`. Empty sent as-is. */
	readonly memberName: string;
	/** Proto `content`. Empty sent as-is. */
	readonly content: string;
}

export interface UniverseAgentMessageMemberResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** TeamService.CreateTeam — create Task Group (≠ TaskList / TaskUpdate / TaskCancel / MessageMember / MemberStatus / TeamInfo / StartMember). */
export interface UniverseAgentCreateTeamRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** Proto `task_descriptions`. Empty list / empty items sent as-is. */
	readonly taskDescriptions: readonly string[];
}

export interface UniverseAgentCreateTeamResult {
	readonly teamId: number;
	readonly memberCount: number;
}

/** TeamService.StartMember — Manager starts a team member (≠ CreateTeam / TaskUpdate / TaskCancel / MessageMember / KillMember / MemberStatus / TeamInfo). */
export interface UniverseAgentStartMemberRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** Proto `member_name`. Empty sent as-is. */
	readonly memberName: string;
	/** Proto `preset_id`. Empty sent as-is. */
	readonly presetId: string;
	/** Proto `system_prompt`. Empty sent as-is. */
	readonly systemPrompt: string;
	/** Proto `model_type`. Empty sent as-is. */
	readonly modelType: string;
	/** Proto `dynamic`. Sent as-is. */
	readonly dynamic: boolean;
}

export interface UniverseAgentStartMemberResult {
	/** Proto `member_agent_id`. Empty sent as-is. */
	readonly memberAgentId: string;
	/** Proto `member_name`. Empty sent as-is. */
	readonly memberName: string;
	readonly dynamic: boolean;
}

/** TeamService.KillMember — Manager terminates a member (≠ StartMember / CreateTeam / TaskCancel / MessageMember / MemberStatus / TeamInfo / Agent.Kill). */
export interface UniverseAgentKillMemberRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** Proto `member_name`. Empty sent as-is. */
	readonly memberName: string;
}

export interface UniverseAgentKillMemberResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** TeamService.Abort — abort entire Team (≠ KillMember / CreateTeam / StartMember / MessageMember / TaskCancel / TeamInfo). */
export interface UniverseAgentAbortTeamRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** Proto `team_id`. Zero sent as-is. */
	readonly teamId: number;
	/** Proto `reason`. Empty sent as-is. */
	readonly reason: string;
}

export interface UniverseAgentAbortTeamResult {
	readonly ok: boolean;
	readonly message?: string;
	/** Proto `stopped_members`. Empty list sent as-is. */
	readonly stoppedMembers: readonly string[];
}

/** One item answer for AgentService.RespondQuestion (QuestionAnswer.selected_labels). */
export interface UniverseAgentQuestionAnswer {
	readonly selectedLabels: readonly string[];
}

/** AgentService.RespondQuestion — unary question reply (ADR-325; ≠ Chat-arm questionRespond). */
export interface UniverseAgentRespondQuestionRequest {
	readonly sessionId: string;
	readonly questionId: string;
	readonly answers?: Readonly<Record<string, UniverseAgentQuestionAnswer>>;
	readonly customText?: string;
}

export interface UniverseAgentRespondQuestionResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService queue hold reason (QueueItemHoldReasonProto). */
export type UniverseAgentQueueHoldReason = 'NONE' | 'EDITING';

/** AgentService queue priority (QueuePriorityProto). */
export type UniverseAgentQueuePriority = 'NORMAL' | 'HIGH' | 'LOW';

/** Shared session+op id for queue mutation RPCs. */
export interface UniverseAgentQueueRefRequest {
	readonly sessionId: string;
	readonly opId?: string;
}

export interface UniverseAgentQueueItemRefRequest extends UniverseAgentQueueRefRequest {
	readonly itemId: string;
}

/** AgentService.DeleteQueueItem — proto QueueItemRefRequest (≠ ReorderQueue / InsertQueueItem / RetryQueueItem / EditQueueItem). */
export type UniverseAgentDeleteQueueItemRequest = UniverseAgentQueueItemRefRequest;

/** AgentService.RetryQueueItem — proto QueueItemRefRequest (≠ DeleteQueueItem / ReorderQueue / InsertQueueItem / EditQueueItem / RetryAllFailed). */
export type UniverseAgentRetryQueueItemRequest = UniverseAgentQueueItemRefRequest;

/** AgentService.RetryAllFailed — proto QueueRefRequest (≠ RetryQueueItem / RetryQueueItemUpload / DeleteQueueItem / ReorderQueue). */
export type UniverseAgentRetryAllFailedRequest = UniverseAgentQueueRefRequest;

/** AgentService.RetryQueueItemUpload — proto QueueItemRefRequest (≠ RetryQueueItem / RetryAllFailed / DeleteQueueItem / PinQueueItem). */
export type UniverseAgentRetryQueueItemUploadRequest = UniverseAgentQueueItemRefRequest;

/** AgentService.PinQueueItem — proto QueueItemRefRequest (≠ RetryQueueItem / RetryQueueItemUpload / DeleteQueueItem / SetQueueItemLocked). */
export type UniverseAgentPinQueueItemRequest = UniverseAgentQueueItemRefRequest;

/** AgentService.SetQueueItemLocked — proto SetQueueItemLockedRequest (≠ PinQueueItem / InjectQueueItem / RetryQueueItemUpload / DeleteQueueItem). */
export interface UniverseAgentSetQueueItemLockedRequest extends UniverseAgentQueueItemRefRequest {
	/** Proto `locked`. Sent as-is. */
	readonly locked: boolean;
}

/** AgentService.InjectQueueItem — proto QueueItemRefRequest (≠ PinQueueItem / SetQueueItemLocked / RetryQueueItemUpload / DeleteQueueItem). */
export type UniverseAgentInjectQueueItemRequest = UniverseAgentQueueItemRefRequest;

/** AgentService.SetQueueItemForkAnchor — proto SetQueueItemForkAnchorRequest (≠ PinQueueItem / SetQueueItemLocked / InjectQueueItem / HoldQueueItem). */
export interface UniverseAgentSetQueueItemForkAnchorRequest extends UniverseAgentQueueItemRefRequest {
	/** Proto `fork_from_turn_id`. Empty sent as-is. */
	readonly forkFromTurnId?: string;
	/** Proto `fork_from_preview`. Empty sent as-is. */
	readonly forkFromPreview?: string;
}

/** AgentService.EnqueueQueueItem. */
export interface UniverseAgentEnqueueQueueItemRequest extends UniverseAgentQueueRefRequest {
	readonly text: string;
	readonly clientMessageId?: string;
	readonly priority?: UniverseAgentQueuePriority;
}

/** AgentService.InsertQueueItem — insert before an existing item (≠ EnqueueQueueItem / ReorderQueue / EditQueueItem / SubscribeToolDetail). */
export interface UniverseAgentInsertQueueItemRequest extends UniverseAgentQueueRefRequest {
	readonly text: string;
	readonly clientMessageId?: string;
	readonly priority?: UniverseAgentQueuePriority;
	/** Proto `before_item_id`. Empty sent as-is. */
	readonly beforeItemId?: string;
}

/** AgentService.ReorderQueue — reorder existing items (≠ EnqueueQueueItem / InsertQueueItem / EditQueueItem / DeleteQueueItem). */
export interface UniverseAgentReorderQueueRequest extends UniverseAgentQueueRefRequest {
	/** Proto `item_ids`. Empty strings sent as-is. */
	readonly itemIds?: readonly string[];
}

/** AgentService.HoldQueueItem. */
export interface UniverseAgentHoldQueueItemRequest extends UniverseAgentQueueItemRefRequest {
	readonly reason: UniverseAgentQueueHoldReason;
}

/** AgentService.EditQueueItem. */
export interface UniverseAgentEditQueueItemRequest extends UniverseAgentQueueItemRefRequest {
	readonly text: string;
}

/** Shared QueueMutationResponse. */
export interface UniverseAgentQueueMutationResult {
	readonly ok: boolean;
	readonly error?: string;
	readonly opId?: string;
	readonly itemId?: string;
}

/** AgentService.Fork request — create a SubAgent. Connected Fork action forwards this; disconnected Fork tab stays local `registerForkChat`. */
export interface UniverseAgentForkAgentRequest {
	readonly sessionId: string;
	/** Parent agent; empty/omitted wires as `root`. */
	readonly parentAgentId?: string;
	readonly name?: string;
	readonly task?: string;
	readonly modelType?: string;
	readonly systemPrompt?: string;
}

export interface UniverseAgentForkAgentResult {
	readonly ok: boolean;
	/** New SubAgent id (e.g. `sub:name`) when `ok`. */
	readonly agentId?: string;
}

/** AgentService.Kill — terminate a SubAgent. Distinct from Cancel / CancelToolCall. */
export interface UniverseAgentKillAgentRequest {
	readonly sessionId: string;
	/** Agent to terminate. Empty is forwarded as-is (not defaulted to `root`). */
	readonly agentId: string;
	/** Force-kill without waiting for the current turn. */
	readonly force?: boolean;
}

export interface UniverseAgentKillAgentResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.DeleteMessage — delete a turn and its subtree (≠ session Delete). */
export interface UniverseAgentDeleteMessageRequest {
	readonly sessionId: string;
	readonly turnId: string;
	/** Owning agent; empty/omitted wires as `root`. */
	readonly agentId?: string;
	/** Client idempotency key; empty lets the engine hash content. */
	readonly operationId?: string;
}

export interface UniverseAgentDeleteMessageResult {
	readonly ok: boolean;
	readonly message?: string;
	readonly currentTurnId?: string;
	readonly removedTurnCount?: number;
}

/** AgentService.EditMessage — edit a user turn's content (≠ EditQueueItem). */
export interface UniverseAgentEditMessageRequest {
	readonly sessionId: string;
	readonly turnId: string;
	readonly newContent: string;
	/** Owning agent; empty/omitted wires as `root`. */
	readonly agentId?: string;
	/** Client idempotency key; empty lets the engine hash content. */
	readonly operationId?: string;
}

export interface UniverseAgentEditMessageResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** Canvas ref on AgentService.SendClientToolResponse (ClientToolResponse.canvas_refs). */
export interface UniverseAgentCanvasRef {
	readonly canvasId: string;
	readonly revisionId: string;
	readonly title: string;
	readonly sourceHash?: string;
}

/** AgentService.SendClientToolResponse — unary client-tool reply (ADR-325; ≠ Chat-arm clientToolRespond). */
export interface UniverseAgentSendClientToolResponseRequest {
	readonly sessionId: string;
	readonly callId: string;
	readonly isError?: boolean;
	readonly content?: string;
	readonly metadataJson?: string;
	readonly canvasRefs?: readonly UniverseAgentCanvasRef[];
}

export interface UniverseAgentSendClientToolResponseResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** One row from AgentService.ListSnapshots (SessionSnapshotInfo). */
export interface UniverseAgentSessionSnapshotInfo {
	readonly id: string;
	readonly sessionId: string;
	readonly title: string;
	readonly description?: string;
	readonly createdAt?: number;
	readonly turnCount?: number;
	readonly tokenCount?: number;
	readonly modelId?: string;
	readonly isAuto?: boolean;
}

/** AgentService.ListSnapshots — session checkpoints (≠ SessionBar History turn index). */
export interface UniverseAgentListSnapshotsRequest {
	readonly sessionId: string;
}

export interface UniverseAgentListSnapshotsResult {
	readonly snapshots: readonly UniverseAgentSessionSnapshotInfo[];
}

/** One row from AgentService.ListLoopSnapshots (LoopSnapshotRecord). */
export interface UniverseAgentLoopSnapshotRecord {
	readonly timestamp?: number;
	readonly turnId: string;
	readonly loopId: string;
	readonly iteration?: number;
	readonly maxIterations?: number;
	readonly goal: string;
	readonly exitCondition: string;
	readonly tmpFileRelativePath: string;
	readonly isExit?: boolean;
	readonly selfSupervise?: string;
	readonly terminalReason?: string;
}

/** AgentService.ListLoopSnapshots — LOOP_SNAPSHOT envelopes (≠ ListSnapshots / SessionBar History). */
export interface UniverseAgentListLoopSnapshotsRequest {
	readonly sessionId: string;
	readonly loopId?: string;
}

export interface UniverseAgentListLoopSnapshotsResult {
	readonly snapshots: readonly UniverseAgentLoopSnapshotRecord[];
}

/** AgentService.CreateSnapshot — persist a session checkpoint (≠ ListSnapshots / SessionBar History). */
export interface UniverseAgentCreateSnapshotRequest {
	readonly sessionId: string;
	readonly title: string;
	readonly description?: string;
}

export interface UniverseAgentCreateSnapshotResult {
	readonly ok: boolean;
	readonly snapshot?: UniverseAgentSessionSnapshotInfo;
	readonly message?: string;
}

/** AgentService.RestoreSnapshot — restore a session checkpoint (≠ ListSnapshots / SessionBar History). */
export interface UniverseAgentRestoreSnapshotRequest {
	readonly sessionId: string;
	readonly snapshotId: string;
}

export interface UniverseAgentRestoreSnapshotResult {
	readonly ok: boolean;
	readonly message?: string;
}

/** AgentService.DeleteSnapshot — drop a session checkpoint (≠ ListSnapshots / SessionBar History). */
export interface UniverseAgentDeleteSnapshotRequest {
	readonly sessionId: string;
	readonly snapshotId: string;
}

export interface UniverseAgentDeleteSnapshotResult {
	readonly ok: boolean;
	readonly message?: string;
}

export interface UniverseAgentGetHistoryRequest {
	readonly sessionId: string;
	readonly cursorSeq?: string;
	readonly limit?: number;
}

export interface UniverseAgentHistoryEnvelope {
	readonly cursorSeq: string;
	readonly payload: unknown;
}

export interface UniverseAgentGetHistoryResult {
	readonly envelopes: readonly UniverseAgentHistoryEnvelope[];
	readonly nextCursorSeq?: string;
}

export interface UniverseAgentSessionEvent {
	readonly payload: unknown;
}

/**
 * Close cause for resident streams (`openChatStream`, `openContinuationStream`,
 * `openRegenerateStream`, `openResumeStream`, `openSubscribeToolDetailStream`,
 * `openWatchConfigStream`, `openUploadAttachmentStream`,
 * `openDownloadAttachmentStream`,
 * `subscribeSessionEventStream`).
 * Local dispose / cancel does not fire this.
 */
export type UniverseAgentSessionStreamCloseCause =
	| { readonly kind: 'remote' }
	| { readonly kind: 'error'; readonly message: string };

/**
 * AgentService.ChatSync — Gateway unary Chat (proto SessionInput).
 * Empty `messageId` / `operationId` / `replyToId` / `modelProfileId` sent as-is.
 * ≠ Chat bidi / SyncInputDelivery / ContinueGeneration / Resume.
 */
export interface UniverseAgentChatSyncSessionInput {
	readonly messageId: string;
	readonly text: string;
	readonly delivery?: number;
	readonly modelProfileId?: string;
	readonly systemPrompt?: string;
	readonly memoryEnabled?: boolean;
	readonly thinkingEnabled?: boolean;
	readonly replyToId?: string;
	readonly operationId?: string;
	readonly skillName?: string;
	readonly skillScope?: string;
	readonly skillCommandText?: string;
}

/** AgentService.ChatSync request (≠ Chat / SyncInputDelivery / ContinueGeneration / Resume). */
export interface UniverseAgentChatSyncRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly sessionInput?: UniverseAgentChatSyncSessionInput;
	readonly timeoutSeconds?: number;
	readonly lastKnownMessageIds?: readonly string[];
	readonly idempotencyKey?: string;
}

/** AgentService.ChatSync ToolResultEvent. */
export interface UniverseAgentChatSyncToolResult {
	readonly toolId: string;
	readonly toolName: string;
	readonly isError: boolean;
	readonly content: string;
	readonly durationMs: number;
}

/** AgentService.ChatSync InputDeliveryEvent. */
export interface UniverseAgentChatSyncInputDeliveryEvent {
	readonly messageId: string;
	readonly status: number;
	readonly errorCode: string;
	readonly errorMessage: string;
}

/** AgentService.ChatSync response (ChatSyncResponse). */
export interface UniverseAgentChatSyncResult {
	readonly sessionId: string;
	readonly agentId: string;
	readonly text: string;
	readonly stopReason: string;
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly turnCount: number;
	readonly toolResults: readonly UniverseAgentChatSyncToolResult[];
	readonly error: string;
	readonly inputDeliveryEvents: readonly UniverseAgentChatSyncInputDeliveryEvent[];
}

/**
 * AgentService.SyncInputDelivery — disconnect input-delivery replay (proto).
 * Empty `sessionId` / `lastKnownMessageIds` sent as-is.
 * ≠ Chat / ChatSync / ContinueGeneration / Resume.
 */
export interface UniverseAgentSyncInputDeliveryRequest {
	readonly sessionId: string;
	readonly lastKnownMessageIds?: readonly string[];
}

/** AgentService.SyncInputDelivery response (SyncInputDeliveryResponse). */
export interface UniverseAgentSyncInputDeliveryResult {
	readonly inputDeliveryEvents: readonly UniverseAgentChatSyncInputDeliveryEvent[];
}

export interface UniverseAgentChatRequest {
	readonly sessionId: string;
	readonly payload: unknown;
}

export interface UniverseAgentChatResponse {
	readonly payload: unknown;
}

/** Resident AgentService.Chat bidi (ADR-012). One-shot `chat()` still exists for probes. */
export interface UniverseAgentChatStream {
	write(payload: unknown): void;
	dispose(): void;
}

/** AgentService.ContinueGeneration request (ADR-028); server-stream ChatResponse. */
export interface UniverseAgentContinueGenerationRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly turnId: string;
	readonly messageId: string;
}

/** Server-stream handle for ContinueGeneration (client does not write). */
export interface UniverseAgentContinuationStream {
	dispose(): void;
}

/**
 * AgentService.Regenerate request; proto `stream ChatResponse`.
 * `messageId` is correlation only — never a new Chat User id.
 * ≠ ContinueGeneration / ADR-029 regenerateTurn (EditMessage + submitInput).
 */
export interface UniverseAgentRegenerateRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly turnId: string;
	readonly messageId: string;
}

/** Server-stream handle for Regenerate (client does not write). */
export interface UniverseAgentRegenerateStream {
	dispose(): void;
}

/**
 * AgentService.Resume request; proto `stream ChatResponse`.
 * ≠ Pause / ContinueGeneration / ResumeLoop / ResumeQueue / Session.Resume.
 */
export interface UniverseAgentResumeRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

/** Server-stream handle for Resume (client does not write). */
export interface UniverseAgentResumeStream {
	dispose(): void;
}

/**
 * AgentService.SubscribeToolDetail request; proto `stream SubscribeToolDetailChunk`.
 * Empty `sessionId` / `toolCallId` / `refId` are sent as-is.
 * ≠ FetchToolDetail / FetchToolUsageDetail / SendShellSessionClientControl.
 */
export interface UniverseAgentSubscribeToolDetailRequest {
	readonly sessionId: string;
	readonly toolCallId: string;
	/** Proto `detail_kind`. */
	readonly detailKind: number;
	/** Proto `ref_id`. Empty sent as-is. */
	readonly refId: string;
	/** Proto optional `mime_type`. */
	readonly mimeType?: string;
	/** Proto `from_revision`. */
	readonly fromRevision: number;
	/** Proto optional `tail_bytes`. */
	readonly tailBytes?: number;
}

/** Proto `SubscribeToolDetailChunk`. `contentMode` is ToolDetailContentMode name. */
export interface UniverseAgentSubscribeToolDetailChunk {
	readonly success: boolean;
	readonly errorMessage: string;
	readonly content: string;
	readonly revision: number;
	readonly truncated: boolean;
	readonly totalBytes?: number;
	readonly mimeType?: string;
	readonly eof: boolean;
	readonly contentMode: string;
}

/** Server-stream handle for SubscribeToolDetail (client does not write). */
export interface UniverseAgentSubscribeToolDetailStream {
	dispose(): void;
}

export interface UniverseAgentConnectionSnapshot {
	readonly transport: UniverseAgentTransportState;
	readonly sessionToken?: string;
	readonly workDir?: string;
	/** True when the Connect request carried a client work_dir / shared_fs_root hint. */
	readonly sharedFsRootSent: boolean;
	readonly pairingPending: boolean;
	readonly channelAlive: boolean;
	readonly capabilities: UniverseAgentCapabilitySnapshot;
}

/** Joined file mutation record (m6 §11 / sources-review §8); produced only after lifecycle join. */
export interface IFileMutationRecord {
	readonly sessionId: string;
	readonly toolCallId: string;
	readonly turnId: string;
	readonly agentId: string;
	readonly path: string;
	readonly operation: string;
	readonly diffStats?: {
		readonly addedLines: number;
		readonly removedLines: number;
		readonly changedFiles: number;
	};
}

/** Turn settle signal after TurnCompletedChange.assistant_turn_id (m6 §11 / PRD-023 §2.4). */
export interface ITurnSettleSignal {
	readonly sessionId: string;
	readonly runtimeTurnId: string;
	readonly assistantTurnId: string;
}

export interface UniverseAgentTeamMemberInfo {
	readonly memberName: string;
	readonly memberAgentId: string;
	readonly status: string;
	readonly preset: string;
	readonly dynamic: string;
	readonly turnCount: number;
}

export interface UniverseAgentTeamTaskInfo {
	readonly taskId: string;
	readonly subject: string;
	readonly owner: string;
	readonly status: string;
	readonly blockedBy: string;
	readonly lastMessage: string;
	readonly description: string;
}

export interface UniverseAgentTeamInfo {
	readonly teamId: number;
	readonly status: string;
}

/** AgentService.Tree node (host-only RPC; proto enum names for type/status). */
export interface UniverseAgentAgentTreeNode {
	readonly agentId: string;
	readonly name: string;
	readonly type: string;
	readonly status: string;
	readonly model: string;
	readonly turnCount: number;
	readonly createdAt: number;
	readonly children: readonly UniverseAgentAgentTreeNode[];
}

/** Host-only `AgentService.FetchToolDetail` (M7 P2a). Always `subscribe=false`. */
export interface UniverseAgentFetchToolDetailRequest {
	readonly sessionId: string;
	readonly toolCallId: string;
	readonly detailKind: number;
	readonly refId: string;
}

export type UniverseAgentFetchToolDetailResult =
	| { readonly ok: true; readonly content: string; readonly truncated: boolean; readonly totalBytes?: number }
	| { readonly ok: false; readonly reason: 'unavailable' | 'failed'; readonly message?: string };

/** Raw transport mapping of FetchToolDetailResponse before advertisement / UNIMPLEMENTED fold. */
export interface UniverseAgentFetchToolDetailWireResult {
	readonly success: boolean;
	readonly content: string;
	readonly truncated: boolean;
	readonly totalBytes?: number;
	readonly errorMessage?: string;
}

/** Skill catalog source from ToolService.ListSkills (customizations-engine §3.1). */
export type UniverseAgentSkillSource = 'bundled' | 'user' | 'project' | 'unknown';

export interface UniverseAgentSkillSummary {
	readonly name: string;
	readonly description?: string;
	readonly source: UniverseAgentSkillSource;
	readonly enabled: boolean;
	readonly slashEnabled?: boolean;
}

export interface UniverseAgentListSkillsResult {
	readonly skills: readonly UniverseAgentSkillSummary[];
}

export interface UniverseAgentSetSkillEnabledRequest {
	readonly skillName: string;
	readonly enabled: boolean;
}

export interface UniverseAgentSetSkillEnabledResult {
	readonly ok: boolean;
	readonly reason?: string;
}

export interface UniverseAgentSkillInfoRequest {
	readonly skillName: string;
}

export interface UniverseAgentSkillInfoResult {
	readonly name: string;
	readonly content: string;
	readonly source: UniverseAgentSkillSource;
	readonly enabled: boolean;
}

/** Write SKILL.md body via engine catalog (ToolService.SaveSkillContent; customizations-engine §3.1). */
export interface UniverseAgentSaveSkillContentRequest {
	readonly skillName: string;
	readonly content: string;
}

export interface UniverseAgentSaveSkillContentResult {
	readonly ok: boolean;
	readonly reason?: string;
}

/** Agent profile source from AgentService.ListAgentProfiles (customizations-engine §3.2). */
export type UniverseAgentAgentProfileSource = 'built_in' | 'user' | 'project' | 'unknown';

export interface UniverseAgentAgentProfileSummary {
	readonly id: string;
	readonly name: string;
	readonly source: UniverseAgentAgentProfileSource;
	readonly summary?: string;
	readonly enabled?: boolean;
	readonly disabledTools?: readonly string[];
	readonly enabledTools?: readonly string[];
	readonly whitelistMode?: boolean;
}

/** Full agent profile from SaveAgentProfile / ResetAgentProfile (customizations-engine §3.2). */
export interface UniverseAgentAgentProfileDetail {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly systemPrompt?: string;
	readonly disabledTools?: readonly string[];
	readonly enabledTools?: readonly string[];
	readonly permissionMode?: string;
	readonly summary?: string;
	readonly usage?: string;
	readonly detailLevel?: string;
	readonly source?: UniverseAgentAgentProfileSource;
	readonly enabled?: boolean;
	readonly whitelistMode?: boolean;
	readonly builtinDefault?: boolean;
}

export interface UniverseAgentSaveAgentProfileRequest {
	readonly profile: UniverseAgentAgentProfileDetail;
}

export interface UniverseAgentSaveAgentProfileResult {
	readonly profile: UniverseAgentAgentProfileDetail;
}

export interface UniverseAgentDeleteAgentProfileRequest {
	readonly id: string;
}

export interface UniverseAgentDeleteAgentProfileResult {
	readonly ok: boolean;
	readonly reason?: string;
}

export interface UniverseAgentResetAgentProfileRequest {
	readonly id: string;
}

export interface UniverseAgentResetAgentProfileResult {
	readonly ok: boolean;
	readonly reason?: string;
	readonly profile?: UniverseAgentAgentProfileDetail;
}

export interface UniverseAgentListAgentProfilesRequest {
	readonly projectPath?: string;
}

export interface UniverseAgentListAgentProfilesResult {
	readonly profiles: readonly UniverseAgentAgentProfileSummary[];
}

/** MCP definition origin from McpService.ListMcpServers (customizations-engine §3.5). */
export type UniverseAgentMcpServerOrigin = 'global' | 'project' | 'unknown';

export type UniverseAgentMcpTransport = 'stdio' | 'sse' | 'streamable_http' | 'unknown';

export interface UniverseAgentMcpServerSummary {
	readonly id: string;
	readonly name: string;
	readonly transport: UniverseAgentMcpTransport;
	readonly origin: UniverseAgentMcpServerOrigin;
	readonly enabled: boolean;
	readonly effectiveEnabled?: boolean;
	readonly hasProjectOverride?: boolean;
}

export interface UniverseAgentListMcpServersRequest {
	readonly workDir?: string;
	readonly enabledOnly?: boolean;
}

export interface UniverseAgentListMcpServersResult {
	readonly servers: readonly UniverseAgentMcpServerSummary[];
}

export interface UniverseAgentToggleMcpServerRequest {
	readonly id: string;
	readonly enabled: boolean;
	readonly scope: 'global' | 'project';
	readonly workDir?: string;
}

export interface UniverseAgentToggleMcpServerResult {
	readonly ok: boolean;
	readonly reason?: string;
}

export interface UniverseAgentMcpServerConfig {
	readonly id?: string;
	readonly name: string;
	readonly transport: UniverseAgentMcpTransport;
	readonly command?: string;
	readonly args?: readonly string[];
	readonly env?: Readonly<Record<string, string>>;
	readonly url?: string;
	readonly enabled?: boolean;
}

export interface UniverseAgentAddMcpServerRequest {
	readonly config: UniverseAgentMcpServerConfig;
	readonly testConnection?: boolean;
	readonly scope: 'global' | 'project';
	readonly workDir?: string;
}

export interface UniverseAgentAddMcpServerResult {
	readonly ok: boolean;
	readonly reason?: string;
	readonly assignedId?: string;
}

export interface UniverseAgentUpdateMcpServerRequest {
	readonly serverId: string;
	readonly config: UniverseAgentMcpServerConfig;
	readonly restartConnection?: boolean;
	readonly scope: 'global' | 'project';
	readonly workDir?: string;
}

export interface UniverseAgentUpdateMcpServerResult {
	readonly ok: boolean;
	readonly reason?: string;
	readonly config?: UniverseAgentMcpServerConfig;
}

export interface UniverseAgentRemoveMcpServerRequest {
	readonly serverId: string;
	readonly force?: boolean;
	readonly scope: 'global' | 'project';
	readonly workDir?: string;
}

export interface UniverseAgentRemoveMcpServerResult {
	readonly ok: boolean;
	readonly reason?: string;
	readonly removedName?: string;
}

/** Engine tool directory entry from ToolService.ListTools (customizations-engine §3.6). */
export interface UniverseAgentToolSummary {
	readonly name: string;
	readonly description?: string;
	readonly category?: string;
	readonly destructive?: boolean;
	readonly requiresPermission?: boolean;
}

export interface UniverseAgentListToolsResult {
	readonly tools: readonly UniverseAgentToolSummary[];
}

/** ToolService.ToolInfo request — detail for one catalog tool. */
export interface UniverseAgentToolInfoRequest {
	readonly toolName: string;
}

/** ToolService.ToolInfo response (schema + aliases; no enablement). */
export interface UniverseAgentToolInfoResult {
	readonly name: string;
	readonly description?: string;
	readonly category?: string;
	readonly inputSchemaJson?: string;
	readonly destructive?: boolean;
	readonly requiresPermission?: boolean;
	readonly aliases: readonly string[];
}

/**
 * ToolService.ListCommands — slash-command catalog (skill + CONFIG).
 * Proto `SlashCommandSource`. Empty `name` / `agent` / `model` /
 * `skill_source` pass through as-is.
 * ≠ ListSkills / ListTools / ToolInfo / GetCommandDef / ResolveModel.
 */
export type UniverseAgentSlashCommandSource =
	| 'SLASH_COMMAND_SOURCE_UNSPECIFIED'
	| 'SLASH_COMMAND_SOURCE_SKILL'
	| 'SLASH_COMMAND_SOURCE_CONFIG'
	| 'SLASH_COMMAND_SOURCE_BUILTIN'
	| 'SLASH_COMMAND_SOURCE_MCP'
	| '';

export interface UniverseAgentCommandSummary {
	readonly name: string;
	readonly description?: string;
	readonly source: UniverseAgentSlashCommandSource;
	readonly slashEnabled: boolean;
	readonly agent: string;
	readonly model: string;
	readonly subtask: boolean;
	/** Proto `skill_source`. Empty sent/mapped as-is (not remapped to unknown). */
	readonly skillSource: string;
}

export interface UniverseAgentListCommandsResult {
	readonly commands: readonly UniverseAgentCommandSummary[];
	readonly total: number;
}

/**
 * ToolService.GetCommandDef — slash-command detail (template + MCP).
 * Proto `GetCommandDefRequest.command_name`. Empty `command_name` /
 * `name` / `agent` / `model` / `template` / `mcp_server_id` /
 * `mcp_prompt_name` / `skill_source` pass through as-is.
 * ≠ ListCommands / ListSkills / ListTools / ToolInfo / ResolveModel.
 */
export interface UniverseAgentGetCommandDefRequest {
	readonly commandName: string;
}

export interface UniverseAgentGetCommandDefResult {
	readonly name: string;
	readonly description?: string;
	readonly source: UniverseAgentSlashCommandSource;
	readonly template: string;
	readonly agent: string;
	readonly model: string;
	readonly subtask: boolean;
	readonly mcpServerId: string;
	readonly mcpPromptName: string;
	readonly mcpArgumentNames: readonly string[];
	readonly skillSource: string;
}

/**
 * FileService.ListFiles — workspace file catalog (proto package
 * `universeagent.file.v1`). Empty `path` / `session_id` / `pattern` sent as-is.
 * `recursive` false / `max_results` 0 sent as-is.
 * ≠ ReadFile / GetFileInfo / WriteFile / ForceWriteFile / AgentMerge.
 */
export interface UniverseAgentListFilesRequest {
	readonly path: string;
	readonly sessionId: string;
	readonly recursive: boolean;
	readonly pattern: string;
	readonly maxResults: number;
}

export interface UniverseAgentFileEntry {
	readonly name: string;
	readonly path: string;
	readonly isDirectory: boolean;
	readonly size: number;
	readonly lastModified: number;
	readonly mimeType: string;
}

export interface UniverseAgentListFilesResult {
	readonly entries: readonly UniverseAgentFileEntry[];
	readonly total: number;
}

/**
 * FileService.ReadFile — proto `ReadFileRequest` / `ReadFileResponse` only.
 * Empty `path` / `session_id` pass through as-is. `start_line` / `end_line`
 * / `max_bytes` 0 sent as-is. ≠ ListFiles / GetFileInfo / WriteFile.
 */
export interface UniverseAgentReadFileRequest {
	readonly path: string;
	readonly sessionId: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly maxBytes: number;
}

export interface UniverseAgentReadFileResult {
	/** Proto `content` (bytes). Empty mapped as empty bytes. */
	readonly content: Uint8Array;
	readonly totalSize: number;
	readonly mimeType: string;
	readonly lineCount: number;
	readonly contentHash: string;
}

/**
 * FileService.GetFileInfo — proto `GetFileInfoRequest` / `GetFileInfoResponse` only.
 * Empty `path` / `session_id` pass through as-is. Response `file` is proto FileEntry
 * (`name` / `path` / `is_directory` / `size` / `last_modified` / `mime_type`).
 * ≠ ListFiles / ReadFile / WriteFile / ForceWriteFile / AgentMerge.
 */
export interface UniverseAgentGetFileInfoRequest {
	readonly path: string;
	readonly sessionId: string;
}

export interface UniverseAgentGetFileInfoResult {
	readonly file: UniverseAgentFileEntry;
}

/**
 * FileService.WriteFile — proto `WriteFileRequest` / `WriteFileResponse` only.
 * Empty `path` / `session_id` / `base_hash` pass through as-is. Empty
 * `content` / `base_content` sent as-is.
 * ≠ ListFiles / ReadFile / GetFileInfo / ForceWriteFile / AgentMerge.
 */
export type UniverseAgentWriteFileStatus = 'SAVED' | 'MERGED' | 'CONFLICT';

export interface UniverseAgentWriteFileRequest {
	readonly path: string;
	readonly content: Uint8Array;
	readonly baseHash: string;
	readonly sessionId: string;
	readonly baseContent: Uint8Array;
}

export interface UniverseAgentWriteFileResult {
	readonly status: UniverseAgentWriteFileStatus;
	readonly newHash: string;
	readonly size: number;
	readonly modifiedAt: number;
	readonly currentContent: Uint8Array;
	readonly currentHash: string;
	readonly mergedContent: Uint8Array;
}

/**
 * FileService.ForceWriteFile — proto `ForceWriteFileRequest` / `WriteFileResponse` only.
 * Empty `path` / `session_id` pass through as-is. Empty `content` sent as-is.
 * ≠ ListFiles / ReadFile / GetFileInfo / WriteFile / AgentMerge.
 */
export interface UniverseAgentForceWriteFileRequest {
	readonly path: string;
	readonly content: Uint8Array;
	readonly sessionId: string;
}

/**
 * FileService.AgentMerge — proto `AgentMergeRequest` / `AgentMergeResponse` only.
 * Empty `session_id` / `path` pass through as-is. Empty `base_content` /
 * `current_content` / `user_content` sent as-is.
 * ≠ ListFiles / ReadFile / GetFileInfo / WriteFile / ForceWriteFile.
 */
export interface UniverseAgentAgentMergeRequest {
	readonly sessionId: string;
	readonly path: string;
	readonly baseContent: Uint8Array;
	readonly currentContent: Uint8Array;
	readonly userContent: Uint8Array;
}

export interface UniverseAgentAgentMergeResult {
	readonly accepted: boolean;
}

/**
 * GitService.ReadGitSummary — proto `ReadGitSummaryRequest` /
 * `ReadGitSummaryResponse` only. Empty `session_id` pass through as-is.
 * ≠ ReadGitChanges / ReadGitFileDiff / WriteGitStagePaths / WriteGitCommit /
 * WriteGitApplyHunks.
 */
export interface UniverseAgentReadGitSummaryRequest {
	readonly sessionId: string;
}

export interface UniverseAgentReadGitSummaryResult {
	readonly supported: boolean;
	readonly reason: string;
	readonly branch: string;
	readonly changeCount: number;
}

/**
 * GitService.ReadGitChanges — proto `ReadGitChangesRequest` /
 * `ReadGitChangesResponse` only. Empty `session_id` pass through as-is.
 * Empty `path` / `old_path` / `kind` / `index_state` / `reason` / `branch`
 * mapped as-is. ≠ ReadGitSummary / ReadGitFileDiff / WriteGitStagePaths /
 * WriteGitCommit / WriteGitApplyHunks.
 */
export interface UniverseAgentReadGitChangesRequest {
	readonly sessionId: string;
}

export interface UniverseAgentGitChangeEntry {
	readonly path: string;
	readonly oldPath: string;
	readonly kind: string;
	readonly indexState: string;
}

export interface UniverseAgentReadGitChangesResult {
	readonly supported: boolean;
	readonly reason: string;
	readonly branch: string;
	readonly entries: readonly UniverseAgentGitChangeEntry[];
}

/**
 * GitService.ReadGitFileDiff — proto `ReadGitFileDiffRequest` /
 * `ReadGitFileDiffResponse` only. Empty `session_id` / `path` /
 * `index_state` pass through as-is.
 * ≠ ReadGitSummary / ReadGitChanges / WriteGitStagePaths /
 * WriteGitCommit / WriteGitApplyHunks.
 */
export interface UniverseAgentReadGitFileDiffRequest {
	readonly sessionId: string;
	readonly path: string;
	readonly indexState: string;
}

export interface UniverseAgentReadGitFileDiffResult {
	readonly supported: boolean;
	readonly reason: string;
	readonly path: string;
	readonly unifiedDiff: string;
}

/**
 * GitService.WriteGitStagePaths — proto `WriteGitStagePathsRequest` /
 * `WriteGitWriteResponse` only. Empty `session_id` pass through as-is.
 * Empty `commands` / empty `argv` sent as-is.
 * ≠ ReadGitSummary / ReadGitChanges / ReadGitFileDiff / WriteGitCommit /
 * WriteGitApplyHunks.
 */
export interface UniverseAgentGitArgvCommand {
	readonly argv: readonly string[];
}

export interface UniverseAgentWriteGitStagePathsRequest {
	readonly sessionId: string;
	readonly commands: readonly UniverseAgentGitArgvCommand[];
}

export interface UniverseAgentWriteGitWriteResult {
	readonly supported: boolean;
	readonly reason: string;
	readonly success: boolean;
	readonly errorMessage: string;
	readonly exitCode: number;
	readonly stdout: string;
}

/**
 * GitService.WriteGitCommit — proto `WriteGitCommitRequest` /
 * `WriteGitWriteResponse` only. Empty `session_id` pass through as-is.
 * Empty `message` sent as-is. `sign_off` / `amend` false sent as-is.
 * ≠ ReadGitSummary / ReadGitChanges / ReadGitFileDiff / WriteGitStagePaths /
 * WriteGitApplyHunks.
 */
export interface UniverseAgentWriteGitCommitRequest {
	readonly sessionId: string;
	readonly message: string;
	readonly signOff: boolean;
	readonly amend: boolean;
}

/**
 * GitService.WriteGitApplyHunks — proto `WriteGitApplyHunksRequest` /
 * `WriteGitWriteResponse` only. Empty `session_id` pass through as-is.
 * Empty `argv` / empty `patches` sent as-is.
 * ≠ ReadGitSummary / ReadGitChanges / ReadGitFileDiff / WriteGitStagePaths /
 * WriteGitCommit.
 */
export interface UniverseAgentWriteGitApplyHunksRequest {
	readonly sessionId: string;
	readonly argv: readonly string[];
	readonly patches: readonly string[];
}

/**
 * TokenUsageService.GetSessionUsage — proto `GetSessionUsageRequest` /
 * `GetSessionUsageResponse` + `TokenUsageData` only. Empty `session_id`
 * pass through as-is. Empty `currency` / zero counts mapped as-is.
 * ≠ GetGlobalUsage / Agent.Usage.
 */
export interface UniverseAgentGetSessionUsageRequest {
	readonly sessionId: string;
}

/**
 * TokenUsageService.GetGlobalUsage — proto `GetGlobalUsageRequest` /
 * `GetGlobalUsageResponse` + `TokenUsageData` only. Empty request `{}`.
 * Empty `currency` mapped as-is. ≠ GetSessionUsage / Agent.Usage.
 */
export interface UniverseAgentTokenUsageData {
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly thinkingTokens: number;
	readonly cacheReadTokens: number;
	readonly cacheWriteTokens: number;
	readonly totalCostMicros: number;
	readonly currency: string;
	readonly requestCount: number;
}

export interface UniverseAgentGetSessionUsageResult {
	readonly usage: UniverseAgentTokenUsageData;
}

export interface UniverseAgentGetGlobalUsageResult {
	readonly usage: UniverseAgentTokenUsageData;
}

/**
 * MemoryService.Save — proto `MemorySaveRequest` / `MemorySaveResponse` only.
 * Empty `scope` / `content` / `category` pass through as-is.
 * ≠ Search / SearchDeep / Read / List / Delete / Reflect / Rebuild / Revert /
 * History.
 */
export interface UniverseAgentSaveMemoryRequest {
	readonly scope: string;
	readonly content: string;
	readonly category: string;
}

export interface UniverseAgentSaveMemoryResult {
	readonly success: boolean;
	readonly message: string;
	readonly filePath: string;
}

/**
 * MemoryService.Search — proto `MemorySearchRequest` /
 * `MemorySearchResponse` + `MemorySearchResult` only. Empty `scope` /
 * `query` / `keywords` pass through as-is. `limit` 0 sent as-is.
 * Empty `category` / `filename` / `title` / `snippet` / `scope` mapped
 * as-is. ≠ Save / SearchDeep / Read / List / Delete / Reflect / Rebuild /
 * Revert / History.
 */
export interface UniverseAgentMemorySearchRequest {
	readonly scope: string;
	readonly query: string;
	readonly keywords: readonly string[];
	readonly limit: number;
}

export interface UniverseAgentMemorySearchEntry {
	readonly category: string;
	readonly filename: string;
	readonly title: string;
	readonly score: number;
	readonly snippet: string;
	readonly forgot: boolean;
	readonly scope: string;
}

export interface UniverseAgentMemorySearchResult {
	readonly results: readonly UniverseAgentMemorySearchEntry[];
}

/**
 * MemoryService.SearchDeep — proto `MemorySearchDeepRequest` /
 * `MemorySearchDeepResponse` + `MemorySearchResult` only. Empty `scope` /
 * `query` / `keywords` / `categories` pass through as-is. `limit` 0 sent
 * as-is. `include_content` false sent as-is. Empty `category` / `filename` /
 * `title` / `snippet` / `scope` mapped as-is. Empty `searched_categories`
 * mapped as-is. ≠ Save / Search / Read / List / Delete / Reflect / Rebuild /
 * Revert / History.
 */
export interface UniverseAgentMemorySearchDeepRequest {
	readonly scope: string;
	readonly query: string;
	readonly keywords: readonly string[];
	readonly categories: readonly string[];
	readonly limit: number;
	readonly includeContent: boolean;
}

export interface UniverseAgentMemorySearchDeepResult {
	readonly results: readonly UniverseAgentMemorySearchEntry[];
	readonly searchedCategories: readonly string[];
}

/**
 * MemoryService.Read — proto `MemoryReadRequest` / `MemoryReadResponse` +
 * `MemoryFileMetadata` only. Empty `scope` / `category` / `filename` /
 * `section` / `mode` pass through as-is. `forgot` false sent as-is.
 * Empty `content` / metadata strings / `tags` mapped as-is.
 * ≠ Save / Search / SearchDeep / List / Delete / Reflect / Rebuild /
 * Revert / History.
 */
export interface UniverseAgentReadMemoryRequest {
	readonly scope: string;
	readonly category: string;
	readonly filename: string;
	readonly section: string;
	readonly mode: string;
	readonly forgot: boolean;
}

export interface UniverseAgentMemoryFileMetadata {
	readonly category: string;
	readonly filename: string;
	readonly title: string;
	readonly tags: readonly string[];
	readonly createdAt: number;
	readonly updatedAt: number;
	readonly version: number;
}

export interface UniverseAgentReadMemoryResult {
	readonly content: string;
	readonly metadata: UniverseAgentMemoryFileMetadata;
}

/**
 * MemoryService.List — proto `MemoryListRequest` / `MemoryListResponse` +
 * `MemoryCategoryInfo` / `MemoryFileSummary` only. Empty `scope` /
 * `category` pass through as-is. Empty `filename` / `title` / `category`
 * mapped as-is. `updated_at` / `file_count` 0 mapped as-is.
 * ≠ Save / Search / SearchDeep / Read / Delete / Reflect / Rebuild /
 * Revert / History.
 */
export interface UniverseAgentMemoryListRequest {
	readonly scope: string;
	readonly category: string;
}

export interface UniverseAgentMemoryFileSummary {
	readonly filename: string;
	readonly title: string;
	readonly updatedAt: number;
}

export interface UniverseAgentMemoryCategoryInfo {
	readonly category: string;
	readonly files: readonly UniverseAgentMemoryFileSummary[];
	readonly fileCount: number;
}

export interface UniverseAgentMemoryListResult {
	readonly categories: readonly UniverseAgentMemoryCategoryInfo[];
}

/**
 * MemoryService.Delete — proto `MemoryDeleteRequest` / `MemoryDeleteResponse` only.
 * Empty `scope` / `category` / `filename` pass through as-is.
 * ≠ Save / Search / SearchDeep / Read / List / Reflect / Rebuild / Revert /
 * History.
 */
export interface UniverseAgentDeleteMemoryRequest {
	readonly scope: string;
	readonly category: string;
	readonly filename: string;
}

export interface UniverseAgentDeleteMemoryResult {
	readonly success: boolean;
	readonly message: string;
}

/**
 * MemoryService.Reflect — proto `MemoryReflectRequest` /
 * `MemoryReflectResponse` + `ReflectDiagnosis` only. Empty `scope` /
 * `categories` pass through as-is. Empty `type` / `category` /
 * `filename` / `description` / `suggestion` / `summary` mapped as-is.
 * ≠ Save / Search / SearchDeep / Read / List / Delete / Rebuild /
 * Revert / History.
 */
export interface UniverseAgentReflectMemoryRequest {
	readonly scope: string;
	readonly categories: readonly string[];
}

export interface UniverseAgentMemoryReflectDiagnosis {
	readonly type: string;
	readonly category: string;
	readonly filename: string;
	readonly description: string;
	readonly suggestion: string;
}

export interface UniverseAgentReflectMemoryResult {
	readonly diagnoses: readonly UniverseAgentMemoryReflectDiagnosis[];
	readonly summary: string;
}

/**
 * MemoryService.Rebuild — proto `MemoryRebuildRequest` /
 * `stream MemoryRebuildEvent` only. Empty `scope` pass through as-is.
 * `dry_run` false sent as-is. Empty `phase` / `message` mapped as-is.
 * `progress` / `files_processed` / `files_total` 0 mapped as-is.
 * ≠ Save / Search / SearchDeep / Read / List / Delete / Reflect /
 * Revert / History.
 */
export interface UniverseAgentMemoryRebuildRequest {
	readonly scope: string;
	readonly dryRun: boolean;
}

/** Proto `MemoryRebuildEvent`. Empty `phase` / `message` mapped as-is. */
export interface UniverseAgentMemoryRebuildEvent {
	readonly phase: string;
	readonly message: string;
	readonly progress: number;
	readonly filesProcessed: number;
	readonly filesTotal: number;
}

/** Server-stream handle for MemoryService.Rebuild (client does not write). */
export interface UniverseAgentMemoryRebuildStream {
	dispose(): void;
}

/**
 * MemoryService.Revert — proto `MemoryRevertRequest` / `MemoryRevertResponse` only.
 * Empty `scope` / `category` / `filename` pass through as-is.
 * `target_version` 0 sent as-is. Empty `message` mapped as-is.
 * `reverted_to_version` 0 mapped as-is.
 * ≠ Save / Search / SearchDeep / Read / List / Delete / Reflect / Rebuild /
 * History.
 */
export interface UniverseAgentRevertMemoryRequest {
	readonly scope: string;
	readonly category: string;
	readonly filename: string;
	readonly targetVersion: number;
}

export interface UniverseAgentRevertMemoryResult {
	readonly success: boolean;
	readonly message: string;
	readonly revertedToVersion: number;
}

/**
 * MemoryService.History — proto `MemoryHistoryRequest` /
 * `MemoryHistoryResponse` + `MemoryChangeEntry` only.
 * Empty `scope` / `category` / `filename` pass through as-is.
 * `limit` 0 sent as-is. Empty `change_type` / `summary` / `author`
 * mapped as-is. `version` / `timestamp` 0 mapped as-is.
 * ≠ Save / Search / SearchDeep / Read / List / Delete / Reflect /
 * Rebuild / Revert.
 */
export interface UniverseAgentMemoryHistoryRequest {
	readonly scope: string;
	readonly category: string;
	readonly filename: string;
	readonly limit: number;
}

export interface UniverseAgentMemoryChangeEntry {
	readonly version: number;
	readonly changeType: string;
	readonly summary: string;
	readonly timestamp: number;
	readonly author: string;
}

export interface UniverseAgentMemoryHistoryResult {
	readonly changes: readonly UniverseAgentMemoryChangeEntry[];
}

/**
 * ContextVariableService.List — proto `ContextVariableListRequest` /
 * `ContextVariableListResponse` + `ContextVariableEntrySummary` only.
 * Empty `session_id` / `agent_id` pass through as-is. Empty `name` /
 * `updated_by` / `content_preview` mapped as-is. `updated_at` 0 mapped
 * as-is. `scope` proto enum (`VARIABLE_GLOBAL`=0 / `VARIABLE_LOCAL`=1).
 * ≠ Read.
 */
export type UniverseAgentContextVariableScope =
	| 'VARIABLE_GLOBAL'
	| 'VARIABLE_LOCAL';

export interface UniverseAgentContextVariableListRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentContextVariableEntrySummary {
	readonly name: string;
	readonly scope: UniverseAgentContextVariableScope;
	readonly updatedBy: string;
	readonly updatedAt: number;
	readonly contentPreview: string;
}

export interface UniverseAgentContextVariableListResult {
	readonly current: readonly UniverseAgentContextVariableEntrySummary[];
	readonly inherited: readonly UniverseAgentContextVariableEntrySummary[];
}

/**
 * ContextVariableService.Read — proto `ContextVariableReadRequest` /
 * `ContextVariableReadResponse` + `ContextVariableEntry` only.
 * Empty `session_id` / `name` / `agent_id` pass through as-is. Empty
 * `name` / `content` / `updated_by` mapped as-is. `updated_at` 0 mapped
 * as-is. `scope` proto enum (`VARIABLE_GLOBAL`=0 / `VARIABLE_LOCAL`=1).
 * ≠ List.
 */
export interface UniverseAgentContextVariableReadRequest {
	readonly sessionId: string;
	readonly name: string;
	readonly agentId: string;
}

export interface UniverseAgentContextVariableEntry {
	readonly name: string;
	readonly content: string;
	readonly scope: UniverseAgentContextVariableScope;
	readonly updatedBy: string;
	readonly updatedAt: number;
}

export interface UniverseAgentContextVariableReadResult {
	readonly entry: UniverseAgentContextVariableEntry;
}

/**
 * FileTransferService.GetUploadProgress — proto `UploadProgressRequest` /
 * `UploadProgressResponse` only. Empty `transfer_id` / `session_id` pass
 * through as-is. `bytes_received` 0 / empty `partial_path` mapped as-is.
 * ≠ UploadAttachment / DownloadAttachment.
 */
export interface UniverseAgentGetUploadProgressRequest {
	readonly transferId: string;
	readonly sessionId: string;
}

export interface UniverseAgentGetUploadProgressResult {
	readonly exists: boolean;
	readonly bytesReceived: number;
	readonly partialPath: string;
}

/**
 * FileTransferService.UploadAttachment — proto `stream UploadChunk` /
 * `UploadResponse` only. Empty `transfer_id` / `filename` / `mime_type` /
 * `checksum_sha256` / `session_id` / `queue_item_id` pass through as-is.
 * Empty `chunk` mapped as-is. `offset` / `total_size` / `chunk_size` 0
 * as-is. ≠ DownloadAttachment / GetUploadProgress.
 */
export type UniverseAgentUploadErrorCode =
	| 'UPLOAD_ERROR_NONE'
	| 'UPLOAD_ERROR_CHECKSUM_MISMATCH'
	| 'UPLOAD_ERROR_DISK_FULL'
	| 'UPLOAD_ERROR_PERMISSION_DENIED'
	| 'UPLOAD_ERROR_INVALID_OFFSET'
	| 'UPLOAD_ERROR_FILE_TOO_LARGE'
	| 'UPLOAD_ERROR_INTERNAL'
	| 'UPLOAD_ERROR_AUTH_FAILED';

export interface UniverseAgentUploadHeader {
	readonly transferId: string;
	readonly filename: string;
	readonly totalSize: number;
	readonly mimeType: string;
	readonly checksumSha256: string;
	readonly isPrecompressed: boolean;
	readonly sessionId: string;
	/** Proto `chunk_size`. 0 sent as-is. */
	readonly chunkSize: number;
	/** Proto optional `queue_item_id`. Empty sent as-is when present. */
	readonly queueItemId?: string;
}

/** Proto `UploadChunk` (`oneof header | chunk` + `offset`). */
export interface UniverseAgentUploadChunk {
	readonly header?: UniverseAgentUploadHeader;
	readonly chunk?: Uint8Array;
	readonly offset: number;
}

export interface UniverseAgentUploadAttachmentResult {
	readonly success: boolean;
	readonly filePath: string;
	readonly checksumSha256: string;
	readonly errorMessage: string;
	/** Proto `UploadErrorCode` name. */
	readonly errorCode: string;
}

/** Client-stream handle for FileTransferService.UploadAttachment. */
export interface UniverseAgentUploadAttachmentStream {
	write(chunk: UniverseAgentUploadChunk): void;
	end(): void;
	dispose(): void;
}

/**
 * FileTransferService.DownloadAttachment — proto `DownloadRequest` /
 * `stream DownloadChunk` only. Empty `file_path` / `session_id` /
 * `artifact_id` pass through as-is. `offset` / `max_bytes` 0 sent as-is.
 * Empty `data` / `checksum_sha256` mapped as-is. `offset` /
 * `total_size` 0 mapped as-is. `is_last` false mapped as-is.
 * ≠ UploadAttachment / GetUploadProgress.
 */
export interface UniverseAgentDownloadAttachmentRequest {
	readonly filePath: string;
	readonly offset: number;
	readonly maxBytes: number;
	readonly sessionId: string;
	readonly artifactId: string;
}

/** Proto `DownloadChunk`. Empty `data` / `checksum_sha256` mapped as-is. */
export interface UniverseAgentDownloadChunk {
	readonly offset: number;
	readonly data: Uint8Array;
	readonly totalSize: number;
	readonly isLast: boolean;
	readonly checksumSha256: string;
}

/** Server-stream handle for FileTransferService.DownloadAttachment (client does not write). */
export interface UniverseAgentDownloadAttachmentStream {
	dispose(): void;
}

/**
 * SystemService.HealthCheck — proto `HealthCheckRequest` /
 * `HealthCheckResponse` only. Empty request `{}`. Empty `status` /
 * `version` mapped as-is. `active_sessions` / `uptime_ms` 0 mapped as-is.
 * ≠ Connect / GetAuthNonce / Doctor / Shutdown.
 */
export interface UniverseAgentHealthCheckResult {
	readonly status: string;
	readonly version: string;
	readonly activeSessions: number;
	readonly uptimeMs: number;
}

/**
 * SystemService.Doctor — proto `DoctorRequest` / `DoctorResponse` +
 * `DoctorCheck` only. Empty request `{}`. Empty `name` / `message` /
 * `fix_hint` mapped as-is. `passed` / `all_passed` false mapped as-is.
 * ≠ Connect / GetAuthNonce / HealthCheck / Shutdown.
 */
export interface UniverseAgentDoctorCheck {
	readonly name: string;
	readonly passed: boolean;
	readonly message: string;
	readonly fixHint: string;
}

export interface UniverseAgentDoctorResult {
	readonly checks: readonly UniverseAgentDoctorCheck[];
	readonly allPassed: boolean;
}

/**
 * SystemService.Shutdown — proto `ShutdownRequest` / `ShutdownResponse` only.
 * `force` false / `grace_period_ms` 0 sent as-is. Empty `message` mapped as-is.
 * `accepted` false mapped as-is.
 * ≠ Connect / GetAuthNonce / HealthCheck / Doctor.
 */
export interface UniverseAgentShutdownRequest {
	readonly force: boolean;
	readonly gracePeriodMs: number;
}

export interface UniverseAgentShutdownResult {
	readonly accepted: boolean;
	readonly message: string;
}

/**
 * DeviceService.ListDevices — proto `ListDevicesRequest` /
 * `ListDevicesResponse` + `DeviceInfo` only. Empty request `{}`.
 * Empty `device_id` / `display_name` / `role` / `platform` mapped as-is.
 * `paired_at` / `last_seen_at` 0 mapped as-is. `active` false mapped as-is.
 * ≠ PairApprove / PairReject / Revoke / RotateToken / ListPending.
 */
export interface UniverseAgentDeviceInfo {
	readonly deviceId: string;
	readonly displayName: string;
	readonly role: string;
	readonly platform: string;
	readonly pairedAt: number;
	readonly lastSeenAt: number;
	readonly active: boolean;
}

export interface UniverseAgentListDevicesResult {
	readonly devices: readonly UniverseAgentDeviceInfo[];
}

/**
 * DeviceService.PairApprove — proto `PairApproveRequest` /
 * `PairApproveResponse` only. Empty `pairing_code` / `display_name` /
 * `role` pass through as-is. Empty `device_id` / `message` mapped as-is.
 * `success` false mapped as-is. Reserved `device_token` (ADR-261) not mapped.
 * ≠ ListDevices / PairReject / Revoke / RotateToken / ListPending.
 */
export interface UniverseAgentPairApproveRequest {
	readonly pairingCode: string;
	readonly displayName: string;
	readonly role: string;
}

export interface UniverseAgentPairApproveResult {
	readonly success: boolean;
	readonly deviceId: string;
	readonly message: string;
}

/**
 * DeviceService.PairReject — proto `PairRejectRequest` /
 * `PairRejectResponse` only. Empty `pairing_code` pass through as-is.
 * Empty `message` mapped as-is. `success` false mapped as-is.
 * ≠ ListDevices / PairApprove / Revoke / RotateToken / ListPending.
 */
export interface UniverseAgentPairRejectRequest {
	readonly pairingCode: string;
}

export interface UniverseAgentPairRejectResult {
	readonly success: boolean;
	readonly message: string;
}

/**
 * DeviceService.Revoke — proto `RevokeDeviceRequest` /
 * `RevokeDeviceResponse` only. Empty `device_id` pass through as-is.
 * Empty `message` mapped as-is. `success` false mapped as-is.
 * ≠ ListDevices / PairApprove / PairReject / RotateToken / ListPending /
 * Hub revokeDevice.
 */
export interface UniverseAgentRevokeRequest {
	readonly deviceId: string;
}

export interface UniverseAgentRevokeResult {
	readonly success: boolean;
	readonly message: string;
}

/**
 * TriggerService.ListTriggers — proto `ListTriggersRequest` /
 * `ListTriggersResponse` + `TriggerDto` / `DeliveryTargetDto` only.
 * Empty `scope` / `scope_id` / `type_filter` pass through as-is.
 * Empty `trigger_id` / `name` / `type` / `prompt_template` /
 * `pause_reason` / `cron_expression` mapped as-is. `enabled` false
 * mapped as-is. `interval_ms` / `run_at_epoch_ms` 0 mapped as-is.
 * Delivery oneof `self` / `bound_session` / `new_session`; empty
 * `session_id` / `engine_profile_id` mapped as-is.
 * ≠ UpsertTrigger / DeleteTrigger / SetTriggerEnabled / FireTrigger /
 * AgentService.FireTriggerWebhook / DeviceService.
 */
export interface UniverseAgentListTriggersRequest {
	readonly scope: string;
	readonly scopeId: string;
	/** Proto optional `type_filter`. Empty sent as-is. */
	readonly typeFilter: string;
}

export type UniverseAgentTriggerDeliveryTarget =
	| { readonly kind: 'self' }
	| { readonly kind: 'boundSession'; readonly sessionId: string }
	| { readonly kind: 'newSession'; readonly engineProfileId: string }
	| { readonly kind: 'unspecified' };

export interface UniverseAgentTrigger {
	readonly triggerId: string;
	readonly name: string;
	readonly type: string;
	readonly promptTemplate: string;
	readonly enabled: boolean;
	readonly pauseReason: string;
	readonly target: UniverseAgentTriggerDeliveryTarget;
	readonly intervalMs: number;
	readonly cronExpression: string;
	readonly runAtEpochMs: number;
}

export interface UniverseAgentListTriggersResult {
	readonly triggers: readonly UniverseAgentTrigger[];
}

/**
 * TriggerService.UpsertTrigger — proto `UpsertTriggerRequest` /
 * `UpsertTriggerResponse` + `TriggerDto` / `DeliveryTargetDto` only.
 * Empty `scope` / `scope_id` pass through as-is. Empty `trigger_id` /
 * `name` / `type` / `prompt_template` / `pause_reason` /
 * `cron_expression` sent and mapped as-is. `enabled` false sent and
 * mapped as-is. `interval_ms` / `run_at_epoch_ms` 0 sent and mapped
 * as-is. Delivery oneof `self` / `bound_session` / `new_session`; empty
 * `session_id` / `engine_profile_id` sent and mapped as-is.
 * ≠ ListTriggers / DeleteTrigger / SetTriggerEnabled / FireTrigger /
 * AgentService.FireTriggerWebhook / DeviceService.
 */
export interface UniverseAgentUpsertTriggerRequest {
	readonly scope: string;
	readonly scopeId: string;
	readonly trigger: UniverseAgentTrigger;
}

export interface UniverseAgentUpsertTriggerResult {
	readonly trigger: UniverseAgentTrigger;
}

/**
 * TriggerService.DeleteTrigger — proto `DeleteTriggerRequest` /
 * `DeleteTriggerResponse` only. Empty `scope` / `scope_id` /
 * `trigger_id` pass through as-is. Response is empty `{}`.
 * ≠ ListTriggers / UpsertTrigger / SetTriggerEnabled / FireTrigger /
 * AgentService.FireTriggerWebhook / DeviceService.
 */
export interface UniverseAgentDeleteTriggerRequest {
	readonly scope: string;
	readonly scopeId: string;
	readonly triggerId: string;
}

/** Proto `DeleteTriggerResponse` is empty. */
export interface UniverseAgentDeleteTriggerResult {
}

/**
 * ClipboardService.Write — proto `ClipboardWriteRequest` /
 * `ClipboardWriteResponse` only. Empty `session_id` / `agent_id` /
 * `label` / `content` / `file_path` / `url` sent as-is. Empty `clip_id`
 * mapped as-is. `type` uses typed `ClipboardEntryType` wire (Write RPC
 * is TEXT-only; `file_path` / `url` reserved, sent as-is).
 * ≠ Read / List / Clear / DeviceService / TriggerService.
 */
export type UniverseAgentClipboardEntryType =
	| 'CLIPBOARD_TEXT'
	| 'CLIPBOARD_FILE_PATH'
	| 'CLIPBOARD_URL';

export interface UniverseAgentWriteClipboardRequest {
	readonly sessionId: string;
	readonly agentId: string;
	readonly label: string;
	/** Proto `ClipboardEntryType`. Wired to enum number. */
	readonly type: UniverseAgentClipboardEntryType;
	readonly content: string;
	/** Proto `file_path`. Reserved (Write is TEXT-only); empty sent as-is. */
	readonly filePath: string;
	/** Proto `url`. Reserved (Write is TEXT-only); empty sent as-is. */
	readonly url: string;
}

export interface UniverseAgentWriteClipboardResult {
	readonly clipId: string;
}

/**
 * ClipboardService.Read — proto `ClipboardReadRequest` /
 * `ClipboardReadResponse` + `ClipboardEntry` only. Empty `session_id` /
 * `clip_id` sent as-is. Empty `clip_id` / `label` / `content` /
 * `created_by` mapped as-is. `created_at` 0 mapped as-is. `type` uses
 * typed `ClipboardEntryType` wire.
 * ≠ Write / List / Clear / DeviceService / TriggerService.
 */
export interface UniverseAgentReadClipboardRequest {
	readonly sessionId: string;
	readonly clipId: string;
}

export interface UniverseAgentClipboardEntry {
	readonly clipId: string;
	readonly label: string;
	/** Proto `ClipboardEntryType`. Mapped from enum number or name. */
	readonly type: UniverseAgentClipboardEntryType;
	readonly content: string;
	/** Proto `created_by`. Empty mapped as-is. */
	readonly createdBy: string;
	/** Proto `created_at`. 0 mapped as-is. */
	readonly createdAt: number;
}

export interface UniverseAgentReadClipboardResult {
	readonly entry: UniverseAgentClipboardEntry;
}

/**
 * ClipboardService.List — proto `ClipboardListRequest` /
 * `ClipboardListResponse` + `ClipboardEntrySummary` only. Empty
 * `session_id` sent as-is. Empty `clip_id` / `label` / `created_by`
 * mapped as-is. `created_at` 0 mapped as-is. `type` uses typed
 * `ClipboardEntryType` wire.
 * ≠ Write / Read / Clear / DeviceService / TriggerService.
 */
export interface UniverseAgentListClipboardRequest {
	readonly sessionId: string;
}

export interface UniverseAgentClipboardEntrySummary {
	readonly clipId: string;
	readonly label: string;
	/** Proto `ClipboardEntryType`. Mapped from enum number or name. */
	readonly type: UniverseAgentClipboardEntryType;
	/** Proto `created_by`. Empty mapped as-is. */
	readonly createdBy: string;
	/** Proto `created_at`. 0 mapped as-is. */
	readonly createdAt: number;
}

export interface UniverseAgentListClipboardResult {
	readonly entries: readonly UniverseAgentClipboardEntrySummary[];
}

/**
 * ConfigService.SetPermissionPolicy — session/tool policy write
 * (≠ SwitchModel / ListModels / Get / Set / GetModelPreferences /
 * SetModelPreferences / SetPermissionMode).
 */
export type UniverseAgentPermissionPolicy =
	| 'PERMISSION_POLICY_UNSPECIFIED'
	| 'PERMISSION_POLICY_ASK'
	| 'PERMISSION_POLICY_AGENT'
	| 'PERMISSION_POLICY_PERMIT';

export interface UniverseAgentSetPermissionPolicyRequest {
	readonly sessionId: string;
	/** Proto `tool_name`. Empty = global policy; sent as-is. */
	readonly toolName: string;
	/** Proto `PermissionPolicy`. Wired to enum number. */
	readonly policy: UniverseAgentPermissionPolicy;
}

export interface UniverseAgentSetPermissionPolicyResult {
	readonly ok: boolean;
	readonly message?: string;
}

/**
 * ConfigService.ListModels registry row. Wire fields only — no invented
 * context-window or capability-tag properties (protocol-surface §1b P1b).
 */
export interface UniverseAgentModelEntry {
	readonly id: string;
	readonly type: string;
	readonly enabled: boolean;
	/** Capability level 1–9 from wire `level`. */
	readonly level: number;
	readonly description?: string;
	/** Wire `cost` (`min`…`max`); pass through, do not reinterpret. */
	readonly cost?: string;
	readonly speed?: string;
	readonly provider: string;
	readonly modelId: string;
}

export interface UniverseAgentListModelsResult {
	readonly models: readonly UniverseAgentModelEntry[];
}

/** ConfigService.Get — generic config read (≠ Set / Watch / ListModels / SwitchModel / TestModelProfile). */
export interface UniverseAgentGetConfigRequest {
	/** Proto `key`. Empty sent as-is (engine returns all). */
	readonly key: string;
	/** Proto `scope`. Empty sent as-is. */
	readonly scope: string;
	/** Proto `session_id`. Empty sent as-is. */
	readonly sessionId: string;
}

export interface UniverseAgentGetConfigResult {
	/** Proto `values` map. Empty object sent/returned as-is. */
	readonly values: Readonly<Record<string, string>>;
	readonly scope: string;
}

/** ConfigService.SwitchModel — session-scoped model switch (≠ ListModels / TestModelProfile / Config.Get / Config.Set / GetModelPreferences / SetModelPreferences / SetPermissionPolicy). */
export interface UniverseAgentSwitchModelRequest {
	readonly sessionId: string;
	readonly agentId: string;
	/** Proto oneof `target.model_type`. Empty sent as-is. */
	readonly modelType: string;
	/** Proto oneof `target.model_id`. Empty sent as-is. */
	readonly modelId: string;
}

export interface UniverseAgentSwitchModelResult {
	/** Proto `resolved_model_id`. Empty sent as-is. */
	readonly resolvedModelId: string;
	readonly provider: string;
	readonly level: number;
	readonly cost: string;
	readonly speed: string;
}

/** ConfigService.GetModelPreferences — session model-strategy prefs (≠ SetModelPreferences / SwitchModel / ListModels / Get / Set / SetPermissionPolicy). */
export interface UniverseAgentGetModelPreferencesRequest {
	/** Proto `session_id`. Empty sent as-is. */
	readonly sessionId: string;
}

export interface UniverseAgentGetModelPreferencesResult {
	/** Proto `min_level`. Missing/0 sent as-is. */
	readonly minLevel: number;
	/** Proto `max_cost`. Empty sent as-is. */
	readonly maxCost: string;
	/** Proto `min_speed`. Empty sent as-is. */
	readonly minSpeed: string;
	/** Proto `strategy`. Empty sent as-is. */
	readonly strategy: string;
}

/** ConfigService.ResolveModel — preview resolution without switching (≠ ListModels / SwitchModel / Get / Set / GetModelPreferences / SetModelPreferences / Watch). */
export interface UniverseAgentResolveModelRequest {
	readonly sessionId: string;
	/** Proto `type`. Empty sent as-is. */
	readonly type: string;
}

export interface UniverseAgentResolveModelResult {
	/** Proto `selected`. Absent when the engine omits it. */
	readonly selected?: UniverseAgentModelEntry;
	readonly candidates: readonly UniverseAgentModelEntry[];
	readonly filtered: readonly UniverseAgentModelEntry[];
}

/**
 * ConfigService.Watch request; proto `stream ConfigChangedEvent`.
 * Empty `keys` are sent as-is (engine watches all).
 * ≠ Get / Set / ListModels / SwitchModel / GetCommandDef.
 */
export interface UniverseAgentWatchConfigRequest {
	/** Proto `keys`. Empty sent as-is (engine watches all). */
	readonly keys: readonly string[];
}

/** Proto `ConfigChangedEvent`. Empty `key` / `oldValue` / `newValue` / `scope` mapped as-is. */
export interface UniverseAgentConfigChangedEvent {
	readonly key: string;
	readonly oldValue: string;
	readonly newValue: string;
	readonly scope: string;
	/** Proto `timestamp`. Missing/0 mapped as-is. */
	readonly timestamp: number;
}

/** Server-stream handle for ConfigService.Watch (client does not write). */
export interface UniverseAgentWatchConfigStream {
	dispose(): void;
}

/**
 * MCP runtime connection status from McpService.GetMcpServerStatuses.
 * Proto `MCP_STATUS_UNSPECIFIED` maps to `failed` (no fifth UI state).
 */
export type UniverseAgentMcpRuntimeStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'failed';

export interface UniverseAgentMcpServerStatus {
	readonly serverId: string;
	readonly status: UniverseAgentMcpRuntimeStatus;
	readonly errorMessage?: string;
	readonly lastConnectedAt?: number;
}

export interface UniverseAgentGetMcpServerStatusesResult {
	readonly statuses: readonly UniverseAgentMcpServerStatus[];
	readonly checkedAt?: number;
}

export interface UniverseAgentMcpToolDefinition {
	readonly name: string;
	readonly description?: string;
	readonly inputSchemaJson?: string;
}

export interface UniverseAgentGetMcpServerToolsResult {
	readonly tools: readonly UniverseAgentMcpToolDefinition[];
	readonly total?: number;
	readonly cachedAt?: number;
}

/** PluginService.List / Info status. Wire `PLUGIN_ACTIVE|DISABLED|ERROR`. */
export type UniverseAgentPluginStatus = 'active' | 'disabled' | 'error' | 'unknown';

export interface UniverseAgentPluginSummary {
	readonly id: string;
	readonly displayName: string;
	readonly version: string;
	/** Wire `source` (JAR/DEX filename, `embedded`, or live `"plugin"`). Do not reinterpret. */
	readonly source: string;
	readonly hookCount: number;
	readonly status: UniverseAgentPluginStatus;
	readonly loadedAt?: number;
}

export interface UniverseAgentListPluginsResult {
	readonly plugins: readonly UniverseAgentPluginSummary[];
}

export interface UniverseAgentPluginHookEntry {
	readonly hookType: string;
	readonly priority: number;
	readonly className: string;
}

export interface UniverseAgentPluginInfoResult {
	readonly summary: UniverseAgentPluginSummary;
	readonly hooks: readonly UniverseAgentPluginHookEntry[];
	readonly config?: Readonly<Record<string, string>>;
	readonly errorMessage?: string;
}

export interface UniverseAgentEnablePluginResult {
	readonly plugin: UniverseAgentPluginSummary;
}

export interface UniverseAgentReloadPluginResult {
	readonly plugin: UniverseAgentPluginSummary;
}

export interface UniverseAgentUnloadPluginResult {
	readonly removedHookCount: number;
}

export interface UniverseAgentScanNewPluginsResult {
	readonly newPlugins: readonly UniverseAgentPluginSummary[];
	readonly skippedCount: number;
}
