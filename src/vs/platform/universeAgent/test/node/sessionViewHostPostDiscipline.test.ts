/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

suite('SessionViewHost post discipline (F2)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('core.post and takeIntents each appear once inside postAndDrain / drainIntents', () => {
		const connection = new TestConnection();
		const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
			orphanTimeoutMs: 0,
		}));
		const core = Reflect.get(viewHost, 'core') as { post: (...args: unknown[]) => unknown; takeIntents: (...args: unknown[]) => unknown };
		let postCalls = 0;
		let takeCalls = 0;
		const origPost = core.post.bind(core);
		const origTake = core.takeIntents.bind(core);
		core.post = (...args: unknown[]) => {
			postCalls++;
			return origPost(...args);
		};
		core.takeIntents = (...args: unknown[]) => {
			takeCalls++;
			return origTake(...args);
		};

		const leaseId = viewHost.acquireLease('sess-discipline');
		assert.ok(postCalls >= 1);
		assert.strictEqual(takeCalls, postCalls);
		viewHost.releaseLease(leaseId);
		assert.strictEqual(takeCalls, postCalls);
	});

	test('sessionViewHost fire-and-forget voids single-catch onUnexpectedError and eliminate double-catch', async () => {
		const seen: unknown[] = [];
		const origHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(err => seen.push(err));
		try {
			const connection = new TestConnection();
			const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
				orphanTimeoutMs: 0,
			}));
			Reflect.set(viewHost, 'bringUpBoundSession', () => Promise.reject(new Error('bringup-boom')));
			viewHost.acquireLease('sess-catch');
			viewHost.onEngineConnectionChanged();
			await new Promise(resolve => setTimeout(resolve, 10));
		} finally {
			setUnexpectedErrorHandler(origHandler);
		}
		assert.strictEqual(seen.length, 1);
		assert.ok(seen[0] instanceof Error && seen[0].message === 'bringup-boom');
	});
});
