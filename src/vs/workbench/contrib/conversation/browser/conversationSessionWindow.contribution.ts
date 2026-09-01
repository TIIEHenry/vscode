/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ConversationSessionWindowService, IConversationSessionWindowService } from './conversationSessionWindowService.js';

registerSingleton(IConversationSessionWindowService, ConversationSessionWindowService, InstantiationType.Eager);

class ConversationSessionWindowContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionWindow';

	constructor(
		@IConversationSessionWindowService _sessionWindowService: IConversationSessionWindowService,
	) {
		super();
	}
}

registerWorkbenchContribution2(ConversationSessionWindowContribution.ID, ConversationSessionWindowContribution, WorkbenchPhase.AfterRestored);
