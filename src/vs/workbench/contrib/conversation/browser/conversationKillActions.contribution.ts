/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../../nls.js';
import { isDefaultCodeWindow } from '../../chat/browser/chatShellRouting.js';
import { IConversationRosterService } from './conversationStubService.js';

export const CONVERSATION_KILL_SUB_AGENT_COMMAND_ID = 'workbench.action.conversation.killSubAgent';

export interface ConversationKillSubAgentArgs {
	readonly agentId?: string;
	readonly force?: boolean;
}

/**
 * Connected user Kill → AgentService.Kill. Does not invent a local catalog
 * id or close a Fork tab. Disconnected / non-default windows no-op.
 */
registerAction2(class ConversationKillSubAgentAction extends Action2 {

	constructor() {
		super({
			id: CONVERSATION_KILL_SUB_AGENT_COMMAND_ID,
			title: localize2('conversationKillSubAgent', 'Kill Conversation Sub-Agent'),
			category: localize2('conversation', 'Conversation'),
			f1: true,
		});
	}

	override run(accessor: ServicesAccessor, args?: ConversationKillSubAgentArgs): void {
		if (!isDefaultCodeWindow(accessor)) {
			return;
		}
		const roster = accessor.get(IConversationRosterService);
		if (!roster.isEngineConnected()) {
			return;
		}
		roster.killSubAgent(roster.getActiveSessionId(), args);
	}
});
