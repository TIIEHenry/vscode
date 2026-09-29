/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { SessionId, ViewFrame, ViewLeaseId } from '../../common/sessionView/types.js';
import type { CoreIntent } from '../../node/sessionCore/intents.js';
import type { ViewFrameSink } from '../../node/sessionCore/messages.js';
import type { AttemptId, ChatWriteId, EffectId, IdPort, TextChunkId, TimerId } from '../../node/sessionCore/ports.js';
import { SessionActor } from '../../node/sessionCore/session-actor.js';

const SESSION = 'sess-actor' as SessionId;
const LEASE = 'lease-1' as ViewLeaseId;

function createHarness(mailboxCapacity: number): {
	actor: SessionActor;
	intents: CoreIntent[];
	frames: ViewFrame[];
	sink: ViewFrameSink;
} {
	const intents: CoreIntent[] = [];
	const frames: ViewFrame[] = [];
	let seq = 0;
	const ids: IdPort = {
		nextChunkId: () => `chunk:${++seq}` as TextChunkId,
		nextEffectId: () => `eff:${++seq}` as EffectId,
		nextAttemptId: () => `attempt:${++seq}` as AttemptId,
		nextWriteId: () => `write:${++seq}` as ChatWriteId,
	};
	const actor = new SessionActor({
		sessionId: SESSION,
		ids,
		diagnostics: { count() { }, warn() { } },
		mailboxCapacity,
		lingerMs: 30_000,
		chatFlushTimeoutMs: 30_000,
		emitIntent: (intent) => { intents.push(intent); },
	});
	const sink: ViewFrameSink = {
		enqueue: (frame) => { frames.push(frame); },
		acknowledge: () => { },
	};
	return { actor, intents, frames, sink };
}

function fills(intents: readonly CoreIntent[]): Extract<CoreIntent, { do: 'fillHistoryGap' }>[] {
	return intents.filter((intent): intent is Extract<CoreIntent, { do: 'fillHistoryGap' }> => intent.do === 'fillHistoryGap');
}

function chatWrites(intents: readonly CoreIntent[]): Extract<CoreIntent, { do: 'chatStreamWrite' }>[] {
	return intents.filter((intent): intent is Extract<CoreIntent, { do: 'chatStreamWrite' }> => intent.do === 'chatStreamWrite');
}

function openStreams(intents: readonly CoreIntent[]): number {
	return intents.filter(intent => intent.do === 'openStream').length;
}

function patchSyncKinds(frames: readonly ViewFrame[]): string[] {
	const kinds: string[] = [];
	for (const frame of frames) {
		if (frame.body.kind !== 'patches') {
			continue;
		}
		for (const patch of frame.body.patches) {
			if (patch.op === 'setSyncChrome') {
				kinds.push(patch.sync.kind);
			}
		}
	}
	return kinds;
}

function timelineIds(actor: SessionActor): string[] {
	return actor.snapshot.timeline.map(item => String(item.id)).sort();
}

function hello(headSeq: number, runtimeEpoch: number, lastMutatedFromSeq: number): { arm: 'hello'; body: { sessionVersion: number; headSeq: number; runtimeEpoch: number; lastMutatedFromSeq: number } } {
	return {
		arm: 'hello',
		body: { sessionVersion: 1, headSeq, runtimeEpoch, lastMutatedFromSeq },
	};
}

function textEvent(id: string, seq: number): { arm: 'text'; seq: number; body: { id: string; orderKey: string; title: string } } {
	return { arm: 'text', seq, body: { id, orderKey: id, title: id } };
}

/** Lease, live attempt, mirrored rows at seq 3/4/6/12, then two rewrite hellos with the first fill still in flight. */
function armInFlightRewrite(): {
	actor: SessionActor;
	intents: CoreIntent[];
	attemptId: AttemptId;
} {
	const { actor, intents, sink } = createHarness(32);
	assert.strictEqual(actor.enqueue({ t: 'acquireLease', leaseId: LEASE, sink }), true);
	assert.strictEqual(actor.enqueue({ t: 'connectionUp', connectionGeneration: 1 }), true);
	const opened = intents.find((intent): intent is Extract<CoreIntent, { do: 'openStream' }> => intent.do === 'openStream');
	assert.ok(opened);
	const attemptId = opened.attemptId;
	assert.strictEqual(actor.enqueue({
		t: 'localFact',
		fact: { kind: 'seedSeqCursor', lastAppliedSeq: 0, lastSessionVersion: 1 },
	}), true);
	assert.strictEqual(actor.enqueue({
		t: 'streamEvent',
		attemptId,
		event: hello(0, 1, 0),
	}), true);
	for (const [id, seq] of [['item-3', 3], ['item-4', 4], ['item-6', 6], ['item-12', 12]] as const) {
		assert.strictEqual(actor.enqueue({
			t: 'streamEvent',
			attemptId,
			event: textEvent(id, seq),
		}), true);
	}
	assert.deepStrictEqual(timelineIds(actor), ['item-12', 'item-3', 'item-4', 'item-6']);
	assert.strictEqual(actor.enqueue({
		t: 'streamEvent',
		attemptId,
		event: hello(20, 1, 10),
	}), true);
	assert.deepStrictEqual(timelineIds(actor), ['item-3', 'item-4', 'item-6']);
	assert.strictEqual(fills(intents).length, 1);
	assert.strictEqual(actor.enqueue({
		t: 'streamEvent',
		attemptId,
		event: hello(22, 1, 5),
	}), true);
	assert.deepStrictEqual(timelineIds(actor), ['item-3', 'item-4', 'item-6']);
	assert.strictEqual(fills(intents).length, 1);
	assert.strictEqual(fills(intents)[0].requestId, 'hist:1');
	assert.strictEqual(fills(intents)[0].fromExclusive, 9);
	return { actor, intents, attemptId };
}

function readSync(actor: SessionActor) {
	return actor.snapshot.sync;
}

function historyOk(coveredThrough: number): { ok: true; envelopes: readonly []; pagesFetched: number; coveredThrough: number } {
	return { ok: true, envelopes: [], pagesFetched: 1, coveredThrough };
}

suite('sessionActor reconnect history regenerate', () => {
	ensureNoDisposablesAreLeakedInTestSuite();

	test('overflow reconnect does not paint live or open until the next up', () => {
		const { actor, intents, frames, sink } = createHarness(1);
		assert.strictEqual(actor.enqueue({ t: 'acquireLease', leaseId: LEASE, sink }), true);
		assert.strictEqual(actor.enqueue({ t: 'connectionUp', connectionGeneration: 1 }), true);
		assert.strictEqual(openStreams(intents), 1);
		assert.strictEqual(readSync(actor).kind, 'live');

		let burst = false;
		sink.enqueue = (frame) => {
			frames.push(frame);
			if (!burst) {
				return;
			}
			burst = false;
			actor.enqueue({ t: 'timerFired', timerId: 'overflow-a' as TimerId });
			actor.enqueue({ t: 'timerFired', timerId: 'overflow-b' as TimerId });
		};
		burst = true;
		assert.strictEqual(actor.enqueue({ t: 'requestResync', leaseId: LEASE }), true);
		assert.strictEqual(actor.subscriptionFailed, true);
		assert.strictEqual(readSync(actor).kind, 'degraded');

		assert.strictEqual(actor.enqueue({ t: 'connectionDown', reason: { kind: 'transport' } }), true);
		assert.strictEqual(actor.subscriptionFailed, true);
		assert.deepStrictEqual(readSync(actor), { kind: 'closed', reason: 'connection_down' });
		const opensAfterDown = openStreams(intents);
		const framesAfterDown = frames.length;

		assert.strictEqual(actor.enqueue({ t: 'connectionUp', connectionGeneration: 2 }), true);
		assert.strictEqual(actor.subscriptionFailed, false);
		assert.strictEqual(actor.connectionUp, true);
		assert.strictEqual(actor.attemptId, null);
		assert.strictEqual(openStreams(intents), opensAfterDown);
		assert.strictEqual(frames.length, framesAfterDown);
		assert.deepStrictEqual(readSync(actor), { kind: 'closed', reason: 'connection_down' });
		assert.deepStrictEqual(patchSyncKinds(frames), ['live', 'degraded', 'closed']);

		assert.strictEqual(actor.enqueue({ t: 'connectionUp', connectionGeneration: 3 }), true);
		assert.strictEqual(openStreams(intents), opensAfterDown + 1);
		assert.strictEqual(readSync(actor).kind, 'live');
		assert.deepStrictEqual(patchSyncKinds(frames), ['live', 'degraded', 'closed', 'live']);
	});

	test('in-flight history fill keeps its id and defers the rewrite drop', () => {
		const { actor, intents, attemptId } = armInFlightRewrite();
		assert.strictEqual(actor.enqueue({
			t: 'historyResult',
			attemptId,
			requestId: 'hist:0',
			result: historyOk(20),
		}), true);
		assert.deepStrictEqual(timelineIds(actor), ['item-3', 'item-4', 'item-6']);
		assert.strictEqual(fills(intents).length, 1);

		assert.strictEqual(actor.enqueue({
			t: 'historyResult',
			attemptId,
			requestId: 'hist:1',
			result: historyOk(20),
		}), true);
		assert.deepStrictEqual(timelineIds(actor), ['item-3', 'item-4']);
		const history = fills(intents);
		assert.strictEqual(history.length, 2);
		assert.strictEqual(history[1].requestId, 'hist:2');
		assert.strictEqual(history[1].fromExclusive, 4);
		assert.ok(history[1].fromExclusive < 6);
		assert.strictEqual(history[1].toInclusive, 22);
		assert.strictEqual(history[1].attemptId, attemptId);
	});

	test('failed in-flight history fill still emits the deferred window once', () => {
		const { actor, intents, attemptId } = armInFlightRewrite();
		assert.strictEqual(actor.enqueue({
			t: 'historyResult',
			attemptId,
			requestId: 'hist:1',
			result: { ok: false, code: 'fetch_failed' },
		}), true);
		assert.deepStrictEqual(timelineIds(actor), ['item-3', 'item-4']);
		const history = fills(intents);
		assert.strictEqual(history.length, 2);
		assert.strictEqual(history[1].fromExclusive, 4);
		assert.strictEqual(history[1].toInclusive, 22);
	});

	test('clearing the hello anchor drops the deferred history window', () => {
		const { actor, intents, attemptId } = armInFlightRewrite();
		assert.ok(actor.deferredHistoryWindow);
		assert.strictEqual(actor.enqueue({
			t: 'streamClosed',
			attemptId,
			cause: { kind: 'remote' },
		}), true);
		assert.strictEqual(actor.deferredHistoryWindow, null);
		assert.strictEqual(fills(intents).length, 1);
	});

	test('runtime epoch advance drops a regenerate that has not been submitted', () => {
		const { actor, intents, sink } = createHarness(32);
		assert.strictEqual(actor.enqueue({ t: 'acquireLease', leaseId: LEASE, sink }), true);
		assert.strictEqual(actor.enqueue({ t: 'connectionUp', connectionGeneration: 1 }), true);
		const opened = intents.find((intent): intent is Extract<CoreIntent, { do: 'openStream' }> => intent.do === 'openStream');
		const chat = intents.find((intent): intent is Extract<CoreIntent, { do: 'ensureChatStream' }> => intent.do === 'ensureChatStream');
		assert.ok(opened);
		assert.ok(chat);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'rootAgentBound', agentId: 'root-agent' },
		}), true);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'chatStreamUp', chatAttemptId: chat.chatAttemptId },
		}), true);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'seedSeqCursor', lastAppliedSeq: 5, lastSessionVersion: 1 },
		}), true);
		assert.strictEqual(actor.enqueue({
			t: 'streamEvent',
			attemptId: opened.attemptId,
			event: hello(5, 1, 0),
		}), true);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: {
				kind: 'regenerateTurn',
				userTurnId: 'turn-1',
				preservedContent: 'keep this',
				correlation: 'corr-regen',
			},
		}), true);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, true);
		assert.strictEqual(chatWrites(intents).length, 0);

		assert.strictEqual(actor.enqueue({
			t: 'streamEvent',
			attemptId: opened.attemptId,
			event: hello(5, 2, 0),
		}), true);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, false);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: {
				kind: 'commandOutcome',
				correlation: 'corr-regen',
				commandId: 'agent.editMessage',
				succeeded: true,
			},
		}), true);
		assert.strictEqual(chatWrites(intents).length, 0);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, false);
		assert.strictEqual(actor.snapshot.timeline.length, 0);
	});

	test('edit success without a chat attempt keeps the latch until chat stream up', () => {
		const { actor, intents, sink } = createHarness(32);
		assert.strictEqual(actor.enqueue({ t: 'connectionUp', connectionGeneration: 1 }), true);
		assert.strictEqual(actor.chatAttemptId, null);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'rootAgentBound', agentId: 'root-agent' },
		}), true);
		const regenerate = {
			kind: 'regenerateTurn' as const,
			userTurnId: 'turn-1',
			preservedContent: 'keep this',
			correlation: 'corr-regen',
		};
		assert.strictEqual(actor.enqueue({ t: 'localFact', fact: regenerate }), true);
		const edits = intents.filter(intent => intent.do === 'unaryCommand').length;
		assert.strictEqual(actor.enqueue({ t: 'localFact', fact: regenerate }), true);
		assert.strictEqual(intents.filter(intent => intent.do === 'unaryCommand').length, edits);
		const timelineBefore = actor.snapshot.timeline.length;
		const pendingBefore = actor.snapshot.localPendingSends.length;
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: {
				kind: 'commandOutcome',
				correlation: 'corr-regen',
				commandId: 'agent.editMessage',
				succeeded: true,
			},
		}), true);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, true);
		assert.strictEqual(chatWrites(intents).length, 0);
		assert.strictEqual(actor.snapshot.timeline.length, timelineBefore);
		assert.strictEqual(actor.snapshot.localPendingSends.length, pendingBefore);

		assert.strictEqual(actor.enqueue({ t: 'acquireLease', leaseId: LEASE, sink }), true);
		const chat = intents.find((intent): intent is Extract<CoreIntent, { do: 'ensureChatStream' }> => intent.do === 'ensureChatStream');
		assert.ok(chat);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'chatStreamUp', chatAttemptId: chat.chatAttemptId },
		}), true);
		assert.strictEqual(chatWrites(intents).length, 1);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, false);
		assert.deepStrictEqual(chatWrites(intents)[0].payload, { text: 'keep this', agentId: 'root-agent' });
	});

	test('edit success without a root agent keeps the latch until the agent binds', () => {
		const { actor, intents, sink } = createHarness(32);
		assert.strictEqual(actor.enqueue({ t: 'acquireLease', leaseId: LEASE, sink }), true);
		assert.strictEqual(actor.enqueue({ t: 'connectionUp', connectionGeneration: 1 }), true);
		const chat = intents.find((intent): intent is Extract<CoreIntent, { do: 'ensureChatStream' }> => intent.do === 'ensureChatStream');
		assert.ok(chat);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'chatStreamUp', chatAttemptId: chat.chatAttemptId },
		}), true);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: {
				kind: 'regenerateTurn',
				userTurnId: 'turn-1',
				preservedContent: 'keep this',
				correlation: 'corr-regen',
			},
		}), true);
		const timelineBefore = actor.snapshot.timeline.length;
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: {
				kind: 'commandOutcome',
				correlation: 'corr-regen',
				commandId: 'agent.editMessage',
				succeeded: true,
			},
		}), true);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, true);
		assert.strictEqual(chatWrites(intents).length, 0);
		assert.strictEqual(actor.snapshot.timeline.length, timelineBefore);
		assert.strictEqual(actor.snapshot.localPendingSends.length, 0);

		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'rootAgentBound', agentId: 'root-agent' },
		}), true);
		assert.strictEqual(chatWrites(intents).length, 1);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, false);
	});

	test('queued regenerate submit clears the latch and flushes once', () => {
		const { actor, intents, sink } = createHarness(32);
		assert.strictEqual(actor.enqueue({ t: 'acquireLease', leaseId: LEASE, sink }), true);
		assert.strictEqual(actor.enqueue({ t: 'connectionUp', connectionGeneration: 1 }), true);
		const chat = intents.find((intent): intent is Extract<CoreIntent, { do: 'ensureChatStream' }> => intent.do === 'ensureChatStream');
		assert.ok(chat);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'rootAgentBound', agentId: 'root-agent' },
		}), true);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: {
				kind: 'regenerateTurn',
				userTurnId: 'turn-1',
				preservedContent: 'keep this',
				correlation: 'corr-regen',
			},
		}), true);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: {
				kind: 'commandOutcome',
				correlation: 'corr-regen',
				commandId: 'agent.editMessage',
				succeeded: true,
			},
		}), true);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, false);
		assert.strictEqual(chatWrites(intents).length, 0);
		assert.strictEqual(actor.enqueue({
			t: 'localFact',
			fact: { kind: 'chatStreamUp', chatAttemptId: chat.chatAttemptId },
		}), true);
		assert.strictEqual(chatWrites(intents).length, 1);
		assert.strictEqual(actor.hasInFlightRegenerateTurn, false);
	});
});
