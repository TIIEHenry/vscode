/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../../nls.js';
import { ConversationVisibleContext } from '../../../common/contextkeys.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';

registerAction2(class ConversationSplitSessionWindowAction extends Action2 {

	constructor() {
		super({
			id: 'workbench.action.conversation.splitSessionWindow',
			title: localize2('conversationSplitSessionWindow', 'Split Conversation Editor'),
			category: localize2('conversation', 'Conversation'),
			f1: true,
			precondition: ConversationVisibleContext,
		});
	}

	override run(accessor: ServicesAccessor): Promise<void> {
		const layoutService = accessor.get(IWorkbenchLayoutService);
		if (!layoutService.hasFocus(Parts.CONVERSATION_PART)) {
			return Promise.resolve();
		}
		return accessor.get(IConversationSessionChatService).splitSessionWindow();
	}
});
