/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { emptySessionViewSnapshotWithRejects } from '../../../../../platform/universeAgent/common/sessionView/empty-snapshot.js';
import type { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';
import { IAgentWorkRoot, resolveAgentWorkRoot } from '../../../../services/agentSession/common/agentWorkRoot.js';

export function createCatalogWorkRoot(workDir = '', sessionId = 'sess-1'): IAgentWorkRoot {
	return resolveAgentWorkRoot({
		sessionId,
		sessionWorkDir: workDir,
		connectionWorkDir: undefined,
		engineIdentityId: 'engine-test',
		repositoryRoots: [],
		workspaceFolders: [],
	});
}

export function createCatalogSessionContext(overrides: Partial<IAgentSessionContext> = {}): IAgentSessionContext {
	const context: IAgentSessionContext = {
		_serviceBrand: undefined,
		getActiveSessionId: () => 'sess-1',
		isEngineSessionReady: () => true,
		getEngineSessionReadiness: () => 'ready',
		isPairingHold: () => false,
		getActiveWorkRoot: () => createCatalogWorkRoot('', context.getActiveSessionId()),
		getWorkRoot: sessionId => sessionId === context.getActiveSessionId()
			? context.getActiveWorkRoot!() : createCatalogWorkRoot('', sessionId),
		getSessionWorkDir: sessionId => context.getWorkRoot!(sessionId).workDir,
		onDidChangeActiveSession: Event.None,
		onDidChangeSession: Event.None,
		onDidChangeActiveWorkRoot: Event.None,
		acquireSessionView: sessionId => {
			const result = emptySessionViewSnapshotWithRejects(sessionId);
			if (!result.ok) {
				throw new Error(`Invalid test session id: ${result.reason}`);
			}
			return { snapshot: result.snapshot, attribution: new Map(), dispose: () => { } };
		},
		...overrides,
	};
	return context;
}
