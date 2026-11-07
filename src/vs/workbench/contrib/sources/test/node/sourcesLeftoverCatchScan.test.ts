/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { timeout } from '../../../../../base/common/async.js';
import { errorHandler, setUnexpectedErrorHandler } from '../../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { runWithFakedTimers } from '../../../../../base/test/common/virtualScheduling/index.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { SourcesChangesModel } from '../../common/sourcesChangesReadModel.js';

suite('Sources leftover fire-and-forget catch (D677)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createModel() {
		const boom = new Error('pairing probe boom');
		const sessionChanges = store.add(new Emitter<string>());
		const state = { sessionId: 'session-a', failing: false };
		const session: IAgentSessionContext = {
			_serviceBrand: undefined,
			getActiveSessionId: () => state.sessionId,
			isEngineSessionReady: () => false,
			getEngineSessionReadiness: () => 'ready',
			isPairingHold: () => {
				if (state.failing) {
					throw boom;
				}
				return false;
			},
			onDidChangeActiveSession: sessionChanges.event,
			onDidChangeSession: Event.None,
			acquireSessionView: () => { throw new Error('not used'); },
		};
		const connection = {
			onDidChangeConnection: Event.None,
			getConnectionPhase: () => ({ kind: 'connected' }),
			getConnectionSnapshot: () => ({ pairingPending: false }),
			isEngineConnected: () => false,
		} as unknown as IUniverseAgentConnection;
		const scmService = {
			onDidAddRepository: Event.None,
			onDidRemoveRepository: Event.None,
			repositories: [],
		} as unknown as ISCMService;
		const workspaceContext = {
			getWorkspace: () => ({ folders: [] }),
		} as unknown as IWorkspaceContextService;
		const model = store.add(new SourcesChangesModel(connection, scmService, workspaceContext, session));
		return { model, state, boom, sessionChanges };
	}

	async function captureUnexpected(run: () => void | Promise<void>): Promise<{ unexpected: unknown[]; unhandledRejections: unknown[] }> {
		const unexpected: unknown[] = [];
		const unhandledRejections: unknown[] = [];
		const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
		process.on('unhandledRejection', onUnhandledRejection);
		const originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
		setUnexpectedErrorHandler(error => unexpected.push(error));
		try {
			await run();
			await timeout(0);
			return { unexpected, unhandledRejections };
		} finally {
			setUnexpectedErrorHandler(originalErrorHandler);
			process.off('unhandledRejection', onUnhandledRejection);
		}
	}

	for (const [name, trigger] of [
		['scheduled refresh', (model: SourcesChangesModel) => model.flushScheduledRefresh()],
		['active session change', (model: SourcesChangesModel, switchSession: () => void) => { switchSession(); model.scheduleRefresh(); }],
		['flush after an active session change', (model: SourcesChangesModel, switchSession: () => void) => { switchSession(); model.flushScheduledRefresh(); }],
	] as const) {
		test(`a rejected ${name} reaches onUnexpectedError once and the next refresh still lands`, async () => {
			const { model, state, boom } = createModel();
			assert.strictEqual(model.getSnapshot().settled, false);
			state.failing = true;

			const result = await captureUnexpected(() => trigger(model, () => { state.sessionId = 'session-b'; }));

			assert.deepStrictEqual(result, { unexpected: [boom], unhandledRejections: [] });
			assert.strictEqual(model.getSnapshot().settled, false, 'the failed round lands nothing');
			state.failing = false;
			model.scheduleRefresh();
			model.flushScheduledRefresh();
			await timeout(0);
			assert.deepStrictEqual({ settled: model.getSnapshot().settled, state: model.getSnapshot().state }, { settled: true, state: { kind: 'scm' } });
		});
	}

	test('a rejected refresh fired by the scheduler timer reaches onUnexpectedError once and an active-session event still lands the next round', () => runWithFakedTimers({}, async () => {
		const { model, state, boom, sessionChanges } = createModel();
		state.failing = true;

		const result = await captureUnexpected(() => timeout(250));

		assert.deepStrictEqual({ ...result, settled: model.getSnapshot().settled }, { unexpected: [boom], unhandledRejections: [], settled: false });
		state.failing = false;
		sessionChanges.fire('session-a');
		await timeout(250);
		assert.deepStrictEqual({ settled: model.getSnapshot().settled, state: model.getSnapshot().state }, { settled: true, state: { kind: 'scm' } });
	}));
});
