/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { UniverseAgentGetHistoryRequest, UniverseAgentGetHistoryResult } from '../../common/universeAgentTypes.js';
import type { ViewPatch } from '../../common/sessionView/types.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { fillHistoryGap, historyFillRowFromGetHistoryEnvelope } from '../../node/sessionViewHostHistoryFill.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

const TEXT_ENVELOPE = {
	id: 'hist-1',
	seq: 1,
	role: 'USER',
	blocks: [{ block_type: 1, text_block: { text: 'from history' } }],
};

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

async function waitFor(predicate: () => boolean, timeoutMs = 400): Promise<void> {
	const start = Date.now();
	while (!predicate()) {
		if (Date.now() - start > timeoutMs) {
			throw new Error('timed out waiting for condition');
		}
		await timeout(4);
	}
}

suite('HistoryFill coordinator', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('demuxes a raw GetHistory envelope into { seq, arm, body }', () => {
		const row = historyFillRowFromGetHistoryEnvelope({
			cursorSeq: '1',
			payload: TEXT_ENVELOPE,
		});
		assert.ok(row);
		assert.strictEqual(row.seq, 1);
		assert.strictEqual(row.arm, 'text');
		assert.ok(row.body);
	});

	test('posts pagesFetched and coveredThrough on a successful page', async () => {
		const requests: UniverseAgentGetHistoryRequest[] = [];
		const fetch = async (request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> => {
			requests.push(request);
			return {
				envelopes: [{ cursorSeq: '1', payload: TEXT_ENVELOPE }],
			};
		};
		const result = await fillHistoryGap(fetch, {
			sessionId: 'sess-fill',
			fromExclusive: 0,
			toInclusive: 1,
		});
		assert.strictEqual(result.ok, true);
		if (!result.ok) {
			return;
		}
		assert.strictEqual(result.pagesFetched, 1);
		assert.strictEqual(result.coveredThrough, 1);
		assert.strictEqual(result.envelopes.length, 1);
		assert.strictEqual(result.envelopes[0]!.arm, 'text');
		assert.strictEqual(requests[0]!.cursorSeq, '0');
	});

	test('pages with nextCursorSeq until the window is covered', async () => {
		const fetch = async (request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> => {
			if (request.cursorSeq === '0') {
				return {
					envelopes: [{ cursorSeq: '1', payload: { ...TEXT_ENVELOPE, id: 'h1', seq: 1 } }],
					nextCursorSeq: '1',
				};
			}
			return {
				envelopes: [{
					cursorSeq: '2',
					payload: { ...TEXT_ENVELOPE, id: 'h2', seq: 2, blocks: [{ block_type: 1, text_block: { text: 'page two' } }] },
				}],
			};
		};
		const result = await fillHistoryGap(fetch, {
			sessionId: 'sess-fill',
			fromExclusive: 0,
			toInclusive: 2,
		});
		assert.strictEqual(result.ok, true);
		if (!result.ok) {
			return;
		}
		assert.strictEqual(result.pagesFetched, 2);
		assert.strictEqual(result.coveredThrough, 2);
		assert.strictEqual(result.envelopes.length, 2);
	});
});

suite('SessionViewHost HistoryFill', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('hello headSeq>0 fills history into the timeline', async () => {
		const connection = new TestConnection();
		connection.getHistory = async () => ({ envelopes: [{ cursorSeq: '1', payload: TEXT_ENVELOPE }] });
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease('sess-hist');
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => frames.push(event)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		await viewHost.whenEngineSessionReady('sess-hist');
		connection.pushStreamEvent('sess-hist', {
			hello: { session_version: 1, head_seq: 1, runtime_epoch: 1, last_mutated_from_seq: 0 },
		});
		await waitFor(() => patchesOf(frames).some(patch =>
			patch.op === 'upsertTimelineItem'
			&& patch.item.summary.kind === 'text'
			&& (patch.item.summary as { preview?: string }).preview === 'from history'));
	});
});
