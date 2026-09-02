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
	 * `compact` / `compaction` marks a compacted trajectory row — never inferred.
	 */
	readonly branchReason?: string;
	/** Set only by the stub fixture source; keeps PRD-003.3 "Stub" chrome without reading titles. */
	readonly stub?: true;
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
 * engine adapter fills them via the DetailRef channel (plan §6 G3, slice S6).
 */
export type DetailPatch =
	| { readonly op: 'upsertDetail'; readonly ref: string; readonly body: string }
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

/** Write messages accepted by a lease. The Actor allocates message / operation / lease ids (Desktop ADR-012 §6.1). */
export type ConversationWriteMessage =
	| { readonly kind: 'submitInput'; readonly text: string }
	| { readonly kind: 'permissionRespond'; readonly requestId: string; readonly decision: 'allow' | 'deny' }
	| { readonly kind: 'questionRespond'; readonly requestId: string; readonly answers: Readonly<Record<string, string>> }
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
