/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';

/**
 * CS-1: this contribution no longer applies density, drafts, Enter, pending, or
 * deleted-key chrome. Display / Chat Input consumption lives on ConversationLens,
 * ConversationEditorPane, and ConversationPart.focus().
 */
class UaClientConversationChromeContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.uaClientConversationChrome';

	constructor() {
		super();
	}
}

registerWorkbenchContribution2(UaClientConversationChromeContribution.ID, UaClientConversationChromeContribution, WorkbenchPhase.AfterRestored);
