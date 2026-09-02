/**
 * ADR-017 knife 4 — pendingActions capacity decide + batch admit (pure).
 * Actor wires via foldAndBroadcastPatches; this module never folds or warns.
 *
 * Parent-key formula is the inverse of `questionAskItemId` (INV-QAF-2):
 *   questionAskItemId(qid, childKey) === `${qid.trim()}:${childKey}`
 *   pendingActionParentKey(`${qid}:${childKey}`) === qid.trim()
 * Permission / clientTool requestIds have no ':' → the whole id is the parent.
 *
 * Legacy / defensive only for ask-user: ADR-017 Amendment 1 pins **1× parent
 * pending** (`requestId ≡ questionId`). Production must not upsert compound
 * sibling rows under a question parent; do not read this inverse as a green
 * light for N× compound pending (INV-QAP-1 / INV-QAP-2).
 *
 * Overlay pending set-replace (INV-ROS-C* / INV-OPS-ID-2):
 * {@link planOverlayPendingSetReplace} only orchestrates remove/upsert patches —
 * never calls decide* (admit is the sole capacity gate at Actor
 * foldAndBroadcastPatches / atomic preflight). Identity: exact-canonical
 * requestId only (`len>0 ∧ value===value.trim()`); padded/blank → drop;
 * 0× `.trim()` write-back into pending ids; fail-closed on duplicate
 * verbatim requestIds (`skip_ambiguous_pending_ids`). Align refuse-not-wash
 * with INV-PAB-ID-1.
 *
 * INV-PAB-ID-1: requestId identity domain fail-closed at the quota gate
 * (reject, do not wash). Admissible ids pass decide/admit; blank / pad /
 * `__proto__` skip with {@link PENDING_ACTION_REQUEST_ID_INVALID} before
 * exists / parent / capacity. Trim is predicate-only — never rewrite ids.
 *
 * INV-PAB-OWN-1: decidePendingActionUpsert reads requestId only as own data
 * property (file-private readOwnDataValue) before ID-1 predicate; missing own
 * / accessor → PENDING_ACTION_REQUEST_ID_INVALID; accessor never invoked.
 *
 * INV-PAB-BIND-1: pendingActionFromLocalPendingSend reads operationId and
 * summary.kind only as own data before bind; missing own / accessor / unknown
 * kind → undefined (no pending-action row); accessor never invoked. Admitted
 * send summary.kind is `'text'` only (align INV-LPS-ROW-1).
 */

import type { OverlayPendingSnapshotBody, OverlayPendingSnapshotItem } from './local-fact.js'
import { LOCAL_PENDING_SENDS_CAP } from './local-pending-sends.js'
import {
	CLIENT_TOOL_ARG_PREVIEW_MAX,
	timelineItemFromClientToolCall,
} from '../../common/sessionView/client-tool-call.js'
import { questionAskPendingRequestId, timelineItemFromQuestionAsk } from '../../common/sessionView/question-ask.js'
import type {
	ClientActionRequestId,
	PendingActionView,
	PendingSendView,
	TimelineItemSummary,
	ViewPatch,
} from '../../common/sessionView/types.js'

/**
 * Bound for pendingActions parents (fail-closed on *new* parent;
 * same magnitude class as {@link LOCAL_PENDING_SENDS_CAP}).
 */
export const PENDING_ACTIONS_CAP = LOCAL_PENDING_SENDS_CAP

/** Stable diagnostic code for Actor `diagnostics.warn` on capacity skip. */
export const PENDING_ACTIONS_AT_CAPACITY = 'pending_actions_at_capacity' as const

/** Stable diagnostic code for identity-domain reject (INV-PAB-ID-1). */
export const PENDING_ACTION_REQUEST_ID_INVALID = 'pending_action_request_id_invalid' as const

const PENDING_OVERLAY_AGENT_ID_MAX = 128

const PENDING_OVERLAY_AGENT_ID_STRINGIFY_GARBAGE = new Set([
	'undefined',
	'null',
	'[object Object]',
	'NaN',
])

/** INV-SC-CTRL-1: no-control-regex — C0/DEL via charCode instead of /[\u0000-\u001f\u007f]/ regex. */
function hasControlChar(value: string): boolean {
	for (let i = 0; i < value.length; i++) {
		const code = value.charCodeAt(i)
		if (code <= 0x1f || code === 0x7f) return true
	}
	return false
}

/** ADR-021: reject-only; align admitReflexAckAgentId — never trim / sanitize. */
function admitOverlayPendingAgentId(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > PENDING_OVERLAY_AGENT_ID_MAX) return false
	if (value !== value.trim()) return false
	if (hasControlChar(value)) return false
	return !PENDING_OVERLAY_AGENT_ID_STRINGIFY_GARBAGE.has(value)
}

function overlayPendingAgentIdFields(
	item: OverlayPendingSnapshotItem,
): { readonly agentId: string } | Record<string, never> {
	return admitOverlayPendingAgentId(item.agentId) ? { agentId: item.agentId! } : {}
}

export type PendingActionSkipCode =
	typeof PENDING_ACTIONS_AT_CAPACITY | typeof PENDING_ACTION_REQUEST_ID_INVALID

/** Atomic overlay set-replace refused when desired parents exceed CAP (INV-ROS-C5). */
export const OVERLAY_PENDING_SET_REPLACE_AT_CAPACITY =
	'overlay_pending_set_replace_at_capacity' as const

export type PendingActionUpsertDecision =
	| { readonly kind: 'upsert'; readonly action: PendingActionView }
	| {
			readonly kind: 'skip_at_capacity'
			readonly action: PendingActionView
			readonly code: PendingActionSkipCode
		}

/**
 * INV-PAB-ID-1 SSOT predicate (file-private; not exported from index).
 * Trim is comparison-only — never rewrite the candidate id.
 */
function isAdmissiblePendingRequestId(value: unknown): value is string {
	return (
		typeof value === 'string' && value === value.trim() && value !== '' && value !== '__proto__'
	)
}

/** INV-PAB-OWN-1: own data property only; never invoke accessors. */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/** INV-PAB-BIND-1 / INV-LPS-ROW-1: sole admitted send summary.kind at bind. */
const LOCAL_PENDING_SEND_ADMITTED_SUMMARY_KIND = 'text' as const

function isAdmissibleLocalPendingSendSummaryKind(
	value: unknown,
): value is typeof LOCAL_PENDING_SEND_ADMITTED_SUMMARY_KIND {
	return value === LOCAL_PENDING_SEND_ADMITTED_SUMMARY_KIND
}

function readLocalPendingSendSummaryKind(send: PendingSendView): unknown {
	const summary = readOwnDataValue(send, 'summary')
	if (summary === null || typeof summary !== 'object' || Array.isArray(summary)) {
		return undefined
	}
	return readOwnDataValue(summary, 'kind')
}

/**
 * Bind one localPendingSend overlay row to a pendingActions row (ADR-012 §6.2).
 * Fail-closed: missing own / accessor / unknown summary.kind → undefined.
 * Does not wash ids or summary; caller owns admit/capacity.
 */
export function pendingActionFromLocalPendingSend(
	send: PendingSendView,
): PendingActionView | undefined {
	const operationId = readOwnDataValue(send, 'operationId')
	if (typeof operationId !== 'string') return undefined
	const summary = readOwnDataValue(send, 'summary')
	if (summary === null || typeof summary !== 'object' || Array.isArray(summary)) {
		return undefined
	}
	if (!isAdmissibleLocalPendingSendSummaryKind(readLocalPendingSendSummaryKind(send))) {
		return undefined
	}
	return {
		requestId: operationId as ClientActionRequestId,
		summary: summary as TimelineItemSummary,
	}
}

/**
 * Parent quota key (INV-PAB-2 / INV-QAF-2 inverse).
 * First ':' → left segment; no colon → entire requestId.
 */
export function pendingActionParentKey(requestId: string): string {
	const i = requestId.indexOf(':')
	return i === -1 ? requestId : requestId.slice(0, i)
}

/** Unique parent count over current pendingActions. */
export function countPendingActionParents(current: readonly PendingActionView[]): number {
	const parents = new Set<string>()
	for (const action of current) {
		parents.add(pendingActionParentKey(action.requestId))
	}
	return parents.size
}

/**
 * Migrated L4 CTA kinds on pendingActions (ADR-017 knives 1–3).
 * Shared predicate for overlay set-replace remove scope (INV-ROS-C1 / MF-7).
 */
export function isMigratedPendingAction(action: PendingActionView): boolean {
	const summary = action.summary
	if (summary.kind === 'question' || summary.kind === 'permission') return true
	if (summary.kind === 'tool' && summary.respondable === true) return true
	return false
}

/**
 * Idempotent upsert when requestId already present; allow sibling children under
 * an existing parent without consuming a new quota slot; reject *new* parents at
 * capacity (do not drop older entries — fail-closed, INV-PAB-1).
 * INV-PAB-ID-1: identity gate before exists/parent/capacity — illegal ids skip
 * even under cap, even when an equal dirty id is already in current.
 * INV-PAB-OWN-1: requestId must be own data before ID-1; compare via local id.
 */
export function decidePendingActionUpsert(
	current: readonly PendingActionView[],
	action: PendingActionView,
	cap: number = PENDING_ACTIONS_CAP,
): PendingActionUpsertDecision {
	const requestId = readOwnDataValue(action, 'requestId')
	if (!isAdmissiblePendingRequestId(requestId)) {
		return {
			kind: 'skip_at_capacity',
			action,
			code: PENDING_ACTION_REQUEST_ID_INVALID,
		}
	}
	const exists = current.some((a) => a.requestId === requestId)
	if (exists) {
		return { kind: 'upsert', action }
	}

	const parent = pendingActionParentKey(requestId)
	const parentPresent = current.some((a) => pendingActionParentKey(a.requestId) === parent)
	if (parentPresent) {
		return { kind: 'upsert', action }
	}

	if (countPendingActionParents(current) >= cap) {
		return {
			kind: 'skip_at_capacity',
			action,
			code: PENDING_ACTIONS_AT_CAPACITY,
		}
	}

	return { kind: 'upsert', action }
}

export type PendingActionAdmitResult = {
	readonly patches: readonly ViewPatch[]
	readonly skipped: readonly {
		readonly action: PendingActionView
		readonly code: PendingActionSkipCode
	}[]
}

/**
 * Batch admit for ViewPatch frames (INV-PAB-W1): walk patches in order, decide
 * each upsertPendingAction against a simulated pending set so same-frame new
 * parents cannot breach CAP. Removes update sim; other ops pass through.
 */
export function admitPendingActionUpserts(
	current: readonly PendingActionView[],
	patches: readonly ViewPatch[],
	cap: number = PENDING_ACTIONS_CAP,
): PendingActionAdmitResult {
	let sim = [...current]
	const out: ViewPatch[] = []
	const skipped: {
		readonly action: PendingActionView
		readonly code: PendingActionSkipCode
	}[] = []

	for (const patch of patches) {
		if (patch.op === 'upsertPendingAction') {
			const decision = decidePendingActionUpsert(sim, patch.action, cap)
			if (decision.kind === 'skip_at_capacity') {
				skipped.push({ action: patch.action, code: decision.code })
				continue
			}
			out.push({ op: 'upsertPendingAction', action: decision.action })
			const idx = sim.findIndex((a) => a.requestId === decision.action.requestId)
			if (idx === -1) {
				sim.push(decision.action)
			} else {
				sim[idx] = decision.action
			}
			continue
		}
		if (patch.op === 'removePendingAction') {
			out.push(patch)
			sim = sim.filter((a) => a.requestId !== patch.requestId)
			continue
		}
		out.push(patch)
	}

	return { patches: out, skipped }
}

export type OverlayPendingSetReplacePlan =
	| { readonly kind: 'skip_missing_epoch' }
	| { readonly kind: 'skip_epoch_unset' }
	| { readonly kind: 'skip_no_current_hello' }
	| {
			readonly kind: 'skip_epoch_stale'
			readonly expected: number
			readonly actual: number
		}
	| {
			readonly kind: 'clear_epoch_ahead'
			readonly anchored: number
			readonly actual: number
		}
	| { readonly kind: 'skip_hello_provenance' }
	| { readonly kind: 'skip_ambiguous_pending_ids' }
	| {
			readonly kind: 'apply'
			readonly patches: readonly ViewPatch[]
			readonly removedRequestIds: readonly ClientActionRequestId[]
		}

/**
 * INV-OPS-ID-2: exact-canonical requestId only (`len>0 ∧ value===value.trim()`);
 * padded/blank → `''` (planner drops); 0× `.trim()` write-back into pending ids.
 * Question arm: local exact gate then {@link questionAskPendingRequestId}
 * verbatim — does not edit question-ask.ts.
 */
function canonicalizeOverlayPendingRequestId(item: OverlayPendingSnapshotItem): string {
	const raw = item.requestId
	if (raw.length === 0 || raw !== raw.trim()) {
		return ''
	}
	switch (item.kind) {
		case 'question':
			return questionAskPendingRequestId(raw)
		case 'permission':
		case 'clientToolCall':
			return raw
	}
}

function truncatePermissionArgPreview(raw: string, max: number): string | undefined {
	const trimmed = raw.trim()
	if (trimmed.length === 0) return undefined
	if (trimmed.length <= max) return trimmed
	return `${trimmed.slice(0, Math.max(0, max - 1))}…`
}

/** Fail-closed: missing / invalid JSON → omit preview (no invented args). */
function permissionArgPreviewFromOwnData(item: OverlayPendingSnapshotItem): string | undefined {
	const raw = readOwnDataValue(item, 'argumentsJson')
	if (typeof raw !== 'string') return undefined
	const trimmed = raw.trim()
	if (trimmed.length === 0) return undefined
	try {
		JSON.parse(trimmed)
	} catch {
		return undefined
	}
	return truncatePermissionArgPreview(trimmed, CLIENT_TOOL_ARG_PREVIEW_MAX)
}

/**
 * Map one overlay pending item → PendingActionView (INV-ROS-C3).
 * 0× timeline; question requestId ≡ questionId (1× parent).
 * requestId is always {@link canonicalizeOverlayPendingRequestId}.
 * INV-QASK-SING-1: question mint withhold → `undefined` (skip row; 0× invent).
 * INV-QASK-SING-2: empty/padded requestId (canonicalize → `''`) → `undefined`
 * like CTC; never invent a question summary.
 * INV-PERM-SING-1: permission empty/padded requestId (canonicalize → `''`) →
 * `undefined` like QASK-SING-2 / CTC; never invent a permission summary.
 * INV-PAB-CTC-INV-1: CTC omit unset toolName/argumentsJson (0× invent `''`);
 * empty/absent → withhold mint peer QASK-SING / CTC.
 * INV-PAB-QASK-ARR-1: question omit unset `questions` (0× invent `[]` via
 * `?? []`); absent/non-array → withhold mint peer QASK-SING / CTC.
 * INV-PAB-DESC-1: permission/question require own-data title fields (0× invent
 * via `description.trim() || …` / `toolName?.trim() || 'permission'`);
 * empty/absent → withhold mint peer QASK-ARR / CTC.
 */
export function pendingActionFromOverlayItem(
	item: OverlayPendingSnapshotItem,
): PendingActionView | undefined {
	const requestId = canonicalizeOverlayPendingRequestId(item)
	switch (item.kind) {
		case 'permission': {
			// INV-PERM-SING-1: non-exact-canonical → '' sentinel; fail-closed skip
			// like QASK-SING-2 / CTC (0× invent summary; 0× trim-write into requestId).
			if (requestId === '') return undefined
			// INV-PAB-DESC-1: require own-data toolName + description (0× invent
			// `toolName?.trim() || 'permission'` / `description.trim() || toolName`);
			// empty/absent → withhold mint peer QASK-ARR / CTC. Display trim only.
			const toolNameRaw = item.toolName
			if (typeof toolNameRaw !== 'string' || toolNameRaw.trim().length === 0) {
				return undefined
			}
			const toolName = toolNameRaw.trim()
			const title = item.description.trim()
			if (title.length === 0) {
				return undefined
			}
			const argPreview = permissionArgPreviewFromOwnData(item)
			return {
				requestId: requestId as ClientActionRequestId,
				summary: {
					kind: 'permission',
					title,
					permissionKind: toolName,
					...(argPreview !== undefined ? { argPreview } : {}),
				},
				...overlayPendingAgentIdFields(item),
			}
		}
		case 'question': {
			// INV-QASK-SING-2: non-exact-canonical → '' sentinel; fail-closed skip
			// like CTC (0× invent summary; 0× trim-write into requestId).
			if (requestId === '') return undefined
			// INV-PAB-DESC-1: require own-data description for title (0× invent
			// `description.trim() || …`); empty/whitespace → withhold mint peer CTC.
			const titleOverride = item.description.trim()
			if (titleOverride.length === 0) {
				return undefined
			}
			// INV-PAB-QASK-ARR-1: omit unset questions (0× invent [] via ?? []);
			// absent/non-array → withhold mint peer QASK-SING / CTC.
			const questions = item.questions
			if (!Array.isArray(questions)) {
				return undefined
			}
			const row = timelineItemFromQuestionAsk(
				{
					questionId: requestId,
					questions,
				},
				{ title: titleOverride },
			)
			// INV-QASK-SING-1: empty mint → skip row; never invent summary.
			if (row === undefined) return undefined
			return {
				requestId: requestId as ClientActionRequestId,
				summary: row.summary,
				...overlayPendingAgentIdFields(item),
			}
		}
		case 'clientToolCall': {
			// INV-PAB-CTC-INV-1: omit unset toolName/argumentsJson (0× invent '');
			// empty/absent → withhold mint peer QASK-SING / CTC.
			const toolName = item.toolName
			const argumentsJson = item.argumentsJson
			if (typeof toolName !== 'string' || toolName.length === 0) {
				return undefined
			}
			if (typeof argumentsJson !== 'string' || argumentsJson.length === 0) {
				return undefined
			}
			const row = timelineItemFromClientToolCall(
				{
					callId: requestId,
					toolName,
					argumentsJson,
				},
				{ status: 'pending' },
			)
			if (row === undefined) return undefined
			return {
				requestId: requestId as ClientActionRequestId,
				summary: row.summary,
				...overlayPendingAgentIdFields(item),
			}
		}
	}
}

/**
 * Pure overlay pending set-replace planner (INV-ROS-C1/C2/C6/C7).
 * Emits apply / clear_epoch_ahead / skip_* instructions only — never clear
 * patches (Actor reuses knife-4 clearPendingForRuntimeEpochChange).
 * Does **not** call decide* — capacity is Actor admit preflight (INV-ROS-C5).
 *
 * @param currentAttemptHelloRuntimeEpoch - `lastStreamHello?.runtimeEpoch ?? null`
 *   (current-attempt Hello provenance; not cross-attempt lastRuntimeEpoch alone)
 */
export function planOverlayPendingSetReplace(
	current: readonly PendingActionView[],
	body: OverlayPendingSnapshotBody,
	lastRuntimeEpoch: number | null,
	currentAttemptHelloRuntimeEpoch: number | null,
): OverlayPendingSetReplacePlan {
	const epoch = body.runtimeEpoch
	if (typeof epoch !== 'number' || !Number.isFinite(epoch)) {
		return { kind: 'skip_missing_epoch' }
	}
	if (lastRuntimeEpoch === null) {
		return { kind: 'skip_epoch_unset' }
	}
	if (currentAttemptHelloRuntimeEpoch === null) {
		return { kind: 'skip_no_current_hello' }
	}
	if (epoch > lastRuntimeEpoch) {
		return {
			kind: 'clear_epoch_ahead',
			anchored: lastRuntimeEpoch,
			actual: epoch,
		}
	}
	if (epoch < lastRuntimeEpoch) {
		return {
			kind: 'skip_epoch_stale',
			expected: lastRuntimeEpoch,
			actual: epoch,
		}
	}
	if (epoch !== currentAttemptHelloRuntimeEpoch) {
		return { kind: 'skip_hello_provenance' }
	}

	// INV-OPS-ID-2: exact-canonical admit; drop padded/blank; reject duplicate
	// verbatim requestIds atomically (no fold last-wins; no trim-collision wash).
	const mapped: PendingActionView[] = []
	const seenIds = new Set<string>()
	for (const item of body.pending) {
		const id = canonicalizeOverlayPendingRequestId(item)
		if (id === '') continue
		if (seenIds.has(id)) {
			return { kind: 'skip_ambiguous_pending_ids' }
		}
		seenIds.add(id)
		const action = pendingActionFromOverlayItem(item)
		// INV-QASK-SING-1: mint withhold → skip row (0× invent).
		if (action === undefined) continue
		mapped.push(action)
	}
	const desiredIds = new Set(mapped.map((a) => a.requestId))

	const removes: ViewPatch[] = []
	const removedRequestIds: ClientActionRequestId[] = []
	for (const action of current) {
		if (isMigratedPendingAction(action) && !desiredIds.has(action.requestId)) {
			removes.push({
				op: 'removePendingAction',
				requestId: action.requestId,
			})
			removedRequestIds.push(action.requestId)
		}
	}

	const upserts: ViewPatch[] = mapped.map((action) => ({
		op: 'upsertPendingAction' as const,
		action,
	}))

	return {
		kind: 'apply',
		patches: [...removes, ...upserts],
		removedRequestIds,
	}
}
