/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationLens.css';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationLensSlots, IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationLens } from './conversationLens.js';

class ConversationLensContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationLens';

	private _mounted = false;

	constructor(
		@IConversationPartService conversationPartService: IConversationPartService,
	) {
		super();

		const existing = conversationPartService.getSlots();
		if (existing) {
			this.mount(existing);
		} else {
			this._register(conversationPartService.onDidCreateSlots(slots => this.mount(slots)));
		}
	}

	private mount(slots: IConversationLensSlots): void {
		if (this._mounted) {
			return;
		}
		this._mounted = true;
		this._register(new ConversationLens(slots));
	}
}

registerWorkbenchContribution2(ConversationLensContribution.ID, ConversationLensContribution, WorkbenchPhase.AfterRestored);
