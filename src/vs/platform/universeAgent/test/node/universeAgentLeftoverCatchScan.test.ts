/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../base/common/errors.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { AgentTreeCoordinator } from '../../node/agentTreeCoordinator.js';
import { SessionViewHost } from '../../node/sessionViewHost.js';
import { TestConnection, TestHost } from './sessionViewHostTestHelpers.js';

suite('UniverseAgent leftover fire-and-forget catch scan (D678)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('sessionViewHost pullNow leftover is onError then single-chain; double-chain gone', async () => {
		const seen: unknown[] = [];
		const warns: string[] = [];
		let throwInWarn = false;
		const origHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(err => seen.push(err));
		try {
			const connection = new TestConnection();
			const host = new TestHost(() => Promise.reject(new Error('pull-now-boom')));
			const viewHost = store.add(new SessionViewHost(connection, host, {
				orphanTimeoutMs: 0,
				diagnostics: {
					count(): void { },
					warn(message: string): void {
						warns.push(message);
						if (throwInWarn) {
							throw new Error('on-error-boom');
						}
					},
				},
			}));
			viewHost.acquireLease('sess-pull');
			viewHost.onEngineConnectionChanged();
			await viewHost.whenEngineSessionReady('sess-pull');
			await new Promise(resolve => setTimeout(resolve, 10));
			assert.deepStrictEqual(warns, ['agentTree fetch failed']);
			assert.strictEqual(seen.length, 0);

			throwInWarn = true;
			(viewHost as unknown as { scheduleAgentTreeRefresh(id: string, immediate: boolean): void }).scheduleAgentTreeRefresh('sess-pull', true);
			await new Promise(resolve => setTimeout(resolve, 10));
		} finally {
			setUnexpectedErrorHandler(origHandler);
		}
		assert.strictEqual(seen.length, 1);
		assert.ok(seen[0] instanceof Error && seen[0].message === 'on-error-boom');
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
