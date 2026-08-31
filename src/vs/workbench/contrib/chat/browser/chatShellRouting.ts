/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';

/** Default Code window (not Agents Window). */
export function isDefaultCodeWindow(accessor: ServicesAccessor): boolean {
	return !accessor.get(IWorkbenchEnvironmentService).isSessionsWindow;
}

/** Default Code product paths route New/Open Chat Editor targets to Conversation. */
export function shouldRouteChatEditorToConversation(accessor: ServicesAccessor): boolean {
	return isDefaultCodeWindow(accessor);
}

/** Show and focus the center ConversationPart (INV-TOPO product shell). */
export function focusConversationPart(accessor: ServicesAccessor): void {
	const layoutService = accessor.get(IWorkbenchLayoutService);
	const conversationPartService = accessor.get(IConversationPartService);
	if (!layoutService.isVisible(Parts.CONVERSATION_PART)) {
		layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
	}
	conversationPartService.focus();
}
