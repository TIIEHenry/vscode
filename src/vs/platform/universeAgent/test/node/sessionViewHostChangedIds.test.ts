/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type {
	OverlayBlockId,
	TextChunkId,
	ViewFrame,
	ViewLeaseId,
	ViewPatch,
} from '../../common/sessionView/types.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

/** Every `ViewPatch` op name; none of them may leak into the changed-id space. */
const BARE_OP_NAMES: ReadonlySet<string> = new Set<ViewPatch['op']>([
	'upsertTimelineItem',
	'removeTimelineItem',
	'upsertOverlayBlock',
	'removeOverlayBlock',
	'upsertTextChunk',
	'upsertPendingAction',
	'removePendingAction',
	'upsertLocalSend',
	'removeLocalSend',
	'setSyncChrome',
	'setLiveAgentStatus',
	'setLiveTeamId',
	'setLiveAgentTree',
	'setLiveAgentSnapshots',
	'appendBranchTopologyNotice',
	'pendingRespondFailed',
]);

function changedIdsOf(frames: readonly IUniverseAgentSessionViewFrameEvent[]): Set<string> {
	const ids = new Set<string>();
	for (const event of frames) {
		if (event.applied.kind === 'patches') {
			for (const id of event.applied.changedIds) {
				ids.add(id);
			}
		}
	}
	return ids;
}

function assertNoBareOpNames(ids: ReadonlySet<string>): void {
	for (const id of ids) {
		assert.ok(!BARE_OP_NAMES.has(id), `changedIds must not carry the bare op name ${id}`);
	}
}

function injectPatches(host: SessionViewHost, leaseId: string, sessionId: string, patches: readonly ViewPatch[]): void {
	const frame: ViewFrame = {
		leaseId: leaseId as ViewLeaseId,
		generation: 1,
		frameId: 999,
		version: 999,
		body: { kind: 'patches', patches },
	};
	(host as unknown as {
		onFrameEnqueued(leaseId: ViewLeaseId, sessionId: string, frame: ViewFrame): void;
	}).onFrameEnqueued(leaseId as ViewLeaseId, sessionId, frame);
}

async function subscribe(
	store: Pick<ReturnType<typeof ensureNoDisposablesAreLeakedInTestSuite>, 'add'>,
	viewHost: SessionViewHost,
	leaseId: string,
): Promise<IUniverseAgentSessionViewFrameEvent[]> {
	const frames: IUniverseAgentSessionViewFrameEvent[] = [];
	store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => frames.push(event)));
	await new Promise<void>(resolve => queueMicrotask(() => resolve()));
	return frames;
}

suite('SessionViewHost patch changedIds', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('overlay delta frames carry overlay:<blockId>', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-overlay');
		await viewHost.whenEngineSessionReady('sess-overlay');

		const frames = await subscribe(store, viewHost, leaseId);
		connection.pushStreamEvent('sess-overlay', {
			streaming_delta: { turn_id: 'turn-delta', text_delta: 'partial' },
		});

		const ids = changedIdsOf(frames);
		assert.ok(ids.has('overlay:turn-delta'), `expected overlay:turn-delta in ${[...ids].join(', ')}`);
		assertNoBareOpNames(ids);
	});

	test('permission frames carry pending:<requestId>', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-perm');
		await viewHost.whenEngineSessionReady('sess-perm');

		const frames = await subscribe(store, viewHost, leaseId);
		connection.pushStreamEvent('sess-perm', {
			permission_request: { request_id: 'perm-1', description: 'Run bash', tool_name: 'bash' },
		});

		const ids = changedIdsOf(frames);
		assert.ok(ids.has('pending:perm-1'), `expected pending:perm-1 in ${[...ids].join(', ')}`);
		assertNoBareOpNames(ids);
	});

	test('local send frames carry send:<operationId> and sync chrome carries sync', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-send');
		await viewHost.whenEngineSessionReady('sess-send');

		const frames = await subscribe(store, viewHost, leaseId);
		const outcome = viewHost.post(leaseId, { kind: 'submitInput', text: 'hello' });
		assert.strictEqual(outcome.accepted, true);
		connection.pushStreamEvent('sess-send', { session_closed: {} });

		const ids = changedIdsOf(frames);
		assert.ok([...ids].some(id => id.startsWith('send:write:')), `expected send:write:… in ${[...ids].join(', ')}`);
		assert.ok(ids.has('sync'), `expected sync in ${[...ids].join(', ')}`);
		assertNoBareOpNames(ids);
	});

	test('text chunk maps to its overlay block; row-less chrome ops stay out of the id space', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		const leaseId = viewHost.acquireLease('sess-chunk');

		const frames = await subscribe(store, viewHost, leaseId);
		injectPatches(viewHost, leaseId, 'sess-chunk', [
			{
				op: 'upsertTextChunk',
				blockId: 'block-1' as OverlayBlockId,
				chunk: { chunkId: 'chunk-1' as TextChunkId, orderKey: '0001', text: 'more' },
			},
			{ op: 'setLiveTeamId', liveTeamId: 7 },
		]);

		const ids = changedIdsOf(frames);
		assert.ok(ids.has('overlay:block-1'), `expected overlay:block-1 in ${[...ids].join(', ')}`);
		assert.ok(ids.has('chrome:setLiveTeamId'), `expected chrome:setLiveTeamId in ${[...ids].join(', ')}`);
		assertNoBareOpNames(ids);
	});
});
