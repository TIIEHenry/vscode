/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AccessibleContentProvider, AccessibleViewProviderId, AccessibleViewType } from '../../../../platform/accessibility/browser/accessibleView.js';
import { IAccessibleViewImplementation } from '../../../../platform/accessibility/browser/accessibleViewRegistry.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { AccessibilityVerbositySettingId } from '../../accessibility/browser/accessibilityConfiguration.js';
import { ConversationVisibleContext } from '../../../common/contextkeys.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';

/**
 * Opens the existing Accessible View on the focused (or last) conversation turn.
 * Does not invent a second live region; streaming rows keep a stable aria-label.
 */
export class ConversationAccessibleView implements IAccessibleViewImplementation {
	readonly priority = 95;
	readonly name = 'conversation';
	readonly type = AccessibleViewType.View;
	readonly when = ConversationVisibleContext;

	getProvider(accessor: ServicesAccessor): AccessibleContentProvider | undefined {
		const revealService = accessor.get(IConversationTimelineRevealService);
		const content = revealService.getAccessibleTurnContent();
		if (!content) {
			return undefined;
		}
		return new AccessibleContentProvider(
			AccessibleViewProviderId.Conversation,
			{ type: AccessibleViewType.View, language: 'markdown', id: AccessibleViewProviderId.Conversation },
			() => revealService.getAccessibleTurnContent() ?? content,
			() => revealService.focusAccessibleTurn(),
			AccessibilityVerbositySettingId.Conversation,
		);
	}
}
