/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, addStandardDisposableListener, append } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	conversationLensDockAddTitle,
	conversationLensDockAgentLabel,
	conversationLensDockEditExit,
	conversationLensDockEngineNotConnected,
	conversationLensDockMaximizeInput,
	conversationLensDockMoreTitle,
	conversationLensDockNoModel,
	conversationLensDockPermissionAgent,
	conversationLensDockPermissionAsk,
	conversationLensDockPermissionLabel,
	conversationLensDockPermissionPermit,
	conversationLensDockPlaceholder,
	conversationLensDockTemplatesTitle,
	conversationLensDockTuneTitle,
} from './conversationLensDockStrings.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConversationRosterService } from './conversationStubService.js';
import { getUaClientKeyboardEnterBehavior } from '../common/uaClientSettingsHelpers.js';
import { createInputHistoryBrowseState, InputHistoryBrowseState } from './conversationInputHistory.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { COMPOSER_AGENT_OPTIONS } from './conversationComposerCatalog.js';
import {
	applySessionModelIndex,
	applySessionPermissionIndex,
	type ConversationSessionConfigSelection,
	type IConversationLensComposerChromeHost,
	showPostFailure,
	updatePermissionSelectEnabled,
} from './conversationLensComposerChrome.js';

export interface IConversationLensDockHost {
	dockRoot: HTMLElement;
	gateRow: HTMLElement;
	gateLabel: HTMLElement;
	inboxOverlay: ConversationInboxOverlay;
	composerCluster: HTMLElement;
	composer: HTMLElement;
	composerEditHeader: HTMLElement;
	composerEditTitle: HTMLElement;
	composerExitButton: Button;
	dockTextarea: HTMLTextAreaElement;
	addButton: Button;
	tuneButton: Button;
	permissionSelectBox: SelectBox;
	agentContainer: HTMLElement;
	agentSelectBox: SelectBox;
	moreButton: Button;
	modelSelectBox: SelectBox;
	modelSelectedIndex: number;
	templatesButton: Button;
	maximizeInputButton: Button;
	sendButton: Button;
	composerPolicy: 'compose' | 'turnEdit' | 'queueEdit';
	inputHistoryBrowse: InputHistoryBrowseState;
	readonly stubService: IConversationRosterService;
	readonly configurationService: IConfigurationService;
	readonly instantiationService: IInstantiationService;
	getBoundSessionId(): string;
	register<T extends IDisposable>(disposable: T): T;
	createComposerSelectBox(options: { text: string }[], selectedIndex: number, ariaLabel: string): SelectBox;
	getSessionConfig(sessionId: string): ConversationSessionConfigSelection;
	setSessionConfig(sessionId: string, patch: Partial<ConversationSessionConfigSelection>): void;
	toggleAddContextView(): void;
	toggleTuneContextView(): void;
	toggleMoreContextView(): void;
	toggleTemplatesContextView(): void;
	toggleInputMaximized(): void;
	updateMaximizeInputButton(): void;
	updateSendEnabled(): void;
	beginQueueEdit(itemId: string): void;
	exitComposerEdit(restoreComposeDraft?: boolean, releaseQueueHold?: boolean): void;
	navigateInputHistory(direction: import('./conversationInputHistory.js').InputHistoryDirection): boolean;
	exitInputHistoryBrowse(): void;
	submitDraft(): Promise<void>;
	writeComposerDraft(sessionId: string, text: string): void;
	updateConversationPhase(): void;
	scrollToFirstPendingConfirmation(): void;
}

export function mountDock(host: IConversationLensDockHost & IConversationLensComposerChromeHost, dockHost: HTMLElement): void {

		host.dockRoot = append(dockHost, $('.conversation-lens-dock'));

		host.gateRow = append(host.dockRoot, $('.conversation-lens-dock-gate-row'));
		host.gateRow.setAttribute('role', 'status');
		host.gateRow.setAttribute('aria-label', conversationLensDockEngineNotConnected);
		host.gateLabel = append(host.gateRow, $('span.conversation-lens-dock-gate-label'));
		host.gateLabel.textContent = conversationLensDockEngineNotConnected;

		host.inboxOverlay = host.register(host.instantiationService.createInstance(ConversationInboxOverlay, host.dockRoot, {
			onQueueItemHold: itemId => host.beginQueueEdit(itemId),
			onScrollToPendingConfirmation: () => host.scrollToFirstPendingConfirmation(),
			showPostFailure: reason => showPostFailure(host, reason),
		}));

		host.composerCluster = append(host.dockRoot, $('.conversation-lens-composer-cluster'));
		host.composer = append(host.composerCluster, $('.conversation-lens-composer'));
		host.composerEditHeader = append(host.composer, $('.conversation-lens-composer-edit-header'));
		host.composerEditHeader.hidden = true;
		host.composerEditTitle = append(host.composerEditHeader, $('span.conversation-lens-composer-edit-title'));
		const exitContainer = append(host.composerEditHeader, $('.conversation-lens-composer-edit-exit'));
		host.composerExitButton = host.register(new Button(exitContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockEditExit,
		}));
		host.composerExitButton.icon = Codicon.close;
		host.composerExitButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost');
		host.register(host.composerExitButton.onDidClick(() => host.exitComposerEdit()));
		const inputRow = append(host.composer, $('.conversation-lens-dock-input-row'));

		host.dockTextarea = append(inputRow, $('textarea.conversation-lens-dock-input')) as HTMLTextAreaElement;
		host.dockTextarea.setAttribute('aria-label', localize('conversationLens.dockInput', "Message"));
		host.dockTextarea.setAttribute('data-testid', 'conversation-composer-input');
		host.dockTextarea.placeholder = conversationLensDockPlaceholder;
		host.dockTextarea.rows = 1;

		const bottomBar = append(host.composer, $('.conversation-lens-dock-bottom-bar'));
		const bottomLeading = append(bottomBar, $('.conversation-lens-dock-bottom-leading'));

		const addContainer = append(bottomLeading, $('.conversation-lens-dock-add'));
		host.addButton = host.register(new Button(addContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockAddTitle,
		}));
		host.addButton.icon = Codicon.add;
		host.addButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--soft');
		host.register(host.addButton.onDidClick(() => host.toggleAddContextView()));

		const tuneContainer = append(bottomLeading, $('.conversation-lens-dock-tune'));
		host.tuneButton = host.register(new Button(tuneContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockTuneTitle,
		}));
		host.tuneButton.icon = Codicon.settingsGear;
		host.tuneButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost');
		host.register(host.tuneButton.onDidClick(() => host.toggleTuneContextView()));

		const permissionContainer = append(bottomLeading, $('.conversation-lens-dock-permission'));
		host.permissionSelectBox = host.register(host.createComposerSelectBox(
			[
				{ text: conversationLensDockPermissionAsk },
				{ text: conversationLensDockPermissionAgent },
				{ text: conversationLensDockPermissionPermit },
			],
			host.getSessionConfig(host.getBoundSessionId()).permissionIndex,
			conversationLensDockPermissionLabel));
		host.permissionSelectBox.render(permissionContainer);
		host.register(host.permissionSelectBox.onDidSelect(e => {
			void applySessionPermissionIndex(host, host.getBoundSessionId(), e.index);
		}));
		updatePermissionSelectEnabled(host);
		host.register(host.stubService.onDidChangeEngineConnection(() => updatePermissionSelectEnabled(host)));
		host.register(host.uaConnection.onDidChangeConnection(() => updatePermissionSelectEnabled(host)));

		host.agentContainer = append(bottomLeading, $('.conversation-lens-dock-agent'));
		host.agentSelectBox = host.register(host.createComposerSelectBox(
			COMPOSER_AGENT_OPTIONS.map(text => ({ text })),
			Math.min(host.getSessionConfig(host.getBoundSessionId()).agentIndex, COMPOSER_AGENT_OPTIONS.length - 1),
			conversationLensDockAgentLabel));
		host.agentSelectBox.render(host.agentContainer);
		host.register(host.agentSelectBox.onDidSelect(e => {
			host.setSessionConfig(host.getBoundSessionId(), { agentIndex: e.index });
		}));

		const moreContainer = append(bottomLeading, $('.conversation-lens-dock-more'));
		host.moreButton = host.register(new Button(moreContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockMoreTitle,
		}));
		host.moreButton.icon = Codicon.ellipsis;
		host.moreButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost');
		host.register(host.moreButton.onDidClick(() => host.toggleMoreContextView()));

		const bottomTrailing = append(bottomBar, $('.conversation-lens-dock-bottom-trailing'));

		const modelContainer = append(bottomTrailing, $('.conversation-lens-dock-model'));
		host.modelSelectBox = host.register(host.createComposerSelectBox(
			[{ text: conversationLensDockNoModel }],
			0,
			localize('conversationLens.dockModelLabel', "Model")));
		host.modelSelectBox.render(modelContainer);
		host.register(host.modelSelectBox.onDidSelect(e => {
			void applySessionModelIndex(host, host.getBoundSessionId(), e.index);
		}));

		const templatesContainer = append(bottomTrailing, $('.conversation-lens-dock-templates'));
		host.templatesButton = host.register(new Button(templatesContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockTemplatesTitle,
		}));
		host.templatesButton.icon = Codicon.notebookTemplate;
		host.templatesButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost');
		host.register(host.templatesButton.onDidClick(() => host.toggleTemplatesContextView()));

		const maximizeInputContainer = append(bottomTrailing, $('.conversation-lens-dock-maximize-input'));
		host.maximizeInputButton = host.register(new Button(maximizeInputContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockMaximizeInput,
		}));
		host.maximizeInputButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost', 'conversation-lens-dock-maximize-input-button');
		host.maximizeInputButton.element.setAttribute('aria-pressed', 'false');
		host.updateMaximizeInputButton();
		host.register(host.maximizeInputButton.onDidClick(() => host.toggleInputMaximized()));

		const sendContainer = append(bottomTrailing, $('.conversation-lens-dock-send'));
		host.sendButton = host.register(new Button(sendContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: localize('conversationLens.send', "Send"),
		}));
		host.sendButton.icon = Codicon.arrowUp;
		host.sendButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--filled', 'conversation-lens-dock-send-button');
		host.sendButton.element.setAttribute('data-testid', 'conversation-composer-send');
		host.sendButton.enabled = false;

		host.register(addStandardDisposableListener(host.dockTextarea, 'keydown', e => {
			if (e.keyCode === KeyCode.Escape && host.composerPolicy !== 'compose') {
				e.preventDefault();
				host.exitComposerEdit();
				return;
			}
			if (e.keyCode === KeyCode.UpArrow) {
				if (host.navigateInputHistory('older')) {
					e.preventDefault();
				}
				return;
			}
			if (e.keyCode === KeyCode.DownArrow) {
				if (host.navigateInputHistory('newer')) {
					e.preventDefault();
				}
				return;
			}
			if (e.keyCode === KeyCode.Escape && host.inputHistoryBrowse.browseIndex >= 0) {
				e.preventDefault();
				host.exitInputHistoryBrowse();
				return;
			}
			if (e.keyCode === KeyCode.Enter) {
				const sendOnEnter = getUaClientKeyboardEnterBehavior(host.configurationService) !== 'newline';
				if (sendOnEnter ? !e.shiftKey : e.shiftKey) {
					e.preventDefault();
					void host.submitDraft();
				}
			}
		}));
		// Capture so fill-without-input automation still submits when Send stays disabled.
		host.register(addDisposableListener(sendContainer, 'click', () => {
			if (host.dockTextarea.value.trim()) {
				void host.submitDraft();
			}
		}, true));
		host.register(host.sendButton.onDidClick(() => void host.submitDraft()));
		host.register(addDisposableListener(host.dockTextarea, 'input', () => {
			if (host.inputHistoryBrowse.browseIndex >= 0) {
				host.inputHistoryBrowse = createInputHistoryBrowseState();
			}
			host.writeComposerDraft(host.getBoundSessionId(), host.dockTextarea.value);
			host.updateSendEnabled();
		}));

		host.updateConversationPhase();
	
}
