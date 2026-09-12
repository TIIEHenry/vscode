/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import type { ViewPatch } from '../../common/sessionView/types.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

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

type CorePostMessage = { readonly t: string };

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

function countCorePosts(posts: readonly CorePostMessage[], t: string): number {
	return posts.filter(msg => msg.t === t).length;
}

suite('SessionViewHost overlay delta + frameAck', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('streaming_delta without snapshot still upserts overlay', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-delta');
		await viewHost.whenEngineSessionReady('sess-delta');

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		connection.pushStreamEvent('sess-delta', {
			streaming_delta: { turn_id: 'turn-delta', text_delta: 'partial' },
		});

		const overlays = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertOverlayBlock' }> => patch.op === 'upsertOverlayBlock');
		assert.ok(overlays.some(patch => String(patch.block.blockId) === 'turn-delta'));
	});

	test('runtime_overlay_snapshot lights overlay via demux (join yields nothing)', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-snap');
		await viewHost.whenEngineSessionReady('sess-snap');

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		connection.pushStreamEvent('sess-snap', {
			runtime_overlay_snapshot: {
				active_turn: {
					turn_id: 'turn-snap',
					streaming_text: 'from-snap',
					thinking_text: '',
				},
				pending: [],
			},
		});

		const overlays = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertOverlayBlock' }> => patch.op === 'upsertOverlayBlock');
		assert.ok(overlays.some(patch => String(patch.block.blockId) === 'turn-snap'));
	});

	test('acknowledge posts frameAck without throwing; unknown lease is silent', () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-ack');
		assert.strictEqual(connection.isEngineConnected(), true);
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, false);
		const posts = spyCorePosts(viewHost);
		viewHost.requestResync(leaseId);
		viewHost.acknowledge(leaseId, { generation: 1, frameId: 1, appliedVersion: 1 });
		viewHost.acknowledge('forged-lease', { generation: 1, frameId: 1, appliedVersion: 1 });
		assert.strictEqual(countCorePosts(posts, 'requestResync'), 1);
		assert.strictEqual(countCorePosts(posts, 'frameAck'), 1);
	});

	test('leftover-looks-live requestResync and acknowledge post nothing', () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-ack-looks-live');
		connection.setPairingPending(true);
		assert.strictEqual(connection.isEngineConnected(), true, 'leftover-looks-live fixture must keep isEngineConnected()===true');
		assert.strictEqual(connection.getConnectionSnapshot().pairingPending, true);
		const posts = spyCorePosts(viewHost);
		viewHost.requestResync(leaseId);
		viewHost.acknowledge(leaseId, { generation: 1, frameId: 1, appliedVersion: 1 });
		viewHost.acknowledge('forged-lease', { generation: 1, frameId: 1, appliedVersion: 1 });
		assert.strictEqual(countCorePosts(posts, 'requestResync'), 0);
		assert.strictEqual(countCorePosts(posts, 'frameAck'), 0);
	});
});
