/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import type {
	PostOutcome,
	ConversationViewFrameApplied,
	ConversationWriteMessage,
	DetailFetchOutcome,
	ItemAttribution,
	IConversationSessionViewLease,
	ConversationViewFrame,
	IConversationViewFrameSource,
} from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { IUniverseAgentSessionView } from '../../../../platform/universeAgent/common/universeAgentSessionView.js';
import {
	applyViewFrame,
	createEmptyReplica,
	type ReplicaCursor,
	type SessionViewSnapshot,
} from '../../../../platform/universeAgent/common/sessionView/index.js';
import { type ConversationSessionViewProjection } from '../../../contrib/conversation/browser/conversationSessionView.js';

/**
 * Engine-backed frame source (stream-timeline S4): proxies lease + frames from
 * electron-main SessionViewHost over IUniverseAgentSessionView.
 */
export class ConversationEngineFrameSource extends Disposable implements IConversationViewFrameSource {

	private readonly leases = new Map<string, EngineSessionViewLease>();

	constructor(
		private readonly sessionView: IUniverseAgentSessionView,
	) {
		super();
		this._register(sessionView.onDidApplyFrame(event => {
			const lease = this.leases.get(event.leaseId);
			lease?.onHostFrame(event.frame, event.applied);
		}));
	}

	acquire(sessionId: string): IConversationSessionViewLease {
		const lease = new EngineSessionViewLease(
			sessionId,
			this.sessionView,
			released => this.leases.delete(released),
			acquired => this.leases.set(acquired, lease),
		);
		return lease;
	}

	/** Last replica for a session when a lease is still held (UA disconnect cache). */
	getCachedProjection(sessionId: string): ConversationSessionViewProjection | undefined {
		for (const lease of this.leases.values()) {
			if (lease.sessionId === sessionId) {
				return {
					snapshot: lease.snapshot,
					attribution: lease.attribution,
					details: lease.details,
				};
			}
		}
		return undefined;
	}
}

class EngineSessionViewLease extends Disposable implements IConversationSessionViewLease {

	private replica: SessionViewSnapshot = createEmptyReplica('pending' as SessionViewSnapshot['sessionId']);
	private cursor: ReplicaCursor | null = null;
	private readonly _attribution = new Map<string, ItemAttribution>();
	private readonly _details = new Map<string, string>();
	private readonly _onDidApplyFrame = this._register(new Emitter<ConversationViewFrameApplied>());
	readonly onDidApplyFrame = this._onDidApplyFrame.event;
	private readonly lifetime = this._register(new DisposableStore());
	leaseId = '';
	private connected = false;
	private readonly ready: Promise<void>;

	constructor(
		readonly sessionId: string,
		private readonly sessionView: IUniverseAgentSessionView,
		private readonly onRelease: (leaseId: string) => void,
		private readonly onAcquired: (leaseId: string) => void,
	) {
		super();
		this.ready = this.sessionView.acquireLease(sessionId).then(id => {
			this.leaseId = id;
			this.connected = true;
			this.onAcquired(id);
		});
		this.lifetime.add({ dispose: () => {
			if (this.leaseId) {
				void this.sessionView.releaseLease(this.leaseId);
				this.onRelease(this.leaseId);
			}
		} });
	}

	get snapshot(): SessionViewSnapshot {
		return this.replica;
	}

	get attribution(): ReadonlyMap<string, ItemAttribution> {
		return this._attribution;
	}

	get details(): ReadonlyMap<string, string> {
		return this._details;
	}

	post(msg: ConversationWriteMessage): PostOutcome {
		if (!this.connected || !this.leaseId) {
			void this.ready.then(() => void this.sessionView.post(this.leaseId, msg));
			return { accepted: true, correlation: { id: `pending:${Date.now()}` } };
		}
		void this.sessionView.post(this.leaseId, msg);
		return { accepted: true, correlation: { id: `post:${Date.now()}` } };
	}

	requestResync(): void {
		if (this.leaseId) {
			void this.sessionView.requestResync(this.leaseId);
		}
	}

	async requestDetail(ref: string): Promise<DetailFetchOutcome> {
		try {
			await this.ready;
		} catch {
			return { ok: false, reason: 'failed', message: 'lease acquire failed' };
		}
		if (!this.leaseId) {
			return { ok: false, reason: 'failed', message: 'lease not acquired' };
		}
		let outcome: DetailFetchOutcome;
		try {
			outcome = await this.sessionView.requestDetail(this.leaseId, ref);
		} catch {
			return { ok: false, reason: 'failed' };
		}
		if (outcome.ok && outcome.content !== undefined) {
			this._details.set(ref, outcome.content);
		}
		return outcome;
	}

	/** @internal */
	onHostFrame(frame: ConversationViewFrame, applied: ConversationViewFrameApplied): void {
		const result = applyViewFrame(this.replica, frame.frame, this.cursor);
		const next = result as Partial<{ next: SessionViewSnapshot; cursor: ReplicaCursor }>;
		if (next.next === undefined || next.cursor === undefined) {
			this.requestResync();
			return;
		}
		this.replica = next.next;
		this.cursor = next.cursor;
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
		this._onDidApplyFrame.fire(applied);
	}

	override dispose(): void {
		this.lifetime.dispose();
		super.dispose();
	}
}
