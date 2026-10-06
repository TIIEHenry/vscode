/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { emptySessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';
import { AgentSessionContext } from './agentSessionContext.js';
import { IConversationRosterService } from './conversationStubService.js';

suite('AgentSessionContext (browser)', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('dispose releases session view leases acquired while releasing held leases', () => {
		const rosterActiveChange = store.add(new Emitter<string>());
		const innerDisposes: string[] = [];
		let releaseHook: (() => void) | undefined;

		const roster: IConversationRosterService = {
			_serviceBrand: undefined,
			getActiveSessionId: () => 'session-held',
			getSessions: () => [],
			isEngineSessionReady: () => true,
			onDidChangeActiveSession: rosterActiveChange.event,
			onDidChangeSession: Event.None,
			acquireSessionView: (sessionId: string) => ({
				snapshot: emptySessionViewSnapshot(sessionId as never),
				attribution: new Map(),
				dispose: () => {
					innerDisposes.push(sessionId);
					if (sessionId === 'session-held') {
						releaseHook?.();
					}
				},
			} as unknown as IConversationSessionViewLease),
		} as unknown as IConversationRosterService;

		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());

		const context = store.add(instantiationService.createInstance(AgentSessionContext));
		store.add(context.onDidChangeActiveSession(() => {
			context.acquireSessionView('session-reentrant');
		}));

		releaseHook = () => rosterActiveChange.fire('session-reentrant');
		context.acquireSessionView('session-held');

		context.dispose();

		assert.deepStrictEqual(innerDisposes, ['session-held', 'session-reentrant']);
	});
});
