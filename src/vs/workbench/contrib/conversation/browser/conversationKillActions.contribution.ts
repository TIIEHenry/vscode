/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isDefaultCodeWindow } from '../../chat/browser/chatShellRouting.js';
import { tryKillSubAgent, type ConversationKillSubAgentArgs } from './conversationKillEngine.js';
import { IConversationRosterService } from './conversationStubService.js';

export const CONVERSATION_KILL_SUB_AGENT_COMMAND_ID = 'workbench.action.conversation.killSubAgent';

export type { ConversationKillSubAgentArgs };

/**
 * Connected user Kill → AgentService.Kill. Does not invent a local catalog
 * id or close a Fork tab. Pairing-hold leftover and leftover-looks-live
 * (`isEngineConnected()===true` + pairingPending) are checked first and
 * show the disconnected notice without calling `killSubAgent`.
 * `!isEngineConnected()` + history (true disconnect leftover) also notices.
 * `killSubAgent` false → failed notice; true stays silent.
 * Never-connected / non-default windows stay a silent no-op.
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
		const notificationService = accessor.get(INotificationService);
		tryKillSubAgent(roster, notificationService, args, accessor.get(IUniverseAgentConnection));
	}
});
