/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import {
	updateRespondFailures,
	type PostOutcome,
	type ConversationViewFrameApplied,
	type ConversationWriteMessage,
	type DetailFetchOutcome,
	type ItemAttribution,
	type IConversationSessionViewLease,
	type ConversationRespondFailure,
	type ConversationViewFrame,
	type IConversationViewFrameSource,
} from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { IUniverseAgentSessionView } from '../../../../platform/universeAgent/common/universeAgentSessionView.js';
import {
	applyViewFrame,
	applyViewPatches,
	createEmptyReplica,
	type ReplicaCursor,
	type SessionViewSnapshot,
	type ViewPatch,
} from '../../../../platform/universeAgent/common/sessionView/index.js';
import { type ConversationSessionViewProjection } from '../../../contrib/conversation/browser/conversationSessionView.js';
import { normalizeSessionViewFrameApplied } from './conversationTimelineScheduler.js';

/**
 * One host {@link IUniverseAgentSessionView.acquireLease} per client session id (F3 / D22).
 * Frames fan out to every UI consumer; host release runs only after the last consumer disposes.
 */
class SharedEngineHostBinding {

	refCount = 0;
	leaseId = '';
	bindSucceeded = false;
	bindFinished = false;
	bindOk = false;
	boundEngineSessionId = '';

	private readonly frameLifetime = new DisposableStore();
	private readonly consumers = new Set<EngineSessionViewLease>();
	private bindPromise: Promise<boolean> | undefined;
	private hostReleased = false;

	readonly acquired: Promise<string | undefined>;

	constructor(
		readonly sessionId: string,
		private readonly sessionView: IUniverseAgentSessionView,
		private readonly onEmpty: () => void,
	) {
		this.acquired = sessionView.acquireLease(sessionId).then(id => {
			if (this.refCount === 0) {
				this.releaseHost(id);
				return undefined;
			}
			this.leaseId = id;
			this.frameLifetime.add(sessionView.onDynamicDidApplyFrame(id)(event => {
				for (const consumer of this.consumers) {
					if (!consumer.isDisposed()) {
						consumer.onHostFrame(event.frame, event.applied);
					}
				}
			}));
			for (const consumer of this.consumers) {
				if (!consumer.isDisposed()) {
					consumer.onHostLeaseId(id);
				}
			}
			return id;
		}, () => undefined);
	}

	addConsumer(consumer: EngineSessionViewLease): void {
		this.refCount++;
		this.consumers.add(consumer);
		if (this.leaseId) {
			consumer.onHostLeaseId(this.leaseId);
		}
	}

	removeConsumer(consumer: EngineSessionViewLease): void {
		this.consumers.delete(consumer);
		this.refCount--;
		if (this.refCount <= 0) {
			this.refCount = 0;
			this.teardown();
		}
	}

	whenBindReady(): Promise<boolean> {
		if (this.bindSucceeded && this.bindPromise) {
			return this.bindPromise;
		}
		if (this.bindPromise) {
			return this.bindPromise;
		}
		this.bindPromise = this.runBind();
		return this.bindPromise;
	}

	exposesCachedProjection(): boolean {
		if (this.bindSucceeded) {
			return true;
		}
		if (this.bindFinished && !this.bindOk) {
			return false;
		}
		return true;
	}

	private async runBind(): Promise<boolean> {
		const leaseId = await this.acquired;
		if (!leaseId || this.refCount === 0) {
			this.bindPromise = undefined;
			return false;
		}
		try {
			const engineSessionId = await this.sessionView.whenEngineSessionReady(this.sessionId);
			if (this.refCount === 0) {
				this.bindPromise = undefined;
				return false;
			}
			if (!engineSessionId) {
				this.bindPromise = undefined;
				this.bindFinished = true;
				this.bindOk = false;
				return false;
			}
			this.boundEngineSessionId = engineSessionId;
			this.bindSucceeded = true;
			this.bindFinished = true;
			this.bindOk = true;
			return true;
		} catch {
			this.bindPromise = undefined;
			if (this.refCount > 0) {
				this.bindFinished = true;
				this.bindOk = false;
			}
			return false;
		}
	}

	private teardown(): void {
		this.frameLifetime.dispose();
		if (this.leaseId) {
			this.releaseHost(this.leaseId);
		} else {
			void this.acquired.then(resolved => {
				if (resolved) {
					this.releaseHost(resolved);
				}
			});
		}
		this.onEmpty();
	}

	private releaseHost(leaseId: string): void {
		if (this.hostReleased) {
			return;
		}
		this.hostReleased = true;
		void this.sessionView.releaseLease(leaseId).catch(() => undefined);
	}
}

/**
 * Engine-backed frame source (stream-timeline S4): proxies lease + frames from
 * electron-main SessionViewHost over IUniverseAgentSessionView.
 */
export class ConversationEngineFrameSource extends Disposable implements IConversationViewFrameSource {

	private readonly hostBindings = new Map<string, SharedEngineHostBinding>();
	private readonly heldLeases = new Set<EngineSessionViewLease>();

	constructor(
		private readonly sessionView: IUniverseAgentSessionView,
	) {
		super();
	}

	acquire(sessionId: string): IConversationSessionViewLease {
		let binding = this.hostBindings.get(sessionId);
		if (!binding) {
			binding = new SharedEngineHostBinding(sessionId, this.sessionView, () => {
				this.hostBindings.delete(sessionId);
			});
			this.hostBindings.set(sessionId, binding);
		}
		const lease = new EngineSessionViewLease(
			sessionId,
			this.sessionView,
			binding,
			() => this.heldLeases.delete(lease),
			() => this.heldLeases.add(lease),
		);
		binding.addConsumer(lease);
		return lease;
	}

	whenLeaseBindReady(lease: IConversationSessionViewLease): Promise<boolean> | undefined {
		const candidate = lease as { whenBindReady?: () => Promise<boolean> };
		return candidate.whenBindReady?.();
	}

	boundEngineSessionId(lease: IConversationSessionViewLease): string | undefined {
		const candidate = lease as { boundEngineSessionId?: string };
		const id = candidate.boundEngineSessionId?.trim();
		return id || undefined;
	}

	/**
	 * Post on an already-held lease for `sessionId`. Returns undefined when this
	 * source does not currently hold one (caller may acquire).
	 */
	postIfHeld(sessionId: string, msg: ConversationWriteMessage): Promise<PostOutcome> | undefined {
		for (const lease of this.heldLeases) {
			if (lease.sessionId === sessionId) {
				return lease.post(msg);
			}
		}
		return undefined;
	}

	/**
	 * After an engine unary is accepted, fold respond-cleanup patches into every
	 * held replica for `sessionId` and notify seats. Does not post to the host.
	 */
	applyRespondCleanup(sessionId: string, build: (snapshot: SessionViewSnapshot) => readonly ViewPatch[]): void {
		const held = [...this.heldLeases].filter(lease => lease.sessionId === sessionId);
		for (const lease of held) {
			lease.applyLocalPatches(build(lease.snapshot));
		}
	}

	/** Last replica for a session when a lease is still held (UA disconnect cache). */
	getCachedProjection(sessionId: string): ConversationSessionViewProjection | undefined {
		for (const lease of this.heldLeases) {
			if (lease.sessionId === sessionId) {
				if (!lease.exposesCachedProjection()) {
					return undefined;
				}
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
	private readonly _respondFailures = new Map<string, ConversationRespondFailure>();
	private readonly _onDidApplyFrame = this._register(new Emitter<ConversationViewFrameApplied>());
	readonly onDidApplyFrame = this._onDidApplyFrame.event;
	leaseId = '';
	private readonly acquired: Promise<string | undefined>;

	get boundEngineSessionId(): string {
		return this.binding.boundEngineSessionId;
	}
	private disposed = false;

	constructor(
		readonly sessionId: string,
		private readonly sessionView: IUniverseAgentSessionView,
		private readonly binding: SharedEngineHostBinding,
		private readonly onRelease: () => void,
		private readonly onAcquired: () => void,
	) {
		super();
		this.acquired = binding.acquired.then(id => {
			if (this.disposed || !id) {
				return undefined;
			}
			this.leaseId = id;
			this.onAcquired();
			return id;
		});
	}

	isDisposed(): boolean {
		return this.disposed;
	}

	onHostLeaseId(id: string): void {
		if (!this.disposed) {
			this.leaseId = id;
		}
	}

	whenBindReady(): Promise<boolean> {
		return this.binding.whenBindReady();
	}

	/** Hide UA-disconnect cache after Create/Resume definitively failed. */
	exposesCachedProjection(): boolean {
		return this.binding.exposesCachedProjection();
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

	get respondFailures(): ReadonlyMap<string, ConversationRespondFailure> {
		return this._respondFailures;
	}

	async post(msg: ConversationWriteMessage): Promise<PostOutcome> {
		const leaseId = await this.acquired;
		if (!leaseId) {
			return { accepted: false, reason: 'no_such_session' };
		}
		const bound = await this.whenBindReady();
		if (!bound || !this.leaseId) {
			return { accepted: false, reason: 'no_such_session' };
		}
		try {
			return await this.sessionView.post(this.leaseId, msg);
		} catch {
			return { accepted: false, reason: 'no_such_session' };
		}
	}

	requestResync(): void {
		if (this.leaseId) {
			void this.sessionView.requestResync(this.leaseId).catch(() => undefined);
		}
	}

	async requestDetail(ref: string): Promise<DetailFetchOutcome> {
		const leaseId = await this.acquired;
		if (!leaseId) {
			return { ok: false, reason: 'failed', message: 'lease acquire failed' };
		}
		const bound = await this.whenBindReady();
		if (!bound || !this.leaseId) {
			return { ok: false, reason: 'failed', message: 'lease acquire failed' };
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

	private lastAppliedKey = '';

	/** Snapshot no-op patches still have to reach the seat. A baseline drops failures whose request is gone. */
	private noteRespondFailures(frame: ConversationViewFrame['frame']): void {
		updateRespondFailures(this._respondFailures, frame);
	}

	/** Local respond cleanup. A no-op slice does not repaint. Does not ack the host. */
	applyLocalPatches(patches: readonly ViewPatch[]): void {
		if (this.disposed || patches.length === 0) {
			return;
		}
		const next = applyViewPatches(this.replica, patches);
		if (respondCleanupUnchanged(this.replica, next)) {
			return;
		}
		this.replica = next;
		this.noteRespondFailures({
			leaseId: this.leaseId as ConversationViewFrame['frame']['leaseId'],
			generation: this.cursor?.generation ?? 0,
			frameId: this.cursor?.frameId ?? 0,
			version: this.cursor?.version ?? 0,
			body: { kind: 'patches', patches },
		});
		const changedIds = new Set<string>();
		for (const patch of patches) {
			changedIds.add(changedIdForRespondPatch(patch));
		}
		this._onDidApplyFrame.fire({ kind: 'patches', changedIds });
	}

	/** @internal */
	onHostFrame(frame: ConversationViewFrame, applied: ConversationViewFrameApplied): void {
		if (this.disposed) {
			return;
		}
		const key = `${frame.frame.generation}:${frame.frame.frameId}:${frame.frame.version}`;
		if (this.lastAppliedKey === key) {
			return;
		}
		const result = applyViewFrame(this.replica, frame.frame, this.cursor);
		const next = result as Partial<{ next: SessionViewSnapshot; cursor: ReplicaCursor }>;
		if (next.next === undefined || next.cursor === undefined) {
			this.requestResync();
			return;
		}
		this.lastAppliedKey = key;
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
		this.noteRespondFailures(frame.frame);
		this._onDidApplyFrame.fire(normalizeSessionViewFrameApplied(applied));
		if (this.leaseId) {
			void this.sessionView.acknowledge(this.leaseId, {
				generation: this.cursor.generation,
				frameId: this.cursor.frameId,
				appliedVersion: this.cursor.version,
			}).catch(onUnexpectedError).catch(onUnexpectedError);
		}
	}

	override dispose(): void {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.binding.removeConsumer(this);
		this.onRelease();
		super.dispose();
	}
}

function respondCleanupUnchanged(prev: SessionViewSnapshot, next: SessionViewSnapshot): boolean {
	return JSON.stringify(prev.timeline) === JSON.stringify(next.timeline)
		&& JSON.stringify(prev.pendingActions) === JSON.stringify(next.pendingActions);
}

function changedIdForRespondPatch(patch: ViewPatch): string {
	switch (patch.op) {
		case 'upsertTimelineItem':
			return String(patch.item.id);
		case 'removePendingAction':
			return `pending:${String(patch.requestId)}`;
		default:
			return 'sync';
	}
}
