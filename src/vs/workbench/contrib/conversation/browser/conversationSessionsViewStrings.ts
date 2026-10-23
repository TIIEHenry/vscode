/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { fromNow } from '../../../../base/common/date.js';
import { localize } from '../../../../nls.js';
import type { ConversationStubSession, ConversationStubTurn } from './conversationStubModel.js';

/** What the roster row icon and aria status say. Waiting outranks a running or failed tool. */
export type SessionRosterTone = 'idle' | 'waiting' | 'running' | 'failed';

export type SessionRosterGroup = 'today' | 'yesterday' | 'earlier';

export interface SessionRosterHeader {
	readonly kind: 'header';
	readonly group: SessionRosterGroup;
	readonly count: number;
}

export interface SessionRosterItem {
	readonly kind: 'session';
	readonly session: ConversationStubSession;
}

export type SessionRosterEntry = SessionRosterHeader | SessionRosterItem;

/**
 * Sessions sidebar empty chrome. New session is a real local action; this
 * must not advertise a stub conversation or invent an engine session.
 */
export const conversationSessionsViewEmptyMessage = localize(
	'conversationSessionsView.empty',
	"No sessions — use New session to start one.",
);

export const conversationSessionsViewNoMatches = localize(
	'conversationSessionsView.noMatches',
	"No matches",
);

export function resolveSessionRosterTone(turns: readonly ConversationStubTurn[], pendingConfirmations: number): SessionRosterTone {
	if (pendingConfirmations > 0) {
		return 'waiting';
	}
	// `streaming` is the live overlay. A stub tool can be `pending` without it, and that is not running.
	if (turns.some(turn => turn.streaming === true || turn.toolStatus === 'running')) {
		return 'running';
	}
	if (turns.some(turn => turn.toolStatus === 'failed')) {
		return 'failed';
	}
	return 'idle';
}

export function formatSessionMessageCount(turnCount: number): string {
	if (turnCount === 0) {
		return localize('conversationSessionsView.noMessages', "No messages");
	}
	if (turnCount === 1) {
		return localize('conversationSessionsView.oneMessage', "1 message");
	}
	return localize('conversationSessionsView.manyMessages', "{0} messages", turnCount);
}

export function formatSessionPendingConfirmations(pendingConfirmations: number): string | undefined {
	if (pendingConfirmations <= 0) {
		return undefined;
	}
	return pendingConfirmations === 1
		? localize('conversationSessionsView.oneConfirmationPending', "1 confirmation pending")
		: localize('conversationSessionsView.manyConfirmationsPending', "{0} confirmations pending", pendingConfirmations);
}

/** Unix seconds or milliseconds, as stamped by SessionSummary.last_accessed_at. */
export function formatSessionAccessedLabel(lastAccessedAt: number): string {
	return fromNow(sessionAccessedAtMs(lastAccessedAt) ?? lastAccessedAt);
}

export function formatSessionRosterStatus(tone: SessionRosterTone): string | undefined {
	switch (tone) {
		case 'waiting':
			return localize('conversationSessionsView.statusWaiting', "waiting for confirmation");
		case 'running':
			return localize('conversationSessionsView.statusRunning', "running");
		case 'failed':
			return localize('conversationSessionsView.statusFailed', "failed");
		default:
			return undefined;
	}
}

/**
 * Same-row session subtitle shared by Sessions and Projects.
 * A known last-access time replaces the message count; the pending count stays.
 * Pass `turnCount` from getTurns when the roster object leaves turns empty.
 * `running` and `failed` are appended on the same line. Waiting stays in the pending phrase.
 */
export function formatSessionRosterSubtitle(session: ConversationStubSession, pendingConfirmations: number, turnCount = session.turns.length, tone?: SessionRosterTone): string {
	const leading = typeof session.lastAccessedAt === 'number'
		? formatSessionAccessedLabel(session.lastAccessedAt)
		: formatSessionMessageCount(turnCount);
	const pending = formatSessionPendingConfirmations(pendingConfirmations);
	const base = pending ? `${leading} · ${pending}` : leading;
	// Waiting already says "confirmation pending". Running and failed are otherwise only an icon.
	if (tone === 'running' || tone === 'failed') {
		const status = formatSessionRosterStatus(tone);
		if (status) {
			return `${base} · ${status}`;
		}
	}
	return base;
}

function sessionAccessedAtMs(lastAccessedAt: number | undefined): number | undefined {
	if (typeof lastAccessedAt !== 'number' || !Number.isFinite(lastAccessedAt) || lastAccessedAt <= 0) {
		return undefined;
	}
	return lastAccessedAt < 1e12 ? lastAccessedAt * 1000 : lastAccessedAt;
}

export function formatSessionRosterGroupLabel(group: SessionRosterGroup): string {
	switch (group) {
		case 'today':
			return localize('conversationSessionsView.groupToday', "Today");
		case 'yesterday':
			return localize('conversationSessionsView.groupYesterday', "Yesterday");
		default:
			return localize('conversationSessionsView.groupEarlier', "Earlier");
	}
}

/**
 * Today / Yesterday / Earlier, in that order. Sessions without a usable
 * access time stay in Earlier. When nothing has a time, the list stays flat
 * so a stub roster does not grow a header.
 */
export function groupSessionsForRoster(sessions: readonly ConversationStubSession[], now = Date.now()): SessionRosterEntry[] {
	if (!sessions.some(session => sessionAccessedAtMs(session.lastAccessedAt) !== undefined)) {
		return sessions.map(session => ({ kind: 'session', session }));
	}
	const startOfToday = new Date(now);
	startOfToday.setHours(0, 0, 0, 0);
	const startOfYesterday = new Date(startOfToday);
	startOfYesterday.setDate(startOfYesterday.getDate() - 1);
	const buckets: Record<SessionRosterGroup, ConversationStubSession[]> = { today: [], yesterday: [], earlier: [] };
	for (const session of sessions) {
		const accessed = sessionAccessedAtMs(session.lastAccessedAt);
		if (accessed === undefined || accessed < startOfYesterday.getTime()) {
			buckets.earlier.push(session);
		} else if (accessed < startOfToday.getTime()) {
			buckets.yesterday.push(session);
		} else {
			buckets.today.push(session);
		}
	}
	const entries: SessionRosterEntry[] = [];
	for (const group of ['today', 'yesterday', 'earlier'] as const) {
		const bucket = buckets[group];
		if (bucket.length === 0) {
			continue;
		}
		entries.push({ kind: 'header', group, count: bucket.length });
		for (const session of bucket) {
			entries.push({ kind: 'session', session });
		}
	}
	return entries;
}

export function formatSessionRosterAriaLabel(session: ConversationStubSession, pendingConfirmations: number, turnCount: number, tone: SessionRosterTone, active: boolean): string {
	const parts = [session.title, formatSessionRosterSubtitle(session, pendingConfirmations, turnCount, tone)];
	if (tone === 'waiting') {
		const status = formatSessionRosterStatus(tone);
		if (status) {
			parts.push(status);
		}
	}
	if (active) {
		parts.push(localize('conversationSessionsView.activeSession', "active session"));
	}
	return parts.join(', ');
}
