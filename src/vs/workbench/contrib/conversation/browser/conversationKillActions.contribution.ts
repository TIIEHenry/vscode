/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getActiveElement } from '../../../../base/browser/dom.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { isDefaultCodeWindow } from '../../chat/browser/chatShellRouting.js';
import { resolveConversationKillSessionKey, tryKillSubAgent, type ConversationKillSubAgentArgs } from './conversationKillEngine.js';
import { IConversationRosterService } from './conversationStubService.js';

export const CONVERSATION_KILL_SUB_AGENT_COMMAND_ID = 'workbench.action.conversation.killSubAgent';

export type { ConversationKillSubAgentArgs };

/** Lock Kill to the focused session leaf at invoke time; ignore caller `sessionId`. */
export function resolveConversationKillSubAgentInvokeArgs(
	activeElement: Element | null,
	args?: ConversationKillSubAgentArgs,
): ConversationKillSubAgentArgs {
	return {
		agentId: args?.agentId,
		force: args?.force,
		sessionId: resolveConversationKillSessionKey(activeElement),
	};
}

/** After an async Kill, only surface errors while focus is still on that session leaf. */
export function shouldDeliverConversationKillNotice(
	sessionIdAtInvoke: string | undefined,
	activeElement: Element | null,
): boolean {
	const invoked = sessionIdAtInvoke?.trim() ?? '';
	if (!invoked) {
		return true;
	}
	const current = resolveConversationKillSessionKey(activeElement)?.trim() ?? '';
	return current === invoked;
}

function createKillInvokeScopedNotificationService(
	notificationService: Pick<INotificationService, 'error'>,
	sessionIdAtInvoke: string | undefined,
): Pick<INotificationService, 'error'> {
	return {
		error(message: string | Error) {
			if (!shouldDeliverConversationKillNotice(sessionIdAtInvoke, getActiveElement())) {
				return;
			}
			notificationService.error(message);
		},
	};
}

/**
 * Connected user Kill → AgentService.Kill. Does not invent a local catalog
 * id or close a Fork tab. Pairing-hold leftover and leftover-looks-live
 * (`isEngineConnected()===true` + pairingPending) are checked first and
 * show the disconnected notice without calling `killSubAgent`.
 * `!isEngineConnected()` + history (true disconnect leftover) also notices.
 * `killSubAgent` false or a later unary refusal → failed notice; unary
 * success stays silent. Sync "sent" true is not treated as killed.
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

	override async run(accessor: ServicesAccessor, args?: ConversationKillSubAgentArgs): Promise<void> {
		if (!isDefaultCodeWindow(accessor)) {
			return;
		}
		const invokeArgs = resolveConversationKillSubAgentInvokeArgs(getActiveElement(), args);
		const roster = accessor.get(IConversationRosterService);
		const notificationService = accessor.get(INotificationService);
		await tryKillSubAgent(
			roster,
			createKillInvokeScopedNotificationService(notificationService, invokeArgs.sessionId),
			invokeArgs,
			accessor.get(IUniverseAgentConnection),
		);
	}
});
