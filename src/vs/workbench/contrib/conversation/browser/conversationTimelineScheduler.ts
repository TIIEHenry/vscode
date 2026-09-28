/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getWindow, runAtThisOrScheduleAtNextAnimationFrame } from '../../../../base/browser/dom.js';
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

export interface ConversationTimelineFlush {
	readonly applied?: ConversationViewFrameApplied;
	readonly sidecar: boolean;
	readonly effects: readonly ViewEffect[];
}

export type ConversationTimelineFrameHandle = { cancel(): void; };
export type ConversationTimelineScheduleFrame = (run: () => void) => ConversationTimelineFrameHandle;

const FRAME_FALLBACK_MS = 16;

/**
 * First of rAF and a 16ms timer runs `run` once and cancels the other.
 * Headless tests and background windows still advance on the timer.
 */
function scheduleOnAnimationFrameOrTimeout(run: () => void): ConversationTimelineFrameHandle {
	let settled = false;
	let animationFrame: { dispose(): void } | undefined;
	const timer = setTimeout(() => {
		if (settled) {
			return;
		}
		settled = true;
		animationFrame?.dispose();
		run();
	}, FRAME_FALLBACK_MS);
	animationFrame = runAtThisOrScheduleAtNextAnimationFrame(getWindow(document.body), () => {
		if (settled) {
			return;
		}
		settled = true;
		clearTimeout(timer);
		run();
	});
	return {
		cancel() {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			animationFrame?.dispose();
		},
	};
}

/**
 * One flush per animation frame. Baseline is not a synchronous flush and does not
 * drop effects already queued in the same window.
 */
function toConversationTimelineFlush(frames: readonly ConversationViewFrameApplied[], sidecar: boolean): ConversationTimelineFlush {
	const hadPatches = frames.some(frame => frame.kind === 'patches');
	let applied: ConversationViewFrameApplied | undefined;
	let effects: readonly ViewEffect[] = [];
	for (const frame of mergeSessionViewFrames(frames)) {
		if (frame.kind === 'effects') {
			effects = frame.effects;
		} else if (frame.kind === 'baseline') {
			applied = frame;
		} else if (applied?.kind !== 'baseline' && (hadPatches || frame.changedIds.size > 0)) {
			// merge emits an empty patches frame whenever the effects list is empty,
			// including a window that never received a patch. Keep that frame only
			// when patches were actually pushed (ids may still be empty).
			applied = frame;
		}
	}
	if (hadPatches && applied === undefined) {
		applied = { kind: 'patches', changedIds: new Set<string>() };
	}
	return { applied, sidecar, effects };
}

export class ConversationTimelineFrameScheduler extends Disposable {

	private pending: ConversationViewFrameApplied[] = [];
	private sidecarDirty = false;
	private frameHandle: ConversationTimelineFrameHandle | undefined;
	private readonly scheduleFrame: ConversationTimelineScheduleFrame;

	constructor(
		private readonly onFlush: (flush: ConversationTimelineFlush) => void,
		scheduleFrame?: ConversationTimelineScheduleFrame,
	) {
		super();
		this.scheduleFrame = scheduleFrame ?? scheduleOnAnimationFrameOrTimeout;
	}

	push(applied: ConversationViewFrameApplied): void {
		if (this._store.isDisposed) {
			return;
		}
		this.pending.push(normalizeSessionViewFrameApplied(applied));
		this.ensureScheduled();
	}

	markSidecarDirty(): void {
		if (this._store.isDisposed) {
			return;
		}
		this.sidecarDirty = true;
		this.ensureScheduled();
	}

	override dispose(): void {
		this.frameHandle?.cancel();
		this.frameHandle = undefined;
		this.pending = [];
		this.sidecarDirty = false;
		super.dispose();
	}

	private ensureScheduled(): void {
		if (this._store.isDisposed || this.frameHandle) {
			return;
		}
		let active = true;
		const handle = this.scheduleFrame(() => {
			if (!active) {
				return;
			}
			active = false;
			this.frameHandle = undefined;
			this.flush();
		});
		if (!active) {
			return;
		}
		this.frameHandle = {
			cancel() {
				if (!active) {
					return;
				}
				active = false;
				handle.cancel();
			},
		};
	}

	private flush(): void {
		const frames = this.pending;
		const sidecar = this.sidecarDirty;
		this.pending = [];
		this.sidecarDirty = false;
		this.onFlush(toConversationTimelineFlush(frames, sidecar));
	}
}
