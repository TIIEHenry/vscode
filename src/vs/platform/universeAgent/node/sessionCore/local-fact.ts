/**
 * Normalized local facts posted via `CoreMessage.localFact` (ADR-009 · ADR-012).
 * Hosts (Main bootstrap seed, ChatSideEffectCoordinator, engine:command) normalize
 * before post; Actor folds only recognised kinds.
 *
 * Stream narrow arms (Host still forwards opaque `event: unknown`):
 * - `arm:'applyViewPatches'` — Wave-4 Slice-A patches predicate
 * - `arm:'hello'` — demux StreamHello body (`sessionVersion`/`headSeq`/`runtimeEpoch`)
 * - `arm:'overlayPendingSnapshot'` — INV-OPS-DOM-1 arm-body domain fail-closed
 *   (`runtimeEpoch` safe non-negative int when present; pending[] item shape closed set)
 * - `arm:'overlayActiveTurn'` — L3 activeTurn streamingText/thinkingText → overlay
 *   block fold (addressable turnId + string streamingText/thinkingText; optional
 *   generatingToolName chrome; not DOMAIN_TIMELINE_ARMS)
 * - `arm:'overlayActiveTurnClear'` — L3 activeTurn absent → remove in-flight overlay
 *   block (0× timeline; Actor tracks blockId)
 * - `arm:'text' | 'tool'` — demuxed domain timeline → ViewPatch（见 stream-event-to-view-patch）
 *
 * INV-CLF-OWN-1: isChatStreamUpFact / isChatStreamDownFact admit only own-data
 * kind / chatAttemptId (file-private readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-2: isClientToolRespondFact admits only own-data kind / callId /
 * isError / content (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-3: isTurnInterruptedFact admits only own-data kind / turnId /
 * messageId (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-4: isQuestionAskedFact admits only own-data kind / questionId /
 * questions (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-5: isInputDeliveryFact admits only own-data kind / messageId /
 * status (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-6: isPermissionRespondFact admits only own-data kind / requestId /
 * decision (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-7: isQuestionRespondFact admits only own-data kind / questionId /
 * answers / customText (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-8: isSubmitInputFact admits only own-data kind / correlation
 * (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-CORR-ID-2: isCorrelationLike + permissionRespond requestId /
 * clientToolRespond callId / questionRespond questionId are exact-canonical
 * only (length > 0 ∧ value === value.trim(); pattern ≡ admitSnapshotIdField;
 * 0× wash / trim-write). Padded submit correlation / respond ids fail admit.
 *
 * INV-CLF-QASK-ID-2: isQuestionAskedFact questionId is exact-canonical only
 * (same pattern ≡ respond questionId / admitSnapshotIdField / CLF-CORR;
 * 0× wash). Padded questionAsked questionId fails admit (do not rely only on
 * Actor SING withhold).
 *
 * INV-CLF-IDL-ID-1: isInputDeliveryFact messageId and isTurnInterruptedFact
 * turnId / messageId are exact-canonical only (length > 0 ∧ value ===
 * value.trim(); pattern ≡ admitSnapshotIdField / CLF-CORR; 0× wash).
 * Padded delivery / interrupt ids fail admit.
 *
 * INV-CLF-OWN-9: isStreamHelloArm / isStreamHelloEvent admit only own-data
 * arm / body / sessionVersion / headSeq / runtimeEpoch (reuse readOwnDataValue;
 * accessors never run).
 *
 * INV-CLF-OWN-10: isOverlayPendingSnapshotArm / isOverlayPendingSnapshotEvent
 * admit only own-data arm / body / runtimeEpoch / pending[] item requestId /
 * kind / description (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-11: isOverlayActiveTurnArm / isOverlayActiveTurnEvent admit only
 * own-data arm / body / turnId / streamingText / thinkingText /
 * generatingToolName (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-12: isOverlayActiveTurnClearArm / isOverlayActiveTurnClearEvent
 * admit only own-data arm / body (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-OWN-13: isRangeReplacedArm / isRangeReplacedEvent admit only own-data
 * arm / body / meta / events (reuse readOwnDataValue; accessors never run).
 *
 * INV-CLF-SEED-OWN-1: isSeedSeqCursorFact admits only own-data kind /
 * lastAppliedSeq / lastSessionVersion (reuse readOwnDataValue; accessors
 * never run). isSafeNonNegativeInt domain unchanged (INV-SSC-DOM-1).
 *
 * INV-CLF-AVP-OWN-1: isApplyViewPatchesFact / hasViewPatchesArray /
 * isApplyViewPatchesStreamEvent admit only own-data kind|arm / body /
 * patches (reuse readOwnDataValue; accessors never run).
 */

import type { CorrelationRef } from './messages.js'
import type { AttemptId } from './ports.js'
import type { ViewPatch } from '../../common/sessionView/types.js'

/** Admitted AgentInfo tree node fold (FetchAgentTree; no modelInfo). */
export type AgentTreeNodeBound = {
	readonly agentId: string
	readonly name: string
	readonly type: string
	readonly status: string
	readonly model: string
	readonly turnCount: number
	readonly createdAt: number
	readonly children: readonly AgentTreeNodeBound[]
}

/** Admitted SessionSnapshotInfo row fold (FetchAgentSnapshots / ListSnapshots). */
export type SessionSnapshotInfoBound = {
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

/**
 * Closed set of facts Actor folds. Unknown objects remain accepted on the wire
 * (`fact: unknown`) but no-op. `engineCommand` stays no-op — mutating submit uses
 * `submitInput` (ADR-012 §6; mutating must not fall back to engineCommand).
 *
 * `submitInput`: correlation + payload; Actor folds bounded `upsertLocalSend`
 * (ADR-012 §6.2) then chatStreamWrite / pending queue.
 * `permissionRespond`: requestId + decision; Actor folds to chatStreamWrite /
 * pending queue (correlation ≡ requestId; no localPendingSends).
 * `clientToolRespond`: callId + isError + content; ADR-325 unary success cleanup —
 * Actor applies pending clear / timeline chrome immediately; 0× chatStreamWrite.
 * `questionRespond`: questionId + answers + customText; ADR-325 unary success
 * cleanup — Actor applies answered chrome + pending clear immediately;
 * 0× chatStreamWrite.
 * `inputDelivery`: Chat delivery receipt (ADR-012 §6.3); failed → supersede
 * localPendingSends (messageId ≡ operationId); accepted/dispatched → diag only.
 * Never a DOMAIN_TIMELINE_ARMS / streamEvent arm.
 * `questionAsked`: Chat ask-user side-effect (INV-QQ); → upsertPendingAction
 * (requestId ≡ questionId; summary.kind:'question' via timelineItemFromQuestionAsk).
 * Never a DOMAIN_TIMELINE_ARMS / streamEvent arm.
 * `turnInterrupted`: Chat partial-turn interrupt (INV-TI-*); → upsertTimelineItem
 * (summary.kind:'error'; retryable ≡ canContinue for later CTA slice).
 * Never a DOMAIN_TIMELINE_ARMS / streamEvent arm; no ContinueGeneration RPC.
 */
export type InputDeliveryStatus =
	'accepted' | 'dispatched' | 'failed' | 'unspecified' | 'unrecognized'

export type NormalizedLocalFact =
	| { readonly kind: 'applyViewPatches'; readonly patches: readonly ViewPatch[] }
	| { readonly kind: 'engineCommand'; readonly commandId: string; readonly input: unknown }
	| { readonly kind: 'chatStreamUp'; readonly chatAttemptId: AttemptId }
	| { readonly kind: 'chatStreamDown'; readonly chatAttemptId: AttemptId }
	| {
			readonly kind: 'submitInput'
			readonly correlation: CorrelationRef
			readonly payload: unknown
		}
	| {
			readonly kind: 'rootAgentBound'
			/** Live session root agent for submitInput Chat write (ADR-021). */
			readonly agentId: string
		}
	| {
			readonly kind: 'agentStatusBound'
			/** Agent id from FetchAgentStatus StatusResponse.agent (own-data). */
			readonly agentId: string
			/** Agent status label from StatusResponse.agent.status (own-data). */
			readonly status: string
		}
	| {
			readonly kind: 'teamIdBound'
			/** Live team id from session/team projection (own-data). */
			readonly teamId: number
		}
	| {
			readonly kind: 'branchTopologyNotified'
			/** ADR-312 opaque topology notice (view-safe subset; 0× seq/fromSeq). */
			readonly reason: string
			readonly branchMetaJson: string
			readonly affectedTurnIdsJson: string
			readonly messagesJson: string
			readonly divergedFromTurnId: string
			readonly operationId?: string
			readonly notice?: unknown
		}
	| ({
			readonly kind: 'agentTreeBound'
		} & AgentTreeNodeBound)
	| {
			readonly kind: 'agentSnapshotsBound'
			/** Admitted ListSnapshotsResponse.snapshots fold (bounded own-data rows). */
			readonly snapshots: readonly SessionSnapshotInfoBound[]
		}
	| {
			readonly kind: 'permissionRespond'
			readonly requestId: string
			readonly decision: 'allow' | 'deny'
		}
	| {
			readonly kind: 'clientToolRespond'
			readonly callId: string
			readonly isError: boolean
			readonly content: string
			readonly metadataJson?: string
		}
	| {
			readonly kind: 'questionRespond'
			readonly questionId: string
			readonly answers: Readonly<Record<string, { readonly selectedLabels: readonly string[] }>>
			readonly customText: string
		}
	| {
			readonly kind: 'inputDelivery'
			readonly messageId: string
			readonly status: InputDeliveryStatus
			readonly errorCode?: string
			readonly errorMessage?: string
		}
	| {
			readonly kind: 'questionAsked'
			/** ≡ demux body.id ≡ respond correlation. */
			readonly questionId: string
			/** Request-scoped agent for Chat respond uplink (ADR-021). */
			readonly agentId?: string
			readonly questions: ReadonlyArray<{
				readonly id?: string
				readonly header?: string
				readonly question?: string
				readonly optionsPreview?: readonly string[]
				readonly multiSelect?: boolean
				readonly allowCustom?: boolean
			}>
		}
	| {
			readonly kind: 'turnInterrupted'
			readonly turnId: string
			readonly messageId: string
			readonly completionStatus?: string
			/** Proto canContinue; folded to timeline error.retryable (later CTA slice). */
			readonly canContinue?: true
			readonly reason?: string
		}
	| {
			readonly kind: 'continueGeneration'
			readonly agentId: string
			readonly turnId: string
			/** correlation ≡ messageId (ContinueGenerationRequest.message_id). */
			readonly messageId: string
		}
	/**
	 * ADR-029 Regenerate composite intent — EditMessage (preserve text) + submitInput.
	 * Actor fold: unaryCommand edit → commandOutcome → chatStreamWrite submit.
	 */
	| {
			readonly kind: 'regenerateTurn'
			readonly userTurnId: string
			readonly preservedContent: string
			readonly correlation: CorrelationRef
			readonly agentId?: string
			readonly anchorMessageId?: string
		}
	/**
	 * Host unary command completion posted back to Actor (ADR-029 two-phase fold).
	 */
	| {
			readonly kind: 'commandOutcome'
			readonly correlation: CorrelationRef
			readonly commandId: string
			readonly succeeded: boolean
			readonly error?: string
		}
	/**
	 * Test/host seed for local seq cursor until L2 fold owns advancement.
	 * Not a production engine fact.
	 */
	| {
			readonly kind: 'seedSeqCursor'
			readonly lastAppliedSeq: number
			readonly lastSessionVersion: number
		}

/** Narrow stream event arm recognised by Actor (not a full SessionEvent algebra). */
export type ApplyViewPatchesStreamEvent = {
	readonly arm: 'applyViewPatches'
	readonly body: { readonly patches: readonly ViewPatch[] }
}

/**
 * Demux-aligned StreamHello projection (`demuxSessionStreamEvent` → `arm:'hello'`).
 * Seq / version stay Actor-internal — never fold into ViewPatch / SyncChrome (INV-SPC-2).
 */
export type StreamHelloBody = {
	readonly sessionVersion: number
	readonly headSeq: number
	readonly runtimeEpoch: number
	readonly lastMutatedFromSeq: number
}

export type StreamHelloEvent = {
	readonly arm: 'hello'
	readonly body: StreamHelloBody
}

/** Observable StreamHello anchor retained by Actor (gap/HistoryFill hook input). */
export type StreamHelloAnchor = StreamHelloBody

/**
 * Demux-aligned RuntimeOverlaySnapshot.pending yield
 * (`arm:'overlayPendingSnapshot'` — ADR-017 INV-ROS-C*).
 * Not a DOMAIN_TIMELINE_ARMS fold source; Actor set-replaces pendingActions.
 */
export type OverlayPendingSnapshotKind = 'permission' | 'question' | 'clientToolCall'

export type OverlayPendingSnapshotItem = {
	readonly requestId: string
	readonly kind: OverlayPendingSnapshotKind
	readonly toolName?: string
	readonly description: string
	readonly agentId?: string
	readonly questions?: ReadonlyArray<{
		readonly id: string
		readonly header?: string
		readonly question?: string
		readonly optionsPreview?: readonly string[]
		readonly multiSelect: boolean
		readonly allowCustom: boolean
	}>
	readonly argumentsJson?: string
}

export type OverlayPendingSnapshotBody = {
	readonly runtimeEpoch?: number
	readonly pending: readonly OverlayPendingSnapshotItem[]
}

export type OverlayPendingSnapshotEvent = {
	readonly arm: 'overlayPendingSnapshot'
	readonly body: OverlayPendingSnapshotBody
}

/** Demux-aligned RuntimeOverlaySnapshot.activeTurn yield (L3 streaming overlay). */
export type OverlayActiveTurnBody = {
	readonly turnId: string
	readonly streamingText: string
	readonly thinkingText: string
	readonly generatingToolName?: string
}

export type OverlayActiveTurnEvent = {
	readonly arm: 'overlayActiveTurn'
	readonly body: OverlayActiveTurnBody
}

/** Demux-aligned RuntimeOverlaySnapshot without activeTurn → clear in-flight overlay. */
export type OverlayActiveTurnClearEvent = {
	readonly arm: 'overlayActiveTurnClear'
	readonly body: Record<string, never>
}

/**
 * ADR-019 compound control arm (INV-SSR-APPLY-14 — not DOMAIN_TIMELINE_ARMS).
 * Transport-opaque seq on inner events is Actor-index feed only.
 */
export type RangeReplacedMeta = {
	readonly fromSeq: number
	readonly replacedEnvelopeIds?: readonly string[]
	readonly subtreeRootTurnId?: string
	readonly newHeadSeq?: number
	readonly sessionVersion?: number
	readonly divergedFromTurnId?: string
	readonly reason?: number
	readonly operationId?: string
}

export type RangeReplacedInnerEvent = {
	readonly arm: string
	readonly body?: unknown
	readonly seq?: number
}

export type RangeReplacedBody = {
	readonly meta: RangeReplacedMeta
	readonly events: readonly RangeReplacedInnerEvent[]
}

export type RangeReplacedEvent = {
	readonly arm: 'rangeReplaced'
	readonly body: RangeReplacedBody
}

export function hasViewPatchesArray(
	value: unknown,
): value is { readonly patches: readonly ViewPatch[] } {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
	return Array.isArray(readOwnDataValue(value, 'patches'))
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value)
}

export function isApplyViewPatchesFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'applyViewPatches' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	return readOwnDataValue(fact, 'kind') === 'applyViewPatches' && hasViewPatchesArray(fact)
}

export function isApplyViewPatchesStreamEvent(
	event: unknown,
): event is ApplyViewPatchesStreamEvent {
	if (typeof event !== 'object' || event === null || Array.isArray(event)) return false
	return (
		readOwnDataValue(event, 'arm') === 'applyViewPatches' &&
		hasViewPatchesArray(readOwnDataValue(event, 'body'))
	)
}

/** True when event claims the hello arm (even if body is malformed). */
export function isStreamHelloArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null || Array.isArray(event)) return false
	return readOwnDataValue(event, 'arm') === 'hello'
}

/**
 * File-private numeric domain for stream arm bodies / seed anchors:
 * - `hello` (`sessionVersion` / `headSeq` / `runtimeEpoch` / `lastMutatedFromSeq`)
 * - `overlayPendingSnapshot` (`runtimeEpoch` when present; INV-OPS-DOM-1)
 * - `seedSeqCursor` (`lastAppliedSeq` / `lastSessionVersion`; INV-SSC-DOM-1)
 */
function isSafeNonNegativeInt(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export function isStreamHelloEvent(event: unknown): event is StreamHelloEvent {
	if (!isStreamHelloArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
	return (
		isSafeNonNegativeInt(readOwnDataValue(body, 'sessionVersion')) &&
		isSafeNonNegativeInt(readOwnDataValue(body, 'headSeq')) &&
		isSafeNonNegativeInt(readOwnDataValue(body, 'runtimeEpoch')) &&
		isSafeNonNegativeInt(readOwnDataValue(body, 'lastMutatedFromSeq'))
	)
}

/** True when event claims the overlayPendingSnapshot arm (even if body is malformed). */
export function isOverlayPendingSnapshotArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null || Array.isArray(event)) return false
	return readOwnDataValue(event, 'arm') === 'overlayPendingSnapshot'
}

const OVERLAY_PENDING_SNAPSHOT_KINDS: readonly OverlayPendingSnapshotKind[] = [
	'permission',
	'question',
	'clientToolCall',
]

function isOverlayPendingSnapshotItemShape(value: unknown): value is OverlayPendingSnapshotItem {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false
	}
	const requestId = readOwnDataValue(value, 'requestId')
	const kind = readOwnDataValue(value, 'kind')
	const description = readOwnDataValue(value, 'description')
	return (
		typeof requestId === 'string' &&
		typeof description === 'string' &&
		typeof kind === 'string' &&
		(OVERLAY_PENDING_SNAPSHOT_KINDS as readonly string[]).includes(kind)
	)
}

export function isOverlayPendingSnapshotEvent(
	event: unknown,
): event is OverlayPendingSnapshotEvent {
	if (!isOverlayPendingSnapshotArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
	const pending = readOwnDataValue(body, 'pending')
	if (!Array.isArray(pending)) return false
	const runtimeEpoch = readOwnDataValue(body, 'runtimeEpoch')
	if (runtimeEpoch !== undefined && !isSafeNonNegativeInt(runtimeEpoch)) {
		return false
	}
	return pending.every(isOverlayPendingSnapshotItemShape)
}

/** True when event claims the overlayActiveTurn arm (even if body is malformed). */
export function isOverlayActiveTurnArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null || Array.isArray(event)) return false
	return readOwnDataValue(event, 'arm') === 'overlayActiveTurn'
}

/** INV-SC-CTRL-1: no-control-regex — C0/DEL via charCode instead of /[\u0000-\u001f\u007f]/ regex. */
function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i)
		if (code <= 0x1f || code === 0x7f) return true
	}
	return false
}

function admitOverlayActiveTurnId(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0) return false
	if (value !== value.trim()) return false
	if (hasControlChar(value)) return false
	return true
}

export function isOverlayActiveTurnEvent(event: unknown): event is OverlayActiveTurnEvent {
	if (!isOverlayActiveTurnArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
	if (!admitOverlayActiveTurnId(readOwnDataValue(body, 'turnId'))) return false
	if (typeof readOwnDataValue(body, 'streamingText') !== 'string') return false
	if (typeof readOwnDataValue(body, 'thinkingText') !== 'string') return false
	const generatingToolName = readOwnDataValue(body, 'generatingToolName')
	if (generatingToolName !== undefined && typeof generatingToolName !== 'string') {
		return false
	}
	return true
}

/** True when event claims the overlayActiveTurnClear arm (even if body is malformed). */
export function isOverlayActiveTurnClearArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null || Array.isArray(event)) return false
	return readOwnDataValue(event, 'arm') === 'overlayActiveTurnClear'
}

export function isOverlayActiveTurnClearEvent(
	event: unknown,
): event is OverlayActiveTurnClearEvent {
	if (!isOverlayActiveTurnClearArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	if (body === undefined) return true
	if (typeof body !== 'object' || body === null || Array.isArray(body)) {
		return false
	}
	return true
}

/** True when event claims the rangeReplaced arm (even if body is malformed). */
export function isRangeReplacedArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null || Array.isArray(event)) return false
	return readOwnDataValue(event, 'arm') === 'rangeReplaced'
}

export function isRangeReplacedEvent(event: unknown): event is RangeReplacedEvent {
	if (!isRangeReplacedArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
	const events = readOwnDataValue(body, 'events')
	if (!Array.isArray(events)) return false
	const meta = readOwnDataValue(body, 'meta')
	if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return false
	// fromSeq shape is validated by planRangeReplacedApply (fail-closed there).
	return true
}

/** Best-effort arm label for diagnostics (opaque events). */
export function streamEventArmLabel(event: unknown): string {
	if (typeof event !== 'object' || event === null || Array.isArray(event)) return 'missing'
	const arm = (event as { readonly arm?: unknown }).arm
	return typeof arm === 'string' && arm.length > 0 ? arm : 'missing'
}

function isAttemptIdLike(value: unknown): value is AttemptId {
	return typeof value === 'string' && value.length > 0
}

/** INV-CLF-CORR-ID-2: exact-canonical only (≡ admitSnapshotIdField; 0× wash). */
function isCorrelationLike(value: unknown): value is CorrelationRef {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

/** Own data only — prototype chain and accessors are refused (never invoked). */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

export function isChatStreamUpFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'chatStreamUp' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	return (
		readOwnDataValue(fact, 'kind') === 'chatStreamUp' &&
		isAttemptIdLike(readOwnDataValue(fact, 'chatAttemptId'))
	)
}

export function isChatStreamDownFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'chatStreamDown' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	return (
		readOwnDataValue(fact, 'kind') === 'chatStreamDown' &&
		isAttemptIdLike(readOwnDataValue(fact, 'chatAttemptId'))
	)
}

/** Lifecycle facts the coordinator may post during teardown (auth-exempt). */
export function isChatLifecycleLocalFact(fact: unknown): boolean {
	return isChatStreamUpFact(fact) || isChatStreamDownFact(fact)
}

export function isSubmitInputFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'submitInput' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	return (
		readOwnDataValue(fact, 'kind') === 'submitInput' &&
		isCorrelationLike(readOwnDataValue(fact, 'correlation'))
	)
}

const ROOT_AGENT_ID_MAX = 128

const ROOT_AGENT_ID_STRINGIFY_GARBAGE = new Set(['undefined', 'null', '[object Object]', 'NaN'])

/** ADR-021: reject-only; align admitReflexAckAgentId — never trim / sanitize. */
function admitRootAgentId(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > ROOT_AGENT_ID_MAX) return false
	if (value !== value.trim()) return false
	if (hasControlChar(value)) return false
	return !ROOT_AGENT_ID_STRINGIFY_GARBAGE.has(value)
}

export function isRootAgentBoundFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'rootAgentBound' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	const agentId = readOwnDataValue(fact, 'agentId')
	return readOwnDataValue(fact, 'kind') === 'rootAgentBound' && admitRootAgentId(agentId)
}

function admitAgentStatusLabel(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > 128) return false
	if (value !== value.trim()) return false
	return true
}

export function isAgentStatusBoundFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'agentStatusBound' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	const agentId = readOwnDataValue(fact, 'agentId')
	const status = readOwnDataValue(fact, 'status')
	return (
		readOwnDataValue(fact, 'kind') === 'agentStatusBound' &&
		admitRootAgentId(agentId) &&
		admitAgentStatusLabel(status)
	)
}

export function isTeamIdBoundFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'teamIdBound' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	const teamId = readOwnDataValue(fact, 'teamId')
	return readOwnDataValue(fact, 'kind') === 'teamIdBound' && isSafeNonNegativeInt(teamId)
}

function admitBranchTopologyStringField(value: unknown): value is string {
	return typeof value === 'string'
}

function admitBranchTopologyAddress(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

export function isBranchTopologyNotifiedFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'branchTopologyNotified' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	if (readOwnDataValue(fact, 'kind') !== 'branchTopologyNotified') return false
	const reason = readOwnDataValue(fact, 'reason')
	const branchMetaJson = readOwnDataValue(fact, 'branchMetaJson')
	const affectedTurnIdsJson = readOwnDataValue(fact, 'affectedTurnIdsJson')
	const messagesJson = readOwnDataValue(fact, 'messagesJson')
	const divergedFromTurnId = readOwnDataValue(fact, 'divergedFromTurnId')
	if (!admitBranchTopologyStringField(reason)) return false
	if (!admitBranchTopologyStringField(branchMetaJson)) return false
	if (!admitBranchTopologyStringField(affectedTurnIdsJson)) return false
	if (!admitBranchTopologyStringField(messagesJson)) return false
	if (!admitBranchTopologyAddress(divergedFromTurnId)) return false
	if (Object.hasOwn(fact, 'operationId')) {
		const operationId = readOwnDataValue(fact, 'operationId')
		if (!admitBranchTopologyAddress(operationId)) return false
	}
	if (Object.hasOwn(fact, 'notice')) {
		const notice = readOwnDataValue(fact, 'notice')
		if (notice === null || typeof notice !== 'object' || Array.isArray(notice)) {
			return false
		}
	}
	return true
}

function admitTreeStringField(value: unknown): value is string {
	return typeof value === 'string'
}

function admitTreeCountField(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function admitAgentTreeNodeBound(value: unknown): value is AgentTreeNodeBound {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false
	}
	const agentId = readOwnDataValue(value, 'agentId')
	const name = readOwnDataValue(value, 'name')
	const type = readOwnDataValue(value, 'type')
	const status = readOwnDataValue(value, 'status')
	const model = readOwnDataValue(value, 'model')
	const turnCount = readOwnDataValue(value, 'turnCount')
	const createdAt = readOwnDataValue(value, 'createdAt')
	const childrenRaw = readOwnDataValue(value, 'children')
	if (!admitRootAgentId(agentId)) return false
	if (!admitTreeStringField(name)) return false
	if (!admitTreeStringField(type)) return false
	if (!admitTreeStringField(status)) return false
	if (!admitTreeStringField(model)) return false
	if (!admitTreeCountField(turnCount)) return false
	if (!admitTreeCountField(createdAt) || createdAt > Number.MAX_SAFE_INTEGER) return false
	if (!Array.isArray(childrenRaw)) return false
	for (const child of childrenRaw) {
		if (!admitAgentTreeNodeBound(child)) return false
	}
	return true
}

export function isAgentTreeBoundFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'agentTreeBound' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	return readOwnDataValue(fact, 'kind') === 'agentTreeBound' && admitAgentTreeNodeBound(fact)
}

const AGENT_SNAPSHOTS_BOUND_MAX = 256

const SNAPSHOT_ROW_KEYS = new Set([
	'id',
	'sessionId',
	'title',
	'description',
	'createdAt',
	'turnCount',
	'tokenCount',
	'modelId',
	'isAuto',
])

function hasOnlyOwnKeys(record: object, allowed: ReadonlySet<string>): boolean {
	for (const key of Object.keys(record)) {
		if (!allowed.has(key)) return false
	}
	return true
}

function admitSnapshotStringField(value: unknown): value is string {
	return typeof value === 'string'
}

function admitSnapshotIdField(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function admitSnapshotCountField(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function admitSnapshotMetaField(value: unknown): value is number {
	return admitSnapshotCountField(value) && value <= Number.MAX_SAFE_INTEGER
}

function admitSessionSnapshotInfoBound(value: unknown): value is SessionSnapshotInfoBound {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false
	}
	if (!hasOnlyOwnKeys(value, SNAPSHOT_ROW_KEYS)) return false
	const id = readOwnDataValue(value, 'id')
	const sessionId = readOwnDataValue(value, 'sessionId')
	const title = readOwnDataValue(value, 'title')
	const description = readOwnDataValue(value, 'description')
	const createdAt = readOwnDataValue(value, 'createdAt')
	const turnCount = readOwnDataValue(value, 'turnCount')
	const tokenCount = readOwnDataValue(value, 'tokenCount')
	const modelId = readOwnDataValue(value, 'modelId')
	const isAuto = readOwnDataValue(value, 'isAuto')
	if (!admitSnapshotIdField(id)) return false
	if (!admitSnapshotIdField(sessionId)) return false
	if (!admitSnapshotStringField(title)) return false
	if (!admitSnapshotStringField(description)) return false
	if (!admitSnapshotMetaField(createdAt)) return false
	if (!admitSnapshotCountField(turnCount)) return false
	if (!admitSnapshotMetaField(tokenCount)) return false
	if (!admitSnapshotStringField(modelId)) return false
	return typeof isAuto === 'boolean'
}

function admitAgentSnapshotsBound(value: unknown): value is readonly SessionSnapshotInfoBound[] {
	if (!Array.isArray(value)) return false
	if (value.length > AGENT_SNAPSHOTS_BOUND_MAX) return false
	for (const row of value) {
		if (!admitSessionSnapshotInfoBound(row)) return false
	}
	return true
}

export function isAgentSnapshotsBoundFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'agentSnapshotsBound' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	const snapshots = readOwnDataValue(fact, 'snapshots')
	return (
		readOwnDataValue(fact, 'kind') === 'agentSnapshotsBound' && admitAgentSnapshotsBound(snapshots)
	)
}

export function isPermissionRespondFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'permissionRespond' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	if (readOwnDataValue(fact, 'kind') !== 'permissionRespond') return false
	const requestId = readOwnDataValue(fact, 'requestId')
	const decision = readOwnDataValue(fact, 'decision')
	// INV-CLF-CORR-ID-2: exact-canonical requestId; padded → refuse admit.
	return (
		typeof requestId === 'string' &&
		requestId.length > 0 &&
		requestId === requestId.trim() &&
		(decision === 'allow' || decision === 'deny')
	)
}

export function isClientToolRespondFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'clientToolRespond' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	const kind = readOwnDataValue(fact, 'kind')
	if (kind !== 'clientToolRespond') return false
	const callId = readOwnDataValue(fact, 'callId')
	const isError = readOwnDataValue(fact, 'isError')
	const content = readOwnDataValue(fact, 'content')
	// INV-CLF-CORR-ID-2: exact-canonical callId; padded → refuse admit.
	return (
		typeof callId === 'string' &&
		callId.length > 0 &&
		callId === callId.trim() &&
		typeof isError === 'boolean' &&
		typeof content === 'string'
	)
}

function isQuestionAnswerEntry(
	value: unknown,
): value is { readonly selectedLabels: readonly string[] } {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false
	}
	const labels = (value as { readonly selectedLabels?: unknown }).selectedLabels
	return Array.isArray(labels) && labels.every((label) => typeof label === 'string')
}

function isQuestionAnswersMap(
	value: unknown,
): value is Readonly<Record<string, { readonly selectedLabels: readonly string[] }>> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false
	}
	return Object.values(value).every(isQuestionAnswerEntry)
}

export function isQuestionRespondFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'questionRespond' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	if (readOwnDataValue(fact, 'kind') !== 'questionRespond') return false
	const questionId = readOwnDataValue(fact, 'questionId')
	const answers = readOwnDataValue(fact, 'answers')
	const customText = readOwnDataValue(fact, 'customText')
	// INV-CLF-CORR-ID-2: exact-canonical questionId; padded → refuse admit.
	return (
		typeof questionId === 'string' &&
		questionId.length > 0 &&
		questionId === questionId.trim() &&
		isQuestionAnswersMap(answers) &&
		typeof customText === 'string'
	)
}

const INPUT_DELIVERY_STATUSES: readonly InputDeliveryStatus[] = [
	'accepted',
	'dispatched',
	'failed',
	'unspecified',
	'unrecognized',
]

function isInputDeliveryStatus(value: unknown): value is InputDeliveryStatus {
	return typeof value === 'string' && (INPUT_DELIVERY_STATUSES as readonly string[]).includes(value)
}

export function isInputDeliveryFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'inputDelivery' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	if (readOwnDataValue(fact, 'kind') !== 'inputDelivery') return false
	const messageId = readOwnDataValue(fact, 'messageId')
	const status = readOwnDataValue(fact, 'status')
	// INV-CLF-IDL-ID-1: exact-canonical messageId; padded → refuse admit.
	return (
		typeof messageId === 'string' &&
		messageId.length > 0 &&
		messageId === messageId.trim() &&
		isInputDeliveryStatus(status)
	)
}

/**
 * Fold-recognition guard for `questionAsked` (INV-IQAF-1 ≡ INV-QAG-2).
 * Non-empty `questions` required — aligns Host `admitQuestionAskedBody` (ingest SSOT).
 * INV-CLF-QASK-ID-2: exact-canonical questionId; padded → refuse admit.
 */
export function isQuestionAskedFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'questionAsked' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	const kind = readOwnDataValue(fact, 'kind')
	if (kind !== 'questionAsked') return false
	const questionId = readOwnDataValue(fact, 'questionId')
	const questions = readOwnDataValue(fact, 'questions')
	// INV-CLF-QASK-ID-2: exact-canonical questionId; padded → refuse admit.
	return (
		typeof questionId === 'string' &&
		questionId.length > 0 &&
		questionId === questionId.trim() &&
		Array.isArray(questions) &&
		questions.length > 0
	)
}

export function isTurnInterruptedFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'turnInterrupted' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	if (readOwnDataValue(fact, 'kind') !== 'turnInterrupted') return false
	const turnId = readOwnDataValue(fact, 'turnId')
	const messageId = readOwnDataValue(fact, 'messageId')
	// INV-CLF-IDL-ID-1: exact-canonical turnId / messageId; padded → refuse.
	const hasTurnId = typeof turnId === 'string' && turnId.length > 0 && turnId === turnId.trim()
	const hasMessageId =
		typeof messageId === 'string' && messageId.length > 0 && messageId === messageId.trim()
	return hasTurnId || hasMessageId
}

export function isContinueGenerationFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'continueGeneration' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	if (readOwnDataValue(fact, 'kind') !== 'continueGeneration') return false
	const agentId = readOwnDataValue(fact, 'agentId')
	const turnId = readOwnDataValue(fact, 'turnId')
	const messageId = readOwnDataValue(fact, 'messageId')
	return (
		admitRootAgentId(agentId) &&
		typeof turnId === 'string' &&
		turnId.length > 0 &&
		turnId === turnId.trim() &&
		typeof messageId === 'string' &&
		messageId.length > 0 &&
		messageId === messageId.trim()
	)
}

/** ADR-029: regenerateTurn fact guard — exact-canonical ids + non-empty preservedContent. */
export function isRegenerateTurnFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'regenerateTurn' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	if (readOwnDataValue(fact, 'kind') !== 'regenerateTurn') return false
	const userTurnId = readOwnDataValue(fact, 'userTurnId')
	const preservedContent = readOwnDataValue(fact, 'preservedContent')
	const correlation = readOwnDataValue(fact, 'correlation')
	if (
		typeof userTurnId !== 'string' ||
		userTurnId.length === 0 ||
		userTurnId !== userTurnId.trim()
	) {
		return false
	}
	if (typeof preservedContent !== 'string' || preservedContent.trim().length === 0) {
		return false
	}
	if (!isCorrelationLike(correlation)) return false
	const agentId = readOwnDataValue(fact, 'agentId')
	if (agentId !== undefined) {
		if (typeof agentId !== 'string' || agentId.length === 0 || agentId !== agentId.trim()) {
			return false
		}
	}
	const anchorMessageId = readOwnDataValue(fact, 'anchorMessageId')
	if (anchorMessageId !== undefined) {
		if (
			typeof anchorMessageId !== 'string' ||
			anchorMessageId.length === 0 ||
			anchorMessageId !== anchorMessageId.trim()
		) {
			return false
		}
	}
	return true
}

/** ADR-029: unary command outcome for two-phase regenerate fold. */
export function isCommandOutcomeFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'commandOutcome' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	if (readOwnDataValue(fact, 'kind') !== 'commandOutcome') return false
	const correlation = readOwnDataValue(fact, 'correlation')
	const commandId = readOwnDataValue(fact, 'commandId')
	const succeeded = readOwnDataValue(fact, 'succeeded')
	if (!isCorrelationLike(correlation)) return false
	if (typeof commandId !== 'string' || commandId.length === 0) return false
	if (typeof succeeded !== 'boolean') return false
	const error = readOwnDataValue(fact, 'error')
	if (error !== undefined && typeof error !== 'string') return false
	return true
}

export function isSeedSeqCursorFact(
	fact: unknown,
): fact is Extract<NormalizedLocalFact, { kind: 'seedSeqCursor' }> {
	if (typeof fact !== 'object' || fact === null || Array.isArray(fact)) return false
	return (
		readOwnDataValue(fact, 'kind') === 'seedSeqCursor' &&
		isSafeNonNegativeInt(readOwnDataValue(fact, 'lastAppliedSeq')) &&
		isSafeNonNegativeInt(readOwnDataValue(fact, 'lastSessionVersion'))
	)
}

/**
 * Narrow historyResult payload posted by HistoryFillCoordinator.
 * Domain rows may carry `arm`/`body` (stream-shaped) for timeline fold;
 * seq-only rows are coverage markers (live grpc may still be seq-only).
 * Positive `seq` also seeds Actor Map via fold `seqItemNotes`
 * (ADR-019 INV-SSR-APPLY-12 producer; see history-result-to-view-patch).
 */
export type HistoryFillEnvelopeRow = {
	readonly seq: number
	readonly arm?: string
	readonly body?: unknown
}

export type HistoryFillResultPayload =
	| {
			readonly ok: true
			readonly envelopes: readonly HistoryFillEnvelopeRow[]
			readonly pagesFetched: number
			readonly coveredThrough: number
		}
	| {
			readonly ok: false
			readonly code: string
			readonly message?: string
		}

export function isHistoryFillResultPayload(value: unknown): value is HistoryFillResultPayload {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
	const record = value as {
		readonly ok?: unknown
		readonly coveredThrough?: unknown
		readonly pagesFetched?: unknown
		readonly envelopes?: unknown
		readonly code?: unknown
	}
	if (record.ok === true) {
		return (
			Array.isArray(record.envelopes) &&
			isFiniteNumber(record.pagesFetched) &&
			isFiniteNumber(record.coveredThrough)
		)
	}
	return record.ok === false && typeof record.code === 'string'
}
