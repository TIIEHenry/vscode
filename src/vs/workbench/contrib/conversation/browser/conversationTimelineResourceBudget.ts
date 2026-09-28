/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';

/** One screen above and below the scrollport. Heavy resources mount only inside this band. */
export const CONVERSATION_TIMELINE_RESOURCE_ROOT_MARGIN = '100% 0px';

export const CONVERSATION_TIMELINE_MAX_DIFF_EDITORS = 6;
export const CONVERSATION_TIMELINE_MAX_WEBVIEWS = 4;

export type ConversationTimelineResourceKind = 'diff' | 'webview';

export interface ConversationTimelineVisibilityEntry {
	readonly target: Element;
	readonly isIntersecting: boolean;
}

export interface ConversationTimelineVisibilityObserver {
	observe(target: Element): void;
	unobserve(target: Element): void;
	disconnect(): void;
}

export type ConversationTimelineVisibilityObserverFactory = (
	callback: (entries: readonly ConversationTimelineVisibilityEntry[]) => void,
	options: { readonly root: Element | null; readonly rootMargin: string },
) => ConversationTimelineVisibilityObserver;

/**
 * A heavy timeline resource. `unmount` must leave a same-height placeholder
 * and return that height in pixels. The budget decides when, not how.
 */
export interface ConversationTimelineResourceClaim {
	readonly id: string;
	readonly kind: ConversationTimelineResourceKind;
	readonly element: HTMLElement;
	mount(): void;
	unmount(): number;
}

export interface ConversationTimelineResourceBudgetOptions {
	readonly root: Element | null;
	readonly maxDiffEditors?: number;
	readonly maxWebviews?: number;
	readonly createObserver?: ConversationTimelineVisibilityObserverFactory;
}

interface ClaimRecord {
	readonly claim: ConversationTimelineResourceClaim;
	near: boolean;
	mounted: boolean;
	lastNearSeq: number;
}

/**
 * Caps live DiffEditor and Mermaid webview instances (plan §3.4).
 * Near the viewport: mount, up to the cap, evicting the least-recently-near.
 * Far from the viewport: unmount. The claim owns the placeholder.
 */
export class ConversationTimelineResourceBudget extends Disposable {

	private readonly maxDiffEditors: number;
	private readonly maxWebviews: number;
	private readonly records = new Map<string, ClaimRecord>();
	private readonly observer: ConversationTimelineVisibilityObserver;
	private nearSeq = 0;

	constructor(options: ConversationTimelineResourceBudgetOptions) {
		super();
		this.maxDiffEditors = options.maxDiffEditors ?? CONVERSATION_TIMELINE_MAX_DIFF_EDITORS;
		this.maxWebviews = options.maxWebviews ?? CONVERSATION_TIMELINE_MAX_WEBVIEWS;
		const factory = options.createObserver ?? defaultVisibilityObserver;
		this.observer = factory(entries => this.onVisibility(entries), {
			root: options.root,
			rootMargin: CONVERSATION_TIMELINE_RESOURCE_ROOT_MARGIN,
		});
		this._register({ dispose: () => this.observer.disconnect() });
	}

	claim(claim: ConversationTimelineResourceClaim): void {
		const existing = this.records.get(claim.id);
		if (existing) {
			if (existing.mounted) {
				existing.claim.unmount();
			}
			this.observer.unobserve(existing.claim.element);
		}
		const record: ClaimRecord = {
			claim,
			near: existing?.near ?? false,
			mounted: false,
			lastNearSeq: existing?.lastNearSeq ?? 0,
		};
		this.records.set(claim.id, record);
		this.observer.observe(claim.element);
		if (record.near) {
			this.reconcile(claim.kind);
		}
	}

	release(id: string): void {
		const record = this.records.get(id);
		if (!record) {
			return;
		}
		if (record.mounted) {
			record.claim.unmount();
			record.mounted = false;
		}
		this.observer.unobserve(record.claim.element);
		this.records.delete(id);
	}

	/** Ids whose heavy resource is currently mounted. Test hook. */
	getMountedIds(): readonly string[] {
		const ids: string[] = [];
		for (const [id, record] of this.records) {
			if (record.mounted) {
				ids.push(id);
			}
		}
		return ids;
	}

	override dispose(): void {
		for (const record of this.records.values()) {
			if (record.mounted) {
				record.claim.unmount();
				record.mounted = false;
			}
		}
		this.records.clear();
		super.dispose();
	}

	private onVisibility(entries: readonly ConversationTimelineVisibilityEntry[]): void {
		const kinds = new Set<ConversationTimelineResourceKind>();
		for (const entry of entries) {
			const record = this.recordForElement(entry.target);
			if (!record) {
				continue;
			}
			record.near = entry.isIntersecting;
			if (entry.isIntersecting) {
				this.nearSeq++;
				record.lastNearSeq = this.nearSeq;
			}
			kinds.add(record.claim.kind);
		}
		for (const kind of kinds) {
			this.reconcile(kind);
		}
	}

	private reconcile(kind: ConversationTimelineResourceKind): void {
		const cap = kind === 'diff' ? this.maxDiffEditors : this.maxWebviews;
		const ofKind = [...this.records.values()].filter(record => record.claim.kind === kind);
		const keep = new Set(
			ofKind
				.filter(record => record.near)
				.sort((a, b) => b.lastNearSeq - a.lastNearSeq)
				.slice(0, cap),
		);
		for (const record of ofKind) {
			const shouldMount = keep.has(record);
			if (shouldMount && !record.mounted) {
				record.claim.mount();
				record.mounted = true;
			} else if (!shouldMount && record.mounted) {
				record.claim.unmount();
				record.mounted = false;
			}
		}
	}

	private recordForElement(target: Element): ClaimRecord | undefined {
		for (const record of this.records.values()) {
			if (record.claim.element === target) {
				return record;
			}
		}
		return undefined;
	}
}

function defaultVisibilityObserver(
	callback: (entries: readonly ConversationTimelineVisibilityEntry[]) => void,
	options: { readonly root: Element | null; readonly rootMargin: string },
): ConversationTimelineVisibilityObserver {
	if (typeof IntersectionObserver !== 'function') {
		return { observe() { }, unobserve() { }, disconnect() { } };
	}
	const observer = new IntersectionObserver(entries => {
		callback(entries.map(entry => ({ target: entry.target, isIntersecting: entry.isIntersecting })));
	}, { root: options.root, rootMargin: options.rootMargin });
	return observer;
}
