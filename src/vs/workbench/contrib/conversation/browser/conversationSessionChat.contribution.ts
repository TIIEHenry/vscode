/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationSessionChatService, IConversationSessionChatService } from './conversationSessionChatService.js';

registerSingleton(IConversationSessionChatService, ConversationSessionChatService, InstantiationType.Delayed);

class ConversationSessionChatContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionChat';

	constructor(
		@IConversationPartService conversationPartService: IConversationPartService,
		@IConversationSessionChatService sessionChatService: IConversationSessionChatService,
	) {
		super();

		const mount = (slots: { sessionBar: HTMLElement; editorPartHost: HTMLElement }) => {
			const sessionWindow = slots.editorPartHost.parentElement;
			if (!sessionWindow) {
				return;
			}
			sessionChatService.mountSubAgentOverlay(sessionWindow, slots.sessionBar);
		};

		const existing = conversationPartService.getSlots();
		if (existing) {
			mount(existing);
		}
		this._register(conversationPartService.onDidCreateSlots(mount));
	}
}

registerWorkbenchContribution2(ConversationSessionChatContribution.ID, ConversationSessionChatContribution, WorkbenchPhase.AfterRestored);
