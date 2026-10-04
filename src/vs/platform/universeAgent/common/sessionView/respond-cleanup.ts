/**
 * Renderer-side copy of SessionActor `permissionRespondCleanupPatches` /
 * `questionRespondCleanupPatches`. The engine unary path cannot enter those
 * actor methods without also enqueueing a chat-stream respond. Same patches:
 * write the decision or answered row, then remove the pending action.
 * Exact-canonical ids only; no trim-write. Missing decision / answers does
 * not invent a timeline row.
 */

import type { ClientActionRequestId, PendingActionView, SessionViewSnapshot, TimelineItemId, TimelineItemView, ViewPatch } from './types.js';

export interface PermissionRespondCleanupInput {
	readonly requestId: string;
	readonly decision: 'allow' | 'deny';
}

export interface QuestionRespondCleanupInput {
	readonly questionId: string;
	readonly answers?: Readonly<Record<string, { readonly selectedLabels: readonly string[] }>>;
}

function isExactRespondTimelineIdentity(value: string): boolean {
	return value.length > 0 && value === value.trim();
}

function hasQuestionRespondAnswers(answers: QuestionRespondCleanupInput['answers']): boolean {
	return typeof answers === 'object' && answers !== null && !Array.isArray(answers);
}

function timelineItemFromPermissionDecision(
	requestId: string,
	decision: 'allow' | 'deny',
	existing: TimelineItemView,
): TimelineItemView | undefined {
	if (!isExactRespondTimelineIdentity(requestId)) {
		return undefined;
	}
	if (String(existing.id) !== requestId) {
		return undefined;
	}
	if (existing.summary.kind !== 'permission') {
		return undefined;
	}
	const prev = existing.summary;
	return {
		...existing,
		summary: {
			kind: 'permission',
			title: prev.title,
			permissionKind: prev.permissionKind,
			...(prev.argPreview !== undefined ? { argPreview: prev.argPreview } : {}),
			...(prev.optionsPreview !== undefined ? { optionsPreview: prev.optionsPreview } : {}),
			decision,
		},
	};
}

function questionSummaryFromPrev(prev: Extract<TimelineItemView['summary'], { kind: 'question' }>): Extract<TimelineItemView['summary'], { kind: 'question' }> {
	return {
		kind: 'question',
		title: prev.title,
		items: prev.items,
		answerKeysValid: prev.answerKeysValid,
		...(prev.optionsPreview !== undefined ? { optionsPreview: prev.optionsPreview } : {}),
		...(prev.multiSelect !== undefined ? { multiSelect: prev.multiSelect } : {}),
		...(prev.allowCustom !== undefined ? { allowCustom: prev.allowCustom } : {}),
		answered: true,
	};
}

function timelineItemFromQuestionAnswered(
	questionId: string,
	existing: TimelineItemView,
): TimelineItemView | undefined {
	if (!isExactRespondTimelineIdentity(questionId)) {
		return undefined;
	}
	if (String(existing.id) !== questionId) {
		return undefined;
	}
	if (existing.summary.kind !== 'question') {
		return undefined;
	}
	return {
		...existing,
		summary: questionSummaryFromPrev(existing.summary),
	};
}

function timelineItemFromQuestionPending(
	questionId: string,
	pending: PendingActionView,
): TimelineItemView | undefined {
	if (!isExactRespondTimelineIdentity(questionId)) {
		return undefined;
	}
	if (String(pending.requestId) !== questionId) {
		return undefined;
	}
	if (pending.summary.kind !== 'question') {
		return undefined;
	}
	return {
		id: pending.requestId as unknown as TimelineItemId,
		orderKey: String(pending.requestId),
		summary: questionSummaryFromPrev(pending.summary),
		...(pending.agentId !== undefined ? { agentId: pending.agentId } : {}),
	};
}

export function permissionRespondCleanupPatches(
	snapshot: SessionViewSnapshot,
	fact: PermissionRespondCleanupInput,
): readonly ViewPatch[] {
	const patches: ViewPatch[] = [];
	if (isExactRespondTimelineIdentity(fact.requestId)) {
		const existing = snapshot.timeline.find(item => String(item.id) === fact.requestId);
		if (existing !== undefined) {
			const item = timelineItemFromPermissionDecision(fact.requestId, fact.decision, existing);
			if (item !== undefined) {
				patches.push({ op: 'upsertTimelineItem', item });
			}
		}
	}
	patches.push({
		op: 'removePendingAction',
		requestId: fact.requestId as ClientActionRequestId,
	});
	return patches;
}

export function questionRespondCleanupPatches(
	snapshot: SessionViewSnapshot,
	fact: QuestionRespondCleanupInput,
): readonly ViewPatch[] {
	const patches: ViewPatch[] = [];
	if (isExactRespondTimelineIdentity(fact.questionId) && hasQuestionRespondAnswers(fact.answers)) {
		const existingTimeline = snapshot.timeline.find(item => String(item.id) === fact.questionId);
		if (existingTimeline !== undefined) {
			const item = timelineItemFromQuestionAnswered(fact.questionId, existingTimeline);
			if (item !== undefined) {
				patches.push({ op: 'upsertTimelineItem', item });
			}
		} else {
			const pending = snapshot.pendingActions.find(action => String(action.requestId) === fact.questionId);
			if (pending !== undefined) {
				const item = timelineItemFromQuestionPending(fact.questionId, pending);
				if (item !== undefined) {
					patches.push({ op: 'upsertTimelineItem', item });
				}
			}
		}
	}
	patches.push({
		op: 'removePendingAction',
		requestId: fact.questionId as ClientActionRequestId,
	});
	return patches;
}
