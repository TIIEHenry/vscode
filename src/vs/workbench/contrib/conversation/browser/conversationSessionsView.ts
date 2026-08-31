/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from '../../../../base/browser/dom.js';
import { IListAccessibilityProvider, IListRenderer, IListVirtualDelegate } from '../../../../base/browser/ui/list/list.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { WorkbenchList } from '../../../../platform/list/browser/listService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { ConversationStubSession } from './conversationStubModel.js';
import { IConversationStubService } from './conversationStubService.js';

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

	renderTemplate(container: HTMLElement): ISessionTemplateData {
		const label = dom.append(container, $('.conversation-sessions-item-label'));
		return { container, label };
	}

	renderElement(session: ConversationStubSession, _index: number, templateData: ISessionTemplateData): void {
		templateData.label.textContent = session.title;
	}

	disposeTemplate(): void {
		// noop
	}
}

class SessionsAccessibilityProvider implements IListAccessibilityProvider<ConversationStubSession> {
	getWidgetAriaLabel(): string {
		return localize('conversationSessionsView.ariaLabel', "Conversation Sessions");
	}

	getAriaLabel(session: ConversationStubSession): string {
		return session.title;
	}
}

export class ConversationSessionsView extends ViewPane {

	static readonly ID = CONVERSATION_SESSIONS_VIEW_ID;

	private list: WorkbenchList<ConversationStubSession> | undefined;
	private listContainer: HTMLElement | undefined;

	constructor(
		options: IViewPaneOptions,
		@IConversationStubService private readonly stubService: IConversationStubService,
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

		this._register(this.stubService.onDidChangeActiveSession(() => this.updateSelection()));
		this._register(this.stubService.onDidChangeSession(() => this.refreshList()));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

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

		const delegate = new SessionsDelegate();
		const renderer = new SessionsRenderer();

		this.list = this._register(this.instantiationService.createInstance(
			WorkbenchList,
			'ConversationSessions',
			this.listContainer!,
			delegate,
			[renderer],
			{
				identityProvider: { getId: (session: ConversationStubSession) => session.id },
				accessibilityProvider: new SessionsAccessibilityProvider(),
				openOnSingleClick: true,
			}
		)) as WorkbenchList<ConversationStubSession>;

		this._register(this.list.onDidOpen(e => {
			const session = e.element;
			if (session) {
				this.stubService.switchSession(session.id);
			}
		}));

		return this.list;
	}

	private refreshList(): void {
		if (!this.listContainer) {
			return;
		}

		const list = this.ensureList();
		const sessions = [...this.stubService.getSessions()];
		list.splice(0, list.length, sessions);
		this.updateSelection();
	}

	private updateSelection(): void {
		if (!this.list) {
			return;
		}

		const activeId = this.stubService.getActiveSessionId();
		const index = this.stubService.getSessions().findIndex(session => session.id === activeId);
		if (index >= 0) {
			this.list.setSelection([index]);
			this.list.reveal(index);
		}
	}
}
