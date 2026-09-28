/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	buildTimelineRootIdentities,
	computeTimelineReconcile,
	type TimelineReconcileRoot,
	type TimelineReconcileTurn,
} from '../../browser/conversationTimelineReconcile.js';

function item(id: string, turn: object): TimelineReconcileRoot {
	return { id, kind: 'item', turns: [{ id, turn }] };
}

function fold(id: string, turns: readonly TimelineReconcileTurn[]): TimelineReconcileRoot {
	return { id, kind: 'process-fold', turns };
}

suite('conversationTimelineReconcile', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('re-exports buildTimelineRootIdentities', () => {
		assert.deepStrictEqual(buildTimelineRootIdentities([]), []);
	});

	test('same roots and turn refs are mode none', () => {
		const turnA = { text: 'a' };
		const turnB = { text: 'b' };
		const roots = [item('a', turnA), item('b', turnB)];
		const plan = computeTimelineReconcile(roots, roots);
		assert.strictEqual(plan.mode, 'none');
		assert.deepStrictEqual(plan.changed, []);
		assert.deepStrictEqual(plan.removed, []);
		assert.deepStrictEqual(plan.order, ['a', 'b']);
	});

	test('replacing one turn ref is mode content', () => {
		const turnA = { text: 'a' };
		const turnB = { text: 'b' };
		const prev = [item('a', turnA), item('b', turnB)];
		const next = [item('a', turnA), item('b', { text: 'b2' })];
		const plan = computeTimelineReconcile(prev, next);
		assert.strictEqual(plan.mode, 'content');
		assert.deepStrictEqual(plan.changed, ['b']);
		assert.deepStrictEqual(plan.removed, []);
		assert.deepStrictEqual(plan.order, ['a', 'b']);
	});

	test('process-fold identity follows turn ids and turn refs', () => {
		const innerA = { n: 1 };
		const innerB = { n: 2 };
		const prev = [fold('fold:1', [
			{ id: 't1', turn: innerA },
			{ id: 't2', turn: innerB },
		])];
		const same = computeTimelineReconcile(prev, [fold('fold:1', [
			{ id: 't1', turn: innerA },
			{ id: 't2', turn: innerB },
		])]);
		assert.strictEqual(same.mode, 'none');
		assert.deepStrictEqual(same.changed, []);

		const replaced = computeTimelineReconcile(prev, [fold('fold:1', [
			{ id: 't1', turn: innerA },
			{ id: 't2', turn: { n: 3 } },
		])]);
		assert.strictEqual(replaced.mode, 'content');
		assert.deepStrictEqual(replaced.changed, ['fold:1']);

		const reorderedTurns = computeTimelineReconcile(prev, [fold('fold:1', [
			{ id: 't2', turn: innerB },
			{ id: 't1', turn: innerA },
		])]);
		assert.strictEqual(reorderedTurns.mode, 'content');
		assert.deepStrictEqual(reorderedTurns.changed, ['fold:1']);
		assert.deepStrictEqual(reorderedTurns.order, ['fold:1']);
	});

	test('inserted and deleted roots are mode structure', () => {
		const turnA = { text: 'a' };
		const turnB = { text: 'b' };
		const turnC = { text: 'c' };
		const prev = [item('a', turnA), item('b', turnB)];
		const next = [item('a', turnA), item('c', turnC)];
		const plan = computeTimelineReconcile(prev, next);
		assert.strictEqual(plan.mode, 'structure');
		assert.deepStrictEqual(plan.changed, []);
		assert.deepStrictEqual(plan.removed, ['b']);
		assert.deepStrictEqual(plan.order, ['a', 'c']);
	});

	test('structure still lists identity changes among surviving ids', () => {
		const turnA = { text: 'a' };
		const turnB = { text: 'b' };
		const prev = [item('a', turnA), item('b', turnB)];
		const next = [item('b', { text: 'b2' }), item('c', { text: 'c' })];
		const plan = computeTimelineReconcile(prev, next);
		assert.strictEqual(plan.mode, 'structure');
		assert.deepStrictEqual(plan.changed, ['b']);
		assert.deepStrictEqual(plan.removed, ['a']);
		assert.deepStrictEqual(plan.order, ['b', 'c']);
	});

	test('same-content baseline with identical turn refs is mode none', () => {
		const turnA = { text: 'a' };
		const turnB = { text: 'b' };
		const prev = [item('a', turnA), item('b', turnB)];
		const next = [item('a', turnA), item('b', turnB)];
		const plan = computeTimelineReconcile(prev, next);
		assert.strictEqual(plan.mode, 'none');
		assert.deepStrictEqual(plan.changed, []);
		assert.deepStrictEqual(plan.removed, []);
		assert.deepStrictEqual(plan.order, ['a', 'b']);
	});
});
