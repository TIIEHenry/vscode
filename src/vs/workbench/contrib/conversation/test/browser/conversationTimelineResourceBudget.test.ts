/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import {
	CONVERSATION_TIMELINE_RESOURCE_ROOT_MARGIN,
	ConversationTimelineResourceBudget,
	type ConversationTimelineResourceClaim,
	type ConversationTimelineVisibilityEntry,
	type ConversationTimelineVisibilityObserver,
} from '../../browser/conversationTimelineResourceBudget.js';

class FakeVisibilityObserver implements ConversationTimelineVisibilityObserver {
	readonly observed = new Set<Element>();
	constructor(private readonly callback: (entries: readonly ConversationTimelineVisibilityEntry[]) => void) { }
	observe(target: Element): void { this.observed.add(target); }
	unobserve(target: Element): void { this.observed.delete(target); }
	disconnect(): void { this.observed.clear(); }
	fire(target: Element, isIntersecting: boolean): void {
		this.callback([{ target, isIntersecting }]);
	}
}

function claim(id: string, kind: 'diff' | 'webview'): { claim: ConversationTimelineResourceClaim; mounts: number; unmounts: number } {
	const element = document.createElement('div');
	const state = { mounts: 0, unmounts: 0, claim: undefined as unknown as ConversationTimelineResourceClaim };
	state.claim = {
		id,
		kind,
		element,
		mount: () => { state.mounts++; },
		unmount: () => { state.unmounts++; return 40; },
	};
	return state;
}

suite('ConversationTimelineResourceBudget', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	let observer: FakeVisibilityObserver;

	function createBudget(maxDiffEditors = 6, maxWebviews = 4): ConversationTimelineResourceBudget {
		const budget = disposables.add(new ConversationTimelineResourceBudget({
			root: null,
			maxDiffEditors,
			maxWebviews,
			createObserver: (callback, options) => {
				assert.strictEqual(options.rootMargin, CONVERSATION_TIMELINE_RESOURCE_ROOT_MARGIN);
				observer = new FakeVisibilityObserver(callback);
				return observer;
			},
		}));
		return budget;
	}

	test('mounts only while near the viewport and unmounts when far', () => {
		const budget = createBudget();
		const diff = claim('d1', 'diff');
		budget.claim(diff.claim);
		assert.deepStrictEqual(budget.getMountedIds(), []);
		assert.strictEqual(diff.mounts, 0);

		observer.fire(diff.claim.element, true);
		assert.deepStrictEqual(budget.getMountedIds(), ['d1']);
		assert.strictEqual(diff.mounts, 1);

		observer.fire(diff.claim.element, false);
		assert.deepStrictEqual(budget.getMountedIds(), []);
		assert.strictEqual(diff.unmounts, 1);
	});

	test('evicts the least-recently-near diff when the cap is exceeded', () => {
		const budget = createBudget(2, 4);
		const first = claim('d1', 'diff');
		const second = claim('d2', 'diff');
		const third = claim('d3', 'diff');
		budget.claim(first.claim);
		budget.claim(second.claim);
		budget.claim(third.claim);
		observer.fire(first.claim.element, true);
		observer.fire(second.claim.element, true);
		observer.fire(third.claim.element, true);
		assert.deepStrictEqual([...budget.getMountedIds()].sort(), ['d2', 'd3']);
		assert.strictEqual(first.unmounts, 1);
		assert.strictEqual(third.mounts, 1);
	});

	test('webview cap is independent of the diff cap', () => {
		const budget = createBudget(1, 1);
		const diff = claim('d1', 'diff');
		const web = claim('w1', 'webview');
		budget.claim(diff.claim);
		budget.claim(web.claim);
		observer.fire(diff.claim.element, true);
		observer.fire(web.claim.element, true);
		assert.deepStrictEqual([...budget.getMountedIds()].sort(), ['d1', 'w1']);
	});

	test('release unmounts and stops observing', () => {
		const budget = createBudget();
		const diff = claim('d1', 'diff');
		budget.claim(diff.claim);
		observer.fire(diff.claim.element, true);
		budget.release('d1');
		assert.strictEqual(diff.unmounts, 1);
		assert.strictEqual(observer.observed.has(diff.claim.element), false);
		assert.deepStrictEqual(budget.getMountedIds(), []);
	});
});
