/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MutableDisposable } from '../../../../base/common/lifecycle.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { getConversationSessionStatusText, showConversationPart } from './conversationSessionStatus.js';
import { IConversationStubService } from './conversationStubService.js';

export class ConversationSessionStatusBarContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionStatusBar';
	static readonly ENTRY_ID = 'status.conversation.session';

	private readonly entryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IConversationStubService private readonly stubService: IConversationStubService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IWorkbenchEnvironmentService environmentService: IWorkbenchEnvironmentService,
	) {
		super();

		if (environmentService.isSessionsWindow) {
			return;
		}

		this.entryAccessor.value = this.statusbarService.addEntry(
			this.createEntry(),
			ConversationSessionStatusBarContribution.ENTRY_ID,
			StatusbarAlignment.RIGHT,
			1,
		);

		this._register(this.stubService.onDidChangeActiveSession(() => this.updateEntry()));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			if (sessionId === this.stubService.getActiveSessionId()) {
				this.updateEntry();
			}
		}));
	}

	private updateEntry(): void {
		this.entryAccessor.value?.update(this.createEntry());
	}

	private createEntry(): IStatusbarEntry {
		const text = getConversationSessionStatusText(this.stubService.getActiveSession());
		return {
			name: localize('conversationStatus.name', "Conversation Session"),
			text,
			ariaLabel: localize('conversationStatus.ariaLabel', "Conversation session: {0}", text),
			tooltip: localize('conversationStatus.tooltip', "Show Conversation"),
			command: {
				id: ShowConversationPartAction.ID,
				title: '',
			},
			kind: 'standard',
		};
	}
}

export class ShowConversationPartAction extends Action2 {

	static readonly ID = 'workbench.action.showConversationPart';

	constructor() {
		super({
			id: ShowConversationPartAction.ID,
			title: localize('showConversationPart', "Show Conversation"),
			f1: false,
		});
	}

	override run(accessor: ServicesAccessor): void {
		showConversationPart(accessor);
	}
}

export function registerConversationSessionStatusBar(): void {
	registerAction2(ShowConversationPartAction);
}
