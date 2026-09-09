/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/empty-snapshot.js';
import type { SessionId, ViewLeaseId } from '../../../../../platform/universeAgent/common/sessionView/types.js';
import { type ConversationViewFrame, type ConversationViewFrameApplied, type ConversationWriteMessage, type DetailFetchOutcome, type PostOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type {
	IUniverseAgentSessionView,
	IUniverseAgentSessionViewFrameEvent,
} from '../../../../../platform/universeAgent/common/universeAgentSessionView.js';
import { ConversationEngineFrameSource } from '../../browser/conversationEngineFrameSource.js';

type LeaseChannel = {
	readonly pending: IUniverseAgentSessionViewFrameEvent[];
	readonly emitter: Emitter<IUniverseAgentSessionViewFrameEvent>;
};

/**
 * Host-side buffered mock: fires the acquire burst before resolve (§1.2 IPC timing).
 */
class BufferedMockUniverseAgentSessionView implements IUniverseAgentSessionView {
	declare readonly _serviceBrand: undefined;

	private readonly channels = new Map<string, LeaseChannel>();
	readonly releaseLeaseCalls: string[] = [];
	readonly acknowledgeCalls: Array<{ readonly leaseId: string; readonly generation: number; readonly frameId: number; readonly appliedVersion: number }> = [];

	onDynamicDidApplyFrame(leaseId: string) {
		return this.getOrCreateChannel(leaseId).emitter.event;
	}

	async acquireLease(sessionId: string): Promise<string> {
		const leaseId = `lease:${sessionId}`;
		this.getOrCreateChannel(leaseId);
		this.enqueue(leaseId, this.makeEvent(leaseId, sessionId, { kind: 'baseline' }));
		this.enqueue(leaseId, this.makeEvent(leaseId, sessionId, { kind: 'patches', changedIds: new Set(['item-1']) }));
		return leaseId;
	}

	releaseLeaseFn: (leaseId: string) => Promise<void> = async () => { };

	async releaseLease(leaseId: string): Promise<void> {
		this.releaseLeaseCalls.push(leaseId);
		return this.releaseLeaseFn(leaseId);
	}

	async post(_leaseId: string, _msg: ConversationWriteMessage): Promise<PostOutcome> {
		return { accepted: true, correlation: { id: 'mock' } };
	}

	readonly requestResyncCalls: string[] = [];
	requestResyncFn: (leaseId: string) => Promise<void> = async () => { };

	async requestResync(leaseId: string): Promise<void> {
		this.requestResyncCalls.push(leaseId);
		return this.requestResyncFn(leaseId);
	}

	acknowledgeFn: (leaseId: string, ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }) => Promise<void> = async () => { };

	async acknowledge(leaseId: string, ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }): Promise<void> {
		this.acknowledgeCalls.push({ leaseId, ...ack });
		return this.acknowledgeFn(leaseId, ack);
	}

	async requestDetail(_leaseId: string, _ref: string): Promise<DetailFetchOutcome> {
		return { ok: false, reason: 'unavailable' };
	}

	private getOrCreateChannel(leaseId: string): LeaseChannel {
		let channel = this.channels.get(leaseId);
		if (!channel) {
			const pending: IUniverseAgentSessionViewFrameEvent[] = [];
			const emitter = new Emitter<IUniverseAgentSessionViewFrameEvent>({
				onDidAddFirstListener: () => {
					queueMicrotask(() => {
						for (const event of pending) {
							emitter.fire(event);
						}
						pending.length = 0;
					});
				},
			});
			channel = { pending, emitter };
			this.channels.set(leaseId, channel);
		}
		return channel;
	}

	private enqueue(leaseId: string, event: IUniverseAgentSessionViewFrameEvent): void {
		const channel = this.channels.get(leaseId);
		if (!channel) {
			return;
		}
		if (channel.emitter.hasListeners()) {
			channel.emitter.fire(event);
		} else {
			channel.pending.push(event);
		}
	}

	private makeEvent(
		leaseId: string,
		sessionId: string,
		applied: ConversationViewFrameApplied,
	): IUniverseAgentSessionViewFrameEvent {
		return {
			leaseId,
			sessionId,
			applied,
			frame: {
				frame: {
					leaseId: leaseId as ViewLeaseId,
					generation: 1,
					frameId: applied.kind === 'baseline' ? 1 : 2,
					version: applied.kind === 'baseline' ? 1 : 2,
					body: applied.kind === 'baseline'
						? { kind: 'baseline', snapshot: emptySessionViewSnapshot(sessionId as SessionId) }
						: { kind: 'patches', patches: [{ op: 'setSyncChrome', sync: { kind: 'live' } }] },
				},
			},
		};
	}
}

class PostOutcomeMockSessionView implements IUniverseAgentSessionView {
	declare readonly _serviceBrand: undefined;

	acquireLeaseFn: (sessionId: string) => Promise<string> = async sessionId => `lease:${sessionId}`;
	postFn: (leaseId: string, msg: ConversationWriteMessage) => Promise<PostOutcome> = async () => ({
		accepted: true,
		correlation: { id: 'host-corr' },
	});
	lastPost: { readonly leaseId: string; readonly msg: ConversationWriteMessage } | undefined;
	readonly acknowledgeCalls: Array<{ readonly leaseId: string; readonly generation: number; readonly frameId: number; readonly appliedVersion: number }> = [];

	onDynamicDidApplyFrame(_leaseId: string) {
		return Event.None;
	}

	async acquireLease(sessionId: string): Promise<string> {
		return this.acquireLeaseFn(sessionId);
	}

	readonly releaseLeaseCalls: string[] = [];
	releaseLeaseFn: (leaseId: string) => Promise<void> = async () => { };

	async releaseLease(leaseId: string): Promise<void> {
		this.releaseLeaseCalls.push(leaseId);
		return this.releaseLeaseFn(leaseId);
	}

	async post(leaseId: string, msg: ConversationWriteMessage): Promise<PostOutcome> {
		this.lastPost = { leaseId, msg };
		return this.postFn(leaseId, msg);
	}

	async requestResync(_leaseId: string): Promise<void> { }

	async acknowledge(leaseId: string, ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }): Promise<void> {
		this.acknowledgeCalls.push({ leaseId, ...ack });
	}

	async requestDetail(_leaseId: string, _ref: string): Promise<DetailFetchOutcome> {
		return { ok: false, reason: 'unavailable' };
	}
}

suite('ConversationEngineFrameSource post outcome', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('postIfHeld reuses the acquired lease and skips when none is held', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		const source = store.add(new ConversationEngineFrameSource(sessionView));

		assert.strictEqual(source.postIfHeld('sess-held', { kind: 'submitInput', text: 'early' }), undefined);

		const lease = store.add(source.acquire('sess-held'));
		assert.strictEqual(await source.whenLeaseBindReady(lease), true);
		const outcome = await source.postIfHeld('sess-held', {
			kind: 'continueGeneration',
			agentId: 'agent-root',
			turnId: 'turn-1',
			messageId: 'msg-1',
		});
		assert.deepStrictEqual(outcome, { accepted: true, correlation: { id: 'host-corr' } });
		assert.strictEqual(sessionView.lastPost?.leaseId, 'lease:sess-held');
		assert.deepStrictEqual(sessionView.lastPost?.msg, {
			kind: 'continueGeneration',
			agentId: 'agent-root',
			turnId: 'turn-1',
			messageId: 'msg-1',
		});
		assert.strictEqual(lease.sessionId, 'sess-held');
	});

	test('returns the host PostOutcome instead of inventing accepted', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		sessionView.postFn = async () => ({ accepted: false, reason: 'mailbox_full' });
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-a'));

		const outcome = await lease.post({ kind: 'submitInput', text: 'hello' });
		assert.deepStrictEqual(outcome, { accepted: false, reason: 'mailbox_full' });
		assert.strictEqual(sessionView.lastPost?.leaseId, 'lease:sess-a');
		assert.deepStrictEqual(sessionView.lastPost?.msg, { kind: 'submitInput', text: 'hello' });
	});

	test('post host throw maps to no_such_session not not_authenticated', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		sessionView.postFn = async () => {
			throw new Error('session not engine-bound');
		};
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-throw'));

		assert.deepStrictEqual(await lease.post({ kind: 'submitInput', text: 'x' }), {
			accepted: false,
			reason: 'no_such_session',
		});
	});

	test('surfaces not_authenticated from the host', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		sessionView.postFn = async () => ({ accepted: false, reason: 'not_authenticated' });
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-b'));

		assert.deepStrictEqual(await lease.post({ kind: 'submitInput', text: 'x' }), {
			accepted: false,
			reason: 'not_authenticated',
		});
	});

	test('returns host correlation when accepted', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-c'));

		assert.deepStrictEqual(await lease.post({ kind: 'submitInput', text: 'ok' }), {
			accepted: true,
			correlation: { id: 'host-corr' },
		});
	});

	test('waits for acquireLease then still returns the host rejection', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		let resolveAcquire!: (id: string) => void;
		sessionView.acquireLeaseFn = () => new Promise<string>(resolve => {
			resolveAcquire = resolve;
		});
		sessionView.postFn = async () => ({ accepted: false, reason: 'no_such_session' });
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-d'));

		const pending = lease.post({ kind: 'submitInput', text: 'queued' });
		const lastPostBeforeAcquire = sessionView.lastPost;
		assert.strictEqual(lastPostBeforeAcquire, undefined);
		resolveAcquire('lease:sess-d');

		assert.deepStrictEqual(await pending, { accepted: false, reason: 'no_such_session' });
		assert.strictEqual(sessionView.lastPost?.leaseId, 'lease:sess-d');
	});

	test('acquireLease failure is no_such_session, not silent accepted', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		sessionView.acquireLeaseFn = async () => {
			throw new Error('acquire failed');
		};
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-e'));

		assert.deepStrictEqual(await lease.post({ kind: 'submitInput', text: 'nope' }), {
			accepted: false,
			reason: 'no_such_session',
		});
		assert.strictEqual(sessionView.lastPost, undefined);
	});
});

suite('ConversationEngineFrameSource per-lease subscribe (F1)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('receives pre-resolve burst after acquireLease resolves', async () => {
		const sessionView = new BufferedMockUniverseAgentSessionView();
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-timing'));

		const applied: ConversationViewFrameApplied[] = [];
		store.add(lease.onDidApplyFrame(e => applied.push(e)));

		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.ok(applied.length >= 2);
		assert.strictEqual(applied[0]!.kind, 'baseline');
		assert.strictEqual(applied[1]!.kind, 'patches');
	});

	test('dispose before acquireLease resolves still releases the host lease', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		let resolveAcquire!: (id: string) => void;
		sessionView.acquireLeaseFn = () => new Promise<string>(resolve => {
			resolveAcquire = resolve;
		});
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = source.acquire('sess-early-dispose');
		lease.dispose();
		resolveAcquire('lease:sess-early-dispose');
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(sessionView.releaseLeaseCalls, ['lease:sess-early-dispose']);
		assert.strictEqual(source.getCachedProjection('sess-early-dispose'), undefined);
	});

	test('dispose releases lease after unsubscribing', async () => {
		const sessionView = new BufferedMockUniverseAgentSessionView();
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-dispose'));

		await new Promise<void>(resolve => setTimeout(resolve, 0));
		lease.dispose();

		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.deepStrictEqual(sessionView.releaseLeaseCalls, ['lease:sess-dispose']);
	});

	test('successful apply acknowledges with cursor generation/frameId/version', async () => {
		const sessionView = new BufferedMockUniverseAgentSessionView();
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-ack'));

		store.add(lease.onDidApplyFrame(() => { }));
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		assert.ok(sessionView.acknowledgeCalls.length >= 2);
		assert.deepStrictEqual(sessionView.acknowledgeCalls[0], {
			leaseId: 'lease:sess-ack',
			generation: 1,
			frameId: 1,
			appliedVersion: 1,
		});
		assert.deepStrictEqual(sessionView.acknowledgeCalls[1], {
			leaseId: 'lease:sess-ack',
			generation: 1,
			frameId: 2,
			appliedVersion: 2,
		});
	});

	test('requestResync reject does not leave an unhandled rejection or apply a bad frame', async () => {
		const sessionView = new BufferedMockUniverseAgentSessionView();
		sessionView.requestResyncFn = () => Promise.reject('boom');
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-resync-reject'));

		const applied: ConversationViewFrameApplied[] = [];
		store.add(lease.onDidApplyFrame(e => applied.push(e)));
		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const appliedBefore = applied.length;
		const ackBefore = sessionView.acknowledgeCalls.length;
		const snapshotBefore = lease.snapshot;
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const frame: ConversationViewFrame = {
				frame: {
					leaseId: 'lease:sess-resync-reject' as ViewLeaseId,
					generation: 1,
					frameId: 99,
					version: 99,
					body: { kind: 'patches', patches: [{ op: 'setSyncChrome', sync: { kind: 'closed', reason: 'bad' } }] },
				},
			};
			(lease as unknown as {
				onHostFrame(frame: ConversationViewFrame, applied: ConversationViewFrameApplied): void;
			}).onHostFrame(frame, {
				kind: 'patches',
				changedIds: new Set(['should-not-apply']),
			});
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(sessionView.requestResyncCalls, ['lease:sess-resync-reject']);
			assert.deepStrictEqual(unhandledRejections, []);
			assert.strictEqual(applied.length, appliedBefore);
			assert.strictEqual(sessionView.acknowledgeCalls.length, ackBefore);
			assert.strictEqual(lease.snapshot, snapshotBefore);
			assert.deepStrictEqual(lease.snapshot.sync, { kind: 'live' });
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('acknowledge reject does not leave an unhandled rejection and still applies the frame', async () => {
		const sessionView = new BufferedMockUniverseAgentSessionView();
		sessionView.acknowledgeFn = () => Promise.reject('boom');
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			const lease = store.add(source.acquire('sess-ack-reject'));
			const applied: ConversationViewFrameApplied[] = [];
			store.add(lease.onDidApplyFrame(e => applied.push(e)));
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.ok(applied.length >= 2);
			assert.strictEqual(applied[0]!.kind, 'baseline');
			assert.strictEqual(applied[1]!.kind, 'patches');
			assert.ok(sessionView.acknowledgeCalls.length >= 2);
			assert.deepStrictEqual(lease.snapshot.sync, { kind: 'live' });
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('releaseLease reject on dispose-before-resolve still records release and does not leave an unhandled rejection', async () => {
		const sessionView = new PostOutcomeMockSessionView();
		sessionView.releaseLeaseFn = () => Promise.reject('boom');
		let resolveAcquire!: (id: string) => void;
		sessionView.acquireLeaseFn = () => new Promise<string>(resolve => {
			resolveAcquire = resolve;
		});
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = source.acquire('sess-early-dispose-reject');
		lease.dispose();
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			resolveAcquire('lease:sess-early-dispose-reject');
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(sessionView.releaseLeaseCalls, ['lease:sess-early-dispose-reject']);
			assert.strictEqual(source.getCachedProjection('sess-early-dispose-reject'), undefined);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('releaseLease reject on dispose-after still runs onRelease/cache and does not leave an unhandled rejection', async () => {
		const sessionView = new BufferedMockUniverseAgentSessionView();
		sessionView.releaseLeaseFn = () => Promise.reject('boom');
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-dispose-reject'));
		await new Promise<void>(resolve => setTimeout(resolve, 0));
		assert.ok(source.getCachedProjection('sess-dispose-reject'));
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		try {
			lease.dispose();
			await new Promise<void>(resolve => setTimeout(resolve, 0));
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));
			assert.deepStrictEqual(sessionView.releaseLeaseCalls, ['lease:sess-dispose-reject']);
			assert.strictEqual(source.getCachedProjection('sess-dispose-reject'), undefined);
			assert.deepStrictEqual(unhandledRejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandledRejection);
		}
	});

	test('onHostFrame normalizes IPC-deserialized changedIds before emit', async () => {
		const sessionView = new BufferedMockUniverseAgentSessionView();
		const source = store.add(new ConversationEngineFrameSource(sessionView));
		const lease = store.add(source.acquire('sess-ipc-normalize'));

		const applied: ConversationViewFrameApplied[] = [];
		store.add(lease.onDidApplyFrame(e => applied.push(e)));

		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const frame: ConversationViewFrame = {
			frame: {
				leaseId: 'lease:sess-ipc-normalize' as ViewLeaseId,
				generation: 1,
				frameId: 3,
				version: 3,
				body: { kind: 'patches', patches: [{ op: 'setSyncChrome', sync: { kind: 'live' } }] },
			},
		};
		(lease as unknown as {
			onHostFrame(frame: ConversationViewFrame, applied: ConversationViewFrameApplied): void;
		}).onHostFrame(frame, {
			kind: 'patches',
			changedIds: { 'turn-1': true } as unknown as ReadonlySet<string>,
		});

		const patchFrame = applied.at(-1);
		assert.strictEqual(patchFrame?.kind, 'patches');
		if (patchFrame?.kind === 'patches') {
			assert.ok(patchFrame.changedIds instanceof Set);
			assert.deepStrictEqual([...patchFrame.changedIds], ['turn-1']);
		}
	});
});
