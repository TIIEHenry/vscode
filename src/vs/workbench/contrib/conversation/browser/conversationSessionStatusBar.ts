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
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IStatusbarEntry, IStatusbarEntryAccessor, IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import {
	getConversationEngineStatusText,
	getConversationModelEchoStatusText,
	getConversationSessionStatusText,
	shouldShowConversationModelEchoInStatusBar,
	showConversationPart,
} from './conversationSessionStatus.js';
import { IConversationStubService } from './conversationStubService.js';

export class ConversationSessionStatusBarContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationSessionStatusBar';
	static readonly SESSION_ENTRY_ID = 'status.conversation.session';
	static readonly ENGINE_ENTRY_ID = 'status.conversation.engine';
	static readonly MODEL_ENTRY_ID = 'status.conversation.model';

	private readonly sessionEntryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());
	private readonly engineEntryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());
	private readonly modelEntryAccessor = this._register(new MutableDisposable<IStatusbarEntryAccessor>());

	constructor(
		@IConversationStubService private readonly stubService: IConversationStubService,
		@IStatusbarService private readonly statusbarService: IStatusbarService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
	) {
		super();

		if (this.environmentService.isSessionsWindow) {
			return;
		}

		this.engineEntryAccessor.value = this.statusbarService.addEntry(
			this.createEngineEntry(),
			ConversationSessionStatusBarContribution.ENGINE_ENTRY_ID,
			StatusbarAlignment.RIGHT,
			3,
		);

		this.sessionEntryAccessor.value = this.statusbarService.addEntry(
			this.createSessionEntry(),
			ConversationSessionStatusBarContribution.SESSION_ENTRY_ID,
			StatusbarAlignment.RIGHT,
			2,
		);

		this.updateModelEntry();

		this._register(this.stubService.onDidChangeActiveSession(() => this.updateSessionEntry()));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			if (sessionId === this.stubService.getActiveSessionId()) {
				this.updateSessionEntry();
			}
		}));
		this._register(this.layoutService.onDidChangePartVisibility(e => {
			if (e.partId === Parts.CONVERSATION_PART) {
				this.updateModelEntry();
			}
		}));
	}

	private updateSessionEntry(): void {
		this.sessionEntryAccessor.value?.update(this.createSessionEntry());
	}

	private updateModelEntry(): void {
		const showModelEcho = shouldShowConversationModelEchoInStatusBar(this.layoutService.isVisible(Parts.CONVERSATION_PART));
		if (showModelEcho) {
			if (!this.modelEntryAccessor.value) {
				this.modelEntryAccessor.value = this.statusbarService.addEntry(
					this.createModelEntry(),
					ConversationSessionStatusBarContribution.MODEL_ENTRY_ID,
					StatusbarAlignment.RIGHT,
					4,
				);
			} else {
				this.modelEntryAccessor.value.update(this.createModelEntry());
			}
		} else {
			this.modelEntryAccessor.clear();
		}
	}

	private createSessionEntry(): IStatusbarEntry {
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

	private createEngineEntry(): IStatusbarEntry {
		const text = getConversationEngineStatusText();
		return {
			name: localize('conversationStatus.engineName', "Engine"),
			text,
			ariaLabel: localize('conversationStatus.engineAriaLabel', "Engine: {0}", text),
			tooltip: text,
			role: 'status',
			kind: 'standard',
		};
	}

	private createModelEntry(): IStatusbarEntry {
		const text = getConversationModelEchoStatusText();
		return {
			name: localize('conversationStatus.modelEchoName', "Session model"),
			text,
			ariaLabel: localize('conversationStatus.modelEchoAriaLabel', "Session model: {0}", text),
			tooltip: localize('conversationStatus.modelEchoTooltip', "Show Conversation"),
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
