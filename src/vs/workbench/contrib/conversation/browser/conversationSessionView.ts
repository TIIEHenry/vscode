/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import {
	overlayAttributionKey,
	type AttributionPatch,
	type DetailPatch,
	type ItemAttribution,
} from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type {
	DetailRef,
	PendingActionView,
	SessionId,
	SessionViewSnapshot,
	SyncChrome,
	TimelineItemId,
	TimelineItemView,
	ViewPatch,
} from '../../../../platform/universeAgent/common/sessionView/index.js';
import { ConversationVisualizeArgs } from '../common/conversationVisualize.js';
import { ConfirmationStatus, ConversationStubTurn, StubTurnKind } from './conversationStubModel.js';

/**
 * Product view model for the Conversation timeline
 * (dev/plans/conversation-stream-timeline.md §3.3).
 *
 * `projectSnapshotToEntries` is the single product projection over a session-core
 * `SessionViewSnapshot` plus the VS Code attribution / detail sidecars. It is a
 * product mapping (summary kind → entry kind, role join), NOT an event fold: the
 * renderer never sees engine events, seq numbers or runtime epochs.
 *
 * The stub fixture source produces the same snapshot shape via
 * `stubTurnsToSnapshot`, so the stub and the engine share one render path.
 */

export type ConversationTimelineEntryKind = StubTurnKind | 'system' | 'question' | 'error' | 'unknown';

export interface ConversationTimelineEntry {
	readonly id: string;
	readonly kind: ConversationTimelineEntryKind;
	readonly text: string;
	readonly status?: ConfirmationStatus;
	readonly stubEcho?: boolean;
	readonly toolName?: string;
	readonly summary?: string;
	readonly payload?: string;
	readonly visualize?: ConversationVisualizeArgs;
	/** Optimistic local send awaiting the durable L2 fact; only visible in the originating lease. */
	readonly pending?: boolean;
	/** Live overlay row (L3) still receiving deltas. Never set by the stub source. */
	readonly streaming?: boolean;
	readonly agentId?: string;
	/** `error` entries: engine-declared retryability; absent = not retryable. */
	readonly retryable?: boolean;
	/** `unknown` entries: verbatim upstream type name. */
	readonly typeName?: string;
}

export interface ConversationSessionViewProjection {
	readonly snapshot: SessionViewSnapshot;
	readonly attribution: ReadonlyMap<string, ItemAttribution>;
	readonly details: ReadonlyMap<string, string>;
}

const ORDER_KEY_WIDTH = 16;
const STUB_PERMISSION_KIND = 'stub';
const VISUALIZE_TOOL_NAME = 'visualize';

function orderKeyForIndex(index: number): string {
	return String(index).padStart(ORDER_KEY_WIDTH, '0');
}

function detailRefFor(turnId: string): DetailRef {
	return `detail:${turnId}` as DetailRef;
}

function roleTitle(role: ItemAttribution['role']): string {
	switch (role) {
		case 'user': return localize('conversationSessionView.roleUser', "You");
		case 'assistant': return localize('conversationSessionView.roleAssistant', "Agent");
		case 'system': return localize('conversationSessionView.roleSystem', "System");
		case 'tool': return localize('conversationSessionView.roleTool', "Tool");
	}
}

/** Session-level sync chrome label for SessionBar / Inbox (PRD-007). Only `live` may say “connected”. */
export function formatSyncChromeLabel(sync: SyncChrome): string | undefined {
	switch (sync.kind) {
		case 'idle':
			return undefined;
		case 'syncing':
			return localize('conversationSessionView.syncSyncing', "Syncing");
		case 'live':
			return localize('conversationSessionView.syncLive', "Connected");
		case 'degraded':
			return localize('conversationSessionView.syncDegraded', "Degraded: {0}", sync.reason);
		case 'closed':
			return localize('conversationSessionView.syncClosed', "Disconnected: {0}", sync.reason);
	}
}

// ---- stub fixture → snapshot ---------------------------------------------------------------

/**
 * Projects stub fixture turns into the session-core view contract. Role and the
 * Stub marker travel in the attribution sidecar (never in `TimelineItemSummary`);
 * full visualize arguments travel as a resolved detail body.
 */
export function stubTurnsToSnapshot(sessionId: string, turns: readonly ConversationStubTurn[]): ConversationSessionViewProjection {
	const timeline: TimelineItemView[] = [];
	const pendingActions: PendingActionView[] = [];
	const attribution = new Map<string, ItemAttribution>();
	const details = new Map<string, string>();

	turns.forEach((turn, index) => {
		const id = turn.id as TimelineItemId;
		const orderKey = orderKeyForIndex(index);
		switch (turn.kind) {
			case 'user': {
				timeline.push({ id, orderKey, summary: { kind: 'text', title: roleTitle('user'), preview: turn.text } });
				attribution.set(turn.id, { role: 'user' });
				break;
			}
			case 'assistant': {
				timeline.push({ id, orderKey, summary: { kind: 'text', title: roleTitle('assistant'), preview: turn.text } });
				attribution.set(turn.id, turn.stubEcho ? { role: 'assistant', stub: true } : { role: 'assistant' });
				break;
			}
			case 'thinking': {
				timeline.push({
					id, orderKey,
					summary: { kind: 'reasoning', title: turn.text, ...(turn.payload !== undefined ? { collapsedPreview: turn.payload } : {}) },
				});
				attribution.set(turn.id, { role: 'assistant', stub: true });
				break;
			}
			case 'tool': {
				timeline.push({
					id, orderKey,
					summary: {
						kind: 'tool',
						title: turn.text,
						toolName: turn.toolName ?? '',
						status: 'completed',
						...(turn.summary !== undefined ? { argPreview: turn.summary } : {}),
						...(turn.payload !== undefined ? { resultPreview: turn.payload } : {}),
					},
				});
				attribution.set(turn.id, { role: 'tool', stub: true });
				break;
			}
			case 'visualization': {
				const ref = detailRefFor(turn.id);
				timeline.push({
					id, orderKey,
					summary: { kind: 'tool', title: turn.visualize?.title ?? turn.text, toolName: VISUALIZE_TOOL_NAME, status: 'completed' },
					detail: ref,
				});
				if (turn.visualize) {
					details.set(ref, JSON.stringify(turn.visualize));
				}
				attribution.set(turn.id, { role: 'tool', stub: true });
				break;
			}
			case 'confirmation': {
				const decision = turn.status === 'allowed' ? 'allow' : turn.status === 'skipped' ? 'deny' : undefined;
				timeline.push({
					id, orderKey,
					summary: { kind: 'permission', title: turn.text, permissionKind: STUB_PERMISSION_KIND, ...(decision ? { decision } : {}) },
				});
				if (turn.status === 'pending') {
					pendingActions.push({
						requestId: turn.id as PendingActionView['requestId'],
						summary: { kind: 'permission', title: turn.text, permissionKind: STUB_PERMISSION_KIND },
					});
				}
				attribution.set(turn.id, { role: 'assistant', stub: true });
				break;
			}
		}
	});

	return {
		snapshot: {
			sessionId: sessionId as SessionId,
			sync: { kind: 'idle' },
			timeline,
			overlay: { blocks: [] },
			pendingActions,
			localPendingSends: [],
		},
		attribution,
		details,
	};
}

// ---- snapshot → product entries --------------------------------------------------------------

export function projectSnapshotToEntries(
	snapshot: SessionViewSnapshot,
	attribution: ReadonlyMap<string, ItemAttribution>,
	details: ReadonlyMap<string, string>,
): ConversationTimelineEntry[] {
	const pendingIds = new Set<string>(snapshot.pendingActions.map(action => String(action.requestId)));
	const entries: ConversationTimelineEntry[] = [];

	const sortedTimeline = snapshot.timeline.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
	for (const item of sortedTimeline) {
		const entry = timelineItemToEntry(item, attribution.get(String(item.id)), details, pendingIds);
		if (entry) {
			entries.push(entry);
		}
	}

	for (const send of snapshot.localPendingSends) {
		const id = `send:${String(send.operationId)}`;
		entries.push({
			id,
			kind: 'user',
			text: send.summary.kind === 'text' ? send.summary.preview ?? send.summary.title : summaryTitle(send.summary),
			pending: true,
		});
	}

	const sortedBlocks = snapshot.overlay.blocks.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
	for (const block of sortedBlocks) {
		const key = overlayAttributionKey(String(block.blockId));
		const attr = attribution.get(key);
		const text = block.chunks.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey)).map(chunk => chunk.text).join('');
		const kind: ConversationTimelineEntryKind = block.summary.kind === 'reasoning' ? 'thinking' : block.summary.kind === 'tool' ? 'tool' : 'assistant';
		entries.push({
			id: key,
			kind,
			text: text.length > 0 ? text : summaryTitle(block.summary),
			streaming: true,
			...(block.summary.kind === 'tool' ? { toolName: block.summary.toolName } : {}),
			...(attr?.agentId !== undefined ? { agentId: attr.agentId } : {}),
		});
	}

	return entries;
}

function compareOrderKeys(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function summaryTitle(summary: TimelineItemView['summary']): string {
	return summary.kind === 'unknown' ? summary.typeName : summary.title;
}

function timelineItemToEntry(
	item: TimelineItemView,
	attr: ItemAttribution | undefined,
	details: ReadonlyMap<string, string>,
	pendingIds: ReadonlySet<string>,
): ConversationTimelineEntry | undefined {
	const id = String(item.id);
	const summary = item.summary;
	const agent = attr?.agentId !== undefined ? { agentId: attr.agentId } : {};
	switch (summary.kind) {
		case 'text': {
			// Role comes only from attribution; a missing attribution renders a neutral row (plan §3.3), never a title guess.
			const kind: ConversationTimelineEntryKind = attr?.role === 'user' ? 'user' : attr?.role === 'system' ? 'system' : 'assistant';
			return {
				id, kind,
				text: summary.preview ?? summary.title,
				...(attr?.stub && kind === 'assistant' ? { stubEcho: true } : {}),
				...(summary.streaming ? { streaming: true } : {}),
				...agent,
			};
		}
		case 'reasoning':
			return {
				id, kind: 'thinking', text: summary.title,
				...(summary.collapsedPreview !== undefined ? { payload: summary.collapsedPreview } : {}),
				...(summary.streaming ? { streaming: true } : {}),
				...agent,
			};
		case 'tool': {
			if (summary.toolName === VISUALIZE_TOOL_NAME) {
				const body = item.detail !== undefined ? details.get(String(item.detail)) : undefined;
				const visualize = body !== undefined ? parseVisualizeArgs(body) : undefined;
				if (visualize) {
					return { id, kind: 'visualization', text: '', visualize, ...agent };
				}
			}
			return {
				id, kind: 'tool', text: summary.title, toolName: summary.toolName,
				...(summary.argPreview !== undefined ? { summary: summary.argPreview } : {}),
				...(summary.resultPreview !== undefined ? { payload: summary.resultPreview } : {}),
				...(summary.status === 'running' || summary.status === 'pending' ? { streaming: true } : {}),
				...agent,
			};
		}
		case 'permission': {
			const status: ConfirmationStatus = pendingIds.has(id) ? 'pending' : summary.decision === 'allow' ? 'allowed' : summary.decision === 'deny' ? 'skipped' : 'pending';
			return { id, kind: 'confirmation', text: summary.title, status, ...agent };
		}
		case 'question':
			return { id, kind: 'question', text: summary.title, status: summary.answered ? 'allowed' : 'pending', ...agent };
		case 'error':
			return { id, kind: 'error', text: summary.title, retryable: summary.retryable, ...(summary.code !== undefined ? { summary: summary.code } : {}), ...agent };
		case 'unknown':
			return { id, kind: 'unknown', text: summary.rawContent, typeName: summary.typeName, ...agent };
		case 'usage':
		case 'generic':
			// usage feeds the context ring / trajectory, not the conversation page; generic must not be produced by a production fold.
			return undefined;
	}
}

function parseVisualizeArgs(body: string): ConversationVisualizeArgs | undefined {
	try {
		const parsed: unknown = JSON.parse(body);
		if (typeof parsed === 'object' && parsed !== null && typeof (parsed as { type?: unknown }).type === 'string') {
			return parsed as ConversationVisualizeArgs;
		}
	} catch {
		// fall through: an unparsable body is rendered as a plain tool row, not invented
	}
	return undefined;
}

// ---- entries → legacy stub turns (S1–S3 shim; removed with the legacy methods) ---------------

export function entriesToLegacyTurns(entries: readonly ConversationTimelineEntry[]): ConversationStubTurn[] {
	const turns: ConversationStubTurn[] = [];
	for (const entry of entries) {
		if (entry.pending || entry.streaming) {
			continue;
		}
		if (!isStubTurnKind(entry.kind)) {
			continue;
		}
		turns.push({
			id: entry.id,
			kind: entry.kind,
			text: entry.text,
			...(entry.status !== undefined ? { status: entry.status } : {}),
			...(entry.stubEcho ? { stubEcho: true } : {}),
			...(entry.toolName !== undefined ? { toolName: entry.toolName } : {}),
			...(entry.summary !== undefined ? { summary: entry.summary } : {}),
			...(entry.payload !== undefined ? { payload: entry.payload } : {}),
			...(entry.visualize !== undefined ? { visualize: entry.visualize } : {}),
		});
	}
	return turns;
}

function isStubTurnKind(kind: ConversationTimelineEntryKind): kind is StubTurnKind {
	return kind === 'user' || kind === 'assistant' || kind === 'confirmation' || kind === 'thinking' || kind === 'tool' || kind === 'visualization';
}

/** Maps a product entry to a renderer turn; non-stub kinds degrade to assistant chrome. */
export function entryToRenderableTurn(entry: ConversationTimelineEntry): ConversationStubTurn {
	if (isStubTurnKind(entry.kind)) {
		return {
			id: entry.id,
			kind: entry.kind,
			text: entry.text,
			...(entry.status !== undefined ? { status: entry.status } : {}),
			...(entry.stubEcho ? { stubEcho: true } : {}),
			...(entry.toolName !== undefined ? { toolName: entry.toolName } : {}),
			...(entry.summary !== undefined ? { summary: entry.summary } : {}),
			...(entry.payload !== undefined ? { payload: entry.payload } : {}),
			...(entry.visualize !== undefined ? { visualize: entry.visualize } : {}),
		};
	}
	return {
		id: entry.id,
		kind: 'assistant',
		text: entry.text,
		stubEcho: true,
	};
}

export function entriesToRenderableTurns(entries: readonly ConversationTimelineEntry[]): ConversationStubTurn[] {
	return entries.map(entryToRenderableTurn);
}

export function stubTurnsToEntries(turns: readonly ConversationStubTurn[]): ConversationTimelineEntry[] {
	return turns.map(turn => ({
		id: turn.id,
		kind: turn.kind,
		text: turn.text,
		...(turn.status !== undefined ? { status: turn.status } : {}),
		...(turn.stubEcho ? { stubEcho: true } : {}),
		...(turn.toolName !== undefined ? { toolName: turn.toolName } : {}),
		...(turn.summary !== undefined ? { summary: turn.summary } : {}),
		...(turn.payload !== undefined ? { payload: turn.payload } : {}),
		...(turn.visualize !== undefined ? { visualize: turn.visualize } : {}),
	}));
}

// ---- snapshot diff (stub frame source → patches) --------------------------------------------

export interface ConversationSnapshotDiff {
	readonly patches: ViewPatch[];
	readonly attribution: AttributionPatch[];
	readonly details: DetailPatch[];
	readonly changedIds: Set<string>;
}

/**
 * Id-keyed diff between two projections. Produces idempotent session-core patches
 * (upsert / remove by stable id) so the replica path is exercised even without an
 * engine. Structural equality uses JSON serialisation — all view types are plain data.
 */
export function diffProjections(prev: ConversationSessionViewProjection, next: ConversationSessionViewProjection): ConversationSnapshotDiff {
	const patches: ViewPatch[] = [];
	const attribution: AttributionPatch[] = [];
	const details: DetailPatch[] = [];
	const changedIds = new Set<string>();

	const prevItems = new Map(prev.snapshot.timeline.map(item => [String(item.id), item] as const));
	for (const item of next.snapshot.timeline) {
		const key = String(item.id);
		const before = prevItems.get(key);
		if (!before || !sameData(before, item)) {
			patches.push({ op: 'upsertTimelineItem', item });
			changedIds.add(key);
		}
		prevItems.delete(key);
	}
	for (const [key, item] of prevItems) {
		patches.push({ op: 'removeTimelineItem', itemId: item.id });
		changedIds.add(key);
	}

	const prevPending = new Map(prev.snapshot.pendingActions.map(action => [String(action.requestId), action] as const));
	for (const action of next.snapshot.pendingActions) {
		const key = String(action.requestId);
		const before = prevPending.get(key);
		if (!before || !sameData(before, action)) {
			patches.push({ op: 'upsertPendingAction', action });
			changedIds.add(`pending:${key}`);
		}
		prevPending.delete(key);
	}
	for (const [key, action] of prevPending) {
		patches.push({ op: 'removePendingAction', requestId: action.requestId });
		changedIds.add(`pending:${key}`);
	}

	const prevSends = new Map(prev.snapshot.localPendingSends.map(send => [String(send.operationId), send] as const));
	for (const send of next.snapshot.localPendingSends) {
		const key = String(send.operationId);
		const before = prevSends.get(key);
		if (!before || !sameData(before, send)) {
			patches.push({ op: 'upsertLocalSend', send });
			changedIds.add(`send:${key}`);
		}
		prevSends.delete(key);
	}
	for (const [key, send] of prevSends) {
		patches.push({ op: 'removeLocalSend', operationId: send.operationId });
		changedIds.add(`send:${key}`);
	}

	if (!sameData(prev.snapshot.sync, next.snapshot.sync)) {
		patches.push({ op: 'setSyncChrome', sync: next.snapshot.sync });
		changedIds.add('sync');
	}

	for (const [key, attr] of next.attribution) {
		if (!sameData(prev.attribution.get(key), attr)) {
			attribution.push({ op: 'upsertAttribution', itemId: key, attribution: attr });
			changedIds.add(key);
		}
	}
	for (const key of prev.attribution.keys()) {
		if (!next.attribution.has(key)) {
			attribution.push({ op: 'removeAttribution', itemId: key });
			changedIds.add(key);
		}
	}

	for (const [ref, body] of next.details) {
		if (prev.details.get(ref) !== body) {
			details.push({ op: 'upsertDetail', ref, body });
		}
	}
	for (const ref of prev.details.keys()) {
		if (!next.details.has(ref)) {
			details.push({ op: 'removeDetail', ref });
		}
	}

	return { patches, attribution, details, changedIds };
}

function sameData(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
