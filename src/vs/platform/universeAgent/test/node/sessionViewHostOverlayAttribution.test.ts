/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { ItemAttribution } from '../../common/conversationViewFrame.js';
import { emptySessionViewSnapshot } from '../../common/sessionView/empty-snapshot.js';
import type { ClientActionRequestId, OverlayBlockId, SessionId, TextChunkId, TimelineItemId, ViewFrame, ViewLeaseId, ViewPatch } from '../../common/sessionView/types.js';
import type { IUniverseAgentSessionViewFrameEvent } from '../../common/universeAgentSessionView.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { createConversationProjectionCache, projectSnapshotToEntries } from '../../../../workbench/contrib/conversation/browser/conversationSessionView.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';
import { MultiLeaseReplica } from './multiLeaseReplica.js';

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

	test('live overlay agent_id stays on the turn and the matching filtered page shows that stream', async () => {
		const sessionId = 'sess-overlay-live-agent';
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease(sessionId);
		await viewHost.whenEngineSessionReady(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();

		const project = (filterAgentId?: string) => projectSnapshotToEntries(
			replica.snapshot,
			replica.attribution,
			replica.details,
			undefined,
			undefined,
			undefined,
			filterAgentId ? { filterAgentId } : undefined,
		);

		connection.pushStreamEvent(sessionId, {
			runtime_overlay_snapshot: {
				runtime_epoch: 1,
				active_turn: {
					turn_id: 'turn-live',
					agent_id: 'agent-sub',
					streaming_text: 'from-snapshot',
					thinking_text: '',
				},
				pending: [],
			},
		});
		let subPage = project('agent-sub');
		assert.ok(subPage.some(entry => entry.id === 'overlay:turn-live' && entry.text.includes('from-snapshot') && entry.agentId === 'agent-sub'));
		assert.ok(!project('agent-root').some(entry => entry.id === 'overlay:turn-live'));

		connection.pushStreamEvent(sessionId, {
			streaming_delta: { turn_id: 'turn-live', text_delta: ' more', agent_id: 'agent-sub' },
		});
		connection.pushStreamEvent(sessionId, {
			thinking_delta: { turn_id: 'turn-live', text_delta: 'hmm', agent_id: 'agent-sub' },
		});
		subPage = project('agent-sub');
		const live = subPage.find(entry => entry.id === 'overlay:turn-live');
		assert.ok(live);
		assert.strictEqual(live.agentId, 'agent-sub');
		assert.ok(live.text.includes('from-snapshot more'));
		assert.strictEqual(live.thinkingText, 'hmm');
		assert.strictEqual(replica.attribution.get('overlay:turn-live')?.role, 'assistant');
		assert.strictEqual(replica.attribution.get('overlay:turn-live')?.agentId, 'agent-sub');

		connection.pushStreamEvent(sessionId, {
			generating_tool: { turn_id: 'turn-live', tool_name: 'bash', agent_id: 'agent-sub' },
		});
		subPage = project('agent-sub');
		const reading = subPage.find(entry => entry.kind === 'assistant' && entry.text.includes('from-snapshot more'));
		const tool = subPage.find(entry => entry.id === 'overlay:turn-live');
		assert.ok(reading);
		assert.ok(tool);
		assert.strictEqual(reading.kind, 'assistant');
		assert.strictEqual(reading.agentId, 'agent-sub');
		assert.ok(reading.text.includes('from-snapshot more'));
		assert.strictEqual(tool.kind, 'tool');
		assert.strictEqual(tool.toolName, 'bash');
		assert.strictEqual(tool.text, 'bash');
		assert.ok(!tool.text.includes('from-snapshot'));
		assert.strictEqual(tool.summary, undefined);
		assert.strictEqual(tool.agentId, 'agent-sub');
		assert.notStrictEqual(reading.id, tool.id);
		assert.ok(subPage.indexOf(reading) < subPage.indexOf(tool));
		assert.ok(!project('agent-other').some(entry => entry.id === 'overlay:turn-live' || entry.id === reading.id || entry.text.includes('from-snapshot more')));
		const cache = createConversationProjectionCache();
		const cachedFirst = projectSnapshotToEntries(
			replica.snapshot,
			replica.attribution,
			replica.details,
			undefined,
			cache,
			undefined,
			{ filterAgentId: 'agent-sub' },
		);
		const cachedSecond = projectSnapshotToEntries(
			replica.snapshot,
			replica.attribution,
			replica.details,
			undefined,
			cache,
			undefined,
			{ filterAgentId: 'agent-sub' },
		);
		const cachedReading = cachedSecond.find(entry => entry.kind === 'assistant' && entry.text.includes('from-snapshot more'));
		const cachedTool = cachedSecond.find(entry => entry.id === 'overlay:turn-live');
		assert.ok(cachedReading);
		assert.ok(cachedTool);
		assert.strictEqual(cachedReading.kind, 'assistant');
		assert.strictEqual(cachedReading.agentId, 'agent-sub');
		assert.strictEqual(cachedTool.kind, 'tool');
		assert.strictEqual(cachedTool.toolName, 'bash');
		assert.strictEqual(cachedTool.text, 'bash');
		assert.strictEqual(cachedTool.agentId, 'agent-sub');
		assert.strictEqual(cachedReading, cachedFirst.find(entry => entry.kind === 'assistant' && entry.text.includes('from-snapshot more')));
		assert.strictEqual(cachedTool, cachedFirst.find(entry => entry.id === 'overlay:turn-live'));

		connection.pushStreamEvent(sessionId, {
			streaming_delta: { turn_id: 'turn-blank', text_delta: 'unattributed' },
		});
		assert.strictEqual(replica.attribution.get('overlay:turn-blank')?.agentId, undefined);
		assert.strictEqual(replica.attribution.get('overlay:turn-blank')?.role, 'assistant');
		assert.ok(project().some(entry => entry.id === 'overlay:turn-blank' && entry.text.includes('unattributed')));
		assert.ok(!project('agent-sub').some(entry => entry.id === 'overlay:turn-blank'));
		assert.ok(!project('agent-sub').some(entry => entry.text.includes('unattributed')));

		connection.pushStreamEvent(sessionId, {
			streaming_delta: { turn_id: 'turn-root', text_delta: 'root-only', agent_id: 'agent-root' },
		});
		assert.ok(project('agent-root').some(entry => entry.id === 'overlay:turn-root' && entry.text.includes('root-only') && entry.agentId === 'agent-root'));
		assert.ok(!project('agent-sub').some(entry => entry.id === 'overlay:turn-root'));

		connection.pushStreamEvent(sessionId, {
			envelope_appended: {
				envelope: {
					id: 'env-kept',
					seq: 4,
					role: 'ASSISTANT',
					agent_id: 'agent-kept',
					blocks: [{ block_type: 1, text_block: { text: 'landed row' } }],
				},
			},
		});
		assert.strictEqual(replica.attribution.get('env-kept')?.agentId, 'agent-kept');
		assert.strictEqual(replica.attribution.get('env-kept')?.role, 'assistant');
		assert.ok(project('agent-kept').some(entry => entry.id === 'env-kept' && entry.text.includes('landed row')));
		assert.ok(!project('agent-sub').some(entry => entry.id === 'env-kept'));
		assert.strictEqual(replica.attribution.get('overlay:turn-root')?.agentId, 'agent-root');

		connection.pushStreamEvent(sessionId, {
			envelope_appended: {
				envelope: {
					id: 'turn-shared',
					seq: 5,
					role: 'ASSISTANT',
					agent_id: 'agent-kept',
					turn_id: 'turn-shared',
					blocks: [{ block_type: 1, text_block: { text: 'shared id' } }],
				},
			},
		});
		connection.pushStreamEvent(sessionId, {
			streaming_delta: { turn_id: 'turn-shared', text_delta: 'live', agent_id: 'agent-sub' },
		});
		assert.strictEqual(replica.attribution.get('turn-shared')?.agentId, 'agent-kept');
		assert.strictEqual(replica.attribution.get('overlay:turn-shared')?.agentId, 'agent-kept');
	});

	test('numeric envelope role 2 keeps assistant text on the matching agent page and role 1 without agent_id stays there', async () => {
		const sessionId = 'sess-overlay-numeric-role';
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease(sessionId);
		await viewHost.whenEngineSessionReady(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();

		const project = (filterAgentId?: string) => projectSnapshotToEntries(
			replica.snapshot,
			replica.attribution,
			replica.details,
			undefined,
			undefined,
			undefined,
			filterAgentId ? { filterAgentId } : undefined,
		);

		connection.pushStreamEvent(sessionId, {
			envelope_appended: {
				envelope: {
					id: 'env-num-assistant',
					seq: 1,
					role: 2,
					agent_id: 'agent-sub',
					blocks: [{ block_type: 1, text_block: { text: 'landed sub body' } }],
				},
			},
		});
		const unfiltered = project().find(entry => entry.id === 'env-num-assistant');
		assert.ok(unfiltered);
		assert.strictEqual(unfiltered.kind, 'assistant');
		assert.ok(unfiltered.text.includes('landed sub body'));
		assert.strictEqual(unfiltered.agentId, 'agent-sub');
		assert.ok(project('agent-sub').some(entry => entry.id === 'env-num-assistant' && entry.text.includes('landed sub body')));

		connection.pushStreamEvent(sessionId, {
			envelope_appended: {
				envelope: {
					id: 'env-num-user',
					seq: 2,
					role: 1,
					blocks: [{ block_type: 1, text_block: { text: 'landed user body' } }],
				},
			},
		});
		const filteredUser = project('agent-sub').find(entry => entry.id === 'env-num-user');
		assert.ok(filteredUser);
		assert.strictEqual(filteredUser.kind, 'user');
		assert.strictEqual(filteredUser.agentId, undefined);
		assert.ok(filteredUser.text.includes('landed user body'));
	});

	test('pending agentId stays on a respondable client tool and a permission after the seat is removed', async () => {
		const sessionId = 'sess-pending-agent-kept';
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease(sessionId);
		await viewHost.whenEngineSessionReady(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId, { acknowledge: false }));
		await replica.whenSubscribed();
		const cursor = replica.cursor;
		assert.ok(cursor);

		const toolId = 'call-sub';
		const permId = 'perm-sub';
		const agentId = 'agent-sub';
		const request = (id: string) => id as ClientActionRequestId;
		const toolSummary = {
			kind: 'tool' as const,
			title: 'client sub',
			toolName: 'clientTool',
			status: 'pending' as const,
			respondable: true as const,
		};
		const permSummary = {
			kind: 'permission' as const,
			title: 'Allow sub',
			permissionKind: 'tool',
		};
		assert.strictEqual(replica.attribution.get(toolId)?.agentId, undefined);
		assert.strictEqual(replica.attribution.get(permId)?.agentId, undefined);

		const inject = (frameId: number, body: ViewFrame['body']) => {
			const frame: ViewFrame = {
				leaseId: cursor.leaseId,
				generation: cursor.generation,
				frameId,
				version: frameId,
				body,
			};
			(viewHost as unknown as {
				onFrameEnqueued(leaseId: ViewLeaseId, sessionId: string, frame: ViewFrame): void;
			}).onFrameEnqueued(cursor.leaseId, sessionId, frame);
		};

		const established = cursor.frameId + 1;
		inject(established, {
			kind: 'patches',
			patches: [
				{
					op: 'upsertTimelineItem',
					item: { id: toolId as TimelineItemId, orderKey: '1', summary: toolSummary },
				},
				{
					op: 'upsertTimelineItem',
					item: { id: permId as TimelineItemId, orderKey: '2', summary: permSummary },
				},
				{
					op: 'upsertPendingAction',
					action: { requestId: request(toolId), agentId, summary: toolSummary },
				},
				{
					op: 'upsertPendingAction',
					action: { requestId: request(permId), agentId, summary: permSummary },
				},
			],
		});
		assert.strictEqual(replica.resyncRequired, false);
		assert.strictEqual(replica.attribution.get(toolId)?.role, 'tool');
		assert.strictEqual(replica.attribution.get(toolId)?.agentId, agentId);
		assert.strictEqual(replica.attribution.get(permId)?.role, 'assistant');
		assert.strictEqual(replica.attribution.get(permId)?.agentId, agentId);

		inject(established + 1, {
			kind: 'patches',
			patches: [
				{ op: 'removePendingAction', requestId: request(toolId) },
				{ op: 'removePendingAction', requestId: request(permId) },
			],
		});
		assert.strictEqual(replica.resyncRequired, false);
		assert.strictEqual(replica.snapshot.pendingActions.length, 0);
		assert.strictEqual(replica.attribution.get(toolId)?.agentId, agentId);
		assert.strictEqual(replica.attribution.get(permId)?.agentId, agentId);
		assert.ok(replica.snapshot.timeline.some(item => String(item.id) === toolId && item.summary.kind === 'tool' && item.summary.respondable === true));
		assert.ok(replica.snapshot.timeline.some(item => String(item.id) === permId && item.summary.kind === 'permission'));

		const project = (filterAgentId?: string) => projectSnapshotToEntries(
			replica.snapshot,
			replica.attribution,
			replica.details,
			undefined,
			undefined,
			undefined,
			filterAgentId ? { filterAgentId } : undefined,
		);
		const sub = project(agentId);
		const tool = sub.find(entry => entry.id === toolId);
		assert.ok(tool);
		assert.strictEqual(tool.kind, 'tool');
		assert.strictEqual(tool.respondable, true);
		assert.strictEqual(tool.agentId, agentId);
		const perm = sub.find(entry => entry.id === permId);
		assert.ok(perm);
		assert.strictEqual(perm.kind, 'confirmation');
		assert.strictEqual(perm.agentId, agentId);
		assert.ok(project().some(entry => entry.id === toolId && entry.respondable === true));
		assert.ok(project().some(entry => entry.id === permId));
		assert.ok(!project('agent-other').some(entry => entry.id === toolId || entry.id === permId));
	});

	test('tool-call envelope keeps the streamed assistant row beside the tool row on the sub-agent page', async () => {
		const sessionId = 'sess-overlay-tool-keep';
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease(sessionId);
		await viewHost.whenEngineSessionReady(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();

		const project = (filterAgentId?: string) => projectSnapshotToEntries(
			replica.snapshot,
			replica.attribution,
			replica.details,
			undefined,
			undefined,
			undefined,
			filterAgentId ? { filterAgentId } : undefined,
		);

		connection.pushStreamEvent(sessionId, {
			streaming_delta: { turn_id: 'turn-keep', text_delta: 'I will check.', agent_id: 'agent-sub' },
		});
		connection.pushStreamEvent(sessionId, {
			generating_tool: { turn_id: 'turn-keep', tool_name: 'bash', agent_id: 'agent-sub' },
		});
		const before = project('agent-sub');
		assert.ok(before.some(entry => entry.kind === 'assistant' && entry.text.includes('I will check.')));

		connection.pushStreamEvent(sessionId, {
			envelope_appended: {
				envelope: {
					id: 'env-call-keep',
					seq: 2,
					role: 'ASSISTANT',
					turn_id: 'turn-keep',
					agent_id: 'agent-sub',
					blocks: [{ block_type: 2, tool_call_block: { tool_name: 'ls', arguments_json: '{"path":"."}' } }],
				},
			},
		});

		const block = replica.snapshot.overlay.blocks.find(item => String(item.blockId) === 'turn-keep');
		assert.ok(block);
		assert.strictEqual(block.summary.kind, 'text');
		assert.ok(block.chunks.some(chunk => chunk.text.includes('I will check.')));
		assert.ok(replica.snapshot.timeline.some(item => String(item.id) === 'env-call-keep' && item.summary.kind === 'tool'));

		const subPage = project('agent-sub');
		const reading = subPage.find(entry => entry.kind === 'assistant' && entry.text.includes('I will check.'));
		const tool = subPage.find(entry => entry.id === 'env-call-keep');
		assert.ok(reading);
		assert.ok(tool);
		assert.strictEqual(reading.kind, 'assistant');
		assert.strictEqual(reading.id, 'overlay:turn-keep');
		assert.strictEqual(reading.agentId, 'agent-sub');
		assert.ok(reading.text.includes('I will check.'));
		assert.strictEqual(tool.kind, 'tool');
		assert.strictEqual(tool.toolName, 'ls');
		assert.strictEqual(tool.text, 'ls');
		assert.ok(!tool.text.includes('I will check.'));
		assert.ok(!tool.summary?.includes('I will check.'));
		assert.notStrictEqual(reading.id, tool.id);
		assert.ok(!project('agent-other').some(entry => entry.text.includes('I will check.') || entry.id === 'env-call-keep'));
	});

	test('tool_call_lifecycle started after streaming_delta keeps assistant text and a tool-name row on the sub-agent page', async () => {
		const sessionId = 'sess-overlay-lifecycle-tool';
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), { orphanTimeoutMs: 0 }));
		viewHost.onEngineConnectionChanged();
		const leaseId = viewHost.acquireLease(sessionId);
		await viewHost.whenEngineSessionReady(sessionId);
		const replica = store.add(new MultiLeaseReplica(viewHost, leaseId, sessionId));
		await replica.whenSubscribed();

		const project = (filterAgentId?: string) => projectSnapshotToEntries(
			replica.snapshot,
			replica.attribution,
			replica.details,
			undefined,
			undefined,
			undefined,
			filterAgentId ? { filterAgentId } : undefined,
		);

		connection.pushStreamEvent(sessionId, {
			streaming_delta: { turn_id: 'turn-live', text_delta: 'I will check.', agent_id: 'agent-sub' },
		});
		connection.pushStreamEvent(sessionId, {
			tool_call_lifecycle: {
				turn_id: 'turn-live',
				tool_call_id: 'tc-live',
				agent_id: 'agent-sub',
				started: { tool_name: 'bash' },
			},
		});

		const subPage = project('agent-sub');
		const reading = subPage.find(entry => entry.kind === 'assistant' && entry.text.includes('I will check.'));
		const tool = subPage.find(entry => entry.id === 'overlay:turn-live');
		assert.ok(reading);
		assert.ok(tool);
		assert.strictEqual(reading.kind, 'assistant');
		assert.strictEqual(reading.agentId, 'agent-sub');
		assert.ok(reading.text.includes('I will check.'));
		assert.strictEqual(tool.kind, 'tool');
		assert.strictEqual(tool.toolName, 'bash');
		assert.strictEqual(tool.text, 'bash');
		assert.strictEqual(tool.id, 'overlay:turn-live');
		assert.strictEqual(tool.toolCallId, 'tc-live');
		assert.notStrictEqual(tool.toolCallId, tool.id);
		assert.ok(!tool.text.includes('I will check.'));
		assert.strictEqual(tool.summary, undefined);
		assert.strictEqual(tool.agentId, 'agent-sub');
		assert.notStrictEqual(reading.id, tool.id);
		assert.ok(subPage.indexOf(reading) < subPage.indexOf(tool));
		assert.ok(!project('agent-other').some(entry => entry.id === 'overlay:turn-live' || entry.id === reading.id || entry.text.includes('I will check.')));

		connection.pushStreamEvent(sessionId, {
			tool_call_lifecycle: { turn_id: 'turn-live', tool_call_id: 'tc-live', agent_id: 'agent-sub', args_complete: {} },
		});
		connection.pushStreamEvent(sessionId, {
			tool_call_lifecycle: { turn_id: 'turn-live', tool_call_id: 'tc-live', agent_id: 'agent-sub', completed: {} },
		});
		connection.pushStreamEvent(sessionId, {
			tool_call_lifecycle: { turn_id: 'turn-live', tool_call_id: 'tc-live', agent_id: 'agent-sub', failed: {} },
		});
		const after = project('agent-sub');
		const stillReading = after.find(entry => entry.kind === 'assistant' && entry.text.includes('I will check.'));
		const stillTool = after.find(entry => entry.id === 'overlay:turn-live');
		assert.ok(stillReading);
		assert.ok(stillTool);
		assert.strictEqual(stillTool.kind, 'tool');
		assert.strictEqual(stillTool.toolName, 'bash');
		assert.strictEqual(stillTool.text, 'bash');
		assert.strictEqual(stillTool.id, 'overlay:turn-live');
		assert.strictEqual(stillTool.toolCallId, 'tc-live');
	});
});
