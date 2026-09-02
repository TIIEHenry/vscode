/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ItemCompactedAttribution } from '../common/conversationViewFrame.js';

/** Proto `RangeReplaceReasonProto.COMPACT`. */
export const RANGE_REPLACE_REASON_COMPACT = 3;

export type CompactedEnvelopeFacts = {
	readonly itemId: string;
	readonly branchReason?: string;
	readonly compacted?: ItemCompactedAttribution;
	readonly role?: 'user' | 'assistant' | 'system' | 'tool';
	readonly agentId?: string;
};

/**
 * Normalize wire `branch_reason`. Compact tokens become attribution `'compact'`;
 * every other non-empty string is kept verbatim (never inferred from titles).
 */
export function normalizeAttributionBranchReason(value: unknown): string | undefined {
	if (typeof value !== 'string' || !value) {
		return undefined;
	}
	const normalized = value.trim().toLowerCase();
	if (normalized === 'compact' || normalized === 'compaction' || normalized === 'compacted') {
		return 'compact';
	}
	return value;
}

export function isCompactBranchReasonMark(value: unknown): boolean {
	return normalizeAttributionBranchReason(value) === 'compact';
}

/**
 * Path 2 identity: `EnvelopeRangeReplaced.reason === COMPACT` (enum 3 or wire name).
 */
export function isCompactRangeReplaceReason(value: unknown): boolean {
	if (value === RANGE_REPLACE_REASON_COMPACT) {
		return true;
	}
	if (typeof value === 'number' && Number.isFinite(value) && value === RANGE_REPLACE_REASON_COMPACT) {
		return true;
	}
	if (typeof value === 'string' && value.length > 0) {
		const trimmed = value.trim();
		if (trimmed === String(RANGE_REPLACE_REASON_COMPACT)) {
			return true;
		}
		const upper = trimmed.toUpperCase();
		return upper === 'COMPACT' || upper === 'RANGE_REPLACE_REASON_COMPACT';
	}
	return false;
}

/**
 * Path 1 — `MessageEnvelope.branch_reason` is compact (or protocol `compaction`).
 * CompactedSpanBlock / SummaryBlock are copied when complete; missing span is still a compact row.
 */
export function projectCompactFactsFromBranchReasonEnvelope(envelope: unknown): CompactedEnvelopeFacts | undefined {
	if (!isRecord(envelope)) {
		return undefined;
	}
	const itemId = readNonEmptyString(envelope, 'id');
	if (!itemId) {
		return undefined;
	}
	const branchReason = normalizeAttributionBranchReason(readField(envelope, 'branch_reason', 'branchReason'));
	if (!isCompactBranchReasonMark(branchReason)) {
		return undefined;
	}
	return {
		itemId,
		branchReason: 'compact',
		...optionalCompacted(readCompactedFromEnvelopeBlocks(envelope)),
		...optionalRole(envelope),
		...optionalAgentId(envelope),
	};
}

/**
 * Path 2 — `EnvelopeRangeReplaced(reason=COMPACT)` alone establishes identity.
 * BRANCH_NOTICE is not required. Each replacement envelope becomes a compact row;
 * span/summary come from that envelope's blocks when present (never invented).
 */
export function projectCompactFactsFromRangeReplaced(payload: unknown): readonly CompactedEnvelopeFacts[] {
	const replaced = readRangeReplacedBody(payload);
	if (!replaced) {
		return [];
	}
	const reason = readField(replaced, 'reason');
	if (!isCompactRangeReplaceReason(reason)) {
		return [];
	}
	const replacement = readField(replaced, 'replacement', 'replacements');
	if (!Array.isArray(replacement) || replacement.length === 0) {
		return [];
	}
	const facts: CompactedEnvelopeFacts[] = [];
	for (const envelope of replacement) {
		if (!isRecord(envelope)) {
			continue;
		}
		const itemId = readNonEmptyString(envelope, 'id');
		if (!itemId) {
			continue;
		}
		facts.push({
			itemId,
			branchReason: 'compact',
			...optionalCompacted(readCompactedFromEnvelopeBlocks(envelope)),
			...optionalRole(envelope),
			...optionalAgentId(envelope),
		});
	}
	return facts;
}

/** Walk a SessionStreamEvent-shaped payload for path-1 envelopes (appended / batch). */
export function iterL2EnvelopesFromStreamPayload(payload: unknown): readonly unknown[] {
	if (!isRecord(payload)) {
		return [];
	}
	const appended = readField(payload, 'envelope_appended', 'envelopeAppended');
	if (isRecord(appended)) {
		const envelope = readField(appended, 'envelope');
		return envelope !== undefined ? [envelope] : [];
	}
	const batch = readField(payload, 'envelope_batch_appended', 'envelopeBatchAppended');
	if (isRecord(batch)) {
		const envelopes = readField(batch, 'envelopes');
		return Array.isArray(envelopes) ? envelopes : [];
	}
	return [];
}

export function readRangeReplacedBody(payload: unknown): object | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}
	const nested = readField(payload, 'envelope_range_replaced', 'envelopeRangeReplaced');
	if (isRecord(nested)) {
		return nested;
	}
	if (readField(payload, 'from_seq', 'fromSeq') !== undefined && readField(payload, 'reason') !== undefined) {
		return payload;
	}
	return undefined;
}

function readCompactedFromEnvelopeBlocks(envelope: object): ItemCompactedAttribution | undefined {
	const blocks = readField(envelope, 'blocks');
	if (!Array.isArray(blocks)) {
		return undefined;
	}
	let span: { readonly anchorTurnId: string; readonly foldedLeafTurnId: string; readonly compactBranchTurnId: string } | undefined;
	let summary: string | undefined;
	for (const block of blocks) {
		if (!isRecord(block)) {
			continue;
		}
		if (!span) {
			span = readCompactedSpanBlock(block);
		}
		if (summary === undefined) {
			summary = readSummaryBlockText(block);
		}
	}
	if (!span) {
		return undefined;
	}
	return {
		anchorTurnId: span.anchorTurnId,
		foldedLeafTurnId: span.foldedLeafTurnId,
		compactBranchTurnId: span.compactBranchTurnId,
		...(summary ? { summary } : {}),
	};
}

function readCompactedSpanBlock(block: object): { readonly anchorTurnId: string; readonly foldedLeafTurnId: string; readonly compactBranchTurnId: string } | undefined {
	const span = readField(block, 'compacted_span_block', 'compactedSpanBlock');
	if (!isRecord(span)) {
		return undefined;
	}
	const anchorTurnId = readNonEmptyString(span, 'anchor_turn_id', 'anchorTurnId');
	const foldedLeafTurnId = readNonEmptyString(span, 'folded_leaf_turn_id', 'foldedLeafTurnId');
	const compactBranchTurnId = readNonEmptyString(span, 'compact_branch_turn_id', 'compactBranchTurnId');
	if (!anchorTurnId || !foldedLeafTurnId || !compactBranchTurnId) {
		return undefined;
	}
	return { anchorTurnId, foldedLeafTurnId, compactBranchTurnId };
}

function readSummaryBlockText(block: object): string | undefined {
	const summary = readField(block, 'summary_block', 'summaryBlock');
	if (!isRecord(summary)) {
		return undefined;
	}
	const text = readField(summary, 'text');
	return typeof text === 'string' && text.trim() ? text : undefined;
}

function optionalCompacted(compacted: ItemCompactedAttribution | undefined): { readonly compacted: ItemCompactedAttribution } | Record<string, never> {
	return compacted ? { compacted } : {};
}

function optionalRole(envelope: object): { readonly role: CompactedEnvelopeFacts['role'] } | Record<string, never> {
	const role = normalizeRole(readField(envelope, 'role'));
	return role ? { role } : {};
}

function optionalAgentId(envelope: object): { readonly agentId: string } | Record<string, never> {
	const agentId = readNonEmptyString(envelope, 'agent_id', 'agentId');
	return agentId ? { agentId } : {};
}

function normalizeRole(value: unknown): CompactedEnvelopeFacts['role'] | undefined {
	if (typeof value !== 'string') {
		return undefined;
	}
	switch (value.toLowerCase()) {
		case 'user':
			return 'user';
		case 'assistant':
			return 'assistant';
		case 'system':
			return 'system';
		case 'tool':
			return 'tool';
		default:
			return undefined;
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readNonEmptyString(record: object, ...keys: string[]): string | undefined {
	for (const key of keys) {
		const value = readOwnDataValue(record, key);
		if (typeof value === 'string' && value.trim()) {
			return value;
		}
	}
	return undefined;
}

function readField(record: object, ...keys: string[]): unknown {
	for (const key of keys) {
		const value = readOwnDataValue(record, key);
		if (value !== undefined) {
			return value;
		}
	}
	return undefined;
}

function readOwnDataValue(record: object, key: string): unknown {
	const desc = Object.getOwnPropertyDescriptor(record, key);
	if (desc === undefined || !Object.hasOwn(desc, 'value')) {
		return undefined;
	}
	return desc.value;
}
