/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { showConversationPart } from '../../conversation/browser/conversationSessionStatus.js';
import { IConversationRosterService } from '../../conversation/browser/conversationStubService.js';
import { IConversationSessionChatService } from '../../conversation/browser/conversationSessionChatService.js';
import { isEngineRootAgentId } from '../common/navigatorAgentHierarchy.js';

export async function revealNavigatorAgentInConversation(
	accessor: ServicesAccessor,
	agentId: string,
	title?: string,
): Promise<void> {
	const rosterService = accessor.get(IConversationRosterService);
	const sessionChatService = accessor.get(IConversationSessionChatService);
	const sessionKey = rosterService.getActiveSessionId();

	showConversationPart(accessor);

	if (isEngineRootAgentId(agentId)) {
		await sessionChatService.navigateAgentBreadcrumb(sessionKey, 'default');
		if (sessionChatService.isSubAgentDialogOpen(sessionKey)) {
			sessionChatService.closeSubAgentDialog(sessionKey);
		}
		return;
	}

	const existing = sessionChatService.findOpenTabForChat(sessionKey, agentId);
	if (existing) {
		await sessionChatService.navigateAgentBreadcrumb(sessionKey, agentId);
		return;
	}

	await sessionChatService.openSubAgent(sessionKey, agentId, title);
}
