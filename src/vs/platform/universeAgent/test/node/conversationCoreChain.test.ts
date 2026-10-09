/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentAgentTreeNode } from '../../common/universeAgentTypes.js';
import { CONVERSATION_SEND_FAILED_EFFECT_KIND } from '../../common/conversationViewFrame.js';
import { NO_TURN_FAILURE_CODE, NO_TURN_FAILURE_MESSAGE, SEND_FAILED_HOST_WRITE, SEND_FAILED_STREAM_CLOSED } from '../../node/sessionCore/session-actor-chat-outbox.js';
import type { SessionViewSnapshot, ViewEffect } from '../../common/sessionView/types.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { MultiLeaseReplica } from './multiLeaseReplica.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

const SESSION_ID = 'sess-core-chain';
const DRAFT = '  core-chain-ping  ';
const TURN_RESULT = 'core-chain-result';

const ROOT_TREE: UniverseAgentAgentTreeNode = {
	agentId: 'root',
	name: 'Root',
	type: 'AGENT_TYPE_ROOT',
	status: 'AGENT_STATUS_IDLE',
	model: 'test-model',
	turnCount: 0,
	createdAt: 0,
	children: [],
};

/**
 * Plain-body compose used by the dock before `submitInput`.
 * `composerSubmitText` lives in the browser composer module, which imports CSS
 * and cannot load in the node test runner.
 */
function composePlainDraft(draft: string): string | undefined {
	const trimmed = draft.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

class RecordingConnection extends TestConnection {
	readonly residentWrites: Record<string, unknown>[] = [];

	openChatStream(): { write(payload: unknown): void; dispose(): void } {
		return {
			write: payload => {
				this.residentWrites.push(payload as Record<string, unknown>);
			},
			dispose: () => { },
		};
	}
}

/** Host accepts the write, then the resident turn write throws. */
/** Resident Chat stream that can deliver a ChatResponse error after the write. */
class ChatRunErrorConnection extends RecordingConnection {
	private chatResponse: ((response: { readonly payload: unknown }) => void) | undefined;

	override openChatStream(
		_sessionId?: string,
		onResponse?: (response: { readonly payload: unknown }) => void,
	): { write(payload: unknown): void; dispose(): void } {
		this.chatResponse = onResponse;
		return super.openChatStream();
	}

	failChatRun(message: string, code: string): void {
		this.chatResponse?.({
			payload: {
				session_id: 'engine-session',
				agent_id: 'root',
				error: { message, code },
			},
		});
	}
}

class TurnFailingConnection extends RecordingConnection {
	failWhenIncludes: string | undefined;

	override openChatStream(): { write(payload: unknown): void; dispose(): void } {
		const handle = super.openChatStream();
		return {
			write: payload => {
				handle.write(payload);
				const needle = this.failWhenIncludes;
				if (needle && JSON.stringify(payload).includes(needle)) {
					throw new Error('turn failed after host accept');
				}
			},
			dispose: () => handle.dispose(),
		};
	}
}

function textEnvelope(id: string, seq: number, role: 'USER' | 'ASSISTANT', text: string) {
	return {
		envelope_appended: {
			envelope: {
				id,
				seq,
				role,
				turn_id: 'turn-core-chain',
				blocks: [{ block_type: 1, text_block: { text } }],
			},
		},
	};
}

async function settle(): Promise<void> {
	await new Promise<void>(resolve => queueMicrotask(() => resolve()));
	await new Promise<void>(resolve => setImmediate(() => resolve()));
	await new Promise<void>(resolve => setImmediate(() => resolve()));
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

function timelineBlob(snapshot: SessionViewSnapshot): string {
	return JSON.stringify({
		timeline: snapshot.timeline,
		overlay: snapshot.overlay,
		localPendingSends: snapshot.localPendingSends,
	});
}

function effectMessages(replica: MultiLeaseReplica): string[] {
	const messages: string[] = [];
	for (const event of replica.events) {
		const body = event.frame.frame.body;
		if (body.kind !== 'effects') {
			continue;
		}
		for (const effect of body.effects) {
			if (isVisibleFailure(effect)) {
				messages.push(effect.message);
			}
		}
	}
	return messages;
}

function isVisibleFailure(effect: ViewEffect): boolean {
	return effect.kind === CONVERSATION_SEND_FAILED_EFFECT_KIND && effect.message.trim().length > 0;
}

function errorTitles(snapshot: SessionViewSnapshot): string[] {
	const titles: string[] = [];
	for (const item of snapshot.timeline) {
		if (item.summary.kind === 'error' && item.summary.title.trim().length > 0) {
			titles.push(item.summary.title);
		}
	}
	return titles;
}

suite('conversation core chain', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('existing session: compose and send enters the host turn, then the timeline shows the turn result or an explicit failure', async () => {
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease(SESSION_ID);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, SESSION_ID));
		await replica.whenSubscribed();
		const engineId = await viewHost.whenEngineSessionReady(SESSION_ID);
		await settle();

		assert.ok(engineId, `step 1 session: engine id missing for ${SESSION_ID}`);
		assert.ok(leaseId, 'step 1 session: lease was not acquired');

		const composed = composePlainDraft(DRAFT);
		assert.ok(composed, 'step 2 compose: draft trimmed to empty');
		assert.notStrictEqual(composed, DRAFT, 'step 2 compose: surrounding space must be stripped before send');
		const failuresBeforeSend = effectMessages(replica);

		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();

		const enteredHostTurn = connection.residentWrites.some(payload => JSON.stringify(payload).includes(composed));
		const pending = replica.snapshot.localPendingSends.find(send =>
			send.summary.kind === 'text' && (send.summary.preview === composed || send.summary.title === composed));
		const operationId = pending ? String(pending.operationId) : undefined;

		if (enteredHostTurn) {
			const streamId = connection.subscribeCalls.at(-1) ?? SESSION_ID;
			if (operationId) {
				connection.pushStreamEvent(streamId, textEnvelope(operationId, 1, 'USER', composed));
			}
			connection.pushStreamEvent(streamId, textEnvelope('env-core-result', operationId ? 2 : 1, 'ASSISTANT', TURN_RESULT));
			await settle();
		}

		const visible = timelineBlob(replica.snapshot);
		const failures = [
			...(!outcome.accepted && outcome.reason.trim().length > 0 ? [outcome.reason] : []),
			...effectMessages(replica).filter(message => !failuresBeforeSend.includes(message)),
			...errorTitles(replica.snapshot),
		];
		const resultShown = visible.includes(TURN_RESULT);
		const chainFinished = (enteredHostTurn && resultShown) || failures.length > 0;

		assert.ok(chainFinished, [
			'core chain did not finish',
			`step 2 send accepted=${String(outcome.accepted)}${outcome.accepted ? '' : ` reason=${outcome.reason}`}`,
			`step 3 host turn write=${String(enteredHostTurn)} writes=${JSON.stringify(connection.residentWrites)}`,
			`step 4 timeline result=${String(resultShown)} failures=${JSON.stringify(failures)}`,
			`timeline=${visible}`,
			`streams=${JSON.stringify(connection.subscribeCalls)}`,
		].join('\n'));
	});

	test('existing session: host-accepted send that fails in the turn shows the failure reason on the timeline', async () => {
		const connection = new TurnFailingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-fail`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		const engineId = await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		assert.ok(engineId, `step 1 session: engine id missing for ${sessionId}`);
		assert.ok(leaseId, 'step 1 session: lease was not acquired');

		const composed = composePlainDraft(DRAFT);
		assert.ok(composed, 'step 2 compose: draft trimmed to empty');
		const failuresBeforeSend = effectMessages(replica);
		connection.failWhenIncludes = composed;

		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();

		const enteredHostTurn = connection.residentWrites.some(payload => JSON.stringify(payload).includes(composed));
		assert.strictEqual(outcome.accepted, true, `step 2 send was not accepted: ${outcome.accepted ? '' : outcome.reason}`);
		assert.strictEqual(enteredHostTurn, true, `step 3 host turn write missing: ${JSON.stringify(connection.residentWrites)}`);

		const failures = effectMessages(replica).filter(message => !failuresBeforeSend.includes(message));
		const reasons = errorTitles(replica.snapshot);
		assert.ok(failures.includes(SEND_FAILED_HOST_WRITE), `step 4 send_failed missing: ${JSON.stringify(failures)}`);
		assert.ok(
			reasons.includes(SEND_FAILED_HOST_WRITE),
			`step 4 timeline missing failure reason ${SEND_FAILED_HOST_WRITE}; titles=${JSON.stringify(reasons)} timeline=${timelineBlob(replica.snapshot)}`,
		);
		for (const message of failures) {
			assert.ok(reasons.includes(message), `timeline missing failure reason ${message}; titles=${JSON.stringify(reasons)}`);
		}
		assert.ok(
			!replica.snapshot.localPendingSends.some(send =>
				send.summary.kind === 'text' && (send.summary.preview === composed || send.summary.title === composed)),
			'failed send must not stay on the timeline as still sending',
		);
	});

	test('existing session: host-accepted send stays on the timeline when the chat stream closes before an envelope', async () => {
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-stream-closed`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		const engineId = await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		assert.ok(engineId, `step 1 session: engine id missing for ${sessionId}`);
		assert.ok(leaseId, 'step 1 session: lease was not acquired');

		const composed = composePlainDraft(DRAFT);
		assert.ok(composed, 'step 2 compose: draft trimmed to empty');

		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();

		const enteredHostTurn = connection.residentWrites.some(payload => JSON.stringify(payload).includes(composed));
		assert.strictEqual(outcome.accepted, true, `step 2 send was not accepted: ${outcome.accepted ? '' : outcome.reason}`);
		assert.strictEqual(enteredHostTurn, true, `step 3 host turn write missing: ${JSON.stringify(connection.residentWrites)}`);
		assert.ok(
			replica.snapshot.localPendingSends.some(send =>
				send.summary.kind === 'text' && (send.summary.preview === composed || send.summary.title === composed)),
			'optimistic row must still be sending before the stream closes',
		);

		await connection.disconnect();
		viewHost.onEngineConnectionChanged();
		await settle();

		const reasons = errorTitles(replica.snapshot);
		assert.ok(
			reasons.some(title => title.includes(SEND_FAILED_STREAM_CLOSED)),
			`timeline missing ${SEND_FAILED_STREAM_CLOSED}; titles=${JSON.stringify(reasons)} timeline=${timelineBlob(replica.snapshot)}`,
		);
		assert.ok(
			!replica.snapshot.localPendingSends.some(send =>
				send.summary.kind === 'text' && (send.summary.preview === composed || send.summary.title === composed)),
			'closed-stream send must not stay in localPendingSends',
		);
	});

	test('submitInput agentId is the admitted target, and that optimistic row keeps the id', async () => {
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-agent`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const targeted = viewHost.post(leaseId, { kind: 'submitInput', text: 'hello sub', agentId: 'sub-1' });
		await settle();
		assert.strictEqual(targeted.accepted, true);
		const targetedWrite = connection.residentWrites.find(payload => payload.text === 'hello sub');
		assert.strictEqual(targetedWrite?.agentId, 'sub-1');
		const targetedPending = replica.snapshot.localPendingSends.find(send =>
			send.summary.kind === 'text' && send.summary.preview === 'hello sub');
		assert.ok(targetedPending, 'optimistic row for the admitted target must stay on the snapshot');
		assert.strictEqual(targetedPending?.agentId, 'sub-1');

		const plain = viewHost.post(leaseId, { kind: 'submitInput', text: 'hello root' });
		await settle();
		assert.strictEqual(plain.accepted, true);
		const plainWrite = connection.residentWrites.find(payload => payload.text === 'hello root');
		const plainPending = replica.snapshot.localPendingSends.find(send =>
			send.summary.kind === 'text' && send.summary.preview === 'hello root');
		assert.strictEqual(plainWrite?.agentId, 'root');
		assert.strictEqual(plainPending?.agentId, undefined);

		const rejected = viewHost.post(leaseId, { kind: 'submitInput', text: 'bad target', agentId: 'undefined' });
		await settle();
		assert.strictEqual(rejected.accepted, true);
		const rejectedWrite = connection.residentWrites.find(payload => payload.text === 'bad target');
		assert.strictEqual(rejectedWrite?.agentId, plainWrite?.agentId);
		const rejectedPending = replica.snapshot.localPendingSends.find(send =>
			send.summary.kind === 'text' && send.summary.preview === 'bad target');
		assert.ok(rejectedPending, 'fallback send must stay on the snapshot without the live root id');
		assert.strictEqual(rejectedPending?.agentId, undefined);
	});

	test('ChatResponse error shows the engine message, clears Sending and Stop, and keeps the user text', async () => {
		const connection = new ChatRunErrorConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-run-failed`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const composed = 'fail check';
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();
		assert.strictEqual(outcome.accepted, true, `send was not accepted: ${outcome.accepted ? '' : outcome.reason}`);
		assert.ok(
			replica.snapshot.localPendingSends.some(send =>
				send.summary.kind === 'text' && send.summary.preview === composed),
			'send must stay pending until the engine error arrives',
		);

		const streamId = connection.subscribeCalls.at(-1) ?? sessionId;
		connection.pushStreamEvent(streamId, {
			turn_lifecycle: { turn_started: { turn_id: 'turn-fail-check', agent_id: 'root' } },
		});
		await settle();
		assert.ok(replica.snapshot.overlay.blocks.length > 0, 'turn_started must leave an overlay block that keeps Stop');

		connection.failChatRun('HTTP 400 InvalidSubscription: account has no CodingPlan', 'InvalidSubscription');
		await settle();

		const reasons = errorTitles(replica.snapshot);
		assert.ok(
			reasons.some(title => title.includes('InvalidSubscription') && title.includes('CodingPlan')),
			`timeline missing engine failure; titles=${JSON.stringify(reasons)} timeline=${timelineBlob(replica.snapshot)}`,
		);
		assert.strictEqual(replica.snapshot.localPendingSends.length, 0, 'Sending must clear after the engine error');
		assert.strictEqual(replica.snapshot.overlay.blocks.length, 0, 'overlay must clear so Stop is not generating');
		const userRows = replica.snapshot.timeline.filter(item =>
			item.summary.kind === 'text' && (item.summary.preview === composed || item.summary.title === composed));
		assert.strictEqual(userRows.length, 1, `user text must stay once; timeline=${timelineBlob(replica.snapshot)}`);
		assert.ok(String(userRows[0].id).startsWith('kept-send:'), `kept user row id=${String(userRows[0].id)}`);
		assert.strictEqual(replica.attribution.get(String(userRows[0].id))?.role, 'user');
	});

	test('ChatResponse error does not duplicate a user row already on the timeline', async () => {
		const connection = new ChatRunErrorConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-run-failed-kept`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const composed = 'fail check';
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();
		assert.strictEqual(outcome.accepted, true);
		const pending = replica.snapshot.localPendingSends.find(send =>
			send.summary.kind === 'text' && send.summary.preview === composed);
		assert.ok(pending, 'optimistic row must exist before the envelope');

		const streamId = connection.subscribeCalls.at(-1) ?? sessionId;
		connection.pushStreamEvent(streamId, textEnvelope(String(pending.operationId), 1, 'USER', composed));
		connection.pushStreamEvent(streamId, {
			turn_lifecycle: { turn_started: { turn_id: 'turn-fail-check-2', agent_id: 'root' } },
		});
		await settle();

		connection.failChatRun('HTTP 400 InvalidSubscription: account has no CodingPlan', 'InvalidSubscription');
		await settle();

		assert.ok(errorTitles(replica.snapshot).some(title => title.includes('CodingPlan')));
		assert.strictEqual(replica.snapshot.localPendingSends.length, 0);
		assert.strictEqual(replica.snapshot.overlay.blocks.length, 0);
		const userRows = replica.snapshot.timeline.filter(item =>
			item.summary.kind === 'text' && item.summary.preview === composed);
		assert.strictEqual(userRows.length, 1, `user text duplicated; timeline=${timelineBlob(replica.snapshot)}`);
		assert.ok(!String(userRows[0].id).startsWith('kept-send:'));
	});

	test('accepted write with no inflight stays pending until the turn watch, then shows a failure and keeps the user text', async () => {
		const watchMs = 25;
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
			chatTurnWatchMs: watchMs,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-no-turn`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const composed = 'gap check';
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();
		assert.strictEqual(outcome.accepted, true, `send was not accepted: ${outcome.accepted ? '' : outcome.reason}`);
		assert.ok(
			connection.residentWrites.some(payload => payload.text === composed),
			'host must accept the write before the watch can arm',
		);
		assert.ok(
			replica.snapshot.localPendingSends.some(send =>
				send.summary.kind === 'text' && send.summary.preview === composed),
			'accepted write must stay pending through settle; the receipt alone is not a failure',
		);
		assert.ok(
			!errorTitles(replica.snapshot).some(title => title.includes(NO_TURN_FAILURE_CODE)),
			'turn watch must not settle during settle()',
		);

		await delay(watchMs + 200);

		const reasons = errorTitles(replica.snapshot);
		assert.ok(
			reasons.some(title => title.includes(NO_TURN_FAILURE_CODE) && title.includes(NO_TURN_FAILURE_MESSAGE)),
			`timeline missing no-turn failure; titles=${JSON.stringify(reasons)} timeline=${timelineBlob(replica.snapshot)}`,
		);
		assert.strictEqual(replica.snapshot.localPendingSends.length, 0, 'Sending must clear when no turn opens');
		assert.strictEqual(replica.snapshot.overlay.blocks.length, 0, 'overlay must stay clear so Stop is not generating');
		const userRows = replica.snapshot.timeline.filter(item =>
			item.summary.kind === 'text' && (item.summary.preview === composed || item.summary.title === composed));
		assert.strictEqual(userRows.length, 1, `user text must stay once; timeline=${timelineBlob(replica.snapshot)}`);
		assert.ok(String(userRows[0].id).startsWith('kept-send:'), `kept user row id=${String(userRows[0].id)}`);
		assert.strictEqual(replica.attribution.get(String(userRows[0].id))?.role, 'user');
	});

	test('a turn that opens before the watch cancels the no-turn failure', async () => {
		const watchMs = 25;
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
			chatTurnWatchMs: watchMs,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-turn-cancels-watch`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const composed = 'gap check';
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();
		assert.strictEqual(outcome.accepted, true);

		const streamId = connection.subscribeCalls.at(-1) ?? sessionId;
		connection.pushStreamEvent(streamId, {
			turn_lifecycle: { turn_started: { turn_id: 'turn-gap-check', agent_id: 'root' } },
		});
		await settle();
		await delay(watchMs + 200);

		assert.ok(replica.snapshot.overlay.blocks.length > 0, 'opened turn must keep its overlay');
		assert.ok(
			!errorTitles(replica.snapshot).some(title => title.includes(NO_TURN_FAILURE_CODE)),
			`opened turn must not settle as no_turn; titles=${JSON.stringify(errorTitles(replica.snapshot))}`,
		);
		assert.ok(
			replica.snapshot.localPendingSends.some(send =>
				send.summary.kind === 'text' && send.summary.preview === composed),
			'opened turn must not drop the user row as a no-turn failure',
		);
	});

	test('an overlay already active before the send is not this send\'s turn', async () => {
		const watchMs = 25;
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
			chatTurnWatchMs: watchMs,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-stale-overlay`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const streamId = connection.subscribeCalls.at(-1) ?? sessionId;
		connection.pushStreamEvent(streamId, {
			turn_lifecycle: { turn_started: { turn_id: 'turn-already-open', agent_id: 'root' } },
		});
		await settle();
		assert.ok(replica.snapshot.overlay.blocks.length > 0, 'pre-existing turn must own an overlay before the send');

		const composed = 'again check';
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();
		assert.strictEqual(outcome.accepted, true);
		assert.ok(
			replica.snapshot.localPendingSends.some(send =>
				send.summary.kind === 'text' && send.summary.preview === composed),
			'accepted write must stay pending until the watch',
		);

		await delay(watchMs + 200);

		const reasons = errorTitles(replica.snapshot);
		assert.ok(
			reasons.some(title => title.includes(NO_TURN_FAILURE_CODE) && title.includes(NO_TURN_FAILURE_MESSAGE)),
			`stale overlay must not hide the no-turn failure; titles=${JSON.stringify(reasons)} timeline=${timelineBlob(replica.snapshot)}`,
		);
		assert.strictEqual(replica.snapshot.localPendingSends.length, 0, 'Sending must clear when no new turn opens');
		assert.strictEqual(replica.snapshot.overlay.blocks.length, 0, 'stale overlay must clear so Stop is not generating');
		const userRows = replica.snapshot.timeline.filter(item =>
			item.summary.kind === 'text' && (item.summary.preview === composed || item.summary.title === composed));
		assert.strictEqual(userRows.length, 1, `user text must stay once; timeline=${timelineBlob(replica.snapshot)}`);
	});

	test('a new turn after a stale overlay still cancels the no-turn failure', async () => {
		const watchMs = 25;
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
			chatTurnWatchMs: watchMs,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-stale-then-new-turn`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const streamId = connection.subscribeCalls.at(-1) ?? sessionId;
		connection.pushStreamEvent(streamId, {
			turn_lifecycle: { turn_started: { turn_id: 'turn-already-open', agent_id: 'root' } },
		});
		await settle();

		const composed = 'again check';
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();
		assert.strictEqual(outcome.accepted, true);

		connection.pushStreamEvent(streamId, {
			turn_lifecycle: { turn_started: { turn_id: 'turn-this-send', agent_id: 'root' } },
		});
		await settle();
		await delay(watchMs + 200);

		assert.ok(
			replica.snapshot.overlay.blocks.some(block => String(block.blockId) === 'turn-this-send'),
			'the turn that opened after the send must keep its overlay',
		);
		assert.ok(
			!errorTitles(replica.snapshot).some(title => title.includes(NO_TURN_FAILURE_CODE)),
			`new turn must not settle as no_turn; titles=${JSON.stringify(errorTitles(replica.snapshot))}`,
		);
		assert.ok(
			replica.snapshot.localPendingSends.some(send =>
				send.summary.kind === 'text' && send.summary.preview === composed),
			'new turn must not drop the user row as a no-turn failure',
		);
	});

	test('engine error before the turn watch is the only failure', async () => {
		const watchMs = 25;
		const connection = new ChatRunErrorConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
			chatTurnWatchMs: watchMs,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-error-before-watch`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const composed = 'gap check';
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();
		assert.strictEqual(outcome.accepted, true);
		connection.failChatRun('HTTP 400 InvalidSubscription: account has no CodingPlan', 'InvalidSubscription');
		await settle();
		await delay(watchMs + 200);

		const reasons = errorTitles(replica.snapshot);
		assert.ok(reasons.some(title => title.includes('InvalidSubscription') && title.includes('CodingPlan')), `titles=${JSON.stringify(reasons)}`);
		assert.ok(!reasons.some(title => title.includes(NO_TURN_FAILURE_CODE)), `no_turn must not replace the engine error; titles=${JSON.stringify(reasons)}`);
		assert.strictEqual(replica.snapshot.localPendingSends.length, 0);
		assert.strictEqual(replica.snapshot.overlay.blocks.length, 0);
		const userRows = replica.snapshot.timeline.filter(item =>
			item.summary.kind === 'text' && (item.summary.preview === composed || item.summary.title === composed));
		assert.strictEqual(userRows.length, 1, `user text must stay once; timeline=${timelineBlob(replica.snapshot)}`);
	});

	test('an empty active turn restored on attach does not paint generating Stop', async () => {
		const watchMs = 25;
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
			chatTurnWatchMs: watchMs,
		}));
		viewHost.onEngineConnectionChanged();
		const sessionId = `${SESSION_ID}-restored-empty-turn`;
		const leaseId = viewHost.acquireLease(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();

		const streamId = connection.subscribeCalls.at(-1) ?? sessionId;
		connection.pushStreamEvent(streamId, {
			runtime_overlay_snapshot: {
				active_turn: {
					turn_id: 'turn-stale-empty',
					streaming_text: '',
					thinking_text: '',
				},
				pending: [],
			},
		});
		await settle();
		assert.strictEqual(replica.snapshot.overlay.blocks.length, 0, 'empty restored turn must not paint a streaming block');

		const composed = 'reopen check';
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: composed });
		await settle();
		assert.strictEqual(outcome.accepted, true);

		await delay(watchMs + 200);

		const reasons = errorTitles(replica.snapshot);
		assert.ok(
			reasons.some(title => title.includes(NO_TURN_FAILURE_CODE) && title.includes(NO_TURN_FAILURE_MESSAGE)),
			`restored empty turn must not count as this send opening a turn; titles=${JSON.stringify(reasons)}`,
		);
		assert.strictEqual(replica.snapshot.localPendingSends.length, 0, 'Sending must clear');
		assert.strictEqual(replica.snapshot.overlay.blocks.length, 0, 'Stop must stay not generating');
	});
});
