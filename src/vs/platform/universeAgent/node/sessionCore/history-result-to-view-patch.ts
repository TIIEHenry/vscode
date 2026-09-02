/**
 * historyResult ok envelopes → ViewPatch[] via foldDomainStreamEvent (INV-HR-1).
 * Seq-only rows are coverage markers (INV-HR-3); they produce no patches.
 *
 * ADR-017 / INV-CT2-7 / INV-PM3-6: history never rehydrates pending — drop
 * upsertPendingAction even when live fold dual-writes (clientToolCall knife 2;
 * permission knife 3).
 *
 * INV-CT2-8: history clientToolCall mint terminalizes when callId is not an
 * open pending action (completed/failed from own-data; else completed fail-closed;
 * no invented resultPreview; no respondable off pendingActions).
 *
 * ADR-019 / INV-SSR-APPLY-12 (history producer): also emit Actor-seed
 * `seqItemNotes` (fold-sidechannel; not ViewPatch). Knife 3 consumes later.
 *
 * INV-HRA-ARM-1: envelope `arm` identity domain fail-closed at fold entry
 * (type / canonical form / length / stringify garbage). Reject only — never
 * String()/trim/truncate. Rejects land in additive `rejectedArms` (Actor wiring
 * out of scope this slice).
 *
 * INV-HRA-OWN-1: hasArmField admits only own data `arm` (getOwnPropertyDescriptor
 * + desc own `value`); prototype / accessor arms silent-skip; accessors never run.
 *
 * INV-HRA-OWN-2: readPositiveSeq admits only own data `seq` (reuse
 * readOwnDataValue; prototype / accessor seq omit notes; accessors never run).
 *
 * INV-HRA-CTC-ID-2: historyClientToolCallBody callId exact-canonical only after
 * own-data read (length > 0 && value === value.trim()); open-pending Set
 * membership compares verbatim callId (0× .trim() key); padded → withhold mint /
 * no terminalize-via-washed id. Align INV-SEV-CTC-ID-2. ≠ INV-DBI padded-preserve
 * on generic timeline id; ≠ live SEV fold / session-actor / chat-wire.
 */

import {
	DOMAIN_TIMELINE_ARMS,
	foldDomainStreamEvent,
	type DomainTimelineArm,
} from './stream-event-to-view-patch.js'
import {
	timelineItemFromClientToolCallHistoryMint,
	type ClientToolCallChromeInput,
} from '../../common/sessionView/client-tool-call.js'
import type { TimelineItemId, ViewPatch } from '../../common/sessionView/types.js'

/** Max admitted history-envelope arm length (INV-HRA-ARM-1). */
export const HISTORY_ENVELOPE_ARM_MAX = 64 as const

export type HistoryEnvelopeArmRejectReason =
	'non_string' | 'non_canonical' | 'stringify_garbage' | 'too_long' | 'unknown_arm'

export type HistoryEnvelopeArmReject = {
	readonly reason: HistoryEnvelopeArmRejectReason
}

const STRINGIFY_GARBAGE = new Set(['undefined', 'null', '[object Object]', 'NaN'])

/**
 * Private admit for history-envelope `arm` (INV-HRA-ARM-1).
 * Returns the original string on success — never String()/trim/truncate.
 */
function admitHistoryEnvelopeArm(
	value: unknown,
):
	| { readonly ok: true; readonly arm: string }
	| { readonly ok: false; readonly reason: HistoryEnvelopeArmRejectReason } {
	if (typeof value !== 'string') return { ok: false, reason: 'non_string' }
	if (value !== value.trim() || value.length === 0) {
		return { ok: false, reason: 'non_canonical' }
	}
	if (STRINGIFY_GARBAGE.has(value)) {
		return { ok: false, reason: 'stringify_garbage' }
	}
	if (value.length > HISTORY_ENVELOPE_ARM_MAX) {
		return { ok: false, reason: 'too_long' }
	}
	return { ok: true, arm: value }
}

/**
 * INV-HRA-WL-1: file-private domain-arm membership after ARM-1 identity admit.
 * Uses DOMAIN_TIMELINE_ARMS.includes — never `in`, never a local seven-arm copy.
 */
function isKnownHistoryEnvelopeArm(arm: string): boolean {
	return (DOMAIN_TIMELINE_ARMS as readonly string[]).includes(arm)
}

function isHistorySafePatch(patch: ViewPatch): boolean {
	return patch.op !== 'upsertPendingAction'
}

function historyClientToolCallBody(envelope: unknown): ClientToolCallChromeInput | undefined {
	if (typeof envelope !== 'object' || envelope === null) return undefined
	const body = readOwnDataValue(envelope, 'body')
	if (typeof body !== 'object' || body === null) return undefined
	const callId = readOwnDataValue(body, 'callId')
	const toolName = readOwnDataValue(body, 'toolName')
	const argumentsJson = readOwnDataValue(body, 'argumentsJson')
	// INV-HRA-CTC-ID-2: exact-canonical after own-data (align INV-SEV-CTC-ID-2).
	if (typeof callId !== 'string' || callId.length === 0 || callId !== callId.trim()) {
		return undefined
	}
	if (typeof toolName !== 'string') return undefined
	if (typeof argumentsJson !== 'string') return undefined
	return { callId, toolName, argumentsJson }
}

function isOpenPendingClientToolCall(
	envelope: unknown,
	openPendingCallIds: ReadonlySet<string> | undefined,
): boolean {
	if (openPendingCallIds === undefined || openPendingCallIds.size === 0) {
		return false
	}
	const body = historyClientToolCallBody(envelope)
	if (body === undefined) return false
	// INV-HRA-CTC-ID-2: verbatim callId — 0× .trim() key.
	return openPendingCallIds.has(body.callId)
}

function rewriteHistoryClientToolCallPatches(
	safe: readonly ViewPatch[],
	envelope: unknown,
	openPendingCallIds: ReadonlySet<string> | undefined,
): readonly ViewPatch[] {
	const body = historyClientToolCallBody(envelope)
	if (body === undefined) return safe
	const isOpenPending = isOpenPendingClientToolCall(envelope, openPendingCallIds)
	return safe.map((patch) => {
		if (patch.op !== 'upsertTimelineItem') return patch
		const item = timelineItemFromClientToolCallHistoryMint(body, { isOpenPending })
		if (item === undefined) return patch
		return {
			op: 'upsertTimelineItem' as const,
			item,
		}
	})
}

/**
 * Actor-seed note for seq→id Map (INV-SSR-APPLY-12).
 * Fold-sidechannel — NOT a ViewPatch; NOT live transport-top-level `seq?`.
 * Knife 3: history / live / range feed the same Map via one apply API.
 */
export type SeqItemNote = {
	readonly seq: number
	readonly itemId: TimelineItemId
}

export type HistoryFillEnvelopeFold = {
	readonly patches: readonly ViewPatch[]
	readonly seqItemNotes: readonly SeqItemNote[]
	readonly malformedArms: readonly DomainTimelineArm[]
	readonly unknownArms: readonly string[]
	/** Additive (INV-HRA-ARM-1); Actor consumption out of scope this slice. */
	readonly rejectedArms: readonly HistoryEnvelopeArmReject[]
}

/**
 * Own data property only (INV-HRA-OWN-1). Accessors return undefined without
 * invoking getters. No nullish coalescing; no independent key-in checks.
 */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

function hasArmField(value: unknown): value is { readonly arm: unknown } {
	if (typeof value !== 'object' || value === null) return false
	return readOwnDataValue(value, 'arm') !== undefined
}

/** Align with live top-level `seq?`: finite integer > 0 only. */
export function readPositiveSeq(envelope: unknown): number | undefined {
	if (typeof envelope !== 'object' || envelope === null) return undefined
	const seq = readOwnDataValue(envelope, 'seq')
	if (typeof seq === 'number' && Number.isFinite(seq) && Number.isInteger(seq) && seq > 0) {
		return seq
	}
	return undefined
}

/**
 * Pair positive seq with safe patches → at most one SeqItemNote.
 * Exactly one upsertTimelineItem required; 0 or >1 → undefined (MF-2 fail-closed).
 */
export function seqItemNoteFromSafePatches(
	seq: number,
	safePatches: readonly ViewPatch[],
): SeqItemNote | undefined {
	if (!(typeof seq === 'number' && Number.isFinite(seq) && Number.isInteger(seq) && seq > 0)) {
		return undefined
	}
	const upserts = safePatches.filter(
		(p): p is Extract<ViewPatch, { readonly op: 'upsertTimelineItem' }> =>
			p.op === 'upsertTimelineItem',
	)
	if (upserts.length !== 1) return undefined
	return { seq, itemId: upserts[0]!.item.id }
}

/**
 * INV-HRA-WL-1 helper: shared fold loop. `knownArmsOnly` gates membership after
 * ARM-1 admit. Live export must pass false — never post-filter the return.
 */
function foldHistoryFillEnvelopes(
	envelopes: readonly unknown[],
	knownArmsOnly: boolean,
	openPendingCallIds: ReadonlySet<string> | undefined,
): HistoryFillEnvelopeFold {
	const patches: ViewPatch[] = []
	const seqItemNotes: SeqItemNote[] = []
	const malformedArms: DomainTimelineArm[] = []
	const unknownArms: string[] = []
	const rejectedArms: HistoryEnvelopeArmReject[] = []

	for (const envelope of envelopes) {
		if (!hasArmField(envelope)) continue

		const admitted = admitHistoryEnvelopeArm(envelope.arm)
		if (!admitted.ok) {
			rejectedArms.push({ reason: admitted.reason })
			continue
		}
		const { arm } = admitted

		if (knownArmsOnly && !isKnownHistoryEnvelopeArm(arm)) {
			rejectedArms.push({ reason: 'unknown_arm' })
			continue
		}

		const fold = foldDomainStreamEvent(envelope)
		switch (fold.kind) {
			case 'patches': {
				let safe: readonly ViewPatch[] = fold.patches.filter(isHistorySafePatch)
				if (arm === 'clientToolCall') {
					safe = rewriteHistoryClientToolCallPatches(safe, envelope, openPendingCallIds)
				}
				patches.push(...safe)
				const seq = readPositiveSeq(envelope)
				if (seq !== undefined) {
					const note = seqItemNoteFromSafePatches(seq, safe)
					if (note !== undefined) seqItemNotes.push(note)
				}
				break
			}
			case 'malformed':
				malformedArms.push(fold.arm)
				break
			case 'unhandled':
				unknownArms.push(arm)
				break
		}
	}

	return {
		patches,
		seqItemNotes,
		malformedArms,
		unknownArms,
		rejectedArms,
	}
}

/**
 * Pure: each envelope with `arm` goes through foldDomainStreamEvent;
 * seq-only / non-object rows are skipped (no unknown_arm).
 * Dual channel: patches (view) + seqItemNotes (Actor-seed; INV-SSR-APPLY-12).
 * INV-HRA-ARM-1: arm identity domain admit before fold (reject-only).
 */
export function viewPatchesFromHistoryFillEnvelopes(
	envelopes: readonly unknown[],
	openPendingCallIds?: ReadonlySet<string>,
): HistoryFillEnvelopeFold {
	return foldHistoryFillEnvelopes(envelopes, false, openPendingCallIds)
}

/**
 * INV-HRA-WL-1: test-only whitelist path. Kept off barrel. 0 production callers.
 */
export function viewPatchesFromHistoryFillEnvelopesWithKnownArms(
	envelopes: readonly unknown[],
	openPendingCallIds?: ReadonlySet<string>,
): HistoryFillEnvelopeFold {
	return foldHistoryFillEnvelopes(envelopes, true, openPendingCallIds)
}
