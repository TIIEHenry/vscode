/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { localize } from '../../../../nls.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { ForkConversationAction } from '../../chat/browser/actions/chatForkActions.js';
import { isDefaultCodeWindow } from '../../chat/browser/chatShellRouting.js';
import { IChatSessionsService } from '../../chat/common/chatSessionsService.js';
import { getChatSessionType } from '../../chat/common/model/chatUri.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationRosterService } from './conversationStubService.js';

export class ConversationForkConversationAction extends ForkConversationAction {
	protected override async _tryForkAsChat(
		instantiationService: IInstantiationService,
		sourceSessionResource: import('../../../../base/common/uri.js').URI,
		request: import('../../chat/common/chatSessionsService.js').IChatSessionRequestHistoryItem | undefined,
	): Promise<boolean> {
		return instantiationService.invokeFunction(async accessor => {
			if (!isDefaultCodeWindow(accessor)) {
				return false;
			}

			const roster = accessor.get(IConversationRosterService);
			const notificationService = accessor.get(INotificationService);
			if (roster.isEngineConnected()) {
				if (roster.forkSubAgent(roster.getActiveSessionId())) {
					return true;
				}
				notificationService.error(localize('conversationFork.forkSubAgentFailed', "Could not fork conversation."));
				return true;
			}

			const chatSessionsService = accessor.get(IChatSessionsService);
			if (!chatSessionsService.getContentProviderSchemes().includes(getChatSessionType(sourceSessionResource))) {
				return false;
			}

			const sessionChatService = accessor.get(IConversationSessionChatService);
			const cts = new CancellationTokenSource();
			try {
				const forkedItem = await chatSessionsService.forkChatSession(sourceSessionResource, request, cts.token);
				try {
					await sessionChatService.openForkTab(forkedItem.resource, forkedItem.label);
				} catch (error) {
					notificationService.error(getErrorMessage(error));
				}
				return true;
			} finally {
				cts.dispose();
			}
		});
	}

	protected override async _openForkedSession(
		instantiationService: IInstantiationService,
		parentSessionResource: import('../../../../base/common/uri.js').URI,
		forkedSessionResource: import('../../../../base/common/uri.js').URI,
	): Promise<void> {
		await instantiationService.invokeFunction(async accessor => {
			if (!isDefaultCodeWindow(accessor)) {
				return super._openForkedSession(instantiationService, parentSessionResource, forkedSessionResource);
			}
			const sessionChatService = accessor.get(IConversationSessionChatService);
			const notificationService = accessor.get(INotificationService);
			if (accessor.get(IConversationRosterService).isEngineConnected()) {
				return;
			}
			try {
				await sessionChatService.openForkTab(forkedSessionResource);
			} catch (error) {
				notificationService.error(getErrorMessage(error));
			}
		});
	}
}

registerAction2(ConversationForkConversationAction);

export function isDefaultConversationWindow(accessor: ServicesAccessor): boolean {
	return isDefaultCodeWindow(accessor);
}
