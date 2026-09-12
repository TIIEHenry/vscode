/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import type { ViewPatch } from '../../common/sessionView/types.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import type { IUniverseAgentConnection } from '../../common/universeAgentConnection.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

class ResidentWriteConnection extends TestConnection {
	readonly residentWrites: unknown[] = [];
	writeImpl: (payload: unknown) => void = payload => {
		this.residentWrites.push(payload);
	};

	openChatStream(): { write(payload: unknown): void; dispose(): void } {
		return {
			write: payload => this.writeImpl(payload),
			dispose: () => { },
		};
	}
}

function patchesOf(frames: readonly IUniverseAgentSessionViewFrameEvent[]): ViewPatch[] {
	const patches: ViewPatch[] = [];
	for (const event of frames) {
		const body = event.frame.frame.body;
		if (body.kind === 'patches') {
			patches.push(...body.patches);
		}
	}
	return patches;
}

suite('SessionViewHost host write receipt', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	async function connectWithPermissionSeat(sessionId: string, connection: TestConnection): Promise<{
		readonly viewHost: SessionViewHost;
		readonly leaseId: string;
		readonly frames: IUniverseAgentSessionViewFrameEvent[];
	}> {
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease(sessionId);
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => frames.push(event)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await viewHost.whenEngineSessionReady(sessionId);
		connection.pushStreamEvent(sessionId, {
			permission_request: { request_id: 'perm-live', description: 'Run bash', tool_name: 'bash' },
		});
		const pending = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertPendingAction' }> => patch.op === 'upsertPendingAction');
		assert.ok(pending.some(patch => patch.action.requestId === 'perm-live' && patch.action.summary.kind === 'permission'));
		return { viewHost, leaseId, frames };
	}

	test('resident write success folds removePendingAction for perm-live', async () => {
		const connection = new ResidentWriteConnection();
		const { viewHost, leaseId, frames } = await connectWithPermissionSeat('sess-write-ok', connection);

		const outcome = viewHost.post(leaseId, { kind: 'permissionRespond', requestId: 'perm-live', decision: 'allow' });
		assert.strictEqual(outcome.accepted, true);
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		assert.ok(connection.residentWrites.length >= 1, 'permissionRespond must write on the resident Chat handle');
		const removed = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'removePendingAction' }> => patch.op === 'removePendingAction');
		assert.ok(removed.some(patch => String(patch.requestId) === 'perm-live'));
	});

	test('resident write throw folds pendingRespondFailed hostWriteFailed without unhandled rejection', async () => {
		const connection = new ResidentWriteConnection();
		connection.writeImpl = () => {
			throw new Error('resident write failed');
		};
		const { viewHost, leaseId, frames } = await connectWithPermissionSeat('sess-write-fail', connection);

		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		process.on('unhandledRejection', onUnhandled);
		try {
			const outcome = viewHost.post(leaseId, { kind: 'permissionRespond', requestId: 'perm-live', decision: 'allow' });
			assert.strictEqual(outcome.accepted, true);
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));

			const failed = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'pendingRespondFailed' }> => patch.op === 'pendingRespondFailed');
			assert.ok(failed.some(patch => String(patch.requestId) === 'perm-live' && patch.cause === 'hostWriteFailed'));
			assert.ok(!patchesOf(frames).some(patch => patch.op === 'removePendingAction' && String(patch.requestId) === 'perm-live'));
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('one-shot chat resolve with no callback still folds removePendingAction for perm-live', async () => {
		const connection = new TestConnection();
		assert.strictEqual(typeof (connection as IUniverseAgentConnection).openChatStream, 'undefined');
		const { viewHost, leaseId, frames } = await connectWithPermissionSeat('sess-oneshot-ok', connection);

		const outcome = viewHost.post(leaseId, { kind: 'permissionRespond', requestId: 'perm-live', decision: 'allow' });
		assert.strictEqual(outcome.accepted, true);
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));

		const removed = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'removePendingAction' }> => patch.op === 'removePendingAction');
		assert.ok(removed.some(patch => String(patch.requestId) === 'perm-live'));
	});

	test('one-shot chat throw folds pendingRespondFailed hostWriteFailed without unhandled rejection', async () => {
		const connection = new class extends TestConnection {
			override async chat(): Promise<void> {
				throw new Error('oneshot chat failed');
			}
		}();
		assert.strictEqual(typeof (connection as IUniverseAgentConnection).openChatStream, 'undefined');
		const { viewHost, leaseId, frames } = await connectWithPermissionSeat('sess-oneshot-fail', connection);

		const rejections: unknown[] = [];
		const onUnhandled = (reason: unknown) => { rejections.push(reason); };
		process.on('unhandledRejection', onUnhandled);
		try {
			const outcome = viewHost.post(leaseId, { kind: 'permissionRespond', requestId: 'perm-live', decision: 'allow' });
			assert.strictEqual(outcome.accepted, true);
			await new Promise<void>(resolve => queueMicrotask(() => resolve()));
			await new Promise<void>(resolve => setImmediate(() => resolve()));

			const failed = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'pendingRespondFailed' }> => patch.op === 'pendingRespondFailed');
			assert.ok(failed.some(patch => String(patch.requestId) === 'perm-live' && patch.cause === 'hostWriteFailed'));
			assert.ok(!patchesOf(frames).some(patch => patch.op === 'removePendingAction' && String(patch.requestId) === 'perm-live'));
			assert.deepStrictEqual(rejections, []);
		} finally {
			process.off('unhandledRejection', onUnhandled);
		}
	});

	test('leftover-looks-live post is rejected and does not writeChat on resident handle', async () => {
		const connection = new ResidentWriteConnection();
		const { viewHost, leaseId } = await connectWithPermissionSeat('sess-write-looks-live', connection);
		connection.setPairingPending(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);

		const writesBefore = connection.residentWrites.length;
		const outcome = viewHost.post(leaseId, { kind: 'permissionRespond', requestId: 'perm-live', decision: 'allow' });
		assert.strictEqual(outcome.accepted, false);
		assert.strictEqual(outcome.reason, 'not_authenticated');
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));
		assert.strictEqual(connection.residentWrites.length, writesBefore);
	});

	test('leftover-looks-live post is rejected and does not writeChat over one-shot chat()', async () => {
		const connection = new class extends TestConnection {
			readonly chatCalls: unknown[] = [];
			override async chat(request?: { readonly sessionId: string; readonly payload: unknown }): Promise<void> {
				if (request !== undefined) {
					this.chatCalls.push(request);
				}
			}
		}();
		assert.strictEqual(typeof (connection as IUniverseAgentConnection).openChatStream, 'undefined');
		const { viewHost, leaseId } = await connectWithPermissionSeat('sess-oneshot-looks-live', connection);
		connection.setPairingPending(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);

		const outcome = viewHost.post(leaseId, { kind: 'permissionRespond', requestId: 'perm-live', decision: 'allow' });
		assert.strictEqual(outcome.accepted, false);
		assert.strictEqual(outcome.reason, 'not_authenticated');
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await new Promise<void>(resolve => setImmediate(() => resolve()));
		assert.deepStrictEqual(connection.chatCalls, []);
	});
});
