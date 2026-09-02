/**
 * Idempotent ViewPatch / ViewFrame materialization (ADR-009 §3 / INV-SPC-2).
 * No event-fold, no gap/reseed — Renderer-safe pure functions only.
 *
 * INV-VAP-ADDR-1: nine identity arms reject blank/non-string addresses.
 * INV-VAP-ADDR-2: exact-canonical only (value === value.trim(); non-empty).
 * Trim is check-only — never written back. Unaddressable → return snapshot
 * unchanged (silent; no diagnostics). setSyncChrome / baseline snapshot
 * replace are out of this gate.
 *
 * INV-VAP-KIND-1: setSyncChrome kind identity domain — own-key
 * SyncChrome['kind'] only; out-of-domain chrome returns snapshot
 * unchanged (same reference). File-private predicate; not exported.
 *
 * INV-VAP-OWN-1: setSyncChrome kind own-data-key — after hasOwn('kind'),
 * read kind only via file-private readOwnDataValue (data descriptor);
 * own accessor never invoked; non-data → reject (same reference).
 *
 * INV-VAP-OWN-2: applyViewPatches batch fold — !Array.isArray(patches) → same
 * snapshot (no character-split); skip non-object elements; own-data `op` must
 * be typeof string before switch (accessor never invoked).
 *
 * INV-VAP-OWN-3: applyViewPatch single patch — own-data `op` and critical payload
 * fields via readOwnDataValue before switch arms (accessor never invoked); ADDR-1
 * address gates unchanged.
 *
 * INV-VAP-FRM-1: applyViewFrame — frame cursor / body discriminant / baseline
 * snapshot / patches batch reads via readOwnDataValue (accessor never invoked);
 * applyViewPatch / applyViewPatches OWN-2/3 gates unchanged.
 *
 * L1 sessionClosed / sessionPurged / sessionVisibilityChanged / agentTimeout /
 * subscriptionHealth helpers live here for Actor import and unit pins.
 * sessionVisibilityChanged / agentTimeout are claim-only (0× sync chrome).
 */

import { emptySessionViewSnapshot } from './empty-snapshot.js'
import type {
	BranchTopologyNoticeView,
	LiveAgentSnapshotRowView,
	LiveAgentStatusView,
	LiveAgentTreeNodeView,
	OverlayBlockId,
	OverlayBlockView,
	PendingActionView,
	PendingSendView,
	SessionViewSnapshot,
	SyncChrome,
	TextChunkView,
	TimelineItemId,
	TimelineItemView,
	ViewFrame,
	ViewLeaseId,
	ViewPatch,
} from './types.js'

export type ReplicaCursor = {
	readonly leaseId: ViewLeaseId
	readonly generation: number
	readonly frameId: number
	readonly version: number
}

/**
 * Address identity domain (INV-VAP-ADDR-1 / INV-VAP-ADDR-2).
 * Exact-canonical: non-empty and value === value.trim(). Check-only — never
 * written back. File-private; not barrel-exported.
 */
function isViewPatchAddress(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

const SYNC_CHROME_KIND_ADMIT = {
	idle: true,
	syncing: true,
	live: true,
	degraded: true,
	closed: true,
} as const satisfies Record<SyncChrome['kind'], true>

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value)
}

/** True when event claims the sessionClosed arm (even if body is malformed). */
export function isSessionClosedArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'sessionClosed'
}

/** Admit: object body; optional own-data `reason` must be finite when present. */
export function isSessionClosedStreamEvent(event: unknown): boolean {
	if (!isSessionClosedArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
	const reason = readOwnDataValue(body, 'reason')
	if (reason === undefined) return true
	return isFiniteNumber(reason)
}

/** True when event claims the sessionPurged arm (even if body is malformed). */
export function isSessionPurgedArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'sessionPurged'
}

/**
 * Admit: object body (empty proto `SessionPurgedEvent` → `{}`).
 * Null / non-object / array bodies are not admitted.
 */
export function isSessionPurgedStreamEvent(event: unknown): boolean {
	if (!isSessionPurgedArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	return typeof body === 'object' && body !== null && !Array.isArray(body)
}

/**
 * True when event claims the sessionVisibilityChanged arm (even if body is malformed).
 */
export function isSessionVisibilityChangedArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'sessionVisibilityChanged'
}

/**
 * Admit: object body. Own-data `visibility` may be any value (including 0 / `''`);
 * no enum gate / trim / default `'listed'`. Null / non-object / array bodies
 * are not admitted.
 */
export function isSessionVisibilityChangedStreamEvent(event: unknown): boolean {
	if (!isSessionVisibilityChangedArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	return typeof body === 'object' && body !== null && !Array.isArray(body)
}

/**
 * True when event claims the agentTimeout arm (even if body is malformed).
 */
export function isAgentTimeoutArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'agentTimeout'
}

/**
 * Admit: object body. Own-data `agentId` / `timeoutType` / `fallbackToAsync` /
 * `subAgentId` may be any value (including 0 / `''` / non-string); no enum gate /
 * trim / default. Null / non-object / array bodies are not admitted.
 */
export function isAgentTimeoutStreamEvent(event: unknown): boolean {
	if (!isAgentTimeoutArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	return typeof body === 'object' && body !== null && !Array.isArray(body)
}

/** True when event claims the subscriptionHealth arm (even if body is malformed). */
export function isSubscriptionHealthArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'subscriptionHealth'
}

/** Admit: object body with own-data finite `phase`. */
export function isSubscriptionHealthStreamEvent(event: unknown): boolean {
	if (!isSubscriptionHealthArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
	return isFiniteNumber(readOwnDataValue(body, 'phase'))
}

/**
 * L1 sessionClosed → sync.closed. Opaque reason when present; empty string when absent.
 * Precondition: `isSessionClosedStreamEvent` body.
 */
export function syncChromeFromSessionClosedBody(body: object): SyncChrome {
	const reason = readOwnDataValue(body, 'reason')
	return {
		kind: 'closed',
		reason: isFiniteNumber(reason) ? String(reason) : '',
	}
}

/**
 * L1 sessionPurged → sync.closed with empty opaque reason.
 * Precondition: `isSessionPurgedStreamEvent` body. Does not invent copy or enum names.
 * Admitted extras on the empty proto body are ignored.
 */
export function syncChromeFromSessionPurgedBody(_body: object): SyncChrome {
	return {
		kind: 'closed',
		reason: '',
	}
}

function syncChromeFromAdmittedSubscriptionPhase(phase: number): SyncChrome {
	switch (phase) {
		case 0:
			return { kind: 'idle' }
		case 1:
		case 4:
		case 5:
		case 6:
			return { kind: 'syncing' }
		case 2:
			return { kind: 'live' }
		case 3:
			return { kind: 'degraded', reason: String(phase) }
		case 7:
			return { kind: 'closed', reason: String(phase) }
		default:
			return { kind: 'degraded', reason: String(phase) }
	}
}

function syncChromeEqual(a: SyncChrome, b: SyncChrome): boolean {
	if (a.kind !== b.kind) return false
	if (a.kind === 'degraded' || a.kind === 'closed') {
		return b.kind === a.kind && a.reason === b.reason
	}
	return true
}

/**
 * L1 subscriptionHealth → SyncChrome. Unknown phases never map to `live`.
 * Returns `null` to keep `current` (blocked live after sessionClosed, or no change).
 * Precondition: `isSubscriptionHealthStreamEvent` body.
 */
export function syncChromeFromSubscriptionHealthBody(
	body: object,
	current: SyncChrome,
	blockLiveAfterSessionClosed: boolean,
): SyncChrome | null {
	const phase = readOwnDataValue(body, 'phase')
	if (!isFiniteNumber(phase)) return null
	const next = syncChromeFromAdmittedSubscriptionPhase(phase)
	if (blockLiveAfterSessionClosed && next.kind === 'live') {
		return null
	}
	if (syncChromeEqual(current, next)) {
		return null
	}
	return next
}

/**
 * INV-VAP-OWN-1: file-private own data property read. Not exported.
 * Rejects missing descriptor and accessors (get/set); never invokes getters.
 */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/**
 * Kind identity admit (INV-VAP-KIND-1 / INV-VAP-OWN-1). Own-key only — never `in`.
 * After hasOwn('kind'), kind is read via own-data descriptor only.
 * Returns boolean, not `value is SyncChrome` (shape is residual).
 */
function isAdoptableSyncChrome(value: unknown): boolean {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false
	}
	if (!Object.hasOwn(value, 'kind')) return false
	const kind = readOwnDataValue(value, 'kind')
	if (typeof kind !== 'string') return false
	return Object.hasOwn(SYNC_CHROME_KIND_ADMIT, kind)
}

const LIVE_AGENT_ID_MAX = 128

const LIVE_AGENT_ID_STRINGIFY_GARBAGE = new Set(['undefined', 'null', '[object Object]', 'NaN'])

/** INV-VIEW-CTRL-1: no-control-regex — C0/DEL via charCode instead of /[\u0000-\u001f\u007f]/ regex. */
function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i)
		if (code <= 0x1f || code === 0x7f) return true
	}
	return false
}

function admitLiveAgentId(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > LIVE_AGENT_ID_MAX) return false
	if (value !== value.trim()) return false
	if (hasControlChar(value)) return false
	return !LIVE_AGENT_ID_STRINGIFY_GARBAGE.has(value)
}

function admitLiveAgentStatusLabel(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > 128) return false
	if (value !== value.trim()) return false
	return true
}

function admitLiveAgentStatusView(value: unknown): value is LiveAgentStatusView {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false
	}
	const agentId = readOwnDataValue(value, 'agentId')
	const status = readOwnDataValue(value, 'status')
	return admitLiveAgentId(agentId) && admitLiveAgentStatusLabel(status)
}

function admitLiveAgentTreeStringField(value: unknown): value is string {
	return typeof value === 'string'
}

function admitLiveAgentTreeCountField(value: unknown): value is number {
	return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function admitLiveAgentTreeNodeView(value: unknown): value is LiveAgentTreeNodeView {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
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
	if (!admitLiveAgentId(agentId)) return false
	if (!admitLiveAgentTreeStringField(name)) return false
	if (!admitLiveAgentTreeStringField(type)) return false
	if (!admitLiveAgentTreeStringField(status)) return false
	if (!admitLiveAgentTreeStringField(model)) return false
	if (!admitLiveAgentTreeCountField(turnCount)) return false
	if (!admitLiveAgentTreeCountField(createdAt) || createdAt > Number.MAX_SAFE_INTEGER) {
		return false
	}
	if (!Array.isArray(childrenRaw)) return false
	for (const child of childrenRaw) {
		if (!admitLiveAgentTreeNodeView(child)) return false
	}
	return true
}

const LIVE_AGENT_SNAPSHOTS_MAX = 256

const LIVE_AGENT_SNAPSHOT_ROW_KEYS = new Set([
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

function admitLiveAgentSnapshotIdField(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

function admitLiveAgentSnapshotMetaField(value: unknown): value is number {
	return (
		typeof value === 'number' &&
		Number.isInteger(value) &&
		value >= 0 &&
		value <= Number.MAX_SAFE_INTEGER
	)
}

function admitLiveAgentSnapshotRowView(value: unknown): value is LiveAgentSnapshotRowView {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) {
		return false
	}
	if (!hasOnlyOwnKeys(value, LIVE_AGENT_SNAPSHOT_ROW_KEYS)) return false
	const id = readOwnDataValue(value, 'id')
	const sessionId = readOwnDataValue(value, 'sessionId')
	const title = readOwnDataValue(value, 'title')
	const description = readOwnDataValue(value, 'description')
	const createdAt = readOwnDataValue(value, 'createdAt')
	const turnCount = readOwnDataValue(value, 'turnCount')
	const tokenCount = readOwnDataValue(value, 'tokenCount')
	const modelId = readOwnDataValue(value, 'modelId')
	const isAuto = readOwnDataValue(value, 'isAuto')
	if (!admitLiveAgentSnapshotIdField(id)) return false
	if (!admitLiveAgentSnapshotIdField(sessionId)) return false
	if (!admitLiveAgentTreeStringField(title)) return false
	if (!admitLiveAgentTreeStringField(description)) return false
	if (!admitLiveAgentSnapshotMetaField(createdAt)) return false
	if (!admitLiveAgentTreeCountField(turnCount)) return false
	if (!admitLiveAgentSnapshotMetaField(tokenCount)) return false
	if (!admitLiveAgentTreeStringField(modelId)) return false
	return typeof isAuto === 'boolean'
}

function admitLiveAgentSnapshotsView(value: unknown): value is readonly LiveAgentSnapshotRowView[] {
	if (!Array.isArray(value)) return false
	if (value.length > LIVE_AGENT_SNAPSHOTS_MAX) return false
	for (const row of value) {
		if (!admitLiveAgentSnapshotRowView(row)) return false
	}
	return true
}

function admitLiveTeamId(value: unknown): value is number {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function admitBranchTopologyStringField(value: unknown): value is string {
	return typeof value === 'string'
}

const BRANCH_TOPOLOGY_NOTICES_MAX = 32

function admitBranchTopologyNoticeView(value: unknown): value is BranchTopologyNoticeView {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return false
	}
	const reason = readOwnDataValue(value, 'reason')
	const branchMetaJson = readOwnDataValue(value, 'branchMetaJson')
	const affectedTurnIdsJson = readOwnDataValue(value, 'affectedTurnIdsJson')
	const messagesJson = readOwnDataValue(value, 'messagesJson')
	const divergedFromTurnId = readOwnDataValue(value, 'divergedFromTurnId')
	if (!admitBranchTopologyStringField(reason)) return false
	if (!admitBranchTopologyStringField(branchMetaJson)) return false
	if (!admitBranchTopologyStringField(affectedTurnIdsJson)) return false
	if (!admitBranchTopologyStringField(messagesJson)) return false
	if (!isViewPatchAddress(divergedFromTurnId)) return false
	if (Object.hasOwn(value, 'operationId')) {
		const operationId = readOwnDataValue(value, 'operationId')
		if (!isViewPatchAddress(operationId)) return false
	}
	if (Object.hasOwn(value, 'notice')) {
		const notice = readOwnDataValue(value, 'notice')
		if (notice === null || typeof notice !== 'object' || Array.isArray(notice)) {
			return false
		}
	}
	return true
}

function branchTopologyOperationIdOf(notice: BranchTopologyNoticeView): string | undefined {
	if (!Object.hasOwn(notice as object, 'operationId')) return undefined
	const operationId = readOwnDataValue(notice as object, 'operationId')
	return typeof operationId === 'string' ? operationId : undefined
}

/** Own-data admit: non-empty trimmed string; no control-char garbage; omit when absent. */
export function admitTimelineItemTurnId(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0) return false
	if (value !== value.trim()) return false
	if (hasControlChar(value)) return false
	return true
}

function timelineItemTurnIdFromOwnData(item: TimelineItemView): string | undefined {
	const turnId = readOwnDataValue(item as object, 'turnId')
	return admitTimelineItemTurnId(turnId) ? turnId : undefined
}

/** INV-VAP-OWN-1: omit one own key without reading it (no destructure / property get). */
function omitOwnDataKey<T extends object>(record: T, key: string): T {
	const next: Record<string, unknown> = {}
	for (const k of Object.keys(record)) {
		if (k === key) continue
		next[k] = readOwnDataValue(record, k)
	}
	return next as T
}

function sanitizeTimelineItemForUpsert(item: TimelineItemView): TimelineItemView {
	const turnId = timelineItemTurnIdFromOwnData(item)
	if (turnId !== undefined) return item
	if (!Object.hasOwn(item as object, 'turnId')) return item
	return omitOwnDataKey(item as object as TimelineItemView, 'turnId') as TimelineItemView
}

export function applyViewPatch(
	snapshot: SessionViewSnapshot,
	patch: ViewPatch,
): SessionViewSnapshot {
	if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
		return snapshot
	}
	const op = readOwnDataValue(patch, 'op')
	if (typeof op !== 'string') {
		return snapshot
	}
	switch (op) {
		case 'upsertTimelineItem': {
			const item = readOwnDataValue(patch, 'item')
			if (typeof item !== 'object' || item === null || Array.isArray(item)) {
				return snapshot
			}
			const itemId = readOwnDataValue(item, 'id')
			if (!isViewPatchAddress(itemId)) return snapshot
			return {
				...snapshot,
				timeline: upsertById(
					snapshot.timeline,
					sanitizeTimelineItemForUpsert(item as TimelineItemView),
					(row) => row.id,
				),
			}
		}
		case 'removeTimelineItem': {
			const itemId = readOwnDataValue(patch, 'itemId')
			if (!isViewPatchAddress(itemId)) return snapshot
			return {
				...snapshot,
				timeline: snapshot.timeline.filter((item) => item.id !== itemId),
			}
		}
		case 'upsertOverlayBlock': {
			const block = readOwnDataValue(patch, 'block')
			if (typeof block !== 'object' || block === null || Array.isArray(block)) {
				return snapshot
			}
			const blockId = readOwnDataValue(block, 'blockId')
			if (!isViewPatchAddress(blockId)) return snapshot
			return {
				...snapshot,
				overlay: {
					blocks: upsertById(snapshot.overlay.blocks, block as OverlayBlockView, (b) => b.blockId),
				},
			}
		}
		case 'removeOverlayBlock': {
			const blockId = readOwnDataValue(patch, 'blockId')
			if (!isViewPatchAddress(blockId)) return snapshot
			return {
				...snapshot,
				overlay: {
					blocks: snapshot.overlay.blocks.filter((b) => b.blockId !== blockId),
				},
			}
		}
		case 'upsertTextChunk': {
			const blockId = readOwnDataValue(patch, 'blockId')
			const chunk = readOwnDataValue(patch, 'chunk')
			if (typeof chunk !== 'object' || chunk === null || Array.isArray(chunk)) {
				return snapshot
			}
			const chunkId = readOwnDataValue(chunk, 'chunkId')
			if (!isViewPatchAddress(blockId) || !isViewPatchAddress(chunkId)) {
				return snapshot
			}
			const blocks = snapshot.overlay.blocks.map((block) => {
				if (block.blockId !== blockId) return block
				return {
					...block,
					chunks: upsertById(block.chunks, chunk as TextChunkView, (c) => c.chunkId),
				}
			})
			const hasBlock = snapshot.overlay.blocks.some((b) => b.blockId === blockId)
			return hasBlock ? { ...snapshot, overlay: { blocks } } : snapshot
		}
		case 'upsertPendingAction': {
			const action = readOwnDataValue(patch, 'action')
			if (typeof action !== 'object' || action === null || Array.isArray(action)) {
				return snapshot
			}
			const requestId = readOwnDataValue(action, 'requestId')
			if (!isViewPatchAddress(requestId)) return snapshot
			return {
				...snapshot,
				pendingActions: upsertById(
					snapshot.pendingActions,
					action as PendingActionView,
					(a) => a.requestId,
				),
			}
		}
		case 'removePendingAction': {
			const requestId = readOwnDataValue(patch, 'requestId')
			if (!isViewPatchAddress(requestId)) return snapshot
			return {
				...snapshot,
				pendingActions: snapshot.pendingActions.filter((a) => a.requestId !== requestId),
			}
		}
		case 'upsertLocalSend': {
			const send = readOwnDataValue(patch, 'send')
			if (typeof send !== 'object' || send === null || Array.isArray(send)) {
				return snapshot
			}
			const operationId = readOwnDataValue(send, 'operationId')
			if (!isViewPatchAddress(operationId)) return snapshot
			return {
				...snapshot,
				localPendingSends: upsertById(
					snapshot.localPendingSends,
					send as PendingSendView,
					(s) => s.operationId,
				),
			}
		}
		case 'removeLocalSend': {
			const operationId = readOwnDataValue(patch, 'operationId')
			if (!isViewPatchAddress(operationId)) return snapshot
			return {
				...snapshot,
				localPendingSends: snapshot.localPendingSends.filter((s) => s.operationId !== operationId),
			}
		}
		case 'setSyncChrome': {
			const sync = readOwnDataValue(patch, 'sync')
			if (!isAdoptableSyncChrome(sync)) return snapshot
			return { ...snapshot, sync: sync as SyncChrome }
		}
		case 'setLiveAgentStatus': {
			const liveAgentStatus = readOwnDataValue(patch, 'liveAgentStatus')
			if (!admitLiveAgentStatusView(liveAgentStatus)) return snapshot
			return { ...snapshot, liveAgentStatus: liveAgentStatus as LiveAgentStatusView }
		}
		case 'setLiveTeamId': {
			const liveTeamId = readOwnDataValue(patch, 'liveTeamId')
			if (!admitLiveTeamId(liveTeamId)) return snapshot
			return { ...snapshot, liveTeamId }
		}
		case 'setLiveAgentTree': {
			const liveAgentTree = readOwnDataValue(patch, 'liveAgentTree')
			if (!admitLiveAgentTreeNodeView(liveAgentTree)) return snapshot
			return { ...snapshot, liveAgentTree: liveAgentTree as LiveAgentTreeNodeView }
		}
		case 'setLiveAgentSnapshots': {
			const liveAgentSnapshots = readOwnDataValue(patch, 'liveAgentSnapshots')
			if (!admitLiveAgentSnapshotsView(liveAgentSnapshots)) return snapshot
			return {
				...snapshot,
				liveAgentSnapshots: liveAgentSnapshots as readonly LiveAgentSnapshotRowView[],
			}
		}
		case 'pendingRespondFailed': {
			const requestId = readOwnDataValue(patch, 'requestId')
			const cause = readOwnDataValue(patch, 'cause')
			const retryable = readOwnDataValue(patch, 'retryable')
			const error = readOwnDataValue(patch, 'error')
			if (!isViewPatchAddress(requestId)) return snapshot
			if (cause !== 'hostWriteFailed' && cause !== 'commandFailed') return snapshot
			if (typeof retryable !== 'boolean') return snapshot
			if (typeof error !== 'string') return snapshot
			// WIP authority lives in app store; snapshot unchanged (spec §8.4).
			return snapshot
		}
		case 'appendBranchTopologyNotice': {
			const notice = readOwnDataValue(patch, 'notice')
			if (!admitBranchTopologyNoticeView(notice)) return snapshot
			const incoming = notice as BranchTopologyNoticeView
			const prior = snapshot.branchTopologyNotices ?? []
			const incomingOperationId = branchTopologyOperationIdOf(incoming)
			let next: BranchTopologyNoticeView[]
			if (incomingOperationId !== undefined) {
				const existingIdx = prior.findIndex(
					(entry) => branchTopologyOperationIdOf(entry) === incomingOperationId,
				)
				if (existingIdx !== -1) {
					const without = prior.filter((_, idx) => idx !== existingIdx)
					next = [...without, incoming]
				} else {
					next = [...prior, incoming]
				}
			} else {
				next = [...prior, incoming]
			}
			if (next.length > BRANCH_TOPOLOGY_NOTICES_MAX) {
				next = next.slice(next.length - BRANCH_TOPOLOGY_NOTICES_MAX)
			}
			return {
				...snapshot,
				branchTopologyNotices: next,
			}
		}
		default:
			return snapshot
	}
}

export function applyViewPatches(
	snapshot: SessionViewSnapshot,
	patches: readonly ViewPatch[],
): SessionViewSnapshot {
	if (!Array.isArray(patches)) {
		return snapshot
	}
	let next = snapshot
	for (const patch of patches) {
		if (typeof patch !== 'object' || patch === null || Array.isArray(patch)) {
			continue
		}
		const op = readOwnDataValue(patch, 'op')
		if (typeof op !== 'string') {
			continue
		}
		next = applyViewPatch(next, patch)
	}
	return next
}

/**
 * Apply one frame. When `cursor` is provided, unexpected lease / generation / frameId
 * yields `resyncRequired` (INV-SPC-12 consumer rule). Effects do not mutate the snapshot.
 */
export function applyViewFrame(
	current: SessionViewSnapshot,
	frame: ViewFrame,
	cursor?: ReplicaCursor | null,
):
	| { readonly next: SessionViewSnapshot; readonly cursor: ReplicaCursor }
	| { readonly resyncRequired: true } {
	if (typeof frame !== 'object' || frame === null || Array.isArray(frame)) {
		return { resyncRequired: true }
	}

	const frameLeaseId = readOwnDataValue(frame, 'leaseId')
	const frameGeneration = readOwnDataValue(frame, 'generation')
	const frameFrameId = readOwnDataValue(frame, 'frameId')
	const frameVersion = readOwnDataValue(frame, 'version')
	const body = readOwnDataValue(frame, 'body')
	const bodyKind =
		typeof body === 'object' && body !== null && !Array.isArray(body)
			? readOwnDataValue(body, 'kind')
			: undefined

	if (cursor) {
		if (frameLeaseId !== cursor.leaseId) {
			return { resyncRequired: true }
		}
		if (bodyKind === 'baseline') {
			if (typeof frameGeneration !== 'number' || frameGeneration < cursor.generation) {
				return { resyncRequired: true }
			}
		} else if (frameGeneration !== cursor.generation || frameFrameId !== cursor.frameId + 1) {
			return { resyncRequired: true }
		}
	}

	let next: SessionViewSnapshot
	switch (bodyKind) {
		case 'baseline': {
			const snapshot =
				typeof body === 'object' && body !== null && !Array.isArray(body)
					? readOwnDataValue(body, 'snapshot')
					: undefined
			if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
				next = current
			} else {
				next = snapshot as SessionViewSnapshot
			}
			break
		}
		case 'patches': {
			const patches =
				typeof body === 'object' && body !== null && !Array.isArray(body)
					? readOwnDataValue(body, 'patches')
					: undefined
			next = applyViewPatches(current, patches as readonly ViewPatch[])
			break
		}
		case 'effects':
			next = current
			break
		default:
			next = current
			break
	}

	return {
		next,
		cursor: {
			leaseId: frameLeaseId as ViewLeaseId,
			generation: frameGeneration as number,
			frameId: frameFrameId as number,
			version: frameVersion as number,
		},
	}
}

export function createEmptyReplica(
	sessionId: SessionViewSnapshot['sessionId'],
): SessionViewSnapshot {
	return emptySessionViewSnapshot(sessionId)
}

function upsertById<T>(
	items: readonly T[],
	item: T,
	idOf: (item: T) => TimelineItemId | OverlayBlockId | string,
): T[] {
	const id = idOf(item)
	let replaced = false
	const next = items.map((existing) => {
		if (idOf(existing) !== id) return existing
		replaced = true
		return item
	})
	return replaced ? next : [...next, item]
}

/** Structural equality helper for idempotency tests (stable JSON key order not required). */
export function snapshotsEqual(a: SessionViewSnapshot, b: SessionViewSnapshot): boolean {
	return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b))
}

function canonicalize(snapshot: SessionViewSnapshot): unknown {
	return {
		sessionId: snapshot.sessionId,
		sync: snapshot.sync,
		timeline: [...snapshot.timeline].sort(compareTimeline),
		overlay: {
			blocks: [...snapshot.overlay.blocks].sort(compareOverlay).map(canonicalizeBlock),
		},
		pendingActions: [...snapshot.pendingActions].sort((x, y) =>
			String(x.requestId).localeCompare(String(y.requestId)),
		),
		localPendingSends: [...snapshot.localPendingSends].sort((x, y) =>
			String(x.operationId).localeCompare(String(y.operationId)),
		),
		liveAgentStatus: snapshot.liveAgentStatus,
		liveTeamId: snapshot.liveTeamId,
		liveAgentTree: snapshot.liveAgentTree,
		liveAgentSnapshots: snapshot.liveAgentSnapshots
			? [...snapshot.liveAgentSnapshots].sort((a, b) => String(a.id).localeCompare(String(b.id)))
			: undefined,
	}
}

function canonicalizeBlock(block: OverlayBlockView): unknown {
	return {
		...block,
		chunks: [...block.chunks].sort((a, b) => String(a.chunkId).localeCompare(String(b.chunkId))),
	}
}

function compareTimeline(a: TimelineItemView, b: TimelineItemView): number {
	return String(a.id).localeCompare(String(b.id))
}

function compareOverlay(a: OverlayBlockView, b: OverlayBlockView): number {
	return String(a.blockId).localeCompare(String(b.blockId))
}
