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

suite('SessionViewHost overlay delta + frameAck', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('streaming_delta without snapshot still upserts overlay', async () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-delta');

		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(e => frames.push(e)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));

		connection.pushStreamEvent('sess-delta', {
			streaming_delta: { turn_id: 'turn-delta', text_delta: 'partial' },
		});

		const overlays = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertOverlayBlock' }> => patch.op === 'upsertOverlayBlock');
		assert.ok(overlays.some(patch => String(patch.block.blockId) === 'turn-delta'));
	});

	test('acknowledge posts frameAck without throwing; unknown lease is silent', () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-ack');
		viewHost.acknowledge(leaseId, { generation: 1, frameId: 1, appliedVersion: 1 });
		viewHost.acknowledge('forged-lease', { generation: 1, frameId: 1, appliedVersion: 1 });
	});
});
