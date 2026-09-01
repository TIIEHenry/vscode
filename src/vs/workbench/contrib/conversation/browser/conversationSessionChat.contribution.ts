/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';

class ConversationSessionChatContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionChat';

	private readonly mountedOverlays = new Set<string>();

	constructor(
		@IConversationPartService conversationPartService: IConversationPartService,
		@IConversationSessionChatService sessionChatService: IConversationSessionChatService,
		@IConversationSessionWindowService sessionWindowService: IConversationSessionWindowService,
	) {
		super();

		const mountAll = () => {
			const sessionBar = conversationPartService.getSlots()?.sessionBar;
			if (!sessionBar) {
				return;
			}

			for (const sessionKey of sessionWindowService.getAllLeafSessionKeys()) {
				if (this.mountedOverlays.has(sessionKey)) {
					continue;
				}
				const leaf = sessionWindowService.getLeafSlots(sessionKey);
				if (!leaf) {
					continue;
				}
				sessionChatService.mountSubAgentOverlay(sessionKey, leaf.sessionWindow, sessionBar);
				this.mountedOverlays.add(sessionKey);
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
