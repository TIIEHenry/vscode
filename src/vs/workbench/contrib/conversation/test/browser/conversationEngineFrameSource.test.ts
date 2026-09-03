/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { emptySessionViewSnapshot } from '../../../../../platform/universeAgent/common/sessionView/empty-snapshot.js';
import type { SessionId, ViewLeaseId } from '../../../../../platform/universeAgent/common/sessionView/types.js';
import type { ConversationViewFrameApplied } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type {
	IUniverseAgentSessionView,
	IUniverseAgentSessionViewFrameEvent,
} from '../../../../../platform/universeAgent/common/universeAgentSessionView.js';
import type { ConversationWriteMessage, DetailFetchOutcome, PostOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
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

	async releaseLease(leaseId: string): Promise<void> {
		this.releaseLeaseCalls.push(leaseId);
	}

	async post(_leaseId: string, _msg: ConversationWriteMessage): Promise<PostOutcome> {
		return { accepted: true, correlation: { id: 'mock' } };
	}

	async requestResync(_leaseId: string): Promise<void> { }

	async acknowledge(leaseId: string, ack: { readonly generation: number; readonly frameId: number; readonly appliedVersion: number }): Promise<void> {
		this.acknowledgeCalls.push({ leaseId, ...ack });
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

	async releaseLease(_leaseId: string): Promise<void> { }

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
		assert.strictEqual(sessionView.lastPost, undefined);
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
});
