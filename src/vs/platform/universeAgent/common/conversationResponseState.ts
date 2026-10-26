/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConversationRespondFailure, ItemAttribution } from './conversationViewFrame.js';
import type { SessionViewSnapshot, TimelineItemSummary } from './sessionView/types.js';

export type ConversationResponseKind = 'permission' | 'question' | 'clientTool';

export interface ConversationResponseIdentity {
	readonly kind: ConversationResponseKind;
	readonly requestId: string;
	readonly agentId?: string;
}

export interface ConversationResponseSeatState {
	readonly key: string;
	readonly identity: ConversationResponseIdentity;
	readonly scope: object;
	readonly incarnation: number;
	readonly revision: number;
	readonly rowIds: readonly string[];
	readonly pendingAliases: readonly string[];
	readonly inFlight: boolean;
	readonly blocked: boolean;
	readonly failure?: ConversationRespondFailure;
}

export interface ConversationResponseProjection {
	readonly scope: object;
	readonly revision: number;
	readonly byRequest: ReadonlyMap<string, ConversationResponseSeatState>;
	readonly byRow: ReadonlyMap<string, string>;
}

interface ResolvedResponse {
	readonly key: string;
	readonly identity: ConversationResponseIdentity;
	readonly semantic: string;
	readonly rowIds: readonly string[];
	readonly pendingAliases: readonly string[];
	readonly blocked: boolean;
}

/** Exact response arm; an ordinary server tool never owns a client response. */
export function conversationResponseKind(summary: TimelineItemSummary): ConversationResponseKind | undefined {
	return summary.kind === 'permission' || summary.kind === 'question' ? summary.kind
		: summary.kind === 'tool' && summary.respondable === true ? 'clientTool' : undefined;
}

/** Identity-bearing request content, excluding ordinary lifecycle / ordering chrome. */
export function conversationResponseSemantic(summary: TimelineItemSummary): string {
	switch (summary.kind) {
		case 'question':
			return JSON.stringify([summary.kind, (summary.items ?? []).map(item => [item.id, item.title, item.optionsPreview ?? [], item.multiSelect === true, item.allowCustom === true]), summary.optionsPreview ?? [], summary.multiSelect === true, summary.allowCustom === true, summary.answerKeysValid === true]);
		case 'permission':
			return JSON.stringify([summary.kind, summary.permissionKind, summary.argPreview, summary.optionsPreview]);
		case 'tool':
			return JSON.stringify([summary.kind, summary.toolName, summary.toolCallId, summary.toolCallIds, summary.argPreview, summary.respondable]);
		default:
			return summary.kind;
	}
}

/** Exact id first, then the longest admitted prefix, across every pending kind. */
export function conversationQuestionRequestId(displayId: string, pendingIds: ReadonlySet<string>): string | undefined {
	if (pendingIds.has(displayId)) {
		return displayId;
	}
	let best: string | undefined;
	for (const id of pendingIds) {
		if (id.length > 0 && displayId.startsWith(`${id}:`) && (best === undefined || id.length > best.length || (id.length === best.length && id < best))) {
			best = id;
		}
	}
	return best;
}

/**
 * Resolve against the full replica, before leaf filtering. A conflicting exact
 * row or declared agent invalidates the entire request, including its aliases.
 */
export function resolveConversationResponses(snapshot: SessionViewSnapshot, attribution: ReadonlyMap<string, ItemAttribution>): ReadonlyMap<string, ResolvedResponse> {
	const result = new Map<string, ResolvedResponse>();
	const pendingIds = new Set(snapshot.pendingActions.map(action => String(action.requestId)));
	const candidates = snapshot.pendingActions.map(action => ({ id: String(action.requestId), summary: action.summary, agentId: action.agentId, pending: true }));
	for (const item of snapshot.timeline) {
		if (!pendingIds.has(String(item.id)) && (conversationResponseKind(item.summary) === 'clientTool'
			|| (item.summary.kind === 'permission' && item.summary.decision !== undefined)
			|| (item.summary.kind === 'question' && item.summary.answered === true))) {
			candidates.push({ id: String(item.id), summary: item.summary, agentId: item.agentId, pending: false });
		}
	}
	for (const candidate of candidates) {
		const { id, summary } = candidate;
		const kind = conversationResponseKind(summary);
		if (!kind || !id || id !== id.trim() || candidates.filter(other => other.id === id).length !== 1) {
			continue;
		}
		const rows = snapshot.timeline.filter(item => String(item.id) === id || (kind === 'question' && conversationQuestionRequestId(String(item.id), pendingIds) === id));
		const agents = new Set<string>();
		if (candidate.agentId !== undefined) {
			agents.add(candidate.agentId);
		}
		let conflict = new Set(rows.map(row => String(row.id))).size !== rows.length;
		let blocked = (summary.kind === 'question' && summary.answered === true)
			|| (summary.kind === 'permission' && summary.decision !== undefined)
			|| (summary.kind === 'tool' && summary.status !== 'pending' && summary.status !== 'running');
		for (const row of rows) {
			// A terminal client-tool row may have dropped respondable. It still
			// closes its own pending request, never another summary kind.
			const rowKind = conversationResponseKind(row.summary);
			if (rowKind !== kind && !(kind === 'clientTool' && row.summary.kind === 'tool' && row.summary.status !== 'pending' && row.summary.status !== 'running')) {
				conflict = true;
			}
			for (const agent of [row.agentId, attribution.get(String(row.id))?.agentId]) {
				if (agent !== undefined) {
					agents.add(agent);
				}
			}
			blocked ||= (row.summary.kind === 'question' && row.summary.answered === true)
				|| (row.summary.kind === 'permission' && row.summary.decision !== undefined)
				|| (row.summary.kind === 'tool' && row.summary.status !== 'pending' && row.summary.status !== 'running');
		}
		if (conflict || agents.size > 1) {
			continue;
		}
		const agentId = agents.values().next().value;
		const identity: ConversationResponseIdentity = { kind, requestId: id, ...(agentId !== undefined ? { agentId } : {}) };
		const key = JSON.stringify([kind, id, agentId ?? null]);
		const rowIds = rows.map(row => String(row.id));
		const covered = snapshot.timeline.some(row => String(row.id) === id || String(row.id).startsWith(`${id}:`));
		if (rowIds.length === 0 && candidate.pending && (kind === 'clientTool' || !covered) && (kind !== 'permission' || agentId !== undefined)) {
			rowIds.push(id);
		}
		if (rowIds.length === 0) {
			continue;
		}
		result.set(key, { key, identity, semantic: conversationResponseSemantic(summary), rowIds, pendingAliases: candidate.pending ? [`pending:${id}`] : [], blocked });
	}
	return result;
}

interface ResponseRecord extends ConversationResponseSeatState {
	readonly semantic: string;
	readonly attempt?: number;
}

export interface ConversationResponseAttempt {
	readonly scope: object;
	readonly key: string;
	readonly incarnation: number;
	readonly attempt: number;
}

export type ConversationResponseBegin =
	| { readonly kind: 'started'; readonly ticket: ConversationResponseAttempt }
	| { readonly kind: 'inFlight' | 'blocked' | 'untracked' };

let nextScope = 0;

/** Local, binding-owned state. Methods mutate synchronously; publishing is the caller's responsibility. */
export class ConversationResponseState {
	private scope: object = { id: ++nextScope };
	private revision = 0;
	private incarnation = 0;
	private attempt = 0;
	private records = new Map<string, ResponseRecord>();
	private current: ConversationResponseProjection = { scope: this.scope, revision: 0, byRequest: new Map(), byRow: new Map() };

	get projection(): ConversationResponseProjection { return this.current; }

	reset(preserveClosed = false): void {
		this.scope = { id: ++nextScope };
		this.records = new Map([...this.records].filter(([, state]) => preserveClosed && state.blocked).map(([key, state]): [string, ResponseRecord] => [key, {
			...state, scope: this.scope, incarnation: ++this.incarnation, revision: ++this.revision, inFlight: false, attempt: undefined,
		}]));
		this.publish();
	}

	reconcile(snapshot: SessionViewSnapshot, attribution: ReadonlyMap<string, ItemAttribution>, retiredIds: ReadonlySet<string> = new Set()): void {
		const next = new Map<string, ResponseRecord>();
		let changed = false;
		for (const [key, resolved] of resolveConversationResponses(snapshot, attribution)) {
			const prev = this.records.get(key);
			const reuse = prev?.semantic === resolved.semantic && !retiredIds.has(resolved.identity.requestId) ? prev : undefined;
			const blocked = resolved.blocked || (reuse && reuse.failure?.retryable === false) || false;
			if (reuse && reuse.blocked === blocked && JSON.stringify(reuse.rowIds) === JSON.stringify(resolved.rowIds) && JSON.stringify(reuse.pendingAliases) === JSON.stringify(resolved.pendingAliases)) {
				next.set(key, reuse);
			} else {
				changed = true;
				next.set(key, {
					...resolved, scope: this.scope,
					incarnation: reuse && !(blocked && !reuse.blocked) ? reuse.incarnation : ++this.incarnation,
					revision: ++this.revision, inFlight: reuse && !blocked ? reuse.inFlight : false, blocked,
					...(reuse ? { failure: reuse.failure, attempt: blocked ? undefined : reuse.attempt } : {}),
				});
			}
		}
		// Keep authoritative closed chrome as a blocked tombstone until its row
		// is removed/replaced. A terminal request must not become untracked and
		// accidentally take the unary compatibility path.
		for (const [key, prev] of this.records) {
			if (!next.has(key) && prev.blocked && !retiredIds.has(prev.identity.requestId)
				&& !snapshot.pendingActions.some(action => String(action.requestId) === prev.identity.requestId)
				&& snapshot.timeline.some(row => prev.rowIds.includes(String(row.id))
					&& [row.agentId, attribution.get(String(row.id))?.agentId].every(agent => agent === undefined || agent === prev.identity.agentId) && (
					(row.summary.kind === 'tool' && prev.identity.kind === 'clientTool' && row.summary.status !== 'pending' && row.summary.status !== 'running')
					|| (row.summary.kind === 'permission' && prev.identity.kind === 'permission' && row.summary.decision !== undefined)
					|| (row.summary.kind === 'question' && prev.identity.kind === 'question' && row.summary.answered === true)))) {
				next.set(key, prev);
			}
		}

		if (changed || next.size !== this.records.size || [...this.records.keys()].some(key => !next.has(key))) {
			this.records = next;
			this.publish();
		}
	}

	begin(kind: ConversationResponseKind, requestId: string): ConversationResponseBegin {
		const matches = [...this.records.values()].filter(state => state.identity.kind === kind && state.identity.requestId === requestId);
		const state = matches.length === 1 ? matches[0] : undefined;
		if (!state) {
			return { kind: 'untracked' };
		}
		if (state.blocked) {
			return { kind: 'blocked' };
		}
		if (state.inFlight) {
			return { kind: 'inFlight' };
		}
		const attempt = ++this.attempt;
		this.records.set(state.key, { ...state, revision: ++this.revision, inFlight: true, failure: undefined, attempt });
		this.publish();
		return { kind: 'started', ticket: { scope: this.scope, key: state.key, incarnation: state.incarnation, attempt } };
	}

	isCurrent(ticket: ConversationResponseAttempt): boolean {
		const state = this.records.get(ticket.key);
		return ticket.scope === this.scope && state?.incarnation === ticket.incarnation && state.attempt === ticket.attempt && state.inFlight && !state.blocked;
	}

	finish(ticket: ConversationResponseAttempt, failure?: ConversationRespondFailure): void {
		if (!this.isCurrent(ticket)) {
			return;
		}
		const state = this.records.get(ticket.key)!;
		this.records.set(state.key, { ...state, revision: ++this.revision, inFlight: false, attempt: undefined, failure });
		this.publish();
	}

	noteFailure(requestId: string, failure: ConversationRespondFailure): void {
		const matches = [...this.records.values()].filter(state => state.identity.requestId === requestId);
		if (matches.length !== 1 || matches[0].blocked) {
			return;
		}
		const state = matches[0];
		if (!state.inFlight && state.failure?.retryable === failure.retryable && state.failure.error === failure.error) {
			return;
		}
		this.records.set(state.key, { ...state, incarnation: failure.retryable ? state.incarnation : ++this.incarnation, revision: ++this.revision, inFlight: false, attempt: undefined, blocked: !failure.retryable, failure });
		this.publish();
	}

	private publish(): void {
		const byRow = new Map<string, string>();
		for (const state of this.records.values()) {
			for (const id of state.rowIds) {
				byRow.set(id, state.key);
			}
		}
		this.current = { scope: this.scope, revision: ++this.revision, byRequest: new Map(this.records), byRow };
	}
}

/** Include old aliases too: retirement and remapping must invalidate the old DOM. */
export function conversationResponseChangedIds(before: ConversationResponseProjection, after: ConversationResponseProjection): ReadonlySet<string> {
	const changed = new Set<string>();
	for (const key of new Set([...before.byRequest.keys(), ...after.byRequest.keys()])) {
		if (before.scope === after.scope && before.byRequest.get(key) === after.byRequest.get(key)) {
			continue;
		}
		for (const state of [before.byRequest.get(key), after.byRequest.get(key)]) {
			for (const id of [...state?.rowIds ?? [], ...state?.pendingAliases ?? []]) {
				changed.add(id);
			}
		}
	}
	return changed;
}
