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
import { ConversationResponseState, conversationResponseChangedIds, conversationResponseSemanticChanged, type ConversationResponseKind, type ConversationResponseProjection, type ConversationResponseBegin } from '../../../../platform/universeAgent/common/conversationResponseState.js';
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

	private replica: SessionViewSnapshot = createEmptyReplica('pending' as SessionViewSnapshot["sessionId"]);
	private cursor: ReplicaCursor | null = null;
	private readonly _attribution = new Map<string, ItemAttribution>();
	private readonly _details = new Map<string, string>();
	private readonly _respondFailures = new Map<string, ConversationRespondFailure>();
	private readonly responses = new ConversationResponseState();
	private hasReceivedBaseline = false;
	private lastAppliedKey = '';

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
				this.onHostFrame(event.frame, event.applied);
			}));
			for (const consumer of [...this.consumers]) {
				if (!consumer.isDisposed()) {
					consumer.onHostLeaseId(id);
				}
			}
			return id;
		}, () => undefined);
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

	get responseProjection(): ConversationResponseProjection {
		return this.responses.projection;
	}

	get authoritativeCursor(): ReplicaCursor | null {
		return this.cursor;
	}

	get hasBaseline(): boolean {
		return this.hasReceivedBaseline;
	}

	addConsumer(consumer: EngineSessionViewLease): void {
		this.refCount++;
		this.consumers.add(consumer);
		if (this.leaseId) {
			consumer.onHostLeaseId(this.leaseId);
		}
		if (this.hasReceivedBaseline) {
			consumer.syncInitialSnapshot(
				this.replica,
				this.cursor,
				this._attribution,
				this._details,
				this._respondFailures,
				this.responseProjection,
				this.lastAppliedKey,
			);
		} else if (this.cursor !== null) {
			this.requestResync();
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

	applyFrameToBinding(frame: ConversationViewFrame): boolean {
		const key = `${frame.frame.generation}:${frame.frame.frameId}:${frame.frame.version}`;
		if (this.lastAppliedKey === key) {
			return false;
		}
		const result = applyViewFrame(this.replica, frame.frame, this.cursor);
		const next = result as Partial<{ next: SessionViewSnapshot; cursor: ReplicaCursor }>;
		if (next.next === undefined || next.cursor === undefined) {
			this.requestResync();
			return false;
		}
		const generationChanged = this.cursor?.generation !== next.cursor.generation;
		this.lastAppliedKey = key;
		this.cursor = next.cursor;
		if (frame.frame.body.kind === 'baseline') {
			this.hasReceivedBaseline = true;
		}
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
		if (generationChanged) {
			this.responses.reset();
			this._respondFailures.clear();
		}
		if (frame.frame.body.kind === 'patches') {
			this.foldResponsePatches(frame.frame.body.patches);
		}
		this.replica = next.next;
		this.responses.reconcile(this.replica, this._attribution);
		updateRespondFailures(this._respondFailures, frame.frame);
		return true;
	}

	/** Fold lifecycle in patch order, including remove/re-add with an equal final replica. */
	private foldResponsePatches(patches: readonly ViewPatch[]): void {
		let current = this.replica;
		for (const patch of patches) {
			const retired = new Set<string>();
			if (patch.op === 'removePendingAction') {
				const id = String(patch.requestId);
				// An already closed result remains explicitly blocked while its terminal row exists.
				if (![...this.responseProjection.byRequest.values()].some(state => state.identity.requestId === id && state.blocked)) {
					retired.add(id);
				}
			} else if (patch.op === 'removeTimelineItem' || patch.op === 'upsertTimelineItem') {
				const id = String(patch.op === 'removeTimelineItem' ? patch.itemId : patch.item.id);
				const prev = current.timeline.find(item => String(item.id) === id);
				if (patch.op === 'removeTimelineItem' || (prev && conversationResponseSemanticChanged(prev.summary, patch.item.summary))) {
					const key = this.responseProjection.byRow.get(id);
					const state = key ? this.responseProjection.byRequest.get(key) : undefined;
					if (state) {
						retired.add(state.identity.requestId);
					}
				}
			}
			current = applyViewPatches(current, [patch]);
			this.responses.reconcile(current, this._attribution, retired);
			if (patch.op === 'pendingRespondFailed' && (patch.cause === 'hostWriteFailed' || patch.cause === 'commandFailed') && typeof patch.retryable === 'boolean' && typeof patch.error === 'string') {
				this.responses.noteFailure(String(patch.requestId), { retryable: patch.retryable, error: patch.error });
			}
		}
	}

	onHostFrame(frame: ConversationViewFrame, applied: ConversationViewFrameApplied): void {
		const before = this.responseProjection;
		if (!this.applyFrameToBinding(frame)) {
			return;
		}
		const normalized = normalizeSessionViewFrameApplied(applied);
		const changed = conversationResponseChangedIds(before, this.responseProjection);
		this.publish(normalized.kind === 'patches'
			? { kind: 'patches', changedIds: new Set([...normalized.changedIds, ...changed]) }
			: normalized, true);
	}

	/** Install every leaf before any synchronous listener can reenter the roster. */
	private publish(applied: ConversationViewFrameApplied, acknowledge = false): void {
		const consumers = [...this.consumers].filter(consumer => !consumer.isDisposed());
		for (const consumer of consumers) {
			consumer.installBindingSnapshot(this.replica, this.cursor, this._attribution, this._details, this._respondFailures, this.responseProjection, this.lastAppliedKey);
		}
		for (const consumer of consumers) {
			consumer.notifyApplied(applied, acknowledge);
		}
	}

	beginResponse(kind: ConversationResponseKind, requestId: string): ConversationEngineResponseBegin {
		if (this.refCount === 0) {
			return { kind: 'untracked' };
		}
		const before = this.responseProjection;
		const started = this.responses.begin(kind, requestId);
		if (started.kind !== 'started') {
			return started;
		}
		const ticket = started.ticket;
		this.publish({ kind: 'patches', changedIds: conversationResponseChangedIds(before, this.responseProjection) });
		return {
			kind: 'started',
			isCurrent: () => this.refCount > 0 && this.responses.isCurrent(ticket),
			complete: (failure, build) => {
				if (this.refCount === 0 || !this.responses.isCurrent(ticket)) {
					return;
				}
				const before = this.responseProjection;
				this.responses.finish(ticket, failure);
				this.applyLocalPatches(build?.(this.replica) ?? [], before);
			},
		};
	}

	resetResponseScope(): void {
		const before = this.responseProjection;
		this.responses.reset(true);
		this._respondFailures.clear();
		this.responses.reconcile(this.replica, this._attribution);
		this.publish({ kind: 'patches', changedIds: conversationResponseChangedIds(before, this.responseProjection) });
	}

	applyLocalPatches(patches: readonly ViewPatch[], before = this.responseProjection): void {
		const next = applyViewPatches(this.replica, patches);
		this.foldResponsePatches(patches);
		const snapshotChanged = !respondCleanupUnchanged(this.replica, next);
		this.replica = next;
		// Local outcomes never enter the legacy map under an untyped string key.
		for (const patch of patches) {
			if (patch.op === 'removePendingAction') {
				this._respondFailures.delete(String(patch.requestId));
			}
		}
		const changedIds = new Set(conversationResponseChangedIds(before, this.responseProjection));
		if (!snapshotChanged && changedIds.size === 0) {
			return;
		}
		for (const patch of patches) {
			changedIds.add(changedIdForRespondPatch(patch));
		}
		this.publish({ kind: 'patches', changedIds });
	}

	recordDetail(ref: string, content: string): void {
		this._details.set(ref, content);
		for (const consumer of [...this.consumers]) {
			if (!consumer.isDisposed()) {
				consumer.noteDetail(ref, content);
			}
		}
	}

	async post(msg: ConversationWriteMessage): Promise<PostOutcome> {
		const leaseId = await this.acquired;
		if (!leaseId || this.refCount === 0) {
			return { accepted: false, reason: "no_such_session" };
		}
		const bound = await this.whenBindReady();
		if (!bound || !this.leaseId || this.refCount === 0) {
			return { accepted: false, reason: "no_such_session" };
		}
		try {
			return await this.sessionView.post(this.leaseId, msg);
		} catch {
			return { accepted: false, reason: "no_such_session" };
		}
	}

	private resyncPending = false;
	private resyncFollowUp = false;
	private resyncFollowUpFromFailure = false;

	requestResync(): void {
		if (!this.leaseId) {
			return;
		}
		if (this.resyncPending) {
			this.resyncFollowUp = true;
			return;
		}
		this.resyncPending = true;
		void this.sessionView.requestResync(this.leaseId)
			.catch(() => {
				if (!this.resyncFollowUpFromFailure) {
					this.resyncFollowUp = true;
				}
			})
			.finally(() => {
				this.resyncPending = false;
				if (this.resyncFollowUp) {
					this.resyncFollowUp = false;
					this.resyncFollowUpFromFailure = true;
					this.requestResync();
				} else {
					this.resyncFollowUpFromFailure = false;
				}
			});
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
		// Unpublish before calling release hooks, which may synchronously acquire again.
		this.onEmpty();
		this.responses.reset();
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
	}

	private releaseHost(leaseId: string): void {
		if (this.hostReleased) {
			return;
		}
		this.hostReleased = true;
		void this.sessionView.releaseLease(leaseId).catch(() => undefined);
	}
}

export type ConversationEngineResponseBegin =
	| { readonly kind: 'started'; readonly isCurrent: () => boolean; readonly complete: (failure?: ConversationRespondFailure, build?: (snapshot: SessionViewSnapshot) => readonly ViewPatch[]) => void }
	| Exclude<ConversationResponseBegin, { readonly kind: 'started' }>;

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
		this.heldLeases.add(lease);
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
		const binding = this.hostBindings.get(sessionId);
		if (binding) {
			return binding.post(msg);
		}
		return undefined;
	}

	/**
	 * After an engine unary is accepted, fold respond-cleanup patches into every
	 * held replica for `sessionId` and notify seats. Does not post to the host.
	 */
	applyRespondCleanup(sessionId: string, build: (snapshot: SessionViewSnapshot) => readonly ViewPatch[]): void {
		const binding = this.hostBindings.get(sessionId);
		if (!binding) {
			return;
		}
		const patches = build(binding.snapshot);
		if (patches.length === 0) {
			return;
		}
		binding.applyLocalPatches(patches);
	}

	beginResponse(sessionId: string, kind: ConversationResponseKind, requestId: string): ConversationEngineResponseBegin {
		return this.hostBindings.get(sessionId)?.beginResponse(kind, requestId) ?? { kind: 'untracked' };
	}

	resetResponseScopes(): void {
		for (const binding of this.hostBindings.values()) {
			binding.resetResponseScope();
		}
	}

	override dispose(): void {
		for (const lease of [...this.heldLeases]) {
			lease.dispose();
		}
		this.resetResponseScopes();
		super.dispose();
	}

	/** Last replica for a session when a lease is still held (UA disconnect cache). */
	getCachedProjection(sessionId: string): ConversationSessionViewProjection | undefined {
		const binding = this.hostBindings.get(sessionId);
		if (!binding || !binding.exposesCachedProjection() || !binding.hasBaseline) {
			return undefined;
		}
		return {
			snapshot: binding.snapshot,
			attribution: binding.attribution,
			details: binding.details,
		};
	}
}

class EngineSessionViewLease extends Disposable implements IConversationSessionViewLease {

	private replica: SessionViewSnapshot = createEmptyReplica('pending' as SessionViewSnapshot["sessionId"]);
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
	responseProjection: ConversationResponseProjection | undefined;

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
			this.onAcquired();
		}
	}

	syncInitialSnapshot(
		replica: SessionViewSnapshot, cursor: ReplicaCursor | null,
		attribution: ReadonlyMap<string, ItemAttribution>, details: ReadonlyMap<string, string>,
		respondFailures: ReadonlyMap<string, ConversationRespondFailure>, responseProjection: ConversationResponseProjection,
		lastAppliedKey: string,
	): void {
		this.installBindingSnapshot(replica, cursor, attribution, details, respondFailures, responseProjection, lastAppliedKey);
		queueMicrotask(() => this.notifyApplied({ kind: 'baseline' }));
	}

	installBindingSnapshot(
		replica: SessionViewSnapshot, cursor: ReplicaCursor | null,
		attribution: ReadonlyMap<string, ItemAttribution>, details: ReadonlyMap<string, string>,
		respondFailures: ReadonlyMap<string, ConversationRespondFailure>, responseProjection: ConversationResponseProjection,
		_lastAppliedKey: string,
	): void {
		if (this.disposed) {
			return;
		}
		this.replica = replica;
		this.cursor = cursor;
		this._attribution.clear();
		this._details.clear();
		this._respondFailures.clear();
		for (const [key, value] of attribution) { this._attribution.set(key, value); }
		for (const [key, value] of details) { this._details.set(key, value); }
		for (const [key, value] of respondFailures) { this._respondFailures.set(key, value); }
		this.responseProjection = responseProjection;
	}

	notifyApplied(applied: ConversationViewFrameApplied, acknowledge = false): void {
		if (this.disposed) {
			return;
		}
		this._onDidApplyFrame.fire(applied);
		if (acknowledge && this.leaseId && this.cursor) {
			void this.sessionView.acknowledge(this.leaseId, {
				generation: this.cursor.generation, frameId: this.cursor.frameId, appliedVersion: this.cursor.version,
			}).catch(onUnexpectedError).catch(onUnexpectedError);
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
		return this.binding.post(msg);
	}

	requestResync(): void {
		this.binding.requestResync();
	}

	noteDetail(ref: string, content: string): void {
		this._details.set(ref, content);
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
			this.binding.recordDetail(ref, outcome.content);
		}
		return outcome;
	}

	/** @internal All frame application still goes through the shared binding. */
	onHostFrame(frame: ConversationViewFrame, applied: ConversationViewFrameApplied): void {
		if (!this.disposed) {
			this.binding.onHostFrame(frame, applied);
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
