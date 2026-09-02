/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';
import { shouldOpenPendingOnFocus } from '../common/uaClientSettingsHelpers.js';

/**
 * CS-4: scroll to the first pending permission/question seat when Conversation is
 * focused. `switchToSession` ends in `showConversationPart` → `focus()`, so both
 * return-to-session anchors share this path and do not scroll twice.
 */
export class ConversationOpenPendingOnFocusContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationOpenPendingOnFocus';

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IConversationPartService conversationPartService: IConversationPartService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IConversationTimelineRevealService private readonly revealService: IConversationTimelineRevealService,
	) {
		super();
		this._register(conversationPartService.onDidFocus(() => this.onConversationPartFocus()));
	}

	private onConversationPartFocus(): void {
		if (!shouldOpenPendingOnFocus(this.configurationService)) {
			return;
		}
		const sessionId = this.rosterService.getActiveSessionId();
		if (this.rosterService.countPendingConfirmations(sessionId) <= 0) {
			return;
		}
		this.revealService.scrollToFirstPendingConfirmation();
	}
}

registerWorkbenchContribution2(ConversationOpenPendingOnFocusContribution.ID, ConversationOpenPendingOnFocusContribution, WorkbenchPhase.AfterRestored);
