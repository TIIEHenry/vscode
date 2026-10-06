/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { showConversationPart } from '../../conversation/browser/conversationSessionStatus.js';
import { IConversationSessionWindowService } from '../../conversation/browser/conversationSessionWindowService.js';
import { IConversationSessionChatService } from '../../conversation/browser/conversationSessionChatService.js';
import { isEngineRootAgentId } from '../common/navigatorAgentHierarchy.js';

export const navigatorRevealSessionNotOpenCopy = localize(
	'navigatorReveal.sessionNotOpen',
	"Could not reveal this agent — its session is not open.",
);

export async function revealNavigatorAgentInConversation(
	accessor: ServicesAccessor,
	agentId: string,
	title?: string,
	sessionId?: string,
): Promise<void> {
	const sessionChatService = accessor.get(IConversationSessionChatService);
	const notificationService = accessor.get(INotificationService);
	const sessionWindowService = accessor.get(IConversationSessionWindowService);
	const sessionKey = sessionId?.trim() ?? '';
	if (!sessionKey || !sessionWindowService.getVisibleSessionKeys().includes(sessionKey)) {
		notificationService.info(navigatorRevealSessionNotOpenCopy);
		return;
	}

	showConversationPart(accessor);

	try {
		if (isEngineRootAgentId(agentId)) {
			await sessionChatService.navigateAgentBreadcrumb(sessionKey, 'default');
			if (sessionChatService.isSubAgentDialogOpen(sessionKey)) {
				sessionChatService.closeSubAgentDialog(sessionKey);
			}
			// Overlay "default" only dismisses the dialog; run the editor breadcrumb again so
			// a tool tab underneath does not masquerade as a successful root reveal.
			await sessionChatService.navigateAgentBreadcrumb(sessionKey, 'default');
			return;
		}

		const existing = sessionChatService.findOpenTabForChat(sessionKey, agentId);
		if (existing) {
			if (sessionChatService.isSubAgentDialogOpen(sessionKey)) {
				await sessionChatService.navigateAgentBreadcrumb(sessionKey, agentId);
			} else {
				await sessionChatService.openSubAgent(sessionKey, agentId, title);
			}
			return;
		}

		await sessionChatService.openSubAgent(sessionKey, agentId, title);
	} catch (error) {
		notificationService.error(getErrorMessage(error));
	}
}
