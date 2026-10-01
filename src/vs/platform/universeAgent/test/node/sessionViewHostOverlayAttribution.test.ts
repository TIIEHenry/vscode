/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ItemAttribution } from '../../common/conversationViewFrame.js';
import { emptySessionViewSnapshot } from '../../common/sessionView/empty-snapshot.js';
import type { OverlayBlockId, SessionId, TextChunkId, TimelineItemId, ViewFrame, ViewLeaseId, ViewPatch } from '../../common/sessionView/types.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
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

function upsertsFor(frames: readonly IUniverseAgentSessionViewFrameEvent[], itemId: string): ItemAttribution[] {
	const roles: ItemAttribution[] = [];
	for (const event of frames) {
		for (const patch of event.frame.attribution ?? []) {
			if (patch.op === 'upsertAttribution' && patch.itemId === itemId) {
				roles.push(patch.attribution);
			}
		}
	}
	return roles;
}

suite('SessionViewHost overlay attribution', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	async function open(sessionId: string): Promise<{ connection: TestConnection; viewHost: SessionViewHost; leaseId: string; frames: IUniverseAgentSessionViewFrameEvent[] }> {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease(sessionId);
		await viewHost.whenEngineSessionReady(sessionId);
		const frames: IUniverseAgentSessionViewFrameEvent[] = [];
		store.add(viewHost.onDynamicDidApplyFrame(leaseId)(event => frames.push(event)));
		await new Promise<void>(resolve => queueMicrotask(() => resolve()));
		return { connection, viewHost, leaseId, frames };
	}

	test('streaming_delta writes assistant attribution for the overlay block and does not invent assistant for a role-less text row', async () => {
		const { connection, frames } = await open('sess-overlay-attr');
		connection.pushStreamEvent('sess-overlay-attr', {
			envelope_appended: {
				envelope: {
					id: 'env-plain',
					seq: 1,
					blocks: [{ block_type: 1, text_block: { text: 'orphan' } }],
				},
			},
		});
		connection.pushStreamEvent('sess-overlay-attr', {
			streaming_delta: { turn_id: 'turn-delta', text_delta: 'partial' },
		});

		const overlays = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertOverlayBlock' }> => patch.op === 'upsertOverlayBlock');
		assert.ok(overlays.some(patch => String(patch.block.blockId) === 'turn-delta' && patch.block.summary.kind === 'text'));
		const overlayAttr = upsertsFor(frames, 'overlay:turn-delta');
		const overlayRole = overlayAttr[overlayAttr.length - 1];
		assert.ok(overlayRole);
		assert.strictEqual(overlayRole.role, 'assistant');

		const textRows = patchesOf(frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertTimelineItem' }> => patch.op === 'upsertTimelineItem');
		assert.ok(textRows.some(patch => String(patch.item.id) === 'env-plain' && patch.item.summary.kind === 'text'));
		assert.deepStrictEqual(upsertsFor(frames, 'env-plain'), []);
	});

	test('thinking_delta is assistant and generating_tool is tool unless a hint role says otherwise', async () => {
		const thinking = await open('sess-overlay-think');
		thinking.connection.pushStreamEvent('sess-overlay-think', {
			thinking_delta: { turn_id: 'turn-think', text_delta: 'hmm' },
		});
		const thinkOverlays = patchesOf(thinking.frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertOverlayBlock' }> => patch.op === 'upsertOverlayBlock');
		assert.ok(thinkOverlays.some(patch => String(patch.block.blockId) === 'turn-think' && patch.block.summary.kind === 'reasoning'));
		assert.strictEqual(upsertsFor(thinking.frames, 'overlay:turn-think').at(-1)?.role, 'assistant');

		const tool = await open('sess-overlay-tool');
		tool.connection.pushStreamEvent('sess-overlay-tool', {
			generating_tool: { turn_id: 'turn-gen', tool_name: 'bash' },
		});
		const toolOverlays = patchesOf(tool.frames).filter((patch): patch is Extract<ViewPatch, { op: 'upsertOverlayBlock' }> => patch.op === 'upsertOverlayBlock');
		assert.ok(toolOverlays.some(patch => String(patch.block.blockId) === 'turn-gen' && patch.block.summary.kind === 'tool'));
		assert.strictEqual(upsertsFor(tool.frames, 'overlay:turn-gen').at(-1)?.role, 'tool');

		const hinted = await open('sess-overlay-hint');
		hinted.connection.pushStreamEvent('sess-overlay-hint', {
			envelope_appended: {
				envelope: {
					id: 'turn-hint',
					seq: 1,
					role: 'USER',
					turn_id: 'turn-hint',
					blocks: [{ block_type: 1, text_block: { text: 'mine' } }],
				},
			},
		});
		hinted.connection.pushStreamEvent('sess-overlay-hint', {
			streaming_delta: { turn_id: 'turn-hint', text_delta: 'partial' },
		});
		assert.strictEqual(upsertsFor(hinted.frames, 'overlay:turn-hint').at(-1)?.role, 'user');
	});

	test('baseline and upsertTextChunk use the overlay summary kind and still skip role-less timeline text', async () => {
		const { viewHost, leaseId, frames } = await open('sess-overlay-chunk');
		const sessionId = 'sess-overlay-chunk' as SessionId;
		const textBlockId = 'b-text' as OverlayBlockId;
		const toolBlockId = 'b-tool' as OverlayBlockId;
		const inject = (frameId: number, body: ViewFrame['body']) => {
			const frame: ViewFrame = {
				leaseId: leaseId as ViewLeaseId,
				generation: 1,
				frameId,
				version: frameId,
				body,
			};
			(viewHost as unknown as {
				onFrameEnqueued(leaseId: ViewLeaseId, sessionId: string, frame: ViewFrame): void;
			}).onFrameEnqueued(leaseId as ViewLeaseId, sessionId, frame);
		};

		inject(1000, {
			kind: 'baseline',
			snapshot: {
				...emptySessionViewSnapshot(sessionId),
				timeline: [{
					id: 'plain-text' as TimelineItemId,
					orderKey: '1',
					summary: { kind: 'text', title: 'Message', preview: 'orphan' },
				}],
				overlay: {
					blocks: [
						{ blockId: textBlockId, orderKey: '2', summary: { kind: 'text', title: 'Agent', streaming: true }, chunks: [] },
						{ blockId: toolBlockId, orderKey: '3', summary: { kind: 'tool', title: 'read', toolName: 'read', status: 'running' }, chunks: [] },
					],
				},
			},
		});
		const baseline = frames.find(event => event.frame.frame.frameId === 1000);
		assert.ok(baseline);
		const baselineRoles = new Map((baseline.frame.attribution ?? []).flatMap(patch => patch.op === 'upsertAttribution' ? [[patch.itemId, patch.attribution.role] as const] : []));
		assert.strictEqual(baselineRoles.get('overlay:b-text'), 'assistant');
		assert.strictEqual(baselineRoles.get('overlay:b-tool'), 'tool');
		assert.strictEqual(baselineRoles.has('plain-text'), false);

		inject(1001, {
			kind: 'patches',
			patches: [
				{
					op: 'upsertTextChunk',
					blockId: toolBlockId,
					chunk: { chunkId: 'b-tool:c0' as TextChunkId, orderKey: '0', text: 'arg' },
				},
				{
					op: 'upsertTextChunk',
					blockId: 'b-unseen' as OverlayBlockId,
					chunk: { chunkId: 'b-unseen:c0' as TextChunkId, orderKey: '0', text: 'hi' },
				},
			],
		});
		const chunkFrame = frames.find(event => event.frame.frame.frameId === 1001);
		assert.ok(chunkFrame);
		const chunkRoles = new Map((chunkFrame.frame.attribution ?? []).flatMap(patch => patch.op === 'upsertAttribution' ? [[patch.itemId, patch.attribution.role] as const] : []));
		assert.strictEqual(chunkRoles.get('overlay:b-tool'), 'tool');
		assert.strictEqual(chunkRoles.get('overlay:b-unseen'), 'assistant');
	});
});
