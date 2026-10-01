/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { SessionId, ViewFrame, ViewLeaseId } from '../../common/sessionView/types.js';
import type { UniverseAgentAgentTreeNode } from '../../common/universeAgentTypes.js';
import { SEND_FAILED_HOST_WRITE } from '../../node/sessionCore/session-actor-chat-outbox.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { MultiLeaseReplica } from './multiLeaseReplica.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

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

/** Resident-chat connection that records every wire write (the single engine-side write path). */
class RecordingConnection extends TestConnection {
	readonly residentWrites: Record<string, unknown>[] = [];
	writeImpl: (payload: unknown) => void = payload => {
		this.residentWrites.push(payload as Record<string, unknown>);
	};

	openChatStream(): { write(payload: unknown): void; dispose(): void } {
		return {
			write: payload => this.writeImpl(payload),
			dispose: () => { },
		};
	}
}

type CorePostMessage = { readonly t: string; readonly leaseId?: string };

function spyCorePosts(viewHost: SessionViewHost): CorePostMessage[] {
	const core = (viewHost as unknown as { core: { post(sessionId: string, msg: CorePostMessage): unknown } }).core;
	const posts: CorePostMessage[] = [];
	const original = core.post.bind(core);
	core.post = (sessionId, msg) => {
		posts.push(msg);
		return original(sessionId, msg);
	};
	return posts;
}

function coreLeaseCount(viewHost: SessionViewHost, sessionId: string): number {
	return (viewHost as unknown as { core: { leaseCount(id: SessionId): number } }).core.leaseCount(sessionId as SessionId);
}

/** Same private seam the F1 fanout tests use: hands one hand-built frame to one lease's sink. */
function injectFrame(host: SessionViewHost, leaseId: string, sessionId: string, frame: ViewFrame): void {
	(host as unknown as {
		onFrameEnqueued(leaseId: ViewLeaseId, sessionId: string, frame: ViewFrame): void;
	}).onFrameEnqueued(leaseId as ViewLeaseId, sessionId, frame);
}

async function settle(): Promise<void> {
	await new Promise<void>(resolve => queueMicrotask(() => resolve()));
	await new Promise<void>(resolve => setImmediate(() => resolve()));
	await new Promise<void>(resolve => setImmediate(() => resolve()));
}

// --- engine wire payloads (SessionEventStream JSON) -------------------------------------------------

const TURN = 'turn-1';

function textEnvelope(id: string, seq: number, role: 'USER' | 'ASSISTANT', text: string, turnId: string = TURN) {
	return { envelope_appended: { envelope: { id, seq, role, turn_id: turnId, blocks: [{ block_type: 1, text_block: { text } }] } } };
}

const USER_MESSAGE = textEnvelope('env-user-1', 1, 'USER', 'list the files');
const DELTA_1 = { streaming_delta: { turn_id: TURN, text_delta: 'I will ' } };
const DELTA_2 = { streaming_delta: { turn_id: TURN, text_delta: 'check.' } };
const TOOL_CALL = {
	envelope_appended: {
		envelope: {
			id: 'env-call-1', seq: 2, role: 'ASSISTANT', turn_id: TURN,
			blocks: [{ block_type: 2, tool_call_block: { tool_name: 'ls', arguments_json: '{"path":"."}' } }],
		},
	},
};
const TOOL_RESULT = {
	envelope_appended: {
		envelope: {
			id: 'env-result-1', seq: 3, role: 'TOOL', turn_id: TURN,
			blocks: [{
				block_type: 3,
				tool_result_block: {
					tool_name: 'ls',
					content: 'a.ts\nb.ts',
					is_error: false,
					metadata_json: JSON.stringify({ diff: '--- a\n+++ b\n' }),
				},
			}],
		},
	},
};
const ASSISTANT_COMMIT = textEnvelope('env-asst-1', 4, 'ASSISTANT', 'I will check.');

const FULL_TURN: readonly unknown[] = [USER_MESSAGE, DELTA_1, DELTA_2, TOOL_CALL, TOOL_RESULT, ASSISTANT_COMMIT];

// --- rig --------------------------------------------------------------------------------------------

suite('SessionViewHost multi-lease convergence (一拖二)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	interface IRig {
		readonly connection: RecordingConnection;
		readonly viewHost: SessionViewHost;
		readonly sessionId: string;
		readonly leaseA: string;
		readonly replicaA: MultiLeaseReplica;
		/** Acquire one more lease on the same session and attach a replica to it. */
		attach(): Promise<MultiLeaseReplica>;
		push(...events: readonly unknown[]): void;
	}

	async function openRig(sessionId: string, hostOptions: { readonly pendingFrameLimit?: number } = {}): Promise<IRig> {
		const connection = new RecordingConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => ROOT_TREE), {
			orphanTimeoutMs: 0,
			...hostOptions,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseA = viewHost.acquireLease(sessionId);
		const replicaA = store.add(new MultiLeaseReplica(viewHost, leaseA, sessionId));
		await replicaA.whenSubscribed();
		await viewHost.whenEngineSessionReady(sessionId);
		await settle();
		return {
			connection,
			viewHost,
			sessionId,
			leaseA,
			replicaA,
			async attach() {
				const leaseId = viewHost.acquireLease(sessionId);
				const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
				await replica.whenSubscribed();
				return replica;
			},
			push(...events) {
				for (const event of events) {
					connection.pushStreamEvent(sessionId, event);
				}
			},
		};
	}

	/**
	 * Replica convergence. `snapshot` and `details` are always compared strictly. `attribution` is `none` to skip it, `exact` when neither
	 * lease went through a baseline after the rows arrived; once a baseline is involved (late join / resync) the
	 * host legitimately attributes more rows on that lease (see the [observed] attribution test), so only the entries
	 * both leases hold, plus every tool row, must agree (`common`).
	 */
	function assertConverged(a: MultiLeaseReplica, b: MultiLeaseReplica, message: string, attribution: 'exact' | 'none' = 'exact'): void {
		assert.deepStrictEqual(b.snapshot, a.snapshot, `${message}: snapshot`);
		assert.deepStrictEqual([...b.details.entries()].sort(), [...a.details.entries()].sort(), `${message}: details`);
		assert.deepStrictEqual([...b.respondFailures.entries()].sort(), [...a.respondFailures.entries()].sort(), `${message}: respondFailures`);
		if (attribution === 'none') {
			return;
		}
		assert.deepStrictEqual([...b.attribution.entries()].sort(), [...a.attribution.entries()].sort(), `${message}: attribution`);
	}

	test('same engine events fold once: both leases end deep-equal with independent cursors', async () => {
		const rig = await openRig('sess-conv-1');
		const replicaB = await rig.attach();
		await settle();

		rig.push(...FULL_TURN);

		const { replicaA } = rig;
		// Guard against vacuous equality: the turn really landed.
		assert.deepStrictEqual(replicaA.snapshot.timeline.map(item => String(item.id)), ['env-user-1', 'env-call-1', 'env-result-1', 'env-asst-1']);
		assert.deepStrictEqual(replicaA.snapshot.overlay.blocks, [], 'streaming overlay is reclaimed by the assistant commit');
		const toolAttribution = replicaA.attribution.get('env-result-1');
		assert.strictEqual(toolAttribution?.role, 'tool');
		assert.deepStrictEqual(toolAttribution?.metadata, { diff: '--- a\n+++ b\n' });

		assertConverged(replicaA, replicaB, 'after full turn');
		assert.strictEqual(replicaA.resyncRequired, false);
		assert.strictEqual(replicaB.resyncRequired, false);

		// Cursors: own lease identity, strictly monotonic per lease, both advanced beyond the baseline.
		assert.notStrictEqual(replicaA.cursor?.leaseId, replicaB.cursor?.leaseId);
		assert.strictEqual(replicaA.cursor?.leaseId, rig.leaseA);
		assert.strictEqual(replicaB.cursor?.leaseId, replicaB.leaseId);
		for (const replica of [replicaA, replicaB]) {
			assert.strictEqual(replica.appliedFrames[0]!.kind, 'baseline');
			assert.ok(replica.cursor!.frameId > 1, 'cursor advanced past baseline');
			const history = replica.cursorHistory;
			for (let i = 1; i < history.length; i++) {
				assert.strictEqual(history[i]!.generation, history[0]!.generation);
				assert.strictEqual(history[i]!.frameId, history[i - 1]!.frameId + 1);
				assert.ok(history[i]!.version > history[i - 1]!.version);
			}
		}

		// One engine stream serves both leases; the engine event was folded once, not once per lease.
		assert.strictEqual(rig.connection.subscribeCalls.length, 1);
		assert.strictEqual(coreLeaseCount(rig.viewHost, rig.sessionId), 2);
	});

	test('late join: baseline-built replica equals the incrementally-built one and stays equal', async () => {
		const rig = await openRig('sess-conv-late');
		rig.push(USER_MESSAGE, DELTA_1, DELTA_2);
		const { replicaA } = rig;
		assert.strictEqual(replicaA.snapshot.timeline.length, 1);
		assert.strictEqual(replicaA.snapshot.overlay.blocks.length, 1, 'streaming overlay is live at join time');
		const framesBeforeJoin = replicaA.events.length;

		const replicaB = await rig.attach();

		assert.strictEqual(replicaB.appliedFrames[0]!.kind, 'baseline', 'late joiner starts from a baseline of the shared snapshot');
		assert.strictEqual(replicaB.events.length, 1);
		assert.strictEqual(replicaA.events.length, framesBeforeJoin, 'joining B does not send A anything');
		assert.deepStrictEqual(replicaB.snapshot, replicaA.snapshot, 'baseline == incremental snapshot');
		for (const [itemId, attribution] of replicaA.attribution) {
			assert.deepStrictEqual(replicaB.attribution.get(itemId), attribution, `attribution of ${itemId}`);
		}
		assert.deepStrictEqual(replicaB.details, replicaA.details);

		rig.push(TOOL_CALL, TOOL_RESULT, ASSISTANT_COMMIT);

		assert.strictEqual(replicaA.snapshot.timeline.length, 4);
		for (const [itemId, attribution] of replicaA.attribution) {
			assert.deepStrictEqual(replicaB.attribution.get(itemId), attribution, `attribution of ${itemId} after post-join events`);
		}
		assert.strictEqual(replicaB.attribution.get('env-result-1')?.role, 'tool');
		assert.deepStrictEqual(replicaB.snapshot, replicaA.snapshot);
		assert.strictEqual(replicaB.cursor!.leaseId, replicaB.leaseId);
	});

	test('permission respond via lease A resolves the same pending action on lease B without extra requests', async () => {
		const rig = await openRig('sess-conv-perm');
		const replicaB = await rig.attach();
		await settle();
		const posts = spyCorePosts(rig.viewHost);

		rig.push({ permission_request: { request_id: 'perm-1', description: 'Run bash', tool_name: 'bash' } });
		for (const replica of [rig.replicaA, replicaB]) {
			assert.deepStrictEqual(replica.snapshot.pendingActions.map(a => String(a.requestId)), ['perm-1']);
		}
		assertConverged(rig.replicaA, replicaB, 'permission pending');
		const framesBeforeB = replicaB.events.length;
		const writesBefore = rig.connection.residentWrites.length;

		const outcome = rig.viewHost.post(rig.leaseA, { kind: 'permissionRespond', requestId: 'perm-1', decision: 'allow' });
		assert.strictEqual(outcome.accepted, true);
		await settle();

		for (const replica of [rig.replicaA, replicaB]) {
			assert.deepStrictEqual(replica.snapshot.pendingActions, [], 'pending action removed on every lease');
		}
		assertConverged(rig.replicaA, replicaB, 'permission resolved');

		// The decision went to the engine exactly once, and lease B did not have to ask for anything.
		const respondWrites = rig.connection.residentWrites.slice(writesBefore);
		assert.strictEqual(respondWrites.length, 1, 'one engine write for one respond');
		assert.strictEqual(JSON.stringify(respondWrites[0]).includes('perm-1'), true);
		assert.ok(replicaB.events.length > framesBeforeB, 'B received the resolution as a broadcast patch');
		assert.strictEqual(replicaB.appliedFrames.slice(1).every(applied => applied.kind === 'patches'), true, 'B saw patches only, no re-baseline');
		assert.strictEqual(posts.filter(msg => msg.t === 'requestResync').length, 0);
		assert.strictEqual(replicaB.resyncRequired, false);
	});

	test('both leases record the same permission respond failure while the action stays pending, then a resolving respond clears it', async () => {
		const rig = await openRig('sess-conv-respond-fail');
		const replicaB = await rig.attach();
		await settle();

		rig.push({ permission_request: { request_id: 'perm-fail', description: 'Run bash', tool_name: 'bash' } });
		for (const replica of [rig.replicaA, replicaB]) {
			assert.deepStrictEqual(replica.snapshot.pendingActions.map(action => String(action.requestId)), ['perm-fail']);
			assert.strictEqual(replica.respondFailures.size, 0);
		}

		const recordWrite = rig.connection.writeImpl;
		rig.connection.writeImpl = () => {
			throw new Error('resident write failed');
		};
		const failed = rig.viewHost.post(rig.leaseA, { kind: 'permissionRespond', requestId: 'perm-fail', decision: 'allow' });
		assert.strictEqual(failed.accepted, true);
		await settle();

		const expected = { retryable: true, error: SEND_FAILED_HOST_WRITE };
		for (const replica of [rig.replicaA, replicaB]) {
			assert.deepStrictEqual(replica.snapshot.pendingActions.map(action => String(action.requestId)), ['perm-fail'], 'failed respond leaves the action pending');
			assert.deepStrictEqual(replica.respondFailures.get('perm-fail'), expected);
		}
		assert.deepStrictEqual(rig.replicaA.snapshot, replicaB.snapshot);
		assertConverged(rig.replicaA, replicaB, 'permission respond failed');

		rig.connection.writeImpl = recordWrite;
		const resolved = rig.viewHost.post(rig.leaseA, { kind: 'permissionRespond', requestId: 'perm-fail', decision: 'allow' });
		assert.strictEqual(resolved.accepted, true);
		await settle();

		for (const replica of [rig.replicaA, replicaB]) {
			assert.deepStrictEqual(replica.snapshot.pendingActions, []);
			assert.strictEqual(replica.respondFailures.has('perm-fail'), false);
			assert.strictEqual(replica.respondFailures.size, 0);
		}
		assert.deepStrictEqual(rig.replicaA.snapshot, replicaB.snapshot);
		assertConverged(rig.replicaA, replicaB, 'permission respond resolved');
	});

	test('late-join attribution matches the incremental lease, including text rows', async () => {
		const rig = await openRig('sess-conv-attr');
		rig.push(USER_MESSAGE);
		const replicaB = await rig.attach();

		// A text row with no attribution projects as a neutral read-only row, so the two leases must carry the same
		// map. Role comes from the envelope hint on both the incremental patch and the late-join baseline.
		assert.deepStrictEqual(replicaB.attribution.get('env-user-1'), { role: 'user' });
		assertConverged(rig.replicaA, replicaB, 'user row attribution');
	});

	test('optimistic send via lease A is visible on A only; B sees the durable row, and both converge after supersede', async () => {
		const rig = await openRig('sess-conv-send');
		const replicaB = await rig.attach();
		await settle();

		const outcome = rig.viewHost.post(rig.leaseA, { kind: 'submitInput', text: 'hello engine' });
		assert.strictEqual(outcome.accepted, true);
		await settle();

		// plans/conversation-stream-timeline.md section 3.5: only the originating lease sees localPendingSends.
		const pendingA = rig.replicaA.snapshot.localPendingSends;
		assert.strictEqual(pendingA.length, 1);
		assert.deepStrictEqual(replicaB.snapshot.localPendingSends, [], 'B must not see A\'s "sending..." placeholder');
		const operationId = String(pendingA[0]!.operationId);
		assert.strictEqual(rig.connection.residentWrites.length, 1);
		assert.strictEqual(rig.connection.residentWrites[0]!.originLeaseId, rig.leaseA);
		assert.strictEqual(rig.connection.residentWrites[0]!.messageId, operationId);
		assert.strictEqual(replicaB.resyncRequired, false, 'a filtered frame must not look like a gap to B');

		// Durable L2 row arrives (engine echoes the host messageId as the envelope id) -> A supersedes, B just gains the row.
		rig.push(textEnvelope(operationId, 1, 'USER', 'hello engine'));
		assert.deepStrictEqual(rig.replicaA.snapshot.localPendingSends, []);
		assert.deepStrictEqual(replicaB.snapshot.localPendingSends, []);
		assert.deepStrictEqual(rig.replicaA.snapshot.timeline.map(item => String(item.id)), [operationId]);
		assertConverged(rig.replicaA, replicaB, 'after durable row supersedes the pending send');
		assert.strictEqual(replicaB.resyncCount, 0);
		assert.strictEqual(replicaB.resyncRequired, false);
	});

	test('a lease that joins while A has a pending send does not inherit it, and still converges afterwards', async () => {
		const rig = await openRig('sess-conv-send-late');
		assert.strictEqual(rig.viewHost.post(rig.leaseA, { kind: 'submitInput', text: 'first' }).accepted, true);
		await settle();
		const operationId = String(rig.replicaA.snapshot.localPendingSends[0]!.operationId);

		const replicaB = await rig.attach();

		assert.strictEqual(rig.replicaA.snapshot.localPendingSends.length, 1, 'A keeps its own placeholder');
		assert.deepStrictEqual(replicaB.snapshot.localPendingSends, [], 'late joiner baseline is scoped too');

		rig.push(textEnvelope(operationId, 1, 'USER', 'first'));
		assertConverged(rig.replicaA, replicaB, 'after supersede');
		assert.strictEqual(replicaB.resyncCount, 0);
	});

	test('each lease sees only its own pending send when both post', async () => {
		const rig = await openRig('sess-conv-send-both');
		const replicaB = await rig.attach();
		await settle();

		assert.strictEqual(rig.viewHost.post(rig.leaseA, { kind: 'submitInput', text: 'from A' }).accepted, true);
		assert.strictEqual(rig.viewHost.post(replicaB.leaseId, { kind: 'submitInput', text: 'from B' }).accepted, true);
		await settle();

		const previews = (replica: MultiLeaseReplica) => replica.snapshot.localPendingSends.map(send => send.summary.kind === 'text' ? send.summary.preview : undefined);
		assert.deepStrictEqual(previews(rig.replicaA), ['from A']);
		assert.deepStrictEqual(previews(replicaB), ['from B']);

		const opA = String(rig.replicaA.snapshot.localPendingSends[0]!.operationId);
		const opB = String(replicaB.snapshot.localPendingSends[0]!.operationId);
		rig.push(textEnvelope(opA, 1, 'USER', 'from A'), textEnvelope(opB, 2, 'USER', 'from B'));

		assert.deepStrictEqual(rig.replicaA.snapshot.localPendingSends, []);
		assert.deepStrictEqual(replicaB.snapshot.localPendingSends, []);
		assertConverged(rig.replicaA, replicaB, 'after both sends are durable');
		assert.strictEqual(rig.replicaA.resyncCount + replicaB.resyncCount, 0);
	});

	suite('lease isolation', () => {

		test('releasing lease B leaves lease A and the shared session untouched', async () => {
			const rig = await openRig('sess-iso-release');
			const replicaB = await rig.attach();
			rig.push(USER_MESSAGE, DELTA_1);
			assertConverged(rig.replicaA, replicaB, 'before release');
			const posts = spyCorePosts(rig.viewHost);
			const cursorABefore = rig.replicaA.cursor!;
			const framesB = replicaB.events.length;

			rig.viewHost.releaseLease(replicaB.leaseId);
			assert.strictEqual(coreLeaseCount(rig.viewHost, rig.sessionId), 1);
			assert.deepStrictEqual(rig.replicaA.cursor, cursorABefore, 'release does not emit anything to A');

			rig.push(DELTA_2, TOOL_CALL, TOOL_RESULT, ASSISTANT_COMMIT);

			assert.strictEqual(replicaB.events.length, framesB, 'released lease receives nothing more');
			assert.strictEqual(replicaB.snapshot.timeline.length, 1, 'B replica is frozen at its last applied state');
			assert.strictEqual(rig.replicaA.snapshot.timeline.length, 4);
			assert.strictEqual(rig.replicaA.cursor!.generation, cursorABefore.generation);
			assert.strictEqual(rig.replicaA.cursor!.leaseId, cursorABefore.leaseId);
			assert.ok(rig.replicaA.cursor!.frameId > cursorABefore.frameId);
			assert.strictEqual(rig.replicaA.resyncRequired, false);
			assert.strictEqual(posts.filter(msg => msg.t === 'requestResync').length, 0);
			assert.strictEqual(rig.connection.subscribeCalls.length, 1, 'engine stream stays open while A holds the session');

			// The session keeps its shared state: a fresh lease joins from a baseline equal to A.
			const replicaC = await rig.attach();
			assertConverged(rig.replicaA, replicaC, 'fresh lease after B was released');
		});

		test('requestResync on lease B re-baselines only B; A cursor and snapshot do not move', async () => {
			const rig = await openRig('sess-iso-resync');
			const replicaB = await rig.attach();
			rig.push(USER_MESSAGE, DELTA_1, TOOL_CALL);
			const cursorA = rig.replicaA.cursor!;
			const snapshotA = rig.replicaA.snapshot;
			const framesA = rig.replicaA.events.length;
			const cursorBBefore = replicaB.cursor!;

			rig.viewHost.requestResync(replicaB.leaseId);

			assert.strictEqual(replicaB.appliedFrames[replicaB.appliedFrames.length - 1]!.kind, 'baseline');
			assert.strictEqual(replicaB.cursor!.generation, cursorBBefore.generation + 1, 'B generation bumped');
			assert.strictEqual(replicaB.cursor!.frameId, 1);
			assert.strictEqual(replicaB.resyncRequired, false);
			assert.strictEqual(rig.replicaA.events.length, framesA, 'A received no frame for B\'s resync');
			assert.deepStrictEqual(rig.replicaA.cursor, cursorA);
			assert.strictEqual(rig.replicaA.snapshot, snapshotA);
			assertConverged(rig.replicaA, replicaB, 'after B re-baseline');

			// Both keep converging on later events while holding different generations.
			rig.push(DELTA_2, TOOL_RESULT, ASSISTANT_COMMIT);
			assert.notStrictEqual(rig.replicaA.cursor!.generation, replicaB.cursor!.generation);
			assert.strictEqual(rig.replicaA.snapshot.timeline.length, 4);
			assertConverged(rig.replicaA, replicaB, 'later events across different generations');
			assert.strictEqual(rig.replicaA.resyncRequired, false);
			assert.strictEqual(replicaB.resyncRequired, false);
		});

		async function overflowScenario(sessionId: string) {
			const rig = await openRig(sessionId, { pendingFrameLimit: 2 });
			const replicaB = await rig.attach();
			replicaB.pause();
			const generationA = rig.replicaA.cursor!.generation;

			rig.push(...FULL_TURN);
			assert.strictEqual(rig.replicaA.snapshot.timeline.length, 4);
			assert.strictEqual(replicaB.snapshot.timeline.length, 0, 'B is detached and has applied nothing');
			assert.strictEqual(rig.replicaA.cursor!.generation, generationA);

			replicaB.resume();
			await replicaB.whenSubscribed();
			return { rig, replicaB, generationA };
		}

		test('lease B pending-frame overflow self-heals through a B-only baseline while A is undisturbed', async () => {
			const { rig, replicaB, generationA } = await overflowScenario('sess-iso-overflow');

			const baselinesB = replicaB.appliedFrames.filter(applied => applied.kind === 'baseline').length;
			assert.strictEqual(baselinesB, 2, 'initial attach baseline + overflow resync baseline');
			assert.strictEqual(replicaB.resyncRequired, false);
			assert.strictEqual(rig.replicaA.cursor!.generation, generationA, 'A never re-baselined');
			assert.strictEqual(rig.replicaA.appliedFrames.filter(applied => applied.kind === 'baseline').length, 1);
			assertConverged(rig.replicaA, replicaB, 'after overflow heal');
		});

		test('overflow resync re-sends attribution for rows that were in the dropped frames', async () => {
			const { rig, replicaB } = await overflowScenario('sess-iso-overflow-attr');

			// Frames dropped by the pending overflow never reach B; the overflow baseline must carry the full
			// attribution map again instead of assuming it was already delivered (sessionViewHost.ts onFrameEnqueued).
			assert.deepStrictEqual(replicaB.snapshot, rig.replicaA.snapshot, 'snapshot converges');
			assert.deepStrictEqual(rig.replicaA.attribution.get('env-result-1'), { role: 'tool', metadata: { diff: '--- a\n+++ b\n' } });
			assert.deepStrictEqual(replicaB.attribution.get('env-call-1'), rig.replicaA.attribution.get('env-call-1'));
			assert.deepStrictEqual(replicaB.attribution.get('env-result-1'), rig.replicaA.attribution.get('env-result-1'));
		});

		test('out-of-order frame on lease B is rejected (resync flagged) without touching A, then B heals via requestResync', async () => {
			const rig = await openRig('sess-iso-gap');
			const replicaB = await rig.attach();
			rig.push(USER_MESSAGE, DELTA_1);
			const cursorB = replicaB.cursor!;
			const snapshotB = replicaB.snapshot;
			const cursorA = rig.replicaA.cursor!;
			const snapshotA = rig.replicaA.snapshot;
			const framesA = rig.replicaA.events.length;

			// No production seam drops one lease's frame in flight; hand a gapped frame to B's sink only
			// (the same private seam the F1 fanout tests use).
			injectFrame(rig.viewHost, replicaB.leaseId, rig.sessionId, {
				leaseId: replicaB.leaseId as ViewLeaseId,
				generation: cursorB.generation,
				frameId: cursorB.frameId + 3,
				version: cursorB.version + 3,
				body: { kind: 'patches', patches: [{ op: 'setSyncChrome', sync: { kind: 'degraded', reason: 'injected-gap' } }] },
			});

			assert.strictEqual(replicaB.resyncRequired, true, 'cursor gap flags resyncRequired');
			assert.strictEqual(replicaB.resyncCount, 1);
			assert.deepStrictEqual(replicaB.cursor, cursorB, 'rejected frame does not advance B');
			assert.strictEqual(replicaB.snapshot, snapshotB, 'rejected frame is not applied');
			assert.strictEqual(rig.replicaA.events.length, framesA);
			assert.deepStrictEqual(rig.replicaA.cursor, cursorA);
			assert.strictEqual(rig.replicaA.snapshot, snapshotA);
			assert.strictEqual(rig.replicaA.resyncRequired, false);

			rig.viewHost.requestResync(replicaB.leaseId);

			assert.strictEqual(replicaB.cursor!.generation, cursorB.generation + 1);
			assert.deepStrictEqual(rig.replicaA.cursor, cursorA, 'A still undisturbed after B healed');
			assertConverged(rig.replicaA, replicaB, 'after B heals from the gap');
			rig.push(DELTA_2, TOOL_CALL);
			assertConverged(rig.replicaA, replicaB, 'after B heals and more events arrive');
		});
	});
});
