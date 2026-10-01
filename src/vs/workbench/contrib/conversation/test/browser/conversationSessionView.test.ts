/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ITreeNode } from '../../../../../base/browser/ui/tree/tree.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { ConversationViewFrameApplied, ItemAttribution } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { DetailRef, OperationId, OverlayBlockId, SessionViewSnapshot, TextChunkId, TimelineItemId, TimelineItemView } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import { projectProcessFoldSpans } from '../../browser/conversationProcessFoldModel.js';
import {
	diffProjections,
	entriesToLegacyTurns,
	entryToRenderableTurn,
	projectSnapshotToEntries,
	stubTurnsToEntries,
	stubTurnsToSnapshot,
	type ConversationSessionViewProjection,
	type ConversationTimelineEntry,
} from '../../browser/conversationSessionView.js';
import { CONVERSATION_STUB_SEED_SESSIONS, ConversationStubTurn } from '../../browser/conversationStubModel.js';
import { ConversationStubService } from '../../browser/conversationStubService.js';
import { ConversationTimelineRenderer } from '../../browser/conversationTimelineRenderer.js';
import type { ConversationTimelineItem } from '../../browser/conversationTimelineTypes.js';
import { IConversationSessionChatEntry } from '../../common/conversationSessionChat.js';
import type { IWebviewService } from '../../../webview/browser/webview.js';

function roundTrip(sessionId: string, turns: readonly ConversationStubTurn[]): ConversationStubTurn[] {
	const projection = stubTurnsToSnapshot(sessionId, turns);
	return entriesToLegacyTurns(projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details));
}

function projectLegacy(service: ConversationStubService, projection: ConversationSessionViewProjection): ConversationStubTurn[] {
	return entriesToLegacyTurns(projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details, service.stubTurnSessionLinkCatalog));
}

function renderProjectedTurn(entry: ConversationTimelineEntry, assertRow: (container: HTMLElement) => void): void {
	const turn = entryToRenderableTurn(entry);
	const renderer = new ConversationTimelineRenderer(
		{
			renderTurnBody: (bodyTurn, container) => {
				container.textContent = bodyTurn.text;
				return Disposable.None;
			},
		},
		() => { },
		undefined,
		undefined,
		() => { },
		undefined,
		undefined,
		undefined,
		undefined,
		undefined,
		() => undefined,
		undefined,
		() => undefined,
		() => false,
		() => true,
		() => false,
		{} as IWebviewService,
		() => undefined,
		() => { },
	);
	const container = document.createElement('div');
	const template = renderer.renderTemplate(container);
	try {
		renderer.renderElement({
			element: { variant: 'turn', turn },
			children: [],
			depth: 0,
			visibleChildrenCount: 0,
			visibleChildIndex: 0,
			collapsible: false,
			collapsed: false,
			filterData: undefined,
		} as unknown as ITreeNode<ConversationTimelineItem, void>, 0, template);
		assertRow(container);
	} finally {
		template.disposables.dispose();
	}
}

suite('conversationSessionView (S1)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('seed fixtures round-trip through the view contract without loss', () => {
		for (const session of CONVERSATION_STUB_SEED_SESSIONS) {
			assert.deepStrictEqual(roundTrip(session.id, session.turns), session.turns, session.id);
		}
	});

	test('entryToRenderableTurn forwards streaming and toolStatus to the render turn', () => {
		const turn = entryToRenderableTurn({
			id: 'overlay:1',
			kind: 'tool',
			text: 'read',
			toolName: 'read',
			streaming: true,
			toolStatus: 'running',
		});
		assert.strictEqual(turn.streaming, true);
		assert.strictEqual(turn.toolStatus, 'running');
		assert.strictEqual(turn.respondable, undefined);
	});

	test('entryToRenderableTurn forwards optimistic pending and omits it on durable rows', () => {
		const pending = entryToRenderableTurn({ id: 'send:op-1', kind: 'user', text: 'second', pending: true });
		assert.strictEqual(pending.pending, true);
		assert.strictEqual(stubTurnsToEntries([pending])[0]?.pending, true);
		const durable = entryToRenderableTurn({ id: 'u1', kind: 'user', text: 'first' });
		assert.strictEqual(durable.pending, undefined);
		assert.strictEqual(stubTurnsToEntries([durable])[0]?.pending, undefined);
		assert.deepStrictEqual(entriesToLegacyTurns([
			{ id: 'u1', kind: 'user', text: 'first' },
			{ id: 'send:op-1', kind: 'user', text: 'second', pending: true },
		]).map(turn => turn.id), ['u1']);
	});

	test('projection keeps tool respondable only when the snapshot already set it', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 't1', kind: 'tool', text: 'client', toolName: 'clientTool' }]);
		const item = base.snapshot.timeline[0];
		assert.ok(item && item.summary.kind === 'tool');
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [{
				...item,
				summary: { ...item.summary, respondable: true },
			}],
			overlay: {
				blocks: [{
					blockId: 'b1' as OverlayBlockId,
					orderKey: '0000000001',
					summary: { kind: 'tool', title: 'stream', toolName: 'read', status: 'running' },
					chunks: [],
				}, {
					blockId: 'b2' as OverlayBlockId,
					orderKey: '0000000002',
					summary: { kind: 'tool', title: 'client', toolName: 'clientTool', status: 'pending', respondable: true },
					chunks: [],
				}],
			},
		};
		const entries = projectSnapshotToEntries(snapshot, base.attribution, base.details);
		assert.strictEqual(entries.find(entry => entry.id === 't1')?.respondable, true);
		assert.strictEqual(entries.find(entry => entry.id === 'overlay:b1')?.respondable, undefined);
		assert.strictEqual(entries.find(entry => entry.id === 'overlay:b2')?.respondable, true);

		const renderable = entryToRenderableTurn(entries.find(entry => entry.id === 't1')!);
		assert.strictEqual(renderable.respondable, true);
		assert.strictEqual(stubTurnsToEntries([renderable])[0]?.respondable, true);
		assert.strictEqual(stubTurnsToEntries([{
			id: 'overlay:1',
			kind: 'tool',
			text: 'read',
			toolName: 'read',
			streaming: true,
			toolStatus: 'running',
		}])[0]?.respondable, undefined);
	});

	test('stub snapshot never claims a live sync or streaming rows', () => {
		for (const session of CONVERSATION_STUB_SEED_SESSIONS) {
			const { snapshot, attribution } = stubTurnsToSnapshot(session.id, session.turns);
			assert.deepStrictEqual(snapshot.sync, { kind: 'idle' });
			assert.strictEqual(snapshot.overlay.blocks.length, 0);
			assert.ok(snapshot.timeline.every(item => !((item.summary.kind === 'text' || item.summary.kind === 'reasoning') && item.summary.streaming)));
			for (const item of snapshot.timeline) {
				const attr = attribution.get(String(item.id));
				assert.ok(attr, `missing attribution for ${String(item.id)}`);
				if (attr.role !== 'user') {
					assert.strictEqual(attr.stub, true, `${String(item.id)} must be marked Stub`);
				}
			}
		}
	});

	test('role comes from attribution only: a text row without attribution renders neutral, not by title', () => {
		const { snapshot } = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
		const entries = projectSnapshotToEntries(snapshot, new Map(), new Map());
		assert.notStrictEqual(entries[0].kind, 'assistant');
		assert.notStrictEqual(entries[0].kind, 'user');
		assert.strictEqual(entries[0].readOnlyText, 'neutral');
		assert.strictEqual(entries[0].text, 'hi');
		assert.strictEqual(entries[0].stubEcho, undefined);
		renderProjectedTurn(entries[0], rendered => {
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-body')?.textContent, 'hi');
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-header')?.textContent, 'Text');
			assert.strictEqual(rendered.querySelector('[data-kind="neutral"]')?.getAttribute('data-readonly-text'), 'neutral');
			assert.strictEqual(rendered.querySelector('[data-honest-kind]'), null);
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-action-regenerate'), null);
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-action-delete'), null);
		});
		assert.ok(!projectProcessFoldSpans([entryToRenderableTurn(entries[0])]).some(span => span.turnIds.includes('u1')));
	});

	test('tool-role text is a read-only row, not an assistant turn', () => {
		const { snapshot, attribution } = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'tool body' }]);
		const toolAttribution = new Map<string, ItemAttribution>(attribution);
		toolAttribution.set('u1', { role: 'tool' });
		const entries = projectSnapshotToEntries(snapshot, toolAttribution, new Map());
		assert.notStrictEqual(entries[0].kind, 'assistant');
		assert.notStrictEqual(entries[0].kind, 'tool');
		assert.notStrictEqual(entries[0].kind, 'thinking');
		assert.strictEqual(entries[0].readOnlyText, 'context');
		assert.strictEqual(entries[0].text, 'tool body');
		renderProjectedTurn(entries[0], rendered => {
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-header')?.textContent, 'Context');
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-body')?.textContent, 'tool body');
			assert.strictEqual(rendered.querySelector('[data-kind="context"]')?.getAttribute('data-readonly-text'), 'context');
			assert.strictEqual(rendered.querySelector('[data-honest-kind]'), null);
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-process'), null);
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-action-regenerate'), null);
			assert.strictEqual(rendered.querySelector('.conversation-lens-turn-action-delete'), null);
		});
		const folded = projectProcessFoldSpans([
			{ id: 'th', kind: 'thinking', text: 'consider' },
			entryToRenderableTurn(entries[0]),
			{ id: 'tool-1', kind: 'tool', text: 'grep', toolName: 'grep' },
		]);
		assert.ok(folded.every(span => !span.turnIds.includes('u1')));
	});

	test('question request id is the longest pending prefix, independent of insertion order', () => {
		const projectQuestion = (pendingRequestIds: readonly string[]) => {
			const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'hi' }]);
			const questionItem: TimelineItemView = {
				id: 'ask:sub:q_0' as TimelineItemId,
				orderKey: '0000000000000002',
				summary: {
					kind: 'question',
					title: 'Pick',
					items: [{ id: 'q_0', title: 'Child', optionsPreview: ['A'] }],
					answerKeysValid: true,
				},
			};
			const snapshot: SessionViewSnapshot = {
				...base.snapshot,
				timeline: [...base.snapshot.timeline, questionItem],
				pendingActions: pendingRequestIds.map(requestId => ({
					requestId: requestId as SessionViewSnapshot['pendingActions'][number]['requestId'],
					summary: questionItem.summary,
				})),
			};
			return projectSnapshotToEntries(snapshot, base.attribution, base.details).find(entry => entry.id === 'ask:sub:q_0');
		};

		assert.strictEqual(projectQuestion(['ask', 'ask:sub'])?.questionRequestId, 'ask:sub');
		assert.strictEqual(projectQuestion(['ask:sub', 'ask'])?.questionRequestId, 'ask:sub');
		assert.strictEqual(projectQuestion(['ask:sub:q_0', 'ask'])?.questionRequestId, 'ask:sub:q_0');
		assert.strictEqual(projectQuestion(['other'])?.questionRequestId, undefined);
		assert.strictEqual(projectQuestion([])?.questionRequestId, undefined);
	});

	test('permission outside pendingActions without a decision is undecided and has no seat actions', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'c1', kind: 'confirmation', text: 'Run the tool?', status: 'allowed' }]);
		const item = base.snapshot.timeline[0];
		assert.ok(item && item.summary.kind === 'permission');
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			timeline: [{
				...item,
				summary: { kind: 'permission', title: 'Run the tool?', permissionKind: 'stub' },
			}],
			pendingActions: [],
		};
		const [entry] = projectSnapshotToEntries(snapshot, base.attribution, base.details);
		assert.ok(entry);
		assert.notStrictEqual(entry.status, 'pending');
		assert.strictEqual(entry.status, 'undecided');
		renderProjectedTurn(entry, rendered => {
			assert.strictEqual(rendered.querySelector('.conversation-lens-confirmation-actions'), null);
			assert.strictEqual(rendered.querySelector('.monaco-button'), null);
			const text = rendered.textContent ?? '';
			assert.ok(!text.includes('Allow'));
			assert.ok(!text.includes('Skip'));
			assert.ok(!text.includes('Allowed'));
			assert.ok(!text.includes('Skipped'));
			assert.ok(text.includes('Run the tool?'));
		});
	});

	test('visualize stays a tool row unless parseVisualizeArgs accepts the detail', () => {
		const projectVisualize = (body: string | undefined) => {
			const base = stubTurnsToSnapshot('s', [{ id: 'v1', kind: 'tool', text: 'Roadmap', toolName: 'visualize' }]);
			const item = base.snapshot.timeline[0];
			assert.ok(item && item.summary.kind === 'tool');
			const detail = 'detail:v1' as DetailRef;
			const snapshot: SessionViewSnapshot = {
				...base.snapshot,
				timeline: [{ ...item, detail, summary: { ...item.summary, toolName: 'visualize', title: 'Roadmap' } }],
			};
			const details = new Map(base.details);
			if (body !== undefined) {
				details.set(detail, body);
			}
			return projectSnapshotToEntries(snapshot, base.attribution, details)[0];
		};

		const missingMermaid = projectVisualize(JSON.stringify({ type: 'diagram', title: 'Road' }));
		assert.strictEqual(missingMermaid?.kind, 'tool');
		assert.strictEqual(missingMermaid?.visualize, undefined);

		const blankMermaid = projectVisualize(JSON.stringify({ type: 'diagram', mermaid: '   ' }));
		assert.strictEqual(blankMermaid?.kind, 'tool');

		const otherType = projectVisualize(JSON.stringify({ type: 'sketch', mermaid: 'graph LR; A-->B' }));
		assert.strictEqual(otherType?.kind, 'tool');

		const notObject = projectVisualize(JSON.stringify('graph LR; A-->B'));
		assert.strictEqual(notObject?.kind, 'tool');

		const valid = projectVisualize(JSON.stringify({ type: 'diagram', title: 'Road', mermaid: 'graph LR; A-->B' }));
		assert.strictEqual(valid?.kind, 'visualization');
		assert.deepStrictEqual(valid?.visualize, { type: 'diagram', title: 'Road', mermaid: 'graph LR; A-->B' });
	});

	test('pending permission is driven by pendingActions, decision by the timeline record', () => {
		const turns: ConversationStubTurn[] = [
			{ id: 'c-pending', kind: 'confirmation', text: 'Allow?', status: 'pending' },
			{ id: 'c-allowed', kind: 'confirmation', text: 'Allow?', status: 'allowed' },
			{ id: 'c-skipped', kind: 'confirmation', text: 'Allow?', status: 'skipped' },
		];
		const { snapshot } = stubTurnsToSnapshot('s', turns);
		assert.deepStrictEqual(snapshot.pendingActions.map(a => String(a.requestId)), ['c-pending']);
		assert.deepStrictEqual(roundTrip('s', turns).map(t => t.status), ['pending', 'allowed', 'skipped']);
	});

	test('localPendingSends project as pending user rows and are dropped from legacy turns', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'first' }]);
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			localPendingSends: [{ operationId: 'op-1' as SessionViewSnapshot['localPendingSends'][number]['operationId'], summary: { kind: 'text', title: 'You', preview: 'second' } }],
		};
		const entries = projectSnapshotToEntries(snapshot, base.attribution, base.details);
		assert.deepStrictEqual(entries.map(e => [e.id, e.kind, e.text, e.pending ?? false]), [
			['u1', 'user', 'first', false],
			['send:op-1', 'user', 'second', true],
		]);
		assert.deepStrictEqual(entriesToLegacyTurns(entries).map(t => t.id), ['u1']);
	});

	test('localPendingSends sit after the timeline and before the overlay (§3.3)', () => {
		const base = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'first' }]);
		const snapshot: SessionViewSnapshot = {
			...base.snapshot,
			localPendingSends: [
				{ operationId: 'op-1' as OperationId, summary: { kind: 'text', title: 'You', preview: 'second' } },
				{ operationId: 'op-2' as OperationId, summary: { kind: 'text', title: 'You', preview: 'third' } },
			],
			overlay: {
				blocks: [{
					blockId: 'b1' as OverlayBlockId,
					orderKey: '0000000001',
					summary: { kind: 'text', title: 'Agent', preview: '' },
					chunks: [{ chunkId: 'c1' as TextChunkId, orderKey: '0000000000', text: 'streaming' }],
				}],
			},
		};
		const entries = projectSnapshotToEntries(snapshot, base.attribution, base.details);
		assert.deepStrictEqual(entries.map(e => e.id), ['u1', 'send:op-1', 'send:op-2', 'overlay:b1']);
	});

	test('diffProjections emits id-keyed patches only for what changed', () => {
		const before = stubTurnsToSnapshot('s', [
			{ id: 'u1', kind: 'user', text: 'a' },
			{ id: 'c1', kind: 'confirmation', text: 'Allow?', status: 'pending' },
		]);
		const after = stubTurnsToSnapshot('s', [
			{ id: 'u1', kind: 'user', text: 'a' },
			{ id: 'c1', kind: 'confirmation', text: 'Allow?', status: 'allowed' },
			{ id: 'a1', kind: 'assistant', text: 'Stub echo', stubEcho: true },
		]);
		const diff = diffProjections(before, after);
		assert.deepStrictEqual(diff.patches.map(p => p.op).sort(), ['removePendingAction', 'upsertTimelineItem', 'upsertTimelineItem']);
		assert.deepStrictEqual([...diff.changedIds].sort(), ['a1', 'c1', 'pending:c1']);
		assert.deepStrictEqual(diff.attribution.map(p => p.op === 'upsertAttribution' ? p.itemId : `-${p.itemId}`), ['a1']);
	});

	test('diffProjections emits localPendingSend patches', () => {
		const before = stubTurnsToSnapshot('s', [{ id: 'u1', kind: 'user', text: 'a' }]);
		const after: typeof before = {
			...before,
			snapshot: {
				...before.snapshot,
				localPendingSends: [{ operationId: 'op-1' as SessionViewSnapshot['localPendingSends'][number]['operationId'], summary: { kind: 'text', title: 'You', preview: 'pending' } }],
			},
		};
		const diff = diffProjections(before, after);
		assert.deepStrictEqual(diff.patches.map(p => p.op), ['upsertLocalSend']);
		assert.deepStrictEqual([...diff.changedIds], ['send:op-1']);
	});

	test('acquireSessionView lease mirrors roster mutations through session-core frames', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		const lease = store.add(service.acquireSessionView(sessionId));
		const applied: ConversationViewFrameApplied[] = [];
		store.add(lease.onDidApplyFrame(e => applied.push(e)));

		const legacyBefore = projectLegacy(service, lease);
		assert.deepStrictEqual(legacyBefore, service.getTurns(sessionId));

		const turn = service.appendUserTurn(sessionId, 'hello');
		assert.ok(turn);
		assert.strictEqual(applied.length, 1);
		assert.strictEqual(applied[0].kind, 'patches');
		assert.deepStrictEqual([...(applied[0] as { changedIds: ReadonlySet<string> }).changedIds], [turn.id]);
		assert.deepStrictEqual(
			projectLegacy(service, lease),
			service.getTurns(sessionId),
		);

		// Message-queue-only mutations do not touch the view snapshot → no frame.
		service.pauseMessageQueue(sessionId);
		assert.strictEqual(applied.length, 1);
	});

	test('lease.post(submitInput) writes through the same stub path as the Dock', async () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		const lease = store.add(service.acquireSessionView(sessionId));
		const before = service.getTurns(sessionId).length;

		const outcome = await lease.post({ kind: 'submitInput', text: 'ping' });
		assert.strictEqual(outcome.accepted, true);
		assert.ok(lease.snapshot.localPendingSends.length === 1);
		const pendingEntries = projectSnapshotToEntries(lease.snapshot, lease.attribution, lease.details);
		assert.ok(pendingEntries.some(entry => entry.pending && entry.text === 'ping'));

		await new Promise<void>(resolve => setTimeout(resolve, 0));

		const turns = service.getTurns(sessionId);
		assert.strictEqual(turns.length, before + 2);
		assert.deepStrictEqual(turns.slice(-2).map(t => [t.kind, t.stubEcho ?? false]), [['user', false], ['assistant', true]]);
		assert.deepStrictEqual(lease.snapshot.sync, { kind: 'idle' });
		assert.strictEqual(lease.snapshot.localPendingSends.length, 0);
	});

	test('lease.post(permissionRespond) resolves the pending seat', async () => {
		const service = store.add(new ConversationStubService());
		const lease = store.add(service.acquireSessionView('untitled'));
		assert.strictEqual(lease.snapshot.pendingActions.length, 1);
		const requestId = String(lease.snapshot.pendingActions[0].requestId);

		await lease.post({ kind: 'permissionRespond', requestId, decision: 'deny' });
		assert.strictEqual(lease.snapshot.pendingActions.length, 0);
		assert.strictEqual(service.getTurns('untitled').find(t => t.id === requestId)?.status, 'skipped');
	});

	test('post to an unknown session is rejected, not silently accepted', async () => {
		const service = store.add(new ConversationStubService());
		const lease = store.add(service.acquireSessionView('nope'));
		assert.deepStrictEqual(await lease.post({ kind: 'submitInput', text: 'x' }), { accepted: false, reason: 'no_such_session' });
	});

	test('stub lease requestDetail upserts local body then settles full', async () => {
		const service = store.add(new ConversationStubService());
		const lease = store.add(service.acquireSessionView('visualize'));
		assert.ok(typeof lease.requestDetail === 'function');
		const refs = [...lease.details.keys()];
		assert.ok(refs.length > 0);
		const ref = refs[0]!;
		const before = lease.details.get(ref);
		assert.ok(before);
		const outcome = await lease.requestDetail!(ref);
		assert.deepStrictEqual(outcome, { ok: true, truncated: false, content: before });
		assert.strictEqual(lease.details.get(ref), before);

		const missing = await lease.requestDetail!('detail:missing');
		assert.deepStrictEqual(missing, { ok: false, reason: 'unavailable' });
	});

	test('requestResync re-baselines the replica', () => {
		const service = store.add(new ConversationStubService());
		const sessionId = service.getActiveSessionId();
		const lease = store.add(service.acquireSessionView(sessionId));
		const applied: ConversationViewFrameApplied[] = [];
		store.add(lease.onDidApplyFrame(e => applied.push(e)));
		lease.requestResync();
		assert.deepStrictEqual(applied.map(e => e.kind), ['baseline']);
		assert.deepStrictEqual(
			projectLegacy(service, lease),
			service.getTurns(sessionId),
		);
	});

	test('D472 path-only catalog hit projects assistant text as conversation-chat', () => {
		const original = 'See [Tool A (Stub)](/session/untitled/chat/tool-a).';
		const toolA: IConversationSessionChatEntry = {
			sessionKey: 'untitled',
			chatId: 'tool-a',
			title: 'Tool A (Stub)',
			originKind: 'tool',
		};
		const { snapshot, attribution, details } = stubTurnsToSnapshot('untitled', [
			{ id: 'a1', kind: 'assistant', text: original },
		]);
		const catalog = (sessionKey: string) => sessionKey === 'untitled' ? [toolA] : [];
		const entries = projectSnapshotToEntries(snapshot, attribution, details, catalog);
		assert.strictEqual(entries[0]!.text, 'See [Tool A (Stub)](conversation-chat:/session/untitled/chat/tool-a).');
		assert.strictEqual(entriesToLegacyTurns(entries)[0]!.text, entries[0]!.text);
	});

	test('D472 catalog miss and omitted catalog leave original path-only bytes', () => {
		const original = 'See [missing](/session/untitled/chat/no-such-agent).';
		const { snapshot, attribution, details } = stubTurnsToSnapshot('untitled', [
			{ id: 'a1', kind: 'assistant', text: original },
		]);
		const miss = projectSnapshotToEntries(snapshot, attribution, details, () => []);
		assert.strictEqual(miss[0]!.text, original);
		const omitted = projectSnapshotToEntries(snapshot, attribution, details);
		assert.strictEqual(omitted[0]!.text, original);
	});

	test('D472 already conversation-chat assistant text is unchanged on catalog hit', () => {
		const original = 'See [ok](conversation-chat:/session/untitled/chat/tool-a).';
		const { snapshot, attribution, details } = stubTurnsToSnapshot('untitled', [
			{ id: 'a1', kind: 'assistant', text: original },
		]);
		const entries = projectSnapshotToEntries(snapshot, attribution, details, () => [{
			sessionKey: 'untitled',
			chatId: 'tool-a',
			title: 'Tool A (Stub)',
			originKind: 'tool',
		}]);
		assert.strictEqual(entries[0]!.text, original);
	});

	test('D472 user path-only text is not rewritten', () => {
		const original = 'See [Tool A (Stub)](/session/untitled/chat/tool-a).';
		const { snapshot, attribution, details } = stubTurnsToSnapshot('untitled', [
			{ id: 'u1', kind: 'user', text: original },
		]);
		const entries = projectSnapshotToEntries(snapshot, attribution, details, () => [{
			sessionKey: 'untitled',
			chatId: 'tool-a',
			title: 'Tool A (Stub)',
			originKind: 'tool',
		}]);
		assert.strictEqual(entries[0]!.kind, 'user');
		assert.strictEqual(entries[0]!.text, original);
	});
});
