/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	computeTimelineApplyPlan,
	buildTimelineRootIdentities,
} from '../../browser/conversationTimelineApply.js';
import {
	ConversationSessionViewFrameCoalescer,
	mergeSessionViewFrames,
	normalizeSessionViewChangedIds,
	normalizeSessionViewFrameApplied,
} from '../../browser/conversationSessionViewFrameCoalescer.js';
import type { ConversationViewFrameApplied } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { ViewEffect } from '../../../../../platform/universeAgent/common/sessionView/index.js';
import {
	entriesToRenderableTurns,
	projectSnapshotToEntries,
	stubTurnsToSnapshot,
} from '../../browser/conversationSessionView.js';
import { ConversationStubTurn } from '../../browser/conversationStubModel.js';
import {
	computeConversationScrollDownState,
	ConversationAutoScrollHolds,
	isConversationTimelineScrolledToBottom,
} from '../../browser/conversationTimelineScroll.js';

suite('ConversationTimelineScroll', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('isScrolledToBottom uses 2px tolerance', () => {
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 200, 302), true);
		assert.strictEqual(isConversationTimelineScrolledToBottom(100, 200, 303), false);
	});

	// Mirrors chatListWidget.test.ts scroll-down / at-bottom decoupling without importing chatListWidget.
	test('scroll-down button is decoupled from the at-bottom padding state', () => {
		assert.deepStrictEqual([
			computeConversationScrollDownState(/*isScrolledToBottom*/ true, /*scrollLock*/ true),
			computeConversationScrollDownState(/*isScrolledToBottom*/ true, /*scrollLock*/ false),
			computeConversationScrollDownState(/*isScrolledToBottom*/ false, /*scrollLock*/ true),
			computeConversationScrollDownState(/*isScrolledToBottom*/ false, /*scrollLock*/ false),
		], [
			{ showButton: false, atBottom: true },
			{ showButton: false, atBottom: true },
			{ showButton: true, atBottom: true },
			{ showButton: true, atBottom: false },
		]);
	});

	test('auto-scroll holds compose and release idempotently', () => {
		const holds = new ConversationAutoScrollHolds();
		assert.strictEqual(holds.isHeld, false);

		const first = holds.acquire();
		assert.strictEqual(holds.isHeld, true);

		const second = holds.acquire();
		assert.strictEqual(holds.isHeld, true);

		first.dispose();
		assert.strictEqual(holds.isHeld, true);

		second.dispose();
		assert.strictEqual(holds.isHeld, false);

		first.dispose();
		assert.strictEqual(holds.isHeld, false);
	});
});

suite('ConversationTimelineApply (S2 three-frame matrix)', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const user = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'user', text });
	const assistant = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'assistant', text, stubEcho: true });
	const thinking = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'thinking', text });
	const tool = (id: string, text: string): ConversationStubTurn => ({ id, kind: 'tool', text, toolName: 'read' });

	test('type A — same root ids, text patch → content mode only', () => {
		const prev = [user('u1', 'hello'), assistant('a1', 'one')];
		const next = [user('u1', 'hello'), assistant('a1', 'two')];
		const plan = computeTimelineApplyPlan(prev, next, { kind: 'patches', changedIds: new Set(['a1']) });
		assert.strictEqual(plan.mode, 'content');
		assert.deepStrictEqual([...plan.rerenderIds], ['a1']);
		assert.strictEqual(buildTimelineRootIdentities(prev).join(','), buildTimelineRootIdentities(next).join(','));
	});

	test('type B — append row → structure mode', () => {
		const prev = [user('u1', 'hello')];
		const next = [user('u1', 'hello'), assistant('a1', 'reply')];
		const plan = computeTimelineApplyPlan(prev, next, { kind: 'patches', changedIds: new Set(['a1']) });
		assert.strictEqual(plan.mode, 'structure');
	});

	test('type C — extend process fold keeps span id → content rerender fold root', () => {
		const prev = [user('u1', 'hi'), thinking('t1', 'think'), tool('tool1', 'grep')];
		const next = [user('u1', 'hi'), thinking('t1', 'think'), tool('tool1', 'grep'), tool('tool2', 'read')];
		const prevRoots = buildTimelineRootIdentities(prev);
		const nextRoots = buildTimelineRootIdentities(next);
		assert.strictEqual(prevRoots.length, 2);
		assert.deepStrictEqual(prevRoots, nextRoots);
		assert.strictEqual(prevRoots[1], 'fold:t1');
		const plan = computeTimelineApplyPlan(prev, next, { kind: 'patches', changedIds: new Set(['tool2']) });
		assert.strictEqual(plan.mode, 'content');
		assert.deepStrictEqual([...plan.rerenderIds], ['fold:t1']);
	});

	test('type C — user turn splits process fold → structure mode with new span id', () => {
		const prev = [thinking('t1', 'a'), tool('tool1', 'x')];
		const next = [thinking('t1', 'a'), tool('tool1', 'x'), user('u1', 'stop'), thinking('t2', 'b')];
		const plan = computeTimelineApplyPlan(prev, next, { kind: 'patches', changedIds: new Set(['u1', 't2', 'tool1']) });
		assert.strictEqual(plan.mode, 'structure');
		assert.notDeepStrictEqual(buildTimelineRootIdentities(prev), buildTimelineRootIdentities(next));
	});

	test('pending: prefix maps to the permission row and to the question child rows of one ask', () => {
		const seat = (id: string, status: 'pending' | 'allowed'): ConversationStubTurn => ({ id, kind: 'confirmation', text: 'run tests', status });
		const questionChild = (id: string): ConversationStubTurn => ({ id, kind: 'question', text: 'pick one', status: 'pending' });
		const prev = [user('u1', 'go'), seat('req-1', 'pending'), questionChild('ask-1:q_0'), questionChild('ask-1:q_1')];
		const next = [user('u1', 'go'), seat('req-1', 'allowed'), questionChild('ask-1:q_0'), questionChild('ask-1:q_1')];

		const plan = computeTimelineApplyPlan(prev, next, {
			kind: 'patches',
			changedIds: new Set(['pending:req-1', 'pending:ask-1']),
		});

		assert.strictEqual(plan.mode, 'content');
		assert.deepStrictEqual([...plan.rerenderIds].sort(), ['ask-1:q_0', 'ask-1:q_1', 'req-1']);
	});

	test('session-level chrome ids never mint a tree rerender id', () => {
		const turns = [user('u1', 'go')];
		const plan = computeTimelineApplyPlan(turns, turns, {
			kind: 'patches',
			changedIds: new Set(['sync', 'chrome:setLiveAgentTree', 'u1']),
		});
		assert.deepStrictEqual([...plan.rerenderIds], ['u1']);
	});

	test('effects frame → none (tree unchanged)', () => {
		const turns = [user('u1', 'x')];
		const plan = computeTimelineApplyPlan(turns, turns, { kind: 'effects', effects: [] });
		assert.strictEqual(plan.mode, 'none');
	});

	test('same-structure baseline → class A content (engine/mermaid/setTurns)', () => {
		const prev = [user('u1', 'hello'), assistant('a1', 'one')];
		const next = [user('u1', 'hello'), assistant('a1', 'two')];
		const plan = computeTimelineApplyPlan(prev, next, { kind: 'baseline' });
		assert.strictEqual(plan.mode, 'content');
		assert.deepStrictEqual([...plan.rerenderIds], ['u1', 'a1']);
	});

	test('structure-changing baseline stays a whole-tree rebuild', () => {
		const prev = [user('u1', 'hello')];
		const next = [user('u1', 'hello'), assistant('a1', 'reply')];
		const plan = computeTimelineApplyPlan(prev, next, { kind: 'baseline' });
		assert.strictEqual(plan.mode, 'baseline');
		assert.deepStrictEqual([...plan.rerenderIds], []);
	});

	const sendFailed = (id: string): ViewEffect => ({ effectId: id as ViewEffect['effectId'], kind: 'sendFailed', message: 'send failed' });

	test('mergeSessionViewFrames flushes patches and effects instead of dropping the effects', () => {
		const effect = sendFailed('e1');
		const merged = mergeSessionViewFrames([
			{ kind: 'patches', changedIds: new Set(['a1']) },
			{ kind: 'effects', effects: [effect] },
		]);
		assert.deepStrictEqual(merged, [
			{ kind: 'patches', changedIds: new Set(['a1']) },
			{ kind: 'effects', effects: [effect] },
		]);
	});

	test('coalescer delivers both applies of a mixed window to the timeline', async () => {
		const flushed: ConversationViewFrameApplied[] = [];
		const coalescer = new ConversationSessionViewFrameCoalescer(applied => flushed.push(applied));
		coalescer.push({ kind: 'patches', changedIds: new Set(['a1']) });
		coalescer.push({ kind: 'effects', effects: [sendFailed('e1')] });
		coalescer.push({ kind: 'patches', changedIds: new Set(['a2']) });
		await timeout(64);
		coalescer.dispose();

		assert.deepStrictEqual(flushed, [
			{ kind: 'patches', changedIds: new Set(['a1', 'a2']) },
			{ kind: 'effects', effects: [sendFailed('e1')] },
		]);
	});

	test('mergeSessionViewFrames unions patch changedIds within one coalesce window', () => {
		const merged = mergeSessionViewFrames([
			{ kind: 'patches', changedIds: new Set(['a1']) },
			{ kind: 'patches', changedIds: new Set(['a2']) },
		]);
		assert.deepStrictEqual(merged, [{ kind: 'patches', changedIds: new Set(['a1', 'a2']) }]);
	});

	test('normalizeSessionViewChangedIds accepts Set, array, plain object, and undefined', () => {
		assert.deepStrictEqual([...normalizeSessionViewChangedIds(new Set(['a1']))], ['a1']);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds(['a1', 'a2'])].sort(), ['a1', 'a2']);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds({ a1: true, a2: true })].sort(), ['a1', 'a2']);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds({ '0': 'a1', '1': 'a2' })].sort(), ['a1', 'a2']);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds(undefined)], []);
		assert.deepStrictEqual([...normalizeSessionViewChangedIds({})], []);
	});

	test('mergeSessionViewFrames tolerates IPC-deserialized changedIds shapes', () => {
		const merged = mergeSessionViewFrames([
			{ kind: 'patches', changedIds: ['a1'] as unknown as ReadonlySet<string> },
			{ kind: 'patches', changedIds: { a2: true } as unknown as ReadonlySet<string> },
		]);
		assert.deepStrictEqual(merged, [{ kind: 'patches', changedIds: new Set(['a1', 'a2']) }]);
	});

	test('normalizeSessionViewFrameApplied preserves baseline and effects', () => {
		assert.deepStrictEqual(normalizeSessionViewFrameApplied({ kind: 'baseline' }), { kind: 'baseline' });
		assert.deepStrictEqual(
			normalizeSessionViewFrameApplied({ kind: 'effects', effects: [] }),
			{ kind: 'effects', effects: [] },
		);
	});

	test('lease projection round-trip keeps applyEntries baseline aligned with roster', () => {
		const turns = [user('u1', 'a'), thinking('t1', 'think'), assistant('a1', 'done')];
		const projection = stubTurnsToSnapshot('s', turns);
		const entries = projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details);
		assert.deepStrictEqual(entriesToRenderableTurns(entries).map(t => t.id), turns.map(t => t.id));
	});
});
