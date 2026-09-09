/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { localize, localize2 } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { overlayAttributionKey } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import { showConversationPart } from './conversationSessionStatus.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';

export const CONVERSATION_REVEAL_ITEM_COMMAND_ID = 'conversation.revealItem';

/** User-visible copy when reveal cannot resolve a conversation step. */
export const conversationRevealItemNotFound = localize(
	'conversationReveal.itemNotFound',
	"This step was not found in the conversation",
);

export function notifyConversationRevealItemNotFound(notificationService: INotificationService): void {
	notificationService.info(conversationRevealItemNotFound);
}

interface ConversationRevealItemArgs {
	readonly itemId?: string;
	readonly toolCallId?: string;
}

registerAction2(class ConversationRevealItemAction extends Action2 {
	constructor() {
		super({
			id: CONVERSATION_REVEAL_ITEM_COMMAND_ID,
			title: localize2('conversationRevealItem', "Reveal conversation item"),
			f1: false,
		});
	}

	override async run(accessor: ServicesAccessor, args?: ConversationRevealItemArgs): Promise<void> {
		if (!args?.itemId && !args?.toolCallId) {
			return;
		}

		showConversationPart(accessor);

		const rosterService = accessor.get(IConversationRosterService);
		const revealService = accessor.get(IConversationTimelineRevealService);
		const notificationService = accessor.get(INotificationService);
		const sessionId = rosterService.getActiveSessionId();
		let lease: ReturnType<IConversationRosterService['acquireSessionView']> | undefined;
		try {
			lease = rosterService.acquireSessionView(sessionId);
			let itemId = args.itemId;
			if (!itemId && args.toolCallId) {
				itemId = resolveItemIdFromToolCallId(lease, args.toolCallId);
			}
			if (!itemId) {
				notifyConversationRevealItemNotFound(notificationService);
				return;
			}
			revealService.revealItem(itemId);
		} catch (error) {
			notificationService.error(getErrorMessage(error));
		} finally {
			lease?.dispose();
		}
	}
});

function resolveItemIdFromToolCallId(
	lease: ReturnType<IConversationRosterService['acquireSessionView']>,
	toolCallId: string,
): string | undefined {
	for (const [itemId, attribution] of lease.attribution.entries()) {
		if ((attribution as { readonly toolCallId?: string }).toolCallId === toolCallId) {
			return itemId;
		}
	}
	for (const item of lease.snapshot.timeline) {
		if (String(item.id) === toolCallId) {
			return String(item.id);
		}
	}
	for (const block of lease.snapshot.overlay.blocks) {
		const overlayKey = overlayAttributionKey(String(block.blockId));
		if (overlayKey === toolCallId || String(block.blockId) === toolCallId) {
			return overlayKey;
		}
	}
	return undefined;
}
