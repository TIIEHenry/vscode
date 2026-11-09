/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationSessions.css';
import '../../../browser/media/uaRoundedIcons.css';
import '../../../browser/media/uaRoundedMenus.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListContextMenuEvent, IListRenderer, IListVirtualDelegate, NotSelectableGroupId } from '../../../../base/browser/ui/list/list.js';
import { Action } from '../../../../base/common/actions.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { findLastIdx } from '../../../../base/common/arraysFind.js';
import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ContextKeyExpr, IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { InputFocusedContext } from '../../../../platform/contextkey/common/contextkeys.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { WorkbenchList, WorkbenchListFocusContextKey } from '../../../../platform/list/browser/listService.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IViewPaneOptions, ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { FocusedViewContext } from '../../../common/contextkeys.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { matchesConversationSessionsInlineFilter } from '../common/conversationSessionsInlineFilter.js';
import { ConversationSessionsInlineFilterBox } from './conversationSessionsInlineFilterBox.js';
import { conversationSessionsViewEmptyMessage, conversationSessionsViewNoMatches, formatSessionAccessedLabel, formatSessionMessageCount, formatSessionPendingConfirmations, formatSessionRosterGroupLabel, formatSessionRosterStatus, groupSessionsForRoster, resolveSessionRosterRowChrome, type SessionRosterEntry, type SessionRosterRowChrome } from './conversationSessionsViewStrings.js';
import { ConversationStubSession, ConversationStubTurn } from './conversationStubModel.js';
import { captureConversationDeleteOwner, confirmDeleteConversationSession, guardConversationDeleteConfirmation } from './conversationDeleteSessionConfirm.js';
import { conversationSessionHoldReason, getConversationSessionReadiness, isConversationSessionNotReady } from './conversationSessionAvailability.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { IConversationRosterService } from './conversationStubService.js';

export const CONVERSATION_SESSIONS_VIEW_ID = 'workbench.view.conversationSessions';
export const CONVERSATION_SESSIONS_DELETE_SESSION_COMMAND_ID = 'workbench.action.conversationSessions.deleteSession';
export const CONVERSATION_SESSIONS_DELETE_FOCUSED_SESSION_COMMAND_ID = 'workbench.action.conversationSessions.deleteFocusedSession';

/** Sessions ViewTitle Delete KEEP-chrome — false on leftover-looks-live / pairing-hold / KEEP leftover list-fail. Do not reuse Navigator `UA_ENGINE_CONNECTED_KEY`. */
export const CONVERSATION_SESSIONS_DELETE_ENABLED_KEY = new RawContextKey<boolean>('conversationSessions.deleteEnabled', false);

/** Single-line roster row. Message count sits on the right, not a second line. */
export const CONVERSATION_SESSION_ROW_HEIGHT = 30;
/** Narrow sidebar keeps the same comfortable row and the trailing meta so same-titled sessions stay distinguishable. */
export const CONVERSATION_SESSION_COMPACT_ROW_HEIGHT = 30;

const $ = dom.$;

class SessionsDelegate implements IListVirtualDelegate<SessionRosterEntry> {
	constructor(private readonly isCompact: () => boolean) { }

	getHeight(element: SessionRosterEntry): number {
		if (element.kind === 'header') {
			return 42;
		}
		return this.isCompact() ? CONVERSATION_SESSION_COMPACT_ROW_HEIGHT : CONVERSATION_SESSION_ROW_HEIGHT;
	}

	getTemplateId(element: SessionRosterEntry): string {
		return element.kind === 'header' ? SessionGroupRenderer.TEMPLATE_ID : SessionsRenderer.TEMPLATE_ID;
	}
}

class SessionGroupRenderer implements IListRenderer<SessionRosterEntry, { readonly label: HTMLElement; readonly count: HTMLElement }> {
	static readonly TEMPLATE_ID = 'conversationSessionGroup';

	readonly templateId = SessionGroupRenderer.TEMPLATE_ID;

	renderTemplate(container: HTMLElement): { readonly label: HTMLElement; readonly count: HTMLElement } {
		const row = dom.append(container, $('.conversation-sessions-group'));
		const label = dom.append(row, $('span.conversation-sessions-group-label'));
		const count = dom.append(row, $('span.conversation-sessions-group-count'));
		return { label, count };
	}

	renderElement(entry: SessionRosterEntry, _index: number, templateData: { readonly label: HTMLElement; readonly count: HTMLElement }): void {
		if (entry.kind !== 'header') {
			return;
		}
		templateData.label.textContent = formatSessionRosterGroupLabel(entry.group);
		templateData.count.textContent = String(entry.count);
	}

	disposeTemplate(): void {
		// noop
	}
}

interface ISessionTemplateData {
	readonly container: HTMLElement;
	readonly icon: HTMLElement;
	readonly label: HTMLElement;
	readonly subtitle: HTMLElement;
	readonly more: HTMLButtonElement;
	readonly disposables: DisposableStore;
	session: ConversationStubSession | undefined;
}

function applySessionRosterIcon(icon: HTMLElement, rowChrome: Pick<SessionRosterRowChrome, 'tone' | 'glyph' | 'spin'>): void {
	icon.className = `conversation-sessions-item-icon conversation-sessions-item-icon--${rowChrome.tone}`;
	icon.classList.add(...ThemeIcon.asClassNameArray(rowChrome.glyph));
	icon.classList.toggle('ua-motion', rowChrome.spin);
	icon.classList.toggle('codicon-modifier-spin', rowChrome.spin);
}

class SessionsRenderer implements IListRenderer<SessionRosterEntry, ISessionTemplateData> {
	static readonly TEMPLATE_ID = 'conversationSession';

	readonly templateId = SessionsRenderer.TEMPLATE_ID;
	private readonly templates = new Set<ISessionTemplateData>();

	constructor(
		private readonly getActiveSessionId: () => string,
		private readonly countPendingConfirmations: (sessionId: string) => number,
		private readonly countRosterTurns: (sessionId: string) => number,
		private readonly getTurns: (sessionId: string) => readonly ConversationStubTurn[],
		private readonly hoverService: IHoverService,
		private readonly showMenu: (session: ConversationStubSession, anchor: HTMLElement) => void,
		private readonly getOpenMenuSessionId: () => string | undefined,
	) { }

	syncOpenMenuState(): void {
		const openId = this.getOpenMenuSessionId();
		for (const template of this.templates) {
			if (template.session && template.session.id === openId) {
				template.more.setAttribute('aria-expanded', 'true');
			} else {
				template.more.removeAttribute('aria-expanded');
			}
		}
	}

	renderTemplate(container: HTMLElement): ISessionTemplateData {
		const disposables = new DisposableStore();
		container.classList.add('conversation-sessions-item');
		const row = dom.append(container, $('.conversation-sessions-item-row'));
		const label = dom.append(row, $('.conversation-sessions-item-label'));
		const icon = dom.append(row, $('span.conversation-sessions-item-icon'));
		icon.setAttribute('aria-hidden', 'true');
		const subtitle = dom.append(row, $('.conversation-sessions-item-subtitle'));
		subtitle.setAttribute('aria-hidden', 'true');
		const more = dom.append(row, $('button.conversation-sessions-item-more')) as HTMLButtonElement;
		more.type = 'button';
		more.setAttribute('aria-haspopup', 'menu');
		more.classList.add(...ThemeIcon.asClassNameArray(Codicon.ellipsis));
		const moreLabel = localize('conversationSessionsView.moreActions', "More actions");
		more.setAttribute('aria-label', moreLabel);
		more.title = moreLabel;
		const templateData: ISessionTemplateData = { container, icon, label, subtitle, more, disposables, session: undefined };
		disposables.add(dom.addDisposableListener(more, dom.EventType.MOUSE_DOWN, event => {
			event.preventDefault();
			event.stopPropagation();
		}));
		disposables.add(dom.addDisposableListener(more, dom.EventType.CLICK, event => {
			event.preventDefault();
			event.stopPropagation();
			if (templateData.session) {
				this.showMenu(templateData.session, more);
			}
		}));
		disposables.add(this.hoverService.setupDelayedHover(row, () => ({
			content: this.sessionHover(templateData.session),
		})));
		this.templates.add(templateData);
		return templateData;
	}

	renderElement(entry: SessionRosterEntry, _index: number, templateData: ISessionTemplateData): void {
		if (entry.kind !== 'session') {
			return;
		}
		const session = entry.session;
		templateData.session = session;
		templateData.label.textContent = session.title;
		const active = session.id === this.getActiveSessionId();
		const rowChrome = resolveSessionRosterRowChrome(
			session,
			this.getTurns(session.id),
			this.countPendingConfirmations(session.id),
			active,
		);
		applySessionRosterIcon(templateData.icon, rowChrome);
		templateData.container.dataset.tone = rowChrome.tone;
		templateData.subtitle.textContent = rowChrome.compactSubtitle;
		templateData.subtitle.hidden = !templateData.subtitle.textContent;
		templateData.container.classList.toggle('conversation-sessions-item-active', active);
		if (this.getOpenMenuSessionId() === session.id) {
			templateData.more.setAttribute('aria-expanded', 'true');
		} else {
			templateData.more.removeAttribute('aria-expanded');
		}
	}

	disposeTemplate(templateData: ISessionTemplateData): void {
		this.templates.delete(templateData);
		templateData.disposables.dispose();
	}

	private sessionHover(session: ConversationStubSession | undefined): MarkdownString {
		const markdown = new MarkdownString('', { supportThemeIcons: true });
		if (!session) {
			return markdown;
		}
		const pending = this.countPendingConfirmations(session.id);
		const turnCount = this.countRosterTurns(session.id);
		const rowChrome = resolveSessionRosterRowChrome(
			session,
			this.getTurns(session.id),
			pending,
			session.id === this.getActiveSessionId(),
			turnCount,
		);
		const tone = rowChrome.tone;
		markdown.appendText(session.title);
		const lines: { icon: string; text: string }[] = [];
		if (session.workDir) {
			lines.push({ icon: 'folder', text: session.workDir });
		}
		if (typeof session.lastAccessedAt === 'number') {
			lines.push({ icon: 'history', text: formatSessionAccessedLabel(session.lastAccessedAt) });
		}
		lines.push({ icon: 'comment', text: formatSessionMessageCount(turnCount) });
		const pendingLabel = formatSessionPendingConfirmations(pending);
		if (pendingLabel) {
			lines.push({ icon: 'bell', text: pendingLabel });
		}
		const status = formatSessionRosterStatus(tone);
		if (status) {
			const icon = tone === 'failed' ? 'error' : tone === 'running' ? 'loading' : 'bell';
			lines.push({ icon, text: status });
		}
		for (const line of lines) {
			markdown.appendText('\n');
			markdown.appendMarkdown(`$(${line.icon}) `);
			markdown.appendText(line.text);
		}
		return markdown;
	}
}

class SessionsAccessibilityProvider implements IListAccessibilityProvider<SessionRosterEntry> {
	constructor(
		private readonly getActiveSessionId: () => string,
		private readonly countPendingConfirmations: (sessionId: string) => number,
		private readonly countRosterTurns: (sessionId: string) => number,
		private readonly getTurns: (sessionId: string) => readonly ConversationStubTurn[],
	) { }

	getWidgetAriaLabel(): string {
		return localize('conversationSessionsView.ariaLabel', "Conversation Sessions");
	}

	getAriaLabel(entry: SessionRosterEntry): string {
		if (entry.kind === 'header') {
			return localize('conversationSessionsView.groupAria', "{0}, {1}", formatSessionRosterGroupLabel(entry.group), entry.count);
		}
		const session = entry.session;
		return resolveSessionRosterRowChrome(
			session,
			this.getTurns(session.id),
			this.countPendingConfirmations(session.id),
			session.id === this.getActiveSessionId(),
			this.countRosterTurns(session.id),
		).ariaLabel;
	}
}

export class ConversationSessionsView extends ViewPane {

	static readonly ID = CONVERSATION_SESSIONS_VIEW_ID;

	private list: WorkbenchList<SessionRosterEntry> | undefined;
	private sessionsRenderer: SessionsRenderer | undefined;
	private openMenuSessionId: string | undefined;
	private syncedActiveSessionId: string | undefined;
	private listContainer: HTMLElement | undefined;
	private emptyMessage: HTMLElement | undefined;
	private filterBox: ConversationSessionsInlineFilterBox | undefined;
	private filterQuery = '';
	private readonly deleteEnabledContextKey: IContextKey<boolean>;

	constructor(
		options: IViewPaneOptions,
		@IConversationRosterService private readonly stubService: IConversationRosterService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
		@IConversationSessionWindowService private readonly sessionWindowService: IConversationSessionWindowService,
		@INotificationService private readonly notificationService: INotificationService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IDialogService private readonly dialogService: IDialogService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.deleteEnabledContextKey = CONVERSATION_SESSIONS_DELETE_ENABLED_KEY.bindTo(this.scopedContextKeyService);
		this._register(this.stubService.onDidChangeActiveSession(() => this.refreshList()));
		this._register(this.stubService.onDidChangeSession(() => {
			this.updateDeleteEnabledContextKey();
			this.refreshList();
		}));
		this._register(this.stubService.onDidChangeEngineConnection(() => {
			this.updateDeleteEnabledContextKey();
			this.refreshList();
		}));
		this._register(this.stubService.onDidChangeSessionRosterDetail(() => this.refreshList()));
		this._register(this.uaConnection.onDidChangeConnection(() => this.updateDeleteEnabledContextKey()));
		this.updateDeleteEnabledContextKey();
	}

	/** KEEP leftover list-fail (D453): connected but roster not ready is not a live Sessions write surface. */
	private isKeepLeftoverListFailWrite(): boolean {
		return isConversationSessionNotReady(this.stubService);
	}

	private sessionNotReadyNotice(): string {
		return conversationSessionHoldReason(false, getConversationSessionReadiness(this.stubService)) ?? '';
	}

	private updateDeleteEnabledContextKey(): void {
		const disconnectedAfterHistory = this.stubService.isEngineConnected?.() === false
			&& this.stubService.hasEngineConnectionHistory?.() === true;
		this.deleteEnabledContextKey.set(
			!isConversationPairingHold(this.uaConnection)
			&& !this.isKeepLeftoverListFailWrite()
			&& !disconnectedAfterHistory,
		);
	}

	createNewSession(): void {
		if (isConversationPairingHold(this.uaConnection)) {
			this.notificationService.error(
				localize('conversationSessionsView.createSessionDisconnected', "Could not create session — engine disconnected."),
			);
			return;
		}
		if (this.isKeepLeftoverListFailWrite()) {
			this.notificationService.error(this.sessionNotReadyNotice());
			return;
		}
		if (!this.stubService.isEngineConnected() && this.stubService.hasEngineConnectionHistory()) {
			this.notificationService.error(
				localize('conversationSessionsView.createSessionDisconnected', "Could not create session — engine disconnected."),
			);
			return;
		}
		this.stubService.createSession();
	}

	private rejectDeleteBeforeConfirm(): boolean {
		if (isConversationPairingHold(this.uaConnection)) {
			this.notificationService.error(
				localize('conversationSessionsView.deleteSessionDisconnected', "Could not delete session — engine disconnected."),
			);
			return true;
		}
		if (this.isKeepLeftoverListFailWrite()) {
			this.notificationService.error(this.sessionNotReadyNotice());
			return true;
		}
		if (!this.stubService.isEngineConnected() && this.stubService.hasEngineConnectionHistory()) {
			this.notificationService.error(
				localize('conversationSessionsView.deleteSessionDisconnected', "Could not delete session — engine disconnected."),
			);
			return true;
		}
		return false;
	}

	deleteActiveSession(): Promise<void> {
		return this.deleteSession(this.stubService.getActiveSessionId());
	}

	async deleteFocusedSession(): Promise<void> {
		const entry = this.list?.getFocusedElements()[0];
		if (!entry || entry.kind !== 'session') {
			return;
		}
		const focusedIndex = this.list!.getFocus()[0];
		await this.deleteSession(entry.session.id);
		this.refocusAfterRowDelete(focusedIndex);
	}

	private refocusAfterRowDelete(previousIndex: number | undefined): void {
		if (!this.list || previousIndex === undefined || this.list.getFocus().length > 0 || this.list.length === 0) {
			return;
		}
		const entries = Array.from({ length: this.list.length }, (_, index) => this.list!.element(index));
		const start = Math.min(previousIndex, entries.length - 1);
		let target = entries.findIndex((entry, index) => index >= start && entry.kind === 'session');
		if (target < 0) {
			target = findLastIdx(entries, entry => entry.kind === 'session');
		}
		if (target >= 0) {
			this.list.setFocus([target]);
			this.list.reveal(target);
		}
	}

	async deleteSession(sessionId: string): Promise<void> {
		if (this.rejectDeleteBeforeConfirm()) {
			return;
		}
		const title = this.stubService.getSessions().find(session => session.id === sessionId)?.title ?? '';
		const owner = captureConversationDeleteOwner(this.stubService, this.uaConnection);
		if (!owner || this._store.isDisposed) {
			return;
		}
		const guard = guardConversationDeleteConfirmation(owner, this.stubService, this.uaConnection);
		try {
			const confirmed = await confirmDeleteConversationSession(this.dialogService, title);
			if (!confirmed || this._store.isDisposed || !guard.isCurrent()) {
				return;
			}
		} finally {
			guard.dispose();
		}
		if (this.rejectDeleteBeforeConfirm()) {
			return;
		}
		if (!this.stubService.getSessions().some(session => session.id === sessionId)) {
			return;
		}
		if (this.stubService.deleteSession(sessionId, owner)) {
			return;
		}
		this.notificationService.error(
			!this.stubService.isEngineConnected() && this.stubService.hasEngineConnectionHistory()
				? localize('conversationSessionsView.deleteSessionDisconnected', "Could not delete session — engine disconnected.")
				: localize('conversationSessionsView.deleteSessionFailed', "Could not delete session."),
		);
	}

	openSessionBeside(sessionId: string): void {
		if (!this.stubService.getSessions().some(session => session.id === sessionId)) {
			return;
		}
		if (!this.layoutService.isVisible(Parts.CONVERSATION_PART)) {
			this.layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
		}
		void this.sessionWindowService.openSessionBeside(sessionId).catch(onUnexpectedError);
		this.conversationPartService.focus();
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		container.classList.add('conversation-sessions-body');

		const filterPlaceholder = localize('conversationSessionsFilterPlaceholder', "Filter sessions");
		this.filterBox = this._register(new ConversationSessionsInlineFilterBox(
			container,
			filterPlaceholder,
			filterPlaceholder,
			target => this.focusListFromFilter(target),
		));
		this.filterBox.setVisible(false);
		this._register(this.filterBox.onDidChange(query => {
			this.filterQuery = query;
			this.applyFilterToList();
		}));

		this.emptyMessage = dom.append(container, $('.conversation-sessions-empty'));
		this.emptyMessage.setAttribute('role', 'status');
		this.emptyMessage.setAttribute('aria-live', 'polite');
		this.emptyMessage.textContent = conversationSessionsViewEmptyMessage;

		this.listContainer = dom.append(container, $('.conversation-sessions-list'));
		this.ensureList();
		this.refreshList();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		const wasCompact = this.element.classList.contains('is-compact');
		this.element.classList.toggle('is-narrow', width > 0 && width < 600);
		this.element.classList.toggle('is-compact', width > 0 && width < 300);
		const compactChanged = wasCompact !== this.element.classList.contains('is-compact');
		const hasSessions = this.stubService.getSessions().length > 0;
		const filterHeight = hasSessions ? ConversationSessionsInlineFilterBox.HEIGHT : 0;
		this.list?.layout(height - filterHeight, Math.max(0, width - 16));
		if (compactChanged) {
			this.applyFilterToList();
		}
	}

	private ensureList(): WorkbenchList<SessionRosterEntry> {
		if (this.list) {
			return this.list;
		}

		const getActiveSessionId = () => this.stubService.getActiveSessionId();
		const countPendingConfirmations = (sessionId: string) => this.stubService.countPendingConfirmations(sessionId);
		const getTurns = (sessionId: string) => this.stubService.getTurns(sessionId);
		const countRosterTurns = (sessionId: string) => getTurns(sessionId).length;
		const delegate = new SessionsDelegate(() => this.element.classList.contains('is-compact'));
		const renderer = new SessionsRenderer(
			getActiveSessionId,
			countPendingConfirmations,
			countRosterTurns,
			getTurns,
			this.hoverService,
			(session, anchor) => this.showSessionContextMenu(session, anchor),
			() => this.openMenuSessionId,
		);
		this.sessionsRenderer = renderer;

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'ConversationSessions',
			this.listContainer!,
			delegate,
			[new SessionGroupRenderer(), renderer],
			{
				identityProvider: {
					getId: (entry: SessionRosterEntry) => entry.kind === 'header' ? `header:${entry.group}` : entry.session.id,
					getGroupId: (entry: SessionRosterEntry) => entry.kind === 'header' ? NotSelectableGroupId : 0,
				},
				accessibilityProvider: new SessionsAccessibilityProvider(getActiveSessionId, countPendingConfirmations, countRosterTurns, getTurns),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<SessionRosterEntry>;

		this._register(this.list.onDidOpen(e => this.openSessionFromRoster(e.element, e.browserEvent)));
		this._register(this.list.onContextMenu(e => this.onContextMenu(e)));

		return this.list;
	}

	private onContextMenu(e: IListContextMenuEvent<SessionRosterEntry>): void {
		if (!e.element || e.element.kind !== 'session') {
			return;
		}

		this.showSessionContextMenu(e.element.session, e.anchor);
	}

	private showSessionContextMenu(session: ConversationStubSession, anchor: HTMLElement | IListContextMenuEvent<SessionRosterEntry>['anchor']): void {
		const sessionId = session.id;
		if (this.list) {
			const index = Array.from({ length: this.list.length }, (_, i) => this.list!.element(i))
				.findIndex(entry => entry.kind === 'session' && entry.session.id === sessionId);
			if (index >= 0) {
				this.list.setFocus([index]);
			}
		}
		this.openMenuSessionId = sessionId;
		this.sessionsRenderer?.syncOpenMenuState();
		if (dom.isHTMLElement(anchor) && anchor.classList.contains('conversation-sessions-item-more')) {
			anchor.setAttribute('aria-expanded', 'true');
		}
		this.contextMenuService.showContextMenu({
			getMenuClassName: () => 'ua-rounded-menu ua-session-menu',
			getAnchor: () => anchor,
			onHide: didCancel => {
				if (this.openMenuSessionId === sessionId) {
					this.openMenuSessionId = undefined;
				}
				if (dom.isHTMLElement(anchor)) {
					anchor.removeAttribute('aria-expanded');
				}
				this.sessionsRenderer?.syncOpenMenuState();
				if (didCancel && this.isBodyVisible()) {
					this.list?.domFocus();
				}
			},
			getActions: () => [
				new Action(
					'workbench.action.conversationSessions.openBeside',
					localize('conversationSessionsView.openBeside', "Open beside"),
					undefined,
					true,
					() => this.openSessionBeside(session.id),
				),
				new Action(
					'workbench.action.conversationSessions.deleteSessionRow',
					localize('conversationSessionsView.deleteRow', "Delete"),
					undefined,
					this.deleteEnabledContextKey.get() ?? false,
					() => this.deleteSession(session.id),
				),
			],
		});
	}

	private openSessionFromRoster(entry: SessionRosterEntry | undefined, browserEvent?: UIEvent): void {
		if (!entry || entry.kind !== 'session') {
			return;
		}
		const session = entry.session;
		if (!this.stubService.getSessions().some(s => s.id === session.id)) {
			return;
		}

		if (browserEvent && "altKey" in browserEvent && (browserEvent as MouseEvent).altKey) {
			this.openSessionBeside(session.id);
			return;
		}

		this.stubService.switchSession(session.id);
		if (!this.layoutService.isVisible(Parts.CONVERSATION_PART)) {
			this.layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
		}
		this.conversationPartService.focus();
	}

	override dispose(): void {
		this.list?.dispose();
		this.listContainer?.remove();
		this.emptyMessage?.remove();
		super.dispose();
	}

	private refreshList(): void {
		if (this._store.isDisposed) {
			return;
		}
		this.applyFilterToList();
	}

	private hasActiveFilter(): boolean {
		return this.filterQuery.trim() !== '';
	}

	private getFilteredSessions(): ConversationStubSession[] {
		const sessions = [...this.stubService.getSessions()];
		if (!this.hasActiveFilter()) {
			return sessions;
		}

		const activeId = this.stubService.getActiveSessionId();
		return sessions.filter(session =>
			matchesConversationSessionsInlineFilter(session.title, this.filterQuery)
			|| session.id === activeId);
	}

	private applyFilterToList(): void {
		if (this._store.isDisposed) {
			return;
		}
		if (!this.listContainer || !this.emptyMessage) {
			return;
		}

		const listHadFocus = this.listContainer.contains(this.listContainer.ownerDocument.activeElement);
		const hasSessions = this.stubService.getSessions().length > 0;
		const filtered = hasSessions ? this.getFilteredSessions() : [];
		const filterMiss = hasSessions && this.hasActiveFilter() && filtered.length === 0;
		this.emptyMessage.textContent = filterMiss ? conversationSessionsViewNoMatches : conversationSessionsViewEmptyMessage;
		this.emptyMessage.hidden = hasSessions && !filterMiss;
		this.listContainer.hidden = !hasSessions || filterMiss;
		this.filterBox?.setVisible(hasSessions);
		if (listHadFocus && this.listContainer.hidden && hasSessions) {
			this.filterBox?.focus();
		}

		if (!this.list) {
			return;
		}

		if (!hasSessions || filterMiss) {
			this.list.splice(0, this.list.length, []);
			return;
		}

		const entries = groupSessionsForRoster(filtered);
		this.list.splice(0, this.list.length, entries);
		this.layoutList(entries);
		this.updateActiveSession();
	}

	private getSessionRowHeight(): number {
		return this.element.classList.contains('is-compact')
			? CONVERSATION_SESSION_COMPACT_ROW_HEIGHT
			: CONVERSATION_SESSION_ROW_HEIGHT;
	}

	private layoutList(entries: readonly SessionRosterEntry[]): void {
		if (!this.list || !this.listContainer) {
			return;
		}

		const width = this.listContainer.clientWidth;
		const height = this.listContainer.clientHeight;
		if (width > 0 && height > 0) {
			this.list.layout(height, width);
		} else if (entries.length > 0) {
			const contentHeight = entries.reduce((sum, entry) => sum + (entry.kind === 'header' ? 42 : this.getSessionRowHeight()), 0);
			this.list.layout(contentHeight, 284);
		}
	}

	private focusListFromFilter(target: 'first' | 'current'): boolean {
		if (!this.list || !this.listContainer || this.listContainer.hidden || this.list.length === 0) {
			return false;
		}
		if (target === 'first' || this.list.getFocus().length === 0) {
			const first = Array.from({ length: this.list.length }, (_, index) => this.list!.element(index)).findIndex(entry => entry.kind === 'session');
			if (first >= 0) {
				this.list.setFocus([first]);
				this.list.reveal(first);
			}
		}
		this.list.domFocus();
		return true;
	}

	/** Selection and focus follow the active session only when it changes; data refreshes keep the user's place. */
	private updateActiveSession(): void {
		if (!this.list) {
			return;
		}

		const activeId = this.stubService.getActiveSessionId();
		const index = groupSessionsForRoster(this.getFilteredSessions()).findIndex(entry => entry.kind === 'session' && entry.session.id === activeId);
		const activeChanged = activeId !== this.syncedActiveSessionId;
		if (index >= 0 && index < this.list.length) {
			if (activeChanged) {
				this.syncedActiveSessionId = activeId;
				this.list.setSelection([index]);
				this.list.setFocus([index]);
				this.list.reveal(index);
			} else if (!this.list.getSelection().includes(index)) {
				this.list.setSelection([index]);
			}
		} else if (activeChanged) {
			this.list.setSelection([]);
			this.list.setFocus([]);
		}
		this.list.rerender();
	}
}

registerAction2(class ConversationSessionsNewSessionAction extends ViewAction<ConversationSessionsView> {
	constructor() {
		super({
			id: 'workbench.action.conversationSessions.newSession',
			viewId: CONVERSATION_SESSIONS_VIEW_ID,
			title: localize2('conversationSessionsView.newSession', "New session"),
			icon: Codicon.add,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 1,
				when: ContextKeyExpr.equals('view', CONVERSATION_SESSIONS_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: ConversationSessionsView): void {
		view.createNewSession();
	}
});

registerAction2(class ConversationSessionsDeleteSessionAction extends ViewAction<ConversationSessionsView> {
	constructor() {
		super({
			id: CONVERSATION_SESSIONS_DELETE_SESSION_COMMAND_ID,
			viewId: CONVERSATION_SESSIONS_VIEW_ID,
			title: localize2('conversationSessionsView.deleteSession', "Delete session"),
			icon: Codicon.trash,
			precondition: CONVERSATION_SESSIONS_DELETE_ENABLED_KEY,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 2,
				when: ContextKeyExpr.equals('view', CONVERSATION_SESSIONS_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: ConversationSessionsView): Promise<void> {
		return view.deleteActiveSession();
	}
});

registerAction2(class ConversationSessionsDeleteFocusedSessionAction extends ViewAction<ConversationSessionsView> {
	constructor() {
		super({
			id: CONVERSATION_SESSIONS_DELETE_FOCUSED_SESSION_COMMAND_ID,
			viewId: CONVERSATION_SESSIONS_VIEW_ID,
			title: localize2('conversationSessionsView.deleteFocusedSession', "Delete Focused Session"),
			precondition: CONVERSATION_SESSIONS_DELETE_ENABLED_KEY,
			keybinding: {
				when: ContextKeyExpr.and(FocusedViewContext.isEqualTo(CONVERSATION_SESSIONS_VIEW_ID), WorkbenchListFocusContextKey, InputFocusedContext.toNegated()),
				weight: KeybindingWeight.WorkbenchContrib,
				primary: KeyCode.Delete,
				mac: { primary: KeyMod.CtrlCmd | KeyCode.Backspace, secondary: [KeyCode.Delete] },
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: ConversationSessionsView): Promise<void> {
		return view.deleteFocusedSession();
	}
});
