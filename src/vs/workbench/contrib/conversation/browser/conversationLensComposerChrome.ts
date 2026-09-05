/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, getWindow } from '../../../../base/browser/dom.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import {
	conversationLensDockEditingMessage,
	conversationLensDockEditingQueued,
	conversationLensDockEngineNotConnected,
	conversationLensDockMaximizeInput,
	conversationLensDockNoAttachments,
	conversationLensDockNoEngineTools,
	conversationLensDockNoTemplates,
	conversationLensDockNoTools,
	conversationLensDockPermissionLabel,
	conversationLensDockRestoreTimeline,
	conversationLensDockSaveQueued,
	conversationLensDockTemplatesTitle,
	conversationLensDockToolsEngineHint,
	conversationLensDockTuneTitle,
	conversationLensPostFailedMailboxFull,
	conversationLensPostFailedNoSession,
	conversationLensPostFailedNotAuthenticated,
	conversationLensDockNoRoute,
	conversationLensDockRouteBalanced,
	conversationLensDockRouteQuality,
	conversationLensDockRouteSpeed,
} from './conversationLensDockStrings.js';
import {
	buildSessionUserInputHistory,
	createInputHistoryBrowseState,
	exitInputHistoryBrowse as exitInputHistoryBrowseModel,
	InputHistoryBrowseState,
	InputHistoryDirection,
	navigateInputHistoryBrowse,
} from './conversationInputHistory.js';
import { isConversationLeafNarrow } from './conversationNarrowLayout.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { ConversationTimelineTree } from './conversationTimelineTree.js';
import { ConversationVoiceTranscriptBar } from './conversationVoiceTranscriptBar.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { Button } from '../../../../base/browser/ui/button/button.js';

const COMPOSER_ROUTE_OPTIONS = [
	conversationLensDockNoRoute,
	conversationLensDockRouteBalanced,
	conversationLensDockRouteSpeed,
	conversationLensDockRouteQuality,
] as const;

export type ComposerPolicy = 'compose' | 'turnEdit' | 'queueEdit';

export interface ConversationSessionConfigSelection {
	agentIndex: number;
	routeIndex: number;
}

export interface IConversationLensComposerChromeHost {
	composerPolicy: 'compose' | 'turnEdit' | 'queueEdit';
	editingTurnId: string | undefined;
	editingQueueItemId: string | undefined;
	composeDraftSnapshot: string;
	inputMaximized: boolean;
	postFailureVisible: boolean;
	sendFailureTimeout: ReturnType<typeof setTimeout> | undefined;
	lastReadingWidth: number;
	catalogToolNames: readonly string[];
	modelSelectedIndex: number;
	inputHistoryBrowse: InputHistoryBrowseState;
	sessionConfigBySessionId: Map<string, ConversationSessionConfigSelection>;
	addContextView: IOpenContextView | undefined;
	tuneContextView: IOpenContextView | undefined;
	moreContextView: IOpenContextView | undefined;
	templatesContextView: IOpenContextView | undefined;
	dockTextarea: HTMLTextAreaElement;
	sendButton: Button;
	addButton: Button;
	tuneButton: Button;
	moreButton: Button;
	templatesButton: Button;
	maximizeInputButton: Button;
	gateRow: HTMLElement;
	gateLabel: HTMLElement;
	composerEditHeader: HTMLElement;
	composerEditTitle: HTMLElement;
	composer: HTMLElement;
	composerCluster: HTMLElement;
	prefirstHero: HTMLElement;
	dockRoot: HTMLElement;
	agentContainer: HTMLElement;
	routeContainer: HTMLElement;
	sessionBarRouteContainer: HTMLElement;
	agentSelectBox: SelectBox;
	routeSelectBox: SelectBox;
	sessionBarRouteSelectBox: SelectBox;
	inboxOverlay: ConversationInboxOverlay;
	timelineTree: ConversationTimelineTree;
	voiceTranscriptBar: ConversationVoiceTranscriptBar;
	readonly stubService: IConversationRosterService;
	readonly contextViewService: IContextViewService;
	readonly configurationService: IConfigurationService;
	readonly slotHosts: IConversationLensSlots;
	setInputMaximized(maximized: boolean): void;
	renderInboxStatus(): void;
	readComposerDraft(sessionId: string): string;
	writeComposerDraft(sessionId: string, text: string): void;
	renderVoiceTranscriptBar(): void;
	updateVoiceMicChrome(): void;
	isPreFirst(): boolean;
	syncComposerPlacement(): void;
	updateComposerEditChrome(): void;
	ensureComposerInCluster(): void;
}

export function toggleAddContextView(host: IConversationLensComposerChromeHost): void {

		if (host.addContextView) {
			host.addContextView.close();
			return;
		}
		host.addContextView = host.contextViewService.showContextView({
			getAnchor: () => host.addButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				append(container, $('.conversation-lens-dock-add-popup')).textContent = conversationLensDockNoAttachments;
				return toDisposable(() => {
					host.addContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !host.addButton.element.contains(target)) {
						host.addContextView?.close();
					}
				}
			},
			onHide: () => {
				host.addContextView = undefined;
			},
		});
	
}

export function toggleTuneContextView(host: IConversationLensComposerChromeHost): void {

		if (host.tuneContextView) {
			host.tuneContextView.close();
			return;
		}
		host.tuneContextView = host.contextViewService.showContextView({
			getAnchor: () => host.tuneButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				const popup = append(container, $('.conversation-lens-dock-tune-popup'));
				if (host.stubService.isEngineConnected() && host.catalogToolNames.length > 0) {
					for (const name of host.catalogToolNames) {
						append(popup, $('div.conversation-lens-dock-tune-tool')).textContent = name;
					}
					append(popup, $('div.conversation-lens-dock-tune-note')).textContent = conversationLensDockToolsEngineHint;
				} else if (host.stubService.isEngineConnected()) {
					popup.textContent = conversationLensDockNoEngineTools;
				} else {
					popup.textContent = conversationLensDockNoTools;
				}
				return toDisposable(() => {
					host.tuneContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !host.tuneButton.element.contains(target)) {
						host.tuneContextView?.close();
					}
				}
			},
			onHide: () => {
				host.tuneContextView = undefined;
			},
		});
	
}

export function toggleMoreContextView(host: IConversationLensComposerChromeHost): void {

		if (host.moreContextView) {
			host.moreContextView.close();
			return;
		}
		host.moreContextView = host.contextViewService.showContextView({
			getAnchor: () => host.moreButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				const popup = append(container, $('.conversation-lens-dock-more-popup'));
				if (isConversationLeafNarrow(host.lastReadingWidth)) {
					append(popup, $('div')).textContent = conversationLensDockTuneTitle;
					append(popup, $('div')).textContent = conversationLensDockPermissionLabel;
					append(popup, $('div')).textContent = conversationLensDockTemplatesTitle;
					append(popup, $('div')).textContent = conversationLensDockMaximizeInput;
				}
				append(popup, $('div')).textContent = localize('conversationLens.dockMoreDisplay', "Display");
				append(popup, $('div')).textContent = localize('conversationLens.dockMorePin', "Pin input");
				return toDisposable(() => {
					host.moreContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !host.moreButton.element.contains(target)) {
						host.moreContextView?.close();
					}
				}
			},
			onHide: () => {
				host.moreContextView = undefined;
			},
		});
	
}

export function toggleTemplatesContextView(host: IConversationLensComposerChromeHost): void {

		if (host.templatesContextView) {
			host.templatesContextView.close();
			return;
		}
		host.templatesContextView = host.contextViewService.showContextView({
			getAnchor: () => host.templatesButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				append(container, $('.conversation-lens-dock-templates-popup')).textContent = conversationLensDockNoTemplates;
				return toDisposable(() => {
					host.templatesContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !host.templatesButton.element.contains(target)) {
						host.templatesContextView?.close();
					}
				}
			},
			onHide: () => {
				host.templatesContextView = undefined;
			},
		});
	
}

export function beginTurnEdit(host: IConversationLensComposerChromeHost, turnId: string): void {

		if (host.isPreFirst()) {
			return;
		}
		const sessionId = host.stubService.getActiveSessionId();
		const turn = host.stubService.getTurns(sessionId).find(t => t.id === turnId && t.kind === 'user');
		if (!turn) {
			return;
		}
		exitComposerEdit(host, false);
		host.inboxOverlay.closeListPanel();
		host.composeDraftSnapshot = host.dockTextarea.value;
		host.composerPolicy = 'turnEdit';
		host.editingTurnId = turnId;
		host.editingQueueItemId = undefined;
		host.dockTextarea.value = turn.text;
		host.timelineTree.setEditingTurnId(turnId);
		syncComposerPlacement(host);
		updateComposerEditChrome(host);
		updateSendEnabled(host);
		host.renderVoiceTranscriptBar();
		host.updateVoiceMicChrome();
		host.dockTextarea.focus();
	
}

export function beginQueueEdit(host: IConversationLensComposerChromeHost, itemId: string): void {

		const sessionId = host.stubService.getActiveSessionId();
		const item = host.stubService.getMessageQueueState(sessionId).items.find(row => row.id === itemId);
		if (!item) {
			return;
		}
		exitComposerEdit(host, false);
		host.inboxOverlay.closeListPanel();
		host.composeDraftSnapshot = host.dockTextarea.value;
		host.composerPolicy = 'queueEdit';
		host.editingQueueItemId = itemId;
		host.editingTurnId = undefined;
		host.timelineTree.setEditingTurnId(undefined);
		host.dockTextarea.value = item.content;
		syncComposerPlacement(host);
		updateComposerEditChrome(host);
		updateSendEnabled(host);
		host.renderVoiceTranscriptBar();
		host.updateVoiceMicChrome();
		host.dockTextarea.focus();
	
}

export function exitComposerEdit(host: IConversationLensComposerChromeHost, restoreComposeDraft = true, releaseQueueHold = true): void {

		if (host.composerPolicy === 'compose') {
			return;
		}
		const sessionId = host.stubService.getActiveSessionId();
		if (host.composerPolicy === 'queueEdit' && host.editingQueueItemId && releaseQueueHold) {
			host.stubService.releaseMessageQueueItemHold(sessionId, host.editingQueueItemId);
			host.renderInboxStatus();
		}
		host.composerPolicy = 'compose';
		host.editingTurnId = undefined;
		host.editingQueueItemId = undefined;
		host.timelineTree.setEditingTurnId(undefined);
		host.dockTextarea.value = restoreComposeDraft
			? (host.composeDraftSnapshot || host.readComposerDraft(sessionId) || '')
			: '';
		host.composeDraftSnapshot = '';
		syncComposerPlacement(host);
		updateComposerEditChrome(host);
		updateSendEnabled(host);
		host.renderVoiceTranscriptBar();
		host.updateVoiceMicChrome();
	
}

export function getEditingQueueItem(host: IConversationLensComposerChromeHost) {

		if (!host.editingQueueItemId) {
			return undefined;
		}
		return host.stubService.getMessageQueueState(host.stubService.getActiveSessionId())
			.items.find(item => item.id === host.editingQueueItemId);
	
}

export function updateComposerEditChrome(host: IConversationLensComposerChromeHost): void {

		const isEdit = host.composerPolicy !== 'compose';
		host.composerEditHeader.hidden = !isEdit;
		host.composer.classList.toggle('conversation-lens-composer--edit', isEdit);
		if (host.composerPolicy === 'queueEdit') {
			const item = getEditingQueueItem(host);
			host.composerEditTitle.textContent = item
				? `${conversationLensDockEditingQueued} · ${item.content}`
				: conversationLensDockEditingQueued;
			host.sendButton.setTitle(conversationLensDockSaveQueued);
			host.sendButton.setAriaLabel(conversationLensDockSaveQueued);
			return;
		}
		if (host.composerPolicy === 'turnEdit') {
			host.composerEditTitle.textContent = conversationLensDockEditingMessage;
		}
		const sendTitle = localize('conversationLens.send', "Send");
		host.sendButton.setTitle(sendTitle);
		host.sendButton.setAriaLabel(sendTitle);
	
}

export function syncComposerPlacement(host: IConversationLensComposerChromeHost): void {

		if (host.composerPolicy === 'turnEdit' && host.editingTurnId) {
			ensureComposerInCluster(host);
			host.renderVoiceTranscriptBar();
			const host = host.timelineTree.getTurnEditHost(host.editingTurnId);
			if (host) {
				if (host.composer.parentElement !== host) {
					host.appendChild(host.composer);
				}
				return;
			}
			getWindow(host.composer).requestAnimationFrame(() => syncComposerPlacement(host));
			return;
		}

		ensureComposerInCluster(host);
		host.renderVoiceTranscriptBar();

		if (host.isPreFirst()) {
			if (host.composerCluster.parentElement !== host.prefirstHero) {
				host.prefirstHero.appendChild(host.composerCluster);
			}
			return;
		}

		if (host.composerCluster.parentElement !== host.dockRoot) {
			host.dockRoot.appendChild(host.composerCluster);
		}
	
}

export function ensureComposerInCluster(host: IConversationLensComposerChromeHost): void {

		if (host.composer.parentElement !== host.composerCluster) {
			host.composerCluster.appendChild(host.composer);
		}
	
}

export function toggleInputMaximized(host: IConversationLensComposerChromeHost): void {

		host.setInputMaximized(!host.inputMaximized);
	
}

export function updateMaximizeInputButton(host: IConversationLensComposerChromeHost): void {

		const title = host.inputMaximized ? conversationLensDockRestoreTimeline : conversationLensDockMaximizeInput;
		host.maximizeInputButton.icon = host.inputMaximized ? Codicon.screenNormal : Codicon.screenFull;
		host.maximizeInputButton.setTitle(title);
		host.maximizeInputButton.setAriaLabel(title);
		host.maximizeInputButton.element.setAttribute('aria-pressed', String(host.inputMaximized));
	
}

export function updateSendEnabled(host: IConversationLensComposerChromeHost): void {

		const hasDraft = host.dockTextarea.value.trim().length > 0;
		if (host.composerPolicy === 'queueEdit') {
			const item = getEditingQueueItem(host);
			const changed = !!item && host.dockTextarea.value !== item.content;
			host.sendButton.enabled = hasDraft && changed;
			return;
		}
		if (host.composerPolicy === 'turnEdit') {
			host.sendButton.enabled = hasDraft;
			return;
		}
		const needsStubModel = !host.stubService.isEngineConnected() && host.modelSelectedIndex === 0;
		host.sendButton.enabled = hasDraft && !needsStubModel;
	
}

export function updateGateRow(host: IConversationLensComposerChromeHost): void {

		if (!host.gateRow) {
			return;
		}
		if (host.postFailureVisible) {
			host.gateRow.hidden = false;
			return;
		}
		const connected = host.stubService.isEngineConnected();
		host.gateRow.hidden = connected;
		if (!connected) {
			host.gateLabel.textContent = conversationLensDockEngineNotConnected;
			host.gateRow.setAttribute('aria-label', conversationLensDockEngineNotConnected);
		}
	
}

export function showPostFailure(host: IConversationLensComposerChromeHost, reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated'): void {

		const message = reason === 'mailbox_full'
			? conversationLensPostFailedMailboxFull
			: reason === 'not_authenticated'
				? conversationLensPostFailedNotAuthenticated
				: conversationLensPostFailedNoSession;
		host.postFailureVisible = true;
		host.gateRow.hidden = false;
		host.gateLabel.textContent = message;
		host.gateRow.setAttribute('aria-label', message);
		if (host.sendFailureTimeout) {
			clearTimeout(host.sendFailureTimeout);
		}
		host.sendFailureTimeout = setTimeout(() => {
			host.sendFailureTimeout = undefined;
			host.postFailureVisible = false;
			updateGateRow(host);
		}, 4000);
	
}

export function createComposerSelectBox(host: IConversationLensComposerChromeHost, options: { text: string }[], selectedIndex: number, ariaLabel: string): SelectBox {

		return new SelectBox(
			options,
			selectedIndex,
			host.contextViewService,
			defaultSelectBoxStyles,
			{
				ariaLabel,
				useCustomDrawn: !hasNativeContextMenu(host.configurationService),
			});
	
}

export function createRouteSelectBox(host: IConversationLensComposerChromeHost, selectedIndex: number, ariaLabel: string): SelectBox {

		return createComposerSelectBox(host, 
			COMPOSER_ROUTE_OPTIONS.map(text => ({ text })),
			selectedIndex,
			ariaLabel);
	
}

export function getSessionConfig(host: IConversationLensComposerChromeHost, sessionId: string): ConversationSessionConfigSelection {

		return host.sessionConfigBySessionId.get(sessionId) ?? { agentIndex: 0, routeIndex: 0 };
	
}

export function setSessionConfig(host: IConversationLensComposerChromeHost, sessionId: string, patch: Partial<ConversationSessionConfigSelection>): void {

		const current = getSessionConfig(host, sessionId);
		host.sessionConfigBySessionId.set(sessionId, { ...current, ...patch });
	
}

export function syncSessionConfigSelects(host: IConversationLensComposerChromeHost, sessionId: string): void {

		const { agentIndex, routeIndex } = getSessionConfig(host, sessionId);
		host.agentSelectBox.select(agentIndex);
		host.routeSelectBox.select(routeIndex);
		host.sessionBarRouteSelectBox.select(routeIndex);
	
}

export function updateSessionConfigVisibility(host: IConversationLensComposerChromeHost, preFirst: boolean): void {

		host.agentContainer.hidden = !preFirst;
		host.routeContainer.hidden = !preFirst;
		if (host.sessionBarRouteContainer) {
			host.sessionBarRouteContainer.hidden = preFirst;
		}
	
}

export function resetInputHistoryBrowse(host: IConversationLensComposerChromeHost): void {

		host.inputHistoryBrowse = createInputHistoryBrowseState();
	
}

export function getSessionInputHistory(host: IConversationLensComposerChromeHost): readonly string[] {

		return buildSessionUserInputHistory(host.stubService.getTurns(host.stubService.getActiveSessionId()));
	
}

export function navigateInputHistory(host: IConversationLensComposerChromeHost, direction: InputHistoryDirection): boolean {

		const result = navigateInputHistoryBrowse(
			getSessionInputHistory(host),
			host.inputHistoryBrowse,
			direction,
			host.dockTextarea.value);
		if (!result.handled || result.textareaValue === undefined) {
			return result.handled;
		}
		host.inputHistoryBrowse = result.state;
		host.dockTextarea.value = result.textareaValue;
		host.writeComposerDraft(host.stubService.getActiveSessionId(), result.textareaValue);
		return true;
	
}

export function exitInputHistoryBrowse(host: IConversationLensComposerChromeHost): void {

		const result = exitInputHistoryBrowse(host.inputHistoryBrowse);
		if (!result.handled || result.textareaValue === undefined) {
			return;
		}
		host.inputHistoryBrowse = result.state;
		host.dockTextarea.value = result.textareaValue;
		host.writeComposerDraft(host.stubService.getActiveSessionId(), result.textareaValue);
	
}
