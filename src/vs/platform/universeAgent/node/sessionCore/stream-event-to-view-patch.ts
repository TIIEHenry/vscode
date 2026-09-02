/**
 * U3 production: demuxed domain stream arms → ViewPatch[] (INV-SPC-2).
 * Actor folds results via foldStreamApplyViewPatches (ADR-012 §6.2 supersede).
 *
 * Production summary arms: text | tool | reasoning | permission | error | usage.
 * `permission` → timeline **record** + `upsertPendingAction` (ADR-017 knife 3 · INV-PM3-*).
 * Plus demux side-effect arm `clientToolCall` → U1 `kind:tool` timeline **record**
 * + `upsertPendingAction` (ADR-017 knife 2 · INV-CT2-*; CTA authority = pending).
 * R-SNAP-4 arm `unknownBlock` → honest degradation record `{kind:'unknown',
 * typeName, rawContent}` (mirror ADR-307) — fail-closed explicitness, never a
 * drop-on-floor wash; identity-admitted rows only.
 * `generic` is never claimed here (unknown upstream / test probes only).
 *
 * INV-SEV-OWN-1: domain arm predicates + foldDomainStreamEvent admit only own data
 * `arm`, fold-path event `body`, and readBaseFields id/orderKey/operationId;
 * INV-SEV-OWN-3: required body strings title / toolName / permissionKind via
 * readRequiredBodyStringField / readRequiredNonEmptyBodyStringField at admit and emit;
 * prototype / accessor → unhandled/false/malformed; accessors never run.
 * INV-SEV-CTC-ID-2: clientToolCall body callId exact-canonical only after
 * own-data read (length > 0 && value === value.trim()); padded → admit fail /
 * fold malformed; 0× trim-write. ≠ INV-DBI padded-preserve on id/orderKey.
 */

import type {
	ClientActionRequestId,
	TimelineCanvasRef,
	TimelineItemId,
	TimelineItemSummary,
	TimelineItemView,
	ToolSummaryStatus,
	ViewPatch,
} from '../../common/sessionView/types.js'
import { admitTimelineItemTurnId } from '../../common/sessionView/apply.js'
import {
	CLIENT_TOOL_ARG_PREVIEW_MAX,
	timelineItemFromClientToolCall,
	type ClientToolCallChromeInput,
} from '../../common/sessionView/client-tool-call.js'

export { CLIENT_TOOL_ARG_PREVIEW_MAX, timelineItemFromClientToolCall }
export type { ClientToolCallChromeInput }

const TOOL_STATUSES = new Set<ToolSummaryStatus>([
	'pending',
	'running',
	'completed',
	'failed',
	'cancelled',
])

export const DOMAIN_TIMELINE_ARMS = [
	'text',
	'tool',
	'reasoning',
	'permission',
	'error',
	'usage',
	'clientToolCall',
	'unknownBlock',
] as const

export type DomainTimelineArm = (typeof DOMAIN_TIMELINE_ARMS)[number]

type DomainBaseBody = {
	readonly id: string
	readonly orderKey: string
	/** When non-empty, becomes TimelineItemView.id (ADR-012 interim ≡ operationId). */
	readonly operationId?: string
	/** Proto/engine turn id when L1 body carries it; never inferred from id/orderKey/seq. */
	readonly turnId?: string
}

export type DomainTextStreamBody = DomainBaseBody & {
	readonly title: string
	readonly preview?: string
}

export type DomainToolStreamBody = DomainBaseBody & {
	readonly toolName: string
	readonly title?: string
	readonly status?: ToolSummaryStatus
	readonly argPreview?: string
	readonly resultPreview?: string
	/** D9 (ADR-309): canvas refs from CANVAS_REF blocks in the same envelope. */
	readonly canvasRefs?: readonly TimelineCanvasRef[]
}

export type DomainReasoningStreamBody = DomainBaseBody & {
	readonly title: string
	readonly collapsedPreview?: string
	readonly streaming?: boolean
}

export type DomainPermissionStreamBody = DomainBaseBody & {
	readonly title: string
	readonly permissionKind: string
	readonly agentId?: string
	readonly optionsPreview?: readonly string[]
}

export type DomainErrorStreamBody = DomainBaseBody & {
	readonly title: string
	readonly retryable: boolean
	readonly code?: string
}

export type DomainUsageStreamBody = DomainBaseBody & {
	readonly title: string
	readonly inputTokens?: number
	readonly outputTokens?: number
	readonly contextPct?: number
}

/**
 * R-SNAP-4 (mirror ADR-307): explicit unknown-block arm — wire unknown carrier
 * (`originalType` / `rawJson`) projected verbatim; rawContent is bounded at the
 * sole fold emit site (INV-SPC-13 preview-only).
 */
export type DomainUnknownBlockStreamBody = DomainBaseBody & {
	readonly typeName: string
	readonly rawContent: string
}

/** Chat demux `clientToolCall` side-effect body (callId is timeline id). */
export type DomainClientToolCallStreamBody = ClientToolCallChromeInput

export type DomainTextStreamEvent = {
	readonly arm: 'text'
	readonly body: DomainTextStreamBody
}

export type DomainToolStreamEvent = {
	readonly arm: 'tool'
	readonly body: DomainToolStreamBody
}

export type DomainReasoningStreamEvent = {
	readonly arm: 'reasoning'
	readonly body: DomainReasoningStreamBody
}

export type DomainPermissionStreamEvent = {
	readonly arm: 'permission'
	readonly body: DomainPermissionStreamBody
}

export type DomainErrorStreamEvent = {
	readonly arm: 'error'
	readonly body: DomainErrorStreamBody
}

export type DomainUsageStreamEvent = {
	readonly arm: 'usage'
	readonly body: DomainUsageStreamBody
}

export type DomainClientToolCallStreamEvent = {
	readonly arm: 'clientToolCall'
	readonly body: DomainClientToolCallStreamBody
}

export type DomainUnknownBlockStreamEvent = {
	readonly arm: 'unknownBlock'
	readonly body: DomainUnknownBlockStreamBody
}

export type DomainTimelineStreamEvent =
	| DomainTextStreamEvent
	| DomainToolStreamEvent
	| DomainReasoningStreamEvent
	| DomainPermissionStreamEvent
	| DomainErrorStreamEvent
	| DomainUsageStreamEvent
	| DomainClientToolCallStreamEvent
	| DomainUnknownBlockStreamEvent

export type DomainStreamEventFold =
	| { readonly kind: 'patches'; readonly patches: readonly ViewPatch[] }
	| { readonly kind: 'malformed'; readonly arm: DomainTimelineArm }
	| { readonly kind: 'unhandled' }

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.length > 0
}

/**
 * Own data property only (INV-SEV-OWN-1). Accessors return undefined without
 * invoking getters/setters. No nullish coalescing; no independent key-in checks.
 */
function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key)
	if (desc === undefined) return undefined
	if (desc.get !== undefined || desc.set !== undefined) return undefined
	if (!Object.hasOwn(desc, 'value')) return undefined
	return desc.value
}

/** INV-DBI-*: identity admission only (trim for check; never rewrite). */
function isSignificantIdentityString(value: unknown): value is string {
	return typeof value === 'string' && value.trim().length > 0
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value)
}

function timelineItemIdFromDomain(body: DomainBaseBody): TimelineItemId {
	const key =
		typeof body.operationId === 'string' && body.operationId.length > 0 ? body.operationId : body.id
	return key as TimelineItemId
}

function readOptionalPreview(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined
}

const PENDING_ACTION_AGENT_ID_MAX = 128

const PENDING_ACTION_AGENT_ID_STRINGIFY_GARBAGE = new Set([
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
function admitPendingActionAgentId(value: unknown): value is string {
	if (typeof value !== 'string') return false
	if (value.length === 0 || value.length > PENDING_ACTION_AGENT_ID_MAX) return false
	if (value !== value.trim()) return false
	if (hasControlChar(value)) return false
	return !PENDING_ACTION_AGENT_ID_STRINGIFY_GARBAGE.has(value)
}

function pendingAgentIdFromBody(body: {
	readonly agentId?: unknown
}): { readonly agentId: string } | Record<string, never> {
	const value = readOwnDataValue(body as object, 'agentId')
	return admitPendingActionAgentId(value) ? { agentId: value } : {}
}

function readOptionalStringField(
	record: object,
	key: string,
): { ok: true; value: string | undefined } | { ok: false } {
	if (!Object.hasOwn(record, key)) {
		return { ok: true, value: undefined }
	}
	const value = readOwnDataValue(record, key)
	if (value === undefined) return { ok: true, value: undefined }
	if (typeof value !== 'string') return { ok: false }
	return { ok: true, value }
}

function readOptionalFiniteNumber(
	record: object,
	key: string,
): { ok: true; value: number | undefined } | { ok: false } {
	if (!Object.hasOwn(record, key)) {
		return { ok: true, value: undefined }
	}
	const value = readOwnDataValue(record, key)
	if (value === undefined) return { ok: true, value: undefined }
	if (!isFiniteNumber(value)) return { ok: false }
	return { ok: true, value }
}

function readOptionalBooleanField(
	record: object,
	key: string,
): { ok: true; value: boolean | undefined } | { ok: false } {
	if (!Object.hasOwn(record, key)) {
		return { ok: true, value: undefined }
	}
	const value = readOwnDataValue(record, key)
	if (value === undefined) return { ok: true, value: undefined }
	if (typeof value !== 'boolean') return { ok: false }
	return { ok: true, value }
}

function readOptionalStringArrayField(
	record: object,
	key: string,
): { ok: true; value: readonly string[] | undefined } | { ok: false } {
	if (!Object.hasOwn(record, key)) {
		return { ok: true, value: undefined }
	}
	const value = readOwnDataValue(record, key)
	if (value === undefined) return { ok: true, value: undefined }
	if (!Array.isArray(value)) return { ok: false }
	if (!value.every((entry) => typeof entry === 'string')) return { ok: false }
	return { ok: true, value: value as readonly string[] }
}

/**
 * D9 (ADR-309): own-data optional canvasRefs — absent ⇒ omit; present-but-invalid
 * (non-array / bad entry) ⇒ malformed (fail-closed; 0× drop-on-floor wash).
 * Required canvasId/revisionId/title are non-empty strings; sourceHash optional
 * string; 0× trim-write / accessor.
 */
function readOptionalCanvasRefsField(
	record: object,
): { ok: true; value: readonly TimelineCanvasRef[] | undefined } | { ok: false } {
	if (!Object.hasOwn(record, 'canvasRefs')) {
		return { ok: true, value: undefined }
	}
	const value = readOwnDataValue(record, 'canvasRefs')
	if (value === undefined) return { ok: true, value: undefined }
	if (!Array.isArray(value)) return { ok: false }
	const parsed: TimelineCanvasRef[] = []
	for (const entry of value) {
		if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
			return { ok: false }
		}
		const entryRecord = entry as Record<string, unknown>
		const canvasId = readOwnDataValue(entryRecord, 'canvasId')
		const revisionId = readOwnDataValue(entryRecord, 'revisionId')
		const title = readOwnDataValue(entryRecord, 'title')
		const sourceHash = readOwnDataValue(entryRecord, 'sourceHash')
		if (!isNonEmptyString(canvasId)) return { ok: false }
		if (!isNonEmptyString(revisionId)) return { ok: false }
		if (!isNonEmptyString(title)) return { ok: false }
		if (sourceHash !== undefined && typeof sourceHash !== 'string') {
			return { ok: false }
		}
		parsed.push({
			canvasId,
			revisionId,
			title,
			...(sourceHash !== undefined ? { sourceHash } : {}),
		})
	}
	return { ok: true, value: parsed.length > 0 ? parsed : undefined }
}

/** INV-DBI-* required id/orderKey: own-data read only; missing / accessor → malformed. */
function readRequiredIdentityField(
	record: object,
	key: 'id' | 'orderKey',
): { ok: true; value: string } | { ok: false } {
	const value = readOwnDataValue(record, key)
	if (!isSignificantIdentityString(value)) return { ok: false }
	return { ok: true, value }
}

/** Required body string (e.g. title): own-data read only; missing / accessor / non-string → fail. */
function readRequiredBodyStringField(
	record: object,
	key: string,
): { ok: true; value: string } | { ok: false } {
	const value = readOwnDataValue(record, key)
	if (typeof value !== 'string') return { ok: false }
	return { ok: true, value }
}

/** Required non-empty body string (e.g. toolName, permissionKind): own-data read only. */
function readRequiredNonEmptyBodyStringField(
	record: object,
	key: string,
): { ok: true; value: string } | { ok: false } {
	const value = readOwnDataValue(record, key)
	if (!isNonEmptyString(value)) return { ok: false }
	return { ok: true, value }
}

/**
 * INV-DBI-3 optional operationId: own-data read only; absent / accessor → omit;
 * own-present but not significant → malformed.
 */
function readOptionalOperationIdField(
	record: object,
): { ok: true; value: string | undefined } | { ok: false } {
	if (!Object.hasOwn(record, 'operationId')) {
		return { ok: true, value: undefined }
	}
	const value = readOwnDataValue(record, 'operationId')
	if (value === undefined) return { ok: true, value: undefined }
	if (!isSignificantIdentityString(value)) return { ok: false }
	return { ok: true, value }
}

/**
 * Own-data optional turnId (fail-closed type; admit-only copy — never synthesize).
 * Absent / accessor / failed admit → omit; non-string when own-present → malformed.
 */
function readOptionalTurnIdField(
	record: object,
): { ok: true; value: string | undefined } | { ok: false } {
	if (!Object.hasOwn(record, 'turnId')) {
		return { ok: true, value: undefined }
	}
	const value = readOwnDataValue(record, 'turnId')
	if (value === undefined) return { ok: true, value: undefined }
	if (typeof value !== 'string') return { ok: false }
	return {
		ok: true,
		value: admitTimelineItemTurnId(value) ? value : undefined,
	}
}

function timelineTurnIdFields(
	turnId: string | undefined,
): { readonly turnId: string } | Record<string, never> {
	return turnId !== undefined ? { turnId } : {}
}

function readBaseFields(
	body: unknown,
): { ok: true; base: DomainBaseBody; record: Record<string, unknown> } | { ok: false } {
	if (typeof body !== 'object' || body === null) return { ok: false }
	const record = body as Record<string, unknown>
	const idField = readRequiredIdentityField(record, 'id')
	if (!idField.ok) return { ok: false }
	const orderKeyField = readRequiredIdentityField(record, 'orderKey')
	if (!orderKeyField.ok) return { ok: false }
	const operationIdField = readOptionalOperationIdField(record)
	if (!operationIdField.ok) return { ok: false }
	const turnIdField = readOptionalTurnIdField(record)
	if (!turnIdField.ok) return { ok: false }
	// INV-DBI-4: keep original strings (do not write trimmed values back).
	const base: DomainBaseBody = {
		id: idField.value,
		orderKey: orderKeyField.value,
		...(operationIdField.value !== undefined ? { operationId: operationIdField.value } : {}),
		...(turnIdField.value !== undefined ? { turnId: turnIdField.value } : {}),
	}
	return { ok: true, base, record }
}

function isDomainTimelineArm(arm: unknown): arm is DomainTimelineArm {
	return typeof arm === 'string' && (DOMAIN_TIMELINE_ARMS as readonly string[]).includes(arm)
}

export function isDomainTextStreamArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'text'
}

export function isDomainToolStreamArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'tool'
}

export function isDomainReasoningStreamArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'reasoning'
}

export function isDomainPermissionStreamArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'permission'
}

export function isDomainErrorStreamArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'error'
}

export function isDomainUsageStreamArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'usage'
}

export function isDomainClientToolCallStreamArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'clientToolCall'
}

export function isDomainUnknownBlockStreamArm(event: unknown): boolean {
	if (typeof event !== 'object' || event === null) return false
	return readOwnDataValue(event, 'arm') === 'unknownBlock'
}

export function isDomainTextStreamEvent(event: unknown): event is DomainTextStreamEvent {
	if (!isDomainTextStreamArm(event)) return false
	const parsed = readBaseFields(readOwnDataValue(event as object, 'body'))
	if (!parsed.ok) return false
	if (!readRequiredBodyStringField(parsed.record, 'title').ok) return false
	const preview = readOptionalStringField(parsed.record, 'preview')
	return preview.ok
}

export function isDomainToolStreamEvent(event: unknown): event is DomainToolStreamEvent {
	if (!isDomainToolStreamArm(event)) return false
	const parsed = readBaseFields(readOwnDataValue(event as object, 'body'))
	if (!parsed.ok) return false
	if (!readRequiredNonEmptyBodyStringField(parsed.record, 'toolName').ok) {
		return false
	}
	const title = readOptionalStringField(parsed.record, 'title')
	if (!title.ok) return false
	if (Object.hasOwn(parsed.record, 'status')) {
		const statusValue = readOwnDataValue(parsed.record, 'status')
		if (statusValue !== undefined) {
			if (typeof statusValue !== 'string' || !TOOL_STATUSES.has(statusValue as ToolSummaryStatus)) {
				return false
			}
		}
	}
	const argPreview = readOptionalStringField(parsed.record, 'argPreview')
	if (!argPreview.ok) return false
	const resultPreview = readOptionalStringField(parsed.record, 'resultPreview')
	if (!resultPreview.ok) return false
	const canvasRefs = readOptionalCanvasRefsField(parsed.record)
	if (!canvasRefs.ok) return false
	return true
}

export function isDomainReasoningStreamEvent(event: unknown): event is DomainReasoningStreamEvent {
	if (!isDomainReasoningStreamArm(event)) return false
	const parsed = readBaseFields(readOwnDataValue(event as object, 'body'))
	if (!parsed.ok) return false
	if (!readRequiredBodyStringField(parsed.record, 'title').ok) return false
	const collapsed = readOptionalStringField(parsed.record, 'collapsedPreview')
	if (!collapsed.ok) return false
	const streaming = readOptionalBooleanField(parsed.record, 'streaming')
	return streaming.ok
}

export function isDomainPermissionStreamEvent(
	event: unknown,
): event is DomainPermissionStreamEvent {
	if (!isDomainPermissionStreamArm(event)) return false
	const parsed = readBaseFields(readOwnDataValue(event as object, 'body'))
	if (!parsed.ok) return false
	if (!readRequiredBodyStringField(parsed.record, 'title').ok) return false
	if (!readRequiredNonEmptyBodyStringField(parsed.record, 'permissionKind').ok) {
		return false
	}
	const optionsPreview = readOptionalStringArrayField(parsed.record, 'optionsPreview')
	if (!optionsPreview.ok) return false
	const agentId = readOptionalStringField(parsed.record, 'agentId')
	return agentId.ok
}

export function isDomainErrorStreamEvent(event: unknown): event is DomainErrorStreamEvent {
	if (!isDomainErrorStreamArm(event)) return false
	const parsed = readBaseFields(readOwnDataValue(event as object, 'body'))
	if (!parsed.ok) return false
	if (!readRequiredBodyStringField(parsed.record, 'title').ok) return false
	const retryable = readOwnDataValue(parsed.record, 'retryable')
	if (typeof retryable !== 'boolean') return false
	const code = readOptionalStringField(parsed.record, 'code')
	return code.ok
}

export function isDomainUsageStreamEvent(event: unknown): event is DomainUsageStreamEvent {
	if (!isDomainUsageStreamArm(event)) return false
	const parsed = readBaseFields(readOwnDataValue(event as object, 'body'))
	if (!parsed.ok) return false
	if (!readRequiredBodyStringField(parsed.record, 'title').ok) return false
	const inputTokens = readOptionalFiniteNumber(parsed.record, 'inputTokens')
	const outputTokens = readOptionalFiniteNumber(parsed.record, 'outputTokens')
	const contextPct = readOptionalFiniteNumber(parsed.record, 'contextPct')
	return inputTokens.ok && outputTokens.ok && contextPct.ok
}

export function isDomainClientToolCallStreamEvent(
	event: unknown,
): event is DomainClientToolCallStreamEvent {
	if (!isDomainClientToolCallStreamArm(event)) return false
	const body = readOwnDataValue(event as object, 'body')
	if (typeof body !== 'object' || body === null) return false
	const record = body as Record<string, unknown>
	const callId = readOwnDataValue(record, 'callId')
	if (typeof callId !== 'string' || callId.length === 0 || callId !== callId.trim()) {
		return false
	}
	if (!readRequiredBodyStringField(record, 'toolName').ok) return false
	const argumentsJson = readOwnDataValue(record, 'argumentsJson')
	if (typeof argumentsJson !== 'string') return false
	const sessionId = readOwnDataValue(record, 'sessionId')
	if (sessionId !== undefined && typeof sessionId !== 'string') {
		return false
	}
	const agentId = readOwnDataValue(record, 'agentId')
	if (agentId !== undefined && typeof agentId !== 'string') {
		return false
	}
	return true
}

export function isDomainUnknownBlockStreamEvent(
	event: unknown,
): event is DomainUnknownBlockStreamEvent {
	if (!isDomainUnknownBlockStreamArm(event)) return false
	const parsed = readBaseFields(readOwnDataValue(event as object, 'body'))
	if (!parsed.ok) return false
	if (!readRequiredNonEmptyBodyStringField(parsed.record, 'typeName').ok) return false
	if (!readRequiredNonEmptyBodyStringField(parsed.record, 'rawContent').ok) return false
	return true
}

function textItemFromBody(
	body: DomainTextStreamBody,
	identity: DomainBaseBody,
	turnId: string | undefined,
): TimelineItemView | null {
	const record = body as object
	const titleField = readRequiredBodyStringField(record, 'title')
	if (!titleField.ok) return null
	const preview = readOptionalPreview(readOwnDataValue(record, 'preview'))
	return {
		id: timelineItemIdFromDomain(identity),
		orderKey: identity.orderKey,
		...timelineTurnIdFields(turnId),
		summary: preview
			? { kind: 'text', title: titleField.value, preview }
			: { kind: 'text', title: titleField.value },
	}
}

function toolItemFromBody(
	body: DomainToolStreamBody,
	identity: DomainBaseBody,
	turnId: string | undefined,
): TimelineItemView | null {
	const record = body as object
	const toolNameField = readRequiredNonEmptyBodyStringField(record, 'toolName')
	if (!toolNameField.ok) return null
	const ownTitle = readOptionalStringField(record, 'title')
	const title = ownTitle.ok && ownTitle.value !== undefined ? ownTitle.value : toolNameField.value
	let status: ToolSummaryStatus = 'completed'
	if (Object.hasOwn(record, 'status')) {
		const statusValue = readOwnDataValue(record, 'status')
		if (
			statusValue !== undefined &&
			typeof statusValue === 'string' &&
			TOOL_STATUSES.has(statusValue as ToolSummaryStatus)
		) {
			status = statusValue as ToolSummaryStatus
		}
	}
	const summary: Extract<TimelineItemSummary, { kind: 'tool' }> = {
		kind: 'tool',
		title,
		toolName: toolNameField.value,
		status,
	}
	const argPreview = readOptionalPreview(readOwnDataValue(record, 'argPreview'))
	const resultPreview = readOptionalPreview(readOwnDataValue(record, 'resultPreview'))
	const canvasRefs = readOptionalCanvasRefsField(record)
	const canvasRefsValue = canvasRefs.ok ? canvasRefs.value : undefined
	return {
		id: timelineItemIdFromDomain(identity),
		orderKey: identity.orderKey,
		...timelineTurnIdFields(turnId),
		summary: {
			...summary,
			...(argPreview !== undefined ? { argPreview } : {}),
			...(resultPreview !== undefined ? { resultPreview } : {}),
			...(canvasRefsValue !== undefined ? { canvasRefs: canvasRefsValue } : {}),
		},
	}
}

function reasoningItemFromBody(
	body: DomainReasoningStreamBody,
	identity: DomainBaseBody,
	turnId: string | undefined,
): TimelineItemView | null {
	const record = body as object
	const titleField = readRequiredBodyStringField(record, 'title')
	if (!titleField.ok) return null
	const collapsedPreview = readOptionalPreview(readOwnDataValue(record, 'collapsedPreview'))
	const streamingValue = readOwnDataValue(record, 'streaming')
	const summary: Extract<TimelineItemSummary, { kind: 'reasoning' }> = {
		kind: 'reasoning',
		title: titleField.value,
		...(collapsedPreview !== undefined ? { collapsedPreview } : {}),
		...(typeof streamingValue === 'boolean' ? { streaming: streamingValue } : {}),
	}
	return {
		id: timelineItemIdFromDomain(identity),
		orderKey: identity.orderKey,
		...timelineTurnIdFields(turnId),
		summary,
	}
}

function permissionItemFromBody(
	body: DomainPermissionStreamBody,
	identity: DomainBaseBody,
	turnId: string | undefined,
): TimelineItemView | null {
	const record = body as object
	const titleField = readRequiredBodyStringField(record, 'title')
	if (!titleField.ok) return null
	const permissionKindField = readRequiredNonEmptyBodyStringField(record, 'permissionKind')
	if (!permissionKindField.ok) return null
	const optionsPreview = readOptionalStringArrayField(record, 'optionsPreview')
	const optionsPreviewValue = optionsPreview.ok ? optionsPreview.value : undefined
	const summary: Extract<TimelineItemSummary, { kind: 'permission' }> = {
		kind: 'permission',
		title: titleField.value,
		permissionKind: permissionKindField.value,
		...(optionsPreviewValue !== undefined ? { optionsPreview: optionsPreviewValue } : {}),
	}
	return {
		id: timelineItemIdFromDomain(identity),
		orderKey: identity.orderKey,
		...timelineTurnIdFields(turnId),
		summary,
	}
}

function errorItemFromBody(
	body: DomainErrorStreamBody,
	identity: DomainBaseBody,
	turnId: string | undefined,
): TimelineItemView | null {
	const record = body as object
	const titleField = readRequiredBodyStringField(record, 'title')
	if (!titleField.ok) return null
	const code = readOptionalPreview(readOwnDataValue(record, 'code'))
	const retryable = readOwnDataValue(record, 'retryable')
	if (typeof retryable !== 'boolean') return null
	const summary: Extract<TimelineItemSummary, { kind: 'error' }> = {
		kind: 'error',
		title: titleField.value,
		retryable,
		...(code !== undefined ? { code } : {}),
	}
	return {
		id: timelineItemIdFromDomain(identity),
		orderKey: identity.orderKey,
		...timelineTurnIdFields(turnId),
		summary,
	}
}

function usageItemFromBody(
	body: DomainUsageStreamBody,
	identity: DomainBaseBody,
	turnId: string | undefined,
): TimelineItemView | null {
	const record = body as object
	const titleField = readRequiredBodyStringField(record, 'title')
	if (!titleField.ok) return null
	const inputTokens = readOwnDataValue(record, 'inputTokens')
	const outputTokens = readOwnDataValue(record, 'outputTokens')
	const contextPct = readOwnDataValue(record, 'contextPct')
	const summary: Extract<TimelineItemSummary, { kind: 'usage' }> = {
		kind: 'usage',
		title: titleField.value,
		...(isFiniteNumber(inputTokens) ? { inputTokens } : {}),
		...(isFiniteNumber(outputTokens) ? { outputTokens } : {}),
		...(isFiniteNumber(contextPct) ? { contextPct } : {}),
	}
	return {
		id: timelineItemIdFromDomain(identity),
		orderKey: identity.orderKey,
		...timelineTurnIdFields(turnId),
		summary,
	}
}

function patchesForItem(item: TimelineItemView): DomainStreamEventFold {
	return {
		kind: 'patches',
		patches: [{ op: 'upsertTimelineItem', item }],
	}
}

/**
 * R-SNAP-4 / INV-SPC-13: bounded raw content summary — ≤ max verbatim, beyond
 * that `slice(0, max-1) + '…'` (truncation marked, never washed away).
 */
export const UNKNOWN_BLOCK_RAW_PREVIEW_MAX = 8192

export function boundUnknownBlockRawPreview(rawContent: string): string {
	if (rawContent.length <= UNKNOWN_BLOCK_RAW_PREVIEW_MAX) return rawContent
	return `${rawContent.slice(0, Math.max(0, UNKNOWN_BLOCK_RAW_PREVIEW_MAX - 1))}…`
}

/**
 * R-SNAP-4 honest degradation emit: typeName + rawContent carried verbatim
 * (rawContent bounded); identity from admitted base only — never invented.
 */
function unknownBlockItemFromBody(
	body: DomainUnknownBlockStreamBody,
	identity: DomainBaseBody,
	turnId: string | undefined,
): TimelineItemView | null {
	const record = body as object
	const typeNameField = readRequiredNonEmptyBodyStringField(record, 'typeName')
	if (!typeNameField.ok) return null
	const rawContentField = readRequiredNonEmptyBodyStringField(record, 'rawContent')
	if (!rawContentField.ok) return null
	return {
		id: timelineItemIdFromDomain(identity),
		orderKey: identity.orderKey,
		...timelineTurnIdFields(turnId),
		summary: {
			kind: 'unknown',
			typeName: typeNameField.value,
			rawContent: boundUnknownBlockRawPreview(rawContentField.value),
		},
	}
}

function readEmitIdentityFromEvent(
	event: object,
): { ok: true; base: DomainBaseBody } | { ok: false } {
	const parsed = readBaseFields(readOwnDataValue(event, 'body'))
	if (!parsed.ok) return { ok: false }
	return { ok: true, base: parsed.base }
}

/**
 * Pure fold: recognised domain arms → patches; claimed but bad body → malformed;
 * anything else → unhandled (Actor counts unknown_arm).
 */
export function foldDomainStreamEvent(event: unknown): DomainStreamEventFold {
	if (typeof event !== 'object' || event === null) {
		return { kind: 'unhandled' }
	}
	const arm = readOwnDataValue(event, 'arm')
	if (!isDomainTimelineArm(arm)) {
		return { kind: 'unhandled' }
	}

	switch (arm) {
		case 'text':
			if (!isDomainTextStreamEvent(event)) {
				return { kind: 'malformed', arm }
			}
			{
				const body = readOwnDataValue(event as object, 'body')
				if (body === undefined) return { kind: 'malformed', arm }
				const identity = readEmitIdentityFromEvent(event as object)
				if (!identity.ok) return { kind: 'malformed', arm }
				const item = textItemFromBody(
					body as DomainTextStreamBody,
					identity.base,
					identity.base.turnId,
				)
				if (item === null) return { kind: 'malformed', arm }
				return patchesForItem(item)
			}
		case 'tool':
			if (!isDomainToolStreamEvent(event)) {
				return { kind: 'malformed', arm }
			}
			{
				const body = readOwnDataValue(event as object, 'body')
				if (body === undefined) return { kind: 'malformed', arm }
				const identity = readEmitIdentityFromEvent(event as object)
				if (!identity.ok) return { kind: 'malformed', arm }
				const item = toolItemFromBody(
					body as DomainToolStreamBody,
					identity.base,
					identity.base.turnId,
				)
				if (item === null) return { kind: 'malformed', arm }
				return patchesForItem(item)
			}
		case 'reasoning':
			if (!isDomainReasoningStreamEvent(event)) {
				return { kind: 'malformed', arm }
			}
			{
				const body = readOwnDataValue(event as object, 'body')
				if (body === undefined) return { kind: 'malformed', arm }
				const identity = readEmitIdentityFromEvent(event as object)
				if (!identity.ok) return { kind: 'malformed', arm }
				const item = reasoningItemFromBody(
					body as DomainReasoningStreamBody,
					identity.base,
					identity.base.turnId,
				)
				if (item === null) return { kind: 'malformed', arm }
				return patchesForItem(item)
			}
		case 'permission': {
			// ADR-017 knife 3: dual-write record (timeline) + pending CTA axis.
			// Stay in DOMAIN_TIMELINE_ARMS (record). CTA host = pending list only.
			if (!isDomainPermissionStreamEvent(event)) {
				return { kind: 'malformed', arm }
			}
			const body = readOwnDataValue(event as object, 'body')
			if (body === undefined) return { kind: 'malformed', arm }
			const identity = readEmitIdentityFromEvent(event as object)
			if (!identity.ok) return { kind: 'malformed', arm }
			const item = permissionItemFromBody(
				body as DomainPermissionStreamBody,
				identity.base,
				identity.base.turnId,
			)
			if (item === null) return { kind: 'malformed', arm }
			return {
				kind: 'patches',
				patches: [
					{ op: 'upsertTimelineItem', item },
					{
						op: 'upsertPendingAction',
						action: {
							requestId: item.id as unknown as ClientActionRequestId,
							summary: item.summary,
							...pendingAgentIdFromBody(body as object),
						},
					},
				],
			}
		}
		case 'error':
			if (!isDomainErrorStreamEvent(event)) {
				return { kind: 'malformed', arm }
			}
			{
				const body = readOwnDataValue(event as object, 'body')
				if (body === undefined) return { kind: 'malformed', arm }
				const identity = readEmitIdentityFromEvent(event as object)
				if (!identity.ok) return { kind: 'malformed', arm }
				const item = errorItemFromBody(
					body as DomainErrorStreamBody,
					identity.base,
					identity.base.turnId,
				)
				if (item === null) return { kind: 'malformed', arm }
				return patchesForItem(item)
			}
		case 'usage':
			if (!isDomainUsageStreamEvent(event)) {
				return { kind: 'malformed', arm }
			}
			{
				const body = readOwnDataValue(event as object, 'body')
				if (body === undefined) return { kind: 'malformed', arm }
				const identity = readEmitIdentityFromEvent(event as object)
				if (!identity.ok) return { kind: 'malformed', arm }
				const item = usageItemFromBody(
					body as DomainUsageStreamBody,
					identity.base,
					identity.base.turnId,
				)
				if (item === null) return { kind: 'malformed', arm }
				return patchesForItem(item)
			}
		case 'clientToolCall': {
			// ADR-017 knife 2: dual-write record (timeline) + pending CTA axis.
			// Stay in DOMAIN_TIMELINE_ARMS (record). Knife 3 removes timeline CTA.
			if (!isDomainClientToolCallStreamEvent(event)) {
				return { kind: 'malformed', arm }
			}
			const body = readOwnDataValue(event as object, 'body')
			if (body === undefined) return { kind: 'malformed', arm }
			const item = timelineItemFromClientToolCall(body as DomainClientToolCallStreamBody, {
				status: 'pending',
			})
			if (item === undefined) return { kind: 'malformed', arm }
			return {
				kind: 'patches',
				patches: [
					{ op: 'upsertTimelineItem', item },
					{
						op: 'upsertPendingAction',
						action: {
							requestId: item.id as unknown as ClientActionRequestId,
							summary: item.summary,
							...pendingAgentIdFromBody(body as object),
						},
					},
				],
			}
		}
		case 'unknownBlock':
			// R-SNAP-4: explicit honest degradation record — fail-closed explicitness,
			// not a drop-on-floor wash. Claimed-but-bad body/identity stays malformed
			// (counted, never placed on the narrative order without admitted identity).
			if (!isDomainUnknownBlockStreamEvent(event)) {
				return { kind: 'malformed', arm }
			}
			{
				const body = readOwnDataValue(event as object, 'body')
				if (body === undefined) return { kind: 'malformed', arm }
				const identity = readEmitIdentityFromEvent(event as object)
				if (!identity.ok) return { kind: 'malformed', arm }
				const item = unknownBlockItemFromBody(
					body as DomainUnknownBlockStreamBody,
					identity.base,
					identity.base.turnId,
				)
				if (item === null) return { kind: 'malformed', arm }
				return patchesForItem(item)
			}
	}
}

/** Convenience: patches or empty when unhandled/malformed. */
export function viewPatchesFromDomainStreamEvent(event: unknown): readonly ViewPatch[] {
	const fold = foldDomainStreamEvent(event)
	return fold.kind === 'patches' ? fold.patches : []
}
