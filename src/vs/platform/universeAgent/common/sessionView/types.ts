/**
 * View-layer types (INV-SPC-2 / INV-SPC-14).
 * Apply helpers live in `./apply.ts`; no event-fold / lease runtime here.
 *
 * S0 disposition audit (plan ui-interaction-mvp §3.2 — evidence in
 * `view/s0-field-disposition.test.ts`, `app/session/s0-contract-audit.test.ts`):
 * - `TimelineItemSummary` text/reasoning/tool: project lifecycle + bounded previews;
 *   omit author/role/source, verification, outcome, duration (no view fields).
 * - `TimelineItemView.turnId`: project when L1 admits; omit infer from id/orderKey.
 * - `TimelineItemView.detail` / `DetailRef`: opaque handle only; external fetch defer S2+.
 * - `overlay` vs `timeline`: independent arrays; 0 admitted correlation field (S2 materialized append).
 * - Agent projections (`liveAgent*`, `LiveAgentTreeNodeView`): project own-data fold; not Task hierarchy.
 *
 * Forbidden on any view type: seq, sessionVersion, headSeq, runtimeEpoch,
 * deltaSeq, sourceClientId, credentials, fingerprints, dial addresses.
 */

export type SessionId = string & { readonly __brand: 'SessionId' }
export type ViewLeaseId = string & { readonly __brand: 'ViewLeaseId' }
export type TimelineItemId = string & { readonly __brand: 'TimelineItemId' }
export type OverlayBlockId = string & { readonly __brand: 'OverlayBlockId' }
export type ClientActionRequestId = string & { readonly __brand: 'ClientActionRequestId' }
export type OperationId = string & { readonly __brand: 'OperationId' }
export type EffectId = string & { readonly __brand: 'EffectId' }
export type TextChunkId = string & { readonly __brand: 'TextChunkId' }

/** Opaque detail handle — body fetched out-of-band (INV-SPC-13). */
export type DetailRef = string & { readonly __brand: 'DetailRef' }

/**
 * Desensitized sync chrome; never carries credentials (INV-SPC-14).
 * L1 `sessionClosed` / `sessionPurged` / `subscriptionHealth` fold projects
 * transport-opaque scalars into `reason` on `closed` / `degraded` via
 * `String(...)` — never wire enum names or invented sentinel labels.
 * `sessionPurged` is always `{ kind:'closed', reason:'' }` (empty proto).
 * `sessionVisibilityChanged` / `agentTimeout` are claimed without projecting sync chrome.
 */
export type SyncChrome =
	| { readonly kind: 'idle' }
	| { readonly kind: 'syncing' }
	| { readonly kind: 'live' }
	| { readonly kind: 'degraded'; readonly reason: string }
	| { readonly kind: 'closed'; readonly reason: string }

/**
 * Discriminated timeline/overlay/pending summary (S2 U1).
 * UI semantic arms — not a 1:1 wire mirror of L2/L3 (fold mapping is U3).
 * INV-SPC-13: no body / DetailRef here; *Preview fields are truncated only.
 * `generic` = unknown upstream + test probes only (production fold must not
 * collapse known categories into it).
 * Ask-user lives on `kind:'question'` (not permission); permission is decision-only.
 */
export type ToolSummaryStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/**
 * U1 question 子问行（Pending CTA / answers SSOT 元素；ADR-018）。
 * `id` ≡ 逐字 QuestionItem.id — 绝不放展示 fallback `q_i`。
 * 独立 DTO：避免嵌套 readonly 键污染 TimelineItemSummary IPC allowlist。
 */
export type QuestionSummaryItem = {
	readonly id: string
	readonly title: string
	readonly optionsPreview?: readonly string[]
	readonly multiSelect?: boolean
	readonly allowCustom?: boolean
}

/**
 * D9 typed Canvas reference (ADR-309) — projected from envelope CANVAS_REF
 * blocks (mirrors upstream BlockContent.CanvasRef / wire CanvasRefData).
 */
export type TimelineCanvasRef = {
	readonly canvasId: string
	readonly revisionId: string
	readonly title: string
	readonly sourceHash?: string
}

export type TimelineItemSummary =
	| {
			readonly kind: 'text'
			readonly title: string
			readonly preview?: string
			readonly streaming?: boolean
		}
	| {
			readonly kind: 'reasoning'
			readonly title: string
			readonly collapsedPreview?: string
			readonly streaming?: boolean
		}
	| {
			readonly kind: 'tool'
			readonly title: string
			readonly toolName: string
			readonly status: ToolSummaryStatus
			readonly argPreview?: string
			readonly resultPreview?: string
			/**
			 * D9 (ADR-309): typed canvas refs projected from CANVAS_REF blocks in the
			 * same envelope; omit when none admitted. Fail-closed per entry.
			 */
			readonly canvasRefs?: readonly TimelineCanvasRef[]
			/**
			 * True only for clientToolCall chrome rows (respond correlation).
			 * Server streaming `arm:'tool'` must omit — UI Respond CTA keys off this.
			 */
			readonly respondable?: true
		}
	| {
			readonly kind: 'permission'
			readonly title: string
			readonly permissionKind: string
			/** Bounded Ask argumentsJson preview (INV-SPC-13); omit when absent/invalid. */
			readonly argPreview?: string
			readonly optionsPreview?: readonly string[]
			/**
			 * Local decision chrome after host-write-accepted permissionRespond.
			 * Fail-closed: omit until own-data allow|deny is projected; never invent.
			 */
			readonly decision?: 'allow' | 'deny'
		}
	| {
			/**
			 * Ask-user semantic arm (≠ permission Approve/Deny).
			 * Not a DOMAIN_TIMELINE_ARMS / stream-event fold source — interactive side-effect.
			 * `items` / `answerKeysValid`：端态必填（ADR-018；切片 3 已关 optional 过渡）。
			 */
			readonly kind: 'question'
			readonly title: string
			readonly optionsPreview?: readonly string[]
			readonly multiSelect?: boolean
			readonly allowCustom?: boolean
			/** Ask-level 有界子问（≤4）；Pending CTA / answers SSOT（ADR-018）。 */
			readonly items: readonly QuestionSummaryItem[]
			/** false ⇒ 源 ask 含空白/重复 id；UI 不得提交（INV-QKEY-4）。 */
			readonly answerKeysValid: boolean
			/**
			 * Local answered chrome after host-write-accepted questionRespond.
			 * Fail-closed: omit until own-data respond is projected; never invent answer content.
			 */
			readonly answered?: true
		}
	| {
			readonly kind: 'error'
			readonly title: string
			readonly retryable: boolean
			readonly code?: string
		}
	| {
			readonly kind: 'usage'
			readonly title: string
			readonly inputTokens?: number
			readonly outputTokens?: number
			readonly contextPct?: number
		}
	| {
			readonly kind: 'generic'
			readonly title: string
			readonly subtype?: string
		}
	| {
			/**
			 * R-SNAP-4 honest safe degradation (mirror upstream ADR-307): unknown
			 * upstream block carried with verbatim `typeName` + bounded `rawContent`
			 * summary. Emitted only via the explicit `unknownBlock` domain arm —
			 * never by collapsing known categories; identity-admitted rows only
			 * (no id/orderKey → malformed, fail-closed, never placed on the order).
			 */
			readonly kind: 'unknown'
			readonly typeName: string
			/** INV-SPC-13 bounded raw content summary; truncation marked, never washed. */
			readonly rawContent: string
		}

export interface TimelineItemView {
	readonly id: TimelineItemId
	/** Opaque sort key; do not parse or use for gap detection. S0: presentation must not sort by orderKey (spec §8.1.1). */
	readonly orderKey: string
	/** L1 turn id when provided; never inferred from {@link id}. S0: project when admitted; grouping defer until S2 selector. */
	readonly turnId?: string
	readonly summary: TimelineItemSummary
	/** S0 defer: in-place argPreview/resultPreview close §8.2 minimum; resolver not in session-core. */
	readonly detail?: DetailRef
	/** Request-scoped respond agent when projected from pendingActions (ADR-021). */
	readonly agentId?: string
}

export interface TextChunkView {
	readonly chunkId: TextChunkId
	readonly orderKey: string
	readonly text: string
}

export interface OverlayBlockView {
	readonly blockId: OverlayBlockId
	readonly orderKey: string
	readonly summary: TimelineItemSummary
	readonly detail?: DetailRef
	readonly chunks: readonly TextChunkView[]
}

export interface RuntimeOverlayView {
	readonly blocks: readonly OverlayBlockView[]
}

export interface PendingActionView {
	readonly requestId: ClientActionRequestId
	readonly summary: TimelineItemSummary
	/** Request-scoped agent for Chat respond uplink (ADR-021). */
	readonly agentId?: string
}

export interface PendingSendView {
	readonly operationId: OperationId
	readonly summary: TimelineItemSummary
}

/** FetchAgentStatus fold (agent id + status label only; own-data). */
export interface LiveAgentStatusView {
	readonly agentId: string
	readonly status: string
}

/** FetchAgentTree fold node (no modelInfo; own-data). */
export interface LiveAgentTreeNodeView {
	readonly agentId: string
	readonly name: string
	readonly type: string
	readonly status: string
	readonly model: string
	readonly turnCount: number
	readonly createdAt: number
	readonly children: readonly LiveAgentTreeNodeView[]
}

/** FetchAgentSnapshots / ListSnapshots row fold (own-data). */
export interface LiveAgentSnapshotRowView {
	readonly id: string
	readonly sessionId: string
	readonly title: string
	readonly description: string
	readonly createdAt: number
	readonly turnCount: number
	readonly tokenCount: number
	readonly modelId: string
	readonly isAuto: boolean
}

/** ADR-312 opaque branch topology notice (0× seq/sessionVersion/sourceClientId). */
export interface BranchTopologyNoticeView {
	readonly reason: string
	readonly branchMetaJson: string
	readonly affectedTurnIdsJson: string
	readonly messagesJson: string
	readonly divergedFromTurnId: string
	readonly operationId?: string
	/** Nested opaque notice; 0× MEP expand. */
	readonly notice?: unknown
}

export interface SessionViewSnapshot {
	readonly sessionId: SessionId
	readonly sync: SyncChrome
	readonly timeline: readonly TimelineItemView[]
	readonly overlay: RuntimeOverlayView
	readonly pendingActions: readonly PendingActionView[]
	readonly localPendingSends: readonly PendingSendView[]
	/** Present only after admitted `agentStatusBound` fold; never invented. */
	readonly liveAgentStatus?: LiveAgentStatusView
	/** Present only after admitted `teamIdBound` fold; never invented. */
	readonly liveTeamId?: number
	/** Present only after admitted `agentTreeBound` fold; never invented. */
	readonly liveAgentTree?: LiveAgentTreeNodeView
	/** Present only after admitted `agentSnapshotsBound` fold; never invented. */
	readonly liveAgentSnapshots?: readonly LiveAgentSnapshotRowView[]
	/**
	 * Bounded by admitted `branchTopologyNotified` fold (ADR-312); never invented.
	 * View `appendBranchTopologyNotice` folds by `operationId` and caps at 32
	 * most-recent entries (last-write-wins; oldest truncated).
	 */
	readonly branchTopologyNotices?: readonly BranchTopologyNoticeView[]
}

export type ViewPatch =
	| { readonly op: 'upsertTimelineItem'; readonly item: TimelineItemView }
	| { readonly op: 'removeTimelineItem'; readonly itemId: TimelineItemId }
	| { readonly op: 'upsertOverlayBlock'; readonly block: OverlayBlockView }
	| { readonly op: 'removeOverlayBlock'; readonly blockId: OverlayBlockId }
	| {
			readonly op: 'upsertTextChunk'
			readonly blockId: OverlayBlockId
			readonly chunk: TextChunkView
		}
	| { readonly op: 'upsertPendingAction'; readonly action: PendingActionView }
	| { readonly op: 'removePendingAction'; readonly requestId: ClientActionRequestId }
	| { readonly op: 'upsertLocalSend'; readonly send: PendingSendView }
	| { readonly op: 'removeLocalSend'; readonly operationId: OperationId }
	| { readonly op: 'setSyncChrome'; readonly sync: SyncChrome }
	| { readonly op: 'setLiveAgentStatus'; readonly liveAgentStatus: LiveAgentStatusView }
	| { readonly op: 'setLiveTeamId'; readonly liveTeamId: number }
	| { readonly op: 'setLiveAgentTree'; readonly liveAgentTree: LiveAgentTreeNodeView }
	| {
			readonly op: 'setLiveAgentSnapshots'
			readonly liveAgentSnapshots: readonly LiveAgentSnapshotRowView[]
		}
	| {
			readonly op: 'appendBranchTopologyNotice'
			readonly notice: BranchTopologyNoticeView
		}
	| {
			readonly op: 'pendingRespondFailed'
			readonly requestId: ClientActionRequestId
			readonly cause: 'hostWriteFailed' | 'commandFailed'
			readonly retryable: boolean
			readonly error: string
		}

export interface ViewEffect {
	readonly effectId: EffectId
	readonly kind: string
	readonly message: string
}

export interface ViewFrame {
	readonly leaseId: ViewLeaseId
	readonly generation: number
	readonly frameId: number
	readonly version: number
	readonly body:
		| { readonly kind: 'baseline'; readonly snapshot: SessionViewSnapshot }
		| { readonly kind: 'patches'; readonly patches: readonly ViewPatch[] }
		| { readonly kind: 'effects'; readonly effects: readonly ViewEffect[] }
}
