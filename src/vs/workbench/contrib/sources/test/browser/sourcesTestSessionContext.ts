/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { IAgentSessionContext } from '../../../../services/agentSession/common/agentSessionContext.js';

/** Complete session service for Sources tests that do not open a conversation lease. */
export function createSourcesTestSessionContext(overrides: Partial<IAgentSessionContext> = {}): IAgentSessionContext {
	return {
		_serviceBrand: undefined,
		getActiveSessionId: () => '',
		isEngineSessionReady: () => false,
		isPairingHold: () => false,
		onDidChangeActiveSession: Event.None,
		onDidChangeSession: Event.None,
		acquireSessionView: () => { throw new Error('This Sources test does not provide a session view.'); },
		...overrides,
	};
}
