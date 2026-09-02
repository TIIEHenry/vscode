/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { IDisposable } from '../../../base/common/lifecycle.js';
import type { SessionViewSnapshot, ViewEffect, ViewFrame } from './sessionView/index.js';

/**
 * Renderer-facing contract for one Conversation session view
 * (dev/plans/conversation-stream-timeline.md §3.2).
 *
 * The frame producer (stub fixture source today; the UniverseAgent host adapter
 * after M6-A) emits session-core `ViewFrame`s plus VS Code-owned sidecars. The
 * renderer only ever applies frames; it never folds engine events.
 */

export interface IConversationSessionViewLease extends IDisposable {
	readonly sessionId: string;
	/** Current replica snapshot; `emptySessionViewSnapshot` (sync `idle`) before the first baseline. */
	readonly snapshot: SessionViewSnapshot;
	readonly attribution: ReadonlyMap<string, ItemAttribution>;
	/** Resolved `DetailRef` bodies; absent ref = not fetched yet (render the bounded preview, never invent). */
	readonly details: ReadonlyMap<string, string>;
	readonly onDidApplyFrame: Event<ConversationViewFrameApplied>;
	/** `accepted` ≠ delivered to the engine (Desktop ADR-012 INV-CHAT-3). */
	post(msg: ConversationWriteMessage): PostOutcome;
	requestResync(): void;
	/**
	 * P2a DetailRef channel. Engine / Web leases implement this; stub frame source
	 * waits for Conversation Q2 接通 (do not add a local stub here).
	 */
	requestDetail?(ref: string): Promise<DetailFetchOutcome>;
}

/** Lease / IPC outcome for `requestDetail` (M7 P2a). */
export type DetailFetchOutcome =
	| { readonly ok: true; readonly truncated: boolean; readonly totalBytes?: number; readonly content?: string }
	| { readonly ok: false; readonly reason: 'unavailable' | 'failed'; readonly message?: string };

/** Wire fields for `AgentService.FetchToolDetail.detail_kind` (UniverseAgent ToolDetailKind). */
export const ToolDetailKind = {
	TOOL_DETAIL: 1,
	ARTIFACT: 2,
	TRANSCRIPT: 3,
	TERMINAL_BUFFER: 4,
	DIFF: 5,
	BROWSER_STATE: 6,
	SHELL_SESSION_BUFFER: 7,
} as const;

/** Parsed `DetailRef` → FetchToolDetail identity (session-core encoding). */
export interface ParsedDetailRef {
	readonly toolCallId: string;
	readonly detailKind: number;
	readonly refId: string;
}

/**
 * Encode a session-core `DetailRef` as JSON
 * `{ toolCallId, detailKind, refId }`. Host parses this to call FetchToolDetail.
 */
export function encodeDetailRef(parts: ParsedDetailRef): string {
	return JSON.stringify({
		toolCallId: parts.toolCallId,
		detailKind: parts.detailKind,
		refId: parts.refId,
	});
}

/** Parse {@link encodeDetailRef} JSON, or compact `{ tc, k, r }`. */
export function parseDetailRef(ref: string): ParsedDetailRef | undefined {
	if (!ref) {
		return undefined;
	}
	try {
		const value = JSON.parse(ref) as Record<string, unknown>;
		if (value === null || typeof value !== 'object' || Array.isArray(value)) {
			return undefined;
		}
		const toolCallId = readStringField(value, 'toolCallId', 'tc');
		const refId = readStringField(value, 'refId', 'r');
		const detailKind = readNumberField(value, 'detailKind', 'k');
		if (!toolCallId || !refId || detailKind === undefined) {
			return undefined;
		}
		return { toolCallId, detailKind, refId };
	} catch {
		return undefined;
	}
}

function readStringField(record: Record<string, unknown>, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'string' && value) {
			return value;
		}
	}
	return undefined;
}

function readNumberField(record: Record<string, unknown>, ...keys: string[]): number | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
	}
	return undefined;
}

/**
 * Who authored a timeline item. session-core's `TimelineItemSummary` deliberately
 * omits role (Desktop S0 audit); the producer fills this from the envelope `role` /
 * `agent_id` / `agent_path` (engine) or from the fixture `kind` (stub). Never
 * inferred from a title string.
 */
export interface ItemAttribution {
	readonly role: 'user' | 'assistant' | 'system' | 'tool';
	readonly agentId?: string;
	readonly agentPath?: readonly string[];
	/** Join table correlation for revealItem (m6 §11). */
	readonly toolCallId?: string;
	/** Nested tool parent when the envelope / lifecycle names one. */
	readonly parentToolCallId?: string;
	/**
	 * Envelope `branch_reason` when demuxed from the protocol.
	 * Compact / compaction wire tokens are normalized to `'compact'` — never inferred
	 * from titles or L3. Path-2 `EnvelopeRangeReplaced(reason=COMPACT)` also writes this.
	 */
	readonly branchReason?: string;
	/**
	 * P2b compacted span (closed three turn ids + optional SummaryBlock text).
	 * Produced only by the node host from L2 `CompactedSpanBlock` / `SummaryBlock`.
	 * Browser stubs never emit this.
	 */
	readonly compacted?: ItemCompactedAttribution;
	/** Set only by the stub fixture source; keeps PRD-003.3 "Stub" chrome without reading titles. */
	readonly stub?: true;
}

/**
 * L2 compacted span projected onto a timeline item (M7 P2b).
 * Three turn ids are a closed set — do not invent a fourth.
 */
export interface ItemCompactedAttribution {
	readonly anchorTurnId: string;
	readonly foldedLeafTurnId: string;
	readonly compactBranchTurnId: string;
	readonly summary?: string;
}

export type AttributionPatch =
	| { readonly op: 'upsertAttribution'; readonly itemId: string; readonly attribution: ItemAttribution }
	| { readonly op: 'removeAttribution'; readonly itemId: string };

/** Key of an overlay block in the attribution map (timeline items use their `TimelineItemId` verbatim). */
export function overlayAttributionKey(blockId: string): string {
	return `overlay:${blockId}`;
}

/**
 * Out-of-band bodies for `TimelineItemView.detail` handles (INV-SPC-13 keeps
 * bodies out of summaries). The stub source resolves every handle locally; the
 * engine adapter fills them via the DetailRef channel (M7 P2a `requestDetail`).
 */
export type DetailPatch =
	| { readonly op: 'upsertDetail'; readonly ref: string; readonly body: string; readonly truncated?: boolean; readonly totalBytes?: number }
	| { readonly op: 'removeDetail'; readonly ref: string };

export interface ConversationViewFrame {
	/** session-core frame, applied verbatim through `applyViewFrame`. */
	readonly frame: ViewFrame;
	/** Same-frame attribution patches keyed by the ids the frame touches. A baseline frame carries the full map. */
	readonly attribution?: readonly AttributionPatch[];
	/** Same-frame detail bodies. A baseline frame carries the full map. */
	readonly details?: readonly DetailPatch[];
}

export type ConversationViewFrameApplied =
	| { readonly kind: 'baseline' }
	| {
		readonly kind: 'patches';
		/** `TimelineItemId` | `overlay:${blockId}` | `pending:${requestId}` | `send:${operationId}` | `sync` */
		readonly changedIds: ReadonlySet<string>;
	}
	| { readonly kind: 'effects'; readonly effects: readonly ViewEffect[] };

/** Host `questionRespond` answers: one `selectedLabels[]` per item id, plus optional `customText`. */
export type ConversationQuestionRespondAnswers = Readonly<Record<string, { readonly selectedLabels: readonly string[] }>>;

/** Write messages accepted by a lease. The Actor allocates message / operation / lease ids (Desktop ADR-012 §6.1). */
export type ConversationWriteMessage =
	| { readonly kind: 'submitInput'; readonly text: string }
	| { readonly kind: 'permissionRespond'; readonly requestId: string; readonly decision: 'allow' | 'deny' }
	| { readonly kind: 'questionRespond'; readonly requestId: string; readonly answers: ConversationQuestionRespondAnswers; readonly customText?: string }
	| { readonly kind: 'clientToolRespond'; readonly requestId: string; readonly resultJson: string };
// S1–S3 only use submitInput / permissionRespond; S5 must map every arm against the full
// ChatRequest.payload oneof (question_response, …) and unary PermissionService.Respond.

/** Mirrors session-core `PostOutcome` (node layer) so the renderer never imports the Actor tree. */
export type PostOutcome =
	| { readonly accepted: true; readonly correlation: { readonly id: string } }
	| {
		readonly accepted: false;
		readonly reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated';
	};

/** Producer side of a lease: what a frame source must implement to back `acquireSessionView`. */
export interface IConversationViewFrameSource {
	acquire(sessionId: string): IConversationSessionViewLease;
}
