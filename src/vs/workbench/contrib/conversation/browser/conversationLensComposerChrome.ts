/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, addStandardDisposableListener, append, clearNode } from '../../../../base/browser/dom.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { ISelectBoxOptions, SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { DisposableStore, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextMenuService, IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import {
	conversationLensDockAddTitle,
	conversationLensDockEditingMessage,
	conversationLensDockEditingQueued,
	conversationLensDockAgentLabel,
	conversationLensDockNoAgent,
	conversationLensDockMaximizeInput,
	conversationLensDockEngineNotConnected,
	conversationLensDockSessionUnavailable,
	conversationLensDockSessionUnavailableReason,
	conversationLensDockNoEngineTools,
	conversationLensDockNoTools,
	conversationLensDockMoreTitle,
	conversationLensDockPermissionAgent,
	conversationLensDockPermissionAsk,
	conversationLensDockPermissionLabel,
	conversationLensDockPermissionPermit,
	conversationLensDockRestoreTimeline,
	conversationLensDockSaveQueued,
	conversationLensDockSendBusy,
	conversationLensDockToolsEngineHint,
	conversationLensDockTuneNoMatch,
	conversationLensDockTuneOpenEngine,
	conversationLensDockTuneSearch,
	conversationLensDockTuneTitle,
	conversationLensPostFailed,
	conversationLensPostFailedChatStreamClosed,
	conversationLensPostFailedDisconnected,
	conversationLensPostFailedMailboxFull,
	conversationLensPostFailedNoSession,
	conversationLensPostFailedNotAuthenticated,
	type ConversationComposerPostFailureReason,
} from './conversationLensDockStrings.js';
import { getContextViewEventTarget, isContextViewClick } from './conversationContextViewEvent.js';
import { attachComposerPicker } from './conversationComposerPicker.js';
import { conversationLensSessionBarTitleEmpty } from './conversationLensSessionBarStrings.js';
import { ENGINE_MODELS_ZONE, ENGINE_TOOLS_ZONE, OPEN_ENGINE_PREFERENCES_COMMAND_ID } from '../common/uaPreferencesPanes.js';
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
import { IComposerAddHost, toggleComposerAddContext } from './conversationComposerAt.js';
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

export interface IConversationLensComposerChromeHost extends IComposerAddHost {
	composerPolicy: 'compose' | 'turnEdit' | 'queueEdit';
	submitInFlight?: boolean;
	lastAttachedEntries?: readonly { readonly streaming?: boolean }[];
	hasStreamingEntry?: () => boolean;
	editingTurnId: string | undefined;
	editingQueueItemId: string | undefined;
	composeDraftSnapshot: string;
	inputMaximized: boolean;
	postFailureVisible: boolean;
	sendFailureTimeout: ReturnType<typeof setTimeout> | undefined;
	lastReadingWidth: number;
	catalogToolNames: readonly string[];
	readonly commandService: ICommandService;
	catalogModelIds: readonly string[];
	/** Enabled registry ids from the last successful model list. */
	enabledModelIds?: readonly string[];
	modelSelectedIndex: number;
	/** Session id → model profile id. Not part of ConversationSessionConfigSelection. */
	modelProfileIdBySessionId?: Map<string, string>;
	modelSelectBox: SelectBox;
	inputHistoryBrowse: InputHistoryBrowseState;
	sessionConfigBySessionId: Map<string, ConversationSessionConfigSelection>;
	addButton: Button;
	addContextView: IOpenContextView | undefined;
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
	readonly contextMenuService: IContextMenuService;
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

		if (isComposerKeepLeftoverListFailed(host)) {
			return;
		}
		if (host.tuneContextView) {
			host.tuneContextView.close();
			return;
		}
		host.tuneContextView = host.contextViewService.showContextView({
			getAnchor: () => anchor ?? host.tuneButton.element,
			// Open rightwards so the popup does not spill over the sidebar.
			// The More button sits at the right edge, so that path keeps right alignment.
			anchorAlignment: anchor ? AnchorAlignment.RIGHT : AnchorAlignment.LEFT,
			anchorPosition: AnchorPosition.ABOVE,
		render: container => {
			const popup = append(container, $('.conversation-lens-dock-tune-popup'));
			const store = new DisposableStore();
			store.add(registerPopupEscape(container, () => host.tuneContextView?.close()));
			if (host.catalogToolNames.length > 0) {
				renderTuneToolList(host, popup, store);
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
				if (isContextViewClick(e)) {
					const target = getContextViewEventTarget(e);
					const owner = anchor ?? host.tuneButton.element;
					if (target && !owner.contains(target) && !target.closest('.conversation-lens-dock-tune-popup')) {
						host.tuneContextView?.close();
					}
				}
			},
			onHide: () => {
				host.tuneContextView = undefined;
			},
		});
	
}

/** A short catalog stays a list. A full engine catalog gets a filter so it cannot cover the window. */
const TUNE_TOOL_FILTER_MIN = 9;

function renderTuneToolList(host: IConversationLensComposerChromeHost, popup: HTMLElement, store: DisposableStore): void {
	popup.setAttribute('role', 'dialog');
	popup.setAttribute('aria-label', conversationLensDockTuneTitle);
	const title = append(popup, $('div.conversation-lens-dock-tune-title'));
	title.textContent = conversationLensDockTuneTitle;
	const note = append(popup, $('div.conversation-lens-dock-tune-note'));
	note.textContent = conversationLensDockToolsEngineHint;

	const open = append(popup, $('button.conversation-lens-dock-tune-open')) as HTMLButtonElement;
	open.type = 'button';
	open.textContent = conversationLensDockTuneOpenEngine;
	store.add(addDisposableListener(open, 'click', event => {
		event.preventDefault();
		event.stopPropagation();
		host.tuneContextView?.close();
		void host.commandService.executeCommand(OPEN_ENGINE_PREFERENCES_COMMAND_ID, ENGINE_TOOLS_ZONE).catch(onUnexpectedError).catch(onUnexpectedError);
	}));

	const names = host.catalogToolNames;
	let filter: HTMLInputElement | undefined;
	if (names.length >= TUNE_TOOL_FILTER_MIN) {
		filter = append(popup, $('input.conversation-lens-dock-tune-filter')) as HTMLInputElement;
		filter.type = 'search';
		filter.placeholder = conversationLensDockTuneSearch;
		filter.setAttribute('aria-label', conversationLensDockTuneSearch);
	}

	const list = append(popup, $('div.conversation-lens-dock-tune-list'));
	list.setAttribute('role', 'list');
	const rows = names.map(name => {
		const row = append(list, $('div.conversation-lens-dock-tune-tool'));
		row.setAttribute('role', 'listitem');
		row.title = name;
		row.textContent = name;
		return row;
	});
	const empty = append(popup, $('div.conversation-lens-dock-tune-empty'));
	empty.hidden = true;
	empty.textContent = conversationLensDockTuneNoMatch;

	const applyFilter = () => {
		const query = filter?.value.trim().toLowerCase() ?? '';
		let visible = 0;
		for (const row of rows) {
			const show = query.length === 0 || (row.textContent ?? '').toLowerCase().includes(query);
			row.hidden = !show;
			if (show) {
				visible++;
			}
		}
		empty.hidden = visible > 0;
		list.hidden = visible === 0;
	};
	if (filter) {
		store.add(addDisposableListener(filter, 'input', applyFilter));
	}
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
	return isSessionSwitchAgentAvailable(host) ? conversationLensDockNoAgent : conversationLensDockAgentUnavailable;
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
				addAction(conversationLensDockAddTitle, () => toggleComposerAddContext(host, host.moreButton.element));
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
				if (isContextViewClick(e)) {
					const target = getContextViewEventTarget(e);
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
		provideTurnEditComposer(undefined);
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
		return host.stubService?.getMessageQueueState?.(host.getBoundSessionId())
			?.items.find(item => item.id === host.editingQueueItemId);
	
}

function isComposerEditSurfaceLive(host: IConversationLensComposerChromeHost): boolean {
	if (host.composerPolicy === 'compose') {
		return false;
	}
	if (host.composerPolicy === 'queueEdit') {
		return getEditingQueueItem(host) !== undefined;
	}
	if (host.composerPolicy === 'turnEdit') {
		if (!host.editingTurnId) {
			return false;
		}
		return host.stubService?.getTurns?.(host.getBoundSessionId())
			?.some(entry => entry.id === host.editingTurnId && entry.kind === 'user') ?? true;
	}
	return false;
}

export function updateComposerEditChrome(host: IConversationLensComposerChromeHost): void {

		const isEdit = isComposerEditSurfaceLive(host);
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

export interface IConversationLensComposerSingleLineHost {
	composer: HTMLElement;
	composerCluster: HTMLElement;
	dockRoot: HTMLElement;
	prefirstHero: HTMLElement;
	dockTextarea: HTMLTextAreaElement;
	composerPolicy: ComposerPolicy;
	inputMaximized: boolean;
	lastReadingWidth: number;
	composerRefResources?: readonly unknown[];
	slotHosts?: IConversationLensSlots;
	timelineTree?: {
		isScrolledToBottom?(): boolean;
		scrollToEnd?(): void;
	};
	isPreFirst(): boolean;
}

export function isComposerSingleLine(host: IConversationLensComposerSingleLineHost): boolean {
	if (host.isPreFirst()) {
		return false;
	}
	if (host.composerPolicy !== 'compose') {
		return false;
	}
	if (host.inputMaximized) {
		return false;
	}
	if (host.dockTextarea?.value && host.dockTextarea.value.length > 0) {
		return false;
	}
	if (host.composerRefResources && host.composerRefResources.length > 0) {
		return false;
	}
	if (host.composerCluster?.parentElement !== host.dockRoot || host.composer?.parentElement !== host.composerCluster) {
		return false;
	}
	if (host.lastReadingWidth > 0) {
		if (host.lastReadingWidth < 450) {
			return false;
		}
	} else {
		if (host.slotHosts?.dock?.classList.contains('is-narrow') || host.composer?.closest?.('.is-narrow')) {
			return false;
		}
	}
	return true;
}

export function updateComposerSingleLineLayout(host: IConversationLensComposerSingleLineHost): void {
	if (!host.composer) {
		return;
	}
	const prevSingle = host.composer.classList.contains('is-single-line');
	const nextSingle = isComposerSingleLine(host);
	if (prevSingle === nextSingle) {
		return;
	}
	const wasAtBottom = host.timelineTree?.isScrolledToBottom?.() ?? false;
	host.composer.classList.toggle('is-single-line', nextSingle);
	host.composer.classList.toggle('composer-single-line', nextSingle);
	if (wasAtBottom) {
		host.timelineTree?.scrollToEnd?.();
	}
}

export function syncComposerPlacement(host: IConversationLensComposerChromeHost): void {

		// Turn edit stays on the docked composer. Moving it into the user row
		// took the bottom controls with it.
		ensureComposerInCluster(host);

		if (host.isPreFirst()) {
			if (host.composerCluster.parentElement !== host.prefirstHero) {
				host.prefirstHero.appendChild(host.composerCluster);
			}
			updateComposerSingleLineLayout(host);
			return;
		}

		if (host.composerCluster.parentElement !== host.dockRoot) {
			host.dockRoot.appendChild(host.composerCluster);
		}
		updateComposerSingleLineLayout(host);
	
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

export function isComposerStreaming(host: {
	uaConnection: IUniverseAgentConnection;
	stubService: IConversationRosterService;
	hasStreamingEntry?: () => boolean;
	lastAttachedEntries?: readonly { readonly streaming?: boolean }[];
	getBoundSessionId?: () => string;
}): boolean {
	if (isConversationPairingHold(host.uaConnection)) {
		return false;
	}
	if (!host.stubService.isEngineConnected()) {
		return false;
	}
	if (host.stubService.isEngineSessionReady?.() === false) {
		return false;
	}
	if (host.hasStreamingEntry?.()) {
		return true;
	}
	if (host.lastAttachedEntries?.some(entry => entry.streaming === true)) {
		return true;
	}
	const sessionId = host.getBoundSessionId?.();
	if (sessionId && host.stubService.getTurns?.(sessionId).some(turn => turn.streaming)) {
		return true;
	}
	return false;
}

function setSendButtonCopy(button: { setTitle?(title: string): void; setAriaLabel?(label: string): void }, title: string): void {
	button.setTitle?.(title);
	button.setAriaLabel?.(title);
}

function restoreSendButtonCopy(host: IConversationLensComposerChromeHost): void {
	if (host.composerPolicy === 'queueEdit') {
		setSendButtonCopy(host.sendButton, conversationLensDockSaveQueued);
		return;
	}
	setSendButtonCopy(host.sendButton, localize('conversationLens.send', "Send"));
}

export function updateSendEnabled(host: IConversationLensComposerChromeHost): void {

		if (isConversationPairingHold(host.uaConnection)) {
			host.sendButton.enabled = false;
			setSendButtonCopy(host.sendButton, conversationLensDockEngineNotConnected);
			return;
		}
		if (isComposerKeepLeftoverListFailed(host)) {
			host.sendButton.enabled = false;
			setSendButtonCopy(host.sendButton, `${conversationLensDockSessionUnavailable} — ${conversationLensDockSessionUnavailableReason}`);
			return;
		}
		if (host.submitInFlight || isComposerStreaming(host)) {
			host.sendButton.enabled = false;
			setSendButtonCopy(host.sendButton, conversationLensDockSendBusy);
			return;
		}
		restoreSendButtonCopy(host);
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
		updateComposerSingleLineLayout(host);

}

export function updateGateRow(host: IConversationLensComposerChromeHost): void {

		if (!host.gateRow) {
			return;
		}
		if (host.postFailureVisible) {
			setGateWarning(host, false);
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
			showGateStatus(host, `${conversationLensDockSessionUnavailable} — ${conversationLensDockSessionUnavailableReason}`, true);
			return;
		}
		// Idle engine/session status lives on the identity strip (PreFirst) or SessionBar badge
		// (Active). Gate is only the transient post-failure notice.
		host.gateRow.hidden = true;
		host.gateLabel.textContent = '';
		host.gateRow.classList.remove('is-error');
		setGateWarning(host, false);
		host.gateRow.removeAttribute('role');
		host.gateRow.removeAttribute('aria-label');
		host.gateRow.removeAttribute('title');
		host.gateLabel.removeAttribute('title');
	
}

function setGateWarning(host: IConversationLensComposerChromeHost, warning: boolean): void {
	host.gateRow.classList.toggle('is-warning', warning);
	let icon = host.gateRow.querySelector<HTMLElement>('.conversation-lens-dock-gate-icon');
	if (!icon && warning) {
		icon = $('span.conversation-lens-dock-gate-icon');
		icon.classList.add('codicon', `codicon-${Codicon.warning.id}`);
		icon.setAttribute('aria-hidden', 'true');
		host.gateRow.insertBefore(icon, host.gateLabel);
	}
	if (icon) {
		icon.hidden = !warning;
	}
}

/** Status gate after idle has stripped role. Not the sticky post-failure alert. */
function showGateStatus(host: IConversationLensComposerChromeHost, message: string, warning = false): void {

		host.gateRow.hidden = false;
		host.gateRow.classList.remove('is-error');
		setGateWarning(host, warning);
		host.gateRow.removeAttribute('title');
		host.gateLabel.removeAttribute('title');
		host.gateRow.setAttribute('role', 'status');
		host.gateLabel.textContent = message;
		host.gateRow.setAttribute('aria-label', message);

}

function showGateNotice(host: IConversationLensComposerChromeHost, message: string): void {

		host.postFailureVisible = true;
		host.gateRow.hidden = false;
		setGateWarning(host, false);
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

export type ComposerPickerRole = 'permission' | 'agent' | 'model';

class ComposerSelectBox extends SelectBox {
	constructor(
		options: { text: string }[],
		selectedIndex: number,
		contextViewService: IContextViewService,
		selectBoxOptions: ISelectBoxOptions,
		private readonly attachPicker: (container: HTMLElement) => IDisposable | undefined,
	) {
		super(options, selectedIndex, contextViewService, defaultSelectBoxStyles, selectBoxOptions);
	}

	override render(container: HTMLElement): void {
		super.render(container);
		const picker = this.attachPicker(container);
		if (picker) {
			this._register(picker);
		}
	}
}

export function createComposerSelectBox(host: IConversationLensComposerChromeHost, options: { text: string }[], selectedIndex: number, ariaLabel: string, role?: ComposerPickerRole): SelectBox {
	return new ComposerSelectBox(
		options,
		selectedIndex,
		host.contextViewService,
		{
			ariaLabel,
			useCustomDrawn: !hasNativeContextMenu(host.configurationService),
		},
		container => {
			if (!role) {
				return undefined;
			}
			return attachComposerPicker(container, host.contextViewService, host.contextMenuService, {
				ariaLabel,
				useNativeSelect: hasNativeContextMenu(host.configurationService),
				alignment: role === 'model' ? AnchorAlignment.RIGHT : AnchorAlignment.LEFT,
				footer: role === 'model' ? {
					label: localize('conversationLens.pickerManageModels', "Manage Models…"),
					run: () => {
						void host.commandService.executeCommand(OPEN_ENGINE_PREFERENCES_COMMAND_ID, ENGINE_MODELS_ZONE).catch(onUnexpectedError);
					},
				} : undefined,
			});
		},
	);
}

export function getSessionConfig(host: IConversationLensComposerChromeHost, sessionId: string): ConversationSessionConfigSelection {

		return host.sessionConfigBySessionId.get(sessionId) ?? { agentIndex: 0, permissionIndex: 0 };
	
}

export function setSessionConfig(host: IConversationLensComposerChromeHost, sessionId: string, patch: Partial<ConversationSessionConfigSelection>): void {

		const current = getSessionConfig(host, sessionId);
		host.sessionConfigBySessionId.set(sessionId, { ...current, ...patch });
	
}

/** KEEP leftover (D450): same predicate as SessionBar D449. List-fail leftover is not a live write surface. */
export function isComposerKeepLeftoverListFailed(host: IConversationLensComposerChromeHost): boolean {
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
	// eslint-disable-next-line no-restricted-syntax -- DOM element inspection for aria-disabled sync
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
		syncComposerPermissionWarning(host);
	
}

/** Ask is 0, Agent is 1, Permit is 2. Permit is the open mode. */
const conversationPermissionPermitIndex = 2;

export function syncComposerPermissionWarning(host: IConversationLensComposerChromeHost): void {
	// eslint-disable-next-line no-restricted-syntax -- the permission host is built by the dock, not by this chrome
	const container = host.dockRoot?.querySelector('.conversation-lens-dock-permission') as HTMLElement | null;
	if (!container) {
		return;
	}
	const index = getSessionConfig(host, host.getBoundSessionId()).permissionIndex;
	container.classList.toggle('is-permit', index === conversationPermissionPermitIndex);
}

export function isSessionSwitchAgentAvailable(host: {
	stubService: IConversationRosterService;
	uaConnection: IUniverseAgentConnection;
}): boolean {

		return isComposerSessionWriteLive(host as IConversationLensComposerChromeHost) && conversationEntryHookPresent(host.uaConnection.getConnectionSnapshot(), 'switchAgent', (host.uaConnection as { switchAgent?: unknown }).switchAgent);
	
}

export function updateAgentSelectEnabled(host: IConversationLensComposerChromeHost): void {

		const available = isSessionSwitchAgentAvailable(host);
		if (host.agentContainer) {
			if (!available) {
				host.agentSelectBox?.setEnabled(false);
				clearNode(host.agentContainer);
				const label = append(host.agentContainer, $('span.conversation-lens-dock-agent-readonly'));
				label.textContent = conversationLensDockAgentUnavailable;
				label.setAttribute('aria-label', conversationLensDockAgentUnavailable);
				label.title = conversationLensDockAgentUnavailable;
				return;
			} else {
				// eslint-disable-next-line no-restricted-syntax -- DOM element inspection for selectBox restoration
				if (!host.agentContainer.querySelector('select')) {
					clearNode(host.agentContainer);
					if (host.agentSelectBox) {
						host.agentSelectBox.render(host.agentContainer);
					}
				}
			}
		}
		if (!host.agentSelectBox) {
			return;
		}
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
		if (host.tuneButton) {
			const blocked = isComposerKeepLeftoverListFailed(host);
			host.tuneButton.enabled = !blocked;
			const tune = host.tuneButton as { setTitle?(title: string): void; setAriaLabel?(label: string): void };
			const reason = `${conversationLensDockSessionUnavailable} — ${conversationLensDockSessionUnavailableReason}`;
			tune.setTitle?.(blocked ? reason : conversationLensDockTuneTitle);
			tune.setAriaLabel?.(blocked ? `${conversationLensDockTuneTitle}. ${reason}` : conversationLensDockTuneTitle);
		}
	
}

interface SessionChoiceEpochWait {
	inFlight: boolean;
	waiters: Array<() => void>;
}

interface SessionPermissionEpoch extends SessionChoiceEpochWait {
	generation: number;
	targetIndex: number;
	/** Last mode the engine accepted. Not the optimistic index of an in-flight choice. */
	confirmedIndex: number;
}

interface SessionModelEpoch extends SessionChoiceEpochWait {
	generation: number;
	targetIndex: number;
	targetModelId: string;
	/** Index and id captured when the current target was accepted. */
	rollbackIndex: number;
	rollbackId: string;
}

const sessionPermissionEpochs = new WeakMap<IConversationLensComposerChromeHost, Map<string, SessionPermissionEpoch>>();
const sessionModelEpochs = new WeakMap<IConversationLensComposerChromeHost, Map<string, SessionModelEpoch>>();

function resolveSessionEpochWaiters(waiters: Array<() => void>): void {
	const pending = waiters.splice(0, waiters.length);
	for (const resolve of pending) {
		resolve();
	}
}

function waitForSessionEpochIdle(epoch: SessionChoiceEpochWait): Promise<void> {
	if (!epoch.inFlight) {
		return Promise.resolve();
	}
	return new Promise(resolve => {
		epoch.waiters.push(resolve);
	});
}

function sessionPermissionEpoch(host: IConversationLensComposerChromeHost, sessionId: string): SessionPermissionEpoch {
	let sessions = sessionPermissionEpochs.get(host);
	if (!sessions) {
		sessions = new Map();
		sessionPermissionEpochs.set(host, sessions);
	}
	let epoch = sessions.get(sessionId);
	if (!epoch) {
		const confirmedIndex = getSessionConfig(host, sessionId).permissionIndex;
		epoch = {
			generation: 0,
			targetIndex: confirmedIndex,
			confirmedIndex,
			inFlight: false,
			waiters: [],
		};
		sessions.set(sessionId, epoch);
	}
	return epoch;
}

function sessionModelEpoch(host: IConversationLensComposerChromeHost, sessionId: string): SessionModelEpoch {
	let sessions = sessionModelEpochs.get(host);
	if (!sessions) {
		sessions = new Map();
		sessionModelEpochs.set(host, sessions);
	}
	let epoch = sessions.get(sessionId);
	if (!epoch) {
		epoch = {
			generation: 0,
			targetIndex: host.modelSelectedIndex,
			targetModelId: (host.catalogModelIds[host.modelSelectedIndex] ?? '').trim(),
			rollbackIndex: host.modelSelectedIndex,
			rollbackId: (host.catalogModelIds[host.modelSelectedIndex] ?? '').trim(),
			inFlight: false,
			waiters: [],
		};
		sessions.set(sessionId, epoch);
	}
	return epoch;
}

/**
 * One in-flight setPermissionMode per session. A stale result must not restore
 * or leave its mode on the engine; the newest target is sent next.
 */
async function drainSessionPermission(host: IConversationLensComposerChromeHost, sessionId: string, epoch: SessionPermissionEpoch): Promise<void> {
	const setPermissionMode = host.uaConnection.setPermissionMode;
	if (!setPermissionMode) {
		restoreSessionPermissionIndex(host, sessionId, epoch.confirmedIndex);
		return;
	}
	while (true) {
		const sentGeneration = epoch.generation;
		const sentIndex = epoch.targetIndex;
		const mode = SESSION_TOOL_PERMISSION_MODES[sentIndex] ?? SESSION_TOOL_PERMISSION_MODES[0];
		try {
			const result = await setPermissionMode.call(host.uaConnection, { sessionId, mode });
			if (epoch.generation !== sentGeneration) {
				// Pairing-hold cannot take a correcting write. Leave the newer choice.
				if (!isComposerSessionWriteLive(host)) {
					return;
				}
				// The engine accepted this mode. A later still-latest failure rolls
				// back here, not to the unconfirmed index the next request started from.
				if (result.ok) {
					epoch.confirmedIndex = sentIndex;
				}
				continue;
			}
			// D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live apply.
			if (!isComposerSessionWriteLive(host)) {
				restoreSessionPermissionIndex(host, sessionId, epoch.confirmedIndex);
				return;
			}
			if (result.ok) {
				epoch.confirmedIndex = sentIndex;
				return;
			}
			restoreSessionPermissionIndex(host, sessionId, epoch.confirmedIndex);
			if (host.getBoundSessionId() === sessionId) {
				showGateNotice(host, result.message?.trim() || conversationLensDockPermissionFailed);
			}
			return;
		} catch (error) {
			if (epoch.generation !== sentGeneration) {
				if (!isComposerSessionWriteLive(host)) {
					return;
				}
				continue;
			}
			restoreSessionPermissionIndex(host, sessionId, epoch.confirmedIndex);
			if (host.getBoundSessionId() === sessionId) {
				const detail = error instanceof Error ? error.message.trim() : '';
				showGateNotice(host, detail || conversationLensDockPermissionFailed);
			}
			return;
		}
	}
}

/**
 * One in-flight switchModel per session, separate from permission epochs.
 * A stale result must not restore or keep its modelId.
 */
async function drainSessionModel(host: IConversationLensComposerChromeHost, sessionId: string, epoch: SessionModelEpoch): Promise<void> {
	const switchModel = host.uaConnection.switchModel;
	if (!switchModel) {
		restoreSessionModelIndex(host, sessionId, epoch.rollbackIndex, epoch.rollbackId);
		return;
	}
	while (true) {
		const sentGeneration = epoch.generation;
		const sentIndex = epoch.targetIndex;
		const sentModelId = epoch.targetModelId;
		if (!sentModelId) {
			// Honest empty slot stays a local rollback. Do not call switchModel.
			restoreSessionModelIndex(host, sessionId, epoch.rollbackIndex, epoch.rollbackId);
			return;
		}
		try {
			const result = await switchModel.call(host.uaConnection, {
				sessionId,
				agentId: '',
				modelType: '',
				modelId: sentModelId,
			});
			if (epoch.generation !== sentGeneration) {
				if (!epoch.targetModelId || !isComposerSessionWriteLive(host)) {
					return;
				}
				continue;
			}
			// D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live model.
			if (!isComposerSessionWriteLive(host)) {
				restoreSessionModelIndex(host, sessionId, epoch.rollbackIndex, epoch.rollbackId);
				return;
			}
			if (!result.resolvedModelId.trim()) {
				restoreSessionModelIndex(host, sessionId, epoch.rollbackIndex, epoch.rollbackId);
				if (host.getBoundSessionId() === sessionId) {
					showGateNotice(host, conversationLensDockModelFailed);
				}
				return;
			}
			epoch.rollbackIndex = sentIndex;
			epoch.rollbackId = sentModelId;
			ensureSessionModelProfileIds(host).set(sessionId, sentModelId);
			return;
		} catch (error) {
			if (epoch.generation !== sentGeneration) {
				if (!epoch.targetModelId || !isComposerSessionWriteLive(host)) {
					return;
				}
				continue;
			}
			restoreSessionModelIndex(host, sessionId, epoch.rollbackIndex, epoch.rollbackId);
			if (host.getBoundSessionId() === sessionId) {
				const detail = error instanceof Error ? error.message.trim() : '';
				showGateNotice(host, detail || conversationLensDockModelFailed);
			}
			return;
		}
	}
}

function restoreSessionPermissionIndex(host: IConversationLensComposerChromeHost, sessionId: string, permissionIndex: number): void {
	setSessionConfig(host, sessionId, { permissionIndex });
	if (host.getBoundSessionId() === sessionId) {
		host.permissionSelectBox.select(permissionIndex);
		syncComposerPermissionWarning(host);
	}
}

export async function applySessionPermissionIndex(host: IConversationLensComposerChromeHost, sessionId: string, permissionIndex: number): Promise<void> {
	const epoch = sessionPermissionEpoch(host, sessionId);
	const previous = getSessionConfig(host, sessionId).permissionIndex;
	if (permissionIndex === previous && !epoch.inFlight) {
		return;
	}
	if (!isSessionPermissionModeAvailable(host) || !host.uaConnection.setPermissionMode) {
		if (!epoch.inFlight) {
			restoreSessionPermissionIndex(host, sessionId, previous);
		}
		return;
	}
	if (permissionIndex === previous) {
		return;
	}
	epoch.generation++;
	epoch.targetIndex = permissionIndex;
	setSessionConfig(host, sessionId, { permissionIndex });
	if (host.getBoundSessionId() === sessionId) {
		host.permissionSelectBox.select(permissionIndex);
		syncComposerPermissionWarning(host);
	}
	if (epoch.inFlight) {
		return waitForSessionEpochIdle(epoch);
	}
	epoch.inFlight = true;
	try {
		await drainSessionPermission(host, sessionId, epoch);
	} finally {
		epoch.inFlight = false;
		resolveSessionEpochWaiters(epoch.waiters);
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

function restoreSessionModelIndex(host: IConversationLensComposerChromeHost, sessionId: string, modelIndex: number, previousId: string): void {
	const map = ensureSessionModelProfileIds(host);
	const trimmed = previousId.trim();
	const explicitEmpty = map.has(sessionId) && (map.get(sessionId) ?? '').trim() === '';
	if (trimmed) {
		map.set(sessionId, trimmed);
	} else if (explicitEmpty) {
		map.set(sessionId, '');
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
	const epoch = sessionModelEpoch(host, sessionId);
	const previous = host.modelSelectedIndex;
	const previousId = (host.catalogModelIds[previous] ?? '').trim();
	if (modelIndex === previous && (!epoch.inFlight || epoch.targetIndex === modelIndex)) {
		return;
	}
	if (!isSessionSwitchModelAvailable(host) || !host.uaConnection.switchModel) {
		if (!epoch.inFlight) {
			restoreSessionModelIndex(host, sessionId, previous, previousId);
		}
		return;
	}
	const modelId = (host.catalogModelIds[modelIndex] ?? '').trim();
	if (!modelId) {
		// Honest empty slot: local rollback, no switchModel. A stale flight must not
		// restore its own previous (often 0) over this choice.
		if (epoch.inFlight) {
			epoch.generation++;
			epoch.targetIndex = modelIndex;
			epoch.targetModelId = '';
			epoch.rollbackIndex = previous;
			epoch.rollbackId = previousId;
		}
		restoreSessionModelIndex(host, sessionId, previous, previousId);
		return;
	}
	epoch.generation++;
	epoch.targetIndex = modelIndex;
	epoch.targetModelId = modelId;
	epoch.rollbackIndex = previous;
	epoch.rollbackId = previousId;
	if (host.getBoundSessionId() === sessionId) {
		host.modelSelectedIndex = modelIndex;
		host.modelSelectBox.select(modelIndex);
		updateSendEnabled(host);
	}
	if (epoch.inFlight) {
		return waitForSessionEpochIdle(epoch);
	}
	epoch.inFlight = true;
	try {
		await drainSessionModel(host, sessionId, epoch);
	} finally {
		epoch.inFlight = false;
		resolveSessionEpochWaiters(epoch.waiters);
	}
}

export function syncSessionConfigSelects(host: IConversationLensComposerChromeHost, sessionId: string): void {

		const { agentIndex, permissionIndex } = getSessionConfig(host, sessionId);
		if (isSessionSwitchAgentAvailable(host)) {
			host.agentSelectBox.select(agentIndex);
		}
		host.permissionSelectBox.select(permissionIndex);
		syncComposerPermissionWarning(host);
		const map = ensureSessionModelProfileIds(host);
		const hasRecord = map.has(sessionId);
		const recorded = hasRecord ? sessionModelProfileId(host, sessionId) : '';
		const catalogHasModels = host.catalogModelIds.some(id => id.trim().length > 0);
		let modelIndex = 0;
		if (catalogHasModels) {
			if (recorded) {
				const found = host.catalogModelIds.indexOf(recorded);
				if (found >= 0) {
					modelIndex = found;
				} else {
					const enabledId = (host.enabledModelIds ?? []).find(id => host.catalogModelIds.indexOf(id) >= 0);
					if (enabledId) {
						modelIndex = host.catalogModelIds.indexOf(enabledId);
						map.set(sessionId, enabledId);
					} else {
						modelIndex = 0;
						map.set(sessionId, host.catalogModelIds[0] ?? '');
					}
				}
			} else {
				const enabledId = (host.enabledModelIds ?? []).find(id => host.catalogModelIds.indexOf(id) >= 0);
				if (enabledId) {
					modelIndex = host.catalogModelIds.indexOf(enabledId);
					map.set(sessionId, enabledId);
				} else {
					modelIndex = 0;
					map.set(sessionId, host.catalogModelIds[0] ?? '');
				}
			}
		} else {
			modelIndex = 0;
			if (hasRecord) {
				map.set(sessionId, '');
			}
		}
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
