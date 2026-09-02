/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { addDisposableListener } from '../../../../base/browser/dom.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';
import { IUaClientWorkspaceToolsGate } from './uaClientWorkspaceToolsGate.js';
import { loadUaClientComposerDraft, storeUaClientComposerDraft } from './uaClientComposerDrafts.js';
import {
	getUaClientConversationDensity,
	getUaClientKeyboardEnterBehavior,
	shouldAdvertiseWorkspaceTools,
	shouldAutoFocusComposer,
	shouldOpenPendingOnFocus,
	shouldRestoreComposerDrafts,
	shouldShowAgentIdentity,
	shouldShowClientToolInvocationDetails,
	UA_CLIENT_CLIENT_TOOLS_SHOW_INVOCATION_DETAILS,
	UA_CLIENT_DISPLAY_CONVERSATION_DENSITY,
	UA_CLIENT_DISPLAY_SHOW_AGENT_IDENTITY,
} from '../common/uaClientSettingsHelpers.js';

const COMPOSER_INPUT_SELECTOR = 'textarea.conversation-lens-dock-input';

class UaClientConversationChromeContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.uaClientConversationChrome';

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IStorageService private readonly storageService: IStorageService,
		@ILayoutService private readonly layoutService: ILayoutService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IConversationTimelineRevealService private readonly revealService: IConversationTimelineRevealService,
		@IUaClientWorkspaceToolsGate private readonly workspaceToolsGate: IUaClientWorkspaceToolsGate,
	) {
		super();

		this.applyWorkbenchClasses();
		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (
				event.affectsConfiguration(UA_CLIENT_DISPLAY_CONVERSATION_DENSITY)
				|| event.affectsConfiguration(UA_CLIENT_CLIENT_TOOLS_SHOW_INVOCATION_DETAILS)
				|| event.affectsConfiguration(UA_CLIENT_DISPLAY_SHOW_AGENT_IDENTITY)
			) {
				this.applyWorkbenchClasses();
			}
		}));

		this._register(addDisposableListener(this.layoutService.mainContainer, 'keydown', event => this.onComposerKeyDown(event), true));
		this._register(addDisposableListener(this.layoutService.mainContainer, 'input', event => this.onComposerInput(event), true));

		this._register(this.rosterService.onDidChangeActiveSession(sessionId => this.onActiveSession(sessionId)));
		this.onActiveSession(this.rosterService.getActiveSessionId());

		// Gate is the advertise consumer: false means this client will not offer workspace tools.
		void this.workspaceToolsGate.shouldAdvertise();
		void shouldAdvertiseWorkspaceTools(this.configurationService);
	}

	private applyWorkbenchClasses(): void {
		const compact = getUaClientConversationDensity(this.configurationService) === 'compact';
		document.body.classList.toggle('ua-client-density-compact', compact);
		document.body.classList.toggle('ua-client-hide-tool-details', !shouldShowClientToolInvocationDetails(this.configurationService));
		document.body.classList.toggle('ua-client-hide-agent-identity', !shouldShowAgentIdentity(this.configurationService));
	}

	private onComposerKeyDown(event: KeyboardEvent): void {
		if (event.keyCode !== KeyCode.Enter) {
			return;
		}
		const textarea = event.target instanceof HTMLTextAreaElement && event.target.matches(COMPOSER_INPUT_SELECTOR)
			? event.target
			: undefined;
		if (!textarea) {
			return;
		}
		const enterSends = getUaClientKeyboardEnterBehavior(this.configurationService) === 'send';
		if (enterSends) {
			return;
		}
		if (event.shiftKey) {
			event.preventDefault();
			event.stopImmediatePropagation();
			textarea.closest('.conversation-lens-composer')
				?.querySelector<HTMLElement>('.conversation-lens-dock-send-button')
				?.click();
			return;
		}
		event.stopImmediatePropagation();
	}

	private onComposerInput(event: Event): void {
		const textarea = event.target instanceof HTMLTextAreaElement && event.target.matches(COMPOSER_INPUT_SELECTOR)
			? event.target
			: undefined;
		if (!textarea || !shouldRestoreComposerDrafts(this.configurationService)) {
			return;
		}
		storeUaClientComposerDraft(this.storageService, this.rosterService.getActiveSessionId(), textarea.value);
	}

	private onActiveSession(sessionId: string): void {
		const textarea = this.layoutService.mainContainer.querySelector<HTMLTextAreaElement>(COMPOSER_INPUT_SELECTOR);
		if (textarea) {
			if (shouldRestoreComposerDrafts(this.configurationService)) {
				if (!textarea.value) {
					textarea.value = loadUaClientComposerDraft(this.storageService, sessionId);
				}
			} else {
				textarea.value = '';
			}
			if (shouldAutoFocusComposer(this.configurationService)) {
				textarea.focus();
			}
		}

		if (shouldOpenPendingOnFocus(this.configurationService)) {
			const pending = this.rosterService.getTurns(sessionId).find(turn =>
				(turn.kind === 'confirmation' || turn.kind === 'question') && turn.status === 'pending');
			if (pending) {
				this.revealService.revealItem(pending.id);
			}
		}
	}
}

registerWorkbenchContribution2(UaClientConversationChromeContribution.ID, UaClientConversationChromeContribution, WorkbenchPhase.AfterRestored);
