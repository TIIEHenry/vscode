/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import type {
	PostOutcome,
	ConversationViewFrameApplied,
	ConversationWriteMessage,
	ItemAttribution,
	IConversationSessionViewLease,
	ConversationViewFrame,
	IConversationViewFrameSource,
} from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import {
	applyViewFrame,
	createEmptyReplica,
	type ReplicaCursor,
	type SessionId,
	type SessionViewSnapshot,
	type ViewFrame,
	type ViewLeaseId,
} from '../../../../platform/universeAgent/common/sessionView/index.js';
import { ConversationSessionViewProjection, diffProjections, stubTurnsToSnapshot } from './conversationSessionView.js';
import { ConversationStubModel } from './conversationStubModel.js';

/**
 * No-engine frame source (dev/plans/conversation-stream-timeline.md §3.6).
 *
 * Projects stub fixture turns into session-core `ViewFrame`s so the timeline has a
 * single render path. Every model mutation (signalled through the roster's
 * `onDidChangeSession`) is diffed by id into idempotent patches and applied to each
 * lease's replica through the vendored `applyViewFrame`. The stub never reports
 * `sync: live`, never streams, and marks every non-user row as Stub via attribution
 * (PRD-007 / PRD-013.4).
 */
export class ConversationStubFrameSource extends Disposable implements IConversationViewFrameSource {

	private readonly leases = new Map<string, Set<StubSessionViewLease>>();
	private nextLeaseId = 1;

	constructor(
		private readonly model: ConversationStubModel,
		onDidChangeSession: Event<string>,
	) {
		super();
		this._register(onDidChangeSession(sessionId => this.refresh(sessionId)));
	}

	acquire(sessionId: string): IConversationSessionViewLease {
		const leaseId = `stub-lease-${this.nextLeaseId++}` as ViewLeaseId;
		const lease = new StubSessionViewLease(sessionId, leaseId, this);
		let set = this.leases.get(sessionId);
		if (!set) {
			set = new Set();
			this.leases.set(sessionId, set);
		}
		set.add(lease);
		return lease;
	}

	/** @internal */
	release(lease: StubSessionViewLease): void {
		const set = this.leases.get(lease.sessionId);
		set?.delete(lease);
		if (set && set.size === 0) {
			this.leases.delete(lease.sessionId);
		}
	}

	/** @internal */
	project(sessionId: string): ConversationSessionViewProjection {
		return stubTurnsToSnapshot(sessionId, this.model.getTurns(sessionId));
	}

	/** @internal */
	write(sessionId: string, msg: ConversationWriteMessage): PostOutcome {
		if (!this.model.getSessions().some(session => session.id === sessionId)) {
			return { accepted: false, reason: 'no_such_session' };
		}
		switch (msg.kind) {
			case 'submitInput':
				this.model.appendUserTurn(sessionId, msg.text);
				this.model.appendStubEchoAssistant(sessionId, localize('conversationLens.stubEcho', "Stub echo — no engine connected."));
				break;
			case 'permissionRespond':
				this.model.resolveConfirmation(sessionId, msg.requestId, msg.decision === 'allow' ? 'allowed' : 'skipped');
				break;
			case 'questionRespond':
			case 'clientToolRespond':
				// The stub fixture has no ask-user questions or client tools; accept as a no-op, never invent a record.
				break;
		}
		this.refresh(sessionId);
		return { accepted: true, correlation: { id: `stub:${sessionId}:${Date.now()}` } };
	}

	private refresh(sessionId: string): void {
		const set = this.leases.get(sessionId);
		if (!set) {
			return;
		}
		const next = this.project(sessionId);
		for (const lease of set) {
			lease.reconcile(next);
		}
	}
}

class StubSessionViewLease extends Disposable implements IConversationSessionViewLease {

	private replica: SessionViewSnapshot;
	private cursor: ReplicaCursor | null = null;
	private generation = 0;
	private frameId = 0;
	private producerProjection: ConversationSessionViewProjection;
	private readonly _attribution = new Map<string, ItemAttribution>();
	private readonly _details = new Map<string, string>();
	private readonly _onDidApplyFrame = this._register(new Emitter<ConversationViewFrameApplied>());
	readonly onDidApplyFrame = this._onDidApplyFrame.event;
	private readonly lifetime = this._register(new DisposableStore());

	constructor(
		readonly sessionId: string,
		private readonly leaseId: ViewLeaseId,
		private readonly source: ConversationStubFrameSource,
	) {
		super();
		this.replica = createEmptyReplica(sessionId as SessionId);
		this.producerProjection = source.project(sessionId);
		this.applyBaseline(this.producerProjection);
		this.lifetime.add({ dispose: () => source.release(this) });
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
		return this.source.write(this.sessionId, msg);
	}

	requestResync(): void {
		this.producerProjection = this.source.project(this.sessionId);
		this.applyBaseline(this.producerProjection);
	}

	/** @internal */
	reconcile(next: ConversationSessionViewProjection): void {
		const diff = diffProjections(this.producerProjection, next);
		this.producerProjection = next;
		if (diff.patches.length === 0 && diff.attribution.length === 0 && diff.details.length === 0) {
			return;
		}
		this.frameId += 1;
		const frame: ViewFrame = {
			leaseId: this.leaseId,
			generation: this.generation,
			frameId: this.frameId,
			version: this.frameId,
			body: { kind: 'patches', patches: diff.patches },
		};
		this.applyFrame({ frame, attribution: diff.attribution, details: diff.details }, diff.changedIds);
	}

	private applyBaseline(projection: ConversationSessionViewProjection): void {
		this.generation += 1;
		this.frameId = 0;
		const frame: ViewFrame = {
			leaseId: this.leaseId,
			generation: this.generation,
			frameId: 0,
			version: 0,
			body: { kind: 'baseline', snapshot: projection.snapshot },
		};
		this._attribution.clear();
		this._details.clear();
		this.applyFrame({
			frame,
			attribution: [...projection.attribution].map(([itemId, attribution]) => ({ op: 'upsertAttribution', itemId, attribution })),
			details: [...projection.details].map(([ref, body]) => ({ op: 'upsertDetail', ref, body })),
		}, undefined);
	}

	private applyFrame(frame: ConversationViewFrame, changedIds: ReadonlySet<string> | undefined): void {
		const result = applyViewFrame(this.replica, frame.frame, this.cursor);
		const applied = result as Partial<{ next: SessionViewSnapshot; cursor: ReplicaCursor }>;
		if (applied.next === undefined || applied.cursor === undefined) {
			this.requestResync();
			return;
		}
		this.replica = applied.next;
		this.cursor = applied.cursor;
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
		if (frame.frame.body.kind === 'baseline') {
			this._onDidApplyFrame.fire({ kind: 'baseline' });
		} else if (frame.frame.body.kind === 'patches') {
			this._onDidApplyFrame.fire({ kind: 'patches', changedIds: changedIds ?? new Set() });
		} else {
			this._onDidApplyFrame.fire({ kind: 'effects', effects: frame.frame.body.effects });
		}
	}
}
