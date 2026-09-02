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

export type ConversationTimelineEntryKind = StubTurnKind | 'system' | 'question' | 'error' | 'unknown' | 'reviewNav';

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
	/** Tool execution status for live process-fold chrome. */
	readonly toolStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
	readonly agentId?: string;
	/** `error` entries: engine-declared retryability; absent = not retryable. */
	readonly retryable?: boolean;
	/** `unknown` entries: verbatim upstream type name. */
	readonly typeName?: string;
	/** `reviewNav` entries: workspace file URIs (string form) opened via Sources Review. */
	readonly reviewNavPaths?: readonly string[];
	/** L1 turn id when the snapshot admits one; never inferred. */
	readonly turnId?: string;
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

/** Session-level sync chrome for SessionBar / Inbox. Never reuse Engine connection wording. */
export function formatSyncChromeLabel(sync: SyncChrome): string | undefined {
	switch (sync.kind) {
		case 'idle':
			return undefined;
		case 'syncing':
			return localize('conversationSessionView.syncSyncing', "Session syncing");
		case 'live':
			return localize('conversationSessionView.syncLive', "Session live");
		case 'degraded':
			return localize('conversationSessionView.syncDegraded', "Session degraded: {0}", sync.reason);
		case 'closed':
			return localize('conversationSessionView.syncClosed', "Session disconnected: {0}", sync.reason);
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
	const ordered: { readonly orderKey: string; readonly entry: ConversationTimelineEntry }[] = [];

	const sortedTimeline = snapshot.timeline.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
	for (const item of sortedTimeline) {
		const entry = timelineItemToEntry(item, attribution.get(String(item.id)), details, pendingIds);
		if (entry) {
			ordered.push({ orderKey: item.orderKey, entry });
		}
	}

	for (const send of snapshot.localPendingSends) {
		const id = `send:${String(send.operationId)}`;
		ordered.push({
			orderKey: send.summary.kind === 'text' ? 'zzzz-send' : 'zzzz-send',
			entry: {
				id,
				kind: 'user',
				text: send.summary.kind === 'text' ? send.summary.preview ?? send.summary.title : summaryTitle(send.summary),
				pending: true,
			},
		});
	}

	const sortedBlocks = snapshot.overlay.blocks.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
	for (const block of sortedBlocks) {
		const key = overlayAttributionKey(String(block.blockId));
		const attr = attribution.get(key);
		const text = block.chunks.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey)).map(chunk => chunk.text).join('');
		const kind: ConversationTimelineEntryKind = block.summary.kind === 'reasoning' ? 'thinking' : block.summary.kind === 'tool' ? 'tool' : 'assistant';
		ordered.push({
			orderKey: block.orderKey,
			entry: {
				id: key,
				kind,
				text: text.length > 0 ? text : summaryTitle(block.summary),
				streaming: true,
				...(block.summary.kind === 'tool' ? {
					toolName: block.summary.toolName,
					toolStatus: block.summary.status,
					...(block.summary.argPreview !== undefined ? { summary: block.summary.argPreview } : {}),
					...(block.summary.resultPreview !== undefined ? { payload: block.summary.resultPreview } : {}),
				} : {}),
				...(attr?.agentId !== undefined ? { agentId: attr.agentId } : {}),
			},
		});
	}

	ordered.sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
	return ordered.map(item => item.entry);
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
	const turn = item.turnId !== undefined ? { turnId: item.turnId } : {};
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
				...turn,
			};
		}
		case 'reasoning':
			return {
				id, kind: 'thinking', text: summary.title,
				...(summary.collapsedPreview !== undefined ? { payload: summary.collapsedPreview } : {}),
				...(summary.streaming ? { streaming: true } : {}),
				...agent,
				...turn,
			};
		case 'tool': {
			if (summary.toolName === VISUALIZE_TOOL_NAME) {
				const body = item.detail !== undefined ? details.get(String(item.detail)) : undefined;
				const visualize = body !== undefined ? parseVisualizeArgs(body) : undefined;
				if (visualize) {
					return { id, kind: 'visualization', text: '', visualize, ...agent, ...turn };
				}
			}
			return {
				id, kind: 'tool', text: summary.title, toolName: summary.toolName,
				...(summary.argPreview !== undefined ? { summary: summary.argPreview } : {}),
				...(summary.resultPreview !== undefined ? { payload: summary.resultPreview } : {}),
				...(summary.status === 'running' || summary.status === 'pending' ? { streaming: true, toolStatus: summary.status } : { toolStatus: summary.status }),
				...agent,
				...turn,
			};
		}
		case 'permission': {
			const status: ConfirmationStatus = pendingIds.has(id) ? 'pending' : summary.decision === 'allow' ? 'allowed' : summary.decision === 'deny' ? 'skipped' : 'pending';
			return { id, kind: 'confirmation', text: summary.title, status, ...agent, ...turn };
		}
		case 'question': {
			const options = [
				...(summary.optionsPreview ?? []),
				...(summary.items ?? []).flatMap(item => [item.title, ...(item.optionsPreview ?? [])]),
			].filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
			return {
				id, kind: 'question', text: summary.title,
				status: summary.answered ? 'allowed' : 'pending',
				...(options.length > 0 ? { payload: options.join(' · ') } : {}),
				...agent, ...turn,
			};
		}
		case 'error':
			return { id, kind: 'error', text: summary.title, retryable: summary.retryable, ...(summary.code !== undefined ? { summary: summary.code } : {}), ...agent, ...turn };
		case 'unknown':
			return { id, kind: 'unknown', text: summary.rawContent, typeName: summary.typeName, ...agent, ...turn };
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
			...(entry.turnId !== undefined ? { turnId: entry.turnId } : {}),
		});
	}
	return turns;
}

function isStubTurnKind(kind: ConversationTimelineEntryKind): kind is StubTurnKind {
	return kind === 'user' || kind === 'assistant' || kind === 'confirmation' || kind === 'thinking' || kind === 'tool' || kind === 'visualization';
}

function isHonestRowKind(kind: ConversationTimelineEntryKind): boolean {
	return kind === 'question' || kind === 'error' || kind === 'unknown' || kind === 'system' || kind === 'reviewNav';
}

/** Extra fields carried on renderable turns for honest row kinds (Q5). */
export interface ConversationHonestTurnFields {
	readonly retryable?: boolean;
	readonly typeName?: string;
	readonly agentId?: string;
}

export function getConversationHonestKind(turn: ConversationStubTurn): ConversationTimelineEntryKind {
	return turn.kind as ConversationTimelineEntryKind;
}

export function getConversationHonestFields(turn: ConversationStubTurn): ConversationHonestTurnFields {
	return turn as ConversationStubTurn & ConversationHonestTurnFields;
}

/** Readable name for a timeline / trajectory row (role, agent, status, summary). */
export function getConversationEntryAriaLabel(turn: ConversationStubTurn): string {
	const kind = getConversationHonestKind(turn);
	const fields = getConversationHonestFields(turn);
	const summary = turn.text.trim() || localize('conversationSessionView.emptySummary', "(empty)");
	const agent = fields.agentId && fields.agentId !== 'default'
		? localize('conversationSessionView.ariaAgent', ", Agent {0}", fields.agentId)
		: '';
	const streaming = turn.streaming
		? localize('conversationSessionView.ariaInProgress', ", in progress")
		: '';

	switch (kind) {
		case 'confirmation': {
			const status = turn.status === 'allowed'
				? localize('conversationSessionView.permissionAllowed', "allowed")
				: turn.status === 'skipped'
					? localize('conversationSessionView.permissionSkipped', "skipped")
					: localize('conversationSessionView.permissionPending', "pending");
			return localize('conversationSessionView.permissionAria', "Permission, {0}{1}{2}: {3}", status, agent, streaming, summary);
		}
		case 'question': {
			const status = turn.status === 'allowed'
				? localize('conversationSessionView.questionAnswered', "answered")
				: localize('conversationSessionView.questionPending', "pending");
			return localize('conversationSessionView.questionAria', "Question, {0}{1}{2}: {3}", status, agent, streaming, summary);
		}
		case 'error': {
			const retry = fields.retryable
				? localize('conversationSessionView.errorRetryable', "retryable")
				: localize('conversationSessionView.errorNotRetryable', "not retryable");
			return localize('conversationSessionView.errorAria', "Error, {0}{1}{2}: {3}", retry, agent, streaming, summary);
		}
		case 'unknown': {
			const typeName = fields.typeName || localize('conversationSessionView.unknownType', "unknown type");
			return localize('conversationSessionView.unknownAria', "Unknown content, {0}{1}{2}: {3}", typeName, agent, streaming, summary);
		}
		case 'visualization': {
			const title = turn.visualize?.title || summary;
			return localize('conversationSessionView.visualizeAria', "Visualization, {0}{1}{2}", title, agent, streaming);
		}
		case 'reviewNav':
			return localize('conversationSessionView.reviewNavAria', "Review, {0}{1}", summary, agent);
		case 'system':
			return localize('conversationSessionView.systemAria', "System{0}{1}: {2}", agent, streaming, summary);
		default:
			return localize(
				'conversationSessionView.turnAria',
				"{0}{1}{2}: {3}",
				kind === 'user'
					? localize('conversationSessionView.roleUser', "You")
					: kind === 'thinking'
						? localize('conversationSessionView.roleThinking', "Thinking")
						: kind === 'tool'
							? localize('conversationSessionView.roleTool', "Tool")
							: localize('conversationSessionView.roleAssistant', "Agent"),
				agent,
				streaming,
				summary,
			);
	}
}

/** Maps a product entry to a renderer turn; honest kinds stay distinct. */
export function entryToRenderableTurn(entry: ConversationTimelineEntry): ConversationStubTurn {
	const honest: ConversationHonestTurnFields = {
		...(entry.agentId !== undefined ? { agentId: entry.agentId } : {}),
		...(entry.retryable !== undefined ? { retryable: entry.retryable } : {}),
		...(entry.typeName !== undefined ? { typeName: entry.typeName } : {}),
	};

	if (entry.kind === 'reviewNav') {
		return {
			id: entry.id,
			kind: 'reviewNav',
			text: entry.text,
			reviewNavPaths: entry.reviewNavPaths,
			...honest,
		} as ConversationStubTurn;
	}
	if (isStubTurnKind(entry.kind) || isHonestRowKind(entry.kind)) {
		return {
			id: entry.id,
			kind: entry.kind as StubTurnKind,
			text: entry.text,
			...(entry.status !== undefined ? { status: entry.status } : {}),
			...(entry.stubEcho ? { stubEcho: true } : {}),
			...(entry.toolName !== undefined ? { toolName: entry.toolName } : {}),
			...(entry.summary !== undefined ? { summary: entry.summary } : {}),
			...(entry.payload !== undefined ? { payload: entry.payload } : {}),
			...(entry.visualize !== undefined ? { visualize: entry.visualize } : {}),
			...(entry.streaming ? { streaming: true } : {}),
			...(entry.toolStatus !== undefined ? { toolStatus: entry.toolStatus } : {}),
			...(entry.turnId !== undefined ? { turnId: entry.turnId } : {}),
			...honest,
		} as ConversationStubTurn;
	}
	return {
		id: entry.id,
		kind: 'assistant',
		text: entry.text,
		stubEcho: true,
		...honest,
	} as ConversationStubTurn;
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
