/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, getWindow } from '../../../../base/browser/dom.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
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
	conversationLensDockMoreTitle,
	conversationLensDockPermissionAgent,
	conversationLensDockPermissionAsk,
	conversationLensDockPermissionLabel,
	conversationLensDockPermissionPermit,
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
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { isConversationLeafNarrow } from './conversationNarrowLayout.js';
import { ConversationTimelineTree } from './conversationTimelineTree.js';
import { ConversationVoiceTranscriptBar } from './conversationVoiceTranscriptBar.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentSessionToolPermissionMode } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { Button } from '../../../../base/browser/ui/button/button.js';

const COMPOSER_PERMISSION_OPTIONS = [
	conversationLensDockPermissionAsk,
	conversationLensDockPermissionAgent,
	conversationLensDockPermissionPermit,
] as const;

const SESSION_TOOL_PERMISSION_MODES: readonly UniverseAgentSessionToolPermissionMode[] = [
	'SESSION_TOOL_PERMISSION_MODE_ASK',
	'SESSION_TOOL_PERMISSION_MODE_AGENT',
	'SESSION_TOOL_PERMISSION_MODE_PERMIT',
];

export const conversationLensDockPermissionUnavailable = localize(
	'conversationLens.dockPermissionUnavailable',
	"Needs an engine connection");
const conversationLensDockPermissionFailed = localize(
	'conversationLens.dockPermissionFailed',
	"Permission mode was not applied");

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
	permissionIndex: number;
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
	permissionSelectBox: SelectBox;
	inboxOverlay: ConversationInboxOverlay;
	timelineTree: ConversationTimelineTree;
	voiceTranscriptBar: ConversationVoiceTranscriptBar;
	readonly stubService: IConversationRosterService;
	readonly uaConnection: IUniverseAgentConnection;
	readonly contextViewService: IContextViewService;
	readonly configurationService: IConfigurationService;
	readonly slotHosts: IConversationLensSlots;
	getBoundSessionId(): string;
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

export function toggleTuneContextView(host: IConversationLensComposerChromeHost, anchor?: HTMLElement): void {

		if (host.tuneContextView) {
			host.tuneContextView.close();
			return;
		}
		host.tuneContextView = host.contextViewService.showContextView({
			getAnchor: () => anchor ?? host.tuneButton.element,
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
					const owner = anchor ?? host.tuneButton.element;
					if (target && !owner.contains(target)) {
						host.tuneContextView?.close();
					}
				}
			},
			onHide: () => {
				host.tuneContextView = undefined;
			},
		});
	
}

function appendMoreMenuAction(popup: HTMLElement, label: string): HTMLButtonElement {
	const item = append(popup, $('button.conversation-lens-dock-more-item')) as HTMLButtonElement;
	item.type = 'button';
	item.setAttribute('role', 'menuitem');
	item.setAttribute('aria-label', label);
	item.textContent = label;
	return item;
}

export function toggleMoreContextView(host: IConversationLensComposerChromeHost): void {

		if (host.moreContextView) {
			host.moreContextView.close();
			return;
		}
		if (!isConversationLeafNarrow(host.lastReadingWidth)) {
			return;
		}
		host.moreContextView = host.contextViewService.showContextView({
			getAnchor: () => host.moreButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				const popup = append(container, $('.conversation-lens-dock-more-popup'));
				popup.setAttribute('role', 'menu');
				popup.setAttribute('aria-label', conversationLensDockMoreTitle);
				const store = new DisposableStore();
				const addAction = (label: string, run: () => void) => {
					const item = appendMoreMenuAction(popup, label);
					store.add(addDisposableListener(item, 'click', e => {
						e.preventDefault();
						e.stopPropagation();
						host.moreContextView?.close();
						run();
					}));
				};
				addAction(conversationLensDockTuneTitle, () => toggleTuneContextView(host, host.moreButton.element));
				const sessionId = host.getBoundSessionId();
				const selectedPermission = getSessionConfig(host, sessionId).permissionIndex;
				const permissionAvailable = isSessionPermissionModeAvailable(host);
				const permissionGroup = append(popup, $('div.conversation-lens-dock-more-permission'));
				permissionGroup.setAttribute('role', 'group');
				permissionGroup.setAttribute('aria-label', conversationLensDockPermissionLabel);
				for (let index = 0; index < COMPOSER_PERMISSION_OPTIONS.length; index++) {
					const item = appendMoreMenuAction(permissionGroup, COMPOSER_PERMISSION_OPTIONS[index]);
					item.setAttribute('role', 'menuitemradio');
					item.setAttribute('aria-checked', String(index === selectedPermission));
					if (!permissionAvailable) {
						item.disabled = true;
						item.setAttribute('aria-disabled', 'true');
						item.title = conversationLensDockPermissionUnavailable;
						item.setAttribute('aria-label', `${COMPOSER_PERMISSION_OPTIONS[index]} — ${conversationLensDockPermissionUnavailable}`);
						continue;
					}
					store.add(addDisposableListener(item, 'click', e => {
						e.preventDefault();
						e.stopPropagation();
						host.moreContextView?.close();
						void applySessionPermissionIndex(host, sessionId, index);
					}));
				}
				addAction(conversationLensDockTemplatesTitle, () => toggleTemplatesContextView(host, host.moreButton.element));
				addAction(conversationLensDockMaximizeInput, () => toggleInputMaximized(host));
				return toDisposable(() => {
					store.dispose();
					host.moreContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && (target.closest('.conversation-lens-dock-more-popup') || host.moreButton.element.contains(target))) {
						return;
					}
					host.moreContextView?.close();
				}
			},
			onHide: () => {
				host.moreContextView = undefined;
			},
		});
	
}

export function toggleTemplatesContextView(host: IConversationLensComposerChromeHost, anchor?: HTMLElement): void {

		if (host.templatesContextView) {
			host.templatesContextView.close();
			return;
		}
		host.templatesContextView = host.contextViewService.showContextView({
			getAnchor: () => anchor ?? host.templatesButton.element,
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
					const owner = anchor ?? host.templatesButton.element;
					if (target && !owner.contains(target)) {
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
		const sessionId = host.getBoundSessionId();
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

		const sessionId = host.getBoundSessionId();
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
		const sessionId = host.getBoundSessionId();
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
		return host.stubService.getMessageQueueState(host.getBoundSessionId())
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
			const editHost = host.timelineTree.getTurnEditHost(host.editingTurnId);
			if (editHost) {
				if (host.composer.parentElement !== editHost) {
					editHost.appendChild(host.composer);
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
		host.sendButton.enabled = hasDraft;
	
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

function showGateNotice(host: IConversationLensComposerChromeHost, message: string): void {

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

export function showPostFailure(host: IConversationLensComposerChromeHost, reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated'): void {

		const message = reason === 'mailbox_full'
			? conversationLensPostFailedMailboxFull
			: reason === 'not_authenticated'
				? conversationLensPostFailedNotAuthenticated
				: conversationLensPostFailedNoSession;
		showGateNotice(host, message);
	
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

		return host.sessionConfigBySessionId.get(sessionId) ?? { agentIndex: 0, routeIndex: 0, permissionIndex: 0 };
	
}

export function setSessionConfig(host: IConversationLensComposerChromeHost, sessionId: string, patch: Partial<ConversationSessionConfigSelection>): void {

		const current = getSessionConfig(host, sessionId);
		host.sessionConfigBySessionId.set(sessionId, { ...current, ...patch });
	
}

export function isSessionPermissionModeAvailable(host: IConversationLensComposerChromeHost): boolean {

		return host.stubService.isEngineConnected() && typeof host.uaConnection.setPermissionMode === 'function';
	
}

export function updatePermissionSelectEnabled(host: IConversationLensComposerChromeHost): void {

		if (!host.permissionSelectBox) {
			return;
		}
		const available = isSessionPermissionModeAvailable(host);
		host.permissionSelectBox.setEnabled(available);
		const label = available
			? conversationLensDockPermissionLabel
			: `${conversationLensDockPermissionLabel} — ${conversationLensDockPermissionUnavailable}`;
		host.permissionSelectBox.setAriaLabel(label);
		const container = host.dockRoot?.querySelector('.conversation-lens-dock-permission') as HTMLElement | null;
		if (container) {
			container.title = available ? conversationLensDockPermissionLabel : conversationLensDockPermissionUnavailable;
		}
	
}

function restoreSessionPermissionIndex(host: IConversationLensComposerChromeHost, sessionId: string, permissionIndex: number): void {

		setSessionConfig(host, sessionId, { permissionIndex });
		host.permissionSelectBox.select(permissionIndex);
	
}

export async function applySessionPermissionIndex(host: IConversationLensComposerChromeHost, sessionId: string, permissionIndex: number): Promise<void> {

		const previous = getSessionConfig(host, sessionId).permissionIndex;
		if (permissionIndex === previous) {
			return;
		}
		if (!isSessionPermissionModeAvailable(host) || !host.uaConnection.setPermissionMode) {
			return;
		}
		setSessionConfig(host, sessionId, { permissionIndex });
		host.permissionSelectBox.select(permissionIndex);
		const mode = SESSION_TOOL_PERMISSION_MODES[permissionIndex] ?? SESSION_TOOL_PERMISSION_MODES[0];
		try {
			const result = await host.uaConnection.setPermissionMode({ sessionId, mode });
			if (result.ok) {
				return;
			}
			restoreSessionPermissionIndex(host, sessionId, previous);
			showGateNotice(host, result.message?.trim() || conversationLensDockPermissionFailed);
		} catch (error) {
			restoreSessionPermissionIndex(host, sessionId, previous);
			const detail = error instanceof Error ? error.message.trim() : '';
			showGateNotice(host, detail || conversationLensDockPermissionFailed);
		}
	
}

export function syncSessionConfigSelects(host: IConversationLensComposerChromeHost, sessionId: string): void {

		const { agentIndex, routeIndex, permissionIndex } = getSessionConfig(host, sessionId);
		host.agentSelectBox.select(agentIndex);
		host.routeSelectBox.select(routeIndex);
		host.sessionBarRouteSelectBox?.select(routeIndex);
		host.permissionSelectBox.select(permissionIndex);
	
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

		return buildSessionUserInputHistory(host.stubService.getTurns(host.getBoundSessionId()));
	
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
		host.writeComposerDraft(host.getBoundSessionId(), result.textareaValue);
		return true;
	
}

export function exitInputHistoryBrowse(host: IConversationLensComposerChromeHost): void {

		const result = exitInputHistoryBrowseModel(host.inputHistoryBrowse);
		if (!result.handled || result.textareaValue === undefined) {
			return;
		}
		host.inputHistoryBrowse = result.state;
		host.dockTextarea.value = result.textareaValue;
		host.writeComposerDraft(host.getBoundSessionId(), result.textareaValue);
	
}
