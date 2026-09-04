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

/** AgentService.SuspendLoop — hang loop control-flow (≠ Pause / PauseQueue / Cancel / Resume / ResumeLoop / Branch / StopLoop). */
export interface UniverseAgentSuspendLoopRequest {
	readonly sessionId: string;
	readonly agentId: string;
}

export interface UniverseAgentSuspendLoopResult {
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

/** AgentService.EnqueueQueueItem. */
export interface UniverseAgentEnqueueQueueItemRequest extends UniverseAgentQueueRefRequest {
	readonly text: string;
	readonly clientMessageId?: string;
	readonly priority?: UniverseAgentQueuePriority;
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
 * `openRegenerateStream`, `subscribeSessionEventStream`). Local dispose /
 * cancel does not fire this.
 */
export type UniverseAgentSessionStreamCloseCause =
	| { readonly kind: 'remote' }
	| { readonly kind: 'error'; readonly message: string };

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
