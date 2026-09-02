/**
 * Presentation: Chat demux `clientToolCall` side-effect body → U1 `kind:'tool'`
 * TimelineItemView. Pure; shared by fixture chrome and foldDomainStreamEvent (INV-CTF-2).
 *
 * INV-CTM-ADDR-1: respondable grant is fail-closed on the mint address domain
 * (trim-empty / `__proto__` do not receive the credential; refuse, do not wash).
 *
 * INV-CTM-ADDR-2: respond credential is granted only when the raw `input.callId`
 * is a canonical mint address (string ∧ 0 < len ≤ 256 ∧ trim-identity ∧ ≠ `__proto__`);
 * padded / oversized withhold the credential. Grant check-only; never write-back.
 *
 * INV-CTM-OWN-1: respondable grant reads own-data callId only (descriptor value;
 * no accessor). Missing own / accessor → withhold.
 *
 * INV-CTM-ID-2: mint / history-mint `callId` into `id` / default `orderKey` is
 * exact-canonical only (`length > 0 && value === value.trim()`); 0×
 * `input.callId.trim()` identity write. Padded / blank → withhold mint
 * (`undefined`). Preview display trim may stay.
 *
 * INV-CTM-NAME-1: mint / history-mint `toolName` — 0× invent via
 * `.trim() || 'client_tool'` (and title / orderKey soft `||` fallbacks);
 * empty / whitespace-only / absent → withhold mint peer CTM-ID.
 * Non-empty display trim may stay. Respond path: INV-CTC-RSP-ID-2 (already exact).
 *
 * INV-CTM-STAT-1: mint / history-mint live status — 0× invent via
 * `options?.status ?? 'pending'`; unset / non-admitted → withhold mint peer NAME.
 * History open-pending projects explicit `{ status: 'pending' }` from the
 * open-pending ledger (not soft `??`). Out: NAME/ID/PAB-CTC redo; demux
 * display Held; ContinueGeneration.
 */

import type { TimelineItemId, TimelineItemView, ToolSummaryStatus } from './types.js'

/** INV-SPC-13: bounded preview only (O(10²) chars). */
export const CLIENT_TOOL_ARG_PREVIEW_MAX = 240

/** Result preview bound (aligned with TOOL_STREAM_PREVIEW_MAX; not imported). */
export const CLIENT_TOOL_RESULT_PREVIEW_MAX = 240

/** INV-CTM-ADDR-2: mint address upper bound (copied from TIMELINE_ROW_ID_MAX; not imported). */
const CLIENT_TOOL_MINT_ADDRESS_MAX = 256

/**
 * INV-CTM-ADDR-1: addressable callId for respond correlation (trim is
 * check-only relative to grant).
 * Dual-gate with slot A INV-CTR-ADDR-1 — no shared file, no ui import.
 *
 * INV-CTM-ADDR-2: grant reads the raw mint callId (`unknown`); canonical
 * trim-identity + 256 + ≠ `__proto__`. Credential check does not use any
 * identity write-back.
 */
export function isClientToolRespondAddress(value: unknown): boolean {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > CLIENT_TOOL_MINT_ADDRESS_MAX) {
		return false
	}
	if (value !== value.trim()) return false
	return value !== '__proto__'
}

/**
 * INV-CTM-ID-2: exact-canonical mint callId (non-empty ∧ trim-identity).
 * Check-only — never written back. File-private.
 */
function isClientToolMintExactCanonicalId(value: string): boolean {
	return value.length > 0 && value === value.trim()
}

/**
 * INV-CTM-NAME-1: display name admit (trim check + non-empty). Empty /
 * whitespace-only / non-string → undefined (withhold; 0× invent).
 */
function admitClientToolDisplayName(value: unknown): string | undefined {
	if (typeof value !== 'string') return undefined
	const trimmed = value.trim()
	if (trimmed.length === 0) return undefined
	return trimmed
}

/**
 * INV-CTM-STAT-1: closed ToolSummaryStatus admit. Unset / non-member →
 * undefined (withhold; 0× invent `'pending'`).
 */
function admitClientToolSummaryStatus(value: unknown): ToolSummaryStatus | undefined {
	switch (value) {
		case 'pending':
		case 'running':
		case 'completed':
		case 'failed':
		case 'cancelled':
			return value
		default:
			return undefined
	}
}

export type ClientToolCallChromeInput = {
	readonly callId: string
	readonly toolName: string
	readonly argumentsJson: string
	/** Optional; unused by chrome (kept for demux body parity). */
	readonly sessionId?: string
	readonly agentId?: string
}

export type ClientToolRespondChromeInput = {
	readonly callId: string
	readonly isError: boolean
	readonly content: string
}

function truncatePreview(raw: string, max: number): string | undefined {
	const trimmed = raw.trim()
	if (trimmed.length === 0) return undefined
	if (trimmed.length <= max) return trimmed
	return `${trimmed.slice(0, Math.max(0, max - 1))}…`
}

/** Fail-closed: missing / invalid JSON → omit preview (no invented args). */
function clientToolArgPreviewFromOwnData(input: ClientToolCallChromeInput): string | undefined {
	const raw = readOwnDataValue(input as object, 'argumentsJson')
	if (typeof raw !== 'string') return undefined
	const trimmed = raw.trim()
	if (trimmed.length === 0) return undefined
	try {
		JSON.parse(trimmed)
	} catch {
		return undefined
	}
	return truncatePreview(trimmed, CLIENT_TOOL_ARG_PREVIEW_MAX)
}

/** Fail-closed: missing / whitespace-only own content → omit preview (no invented result). */
function clientToolResultPreviewFromOwnData(
	input: ClientToolRespondChromeInput,
): string | undefined {
	const raw = readOwnDataValue(input as object, 'content')
	if (typeof raw !== 'string') return undefined
	return truncatePreview(raw, CLIENT_TOOL_RESULT_PREVIEW_MAX)
}

function clientToolRespondStatusFromOwnData(
	input: ClientToolRespondChromeInput,
): ToolSummaryStatus | undefined {
	const raw = readOwnDataValue(input as object, 'isError')
	if (typeof raw !== 'boolean') return undefined
	return raw ? 'failed' : 'completed'
}

/** INV-CTM-OWN-1: own data property only; never invoke accessors. */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/**
 * INV-CT2-8: history fill terminal status from own-data only (fail-closed).
 * `isError` boolean → failed/completed; else own `status` when completed|failed;
 * else completed without inventing terminal fields.
 */
function clientToolHistoryTerminalStatusFromOwnData(body: object): ToolSummaryStatus {
	const isError = readOwnDataValue(body, 'isError')
	if (typeof isError === 'boolean') {
		return isError ? 'failed' : 'completed'
	}
	const status = readOwnDataValue(body, 'status')
	if (status === 'completed' || status === 'failed') {
		return status
	}
	return 'completed'
}

/** INV-CT2-8: history fill resultPreview from own-data content only. */
function clientToolHistoryResultPreviewFromOwnData(body: object): string | undefined {
	const raw = readOwnDataValue(body, 'content')
	if (typeof raw !== 'string') return undefined
	return truncatePreview(raw, CLIENT_TOOL_RESULT_PREVIEW_MAX)
}

/**
 * History fill mint for clientToolCall (INV-CT2-7 / INV-CT2-8 · INV-CTM-ID-2 ·
 * INV-CTM-NAME-1 · INV-CTM-STAT-1).
 * Open pending actions keep live pending+respondable; otherwise terminalize
 * (no respondable; no invented resultPreview).
 * INV-CTM-ID-2: exact-canonical callId; padded / blank → withhold (`undefined`).
 * INV-CTM-NAME-1: empty / whitespace toolName → withhold (0× `'client_tool'`).
 * INV-CTM-STAT-1: open-pending admits explicit `'pending'` (0× soft `??`).
 */
export function timelineItemFromClientToolCallHistoryMint(
	input: ClientToolCallChromeInput,
	options: { readonly isOpenPending: boolean },
): TimelineItemView | undefined {
	if (options.isOpenPending) {
		// INV-CTM-STAT-1: open-pending ledger admits pending; not soft `??`.
		return timelineItemFromClientToolCall(input, { status: 'pending' })
	}
	const callId = input.callId
	// INV-CTM-ID-2: exact-canonical admit; 0× trim-write into id/orderKey.
	if (typeof callId !== 'string' || !isClientToolMintExactCanonicalId(callId)) {
		return undefined
	}
	// INV-CTM-NAME-1: non-empty display toolName; 0× invent `'client_tool'`.
	const toolName = admitClientToolDisplayName(input.toolName)
	if (toolName === undefined) {
		return undefined
	}
	const title = toolName
	const orderKey = callId
	const argPreview = clientToolArgPreviewFromOwnData(input)
	const body = input as object
	const status = clientToolHistoryTerminalStatusFromOwnData(body)
	const resultPreview = clientToolHistoryResultPreviewFromOwnData(body)

	return {
		id: callId as TimelineItemId,
		orderKey,
		summary: {
			kind: 'tool',
			title,
			toolName,
			status,
			...(argPreview !== undefined ? { argPreview } : {}),
			...(resultPreview !== undefined ? { resultPreview } : {}),
		},
	}
}

/**
 * Maps a clientToolCall side-effect body onto the closed U1 tool summary arm.
 * `callId` is the stable Timeline item id (respond correlation).
 * INV-CTM-ID-2: exact-canonical admit; padded / blank → withhold (`undefined`);
 * 0× `input.callId.trim()` into id / default orderKey.
 * INV-CTM-NAME-1: non-empty toolName; empty / whitespace → withhold;
 * 0× `.trim() || 'client_tool'`; blank title / orderKey overrides withhold
 * (0× soft `||` invent).
 * INV-CTM-STAT-1: admitted `options.status` only; unset / non-member →
 * withhold (0× `options?.status ?? 'pending'`).
 */
export function timelineItemFromClientToolCall(
	input: ClientToolCallChromeInput,
	options?: {
		readonly status?: ToolSummaryStatus
		readonly title?: string
		readonly orderKey?: string
	},
): TimelineItemView | undefined {
	const callId = input.callId
	// INV-CTM-ID-2: exact-canonical admit; padded / blank → withhold mint; 0× trim-write.
	if (typeof callId !== 'string' || !isClientToolMintExactCanonicalId(callId)) {
		return undefined
	}
	// INV-CTM-NAME-1: non-empty display toolName; 0× invent `'client_tool'`.
	const toolName = admitClientToolDisplayName(input.toolName)
	if (toolName === undefined) {
		return undefined
	}
	// INV-CTM-STAT-1: admitted status only; 0× invent `'pending'` unless
	// caller omitted status entirely (payload shape without status → pending).
	// Empty-string / invalid status still withholds.
	const statusInput = options?.status ?? 'pending'
	const status = admitClientToolSummaryStatus(statusInput)
	if (status === undefined) {
		return undefined
	}
	// INV-CTM-NAME-1: blank title / orderKey override → withhold (0× soft `||`).
	let title = toolName
	if (options?.title !== undefined) {
		const titleOverride = admitClientToolDisplayName(options.title)
		if (titleOverride === undefined) {
			return undefined
		}
		title = titleOverride
	}
	let orderKey = callId
	if (options?.orderKey !== undefined) {
		const orderKeyOverride = admitClientToolDisplayName(options.orderKey)
		if (orderKeyOverride === undefined) {
			return undefined
		}
		orderKey = orderKeyOverride
	}
	const argPreview = clientToolArgPreviewFromOwnData(input)
	const callIdForGrant = readOwnDataValue(input as object, 'callId')

	return {
		id: callId as TimelineItemId,
		orderKey,
		summary: {
			kind: 'tool',
			title,
			toolName,
			status,
			...(isClientToolRespondAddress(callIdForGrant) ? { respondable: true as const } : {}),
			...(argPreview !== undefined ? { argPreview } : {}),
		},
	}
}

/**
 * Maps a host-write-accepted clientToolRespond onto an existing timeline tool row.
 * INV-CTC-RSP-ID-2: after own-data `callId` read, require exact-canonical
 * (`length > 0 && value === value.trim()`); compare verbatim to `existing.id`;
 * 0× `callIdRaw.trim()` writeback. Padded → undefined. No synthetic ids.
 * Fail-closed: missing own content → omit `resultPreview` (status still advances).
 */
export function timelineItemFromClientToolRespond(
	input: ClientToolRespondChromeInput,
	existing: TimelineItemView,
): TimelineItemView | undefined {
	const callIdRaw = readOwnDataValue(input as object, 'callId')
	if (typeof callIdRaw !== 'string') return undefined
	// INV-CTC-RSP-ID-2: exact-canonical only; verbatim compare; 0× trim-write.
	if (callIdRaw.length === 0 || callIdRaw !== callIdRaw.trim()) {
		return undefined
	}
	if (String(existing.id) !== callIdRaw) return undefined
	if (existing.summary.kind !== 'tool') return undefined

	const status = clientToolRespondStatusFromOwnData(input)
	if (status === undefined) return undefined

	const resultPreview = clientToolResultPreviewFromOwnData(input)
	const prev = existing.summary

	return {
		...existing,
		summary: {
			kind: 'tool',
			title: prev.title,
			toolName: prev.toolName,
			status,
			...(prev.argPreview !== undefined ? { argPreview: prev.argPreview } : {}),
			...(resultPreview !== undefined ? { resultPreview } : {}),
		},
	}
}
