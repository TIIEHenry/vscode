/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationTokenSource } from '../../../../base/common/cancellation.js';
import { registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ForkConversationAction } from '../../chat/browser/actions/chatForkActions.js';
import { isDefaultCodeWindow } from '../../chat/browser/chatShellRouting.js';
import { IChatSessionsService } from '../../chat/common/chatSessionsService.js';
import { getChatSessionType } from '../../chat/common/model/chatUri.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';

registerAction2(class ConversationForkConversationAction extends ForkConversationAction {
	protected override async _tryForkAsChat(
		instantiationService: IInstantiationService,
		sourceSessionResource: import('../../../../base/common/uri.js').URI,
		request: import('../../chat/common/chatSessionsService.js').IChatSessionRequestHistoryItem | undefined,
	): Promise<boolean> {
		return instantiationService.invokeFunction(async accessor => {
			if (!isDefaultCodeWindow(accessor)) {
				return false;
			}

			const chatSessionsService = accessor.get(IChatSessionsService);
			if (!chatSessionsService.getContentProviderSchemes().includes(getChatSessionType(sourceSessionResource))) {
				return false;
			}

			const cts = new CancellationTokenSource();
			try {
				const forkedItem = await chatSessionsService.forkChatSession(sourceSessionResource, request, cts.token);
				await accessor.get(IConversationSessionChatService).openForkTab(forkedItem.resource, forkedItem.label);
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
			await accessor.get(IConversationSessionChatService).openForkTab(forkedSessionResource);
		});
	}
});

export function isDefaultConversationWindow(accessor: ServicesAccessor): boolean {
	return isDefaultCodeWindow(accessor);
}
