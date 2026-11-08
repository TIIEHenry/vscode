/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import {
	ConversationTimelineResourceBudget,
	type ConversationTimelineResourceClaim,
	type ConversationTimelineVisibilityEntry,
	type ConversationTimelineVisibilityObserver,
} from './conversationTimelineResourceBudget.js';

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

suite('ConversationTimelineResourceBudget (browser colocated)', () => {

	const disposables = ensureNoDisposablesAreLeakedInTestSuite();
	let observer: FakeVisibilityObserver;

	function createBudget(maxDiffEditors = 6, maxWebviews = 4): ConversationTimelineResourceBudget {
		return disposables.add(new ConversationTimelineResourceBudget({
			root: null,
			maxDiffEditors,
			maxWebviews,
			createObserver: callback => {
				observer = new FakeVisibilityObserver(callback);
				return observer;
			},
		}));
	}

	test('release reconciles so a near claim can use a freed cap slot', () => {
		const budget = createBudget(1, 4);
		const d1 = claim('d1', 'diff');
		const d2 = claim('d2', 'diff');
		budget.claim(d1.claim);
		budget.claim(d2.claim);
		observer.fire(d1.claim.element, true);
		observer.fire(d2.claim.element, true);
		assert.deepStrictEqual(budget.getMountedIds(), ['d2']);

		budget.release('d2');
		assert.deepStrictEqual(budget.getMountedIds(), ['d1']);
		assert.strictEqual(d1.mounts, 1);
	});
});
