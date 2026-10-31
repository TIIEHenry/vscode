/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ItemAttribution } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { OverlayBlockId, SessionViewSnapshot, TextChunkId, TimelineItemId, TimelineItemView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import {
	createConversationProjectionCache,
	entriesToRenderableTurns,
	entryToRenderableTurn,
	projectSnapshotToEntries,
	stubTurnsToEntries,
	stubTurnsToSnapshot,
	type ConversationSessionViewProjection,
	type ConversationTimelineEntry,
} from '../../browser/conversationSessionView.js';
import type { IConversationSessionChatEntry } from '../../common/conversationSessionChat.js';

function project(
	projection: ConversationSessionViewProjection,
	cache?: ReturnType<typeof createConversationProjectionCache>,
	catalog?: (sessionKey: string) => readonly IConversationSessionChatEntry[],
): ConversationTimelineEntry[] {
	return projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details, catalog, cache);
}

function cloneProjection(projection: ConversationSessionViewProjection): ConversationSessionViewProjection {
	return {
		snapshot: JSON.parse(JSON.stringify(projection.snapshot)) as SessionViewSnapshot,
		attribution: new Map(JSON.parse(JSON.stringify([...projection.attribution.entries()])) as [string, ItemAttribution][]),
		details: new Map(JSON.parse(JSON.stringify([...projection.details.entries()])) as [string, string][]),
	};
}

function replaceTimelineItem(
	snapshot: SessionViewSnapshot,
	id: string,
	replace: (item: TimelineItemView) => TimelineItemView,
): SessionViewSnapshot {
	return {
		...snapshot,
		timeline: snapshot.timeline.map(item => String(item.id) === id ? replace(item) : item),
	};
}

function entryById(entries: readonly ConversationTimelineEntry[], id: string): ConversationTimelineEntry {
	const entry = entries.find(candidate => candidate.id === id);
	assert.ok(entry, id);
	return entry;
}

suite('conversationTimelineProjection', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('cached projection matches an uncached one and reuses untouched entries', () => {
		const base = stubTurnsToSnapshot('s', [
			{ id: 'u1', kind: 'user', text: 'hello' },
			{ id: 'a1', kind: 'assistant', text: 'world' },
			{ id: 't1', kind: 'tool', text: 'read', toolName: 'read' },
		]);
		const cache = createConversationProjectionCache();
		let snapshot = base.snapshot;
		let cached = project({ ...base, snapshot }, cache);
		let uncached = project({ ...base, snapshot });
		assert.deepStrictEqual(cached, uncached);

		const cachedAgain = project({ ...base, snapshot }, cache);
		const uncachedAgain = project({ ...base, snapshot });
		for (let index = 0; index < cached.length; index++) {
			assert.strictEqual(cachedAgain[index], cached[index]);
			assert.notStrictEqual(uncachedAgain[index], uncached[index]);
		}

		const mutations: { id: string; preview: string }[] = [
			{ id: 'a1', preview: 'patched-1' },
			{ id: 'a1', preview: 'patched-2' },
			{ id: 'u1', preview: 'patched-user' },
		];
		for (const mutation of mutations) {
			const beforeCached = cached;
			const beforeUncached = uncached;
			snapshot = replaceTimelineItem(snapshot, mutation.id, item => {
				assert.ok(item.summary.kind === 'text');
				return { ...item, summary: { ...item.summary, preview: mutation.preview } };
			});
			const nextProjection = { ...base, snapshot };
			cached = project(nextProjection, cache);
			uncached = project(nextProjection);
			assert.deepStrictEqual(cached, uncached);
			assert.deepStrictEqual(cached.map(entry => entry.id), beforeCached.map(entry => entry.id));
			for (let index = 0; index < cached.length; index++) {
				if (cached[index]!.id === mutation.id) {
					assert.notStrictEqual(cached[index], beforeCached[index]);
				} else {
					assert.strictEqual(cached[index], beforeCached[index]);
					assert.notStrictEqual(uncached[index], beforeUncached[index]);
				}
			}
		}
		assert.strictEqual(entryById(cached, 't1').text, 'read');
		assert.strictEqual(entryById(cached, 'a1').text, 'patched-2');
		assert.strictEqual(entryById(cached, 'u1').text, 'patched-user');
	});

	test('same-content baseline reuses entry references', () => {
		const base = stubTurnsToSnapshot('s', [
			{ id: 'u1', kind: 'user', text: 'hello' },
			{ id: 'a1', kind: 'assistant', text: 'world' },
			{ id: 't1', kind: 'tool', text: 'read', toolName: 'read' },
		]);
		const cache = createConversationProjectionCache();
		const first = project(base, cache);
		const second = project(cloneProjection(base), cache);
		assert.deepStrictEqual(second, first);
		for (let index = 0; index < first.length; index++) {
			assert.strictEqual(second[index], first[index]);
		}
	});

	test('pending removal changes the confirmation entry status', () => {
		const base = stubTurnsToSnapshot('s', [
			{ id: 'u1', kind: 'user', text: 'hi' },
			{ id: 'c1', kind: 'confirmation', text: 'Allow?', status: 'allowed' },
		]);
		const pendingSnapshot: SessionViewSnapshot = {
			...base.snapshot,
			pendingActions: [{
				requestId: 'c1' as SessionViewSnapshot['pendingActions'][number]['requestId'],
				summary: { kind: 'permission', title: 'Allow?', permissionKind: 'stub', decision: 'allow' },
			}],
		};
		const cache = createConversationProjectionCache();
		const pendingProjection = { ...base, snapshot: pendingSnapshot };
		const pendingCached = project(pendingProjection, cache);
		const pendingFresh = project(pendingProjection);
		assert.deepStrictEqual(pendingCached, pendingFresh);
		assert.strictEqual(entryById(pendingCached, 'c1').status, 'pending');

		const clearedSnapshot: SessionViewSnapshot = { ...pendingSnapshot, pendingActions: [] };
		const clearedProjection = { ...base, snapshot: clearedSnapshot };
		const clearedCached = project(clearedProjection, cache);
		const clearedFresh = project(clearedProjection);
		assert.deepStrictEqual(clearedCached, clearedFresh);
		assert.strictEqual(entryById(clearedCached, 'c1').status, 'allowed');
		assert.notStrictEqual(entryById(clearedCached, 'c1'), entryById(pendingCached, 'c1'));
		assert.strictEqual(entryById(clearedCached, 'u1'), entryById(pendingCached, 'u1'));
	});

	test('question requestId change invalidates that entry', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const userItem = base.snapshot.timeline[0]!;
		const questionItem: TimelineItemView = {
			id: 'ask:child' as TimelineItemId,
			orderKey: '0000000000000002',
			summary: {
				kind: 'question',
				title: 'Pick',
				items: [{ id: 'child', title: 'Child', optionsPreview: ['A'] }],
				answerKeysValid: true,
			},
		};
		const pendingSnapshot: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [userItem, questionItem],
			pendingActions: [{
				requestId: 'ask:child' as SessionViewSnapshot['pendingActions'][number]['requestId'],
				summary: questionItem.summary,
			}],
		};
		const cache = createConversationProjectionCache();
		const pending = project({ ...base, snapshot: pendingSnapshot }, cache);
		assert.strictEqual(entryById(pending, 'ask:child').questionRequestId, 'ask:child');

		const clearedSnapshot: SessionViewSnapshot = { ...pendingSnapshot, pendingActions: [] };
		const cleared = project({ ...base, snapshot: clearedSnapshot }, cache);
		const clearedFresh = project({ ...base, snapshot: clearedSnapshot });
		assert.deepStrictEqual(cleared, clearedFresh);
		assert.strictEqual(entryById(cleared, 'ask:child').questionRequestId, undefined);
		assert.notStrictEqual(entryById(cleared, 'ask:child'), entryById(pending, 'ask:child'));
		assert.strictEqual(entryById(cleared, 'u1'), entryById(pending, 'u1'));
	});

	test('attribution change invalidates that entry', () => {
		const base = stubTurnsToSnapshot('s', [
			{ id: 'u1', kind: 'user', text: 'hi' },
			{ id: 'a1', kind: 'assistant', text: 'answer' },
		]);
		const cache = createConversationProjectionCache();
		const first = project(base, cache);
		const attribution = new Map(base.attribution);
		const previous = attribution.get('a1');
		assert.ok(previous);
		attribution.set('a1', { ...previous, agentId: 'agent-9' });
		const nextProjection = { ...base, attribution };
		const second = project(nextProjection, cache);
		const fresh = project(nextProjection);
		assert.deepStrictEqual(second, fresh);
		assert.strictEqual(entryById(second, 'a1').agentId, 'agent-9');
		assert.notStrictEqual(entryById(second, 'a1'), entryById(first, 'a1'));
		assert.strictEqual(entryById(second, 'u1'), entryById(first, 'u1'));
	});

	test('detail change invalidates the visualize entry', () => {
		const base = stubTurnsToSnapshot('s', [
			{ id: 'u1', kind: 'user', text: 'show' },
			{
				id: 'v1',
				kind: 'visualization',
				text: '',
				visualize: { type: 'diagram', title: 'Road', mermaid: 'flowchart TD\nA-->B' },
			},
		]);
		const ref = [...base.details.keys()][0];
		assert.ok(ref);
		const cache = createConversationProjectionCache();
		const first = project(base, cache);
		const details = new Map(base.details);
		details.set(ref, JSON.stringify({ type: 'diagram', title: 'Road', mermaid: 'flowchart TD\nA-->C' }));
		const nextProjection = { ...base, details };
		const second = project(nextProjection, cache);
		const fresh = project(nextProjection);
		assert.deepStrictEqual(second, fresh);
		assert.notStrictEqual(entryById(second, 'v1'), entryById(first, 'v1'));
		const visualize = entryById(second, 'v1').visualize;
		assert.ok(visualize && visualize.type === 'diagram');
		assert.strictEqual(visualize.mermaid, 'flowchart TD\nA-->C');
		assert.strictEqual(entryById(second, 'u1'), entryById(first, 'u1'));
	});

	test('link catalog version invalidates assistant text entries only', () => {
		const original = 'See [Tool A (Stub)](/session/untitled/chat/tool-a).';
		const base = stubTurnsToSnapshot('untitled', [
			{ id: 'u1', kind: 'user', text: 'hi' },
			{ id: 'a1', kind: 'assistant', text: original },
			{ id: 't1', kind: 'tool', text: 'read', toolName: 'read' },
		]);
		const catalog = (sessionKey: string): readonly IConversationSessionChatEntry[] => sessionKey === 'untitled' ? [{
			sessionKey: 'untitled',
			chatId: 'tool-a',
			title: 'Tool A (Stub)',
			originKind: 'tool',
		}] : [];
		const cache = createConversationProjectionCache();
		const first = project(base, cache, catalog);
		assert.strictEqual(entryById(first, 'a1').text, 'See [Tool A (Stub)](conversation-chat:/session/untitled/chat/tool-a).');
		cache.linkCatalogVersion++;
		const second = project(base, cache, catalog);
		const fresh = project(base, undefined, catalog);
		assert.deepStrictEqual(second, fresh);
		assert.notStrictEqual(entryById(second, 'a1'), entryById(first, 'a1'));
		assert.strictEqual(entryById(second, 'u1'), entryById(first, 'u1'));
		assert.strictEqual(entryById(second, 't1'), entryById(first, 't1'));
	});

	test('entriesToRenderableTurns reuses turns only when a cache is passed', () => {
		const base = stubTurnsToSnapshot('s', [
			{ id: 'u1', kind: 'user', text: 'hello' },
			{ id: 'a1', kind: 'assistant', text: 'world' },
		]);
		const cache = createConversationProjectionCache();
		const entries = project(base, cache);
		const first = entriesToRenderableTurns(entries, cache);
		const second = entriesToRenderableTurns(entries, cache);
		assert.strictEqual(first[0], second[0]);
		assert.strictEqual(first[1], second[1]);
		const fresh = entriesToRenderableTurns(entries);
		assert.notStrictEqual(fresh[0], first[0]);
		assert.notStrictEqual(fresh[1], first[1]);
		assert.deepStrictEqual(fresh, first);
	});

	test('single non-think overlay chunk stays the chunk text', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'first' }]);
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			overlay: {
				blocks: [{
					blockId: 'b1' as OverlayBlockId,
					orderKey: '0000000001',
					summary: { kind: 'text', title: 'Agent', preview: '' },
					chunks: [{ chunkId: 'c1' as TextChunkId, orderKey: '0000000000', text: 'streaming' }],
				}],
			},
		};
		const entries = project({ ...base, snapshot });
		const overlay = entryById(entries, 'overlay:b1');
		assert.strictEqual(overlay.text, 'streaming');
		assert.strictEqual(overlay.thinkingText, undefined);
	});

	test('tool overlay keeps thinking chunks out of text', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			overlay: {
				blocks: [{
					blockId: 'b1' as OverlayBlockId,
					orderKey: '0000000000000001',
					summary: { kind: 'tool', title: 'shell', toolName: 'shell', status: 'running' },
					chunks: [
						{ chunkId: 't:think:0' as TextChunkId, orderKey: '0000000000000000', text: 'hmm' },
						{ chunkId: 't:0' as TextChunkId, orderKey: '0000000000000001', text: 'run' },
					],
				}],
			},
		};
		const cached = createConversationProjectionCache();
		const entries = project({ ...base, snapshot }, cached);
		const again = project({ ...base, snapshot }, cached);
		const fresh = project({ ...base, snapshot });
		assert.deepStrictEqual(entries, fresh);
		assert.deepStrictEqual(again, fresh);
		const overlay = entryById(entries, 'overlay:b1');
		assert.strictEqual(overlay.kind, 'tool');
		assert.strictEqual(overlay.text, 'shell');
		assert.strictEqual(overlay.thinkingText, 'hmm');
		assert.notStrictEqual(overlay.text, 'run');
		assert.notStrictEqual(overlay.text, 'hmmrun');
		const think = entryById(entries, 'overlay:b1:think');
		assert.strictEqual(think.kind, 'thinking');
		assert.strictEqual(think.text, 'hmm');
		assert.strictEqual(think.thinkingText, undefined);
		const body = entries.find(entry => entry.kind === 'assistant' && entry.text === 'run');
		assert.ok(body);
		assert.strictEqual(body.id, 'overlay:b1:body');
		const thinkIndex = entries.findIndex(entry => entry.id === 'overlay:b1:think');
		const bodyIndex = entries.findIndex(entry => entry.id === 'overlay:b1:body');
		const toolIndex = entries.findIndex(entry => entry.id === 'overlay:b1');
		assert.ok(thinkIndex >= 0 && thinkIndex < bodyIndex && bodyIndex < toolIndex);
		assert.strictEqual(again.find(entry => entry.id === 'overlay:b1:think'), think);
		assert.strictEqual(again.find(entry => entry.id === 'overlay:b1:body'), body);
		assert.strictEqual(again.find(entry => entry.id === 'overlay:b1'), overlay);
		const rendered = entriesToRenderableTurns(entries, cached);
		assert.strictEqual(rendered.find(turn => turn.id === 'overlay:b1:think')?.text, 'hmm');
		assert.strictEqual(rendered.find(turn => turn.id === 'overlay:b1')?.thinkingText, undefined);
		assert.strictEqual(rendered.find(turn => turn.id === 'overlay:b1:body')?.text, 'run');
		const turn = entryToRenderableTurn(overlay);
		assert.strictEqual(turn.thinkingText, 'hmm');
		assert.strictEqual(turn.text, 'shell');
		assert.strictEqual(stubTurnsToEntries([turn])[0]?.thinkingText, 'hmm');
		assert.strictEqual(entriesToRenderableTurns([overlay], cached)[0]?.thinkingText, 'hmm');
	});

	test('cached multi-call tool envelope keeps the body and both names', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const item: TimelineItemView = {
			id: 'env-1' as TimelineItemId,
			orderKey: '0000000002',
			turnId: 'turn-1',
			summary: {
				kind: 'tool',
				title: 'Read a file',
				toolName: 'read_file',
				toolNames: ['read_file', 'grep'],
				status: 'completed',
				assistantText: 'I will check the file.',
			},
		};
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [...base.snapshot.timeline, item],
		};
		const attribution = new Map(base.attribution);
		attribution.set('env-1', { role: 'tool', agentId: 'agent-sub' });
		const projection = { ...base, snapshot, attribution };
		const cache = createConversationProjectionCache();
		const first = project(projection, cache);
		const second = project(projection, cache);
		const fresh = project(projection);
		const ids = ['env-1:body', 'env-1', 'env-1:tool:1'];
		assert.deepStrictEqual(first.filter(entry => entry.id.startsWith('env-1')).map(entry => entry.id), ids);
		assert.deepStrictEqual(second.filter(entry => entry.id.startsWith('env-1')).map(entry => entry.id), ids);
		assert.deepStrictEqual(fresh.filter(entry => entry.id.startsWith('env-1')).map(entry => entry.id), ids);
		assert.deepStrictEqual(second, fresh);
		for (const id of ids) {
			assert.strictEqual(entryById(second, id), entryById(first, id));
			assert.strictEqual(entryById(second, id).agentId, 'agent-sub');
			assert.strictEqual(entryById(second, id).turnId, 'turn-1');
		}
		assert.strictEqual(entryById(second, 'env-1:body').kind, 'assistant');
		assert.strictEqual(entryById(second, 'env-1:body').text, 'I will check the file.');
		assert.strictEqual(entryById(second, 'env-1').kind, 'tool');
		assert.strictEqual(entryById(second, 'env-1').text, 'read_file');
		assert.strictEqual(entryById(second, 'env-1').toolName, 'read_file');
		assert.strictEqual(entryById(second, 'env-1:tool:1').kind, 'tool');
		assert.strictEqual(entryById(second, 'env-1:tool:1').text, 'grep');
		assert.strictEqual(entryById(second, 'env-1:tool:1').toolName, 'grep');

		const cloned = project(cloneProjection(projection), cache);
		assert.deepStrictEqual(cloned.filter(entry => entry.id.startsWith('env-1')).map(entry => entry.id), ids);
		for (const id of ids) {
			assert.strictEqual(entryById(cloned, id), entryById(first, id));
		}

		const single: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [...base.snapshot.timeline, {
				...item,
				id: 'env-2' as TimelineItemId,
				summary: {
					kind: 'tool',
					title: 'Read a file',
					toolName: 'read_file',
					status: 'completed',
					assistantText: 'I will check the file.',
				},
			}],
		};
		const one = project({ ...base, snapshot: single, attribution });
		assert.deepStrictEqual(one.filter(entry => entry.id.startsWith('env-2')).map(entry => entry.id), ['env-2:body', 'env-2']);
		assert.strictEqual(entryById(one, 'env-2').text, 'read_file');
		assert.strictEqual(entryById(one, 'env-2').toolName, 'read_file');
		assert.ok(!one.some(entry => entry.id === 'env-2:tool:1'));
	});

	test('text overlay with thinking draws the thought before the body', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			overlay: {
				blocks: [{
					blockId: 'b1' as OverlayBlockId,
					orderKey: '0000000000000001',
					summary: { kind: 'text', title: 'Agent', preview: 'I will check.' },
					chunks: [
						{ chunkId: 't:think:0' as TextChunkId, orderKey: '0000000000000000', text: 'hmm' },
						{ chunkId: 't:0' as TextChunkId, orderKey: '0000000000000001', text: 'I will check.' },
					],
				}],
			},
		};
		const attribution = new Map(base.attribution);
		attribution.set('overlay:b1', { role: 'assistant', agentId: 'agent-sub' });
		const projection = { ...base, snapshot, attribution };
		const cache = createConversationProjectionCache();
		const first = project(projection, cache);
		const second = project(projection, cache);
		const fresh = project(projection);
		const ids = first.filter(entry => entry.id.startsWith('overlay:b1')).map(entry => entry.id);
		assert.deepStrictEqual(ids, ['overlay:b1:think', 'overlay:b1']);
		assert.deepStrictEqual(second.filter(entry => entry.id.startsWith('overlay:b1')).map(entry => entry.id), ids);
		assert.deepStrictEqual(fresh.filter(entry => entry.id.startsWith('overlay:b1')).map(entry => entry.id), ids);
		for (const id of ids) {
			assert.strictEqual(entryById(second, id), entryById(first, id));
		}
		assert.strictEqual(entryById(first, 'overlay:b1:think').kind, 'thinking');
		assert.strictEqual(entryById(first, 'overlay:b1:think').text, 'hmm');
		assert.strictEqual(entryById(first, 'overlay:b1:think').agentId, 'agent-sub');
		assert.strictEqual(entryById(first, 'overlay:b1').kind, 'assistant');
		assert.strictEqual(entryById(first, 'overlay:b1').text, 'I will check.');
		assert.ok(!entryById(first, 'overlay:b1').text.includes('hmm'));
		assert.strictEqual(entryById(first, 'overlay:b1').thinkingText, 'hmm');
	});

	test('whitespace thinking does not add an empty reading row', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			overlay: {
				blocks: [{
					blockId: 'b1' as OverlayBlockId,
					orderKey: '0000000000000001',
					summary: { kind: 'text', title: 'Agent', preview: 'hello' },
					chunks: [
						{ chunkId: 't:think:0' as TextChunkId, orderKey: '0000000000000000', text: '   \n\t' },
						{ chunkId: 't:0' as TextChunkId, orderKey: '0000000000000001', text: 'hello' },
					],
				}],
			},
			timeline: [...base.snapshot.timeline, {
				id: 'blank-think' as TimelineItemId,
				orderKey: '0000000000000002',
				summary: {
					kind: 'tool',
					title: 'read_file',
					toolName: 'read_file',
					status: 'completed',
					assistantText: 'hello',
					thinkingText: ' \n\t ',
				},
			}],
		};
		const entries = project({ ...base, snapshot });
		assert.ok(!entries.some(entry => entry.id.endsWith(':think')));
		assert.strictEqual(entryById(entries, 'overlay:b1').text, 'hello');
		assert.strictEqual(entryById(entries, 'overlay:b1').thinkingText, undefined);
		assert.deepStrictEqual(entries.filter(entry => entry.id.startsWith('blank-think')).map(entry => entry.id), ['blank-think:body', 'blank-think']);
		assert.strictEqual(entryById(entries, 'blank-think').thinkingText, undefined);
	});

	test('same envelope thinking stays ahead of the body and every tool name', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const item: TimelineItemView = {
			id: 'env-think' as TimelineItemId,
			orderKey: '0000000002',
			turnId: 'turn-1',
			summary: {
				kind: 'tool',
				title: 'Read a file',
				toolName: 'read_file',
				toolNames: ['read_file', 'grep'],
				status: 'completed',
				assistantText: 'I will check the file.',
				thinkingText: 'hmm',
			},
		};
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [...base.snapshot.timeline, item],
		};
		const attribution = new Map(base.attribution);
		attribution.set('env-think', { role: 'tool', agentId: 'agent-sub' });
		const projection = { ...base, snapshot, attribution };
		const cache = createConversationProjectionCache();
		const first = project(projection, cache);
		const second = project(projection, cache);
		const fresh = project(projection);
		const ids = ['env-think:think', 'env-think:body', 'env-think', 'env-think:tool:1'];
		assert.deepStrictEqual(first.filter(entry => entry.id.startsWith('env-think')).map(entry => entry.id), ids);
		assert.deepStrictEqual(second.filter(entry => entry.id.startsWith('env-think')).map(entry => entry.id), ids);
		assert.deepStrictEqual(fresh.filter(entry => entry.id.startsWith('env-think')).map(entry => entry.id), ids);
		assert.deepStrictEqual(second, fresh);
		for (const id of ids) {
			assert.strictEqual(entryById(second, id), entryById(first, id));
			assert.strictEqual(entryById(second, id).agentId, 'agent-sub');
			assert.strictEqual(entryById(second, id).turnId, 'turn-1');
		}
		assert.strictEqual(entryById(first, 'env-think:think').kind, 'thinking');
		assert.strictEqual(entryById(first, 'env-think:think').text, 'hmm');
		assert.strictEqual(entryById(first, 'env-think:body').kind, 'assistant');
		assert.strictEqual(entryById(first, 'env-think:body').text, 'I will check the file.');
		assert.ok(!entryById(first, 'env-think:body').text.includes('hmm'));
		assert.strictEqual(entryById(first, 'env-think').kind, 'tool');
		assert.strictEqual(entryById(first, 'env-think').text, 'read_file');
		assert.strictEqual(entryById(first, 'env-think').toolName, 'read_file');
		assert.strictEqual(entryById(first, 'env-think').thinkingText, 'hmm');
		assert.strictEqual(entryById(first, 'env-think:tool:1').text, 'grep');
		assert.strictEqual(entryById(first, 'env-think:tool:1').toolName, 'grep');
		assert.strictEqual(entryById(first, 'env-think:tool:1').thinkingText, undefined);

		const rendered = entriesToRenderableTurns(first, cache);
		assert.strictEqual(rendered.find(turn => turn.id === 'env-think:think')?.text, 'hmm');
		assert.strictEqual(rendered.find(turn => turn.id === 'env-think')?.thinkingText, undefined);
		assert.strictEqual(rendered.find(turn => turn.id === 'env-think:tool:1')?.thinkingText, undefined);
		assert.strictEqual(entriesToRenderableTurns([entryById(first, 'env-think')], cache)[0]?.thinkingText, 'hmm');

		const textOnly: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [...base.snapshot.timeline, {
				id: 'text-think' as TimelineItemId,
				orderKey: '0000000003',
				turnId: 'turn-1',
				summary: { kind: 'text', title: 'Agent', preview: 'hello', thinkingText: 'hmm' },
			}],
		};
		const textAttribution = new Map(base.attribution);
		textAttribution.set('text-think', { role: 'assistant', agentId: 'agent-sub' });
		const textCache = createConversationProjectionCache();
		const textFirst = project({ ...base, snapshot: textOnly, attribution: textAttribution }, textCache);
		const textSecond = project({ ...base, snapshot: textOnly, attribution: textAttribution }, textCache);
		assert.deepStrictEqual(textFirst.filter(entry => entry.id.startsWith('text-think')).map(entry => entry.id), ['text-think:think', 'text-think']);
		assert.strictEqual(entryById(textSecond, 'text-think:think'), entryById(textFirst, 'text-think:think'));
		assert.strictEqual(entryById(textSecond, 'text-think'), entryById(textFirst, 'text-think'));
		assert.strictEqual(entryById(textFirst, 'text-think:think').kind, 'thinking');
		assert.strictEqual(entryById(textFirst, 'text-think:think').text, 'hmm');
		assert.strictEqual(entryById(textFirst, 'text-think').kind, 'assistant');
		assert.strictEqual(entryById(textFirst, 'text-think').text, 'hello');
		assert.ok(!entryById(textFirst, 'text-think').text.includes('hmm'));
		assert.strictEqual(entryById(textFirst, 'text-think').agentId, 'agent-sub');
	});

	test('reasoning overlay keeps only the thinking chunk in text', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			overlay: {
				blocks: [{
					blockId: 'b1' as OverlayBlockId,
					orderKey: '0000000000000001',
					summary: { kind: 'reasoning', title: 'Thinking' },
					chunks: [{ chunkId: 't:think:0' as TextChunkId, orderKey: '0000000000000000', text: 'hmm' }],
				}],
			},
		};
		const entries = project({ ...base, snapshot });
		const overlay = entryById(entries, 'overlay:b1');
		assert.strictEqual(overlay.kind, 'thinking');
		assert.strictEqual(overlay.text, 'hmm');
		assert.strictEqual(overlay.thinkingText, undefined);
		assert.ok(!entries.some(entry => entry.id.endsWith(':think')));
	});

	test('persisted reasoning keeps the joined thinking preview on the reading line', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const item: TimelineItemView = {
			id: 'env-reason' as TimelineItemId,
			orderKey: '0000000002',
			turnId: 'turn-1',
			summary: {
				kind: 'reasoning',
				title: 'THINKING',
				collapsedPreview: 'hmm\nthen this',
			},
		};
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [...base.snapshot.timeline, item],
		};
		const attribution = new Map(base.attribution);
		attribution.set('env-reason', { role: 'assistant', agentId: 'agent-sub' });
		const projection = { ...base, snapshot, attribution };
		const cache = createConversationProjectionCache();
		const first = project(projection, cache);
		const second = project(projection, cache);
		assert.deepStrictEqual(first.filter(entry => entry.id.startsWith('env-reason')).map(entry => entry.id), ['env-reason']);
		assert.strictEqual(entryById(second, 'env-reason'), entryById(first, 'env-reason'));
		const row = entryById(first, 'env-reason');
		assert.strictEqual(row.kind, 'thinking');
		assert.strictEqual(row.text, 'hmm\nthen this');
		assert.notStrictEqual(row.text, 'THINKING');
		assert.strictEqual(row.payload, 'hmm\nthen this');
		assert.strictEqual(row.agentId, 'agent-sub');
		assert.strictEqual(row.turnId, 'turn-1');
		const rendered = entriesToRenderableTurns(first, cache);
		const turn = rendered.find(candidate => candidate.id === 'env-reason');
		assert.ok(turn);
		assert.strictEqual(turn.text, 'hmm\nthen this');
		assert.strictEqual(turn.payload, 'hmm\nthen this');

		const fallback: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [...base.snapshot.timeline, {
				id: 'env-blank' as TimelineItemId,
				orderKey: '0000000003',
				summary: { kind: 'reasoning', title: 'THINKING', collapsedPreview: ' \n\t ' },
			}, {
				id: 'env-title' as TimelineItemId,
				orderKey: '0000000004',
				summary: { kind: 'reasoning', title: 'Fallback title' },
			}],
		};
		const fallbackEntries = project({ ...base, snapshot: fallback });
		const blank = entryById(fallbackEntries, 'env-blank');
		assert.strictEqual(blank.kind, 'thinking');
		assert.strictEqual(blank.text, 'THINKING');
		assert.strictEqual(blank.payload, undefined);
		const titled = entryById(fallbackEntries, 'env-title');
		assert.strictEqual(titled.text, 'Fallback title');
		assert.strictEqual(titled.payload, undefined);
	});
});
