/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetHistoryRequest, UniverseAgentGetHistoryResult, UniverseAgentHistoryEnvelope } from '../common/universeAgentTypes.js';
import type { HistoryFillEnvelopeRow, HistoryFillResultPayload } from './sessionCore/local-fact.js';
import { demuxSessionStreamPayload } from './sessionStreamDemux.js';

export const HISTORY_FILL_MAX_PAGES = 64;
export const GET_HISTORY_PAGE_SIZE = 100;

export type HistoryFillFetch = (request: UniverseAgentGetHistoryRequest) => Promise<UniverseAgentGetHistoryResult>;

export type HistoryFillPlan = {
	readonly sessionId: string;
	readonly fromExclusive: number;
	readonly toInclusive: number;
};

/**
 * Host HistoryFillCoordinator: page GetHistory, demux rows to Actor
 * `{ seq, arm?, body? }`, and always post pagesFetched + coveredThrough.
 */
export async function fillHistoryGap(
	fetch: HistoryFillFetch,
	plan: HistoryFillPlan,
	onRawPayload?: (payload: unknown) => void,
): Promise<HistoryFillResultPayload> {
	const inSeqDomain = (value: number) => Number.isSafeInteger(value) && value >= 0;
	if (!inSeqDomain(plan.fromExclusive) || !inSeqDomain(plan.toInclusive)) {
		return { ok: false, code: 'history_fill_window_invalid' };
	}
	if (plan.toInclusive <= plan.fromExclusive) {
		return { ok: true, envelopes: [], pagesFetched: 0, coveredThrough: plan.fromExclusive };
	}

	const collected: HistoryFillEnvelopeRow[] = [];
	let cursorSeq: string | undefined = String(plan.fromExclusive);
	let pagesFetched = 0;
	let coveredThrough = plan.fromExclusive;

	for (;;) {
		let page: UniverseAgentGetHistoryResult;
		try {
			page = await fetch({
				sessionId: plan.sessionId,
				cursorSeq,
				limit: GET_HISTORY_PAGE_SIZE,
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { ok: false, code: 'transport_failed', message };
		}

		pagesFetched += 1;
		if (page.envelopes.length === 0) {
			if (collected.length > 0) {
				return { ok: true, envelopes: collected, pagesFetched, coveredThrough };
			}
			return { ok: false, code: 'empty_page' };
		}

		for (const row of page.envelopes) {
			onRawPayload?.(row.payload);
			const mapped = historyFillRowFromGetHistoryEnvelope(row);
			if (!mapped) {
				continue;
			}
			if (mapped.seq <= plan.fromExclusive || mapped.seq > plan.toInclusive) {
				continue;
			}
			collected.push(mapped);
			if (mapped.seq > coveredThrough) {
				coveredThrough = mapped.seq;
			}
		}

		if (coveredThrough >= plan.toInclusive) {
			return { ok: true, envelopes: collected, pagesFetched, coveredThrough };
		}
		if (!page.nextCursorSeq) {
			return { ok: true, envelopes: collected, pagesFetched, coveredThrough };
		}
		if (pagesFetched >= HISTORY_FILL_MAX_PAGES) {
			return { ok: false, code: 'page_budget_exceeded' };
		}
		cursorSeq = page.nextCursorSeq;
	}
}

export function historyFillRowFromGetHistoryEnvelope(row: UniverseAgentHistoryEnvelope): HistoryFillEnvelopeRow | undefined {
	const payload = row.payload;
	const direct = demuxSessionStreamPayload(payload);
	const wrapped = isRecord(payload) && !hasStreamEventKey(payload)
		? demuxSessionStreamPayload({ envelope_appended: { envelope: payload } })
		: [];
	const events = direct.length > 0 ? direct : wrapped;
	const first = events[0];
	const seq = seqFromDemuxed(first) ?? seqFromPayload(payload) ?? toSafeInt(row.cursorSeq);
	if (seq === undefined) {
		return undefined;
	}
	if (first && typeof first === 'object' && typeof (first as { arm?: unknown }).arm === 'string') {
		const event = first as { arm: string; body?: unknown };
		return event.body !== undefined
			? { seq, arm: event.arm, body: event.body }
			: { seq, arm: event.arm };
	}
	return { seq };
}

function hasStreamEventKey(payload: object): boolean {
	const record = payload as Record<string, unknown>;
	return record.envelope_appended !== undefined
		|| record.envelopeAppended !== undefined
		|| record.hello !== undefined
		|| record.envelope_batch_appended !== undefined
		|| record.envelopeBatchAppended !== undefined;
}

function seqFromDemuxed(event: unknown): number | undefined {
	if (!event || typeof event !== 'object') {
		return undefined;
	}
	return toSafeInt((event as { seq?: unknown }).seq);
}

function seqFromPayload(payload: unknown): number | undefined {
	if (!isRecord(payload)) {
		return undefined;
	}
	const record = payload as Record<string, unknown>;
	return toSafeInt(record.seq)
		?? toSafeInt(isRecord(record.envelope) ? (record.envelope as { seq?: unknown }).seq : undefined);
}

function isRecord(value: unknown): value is object {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function toSafeInt(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
		return value;
	}
	if (typeof value === 'string' && value.length > 0) {
		const parsed = Number(value);
		if (Number.isSafeInteger(parsed) && parsed >= 0) {
			return parsed;
		}
	}
	return undefined;
}
