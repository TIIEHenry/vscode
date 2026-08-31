/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationSessions.css';
import * as dom from '../../../../base/browser/dom.js';
import { IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { IListAccessibilityProvider } from '../../../../base/browser/ui/list/listWidget.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { localize, localize2 } from '../../../../nls.js';
import { MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ContextKeyExpr, IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IViewPaneOptions, ViewAction, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { ConversationStubSession } from './conversationStubModel.js';
import { IConversationRosterService } from './conversationStubService.js';

export const CONVERSATION_SESSIONS_VIEW_ID = 'workbench.view.conversationSessions';

const $ = dom.$;

class SessionsDelegate implements IListVirtualDelegate<ConversationStubSession> {
	getHeight(): number {
		return 22;
	}

	getTemplateId(): string {
		return 'conversationSession';
	}
}

interface ISessionTemplateData {
	readonly container: HTMLElement;
	readonly label: HTMLElement;
}

class SessionsRenderer implements IListRenderer<ConversationStubSession, ISessionTemplateData> {
	static readonly TEMPLATE_ID = 'conversationSession';

	readonly templateId = SessionsRenderer.TEMPLATE_ID;

	constructor(private readonly getActiveSessionId: () => string) { }

	renderTemplate(container: HTMLElement): ISessionTemplateData {
		const label = dom.append(container, $('.conversation-sessions-item-label'));
		return { container, label };
	}

	renderElement(session: ConversationStubSession, _index: number, templateData: ISessionTemplateData): void {
		templateData.label.textContent = session.title;
		const active = session.id === this.getActiveSessionId();
		templateData.container.classList.toggle('conversation-sessions-item-active', active);
	}

	disposeTemplate(): void {
		// noop
	}
}

class SessionsAccessibilityProvider implements IListAccessibilityProvider<ConversationStubSession> {
	constructor(private readonly getActiveSessionId: () => string) { }

	getWidgetAriaLabel(): string {
		return localize('conversationSessionsView.ariaLabel', "Conversation Sessions");
	}

	getAriaLabel(session: ConversationStubSession): string {
		const active = session.id === this.getActiveSessionId();
		return active
			? localize('conversationSessionsView.activeSession', "{0}, active session", session.title)
			: session.title;
	}
}

export class ConversationSessionsView extends ViewPane {

	static readonly ID = CONVERSATION_SESSIONS_VIEW_ID;

	private list: WorkbenchList<ConversationStubSession> | undefined;
	private listContainer: HTMLElement | undefined;
	private emptyMessage: HTMLElement | undefined;

	constructor(
		options: IViewPaneOptions,
		@IConversationRosterService private readonly stubService: IConversationRosterService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this.stubService.onDidChangeActiveSession(() => this.updateActiveSession()));
		this._register(this.stubService.onDidChangeSession(() => this.refreshList()));
	}

	createNewSession(): void {
		this.stubService.createSession();
	}

	deleteActiveSession(): void {
		this.stubService.deleteSession(this.stubService.getActiveSessionId());
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.emptyMessage = dom.append(container, $('.conversation-sessions-empty'));
		this.emptyMessage.textContent = localize(
			'conversationSessionsView.empty',
			"No in-memory sessions — use New session to create a stub conversation.",
		);

		this.listContainer = dom.append(container, $('.conversation-sessions-list'));
		this.ensureList();
		this.refreshList();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.list?.layout(height, width);
	}

	private ensureList(): WorkbenchList<ConversationStubSession> {
		if (this.list) {
			return this.list;
		}

		const getActiveSessionId = () => this.stubService.getActiveSessionId();
		const delegate = new SessionsDelegate();
		const renderer = new SessionsRenderer(getActiveSessionId);

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'ConversationSessions',
			this.listContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (session: ConversationStubSession) => session.id },
				accessibilityProvider: new SessionsAccessibilityProvider(getActiveSessionId),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ConversationStubSession>;

		this._register(this.list.onDidOpen(e => this.openSessionFromRoster(e.element)));

		return this.list;
	}

	private openSessionFromRoster(session: ConversationStubSession | undefined): void {
		if (!session) {
			return;
		}
		if (!this.stubService.getSessions().some(s => s.id === session.id)) {
			return;
		}
		this.stubService.switchSession(session.id);
		if (!this.layoutService.isVisible(Parts.CONVERSATION_PART)) {
			this.layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
		}
		this.conversationPartService.focus();
	}

	private refreshList(): void {
		if (!this.listContainer || !this.emptyMessage) {
			return;
		}

		const sessions = [...this.stubService.getSessions()];
		const hasSessions = sessions.length > 0;
		this.emptyMessage.style.display = hasSessions ? 'none' : 'block';
		this.listContainer.style.display = hasSessions ? 'block' : 'none';

		if (!hasSessions) {
			return;
		}

		const list = this.ensureList();
		list.splice(0, list.length, sessions);
		this.updateActiveSession();
	}

	private updateActiveSession(): void {
		if (!this.list) {
			return;
		}

		const activeId = this.stubService.getActiveSessionId();
		const index = this.stubService.getSessions().findIndex(session => session.id === activeId);
		if (index >= 0) {
			this.list.setSelection([index]);
			this.list.reveal(index);
		} else {
			this.list.setSelection([]);
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
			id: 'workbench.action.conversationSessions.deleteSession',
			viewId: CONVERSATION_SESSIONS_VIEW_ID,
			title: localize2('conversationSessionsView.deleteSession', "Delete session"),
			icon: Codicon.trash,
			menu: {
				id: MenuId.ViewTitle,
				group: 'navigation',
				order: 2,
				when: ContextKeyExpr.equals('view', CONVERSATION_SESSIONS_VIEW_ID),
			},
		});
	}

	override runInView(_accessor: ServicesAccessor, view: ConversationSessionsView): void {
		view.deleteActiveSession();
	}
});
