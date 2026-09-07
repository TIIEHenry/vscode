/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Iterable } from '../../../../base/common/iterator.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import type { ConversationViewFrameApplied } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { ViewEffect } from '../../../../platform/universeAgent/common/sessionView/index.js';

/** IPC / JSON may deliver changedIds as array, plain object, or undefined instead of Set. */
export function normalizeSessionViewChangedIds(raw: unknown): Set<string> {
	const ids = new Set<string>();
	if (raw === undefined || raw === null) {
		return ids;
	}
	if (raw instanceof Set) {
		for (const id of raw) {
			ids.add(String(id));
		}
		return ids;
	}
	if (Array.isArray(raw)) {
		for (const id of raw) {
			ids.add(String(id));
		}
		return ids;
	}
	if (Iterable.is<string>(raw)) {
		for (const id of raw) {
			ids.add(String(id));
		}
		return ids;
	}
	if (typeof raw === 'object') {
		const record = raw as Record<string, unknown>;
		const keys = Object.keys(record);
		const looksLikeArray = keys.length > 0 && keys.every((key, index) => key === String(index));
		if (looksLikeArray) {
			for (const value of Object.values(record)) {
				ids.add(String(value));
			}
		} else {
			for (const key of keys) {
				ids.add(String(key));
			}
		}
	}
	return ids;
}

export function normalizeSessionViewFrameApplied(applied: ConversationViewFrameApplied): ConversationViewFrameApplied {
	if (applied.kind !== 'patches') {
		return applied;
	}
	return { kind: 'patches', changedIds: normalizeSessionViewChangedIds(applied.changedIds) };
}

const FRAME_COALESCE_MS = 16;

/**
 * Merges same-frame session view applies before the timeline consumes them (plan §3.4).
 */
export class ConversationSessionViewFrameCoalescer extends Disposable {

	private pending: ConversationViewFrameApplied[] = [];
	private handle: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly flush: (merged: ConversationViewFrameApplied) => void) {
		super();
	}

	push(applied: ConversationViewFrameApplied): void {
		applied = normalizeSessionViewFrameApplied(applied);
		if (applied.kind === 'baseline') {
			if (this.handle !== undefined) {
				clearTimeout(this.handle);
				this.handle = undefined;
			}
			this.pending = [];
			this.flush(applied);
			return;
		}
		this.pending.push(applied);
		if (this.handle !== undefined) {
			return;
		}
		this.handle = setTimeout(() => {
			this.handle = undefined;
			const batch = this.pending;
			this.pending = [];
			for (const merged of mergeSessionViewFrames(batch)) {
				this.flush(merged);
			}
		}, FRAME_COALESCE_MS);
	}

	override dispose(): void {
		if (this.handle !== undefined) {
			clearTimeout(this.handle);
			this.handle = undefined;
		}
		this.pending = [];
		super.dispose();
	}
}

/**
 * Merges one coalesce window into the applies the timeline consumes. Patches and effects
 * cannot travel in one apply, so a mixed window flushes twice: effects carry one-shot
 * notices (outbox overflow / flush timeout / send failure, plan §3.5) and dropping them
 * would silently hide a failed send.
 */
export function mergeSessionViewFrames(frames: readonly ConversationViewFrameApplied[]): ConversationViewFrameApplied[] {
	const effects: ViewEffect[] = [];
	const changedIds = new Set<string>();
	let hasBaseline = false;
	for (const frame of frames) {
		if (frame.kind === 'baseline') {
			hasBaseline = true;
		} else if (frame.kind === 'effects') {
			effects.push(...frame.effects);
		} else {
			for (const id of normalizeSessionViewChangedIds(frame.changedIds)) {
				changedIds.add(id);
			}
		}
	}

	const merged: ConversationViewFrameApplied[] = [];
	if (hasBaseline) {
		merged.push({ kind: 'baseline' });
	} else if (changedIds.size > 0 || effects.length === 0) {
		merged.push({ kind: 'patches', changedIds });
	}
	if (effects.length > 0) {
		merged.push({ kind: 'effects', effects });
	}
	return merged;
}
