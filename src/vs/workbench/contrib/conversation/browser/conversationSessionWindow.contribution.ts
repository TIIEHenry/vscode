/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationPartService, IConversationPartWindowSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IConversationRosterService } from './conversationStubService.js';

class ConversationSessionWindowContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionWindow';

	private _mounted = false;

	constructor(
		@IConversationPartService conversationPartService: IConversationPartService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
	) {
		super();

		const existing = conversationPartService.getSlots();
		if (existing) {
			this.mount(existing);
		} else {
			this._register(conversationPartService.onDidCreateSlots(slots => this.mount(slots)));
		}
	}

	private mount(slots: IConversationPartWindowSlots): void {
		if (this._mounted) {
			return;
		}
		this._mounted = true;

		const sessionKey = this.rosterService.getActiveSessionId();
		this.editorGroupsService.createConversationEditorPart(slots.editorPartHost, sessionKey);
	}
}

registerWorkbenchContribution2(ConversationSessionWindowContribution.ID, ConversationSessionWindowContribution, WorkbenchPhase.AfterRestored);
