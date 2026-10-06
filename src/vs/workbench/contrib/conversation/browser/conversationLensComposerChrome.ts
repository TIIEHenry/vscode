/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, addStandardDisposableListener, append, getWindow } from '../../../../base/browser/dom.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { DisposableStore, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import {
	conversationLensDockEditingMessage,
	conversationLensDockEditingQueued,
	conversationLensDockAgentLabel,
	conversationLensDockNoAgent,
	conversationLensDockMaximizeInput,
	conversationLensDockEngineNotConnected,
	conversationLensDockSessionUnavailable,
	conversationLensDockNoEngineTools,
	conversationLensDockNoTools,
	conversationLensDockMoreTitle,
	conversationLensDockPermissionAgent,
	conversationLensDockPermissionAsk,
	conversationLensDockPermissionLabel,
	conversationLensDockPermissionPermit,
	conversationLensDockRestoreTimeline,
	conversationLensDockSaveQueued,
	conversationLensDockToolsEngineHint,
	conversationLensDockTuneTitle,
	conversationLensPostFailed,
	conversationLensPostFailedChatStreamClosed,
	conversationLensPostFailedDisconnected,
	conversationLensPostFailedMailboxFull,
	conversationLensPostFailedNoSession,
	conversationLensPostFailedNotAuthenticated,
	type ConversationComposerPostFailureReason,
} from './conversationLensDockStrings.js';
import { conversationLensSessionBarTitleEmpty } from './conversationLensSessionBarStrings.js';
import {
	buildSessionUserInputHistory,
	createInputHistoryBrowseState,
	exitInputHistoryBrowse as exitInputHistoryBrowseModel,
	InputHistoryBrowseState,
	InputHistoryDirection,
	inputHistoryCaretAfterRecall,
	inputHistoryCaretAllowsBrowse,
	navigateInputHistoryBrowse,
} from './conversationInputHistory.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { isConversationLeafNarrow } from './conversationNarrowLayout.js';
import { ConversationTimelineHost } from './conversationTimelineHost.js';
import { provideTurnEditComposer } from './conversationTimelineRenderer.js';
import { IConversationRosterService } from './conversationStubService.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { conversationEntryHookPresent } from '../../../../platform/universeAgent/common/universeAgentCapabilities.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { UniverseAgentSessionToolPermissionMode } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { applyComposerSurfaceText, composerDraftText, composerSubmitText, conversationUserBodyText, turnEditLoadedPayload } from './conversationComposerRefs.js';

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
export const conversationLensDockAgentUnavailable = localize(
	'conversationLens.dockAgentUnavailable',
	"Needs an engine connection");
export const conversationLensDockModelUnavailable = localize(
	'conversationLens.dockModelUnavailable',
	"Needs an engine connection");
export const conversationLensDockModelLabel = localize('conversationLens.dockModelLabel', "Model");
export const conversationLensDockModelFailed = localize(
	'conversationLens.dockModelFailed',
	"Model was not applied");

export type ComposerPolicy = 'compose' | 'turnEdit' | 'queueEdit';

export interface ConversationSessionConfigSelection {
	agentIndex: number;
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
	catalogModelIds: readonly string[];
	modelSelectedIndex: number;
	/** Session id → model profile id. Not part of ConversationSessionConfigSelection. */
	modelProfileIdBySessionId?: Map<string, string>;
	modelSelectBox: SelectBox;
	inputHistoryBrowse: InputHistoryBrowseState;
	sessionConfigBySessionId: Map<string, ConversationSessionConfigSelection>;
	tuneContextView: IOpenContextView | undefined;
	moreContextView: IOpenContextView | undefined;
	dockTextarea: HTMLTextAreaElement;
	sendButton: Button;
	tuneButton: Button;
	moreButton: Button;
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
	agentSelectBox: SelectBox;
	permissionSelectBox: SelectBox;
	inboxOverlay: ConversationInboxOverlay;
	timelineTree: ConversationTimelineHost;
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
	isPreFirst(): boolean;
	syncComposerPlacement(): void;
	updateComposerEditChrome(): void;
	ensureComposerInCluster(): void;
}

/** Dock popups only dismissed on outside click; Escape must close them too. */
function registerPopupEscape(container: HTMLElement, close: () => void): IDisposable {
	// Standard listener: e.keyCode is normalized to KeyCode (raw DOM Escape = 27 ≠ KeyCode.Escape).
	return addStandardDisposableListener(container.ownerDocument, 'keydown', e => {
		if (e.keyCode === KeyCode.Escape) {
			e.preventDefault();
			e.stopPropagation();
			close();
		}
	}, true);
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
			const store = new DisposableStore();
			store.add(registerPopupEscape(container, () => host.tuneContextView?.close()));
			if (host.catalogToolNames.length > 0) {
				for (const name of host.catalogToolNames) {
					append(popup, $('div.conversation-lens-dock-tune-tool')).textContent = name;
				}
				append(popup, $('div.conversation-lens-dock-tune-note')).textContent = conversationLensDockToolsEngineHint;
			} else if (isComposerSessionWriteLive(host)) {
				popup.textContent = conversationLensDockNoEngineTools;
			} else {
				popup.textContent = conversationLensDockNoTools;
			}
			return toDisposable(() => {
				store.dispose();
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

function getSelectedAgentName(host: IConversationLensComposerChromeHost): string {
	const select = host.agentContainer?.querySelector('select');
	if (select instanceof HTMLSelectElement && select.selectedIndex >= 0) {
		const text = select.options[select.selectedIndex]?.text.trim();
		if (text) {
			return text;
		}
	}
	return conversationLensDockNoAgent;
}

function appendMoreMenuCurrentAgent(popup: HTMLElement, host: IConversationLensComposerChromeHost): void {
	const agentName = getSelectedAgentName(host);
	const note = append(popup, $('div.conversation-lens-dock-more-agent'));
	note.setAttribute('role', 'note');
	note.setAttribute('aria-label', localize('conversationLens.dockMoreCurrentAgent', "Agent: {0}", agentName));
	note.textContent = agentName;
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
				store.add(registerPopupEscape(container, () => host.moreContextView?.close()));
				const addAction = (label: string, run: () => void) => {
					const item = appendMoreMenuAction(popup, label);
					store.add(addDisposableListener(item, 'click', e => {
						e.preventDefault();
						e.stopPropagation();
						host.moreContextView?.close();
						run();
					}));
				};
				appendMoreMenuCurrentAgent(popup, host);
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
					}
					store.add(addDisposableListener(item, 'click', e => {
						e.preventDefault();
						e.stopPropagation();
						host.moreContextView?.close();
						void applySessionPermissionIndex(host, sessionId, index).catch(onUnexpectedError).catch(onUnexpectedError);
					}));
				}
				addAction(host.inputMaximized ? conversationLensDockRestoreTimeline : conversationLensDockMaximizeInput, () => toggleInputMaximized(host));
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

export function beginTurnEdit(host: IConversationLensComposerChromeHost, turnId: string): void {

		if (isConversationPairingHold(host.uaConnection)) {
			return;
		}
		if (isComposerKeepLeftoverListFailed(host)) {
			return;
		}
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
		host.composeDraftSnapshot = composerDraftText(host);
		host.composerPolicy = 'turnEdit';
		host.editingTurnId = turnId;
		host.editingQueueItemId = undefined;
		applyComposerSurfaceText(host, turn.text);
		provideTurnEditComposer(host.composer);
		host.timelineTree.setEditingTurnId(turnId);
		syncComposerPlacement(host);
		updateComposerEditChrome(host);
		updateSendEnabled(host);
		host.dockTextarea.focus();
	
}

export function beginQueueEdit(host: IConversationLensComposerChromeHost, itemId: string): void {

		if (isConversationPairingHold(host.uaConnection)) {
			return;
		}
		const sessionId = host.getBoundSessionId();
		const item = host.stubService.getMessageQueueState(sessionId).items.find(row => row.id === itemId);
		if (!item) {
			return;
		}
		exitComposerEdit(host, false);
		host.inboxOverlay.closeListPanel();
		host.composeDraftSnapshot = composerDraftText(host);
		host.composerPolicy = 'queueEdit';
		host.editingQueueItemId = itemId;
		host.editingTurnId = undefined;
		provideTurnEditComposer(undefined);
		host.timelineTree.setEditingTurnId(undefined);
		applyComposerSurfaceText(host, item.content);
		syncComposerPlacement(host);
		updateComposerEditChrome(host);
		updateSendEnabled(host);
		host.dockTextarea.focus();
	
}

export function exitComposerEdit(host: IConversationLensComposerChromeHost, restoreComposeDraft = true, releaseQueueHold = true): void {

		if (host.composerPolicy === 'compose') {
			return;
		}
		const sessionId = host.getBoundSessionId();
		const prevPolicy = host.composerPolicy;
		const prevQueueItemId = host.editingQueueItemId;
		host.composerPolicy = 'compose';
		host.editingTurnId = undefined;
		host.editingQueueItemId = undefined;
		if (prevPolicy === 'queueEdit' && prevQueueItemId && releaseQueueHold) {
			host.stubService.releaseMessageQueueItemHold(sessionId, prevQueueItemId);
			host.renderInboxStatus();
		}
		provideTurnEditComposer(undefined);
		host.timelineTree.setEditingTurnId(undefined);
		applyComposerSurfaceText(host, restoreComposeDraft
			? (host.composeDraftSnapshot || host.readComposerDraft(sessionId) || '')
			: '');
		host.composeDraftSnapshot = '';
		syncComposerPlacement(host);
		updateComposerEditChrome(host);
		updateSendEnabled(host);
	
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
			const queuedBody = item ? conversationUserBodyText(item.content) : '';
			host.composerEditTitle.textContent = item && queuedBody
				? `${conversationLensDockEditingQueued} · ${queuedBody}`
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

		if (isConversationPairingHold(host.uaConnection) || isComposerKeepLeftoverListFailed(host)) {
			host.sendButton.enabled = false;
			return;
		}
		const payload = composerSubmitText(host);
		const hasDraft = payload !== undefined;
		if (host.composerPolicy === 'queueEdit') {
			const item = getEditingQueueItem(host);
			const loaded = item ? turnEditLoadedPayload(item.content) : undefined;
			host.sendButton.enabled = hasDraft && !!item && payload !== loaded;
			return;
		}
		if (host.composerPolicy === 'turnEdit') {
			const turn = host.editingTurnId
				? host.stubService.getTurns(host.getBoundSessionId()).find(entry => entry.id === host.editingTurnId && entry.kind === 'user')
				: undefined;
			const loaded = turn ? turnEditLoadedPayload(turn.text) : undefined;
			host.sendButton.enabled = hasDraft && !!turn && payload !== loaded;
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
		// Pairing-hold: transport is not a live engine yet.
		if (isConversationPairingHold(host.uaConnection)) {
			showGateStatus(host, conversationLensDockEngineNotConnected);
			return;
		}
		// KEEP leftover list-fail: Loopback/Direct can still be up. Do not call that "Engine not connected".
		if (isComposerKeepLeftoverListFailed(host)) {
			showGateStatus(host, conversationLensDockSessionUnavailable);
			return;
		}
		// Idle engine/session status lives on the identity strip (PreFirst) or SessionBar badge
		// (Active). Gate is only the transient post-failure notice.
		host.gateRow.hidden = true;
		host.gateLabel.textContent = '';
		host.gateRow.classList.remove('is-error');
		host.gateRow.removeAttribute('role');
		host.gateRow.removeAttribute('aria-label');
		host.gateRow.removeAttribute('title');
		host.gateLabel.removeAttribute('title');
	
}

/** Status gate after idle has stripped role. Not the sticky post-failure alert. */
function showGateStatus(host: IConversationLensComposerChromeHost, message: string): void {

		host.gateRow.hidden = false;
		host.gateRow.classList.remove('is-error');
		host.gateRow.removeAttribute('title');
		host.gateLabel.removeAttribute('title');
		host.gateRow.setAttribute('role', 'status');
		host.gateLabel.textContent = message;
		host.gateRow.setAttribute('aria-label', message);

}

function showGateNotice(host: IConversationLensComposerChromeHost, message: string): void {

		host.postFailureVisible = true;
		host.gateRow.hidden = false;
		host.gateLabel.textContent = message;
		host.gateRow.classList.add('is-error');
		host.gateRow.setAttribute('role', 'alert');
		host.gateRow.setAttribute('aria-label', message);
		host.gateRow.title = message;
		host.gateLabel.title = message;
		if (host.sendFailureTimeout) {
			clearTimeout(host.sendFailureTimeout);
			host.sendFailureTimeout = undefined;
		}

}

export function showPostFailure(host: IConversationLensComposerChromeHost, reason: ConversationComposerPostFailureReason): void {

		const message = reason === 'mailbox_full'
			? conversationLensPostFailedMailboxFull
			: reason === 'not_authenticated'
				? conversationLensPostFailedNotAuthenticated
				: reason === 'chat_stream_closed'
					? conversationLensPostFailedChatStreamClosed
					: reason === 'engine_disconnected'
						? conversationLensPostFailedDisconnected
						: reason === 'empty_session_title'
							? conversationLensSessionBarTitleEmpty
							: reason === 'failed'
								? conversationLensPostFailed
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

export function getSessionConfig(host: IConversationLensComposerChromeHost, sessionId: string): ConversationSessionConfigSelection {

		return host.sessionConfigBySessionId.get(sessionId) ?? { agentIndex: 0, permissionIndex: 0 };
	
}

export function setSessionConfig(host: IConversationLensComposerChromeHost, sessionId: string, patch: Partial<ConversationSessionConfigSelection>): void {

		const current = getSessionConfig(host, sessionId);
		host.sessionConfigBySessionId.set(sessionId, { ...current, ...patch });
	
}

/** KEEP leftover (D450): same predicate as SessionBar D449. List-fail leftover is not a live write surface. */
function isComposerKeepLeftoverListFailed(host: IConversationLensComposerChromeHost): boolean {
	return host.stubService.isEngineConnected()
		&& host.stubService.isEngineSessionReady?.() === false;
}

function isComposerSessionWriteLive(host: IConversationLensComposerChromeHost): boolean {
	return host.stubService.isEngineConnected()
		&& !isConversationPairingHold(host.uaConnection)
		&& !isComposerKeepLeftoverListFailed(host);
}

function syncComposerSelectEnabledChrome(
	selectBox: SelectBox,
	container: HTMLElement | null,
	available: boolean,
	availableLabel: string,
	unavailableLabel: string,
): void {
	selectBox.setEnabled(available);
	selectBox.setAriaLabel(available ? availableLabel : `${availableLabel} — ${unavailableLabel}`);
	if (!container) {
		return;
	}
	container.title = available ? availableLabel : unavailableLabel;
	container.setAttribute('aria-disabled', String(!available));
	const select = container.querySelector('select');
	if (select) {
		select.setAttribute('aria-disabled', String(!available));
	}
}

export function isSessionPermissionModeAvailable(host: IConversationLensComposerChromeHost): boolean {

		return isComposerSessionWriteLive(host) && conversationEntryHookPresent(host.uaConnection.getConnectionSnapshot(), 'setPermissionMode', host.uaConnection.setPermissionMode);
	
}

export function updatePermissionSelectEnabled(host: IConversationLensComposerChromeHost): void {

		if (!host.permissionSelectBox) {
			return;
		}
		const available = isSessionPermissionModeAvailable(host);
		// eslint-disable-next-line no-restricted-syntax -- the permission host is built by the dock, not by this chrome
		const container = host.dockRoot?.querySelector('.conversation-lens-dock-permission') as HTMLElement | null;
		syncComposerSelectEnabledChrome(
			host.permissionSelectBox,
			container,
			available,
			conversationLensDockPermissionLabel,
			conversationLensDockPermissionUnavailable);

	
}

export function isSessionSwitchAgentAvailable(host: IConversationLensComposerChromeHost): boolean {

		return isComposerSessionWriteLive(host) && conversationEntryHookPresent(host.uaConnection.getConnectionSnapshot(), 'switchAgent', (host.uaConnection as { switchAgent?: unknown }).switchAgent);
	
}

export function updateAgentSelectEnabled(host: IConversationLensComposerChromeHost): void {

		if (!host.agentSelectBox) {
			return;
		}
		const available = isSessionSwitchAgentAvailable(host);
		syncComposerSelectEnabledChrome(
			host.agentSelectBox,
			host.agentContainer,
			available,
			conversationLensDockAgentLabel,
			conversationLensDockAgentUnavailable);

	
}

export function updateComposerSessionSelectsEnabled(host: IConversationLensComposerChromeHost): void {

		updatePermissionSelectEnabled(host);
		updateAgentSelectEnabled(host);
		updateModelSelectEnabled(host);
	
}

function restoreSessionPermissionIndex(host: IConversationLensComposerChromeHost, sessionId: string, permissionIndex: number): void {

		setSessionConfig(host, sessionId, { permissionIndex });
		if (host.getBoundSessionId() === sessionId) {
			host.permissionSelectBox.select(permissionIndex);
		}
	
}

export async function applySessionPermissionIndex(host: IConversationLensComposerChromeHost, sessionId: string, permissionIndex: number): Promise<void> {

		const previous = getSessionConfig(host, sessionId).permissionIndex;
		if (permissionIndex === previous) {
			return;
		}
		if (!isSessionPermissionModeAvailable(host) || !host.uaConnection.setPermissionMode) {
			restoreSessionPermissionIndex(host, sessionId, previous);
			return;
		}
		setSessionConfig(host, sessionId, { permissionIndex });
		if (host.getBoundSessionId() === sessionId) {
			host.permissionSelectBox.select(permissionIndex);
		}
		const mode = SESSION_TOOL_PERMISSION_MODES[permissionIndex] ?? SESSION_TOOL_PERMISSION_MODES[0];
		try {
			const result = await host.uaConnection.setPermissionMode({ sessionId, mode });
			// D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live apply.
			if (!isComposerSessionWriteLive(host)) {
				restoreSessionPermissionIndex(host, sessionId, previous);
				return;
			}
			if (result.ok) {
				return;
			}
			restoreSessionPermissionIndex(host, sessionId, previous);
			if (host.getBoundSessionId() === sessionId) {
				showGateNotice(host, result.message?.trim() || conversationLensDockPermissionFailed);
			}
		} catch (error) {
			restoreSessionPermissionIndex(host, sessionId, previous);
			if (host.getBoundSessionId() === sessionId) {
				const detail = error instanceof Error ? error.message.trim() : '';
				showGateNotice(host, detail || conversationLensDockPermissionFailed);
			}
		}
	
}

export function isSessionSwitchModelAvailable(host: IConversationLensComposerChromeHost): boolean {

		return isComposerSessionWriteLive(host) && conversationEntryHookPresent(host.uaConnection.getConnectionSnapshot(), 'switchModel', host.uaConnection.switchModel);
	
}

export function updateModelSelectEnabled(host: IConversationLensComposerChromeHost): void {

		if (!host.modelSelectBox) {
			return;
		}
		const available = isSessionSwitchModelAvailable(host);
		// eslint-disable-next-line no-restricted-syntax -- the model host is built by the dock, not by this chrome
		const container = host.dockRoot?.querySelector('.conversation-lens-dock-model') as HTMLElement | null;
		syncComposerSelectEnabledChrome(
			host.modelSelectBox,
			container,
			available,
			conversationLensDockModelLabel,
			conversationLensDockModelUnavailable);
	
}

export function ensureSessionModelProfileIds(host: { modelProfileIdBySessionId?: Map<string, string> }): Map<string, string> {
	if (!host.modelProfileIdBySessionId) {
		host.modelProfileIdBySessionId = new Map();
	}
	return host.modelProfileIdBySessionId;
}

export function sessionModelProfileId(host: { modelProfileIdBySessionId?: Map<string, string> }, sessionId: string): string {
	return host.modelProfileIdBySessionId?.get(sessionId)?.trim() ?? '';
}

function modelIndexForRecordedId(ids: readonly string[] | undefined, recordedId: string): number {
	if (!recordedId || !ids || ids.length === 0) {
		return 0;
	}
	const found = ids.indexOf(recordedId);
	return found >= 0 ? found : 0;
}

function restoreSessionModelIndex(host: IConversationLensComposerChromeHost, sessionId: string, modelIndex: number, previousId: string): void {
	const map = ensureSessionModelProfileIds(host);
	const trimmed = previousId.trim();
	if (trimmed) {
		map.set(sessionId, trimmed);
	} else {
		map.delete(sessionId);
	}
	if (host.getBoundSessionId() !== sessionId) {
		return;
	}
	host.modelSelectedIndex = modelIndex;
	host.modelSelectBox.select(modelIndex);
	updateSendEnabled(host);
}

export async function applySessionModelIndex(host: IConversationLensComposerChromeHost, sessionId: string, modelIndex: number): Promise<void> {

		const previous = host.modelSelectedIndex;
		if (modelIndex === previous) {
			return;
		}
		const previousId = (host.catalogModelIds[previous] ?? '').trim();
		if (!isSessionSwitchModelAvailable(host) || !host.uaConnection.switchModel) {
			restoreSessionModelIndex(host, sessionId, previous, previousId);
			return;
		}
		if (host.getBoundSessionId() === sessionId) {
			host.modelSelectedIndex = modelIndex;
			host.modelSelectBox.select(modelIndex);
			updateSendEnabled(host);
		}
		const modelId = (host.catalogModelIds[modelIndex] ?? '').trim();
		if (!modelId) {
			restoreSessionModelIndex(host, sessionId, previous, previousId);
			return;
		}
		try {
			const result = await host.uaConnection.switchModel({
				sessionId,
				agentId: '',
				modelType: '',
				modelId,
			});
			// D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live model.
			if (!isComposerSessionWriteLive(host)) {
				restoreSessionModelIndex(host, sessionId, previous, previousId);
				return;
			}
			if (!result.resolvedModelId.trim()) {
				restoreSessionModelIndex(host, sessionId, previous, previousId);
				if (host.getBoundSessionId() === sessionId) {
					showGateNotice(host, conversationLensDockModelFailed);
				}
				return;
			}
			ensureSessionModelProfileIds(host).set(sessionId, modelId);
		} catch (error) {
			restoreSessionModelIndex(host, sessionId, previous, previousId);
			if (host.getBoundSessionId() === sessionId) {
				const detail = error instanceof Error ? error.message.trim() : '';
				showGateNotice(host, detail || conversationLensDockModelFailed);
			}
		}
	
}

export function syncSessionConfigSelects(host: IConversationLensComposerChromeHost, sessionId: string): void {

		const { agentIndex, permissionIndex } = getSessionConfig(host, sessionId);
		host.agentSelectBox.select(agentIndex);
		host.permissionSelectBox.select(permissionIndex);
		const modelIndex = modelIndexForRecordedId(host.catalogModelIds, sessionModelProfileId(host, sessionId));
		host.modelSelectedIndex = modelIndex;
		host.modelSelectBox.select(modelIndex);
	
}

export function updateSessionConfigVisibility(host: IConversationLensComposerChromeHost, preFirst: boolean): void {

		host.agentContainer.hidden = !preFirst;
	
}

export function resetInputHistoryBrowse(host: IConversationLensComposerChromeHost): void {

		host.inputHistoryBrowse = createInputHistoryBrowseState();
	
}

export function getSessionInputHistory(host: IConversationLensComposerChromeHost): readonly string[] {

		return buildSessionUserInputHistory(host.stubService.getTurns(host.getBoundSessionId()));
	
}

export function navigateInputHistory(host: IConversationLensComposerChromeHost, direction: InputHistoryDirection): boolean {

		const textarea = host.dockTextarea;
		const selectionStart = textarea.selectionStart ?? 0;
		const selectionEnd = textarea.selectionEnd ?? selectionStart;
		if (!inputHistoryCaretAllowsBrowse(textarea.value, selectionStart, selectionEnd, direction)) {
			return false;
		}
		const result = navigateInputHistoryBrowse(
			getSessionInputHistory(host),
			host.inputHistoryBrowse,
			direction,
			composerDraftText(host));
		if (!result.handled || result.textareaValue === undefined) {
			return result.handled;
		}
		host.inputHistoryBrowse = result.state;
		applyComposerSurfaceText(host, result.textareaValue);
		const caret = inputHistoryCaretAfterRecall(host.dockTextarea.value, direction);
		host.dockTextarea.selectionStart = caret;
		host.dockTextarea.selectionEnd = caret;
		if (host.composerPolicy === 'compose') {
			host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
		}
		// Arrow recall writes the textarea without an input event. Send follows the same gate as typing.
		updateSendEnabled(host);
		return true;
	
}

export function exitInputHistoryBrowse(host: IConversationLensComposerChromeHost): void {

		const result = exitInputHistoryBrowseModel(host.inputHistoryBrowse);
		if (!result.handled || result.textareaValue === undefined) {
			return;
		}
		host.inputHistoryBrowse = result.state;
		applyComposerSurfaceText(host, result.textareaValue);
		if (host.composerPolicy === 'compose') {
			host.writeComposerDraft(host.getBoundSessionId(), composerDraftText(host));
		}
		updateSendEnabled(host);
	
}
