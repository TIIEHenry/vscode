/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationSessionChatService, IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';

registerSingleton(IConversationSessionChatService, ConversationSessionChatService, InstantiationType.Eager);

class ConversationSessionChatContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionChat';

	private readonly mountedOverlays = new Set<string>();
	private readonly registeredParts = new Set<string>();

	constructor(
		@IConversationPartService conversationPartService: IConversationPartService,
		@IConversationSessionChatService sessionChatService: IConversationSessionChatService,
		@IConversationSessionWindowService sessionWindowService: IConversationSessionWindowService,
	) {
		super();

		const mountAll = () => {
			for (const sessionKey of sessionWindowService.getAllLeafSessionKeys()) {
				const leaf = sessionWindowService.getLeafSlots(sessionKey);
				if (!leaf) {
					continue;
				}

				if (!this.mountedOverlays.has(sessionKey)) {
					sessionChatService.mountSubAgentOverlay(sessionKey, leaf.sessionWindow);
					this.mountedOverlays.add(sessionKey);
				}

				const part = sessionChatService.getConversationPart(sessionKey);
				if (part && !this.registeredParts.has(sessionKey)) {
					this.registeredParts.add(sessionKey);
					this._register(sessionChatService.registerPartListeners(part));
				}
			}
		};

		const existing = conversationPartService.getSlots();
		if (existing) {
			mountAll();
		}
		this._register(conversationPartService.onDidCreateSlots(() => mountAll()));
		this._register(sessionWindowService.onDidChangeVisibleWindows(() => mountAll()));
	}
}

registerWorkbenchContribution2(ConversationSessionChatContribution.ID, ConversationSessionChatContribution, WorkbenchPhase.AfterRestored);
