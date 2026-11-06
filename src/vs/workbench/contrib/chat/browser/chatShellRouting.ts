/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IProductChatOpenRoute } from '../../../services/chat/common/productChatOpenRoute.js';

/** Default Code window (not Agents Window). */
export function isDefaultCodeWindow(accessor: ServicesAccessor): boolean {
	return !accessor.get(IWorkbenchEnvironmentService).isSessionsWindow;
}

/** Default Code product paths route New/Open Chat Editor targets to Conversation. */
export function shouldRouteChatEditorToConversation(accessor: ServicesAccessor): boolean {
	return isDefaultCodeWindow(accessor);
}

/**
 * The product route for "open Chat", or `undefined` when none is registered (the
 * Agents window). The accessor has no optional lookup and both windows build a strict
 * instantiation service, which throws for an unregistered service.
 */
function getProductChatOpenRoute(accessor: ServicesAccessor): IProductChatOpenRoute | undefined {
	try {
		return accessor.get(IProductChatOpenRoute);
	} catch {
		return undefined;
	}
}

/**
 * Show and focus the center ConversationPart (INV-TOPO product shell) when the
 * product route says to open Conversation instead of a chat. Returns `true` when
 * it did, so the caller stops; `false` leaves the caller on its normal chat path.
 */
export function focusConversationPart(accessor: ServicesAccessor): boolean {
	if (!getProductChatOpenRoute(accessor)?.openInstead()) {
		return false;
	}
	const layoutService = accessor.get(IWorkbenchLayoutService);
	const conversationPartService = accessor.get(IConversationPartService);
	if (!layoutService.isVisible(Parts.CONVERSATION_PART)) {
		layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
	}
	conversationPartService.focus();
	return true;
}
