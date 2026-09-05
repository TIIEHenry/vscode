/**
 * Pure timelineItemFrom* helpers for SessionActor respond cleanup (GFS-4).
 */
import type { NormalizedLocalFact } from './local-fact.js'
import type { ClientActionRequestId, PendingActionView, TimelineItemId, TimelineItemView } from '../../common/sessionView/types.js'

type PermissionRespondFact = Extract<NormalizedLocalFact, { kind: 'permissionRespond' }>

/** INV-PR-OWN-1: own data property only; never invoke accessors. */
function readPermissionRespondOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

function permissionDecisionFromOwnData(fact: PermissionRespondFact): 'allow' | 'deny' | undefined {
	const raw = readPermissionRespondOwnDataValue(fact as object, 'decision')
	if (raw === 'allow' || raw === 'deny') return raw
	return undefined
}

type QuestionRespondFact = Extract<NormalizedLocalFact, { kind: 'questionRespond' }>

/** INV-QR-OWN-1: own data property only; never invoke accessors. */
function readQuestionRespondOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

function questionRespondAnsweredFromOwnData(fact: QuestionRespondFact): true | undefined {
	const answersRaw = readQuestionRespondOwnDataValue(fact as object, 'answers')
	if (answersRaw === undefined) return undefined
	if (typeof answersRaw !== 'object' || answersRaw === null) return undefined
	if (Array.isArray(answersRaw)) return undefined
	return true
}

/** INV-SA-QR-ID-2 / INV-SA-PR-ID-2 / INV-SA-CLN-ID-2 / INV-SAO-IDL-ID-1: exact-canonical only. */
export function isExactRespondTimelineIdentity(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0 && value === value.trim()
}

/**
 * Maps a host-write-accepted permissionRespond onto an existing timeline permission row.
 * `requestId` must match `existing.id` verbatim; no synthetic ids.
 * Fail-closed: missing own decision → undefined (no invented allow).
 */
export function timelineItemFromPermissionRespond(
	fact: PermissionRespondFact,
	existing: TimelineItemView,
): TimelineItemView | undefined {
	const requestIdRaw = readPermissionRespondOwnDataValue(fact as object, 'requestId')
	if (!isExactRespondTimelineIdentity(requestIdRaw)) return undefined
	if (String(existing.id) !== requestIdRaw) return undefined
	if (existing.summary.kind !== 'permission') return undefined

	const decision = permissionDecisionFromOwnData(fact)
	if (decision === undefined) return undefined

	const prev = existing.summary
	return {
		...existing,
		summary: {
			kind: 'permission',
			title: prev.title,
			permissionKind: prev.permissionKind,
			...(prev.argPreview !== undefined ? { argPreview: prev.argPreview } : {}),
			...(prev.optionsPreview !== undefined ? { optionsPreview: prev.optionsPreview } : {}),
			decision,
		},
	}
}

/**
 * Maps a host-write-accepted questionRespond onto an existing timeline question row.
 * `questionId` must match `existing.id` / pending.requestId verbatim; no synthetic ids.
 * Fail-closed: missing own answers object → undefined (no invented answer content).
 */
export function timelineItemFromQuestionRespondPending(
	fact: QuestionRespondFact,
	pending: PendingActionView,
): TimelineItemView | undefined {
	const questionIdRaw = readQuestionRespondOwnDataValue(fact as object, 'questionId')
	if (!isExactRespondTimelineIdentity(questionIdRaw)) return undefined
	if (String(pending.requestId) !== questionIdRaw) return undefined
	if (pending.summary.kind !== 'question') return undefined

	if (questionRespondAnsweredFromOwnData(fact) === undefined) return undefined

	const prev = pending.summary
	return {
		id: pending.requestId as unknown as TimelineItemId,
		orderKey: String(pending.requestId),
		summary: {
			kind: 'question',
			title: prev.title,
			items: prev.items,
			answerKeysValid: prev.answerKeysValid,
			...(prev.optionsPreview !== undefined ? { optionsPreview: prev.optionsPreview } : {}),
			...(prev.multiSelect !== undefined ? { multiSelect: prev.multiSelect } : {}),
			...(prev.allowCustom !== undefined ? { allowCustom: prev.allowCustom } : {}),
			answered: true,
		},
		...(pending.agentId !== undefined ? { agentId: pending.agentId } : {}),
	}
}

export function timelineItemFromQuestionRespond(
	fact: QuestionRespondFact,
	existing: TimelineItemView,
): TimelineItemView | undefined {
	const questionIdRaw = readQuestionRespondOwnDataValue(fact as object, 'questionId')
	if (!isExactRespondTimelineIdentity(questionIdRaw)) return undefined
	if (String(existing.id) !== questionIdRaw) return undefined
	if (existing.summary.kind !== 'question') return undefined

	if (questionRespondAnsweredFromOwnData(fact) === undefined) return undefined

	const prev = existing.summary
	return {
		...existing,
		summary: {
			kind: 'question',
			title: prev.title,
			items: prev.items,
			answerKeysValid: prev.answerKeysValid,
			...(prev.optionsPreview !== undefined ? { optionsPreview: prev.optionsPreview } : {}),
			...(prev.multiSelect !== undefined ? { multiSelect: prev.multiSelect } : {}),
			...(prev.allowCustom !== undefined ? { allowCustom: prev.allowCustom } : {}),
			answered: true,
		},
	}
}
