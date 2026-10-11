/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../base/common/async.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { DetailFetchOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { TrajectoryDetailInspectorModel, type ITrajectoryDetailContext } from './conversationTrajectoryDetailInspector.js';
import type { ConversationTrajectoryRecord } from './conversationTrajectoryModel.js';

suite('TrajectoryDetailInspectorModel (browser co-located)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createModel(): TrajectoryDetailInspectorModel {
		const model = new TrajectoryDetailInspectorModel();
		store.add(toDisposable(() => model.dispose()));
		return model;
	}

	function record(detailRef?: string): ConversationTrajectoryRecord {
		return { id: 'r1', kind: 'tool', text: 'bounded preview', detailRef };
	}

	function context(options: {
		readonly requestDetail?: (ref: string) => Promise<DetailFetchOutcome>;
	}): ITrajectoryDetailContext {
		const requestDetail = options.requestDetail ?? (async () => ({ ok: true as const, truncated: false, content: 'full' }));
		return {
			supportsDetailFetch: () => true,
			getDetailBody: () => undefined,
			requestDetail,
		};
	}

	test('retry ignores a stale in-flight fetch so the retried body wins', async () => {
		const model = createModel();
		let settleFirst!: (outcome: DetailFetchOutcome) => void;
		const first = new Promise<DetailFetchOutcome>(resolve => { settleFirst = resolve; });
		let fetchCalls = 0;
		const ctx = context({
			requestDetail: () => {
				fetchCalls++;
				return fetchCalls === 1 ? first : Promise.resolve({ ok: true, truncated: false, content: 'after-retry' });
			},
		});

		assert.strictEqual(model.resolve(record('ref-1'), ctx).state, 'loading');
		model.retry('ref-1');
		assert.strictEqual(model.resolve(record('ref-1'), ctx).state, 'loading');
		assert.strictEqual(fetchCalls, 2);

		settleFirst({ ok: true, truncated: false, content: 'stale-before-retry' });
		await timeout(0);

		const view = model.resolve(record('ref-1'), ctx);
		assert.strictEqual(view.state, 'full');
		assert.strictEqual(view.fullText, 'after-retry');
	});

	test('preview shows admitted canvas titles and usage numbers and omits absent fields', () => {
		const model = createModel();
		const tool = model.resolve({
			id: 't1',
			kind: 'tool',
			text: 'Read',
			outputDetail: 'out',
			canvasRefs: [{ canvasId: 'c1', revisionId: 'r1', title: 'Board', sourceHash: 'h1' }],
		}, undefined);
		assert.strictEqual(tool.previewText, 'Read\nout\nBoard');
		assert.ok(!tool.previewText.includes('c1'));
		assert.ok(!tool.previewText.includes('r1'));
		assert.ok(!tool.previewText.includes('h1'));

		const usage = model.resolve({
			id: 'u1',
			kind: 'context',
			text: 'Usage',
			messageSource: { kind: 'usage' },
			inputTokens: 12,
			outputTokens: 0,
		}, undefined);
		assert.strictEqual(usage.previewText, 'Usage\nInput tokens: 12\nOutput tokens: 0');
		assert.ok(!usage.previewText.includes('Context'));

		const bare = model.resolve({
			id: 'u2',
			kind: 'context',
			text: 'Usage',
			messageSource: { kind: 'usage' },
		}, undefined);
		assert.strictEqual(bare.previewText, 'Usage');
	});
});
