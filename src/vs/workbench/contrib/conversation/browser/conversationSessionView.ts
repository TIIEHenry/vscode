/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import {
	overlayAttributionKey,
	type AttributionPatch,
	type DetailPatch,
	type ConversationRespondFailure,
	type ItemAttribution,
} from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type {
	DetailRef,
	OverlayBlockView,
	PendingActionView,
	SessionId,
	SessionViewSnapshot,
	SyncChrome,
	TextChunkView,
	TimelineItemId,
	TimelineItemView,
	ViewPatch,
} from '../../../../platform/universeAgent/common/sessionView/index.js';
import { ConversationVisualizeArgs, parseVisualizeArgs } from '../common/conversationVisualize.js';
import { passesTrajectoryAgentFilter } from './conversationTrajectoryModel.js';
import { getConversationTurnAriaLabel } from './conversationAccessibility.js';
import { conversationTurnReadText } from './conversationUserRefs.js';
import { ConfirmationStatus, ConversationQuestionOptionItem, ConversationReadOnlyText, ConversationStubTurn, ConversationTurnKind, StubTurnKind } from './conversationStubModel.js';
import { sameString, structurallyEqual } from './conversationTimelineReconcile.js';
import { rewriteConversationStubTurnSessionLinks, type ConversationStubTurnCatalogLookup } from './rewriteConversationStubTurnSessionLinks.js';

/**
 * Product view model for the Conversation timeline
 * (dev/plans/conversation-stream-timeline.md §3.3).
 *
 * `projectSnapshotToEntries` is the single product projection over a session-core
 * `SessionViewSnapshot` plus the VS Code attribution / detail sidecars. It is a
 * product mapping (summary kind → entry kind, role join), NOT an event fold: the
 * renderer never sees engine events, seq numbers or runtime epochs.
 * Optional `catalogForSession` rewrites stub/fixture path-only session links onto
 * `conversation-chat:` when writing assistant `text` (D472). The turn adapter
 * must not rewrite.
 *
 * The stub fixture source produces the same snapshot shape via
 * `stubTurnsToSnapshot`, so the stub and the engine share one render path.
 */

export type ConversationTimelineEntryKind = ConversationTurnKind;
export type { ConversationQuestionOptionItem };

export interface ConversationTimelineEntry {
	readonly id: string;
	readonly kind: ConversationTimelineEntryKind;
	readonly text: string;
	/** Non-reasoning overlay: joined `:think:` chunks, kept out of `text` (D10). */
	readonly thinkingText?: string;
	readonly status?: ConfirmationStatus;
	/** Read-only text body. Not a turn kind. See {@link ConversationReadOnlyText}. */
	readonly readOnlyText?: ConversationReadOnlyText;
	readonly stubEcho?: boolean;
	readonly toolName?: string;
	readonly summary?: string;
	readonly payload?: string;
	/** Tool result metadata (diff card, filediff, etc.). */
	readonly metadata?: Record<string, unknown>;
	readonly visualize?: ConversationVisualizeArgs;
	/** Optimistic local send awaiting the durable L2 fact; only visible in the originating lease. */
	readonly pending?: boolean;
	/** Live overlay row (L3) still receiving deltas. Never set by the stub source. */
	readonly streaming?: boolean;
	/** Tool execution status for live process-fold chrome. */
	readonly toolStatus?: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
	/** Client-tool chrome only; copy of `summary.respondable === true`. */
	readonly respondable?: true;
	/** Still-pending respond whose uplink failed. The seat stays actionable. */
	readonly respondFailure?: ConversationRespondFailure;
	readonly agentId?: string;
	/** `error` entries: engine-declared retryability; absent = not retryable. */
	readonly retryable?: boolean;
	/** `unknown` entries: verbatim upstream type name. */
	readonly typeName?: string;
	/** `unknown` entries: bounded raw content (also mirrored on `text`). */
	readonly rawContent?: string;
	/** `reviewNav` entries: workspace file URIs (string form) opened via Sources Review. */
	readonly reviewNavPaths?: readonly string[];
	/** Ask-user items (verbatim `items[].id`); omitted when the snapshot has none. */
	readonly questionItems?: readonly ConversationQuestionOptionItem[];
	/** `true` only when the snapshot admits a submit-safe single-select answer map. */
	readonly answerKeysValid?: boolean;
	/** Parent questionId for `questionRespond`; not the compound display row id. */
	readonly questionRequestId?: string;
	/** L1 turn id when the snapshot admits one; never inferred. */
	readonly turnId?: string;
}

export interface ConversationSessionViewProjection {
	readonly snapshot: SessionViewSnapshot;
	readonly attribution: ReadonlyMap<string, ItemAttribution>;
	readonly details: ReadonlyMap<string, string>;
}

/**
 * Optional projection memo (plan §3.3). `linkCatalogVersion` is the assistant-text
 * cache input; bump it when the session-link catalog changes. Other fields are
 * internal and mutated by {@link projectSnapshotToEntries}.
 */
export interface ConversationProjectionCache {
	linkCatalogVersion: number;
}

export function createConversationProjectionCache(): ConversationProjectionCache {
	return { linkCatalogVersion: 0 };
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

/**
 * Wire `sessionClosed` / subscription phase reasons are opaque integers
 * (`String(enum)`). They are not prose and must not be painted.
 */
export function syncChromeDisplayReason(reason: string): string {
	const trimmed = reason.trim();
	return /^\d+$/.test(trimmed) ? '' : trimmed;
}

/** Session-level sync chrome for SessionBar / Inbox. Never reuse Engine connection wording. */
export function formatSyncChromeLabel(sync: SyncChrome): string | undefined {
	switch (sync.kind) {
		case 'idle':
			return localize('conversationSessionView.syncIdle', "Session not connected");
		case 'syncing':
			return localize('conversationSessionView.syncSyncing', "Session syncing");
		case 'live':
			return localize('conversationSessionView.syncLive', "Session live");
		case 'degraded': {
			const reason = syncChromeDisplayReason(sync.reason);
			return reason
				? localize('conversationSessionView.syncDegraded', "Session degraded: {0}", reason)
				: localize('conversationSessionView.syncDegradedNoReason', "Session degraded");
		}
		case 'closed': {
			const reason = syncChromeDisplayReason(sync.reason);
			return reason
				? localize('conversationSessionView.syncClosed', "Session disconnected: {0}", reason)
				: localize('conversationSessionView.syncClosedNoReason', "Session disconnected");
		}
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
						status: turn.toolStatus ?? 'completed',
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
			default:
				// Honest kinds (question / error / unknown / system) and reviewNav
				// are snapshot-projected, not stub-fixture sources.
				break;
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

/**
 * Row bands of §3.3: `localPendingSends` sit after the timeline and before the overlay. The three
 * sources mint `orderKey` independently, so the band orders across sources and `orderKey` only
 * ever orders within one — a row's band is never inferred by parsing its `orderKey`.
 * A question that exists only in `pendingActions` is appended at the end of the timeline band.
 * A permission that is only in `pendingActions` and already carries an `agentId` is appended the same way.
 * A respondable tool that is only in `pendingActions` is appended the same way; its id stays the requestId.
 */
const BAND_TIMELINE = 0;
const BAND_LOCAL_PENDING_SEND = 1;
const BAND_OVERLAY = 2;

/** Same agent predicate as the trajectory page. Absent means keep every row. */
export interface ConversationEntryProjectionOptions {
	readonly filterAgentId?: string;
}

export function projectSnapshotToEntries(
	snapshot: SessionViewSnapshot,
	attribution: ReadonlyMap<string, ItemAttribution>,
	details: ReadonlyMap<string, string>,
	catalogForSession?: ConversationStubTurnCatalogLookup,
	cache?: ConversationProjectionCache,
	respondFailures?: ReadonlyMap<string, ConversationRespondFailure>,
	options?: ConversationEntryProjectionOptions,
): ConversationTimelineEntry[] {
	const pendingIds = new Set<string>(snapshot.pendingActions.map(action => String(action.requestId)));
	// Sidecar attribution for a permission row often has no agentId. The same requestId on
	// pendingActions does. Borrow it before the existing agent filter, and do not invent a second row.
	const permissionAgentIdForRow = (rowId: string): string | undefined => {
		let bestRequestId: string | undefined;
		let bestAgentId: string | undefined;
		for (const action of snapshot.pendingActions) {
			if (action.summary.kind !== 'permission' || action.agentId === undefined) {
				continue;
			}
			const requestId = String(action.requestId);
			if (requestId.length === 0 || (rowId !== requestId && !rowId.startsWith(`${requestId}:`))) {
				continue;
			}
			if (
				bestRequestId === undefined
				|| requestId.length > bestRequestId.length
				|| (requestId.length === bestRequestId.length && requestId < bestRequestId)
			) {
				bestRequestId = requestId;
				bestAgentId = action.agentId;
			}
		}
		return bestAgentId;
	};
	// A client-tool sidecar is often `{ role: 'tool' }` with no agentId. The same
	// requestId on a tool pendingAction already has one (fold writes it; this
	// projection does not). Exact id only — a prefix row is a different call.
	// Borrow before the existing agent filter, and do not invent a second row.
	const toolAgentIdForExactRow = (rowId: string): string | undefined => {
		for (const action of snapshot.pendingActions) {
			if (action.summary.kind !== 'tool' || action.agentId === undefined || action.agentId.length === 0) {
				continue;
			}
			if (String(action.requestId) === rowId) {
				return action.agentId;
			}
		}
		return undefined;
	};
	const ordered: { readonly band: number; readonly orderKey: string; readonly entry: ConversationTimelineEntry }[] = [];
	const state = cache ? projectionStateFor(cache) : undefined;
	const linkCatalogVersion = cache?.linkCatalogVersion ?? 0;

	const sortedTimeline = sortedTimelineFor(snapshot.timeline, state);
	const seenTimelineIds = new Set<string>();
	for (const item of sortedTimeline) {
		const id = String(item.id);
		let attr = attribution.get(id);
		if (item.summary.kind === 'permission' && attr?.agentId === undefined) {
			const agentId = permissionAgentIdForRow(id);
			if (agentId !== undefined) {
				attr = { role: 'assistant', agentId };
			}
		}
		if (item.summary.kind === 'tool' && attr?.agentId === undefined) {
			const agentId = toolAgentIdForExactRow(id);
			if (agentId !== undefined) {
				attr = { ...(attr ?? { role: 'tool' }), agentId };
			}
		}
		if (!passesTrajectoryAgentFilter(attr, options?.filterAgentId)) {
			state?.slots.delete(id);
			continue;
		}
		const visualizeDetail = visualizeDetailFor(item, details);
		const permissionPending = pendingIds.has(id);
		const questionRequestId = item.summary.kind === 'question' ? resolveQuestionRequestId(id, pendingIds) : undefined;
		const respondError = respondFailures?.get(id)?.error
			?? (questionRequestId !== undefined ? respondFailures?.get(questionRequestId)?.error : undefined);
		// One timeline item. Usable text on the tool summary is drawn once, first,
		// then every tool name on this arm in order. A cache hit must emit that
		// whole group, or the next frame keeps only the first name.
		const slot = state?.slots.get(id);
		const emitTimeline = (entries: readonly ConversationTimelineEntry[]) => {
			state?.slots.set(id, {
				item,
				attr,
				visualizeDetail,
				permissionPending,
				respondError,
				questionRequestId,
				linkCatalogVersion,
				entries,
			});
			seenTimelineIds.add(id);
			for (const entry of entries) {
				ordered.push({ band: BAND_TIMELINE, orderKey: item.orderKey, entry });
			}
		};
		if (state && slot && timelineSlotMatches(slot, item, attr, visualizeDetail, permissionPending, respondError, questionRequestId, linkCatalogVersion)) {
			emitTimeline(slot.entries);
			continue;
		}
		const entries = timelineItemToEntries(item, attr, details, pendingIds, catalogForSession, respondFailures);
		if (entries.length === 0) {
			state?.slots.delete(id);
			continue;
		}
		emitTimeline(entries);
	}
	if (state) {
		for (const id of [...state.slots.keys()]) {
			if (!seenTimelineIds.has(id)) {
				state.slots.delete(id);
			}
		}
	}

	// Ask-user stays out of the timeline fold. Until a display row exists, the pending
	// summary is the seat: one entry, id = requestId, drawn by timelineItemToEntry.
	// A permission that is still only pending and already has an agentId uses that same seat.
	// A respondable tool that is still only pending uses that same seat; id stays requestId.
	// Questions and permissions are covered by the request id or a `${requestId}:` child.
	// A tool seat is skipped only when that exact id is already on the timeline.
	const pendingOnlySeats: ConversationTimelineEntry[] = [];
	for (const action of snapshot.pendingActions) {
		const summaryKind = action.summary.kind;
		const respondableTool = action.summary.kind === 'tool' && action.summary.respondable === true;
		if (summaryKind !== 'question' && summaryKind !== 'permission' && !respondableTool) {
			continue;
		}
		const requestId = String(action.requestId);
		if (respondableTool) {
			if (requestId.length === 0 || sortedTimeline.some(item => String(item.id) === requestId)) {
				continue;
			}
		} else if (timelineCoversQuestionRequest(sortedTimeline, requestId)) {
			continue;
		}
		if (summaryKind === 'permission' && action.agentId === undefined) {
			continue;
		}
		const attr: ItemAttribution = action.agentId !== undefined
			? { role: 'assistant', agentId: action.agentId }
			: { role: 'assistant' };
		if (!passesTrajectoryAgentFilter(attr, options?.filterAgentId)) {
			continue;
		}
		const entry = timelineItemToEntry(
			{
				id: requestId as TimelineItemId,
				orderKey: requestId,
				summary: action.summary,
			},
			attr,
			details,
			pendingIds,
			catalogForSession,
			respondFailures,
		);
		if (entry) {
			pendingOnlySeats.push(entry);
		}
	}

	for (const send of snapshot.localPendingSends) {
		if (!passesTrajectoryAgentFilter(pendingSendAgentAttribution(send), options?.filterAgentId)) {
			continue;
		}
		const id = `send:${String(send.operationId)}`;
		// PendingSendView has no orderKey; the snapshot array is the queue order, kept by the stable sort.
		ordered.push({
			band: BAND_LOCAL_PENDING_SEND,
			orderKey: '',
			entry: {
				id,
				kind: 'user',
				text: send.summary.kind === 'text' ? send.summary.preview ?? send.summary.title : summaryTitle(send.summary),
				pending: true,
			},
		});
	}

	const sortedBlocks = snapshot.overlay.blocks.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
	const seenOverlayIds = new Set<string>();
	for (const block of sortedBlocks) {
		const key = overlayAttributionKey(String(block.blockId));
		const attr = attribution.get(key);
		if (!passesTrajectoryAgentFilter(attr, options?.filterAgentId)) {
			state?.overlaySlots.delete(key);
			continue;
		}
		// §3.3: reasoning → thinking, tool summary → tool, text follows attribution.
		// A text overlay with no attribution is the neutral read-only row, same as a
		// text timeline row. The host writes `assistant` for live L3 blocks; this
		// projection does not guess it.
		// A tool summary keeps one snapshot block. Body chunks that are already there
		// stay an assistant row (same attribution, so a filtered page keeps them) and
		// the tool row uses the tool name. A cache hit must emit both, or the next
		// frame drops the body.
		const kind = overlayEntryKind(block.summary.kind, attr);
		const toolKeepsBody = block.summary.kind === 'tool' && overlayChunksHaveBody(block.chunks);
		const assistant = kind === 'assistant' || toolKeepsBody;
		const overlaySlot = state?.overlaySlots.get(key);
		const emitOverlay = (entries: readonly ConversationTimelineEntry[]) => {
			state?.overlaySlots.set(key, { block, chunks: block.chunks, attr, linkCatalogVersion, entries });
			seenOverlayIds.add(key);
			for (const entry of entries) {
				ordered.push({ band: BAND_OVERLAY, orderKey: block.orderKey, entry });
			}
		};
		if (state && overlaySlot && overlaySlotMatches(overlaySlot, block, attr, assistant, linkCatalogVersion)) {
			emitOverlay(overlaySlot.entries);
			continue;
		}
		const joined = joinOverlayChunks(block.chunks, block.summary.kind, state);
		emitOverlay(projectOverlayEntries(key, block, attr, joined, catalogForSession, toolKeepsBody));
	}
	if (state) {
		for (const id of [...state.overlaySlots.keys()]) {
			if (!seenOverlayIds.has(id)) {
				state.overlaySlots.delete(id);
			}
		}
	}

	ordered.sort((a, b) => a.band - b.band || compareOrderKeys(a.orderKey, b.orderKey));
	const entries = ordered.map(item => item.entry);
	if (pendingOnlySeats.length > 0) {
		const timelineEnd = ordered.findIndex(item => item.band !== BAND_TIMELINE);
		entries.splice(timelineEnd === -1 ? entries.length : timelineEnd, 0, ...pendingOnlySeats);
	}
	return entries;
}

function compareOrderKeys(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Display row for a pending ask: the request id itself, or a child row whose id
 * starts with `${requestId}:`. An empty request id is not a prefix of other rows.
 */
function timelineCoversQuestionRequest(timeline: readonly TimelineItemView[], requestId: string): boolean {
	if (requestId.length === 0) {
		return false;
	}
	const prefix = `${requestId}:`;
	for (const item of timeline) {
		const id = String(item.id);
		if (id === requestId || id.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

/**
 * Optimistic sends have no attribution sidecar. A stamped target is a user row
 * for that agent; an unstamped send is a user row with no agent id.
 */
function pendingSendAgentAttribution(send: SessionViewSnapshot['localPendingSends'][number]): ItemAttribution {
	const agentId = send.agentId;
	return typeof agentId === 'string' && agentId.length > 0
		? { role: 'user', agentId }
		: { role: 'user' };
}

/**
 * Overlay row kind (§3.3). Reasoning and tool summaries keep their kinds.
 * Text uses the attribution role the host wrote; a missing attribution is not
 * guessed as assistant.
 */
function overlayEntryKind(summaryKind: string, attr: ItemAttribution | undefined): ConversationTimelineEntryKind {
	if (summaryKind === 'reasoning') {
		return 'thinking';
	}
	if (summaryKind === 'tool') {
		return 'tool';
	}
	if (summaryKind !== 'text') {
		return 'assistant';
	}
	if (!attr || attr.role === 'tool') {
		return 'system';
	}
	if (attr.role === 'user') {
		return 'user';
	}
	if (attr.role === 'system') {
		return 'system';
	}
	return 'assistant';
}

/** Text overlay with no role, or an explicit tool role, is a read-only body — same as a text timeline row. */
function overlayReadOnlyText(summaryKind: string, attr: ItemAttribution | undefined): ConversationReadOnlyText | undefined {
	if (summaryKind !== 'text') {
		return undefined;
	}
	if (!attr) {
		return 'neutral';
	}
	if (attr.role === 'tool') {
		return 'context';
	}
	return undefined;
}

function summaryTitle(summary: TimelineItemView['summary']): string {
	return summary.kind === 'unknown' ? summary.typeName : summary.title;
}

interface TimelineCacheSlot {
	item: TimelineItemView;
	attr: ItemAttribution | undefined;
	visualizeDetail: string | undefined;
	permissionPending: boolean;
	respondError: string | undefined;
	questionRequestId: string | undefined;
	linkCatalogVersion: number;
	/** One row, or the body once plus every tool name on this arm. Reused together on a hit. */
	entries: readonly ConversationTimelineEntry[];
}

interface OverlayCacheSlot {
	block: OverlayBlockView;
	chunks: readonly TextChunkView[];
	attr: ItemAttribution | undefined;
	linkCatalogVersion: number;
	/** One tool row, or the assistant body plus that tool row. Reused together on a hit. */
	entries: readonly ConversationTimelineEntry[];
}

interface OverlayJoin {
	readonly summaryKind: string;
	readonly text: string;
	readonly thinkingText?: string;
}

interface ProjectionCacheState {
	slots: Map<string, TimelineCacheSlot>;
	overlaySlots: Map<string, OverlayCacheSlot>;
	timelineRef: readonly TimelineItemView[] | undefined;
	sortedTimeline: readonly TimelineItemView[] | undefined;
	readonly overlayJoins: WeakMap<readonly TextChunkView[], OverlayJoin>;
}

const projectionCacheState = new WeakMap<ConversationProjectionCache, ProjectionCacheState>();
const renderableTurnByEntry = new WeakMap<ConversationTimelineEntry, ConversationStubTurn>();

function projectionStateFor(cache: ConversationProjectionCache): ProjectionCacheState {
	let state = projectionCacheState.get(cache);
	if (!state) {
		state = {
			slots: new Map(),
			overlaySlots: new Map(),
			timelineRef: undefined,
			sortedTimeline: undefined,
			overlayJoins: new WeakMap(),
		};
		projectionCacheState.set(cache, state);
	}
	return state;
}

function sortedTimelineFor(timeline: readonly TimelineItemView[], state: ProjectionCacheState | undefined): readonly TimelineItemView[] {
	if (state && state.timelineRef === timeline && state.sortedTimeline) {
		return state.sortedTimeline;
	}
	const sorted = timeline.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
	if (state) {
		state.timelineRef = timeline;
		state.sortedTimeline = sorted;
	}
	return sorted;
}

function isThinkingChunk(chunk: TextChunkView): boolean {
	return String(chunk.chunkId).includes(':think:');
}

/** Non-thinking chunk text. Thinking stays on the tool row and is not body. */
function overlayChunksHaveBody(chunks: readonly TextChunkView[]): boolean {
	for (const chunk of chunks) {
		if (!isThinkingChunk(chunk) && chunk.text.length > 0) {
			return true;
		}
	}
	return false;
}

/**
 * Tool overlay with body chunks: one snapshot block, two rows.
 * The body keeps this block's agent id. The tool row does not reuse that body as its summary.
 */
function projectOverlayEntries(
	key: string,
	block: OverlayBlockView,
	attr: ItemAttribution | undefined,
	joined: OverlayJoin,
	catalogForSession: ConversationStubTurnCatalogLookup | undefined,
	toolKeepsBody: boolean,
): readonly ConversationTimelineEntry[] {
	const agent = attr?.agentId !== undefined ? { agentId: attr.agentId } : {};
	if (block.summary.kind === 'tool' && toolKeepsBody && joined.text.length > 0) {
		const toolText = block.summary.toolName.length > 0 ? block.summary.toolName : summaryTitle(block.summary);
		return [{
			id: `${key}:body`,
			kind: 'assistant',
			text: rewriteAssistantSessionLinks('assistant', joined.text, catalogForSession),
			streaming: true,
			...agent,
		}, {
			id: key,
			kind: 'tool',
			text: toolText,
			streaming: true,
			...(joined.thinkingText !== undefined ? { thinkingText: joined.thinkingText } : {}),
			toolName: block.summary.toolName,
			toolStatus: block.summary.status,
			...(block.summary.argPreview !== undefined ? { summary: block.summary.argPreview } : {}),
			...(block.summary.resultPreview !== undefined ? { payload: block.summary.resultPreview } : {}),
			...(block.summary.respondable === true ? { respondable: true as const } : {}),
			...agent,
		}];
	}
	const kind = overlayEntryKind(block.summary.kind, attr);
	const overlayText = joined.text.length > 0 ? joined.text : summaryTitle(block.summary);
	const readOnlyText = overlayReadOnlyText(block.summary.kind, attr);
	return [{
		id: key,
		kind,
		text: rewriteAssistantSessionLinks(kind, overlayText, catalogForSession),
		streaming: true,
		...(joined.thinkingText !== undefined ? { thinkingText: joined.thinkingText } : {}),
		...(readOnlyText !== undefined ? { readOnlyText } : {}),
		...(block.summary.kind === 'tool' ? {
			toolName: block.summary.toolName,
			toolStatus: block.summary.status,
			...(block.summary.argPreview !== undefined ? { summary: block.summary.argPreview } : {}),
			...(block.summary.resultPreview !== undefined ? { payload: block.summary.resultPreview } : {}),
			...(block.summary.respondable === true ? { respondable: true as const } : {}),
		} : {}),
		...agent,
	}];
}

/** D10: reasoning keeps only `:think:` chunks; every other summary keeps them out of `text`. */
function classifyOverlayChunks(chunks: readonly TextChunkView[], summaryKind: string): OverlayJoin {
	const sorted = chunks.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));
	if (summaryKind === 'reasoning') {
		const text = sorted.filter(isThinkingChunk).map(chunk => chunk.text).join('');
		return { summaryKind, text };
	}
	const body: string[] = [];
	const thinking: string[] = [];
	for (const chunk of sorted) {
		if (isThinkingChunk(chunk)) {
			if (chunk.text.length > 0) {
				thinking.push(chunk.text);
			}
		} else {
			body.push(chunk.text);
		}
	}
	return thinking.length > 0
		? { summaryKind, text: body.join(''), thinkingText: thinking.join('') }
		: { summaryKind, text: body.join('') };
}

function joinOverlayChunks(chunks: readonly TextChunkView[], summaryKind: string, state: ProjectionCacheState | undefined): OverlayJoin {
	if (state) {
		const cached = state.overlayJoins.get(chunks);
		if (cached && cached.summaryKind === summaryKind) {
			return cached;
		}
	}
	const computed = classifyOverlayChunks(chunks, summaryKind);
	state?.overlayJoins.set(chunks, computed);
	return computed;
}

function visualizeDetailFor(item: TimelineItemView, details: ReadonlyMap<string, string>): string | undefined {
	if (item.summary.kind !== 'tool' || item.summary.toolName !== VISUALIZE_TOOL_NAME || item.detail === undefined) {
		return undefined;
	}
	return details.get(String(item.detail));
}

function readsAssistantCatalog(item: TimelineItemView, attr: ItemAttribution | undefined): boolean {
	return item.summary.kind === 'text' && attr?.role === 'assistant';
}

/** Same envelope left usable text on the tool summary. Empty string is not a body. */
function timelineKeepsAssistantBody(item: TimelineItemView): boolean {
	return item.summary.kind === 'tool'
		&& typeof item.summary.assistantText === 'string'
		&& item.summary.assistantText.length > 0;
}

function timelineSlotMatches(
	slot: TimelineCacheSlot,
	item: TimelineItemView,
	attr: ItemAttribution | undefined,
	visualizeDetail: string | undefined,
	permissionPending: boolean,
	respondError: string | undefined,
	questionRequestId: string | undefined,
	linkCatalogVersion: number,
): boolean {
	const visualize = item.summary.kind === 'tool' && item.summary.toolName === VISUALIZE_TOOL_NAME;
	const permission = item.summary.kind === 'permission';
	const question = item.summary.kind === 'question';
	const assistant = readsAssistantCatalog(item, attr) || timelineKeepsAssistantBody(item);
	if (slot.item === item
		&& slot.attr === attr
		&& (!visualize || slot.visualizeDetail === visualizeDetail)
		&& (!permission || (slot.permissionPending === permissionPending && slot.respondError === respondError))
		&& (!question || (slot.questionRequestId === questionRequestId && slot.respondError === respondError))
		&& (!assistant || slot.linkCatalogVersion === linkCatalogVersion)) {
		return true;
	}
	if (!structurallyEqual(slot.item, item) || !structurallyEqual(slot.attr, attr)) {
		return false;
	}
	if (visualize && !sameOptionalString(slot.visualizeDetail, visualizeDetail)) {
		return false;
	}
	if (permission && (slot.permissionPending !== permissionPending || slot.respondError !== respondError)) {
		return false;
	}
	if (question && (slot.questionRequestId !== questionRequestId || slot.respondError !== respondError)) {
		return false;
	}
	if (assistant && slot.linkCatalogVersion !== linkCatalogVersion) {
		return false;
	}
	return true;
}

function sameOptionalString(a: string | undefined, b: string | undefined): boolean {
	if (a === undefined || b === undefined) {
		return a === b;
	}
	return sameString(a, b);
}

function overlaySlotMatches(
	slot: OverlayCacheSlot,
	block: OverlayBlockView,
	attr: ItemAttribution | undefined,
	assistant: boolean,
	linkCatalogVersion: number,
): boolean {
	const versionOk = !assistant || slot.linkCatalogVersion === linkCatalogVersion;
	if (slot.block === block && slot.chunks === block.chunks && slot.attr === attr && versionOk) {
		return true;
	}
	// Same block object short-circuits structural compare, so a replaced chunks array
	// has to be checked on its own. Equal chunk values still reuse the entry.
	if (slot.chunks !== block.chunks && !structurallyEqual(slot.chunks, block.chunks)) {
		return false;
	}
	if (slot.block !== block && !structurallyEqual(slot.block, block)) {
		return false;
	}
	if (slot.attr !== attr && !structurallyEqual(slot.attr, attr)) {
		return false;
	}
	return versionOk;
}

/**
 * Pending id for a question row. The display id itself when it is pending; otherwise the
 * longest pending id such that the display id starts with `${pendingId}:`. Equal lengths
 * break by code-unit order. No such prefix → undefined (do not slice at the first colon).
 */
function resolveQuestionRequestId(displayId: string, pendingIds: ReadonlySet<string>): string | undefined {
	if (pendingIds.has(displayId)) {
		return displayId;
	}
	let best: string | undefined;
	for (const pendingId of pendingIds) {
		if (pendingId.length === 0 || !displayId.startsWith(`${pendingId}:`)) {
			continue;
		}
		if (best === undefined || pendingId.length > best.length || (pendingId.length === best.length && pendingId < best)) {
			best = pendingId;
		}
	}
	return best;
}

function rewriteAssistantSessionLinks(
	kind: ConversationTimelineEntryKind,
	text: string,
	catalogForSession: ConversationStubTurnCatalogLookup | undefined,
): string {
	if (!catalogForSession || kind !== 'assistant' || text.length === 0) {
		return text;
	}
	return rewriteConversationStubTurnSessionLinks(text, catalogForSession);
}

function toolNamesOnArm(summary: TimelineItemView['summary']): readonly string[] {
	if (summary.kind !== 'tool') {
		return [];
	}
	const listed = summary.toolNames;
	if (listed !== undefined && listed.length > 1) {
		const usable: string[] = [];
		for (const name of listed) {
			if (name.length > 0) {
				usable.push(name);
			}
		}
		if (usable.length > 1) {
			return usable;
		}
	}
	return [summary.toolName];
}

function toolNameRow(entry: ConversationTimelineEntry, id: string, name: string, index: number): ConversationTimelineEntry {
	const text = name.length > 0 ? name : entry.text;
	if (index === 0) {
		return entry.kind === 'tool'
			? { ...entry, text, ...(name.length > 0 ? { toolName: name } : {}) }
			: entry;
	}
	return {
		id: `${id}:tool:${index}`,
		kind: 'tool',
		text,
		toolName: name,
		...(entry.toolStatus !== undefined ? { toolStatus: entry.toolStatus } : {}),
		...(entry.streaming === true ? { streaming: true as const } : {}),
		...(entry.respondable === true ? { respondable: true as const } : {}),
		...(entry.agentId !== undefined ? { agentId: entry.agentId } : {}),
		...(entry.turnId !== undefined ? { turnId: entry.turnId } : {}),
	};
}

/**
 * One timeline item. Usable text is drawn once, then each tool name on this arm
 * in order. Those rows keep this item's attribution.
 */
function timelineItemToEntries(
	item: TimelineItemView,
	attr: ItemAttribution | undefined,
	details: ReadonlyMap<string, string>,
	pendingIds: ReadonlySet<string>,
	catalogForSession: ConversationStubTurnCatalogLookup | undefined,
	respondFailures: ReadonlyMap<string, ConversationRespondFailure> | undefined,
): readonly ConversationTimelineEntry[] {
	const entry = timelineItemToEntry(item, attr, details, pendingIds, catalogForSession, respondFailures);
	if (!entry || item.summary.kind !== 'tool') {
		return entry ? [entry] : [];
	}
	const names = toolNamesOnArm(item.summary);
	const assistantText = item.summary.assistantText;
	const hasBody = typeof assistantText === 'string' && assistantText.length > 0;
	if (!hasBody && names.length <= 1) {
		return [entry];
	}
	const id = String(item.id);
	const rows: ConversationTimelineEntry[] = [];
	if (hasBody) {
		const agent = attr?.agentId !== undefined ? { agentId: attr.agentId } : {};
		const turn = item.turnId !== undefined ? { turnId: item.turnId } : {};
		rows.push({
			id: `${id}:body`,
			kind: 'assistant',
			text: rewriteAssistantSessionLinks('assistant', assistantText, catalogForSession),
			...agent,
			...turn,
		});
	}
	if (names.length <= 1) {
		const toolEntry = entry.kind === 'tool'
			? { ...entry, text: item.summary.toolName.length > 0 ? item.summary.toolName : entry.text }
			: entry;
		rows.push(toolEntry);
		return rows;
	}
	for (let index = 0; index < names.length; index++) {
		rows.push(toolNameRow(entry, id, names[index]!, index));
	}
	return rows;
}

function timelineItemToEntry(
	item: TimelineItemView,
	attr: ItemAttribution | undefined,
	details: ReadonlyMap<string, string>,
	pendingIds: ReadonlySet<string>,
	catalogForSession: ConversationStubTurnCatalogLookup | undefined,
	respondFailures: ReadonlyMap<string, ConversationRespondFailure> | undefined,
): ConversationTimelineEntry | undefined {
	const id = String(item.id);
	const summary = item.summary;
	const agent = attr?.agentId !== undefined ? { agentId: attr.agentId } : {};
	const turn = item.turnId !== undefined ? { turnId: item.turnId } : {};
	switch (summary.kind) {
		case 'text': {
			// Role comes only from attribution. tool and a missing attribution are read-only
			// rows (readOnlyText), never assistant and never a title guess.
			const text = summary.preview ?? summary.title;
			const streaming = summary.streaming ? { streaming: true as const } : {};
			if (!attr) {
				return { id, kind: 'system', readOnlyText: 'neutral', text, ...streaming, ...turn };
			}
			if (attr.role === 'tool') {
				return { id, kind: 'system', readOnlyText: 'context', text, ...streaming, ...agent, ...turn };
			}
			const kind: ConversationTimelineEntryKind = attr.role === 'user' ? 'user' : attr.role === 'system' ? 'system' : 'assistant';
			return {
				id, kind,
				text: rewriteAssistantSessionLinks(kind, text, catalogForSession),
				...(attr.stub && kind === 'assistant' ? { stubEcho: true } : {}),
				...streaming,
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
				const visualize = body !== undefined ? visualizeArgsFromDetailBody(body) : undefined;
				if (visualize) {
					return { id, kind: 'visualization', text: '', visualize, ...agent, ...turn };
				}
			}
			const metadata = attr?.metadata ?? (item as { metadata?: Record<string, unknown> }).metadata;
			return {
				id, kind: 'tool', text: summary.title, toolName: summary.toolName,
				...(summary.argPreview !== undefined ? { summary: summary.argPreview } : {}),
				...(summary.resultPreview !== undefined ? { payload: summary.resultPreview } : {}),
				...(summary.status === 'running' || summary.status === 'pending' ? { streaming: true, toolStatus: summary.status } : { toolStatus: summary.status }),
				...(summary.respondable === true ? { respondable: true as const } : {}),
				...(metadata !== undefined ? { metadata } : {}),
				...agent,
				...turn,
			};
		}
		case 'permission': {
			// An admitted decision closes the seat even if removePendingAction has not arrived yet.
			// Otherwise the Allow/Skip buttons stay up and the same request can be sent twice.
			const status: ConfirmationStatus = summary.decision === 'allow'
				? 'allowed'
				: summary.decision === 'deny'
					? 'skipped'
					: pendingIds.has(id)
						? 'pending'
						: 'undecided';
			const failure = status === 'pending' ? respondFailures?.get(id) : undefined;
			return {
				id, kind: 'confirmation', text: summary.title, status,
				...(failure ? { respondFailure: failure } : {}),
				...agent, ...turn,
			};
		}
		case 'question': {
			const askMultiSelect = summary.multiSelect === true;
			const askAllowCustom = summary.allowCustom === true;
			const questionItems = (summary.items ?? [])
				.filter(item => item.id.length > 0)
				.map(item => {
					const multiSelect = item.multiSelect === true || askMultiSelect;
					const allowCustom = item.allowCustom === true || askAllowCustom;
					return {
						id: item.id,
						title: item.title,
						options: item.optionsPreview ?? [],
						...(multiSelect ? { multiSelect: true as const } : {}),
						...(allowCustom ? { allowCustom: true as const } : {}),
					};
				});
			const options = [
				...(summary.optionsPreview ?? []),
				...questionItems.flatMap(item => item.options),
			].filter((value, index, all) => value.length > 0 && all.indexOf(value) === index);
			const answerKeysValid = summary.answerKeysValid === true
				&& questionItems.length > 0
				&& questionItems.every(item => item.options.length > 0 || item.allowCustom === true);
			const questionRequestId = resolveQuestionRequestId(id, pendingIds);
			// An admitted answer closes the seat even if removePendingAction has not arrived.
			// Gone from pendingActions and not answered is undecided: not Input needed, and
			// the timeline must not keep this row as a live confirmation seat.
			const questionStatus: ConfirmationStatus = summary.answered
				? 'allowed'
				: questionRequestId !== undefined
					? 'pending'
					: 'undecided';
			const resolvedQuestionFailure = questionStatus === 'pending'
				? respondFailures?.get(id) ?? (questionRequestId !== undefined ? respondFailures?.get(questionRequestId) : undefined)
				: undefined;
			return {
				id, kind: 'question', text: summary.title,
				status: questionStatus,
				...(resolvedQuestionFailure ? { respondFailure: resolvedQuestionFailure } : {}),
				...(options.length > 0 ? { payload: options.join(' · ') } : {}),
				...(questionItems.length > 0 ? { questionItems } : {}),
				...(answerKeysValid ? { answerKeysValid: true } : {}),
				...(questionRequestId !== undefined ? { questionRequestId } : {}),
				...agent, ...turn,
			};
		}
		case 'error':
			return { id, kind: 'error', text: summary.title, retryable: summary.retryable, ...(summary.code !== undefined ? { summary: summary.code } : {}), ...agent, ...turn };
		case 'unknown':
			return { id, kind: 'unknown', text: summary.rawContent, typeName: summary.typeName, rawContent: summary.rawContent, ...agent, ...turn };
		case 'usage':
		case 'generic':
			// usage feeds the context ring / trajectory, not the conversation page; generic must not be produced by a production fold.
			return undefined;
	}
}

/** Validated visualize args, or undefined so the row stays a tool. Undefined optionals are omitted so fixture JSON round-trips. */
function visualizeArgsFromDetailBody(body: string): ConversationVisualizeArgs | undefined {
	let parsed: unknown;
	try {
		parsed = JSON.parse(body);
	} catch {
		return undefined;
	}
	if (typeof parsed !== 'object' || parsed === null) {
		return undefined;
	}
	const result = parseVisualizeArgs(parsed);
	if (!result.ok) {
		return undefined;
	}
	return cloneDefinedVisualizeArgs(result.args);
}

function cloneDefinedVisualizeArgs(args: ConversationVisualizeArgs): ConversationVisualizeArgs {
	if (args.type === 'diagram') {
		return args.title === undefined
			? { type: 'diagram', mermaid: args.mermaid }
			: { type: 'diagram', title: args.title, mermaid: args.mermaid };
	}
	return {
		type: 'comparison',
		...(args.title !== undefined ? { title: args.title } : {}),
		options: args.options.map(option => ({
			name: option.name,
			...(option.description !== undefined ? { description: option.description } : {}),
			pros: option.pros,
			cons: option.cons,
			recommended: option.recommended,
			...(option.mermaid !== undefined ? { mermaid: option.mermaid } : {}),
		})),
	};
}

// ---- entries → legacy stub turns (S1–S3 shim; removed with the legacy methods) ---------------

export function entriesToLegacyTurns(entries: readonly ConversationTimelineEntry[]): ConversationStubTurn[] {
	const turns: ConversationStubTurn[] = [];
	for (const entry of entries) {
		// Optimistic sends and live overlay rows are not durable fixture turns.
		// A timeline tool can be `streaming` while it is pending or running; that status is durable.
		if (entry.pending || entry.id.startsWith('overlay:') || (entry.streaming && entry.toolStatus === undefined)) {
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
			...(entry.toolStatus !== undefined && entry.toolStatus !== 'completed' ? { toolStatus: entry.toolStatus } : {}),
			...(entry.visualize !== undefined ? { visualize: entry.visualize } : {}),
			...(entry.turnId !== undefined ? { turnId: entry.turnId } : {}),
		});
	}
	return turns;
}

function isStubTurnKind(kind: ConversationTimelineEntryKind): kind is StubTurnKind {
	return kind === 'user' || kind === 'assistant' || kind === 'confirmation' || kind === 'thinking' || kind === 'tool' || kind === 'visualization';
}

/** Extra fields carried on renderable turns for honest row kinds (Q5a). */
export interface ConversationHonestTurnFields {
	readonly retryable?: boolean;
	readonly typeName?: string;
	readonly rawContent?: string;
	readonly agentId?: string;
	readonly questionItems?: readonly ConversationQuestionOptionItem[];
	readonly answerKeysValid?: boolean;
	readonly questionRequestId?: string;
}

export function getConversationHonestKind(turn: ConversationStubTurn): ConversationTimelineEntryKind {
	return turn.kind;
}

export function getConversationHonestFields(turn: ConversationStubTurn): ConversationHonestTurnFields {
	return turn;
}

/** Readable name for a timeline / trajectory row (role, agent, status, summary). */
export function getConversationEntryAriaLabel(turn: ConversationStubTurn): string {
	const text = conversationTurnReadText(turn.kind, turn.text);
	return getConversationTurnAriaLabel(text === turn.text ? turn : { ...turn, text });
}

/**
 * Maps a product entry to a renderer turn.
 * Q5a: preserve kind and honest fields; never wash to assistant + stubEcho.
 */
export function entryToRenderableTurn(entry: ConversationTimelineEntry): ConversationStubTurn {
	return {
		id: entry.id,
		kind: entry.kind,
		text: entry.text,
		...(entry.thinkingText !== undefined ? { thinkingText: entry.thinkingText } : {}),
		...(entry.status !== undefined ? { status: entry.status } : {}),
		...(entry.readOnlyText !== undefined ? { readOnlyText: entry.readOnlyText } : {}),
		...(entry.stubEcho ? { stubEcho: true } : {}),
		...(entry.toolName !== undefined ? { toolName: entry.toolName } : {}),
		...(entry.summary !== undefined ? { summary: entry.summary } : {}),
		...(entry.payload !== undefined ? { payload: entry.payload } : {}),
		...(entry.metadata !== undefined ? { metadata: entry.metadata } : {}),
		...(entry.visualize !== undefined ? { visualize: entry.visualize } : {}),
		...(entry.streaming ? { streaming: true } : {}),
		...(entry.toolStatus !== undefined ? { toolStatus: entry.toolStatus } : {}),
		...(entry.respondable === true ? { respondable: true as const } : {}),
		...(entry.respondFailure !== undefined ? { respondFailure: entry.respondFailure } : {}),
		...(entry.turnId !== undefined ? { turnId: entry.turnId } : {}),
		...(entry.agentId !== undefined ? { agentId: entry.agentId } : {}),
		...(entry.retryable !== undefined ? { retryable: entry.retryable } : {}),
		...(entry.typeName !== undefined ? { typeName: entry.typeName } : {}),
		...(entry.rawContent !== undefined ? { rawContent: entry.rawContent } : {}),
		...(entry.questionItems !== undefined ? { questionItems: entry.questionItems } : {}),
		...(entry.answerKeysValid !== undefined ? { answerKeysValid: entry.answerKeysValid } : {}),
		...(entry.questionRequestId !== undefined ? { questionRequestId: entry.questionRequestId } : {}),
		...(entry.reviewNavPaths !== undefined ? { reviewNavPaths: entry.reviewNavPaths } : {}),
		...(entry.pending === true ? { pending: true as const } : {}),
	};
}

export function entriesToRenderableTurns(entries: readonly ConversationTimelineEntry[], cache?: ConversationProjectionCache): ConversationStubTurn[] {
	if (!cache) {
		return entries.map(entryToRenderableTurn);
	}
	const turns: ConversationStubTurn[] = [];
	for (const entry of entries) {
		let turn = renderableTurnByEntry.get(entry);
		if (!turn) {
			turn = entryToRenderableTurn(entry);
			renderableTurnByEntry.set(entry, turn);
		}
		turns.push(turn);
	}
	return turns;
}

export function stubTurnsToEntries(turns: readonly ConversationStubTurn[]): ConversationTimelineEntry[] {
	return turns.map(turn => ({
		id: turn.id,
		kind: turn.kind,
		text: turn.text,
		...(turn.thinkingText !== undefined ? { thinkingText: turn.thinkingText } : {}),
		...(turn.status !== undefined ? { status: turn.status } : {}),
		...(turn.readOnlyText !== undefined ? { readOnlyText: turn.readOnlyText } : {}),
		...(turn.stubEcho ? { stubEcho: true } : {}),
		...(turn.toolName !== undefined ? { toolName: turn.toolName } : {}),
		...(turn.summary !== undefined ? { summary: turn.summary } : {}),
		...(turn.payload !== undefined ? { payload: turn.payload } : {}),
		...(turn.metadata !== undefined ? { metadata: turn.metadata } : {}),
		...(turn.visualize !== undefined ? { visualize: turn.visualize } : {}),
		...(turn.agentId !== undefined ? { agentId: turn.agentId } : {}),
		...(turn.retryable !== undefined ? { retryable: turn.retryable } : {}),
		...(turn.typeName !== undefined ? { typeName: turn.typeName } : {}),
		...(turn.rawContent !== undefined ? { rawContent: turn.rawContent } : {}),
		...(turn.questionItems !== undefined ? { questionItems: turn.questionItems } : {}),
		...(turn.answerKeysValid !== undefined ? { answerKeysValid: turn.answerKeysValid } : {}),
		...(turn.questionRequestId !== undefined ? { questionRequestId: turn.questionRequestId } : {}),
		...(turn.reviewNavPaths !== undefined ? { reviewNavPaths: turn.reviewNavPaths } : {}),
		...(turn.streaming ? { streaming: true } : {}),
		...(turn.toolStatus !== undefined ? { toolStatus: turn.toolStatus } : {}),
		...(turn.respondable === true ? { respondable: true as const } : {}),
		...(turn.turnId !== undefined ? { turnId: turn.turnId } : {}),
		...(turn.pending === true ? { pending: true as const } : {}),
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
