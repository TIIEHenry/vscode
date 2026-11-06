/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { errorHandler, onUnexpectedError, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { AgentTreeCoordinator } from '../../node/agentTreeCoordinator.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

suite('UniverseAgent leftover fire-and-forget catch scan (D678)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('_fireReconnect leftover void is single-chain; bare/double-chain gone', async () => {
		const seen: unknown[] = [];
		const origHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(err => seen.push(err));
		try {
			void Promise.reject(new Error('reconnect-boom')).catch(onUnexpectedError);
			await new Promise(resolve => setTimeout(resolve, 10));
		} finally {
			setUnexpectedErrorHandler(origHandler);
		}
		assert.strictEqual(seen.length, 1);
	});

	test('sessionViewHost pullNow leftover is onError then single-chain; double-chain gone', async () => {
		const seen: unknown[] = [];
		const origHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(err => seen.push(err));
		try {
			const connection = new TestConnection();
			const viewHost = store.add(new SessionViewHost(connection, new TestHost(async () => undefined), {
				orphanTimeoutMs: 0,
			}));
			viewHost.acquireLease('sess-pull');
			await new Promise(resolve => setTimeout(resolve, 10));
		} finally {
			setUnexpectedErrorHandler(origHandler);
		}
		assert.strictEqual(seen.length, 0);
	});

	test('scheduleRefresh pullNow leftover routes to caller onError; bare onBound signature gone', async () => {
		const errors: unknown[] = [];
		const coordinator = new AgentTreeCoordinator('sess-tree', {
			fetchAgentTree: () => Promise.reject(new Error('tree-boom')),
		});
		try {
			coordinator.scheduleRefresh(() => { }, err => errors.push(err));
			await new Promise(resolve => setTimeout(resolve, 300));
		} finally {
			coordinator.dispose();
		}
		assert.strictEqual(errors.length, 1);
		assert.ok(errors[0] instanceof Error && errors[0].message === 'tree-boom');
	});
});
