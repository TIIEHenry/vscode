/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { DeferredPromise } from '../../../../../base/common/async.js';
import { isCancellationError } from '../../../../../base/common/errors.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { DebugService } from '../../browser/debugService.js';
import { IDebugger, IDebugSession } from '../../common/debug.js';
import { createTestSession } from './callStack.test.js';
import { createMockDebugModel } from './mockDebugModel.js';

suite('DebugSession - overlapping initialize', () => {
	const disposables = ensureNoDisposablesAreLeakedInTestSuite();

	function createDebugger() {
		const adapters: DeferredPromise<{ dispose(): void }>[] = [];
		const dbgr = upcastPartial<IDebugger>({
			createDebugAdapter: () => {
				const adapter = new DeferredPromise<{ dispose(): void }>();
				adapters.push(adapter);
				return adapter.p as unknown as ReturnType<IDebugger['createDebugAdapter']>;
			}
		});
		return { dbgr, adapters };
	}

	test('a superseded initialize rejects with a cancellation instead of resolving', async () => {
		const model = createMockDebugModel(disposables);
		const session = disposables.add(createTestSession(model));
		const { dbgr, adapters } = createDebugger();
		let disposedAdapters = 0;

		const first = session.initialize(dbgr).then(() => 'resolved', err => err);
		void session.initialize(dbgr);
		adapters[0].complete({ dispose: () => disposedAdapters++ });
		const outcome = await first;

		assert.deepStrictEqual({
			cancelled: isCancellationError(outcome),
			disposedAdapters,
			raw: session.raw,
		}, {
			cancelled: true,
			disposedAdapters: 1,
			raw: undefined,
		});
	});

	test('launchOrAttachToSession does not launch when its initialize was superseded', async () => {
		const model = createMockDebugModel(disposables);
		const session = disposables.add(createTestSession(model));
		const { dbgr, adapters } = createDebugger();
		let launches = 0;
		session.launchOrAttach = async () => { launches++; };

		const service = Object.create(DebugService.prototype) as Record<string, unknown>;
		service.registerSessionListeners = () => { };
		service.adapterManager = { getDebugger: () => dbgr };
		service.viewModel = { focusedSession: undefined };
		const launchOrAttachToSession = (service.launchOrAttachToSession as (session: IDebugSession) => Promise<void>).bind(service);

		const first = launchOrAttachToSession(session).then(() => 'resolved', err => err);
		void session.initialize(dbgr);
		adapters[0].complete({ dispose: () => { } });
		const outcome = await first;

		assert.deepStrictEqual({ cancelled: isCancellationError(outcome), launches }, { cancelled: true, launches: 0 });
	});
});
