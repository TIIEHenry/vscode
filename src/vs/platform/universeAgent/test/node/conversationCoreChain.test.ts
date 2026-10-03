/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentAgentTreeNode } from '../../common/universeAgentTypes.js';
import { CONVERSATION_SEND_FAILED_EFFECT_KIND } from '../../common/conversationViewFrame.js';
import { SEND_FAILED_HOST_WRITE, SEND_FAILED_STREAM_CLOSED } from '../../node/sessionCore/session-actor-chat-outbox.js';
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
		assert.ok(typeof plainWrite?.agentId === 'string' && plainWrite.agentId.length > 0);
		assert.notStrictEqual(plainWrite?.agentId, 'sub-1');
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
});
