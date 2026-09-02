/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import type { DetailFetchOutcome } from '../../../../../platform/universeAgent/common/conversationViewFrame.js';
import {
	formatConversationTrajectoryDetailPartial,
	TrajectoryDetailInspectorModel,
	type ITrajectoryDetailContext,
} from '../../browser/conversationTrajectoryDetailInspector.js';
import type { ConversationTrajectoryRecord } from '../../browser/conversationTrajectoryModel.js';

suite('TrajectoryDetailInspectorModel (Q2)', () => {

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
		readonly hasRequestDetail?: boolean;
		readonly bodies?: ReadonlyMap<string, string>;
		readonly requestDetail?: (ref: string) => Promise<DetailFetchOutcome>;
	}): ITrajectoryDetailContext {
		const bodies = options.bodies ?? new Map<string, string>();
		const requestDetail = options.hasRequestDetail === false
			? undefined
			: options.requestDetail ?? (async () => ({ ok: true as const, truncated: false, content: 'full' }));
		return {
			supportsDetailFetch: () => typeof requestDetail === 'function',
			getDetailBody: ref => bodies.get(ref),
			requestDetail,
		};
	}

	test('lease without requestDetail never enters loading', () => {
		const model = createModel();
		const view = model.resolve(record('ref-1'), context({ hasRequestDetail: false }));
		assert.strictEqual(view.state, 'unavailable');
	});

	test('prefilled details body without truncated is full', () => {
		const model = createModel();
		const view = model.resolve(record('ref-1'), context({
			hasRequestDetail: false,
			bodies: new Map([['ref-1', 'complete body']]),
		}));
		assert.strictEqual(view.state, 'full');
		assert.strictEqual(view.fullText, 'complete body');
	});

	test('in-flight requestDetail is loading until settle', async () => {
		const model = createModel();
		let settle!: (outcome: DetailFetchOutcome) => void;
		const pending = new Promise<DetailFetchOutcome>(resolve => { settle = resolve; });
		const ctx = context({ requestDetail: () => pending });
		assert.strictEqual(model.resolve(record('ref-1'), ctx).state, 'loading');
		assert.strictEqual(model.resolve(record('ref-1'), ctx).state, 'loading');

		const changed = eventOnce(model);
		settle({ ok: true, truncated: false, content: 'full body' });
		await changed;
		const done = model.resolve(record('ref-1'), context({
			bodies: new Map([['ref-1', 'full body']]),
			requestDetail: async () => ({ ok: true, truncated: false, content: 'full body' }),
		}));
		assert.strictEqual(done.state, 'full');
		assert.strictEqual(done.fullText, 'full body');
	});

	test('truncated outcome is partial with byte counts', async () => {
		const model = createModel();
		const content = 'abc';
		const ctx = context({
			requestDetail: async () => ({ ok: true, truncated: true, content, totalBytes: 10 }),
		});
		assert.strictEqual(model.resolve(record('ref-1'), ctx).state, 'loading');
		await eventOnce(model);
		const view = model.resolve(record('ref-1'), context({
			bodies: new Map([['ref-1', content]]),
			requestDetail: async () => ({ ok: true, truncated: true, content, totalBytes: 10 }),
		}));
		assert.strictEqual(view.state, 'partial');
		assert.strictEqual(view.fullText, undefined);
		assert.strictEqual(view.boundedText, content);
		assert.strictEqual(view.statusMessage, formatConversationTrajectoryDetailPartial(3, 10));
	});

	test('ok:false unavailable and failed plus retry', async () => {
		const model = createModel();
		const unavailableCtx = context({
			requestDetail: async () => ({ ok: false as const, reason: 'unavailable' as const }),
		});
		assert.strictEqual(model.resolve(record('ref-1'), unavailableCtx).state, 'loading');
		await eventOnce(model);
		const unavailable = model.resolve(record('ref-1'), unavailableCtx);
		assert.strictEqual(unavailable.state, 'unavailable');
		assert.strictEqual(unavailable.canRetry, false);

		model.clearSession();
		const failedCtx = context({
			requestDetail: async () => ({ ok: false as const, reason: 'failed' as const }),
		});
		assert.strictEqual(model.resolve(record('ref-2'), failedCtx).state, 'loading');
		await eventOnce(model);
		const failed = model.resolve(record('ref-2'), failedCtx);
		assert.strictEqual(failed.state, 'failed');
		assert.strictEqual(failed.canRetry, true);

		model.retry('ref-2');
		assert.strictEqual(model.resolve(record('ref-2'), failedCtx).state, 'loading');
	});

	test('no DetailRef is unavailable', () => {
		const model = createModel();
		const view = model.resolve(record(undefined), context({ hasRequestDetail: true }));
		assert.strictEqual(view.state, 'unavailable');
	});
});

function eventOnce(model: TrajectoryDetailInspectorModel): Promise<void> {
	return new Promise<void>(resolve => {
		const listener = model.onDidChange(() => {
			listener.dispose();
			resolve();
		});
	});
}
