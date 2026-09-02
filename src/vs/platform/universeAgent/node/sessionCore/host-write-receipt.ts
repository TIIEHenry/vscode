/**
 * Host Chat write receipt markers on the `inputDelivery` channel
 * (ADR-017 Amendment 1 · INV-PCA-2).
 *
 * Structural markers only — does **not** extend `NormalizedLocalFact` in
 * `local-fact.ts` (slot A reserved). Engine downlink inputDelivery must not
 * carry these fields; never treat unscoped `dispatched` as host-write success.
 *
 * INV-HWR-OWN-1: readHostWriteReceiptMarkers admits source / writeId /
 * chatAttemptId only as own-data (descriptor value; no accessor). No wash.
 *
 * INV-HWR-OWN-2: writeId / chatAttemptId exact-canonical only after own-data
 * read (value === value.trim(); non-empty; STRINGIFY_GARBAGE rejected).
 */

export const HOST_WRITE_RECEIPT_SOURCE = 'host-write-accepted' as const

export type HostWriteReceiptMarkers = {
	readonly source: typeof HOST_WRITE_RECEIPT_SOURCE
	readonly writeId: string
	readonly chatAttemptId: string
}

/** Own data only — prototype chain and accessors are refused (never invoked). */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/** Stringify garbage that must never become receipt identity (INV-HWR-ID-1). */
const STRINGIFY_GARBAGE = new Set(['undefined', 'null', '[object Object]', 'NaN'])

function readStringField(record: object, key: string): string | null {
	const value = readOwnDataValue(record, key)
	if (typeof value !== 'string') return null
	if (value.length === 0 || value !== value.trim()) return null
	if (STRINGIFY_GARBAGE.has(value)) return null
	return value
}

/**
 * Narrow host-synthesized write receipts (success or failure) by source + ids.
 * Returns null for engine downlink / unmarked inputDelivery.
 */
export function readHostWriteReceiptMarkers(fact: unknown): HostWriteReceiptMarkers | null {
	if (typeof fact !== 'object' || fact === null) return null
	if (readOwnDataValue(fact, 'source') !== HOST_WRITE_RECEIPT_SOURCE) return null
	const writeId = readStringField(fact, 'writeId')
	const chatAttemptId = readStringField(fact, 'chatAttemptId')
	if (writeId === null || chatAttemptId === null) return null
	return {
		source: HOST_WRITE_RECEIPT_SOURCE,
		writeId,
		chatAttemptId,
	}
}
