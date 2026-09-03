/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
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
});
