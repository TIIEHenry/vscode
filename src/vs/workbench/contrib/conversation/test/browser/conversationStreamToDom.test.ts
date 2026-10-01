/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { createStreamHarness } from './streamHarness.js';

/**
 * Imperative escape hatch for what a declarative script cannot say (exact ack cursors,
 * DOM node identity, apply metrics). Everything expressible as "host sends X → user sees Y"
 * belongs in `streamScripts.ts` instead.
 */
suite('Conversation stream → DOM (imperative)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('every applied frame is acknowledged with its cursor', async () => {
		const h = createStreamHarness(store);
		const user = h.view.userItem('u1', 'hi', '0000000001');
		h.view.baseline();
		h.view.patches([user.patch], { attribution: [user.attribution] });
		await h.settle();

		assert.deepStrictEqual(
			h.view.acknowledgeCalls.map(({ generation, frameId, appliedVersion }) => ({ generation, frameId, appliedVersion })),
			[{ generation: 1, frameId: 1, appliedVersion: 1 }, { generation: 1, frameId: 2, appliedVersion: 2 }]);
	});

	test('re-delivered frame keeps the same DOM node and does no rerender work', async () => {
		const h = createStreamHarness(store);
		const user = h.view.userItem('u1', 'hi', '0000000001');
		h.view.baseline();
		h.view.patches([user.patch], { attribution: [user.attribution] });
		await h.settle();
		const article = h.host.getTimelineRowElement('u1');
		assert.ok(article);
		h.host.resetTestApplyMetrics();

		h.view.duplicateLast();
		await h.settle();

		assert.deepStrictEqual(h.host.getTestApplyMetrics(), { setChildrenCount: 0, rerenderCount: 0 });
		assert.strictEqual(h.host.getTimelineRowElement('u1'), article);
	});
});
