/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable, MutableDisposable } from '../../../../base/common/lifecycle.js';
import {
	updateRespondFailures,
	type ConversationRespondFailure,
	type ConversationViewFrame,
	type ConversationViewFrameApplied,
	type ItemAttribution,
} from '../../common/conversationViewFrame.js';
import {
	applyViewFrame,
	createEmptyReplica,
	type ReplicaCursor,
	type SessionViewSnapshot,
} from '../../common/sessionView/index.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import type { SessionViewHost } from '../../node/sessionViewHost.js';

export interface IMultiLeaseReplicaOptions {
	/**
	 * Mirror `EngineSessionViewLease.onHostFrame`: acknowledge each applied frame on the lease.
	 * Default `true`.
	 */
	readonly acknowledge?: boolean;
	/**
	 * Mirror `EngineSessionViewLease.requestResync()` when `applyViewFrame` returns `resyncRequired`.
	 * Default `false` so tests can observe the un-healed state; flip on for self-healing scenarios.
	 */
	readonly autoResync?: boolean;
}

/**
 * Renderer-side stand-in for one `EngineSessionViewLease`, driven against a real `SessionViewHost`.
 * Subscribes to the lease's frame stream and folds frames exactly like
 * `conversationEngineFrameSource.ts` `EngineSessionViewLease.onHostFrame`:
 * dedupe by `generation:frameId:version`, `applyViewFrame(replica, frame, cursor)`, then fold the
 * attribution, details, and respond-failure sidecars. A frame the cursor rejects is NOT applied and bumps `resyncCount`.
 */
export class MultiLeaseReplica extends Disposable {

	private _snapshot: SessionViewSnapshot;
	private _cursor: ReplicaCursor | null = null;
	private readonly _attribution = new Map<string, ItemAttribution>();
	private readonly _details = new Map<string, string>();
	private readonly _respondFailures = new Map<string, ConversationRespondFailure>();
	private readonly _events: IUniverseAgentSessionViewFrameEvent[] = [];
	private readonly _applied: ConversationViewFrameApplied[] = [];
	private readonly _cursorHistory: ReplicaCursor[] = [];
	private _resyncCount = 0;
	private _lastAppliedKey = '';
	private readonly _subscription = this._register(new MutableDisposable());

	constructor(
		private readonly viewHost: SessionViewHost,
		readonly leaseId: string,
		sessionId: string,
		private readonly options: IMultiLeaseReplicaOptions = {},
	) {
		super();
		this._snapshot = createEmptyReplica(sessionId as SessionViewSnapshot['sessionId']);
		this.resume();
	}

	/** Pre-subscribe frames flush on a microtask; await this after construction / resume before asserting. */
	async whenSubscribed(): Promise<void> {
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
	}

	/**
	 * Drop the frame subscription while keeping replica state (models a renderer that stopped
	 * listening). The host keeps buffering this lease's frames (bounded by `pendingFrameLimit`).
	 */
	pause(): void {
		this._subscription.clear();
	}

	/** Re-attach to the lease; buffered frames (or an overflow-triggered baseline) flush on a microtask. */
	resume(): void {
		this._subscription.value = this.viewHost.onDynamicDidApplyFrame(this.leaseId)(
			event => this.onHostFrame(event.frame, event.applied, event));
	}

	get snapshot(): SessionViewSnapshot { return this._snapshot; }
	get cursor(): ReplicaCursor | null { return this._cursor; }
	get attribution(): ReadonlyMap<string, ItemAttribution> { return this._attribution; }
	get details(): ReadonlyMap<string, string> { return this._details; }
	get respondFailures(): ReadonlyMap<string, ConversationRespondFailure> { return this._respondFailures; }
	/** Every raw host frame event delivered to this lease (including rejected ones). */
	get events(): readonly IUniverseAgentSessionViewFrameEvent[] { return this._events; }
	/** `applied` descriptors for frames that were accepted into the replica. */
	get appliedFrames(): readonly ConversationViewFrameApplied[] { return this._applied; }
	/** Cursor after each accepted frame, in order. */
	get cursorHistory(): readonly ReplicaCursor[] { return this._cursorHistory; }
	/** Number of frames `applyViewFrame` rejected with `resyncRequired`. */
	get resyncCount(): number { return this._resyncCount; }
	get resyncRequired(): boolean { return this._resyncCount > 0; }

	/** Comparable view used for deep-equal convergence checks (cursor excluded on purpose). */
	toComparable(): {
		readonly snapshot: SessionViewSnapshot;
		readonly attribution: ReadonlyArray<readonly [string, ItemAttribution]>;
		readonly details: ReadonlyArray<readonly [string, string]>;
		readonly respondFailures: ReadonlyArray<readonly [string, ConversationRespondFailure]>;
	} {
		const byKey = <T>(a: readonly [string, T], b: readonly [string, T]) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
		return {
			snapshot: this._snapshot,
			attribution: [...this._attribution.entries()].sort(byKey),
			details: [...this._details.entries()].sort(byKey),
			respondFailures: [...this._respondFailures.entries()].sort(byKey),
		};
	}

	private onHostFrame(frame: ConversationViewFrame, applied: ConversationViewFrameApplied, event: IUniverseAgentSessionViewFrameEvent): void {
		this._events.push(event);
		const key = `${frame.frame.generation}:${frame.frame.frameId}:${frame.frame.version}`;
		if (this._lastAppliedKey === key) {
			return;
		}
		const result = applyViewFrame(this._snapshot, frame.frame, this._cursor);
		const next = result as Partial<{ next: SessionViewSnapshot; cursor: ReplicaCursor }>;
		if (next.next === undefined || next.cursor === undefined) {
			this._resyncCount += 1;
			if (this.options.autoResync) {
				this.viewHost.requestResync(this.leaseId);
			}
			return;
		}
		this._lastAppliedKey = key;
		this._snapshot = next.next;
		this._cursor = next.cursor;
		this._cursorHistory.push(next.cursor);
		this._applied.push(applied);
		for (const patch of frame.attribution ?? []) {
			if (patch.op === 'upsertAttribution') {
				this._attribution.set(patch.itemId, patch.attribution);
			} else {
				this._attribution.delete(patch.itemId);
			}
		}
		for (const patch of frame.details ?? []) {
			if (patch.op === 'upsertDetail') {
				this._details.set(patch.ref, patch.body);
			} else {
				this._details.delete(patch.ref);
			}
		}
		updateRespondFailures(this._respondFailures, frame.frame);
		if (this.options.acknowledge !== false) {
			this.viewHost.acknowledge(this.leaseId, {
				generation: next.cursor.generation,
				frameId: next.cursor.frameId,
				appliedVersion: next.cursor.version,
			});
		}
	}
}
