/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { ItemAttribution } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { BranchTopologyNoticeView, SessionViewSnapshot, TimelineItemView } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { projectTrajectoryProcessFoldSpans, TrajectoryProcessFoldSpan } from './conversationProcessFoldModel.js';
import { ConversationStubTurn } from './conversationStubModel.js';

/** PRD-020 / PRD-012 T5: trajectory record display cap (honest notice when exceeded). */
export const CONVERSATION_TRAJECTORY_RECORD_LIMIT = 5000;

/** Stub seed ids that may receive trajectory fixture extras when no engine is connected. */
export const STUB_TRAJECTORY_FIXTURE_SESSION_IDS = new Set(['untitled', 'visualize', 'tour', 'blank']);

/** Extended attribution fields used by engine demux for tool-tree projection (M6-D / stream-timeline S6). */
interface TrajectoryItemAttribution extends ItemAttribution {
	readonly parentToolCallId?: string;
}

/** Protocol `branch_reason` / topology notice values that mark a compacted row. */
export function isProtocolCompactMark(value: string | undefined): boolean {
	if (!value) {
		return false;
	}
	const normalized = value.trim().toLowerCase();
	return normalized === 'compact' || normalized === 'compaction' || normalized === 'compacted';
}

export interface TrajectoryProjectionOptions {
	/** When set, keep user rows and items attributed to this agent (PRD-016 sub-agent lens). */
	readonly filterAgentId?: string;
}

export type ConversationTrajectoryKind =
	| 'system'
	| 'user'
	| 'context'
	| 'compacted'
	| 'message'
	| 'tool'
	| 'subtool'
	| 'thinking'
	| 'permission'
	| 'question'
	| 'error'
	| 'unknown';

export interface ConversationTrajectoryBlock {
	readonly type: string;
	readonly content: string;
	readonly toolName?: string;
}

export interface ConversationTrajectoryRecord {
	readonly id: string;
	readonly kind: ConversationTrajectoryKind;
	readonly text: string;
	readonly sourceBlocks?: readonly ConversationTrajectoryBlock[];
	readonly messageSource?: { readonly kind: string; readonly label?: string };
	readonly environment?: { readonly cwd?: string; readonly os?: string; readonly extra?: string };
	readonly promptDetail?: string;
	readonly inputDetail?: string;
	readonly outputDetail?: string;
	readonly result?: string;
	readonly opensTurn?: boolean;
	readonly callId?: string;
	readonly parentCallId?: string;
	readonly depth?: number;
	/** Opaque DetailRef handle when upstream provides one (body fetched out-of-band). */
	readonly detailRef?: string;
	/** Compaction metadata (demux from branch_reason / topology notice). */
	readonly compactedRange?: string;
	readonly compactedReason?: string;
	readonly compactedSummary?: string;
}

/** Stub fixture copy surfaced only on the trajectory lens (PRD-012). */
export const CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT = 'Stub environment';
export const CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT = 'Stub: workspace context';
export const CONVERSATION_TRAJECTORY_STUB_SOURCE_BLOCK_CONTENT = 'Stub: README.md';
export const CONVERSATION_TRAJECTORY_STUB_SUBTOOL_TEXT = 'Stub: nested dispatch';

/**
 * Projects admitted stub turns into trajectory records. Confirmation turns are omitted.
 */
export function projectTurnsToTrajectory(turns: readonly ConversationStubTurn[]): ConversationTrajectoryRecord[] {
	const records: ConversationTrajectoryRecord[] = [];

	for (const turn of turns) {
		switch (turn.kind) {
			case 'user':
				records.push({
					id: turn.id,
					kind: 'user',
					text: turn.text,
					opensTurn: true,
				});
				break;
			case 'assistant':
				records.push({
					id: turn.id,
					kind: 'message',
					text: turn.text,
				});
				break;
			case 'confirmation':
				break;
			case 'thinking':
				records.push({
					id: turn.id,
					kind: 'thinking',
					text: turn.text,
				});
				break;
			case 'tool':
				records.push({
					id: turn.id,
					kind: 'tool',
					text: turn.text,
					callId: turn.id,
					depth: 0,
				});
				break;
			case 'visualization':
				break;
		}
	}

	return records;
}

/**
 * Projects a session-core snapshot into trajectory records (stream-timeline S6 / trajectory T4).
 * Uses bounded summary previews only — never treats DetailRef bodies as authoritative (plan §6 G3).
 */
export function projectSnapshotToTrajectory(
	snapshot: SessionViewSnapshot,
	attribution: ReadonlyMap<string, ItemAttribution>,
	_details: ReadonlyMap<string, string>,
	options?: TrajectoryProjectionOptions,
): ConversationTrajectoryRecord[] {
	const records: ConversationTrajectoryRecord[] = [];
	const sorted = snapshot.timeline.slice().sort((a, b) => compareOrderKeys(a.orderKey, b.orderKey));

	const projectedCompactKeys = new Set<string>();
	for (const item of sorted) {
		const id = String(item.id);
		const attr = attribution.get(id) as TrajectoryItemAttribution | undefined;
		if (!passesTrajectoryAgentFilter(attr, options?.filterAgentId)) {
			continue;
		}
		const notice = findMatchingCompactionNotice(item, snapshot.branchTopologyNotices);
		if (isProtocolCompactMark(attr?.branchReason) || notice) {
			records.push(projectCompactedRecord(item, attr, notice));
			if (notice) {
				projectedCompactKeys.add(compactionNoticeKey(notice));
			}
			continue;
		}
		const record = timelineItemToTrajectoryRecord(item, attr);
		if (record) {
			records.push(record);
		}
	}

	appendStandaloneCompactedNotices(records, snapshot.branchTopologyNotices, projectedCompactKeys);

	return finalizeToolTree(records, sorted, attribution);
}

function compareOrderKeys(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0;
}

function passesTrajectoryAgentFilter(attr: TrajectoryItemAttribution | undefined, filterAgentId: string | undefined): boolean {
	if (!filterAgentId) {
		return true;
	}
	if (!attr) {
		return false;
	}
	if (attr.role === 'user' && !attr.agentId) {
		return true;
	}
	return attr.agentId === filterAgentId;
}

function withDetailRef<T extends ConversationTrajectoryRecord>(record: T, item: TimelineItemView): T {
	return item.detail !== undefined
		? { ...record, detailRef: String(item.detail) }
		: record;
}

function projectCompactedRecord(
	item: TimelineItemView,
	attr: TrajectoryItemAttribution | undefined,
	notice: BranchTopologyNoticeView | undefined,
): ConversationTrajectoryRecord {
	const id = String(item.id);
	const range = formatCompactionRange(notice, item);
	const reason = notice?.reason ?? attr?.branchReason;
	const summary = extractCompactionSummary(notice, item);
	const text = summary
		? summary
		: range
			? localize('conversationTrajectory.compactedRangeOnly', "Compacted · {0}", range)
			: localize('conversationTrajectory.compactedTypeOnly', "Compacted");

	return {
		id,
		kind: 'compacted',
		text,
		compactedRange: range,
		...(reason ? { compactedReason: reason } : {}),
		...(summary ? { compactedSummary: summary } : {}),
		...(item.detail !== undefined ? { detailRef: String(item.detail) } : {}),
	};
}

function findMatchingCompactionNotice(
	item: TimelineItemView,
	notices: readonly BranchTopologyNoticeView[] | undefined,
): BranchTopologyNoticeView | undefined {
	if (!notices?.length) {
		return undefined;
	}
	const turnId = item.turnId;
	const itemId = String(item.id);
	for (const notice of notices) {
		if (!isProtocolCompactMark(notice.reason)) {
			continue;
		}
		if (turnId && notice.divergedFromTurnId === turnId) {
			return notice;
		}
		if (notice.operationId && (itemId === notice.operationId || itemId.includes(notice.operationId))) {
			return notice;
		}
	}
	return undefined;
}

function compactionNoticeKey(notice: BranchTopologyNoticeView): string {
	return notice.operationId ? `op:${notice.operationId}` : `turn:${notice.divergedFromTurnId}`;
}

function appendStandaloneCompactedNotices(
	records: ConversationTrajectoryRecord[],
	notices: readonly BranchTopologyNoticeView[] | undefined,
	projectedKeys: ReadonlySet<string>,
): void {
	if (!notices?.length) {
		return;
	}
	const seenIds = new Set(records.filter(record => record.kind === 'compacted').map(record => record.id));
	for (const notice of notices) {
		if (!isProtocolCompactMark(notice.reason)) {
			continue;
		}
		const key = compactionNoticeKey(notice);
		if (projectedKeys.has(key)) {
			continue;
		}
		const id = notice.operationId
			? `compacted:${notice.operationId}`
			: `compacted:${notice.divergedFromTurnId}`;
		if (seenIds.has(id)) {
			continue;
		}
		const range = formatCompactionRange(notice, undefined);
		const summary = extractCompactionSummary(notice, undefined);
		const text = summary
			? summary
			: range
				? localize('conversationTrajectory.compactedRangeOnly', "Compacted · {0}", range)
				: localize('conversationTrajectory.compactedTypeOnly', "Compacted");
		records.push({
			id,
			kind: 'compacted',
			text,
			compactedRange: range,
			compactedReason: notice.reason,
			...(summary ? { compactedSummary: summary } : {}),
		});
		seenIds.add(id);
	}
}

function formatCompactionRange(notice: BranchTopologyNoticeView | undefined, item: TimelineItemView | undefined): string | undefined {
	if (notice?.affectedTurnIdsJson) {
		try {
			const ids = JSON.parse(notice.affectedTurnIdsJson) as unknown;
			if (Array.isArray(ids) && ids.length > 0) {
				return ids.map(String).join(', ');
			}
		} catch {
			// honest: omit unparsable range
		}
	}
	if (item?.turnId) {
		return item.turnId;
	}
	if (notice?.divergedFromTurnId) {
		return notice.divergedFromTurnId;
	}
	return undefined;
}

function extractCompactionSummary(notice: BranchTopologyNoticeView | undefined, item: TimelineItemView | undefined): string | undefined {
	if (notice?.messagesJson) {
		try {
			const messages = JSON.parse(notice.messagesJson) as unknown;
			if (typeof messages === 'string' && messages.trim()) {
				return messages.trim();
			}
			if (Array.isArray(messages) && messages.length > 0) {
				const first = messages[0];
				if (typeof first === 'string' && first.trim()) {
					return first.trim();
				}
			}
		} catch {
			// omit invented summary
		}
	}
	const preview = item?.summary.kind === 'text' ? item.summary.preview : undefined;
	return preview?.trim() || undefined;
}

function timelineItemToTrajectoryRecord(
	item: TimelineItemView,
	attr: TrajectoryItemAttribution | undefined,
): ConversationTrajectoryRecord | undefined {
	const id = String(item.id);
	const summary = item.summary;

	switch (summary.kind) {
		case 'text': {
			const role = attr?.role;
			if (role === 'system') {
				return withDetailRef({ id, kind: 'system', text: summary.preview ?? summary.title }, item);
			}
			if (role === 'user') {
				return withDetailRef({ id, kind: 'user', text: summary.preview ?? summary.title, opensTurn: true }, item);
			}
			if (role === 'tool') {
				return withDetailRef({
					id,
					kind: 'context',
					text: summary.preview ?? summary.title,
					messageSource: { kind: 'inject' },
				}, item);
			}
			return withDetailRef({ id, kind: 'message', text: summary.preview ?? summary.title }, item);
		}
		case 'reasoning':
			return withDetailRef({
				id,
				kind: 'thinking',
				text: summary.title,
				...(summary.collapsedPreview !== undefined ? { inputDetail: summary.collapsedPreview } : {}),
			}, item);
		case 'tool': {
			const callId = attr?.toolCallId ?? id;
			return withDetailRef({
				id,
				kind: 'tool',
				text: summary.title,
				callId,
				depth: 0,
				...(summary.toolName ? { messageSource: { kind: 'tool', label: summary.toolName } } : {}),
				...(summary.argPreview !== undefined ? { inputDetail: summary.argPreview } : {}),
				...(summary.resultPreview !== undefined ? { outputDetail: summary.resultPreview, result: summary.resultPreview } : {}),
			}, item);
		}
		case 'permission':
			return withDetailRef({
				id,
				kind: 'permission',
				text: summary.title,
				...(summary.argPreview !== undefined ? { inputDetail: summary.argPreview } : {}),
			}, item);
		case 'question':
			return withDetailRef({
				id,
				kind: 'question',
				text: summary.title,
				...(summary.optionsPreview?.length ? { inputDetail: summary.optionsPreview.join(' · ') } : {}),
			}, item);
		case 'error':
			return withDetailRef({ id, kind: 'error', text: summary.title }, item);
		case 'usage':
			return { id, kind: 'context', text: summary.title, messageSource: { kind: 'usage' } };
		case 'unknown':
			return { id, kind: 'unknown', text: summary.rawContent, messageSource: { kind: summary.typeName } };
		case 'generic':
			return undefined;
	}
}

function finalizeToolTree(
	records: ConversationTrajectoryRecord[],
	_sortedTimeline: readonly TimelineItemView[],
	attribution: ReadonlyMap<string, ItemAttribution>,
): ConversationTrajectoryRecord[] {
	const depthByCallId = new Map<string, number>();

	return records.map(record => {
		if (record.kind !== 'tool') {
			return record;
		}
		const attr = attribution.get(record.id) as TrajectoryItemAttribution | undefined;
		const callId = attr?.toolCallId ?? record.callId ?? record.id;
		const parentCallId = attr?.parentToolCallId;
		if (!parentCallId || parentCallId === callId) {
			return { ...record, callId, depth: 0 };
		}
		const parentDepth = depthByCallId.get(parentCallId) ?? 0;
		const depth = parentDepth + 1;
		depthByCallId.set(callId, depth);
		return {
			...record,
			kind: 'subtool',
			callId,
			parentCallId,
			depth,
		};
	});
}

/** Turn ids linked from the conversation timeline for trajectory reveal (engine path). */
export function collectTrajectoryTurnIdsFromSnapshot(snapshot: SessionViewSnapshot): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const item of snapshot.timeline) {
		switch (item.summary.kind) {
			case 'permission':
			case 'usage':
			case 'generic':
				continue;
			default:
				ids.add(String(item.id));
		}
	}
	return ids;
}

/** Whether trajectory fixture extras may be merged for this session (stub-only; never UA ids). */
export function shouldMergeTrajectoryFixtureExtras(sessionId: string, engineConnected: boolean): boolean {
	return !engineConnected && sessionId === 'untitled';
}

export function mergeTrajectoryFixtureExtras(
	sessionId: string,
	records: readonly ConversationTrajectoryRecord[],
): ConversationTrajectoryRecord[] {
	switch (sessionId) {
		case 'untitled':
			return mergeUntitledTrajectoryFixtures(records);
		default:
			return [...records];
	}
}

function mergeUntitledTrajectoryFixtures(records: readonly ConversationTrajectoryRecord[]): ConversationTrajectoryRecord[] {
	const systemRecord: ConversationTrajectoryRecord = {
		id: 'fixture:untitled:system',
		kind: 'system',
		text: CONVERSATION_TRAJECTORY_STUB_SYSTEM_TEXT,
		environment: {
			cwd: '/workspace/stub',
			os: 'linux',
			extra: 'Stub: trajectory environment fixture',
		},
		promptDetail: 'Stub: prompt snapshot for trajectory inspection',
	};

	const contextRecord: ConversationTrajectoryRecord = {
		id: 'fixture:untitled:context',
		kind: 'context',
		text: CONVERSATION_TRAJECTORY_STUB_CONTEXT_TEXT,
		messageSource: { kind: 'inject', label: 'Stub: workspace inject' },
	};

	const enrichedRecords = records.map(record => {
		if (record.kind !== 'user') {
			return record;
		}
		return {
			...record,
			sourceBlocks: [{
				type: 'text',
				content: CONVERSATION_TRAJECTORY_STUB_SOURCE_BLOCK_CONTENT,
				toolName: 'readme',
			}],
		};
	});

	const compactedRecord: ConversationTrajectoryRecord = {
		id: 'fixture:untitled:compacted',
		kind: 'compacted',
		text: localize('conversationTrajectory.stubCompacted', "Stub: compacted turns 1–2"),
		compactedRange: localize('conversationTrajectory.stubCompactedRange', "turn 1–2"),
		compactedReason: 'compact',
	};

	const withFixtures = [systemRecord, contextRecord, compactedRecord, ...enrichedRecords];
	const toolIndex = withFixtures.findIndex(record => record.kind === 'tool');
	if (toolIndex >= 0) {
		const parentTool = withFixtures[toolIndex]!;
		const subtoolRecord: ConversationTrajectoryRecord = {
			id: 'fixture:untitled:subtool',
			kind: 'subtool',
			text: CONVERSATION_TRAJECTORY_STUB_SUBTOOL_TEXT,
			parentCallId: parentTool.callId ?? parentTool.id,
			callId: 'fixture:untitled:subtool-call',
			depth: 1,
		};
		withFixtures.splice(toolIndex + 1, 0, subtoolRecord);
	}

	return withFixtures;
}

/** Turn ids admitted on the conversation timeline (excludes confirmation / visualization). */
export function collectConversationTrajectoryTurnIds(turns: readonly ConversationStubTurn[]): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const turn of turns) {
		if (turn.kind === 'confirmation' || turn.kind === 'visualization') {
			continue;
		}
		ids.add(turn.id);
	}
	return ids;
}

/** Resolve a conversation turn to reveal from a trajectory record (fixture rows return undefined). */
export function findTurnIdForTrajectoryRecord(
	record: ConversationTrajectoryRecord,
	turnIds: ReadonlySet<string>,
): string | undefined {
	if (turnIds.has(record.id)) {
		return record.id;
	}
	if (record.parentCallId && turnIds.has(record.parentCallId)) {
		return record.parentCallId;
	}
	return undefined;
}

/** Resolve the primary trajectory record for a conversation turn (prefers direct projection). */
export function findTrajectoryRecordIdForTurn(
	turnId: string,
	records: readonly ConversationTrajectoryRecord[],
): string | undefined {
	const direct = records.find(record => record.id === turnId);
	if (direct) {
		return direct.id;
	}
	const nested = records.find(record => record.parentCallId === turnId);
	return nested?.id;
}

export interface TrajectoryRecordLimitView {
	readonly visibleRecords: readonly ConversationTrajectoryRecord[];
	readonly totalCount: number;
	readonly omittedCount: number;
}

/** Keeps the most recent records when over PRD-020 cap; caller shows {@link omittedCount} honestly. */
export function applyTrajectoryRecordLimit(
	records: readonly ConversationTrajectoryRecord[],
	limit: number = CONVERSATION_TRAJECTORY_RECORD_LIMIT,
): TrajectoryRecordLimitView {
	const totalCount = records.length;
	if (totalCount <= limit) {
		return { visibleRecords: records, totalCount, omittedCount: 0 };
	}
	const omittedCount = totalCount - limit;
	return {
		visibleRecords: records.slice(omittedCount),
		totalCount,
		omittedCount,
	};
}

/** Lowercase haystack for trajectory search (kind, text, blocks, inspector fields). */
export function getTrajectoryRecordSearchHaystack(record: ConversationTrajectoryRecord): string {
	const parts: string[] = [record.kind, record.text];
	if (record.messageSource) {
		parts.push(record.messageSource.kind, record.messageSource.label ?? '');
	}
	if (record.environment) {
		parts.push(record.environment.cwd ?? '', record.environment.os ?? '', record.environment.extra ?? '');
	}
	for (const field of [
		record.promptDetail,
		record.inputDetail,
		record.outputDetail,
		record.result,
		record.compactedRange,
		record.compactedReason,
		record.compactedSummary,
	]) {
		if (field) {
			parts.push(field);
		}
	}
	if (record.sourceBlocks?.length) {
		for (const block of record.sourceBlocks) {
			parts.push(block.type, block.content, block.toolName ?? '');
		}
	}
	return parts.join('\n').toLowerCase();
}

/** Case-insensitive substring filter; blank query returns all records. */
export function filterTrajectoryRecordsBySearch(
	records: readonly ConversationTrajectoryRecord[],
	searchQuery: string,
): readonly ConversationTrajectoryRecord[] {
	const needle = searchQuery.trim().toLowerCase();
	if (!needle) {
		return records;
	}
	return records.filter(record => getTrajectoryRecordSearchHaystack(record).includes(needle));
}

export type TrajectoryTableDisplayItem =
	| { readonly type: 'record'; readonly record: ConversationTrajectoryRecord }
	| { readonly type: 'fold'; readonly span: TrajectoryProcessFoldSpan };

/** Flat record rows and process-fold spans for virtualized table rendering. */
export function buildTrajectoryTableDisplayItems(records: readonly ConversationTrajectoryRecord[]): TrajectoryTableDisplayItem[] {
	const spans = projectTrajectoryProcessFoldSpans(records);
	const spanByStart = new Map(spans.map(span => [span.startIndex, span]));
	const foldedRecordIds = new Set(spans.flatMap(span => span.recordIds));
	const items: TrajectoryTableDisplayItem[] = [];

	for (let index = 0; index < records.length; index++) {
		const span = spanByStart.get(index);
		if (span) {
			items.push({ type: 'fold', span });
			index = span.endIndex - 1;
			continue;
		}
		const record = records[index]!;
		if (foldedRecordIds.has(record.id)) {
			continue;
		}
		items.push({ type: 'record', record });
	}

	return items;
}

export interface TrajectoryTableViewModel {
	readonly items: readonly TrajectoryTableDisplayItem[];
	readonly totalCount: number;
	readonly omittedCount: number;
	readonly visibleRecordCount: number;
	readonly filteredCount: number;
}

/** Applies PRD-020 limit, search filter, and fold grouping for the trajectory table. */
export function buildTrajectoryTableViewModel(
	records: readonly ConversationTrajectoryRecord[],
	searchQuery: string,
): TrajectoryTableViewModel {
	const limited = applyTrajectoryRecordLimit(records);
	const filtered = filterTrajectoryRecordsBySearch(limited.visibleRecords, searchQuery);
	return {
		items: buildTrajectoryTableDisplayItems(filtered),
		totalCount: limited.totalCount,
		omittedCount: limited.omittedCount,
		visibleRecordCount: limited.visibleRecords.length,
		filteredCount: filtered.length,
	};
}
