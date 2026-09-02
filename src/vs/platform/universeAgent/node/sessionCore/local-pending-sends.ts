/**
 * ADR-012 §6.2 — localPendingSends producer helpers (pure).
 * Actor owns fold; this module decides upsert vs capacity skip.
 *
 * Dual of INV-PAB-W1 (`admitPendingActionUpserts`) on the localPendingSends axis:
 * frame-ordered batch admit so same-frame new operationIds cannot breach CAP.
 * This slice does **not** wire Actor / foldAndBroadcastPatches — wiring is a
 * follow-up knife.
 *
 * INV-LPS-ID-1: operationId identity domain fail-closed (reject, do not wash).
 * Admissible ids pass decide/admit; blank / pad / `__proto__` skip with
 * {@link LOCAL_PENDING_SEND_OPERATION_ID_INVALID}. Supersede match gates both
 * sides the same way. Trim is predicate-only — never rewrite ids.
 *
 * INV-LPS-STR-1: stringify-garbage identity domain (reject, do not wash).
 * `'undefined'` / `'null'` / `'[object Object]'` / `'NaN'` skip with the same
 * {@link LOCAL_PENDING_SEND_OPERATION_ID_INVALID}. Gate order after ID-1:
 * typeof → trim-identity → blank → `__proto__` → garbage. Predicate remains
 * file-private; 0 new failure codes.
 *
 * INV-LPS-OWN-1: decideLocalPendingUpsert reads operationId only as own data
 * property (file-private readOwnDataValue) before ID-1 predicate; missing own
 * / accessor → LOCAL_PENDING_SEND_OPERATION_ID_INVALID; accessor never invoked.
 *
 * INV-LPS-ROW-1: decideLocalPendingUpsert reads summary.kind only as own data
 * on own-data summary object before ROW predicate; missing own / accessor /
 * unknown kind → LOCAL_PENDING_SEND_OPERATION_ID_INVALID; accessor never invoked.
 * Admitted overlay row kind is `'text'` only (ADR-012 §6.2 optimistic send).
 */

import type { CorrelationRef } from './messages.js'
import type { OperationId, PendingSendView, ViewPatch } from '../../common/sessionView/types.js'

/** Bound for optimistic sends overlay (fail-closed on new id; same class as write cap). */
export const LOCAL_PENDING_SENDS_CAP = 64

/** Stable diagnostic code for capacity skip (Actor may warn when wired). */
export const LOCAL_PENDING_SENDS_AT_CAPACITY = 'local_pending_sends_at_capacity' as const

/** Stable diagnostic code for identity-domain reject (INV-LPS-ID-1). */
export const LOCAL_PENDING_SEND_OPERATION_ID_INVALID =
	'local_pending_send_operation_id_invalid' as const

export type LocalPendingSendSkipCode =
	typeof LOCAL_PENDING_SENDS_AT_CAPACITY | typeof LOCAL_PENDING_SEND_OPERATION_ID_INVALID

export type LocalPendingUpsertDecision =
	| { readonly kind: 'upsert'; readonly send: PendingSendView }
	| {
			readonly kind: 'skip_at_capacity'
			readonly send: PendingSendView
			readonly code: LocalPendingSendSkipCode
		}

const LOCAL_PENDING_SEND_STRINGIFY_GARBAGE = new Set([
	'undefined',
	'null',
	'[object Object]',
	'NaN',
])

/** INV-LPS-ROW-1: sole admitted summary.kind for localPendingSends overlay rows. */
const LOCAL_PENDING_SEND_ADMITTED_SUMMARY_KIND = 'text' as const

/**
 * INV-LPS-ID-1 SSOT predicate (file-private; not exported from index).
 * Trim is comparison-only — never rewrite the candidate id.
 */
function isAdmissibleOperationId(value: unknown): value is string {
	return (
		typeof value === 'string' &&
		value === value.trim() &&
		value !== '' &&
		value !== '__proto__' &&
		!LOCAL_PENDING_SEND_STRINGIFY_GARBAGE.has(value)
	)
}

/** INV-LPS-OWN-1: own data property only; never invoke accessors. */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/**
 * INV-LPS-ROW-1 SSOT predicate (file-private; not exported from index).
 * Own-data kind must be read before this predicate.
 */
function isAdmissiblePendingSendSummaryKind(
	value: unknown,
): value is typeof LOCAL_PENDING_SEND_ADMITTED_SUMMARY_KIND {
	return value === LOCAL_PENDING_SEND_ADMITTED_SUMMARY_KIND
}

/** INV-LPS-ROW-1: own-data summary then own-data kind; never invoke accessors. */
function readPendingSendSummaryKind(send: PendingSendView): unknown {
	const summary = readOwnDataValue(send, 'summary')
	if (summary === null || typeof summary !== 'object' || Array.isArray(summary)) {
		return undefined
	}
	return readOwnDataValue(summary, 'kind')
}

function textFromPayload(payload: unknown): string {
	if (typeof payload !== 'object' || payload === null) return ''
	const text = (payload as { readonly text?: unknown }).text
	return typeof text === 'string' ? text : ''
}

/** Build overlay chrome from submitInput fact (operationId ≡ host correlation/messageId). */
export function pendingSendViewFromSubmit(
	correlation: CorrelationRef,
	payload: unknown,
): PendingSendView {
	const text = textFromPayload(payload)
	const title = text.trim() !== '' ? text.slice(0, 80) : 'Sending…'
	const preview = text.trim() !== '' ? text.slice(0, 120) : undefined
	return {
		operationId: String(correlation) as OperationId,
		summary: preview ? { kind: 'text', title, preview } : { kind: 'text', title },
	}
}

/**
 * Idempotent upsert when operationId already present; reject *new* ids at capacity
 * (do not drop older entries — INV-SPC-15-class fail-closed).
 * INV-LPS-ID-1: identity gate before exists/capacity — illegal ids skip even under cap.
 * INV-LPS-OWN-1: operationId must be own data before ID-1; compare via local id.
 * INV-LPS-ROW-1: summary.kind must be own data before ROW; gate after ID-1.
 */
export function decideLocalPendingUpsert(
	current: readonly PendingSendView[],
	send: PendingSendView,
	cap: number = LOCAL_PENDING_SENDS_CAP,
): LocalPendingUpsertDecision {
	const operationId = readOwnDataValue(send, 'operationId')
	if (!isAdmissibleOperationId(operationId)) {
		return {
			kind: 'skip_at_capacity',
			send,
			code: LOCAL_PENDING_SEND_OPERATION_ID_INVALID,
		}
	}
	if (!isAdmissiblePendingSendSummaryKind(readPendingSendSummaryKind(send))) {
		return {
			kind: 'skip_at_capacity',
			send,
			code: LOCAL_PENDING_SEND_OPERATION_ID_INVALID,
		}
	}
	const exists = current.some((s) => s.operationId === operationId)
	if (!exists && current.length >= cap) {
		return {
			kind: 'skip_at_capacity',
			send,
			code: LOCAL_PENDING_SENDS_AT_CAPACITY,
		}
	}
	return { kind: 'upsert', send }
}

export type LocalPendingSendAdmitResult = {
	readonly patches: readonly ViewPatch[]
	readonly skipped: readonly {
		readonly send: PendingSendView
		readonly code: LocalPendingSendSkipCode
	}[]
}

/**
 * Batch admit for ViewPatch frames (INV-PAB-W1 dual on localPendingSends): walk
 * patches in order, decide each upsertLocalSend against a simulated pending set
 * so same-frame new operationIds cannot breach CAP. Removes update sim; other
 * ops pass through. Pure: no fold, no warn, no mutate of inputs.
 */
export function admitLocalPendingSendUpserts(
	current: readonly PendingSendView[],
	patches: readonly ViewPatch[],
	cap: number = LOCAL_PENDING_SENDS_CAP,
): LocalPendingSendAdmitResult {
	let sim = [...current]
	const out: ViewPatch[] = []
	const skipped: {
		readonly send: PendingSendView
		readonly code: LocalPendingSendSkipCode
	}[] = []

	for (const patch of patches) {
		if (patch.op === 'upsertLocalSend') {
			const decision = decideLocalPendingUpsert(sim, patch.send, cap)
			if (decision.kind === 'skip_at_capacity') {
				skipped.push({ send: patch.send, code: decision.code })
				continue
			}
			out.push({ op: 'upsertLocalSend', send: decision.send })
			const idx = sim.findIndex((s) => s.operationId === decision.send.operationId)
			if (idx === -1) {
				sim.push(decision.send)
			} else {
				sim[idx] = decision.send
			}
			continue
		}
		if (patch.op === 'removeLocalSend') {
			out.push(patch)
			sim = sim.filter((s) => s.operationId !== patch.operationId)
			continue
		}
		out.push(patch)
	}

	return { patches: out, skipped }
}

/**
 * ADR-012 §6.2 L2/L4 supersession patches.
 * Empty when operationId is not in the overlay.
 */
export function patchesForLocalPendingSupersede(
	current: readonly PendingSendView[],
	operationId: OperationId,
): readonly ViewPatch[] {
	if (!current.some((s) => s.operationId === operationId)) return []
	return [{ op: 'removeLocalSend', operationId }]
}

/**
 * Interim ADR-012 §6.2 match: upsertTimelineItem.item.id ≡ pending.operationId
 * (≡ host correlation). U3 envelope fold must reuse this helper — no alternate keys.
 * INV-LPS-ID-1: illegal ids never enter the pending Set; illegal item.id never match.
 */
export function operationIdsToSupersedeFromViewPatches(
	current: readonly PendingSendView[],
	patches: readonly ViewPatch[],
): readonly OperationId[] {
	if (current.length === 0) return []
	const pending = new Set(
		current
			.filter((s) => isAdmissiblePendingSendSummaryKind(readPendingSendSummaryKind(s)))
			.map((s) => String(s.operationId))
			.filter((id) => isAdmissibleOperationId(id)),
	)
	const matched: OperationId[] = []
	const seen = new Set<string>()
	for (const patch of patches) {
		if (patch.op !== 'upsertTimelineItem') continue
		const id = String(patch.item.id)
		if (!isAdmissibleOperationId(id) || !pending.has(id) || seen.has(id)) {
			continue
		}
		seen.add(id)
		matched.push(id as OperationId)
	}
	return matched
}

/** Aggregate removeLocalSend patches for matched ids (same algebra as supersede hook). */
export function patchesForLocalPendingSupersedeAll(
	current: readonly PendingSendView[],
	operationIds: readonly OperationId[],
): readonly ViewPatch[] {
	const out: ViewPatch[] = []
	for (const operationId of operationIds) {
		out.push(...patchesForLocalPendingSupersede(current, operationId))
	}
	return out
}
