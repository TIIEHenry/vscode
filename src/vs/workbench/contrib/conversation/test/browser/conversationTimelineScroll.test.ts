/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	computeTimelineApplyPlan,
	buildTimelineRootIdentities,
} from '../../browser/conversationTimelineApply.js';
import { mergeSessionViewFrames } from '../../browser/conversationSessionViewFrameCoalescer.js';
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

	test('effects frame → none (tree unchanged)', () => {
		const turns = [user('u1', 'x')];
		const plan = computeTimelineApplyPlan(turns, turns, { kind: 'effects', effects: [] });
		assert.strictEqual(plan.mode, 'none');
	});

	test('mergeSessionViewFrames unions patch changedIds within one coalesce window', () => {
		const merged = mergeSessionViewFrames([
			{ kind: 'patches', changedIds: new Set(['a1']) },
			{ kind: 'patches', changedIds: new Set(['a2']) },
		]);
		assert.strictEqual(merged.kind, 'patches');
		assert.deepStrictEqual([...(merged as { changedIds: ReadonlySet<string> }).changedIds].sort(), ['a1', 'a2']);
	});

	test('lease projection round-trip keeps applyEntries baseline aligned with roster', () => {
		const turns = [user('u1', 'a'), thinking('t1', 'think'), assistant('a1', 'done')];
		const projection = stubTurnsToSnapshot('s', turns);
		const entries = projectSnapshotToEntries(projection.snapshot, projection.attribution, projection.details);
		assert.deepStrictEqual(entriesToRenderableTurns(entries).map(t => t.id), turns.map(t => t.id));
	});
});
