/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationSessionWindow.css';
import { $, append } from '../../../../base/browser/dom.js';
import { ActionBar } from '../../../../base/browser/ui/actionbar/actionbar.js';
import { Action } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { getErrorMessage } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import {
	CONVERSATION_SESSION_WINDOW_MAX_LEAVES,
	conversationSessionLeafHiddenClass,
} from '../common/conversationSessionWindow.js';
import { IConversationRosterService } from './conversationStubService.js';

export const IConversationSessionWindowService = createDecorator<IConversationSessionWindowService>('conversationSessionWindowService');

const sessionWindowHideIcon = registerIcon(
	'conversation-session-window-hide',
	Codicon.remove,
	localize('conversationSessionWindowHideIcon', 'Icon to hide a parallel conversation session window.'),
);

export interface IConversationSessionLeafSlots {
	readonly sessionKey: string;
	readonly container: HTMLElement;
	readonly sessionWindow: HTMLElement;
	readonly editorPartHost: HTMLElement;
}

export interface IConversationSessionWindowService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeVisibleWindows: Event<void>;

	getVisibleSessionKeys(): readonly string[];
	getVisibleWindowCount(): number;
	isSessionWindowVisible(sessionKey: string): boolean;
	isSessionWindowHidden(sessionKey: string): boolean;
	getPrimarySessionKey(): string | undefined;

	getLeafSlots(sessionKey: string): IConversationSessionLeafSlots | undefined;

	getAllLeafSessionKeys(): readonly string[];

	ensurePrimaryWindow(sessionKey: string): Promise<void>;
	openSessionBeside(sessionKey: string): Promise<void>;
	hideSessionWindow(sessionKey: string): void;
	restoreSessionWindow(sessionKey: string): void;
}

interface IConversationSessionLeaf extends IConversationSessionLeafSlots {
	hidden: boolean;
}

export class ConversationSessionWindowService extends Disposable implements IConversationSessionWindowService {

	declare readonly _serviceBrand: undefined;

	private gridHost: HTMLElement | undefined;
	private primarySessionKey: string | undefined;
	private primaryBootstrapInFlight: Promise<void> | undefined;
	private readonly leaves = new Map<string, IConversationSessionLeaf>();
	private readonly leafOrder: string[] = [];

	private readonly _onDidChangeVisibleWindows = this._register(new Emitter<void>());
	readonly onDidChangeVisibleWindows = this._onDidChangeVisibleWindows.event;

	constructor(
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@ILogService private readonly logService: ILogService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();

		const slots = this.conversationPartService.getSlots();
		if (slots) {
			this.attachGrid(slots.sessionWindowGrid);
		} else {
			this._register(this.conversationPartService.onDidCreateSlots(({ sessionWindowGrid }) => this.attachGrid(sessionWindowGrid)));
		}

		this._register(this.rosterService.onDidChangeActiveSession(sessionKey => {
			void this.ensurePrimaryWindow(sessionKey);
		}));
	}

	getVisibleSessionKeys(): readonly string[] {
		return this.leafOrder.filter(sessionKey => {
			const leaf = this.leaves.get(sessionKey);
			return leaf && !leaf.hidden;
		});
	}

	getVisibleWindowCount(): number {
		return this.getVisibleSessionKeys().length;
	}

	isSessionWindowVisible(sessionKey: string): boolean {
		const leaf = this.leaves.get(sessionKey);
		return !!leaf && !leaf.hidden;
	}

	isSessionWindowHidden(sessionKey: string): boolean {
		const leaf = this.leaves.get(sessionKey);
		return !!leaf && leaf.hidden;
	}

	getPrimarySessionKey(): string | undefined {
		return this.primarySessionKey;
	}

	getLeafSlots(sessionKey: string): IConversationSessionLeafSlots | undefined {
		return this.leaves.get(sessionKey);
	}

	getAllLeafSessionKeys(): readonly string[] {
		return [...this.leafOrder];
	}

	async ensurePrimaryWindow(sessionKey: string): Promise<void> {
		if (!this.gridHost || this.primarySessionKey) {
			return;
		}

		if (this.primaryBootstrapInFlight) {
			await this.primaryBootstrapInFlight;
			return;
		}

		const bootstrap = this.tryBootstrapPrimaryWindow(sessionKey);
		this.primaryBootstrapInFlight = bootstrap;
		try {
			await bootstrap;
		} finally {
			if (this.primaryBootstrapInFlight === bootstrap) {
				this.primaryBootstrapInFlight = undefined;
			}
		}
	}

	async openSessionBeside(sessionKey: string): Promise<void> {
		if (!this.gridHost) {
			return;
		}

		await this.ensurePrimaryWindow(this.primarySessionKey ?? this.rosterService.getActiveSessionId());

		const primaryKey = this.getPrimarySessionKey();
		if (!primaryKey || !this.getLeafSlots(primaryKey)) {
			return;
		}

		const existing = this.leaves.get(sessionKey);
		if (existing) {
			if (existing.hidden) {
				this.restoreSessionWindow(sessionKey);
			}
			return;
		}

		let evictedSecondaryKey: string | undefined;
		const visibleKeys = this.getVisibleSessionKeys();
		if (visibleKeys.length >= CONVERSATION_SESSION_WINDOW_MAX_LEAVES) {
			const secondaryKey = visibleKeys.find(key => key !== this.primarySessionKey);
			if (secondaryKey) {
				this.hideSessionWindow(secondaryKey);
				evictedSecondaryKey = secondaryKey;
			}
		}

		try {
			await this.ensureLeaf(sessionKey, { primary: false });
			this.fireVisibleWindowsChange();
		} catch (error) {
			this.rollbackHalfAppliedLeaf(sessionKey);
			if (evictedSecondaryKey) {
				this.restoreSessionWindow(evictedSecondaryKey);
			}
			this.logService.warn(`[ConversationSessionWindowService] openSessionBeside failed: ${getErrorMessage(error)}`);
			this.notificationService.error(getErrorMessage(error));
		}
	}

	hideSessionWindow(sessionKey: string): void {
		if (sessionKey === this.primarySessionKey) {
			return;
		}

		const leaf = this.leaves.get(sessionKey);
		if (!leaf || leaf.hidden) {
			return;
		}

		leaf.hidden = true;
		leaf.container.classList.add(conversationSessionLeafHiddenClass);
		leaf.container.setAttribute('aria-hidden', 'true');
		this.fireVisibleWindowsChange();
	}

	restoreSessionWindow(sessionKey: string): void {
		const leaf = this.leaves.get(sessionKey);
		if (!leaf || !leaf.hidden) {
			return;
		}

		const visibleOthers = this.getVisibleSessionKeys().filter(key => key !== sessionKey);
		if (visibleOthers.length >= CONVERSATION_SESSION_WINDOW_MAX_LEAVES) {
			for (const otherKey of visibleOthers) {
				if (otherKey !== this.primarySessionKey) {
					this.hideSessionWindow(otherKey);
					break;
				}
			}
		}

		leaf.hidden = false;
		leaf.container.classList.remove(conversationSessionLeafHiddenClass);
		leaf.container.removeAttribute('aria-hidden');
		this.fireVisibleWindowsChange();
	}

	private attachGrid(gridHost: HTMLElement): void {
		if (this.gridHost) {
			return;
		}
		this.gridHost = gridHost;
		void this.ensurePrimaryWindow(this.rosterService.getActiveSessionId());
	}

	private async ensureLeaf(sessionKey: string, options: { primary: boolean }): Promise<IConversationSessionLeaf> {
		let leaf = this.leaves.get(sessionKey);
		if (leaf) {
			if (leaf.hidden) {
				this.restoreSessionWindow(sessionKey);
			}
			return leaf;
		}

		const container = append(this.gridHost!, $('.conversation-session-leaf'));
		container.dataset.sessionKey = sessionKey;
		if (options.primary) {
			container.classList.add('conversation-session-leaf-primary');
		} else {
			container.classList.add('conversation-session-leaf-secondary');
			this.mountSecondaryChrome(container, sessionKey);
		}

		const sessionWindow = append(container, $('.conversation-session-window'));
		const editorPartHost = append(sessionWindow, $('.conversation-editor-part-container.part.editor'));

		leaf = {
			sessionKey,
			container,
			sessionWindow,
			editorPartHost,
			hidden: false,
		};
		this.leaves.set(sessionKey, leaf);

		if (!this.leafOrder.includes(sessionKey)) {
			this.leafOrder.push(sessionKey);
		}

		this.editorGroupsService.createConversationEditorPart(editorPartHost, sessionKey);
		const part = this.editorGroupsService.conversationParts.find(candidate => candidate.sessionKey === sessionKey);
		if (part) {
			await part.whenReady;
		}

		return leaf;
	}

	private mountSecondaryChrome(container: HTMLElement, sessionKey: string): void {
		const chrome = append(container, $('.conversation-session-leaf-chrome'));
		const title = append(chrome, $('.conversation-session-leaf-title'));
		const updateTitle = () => {
			const session = this.rosterService.getSessions().find(item => item.id === sessionKey);
			title.textContent = session?.title ?? sessionKey;
		};
		updateTitle();
		this._register(this.rosterService.onDidChangeSession(changedId => {
			if (changedId === sessionKey) {
				updateTitle();
			}
		}));

		const actionsContainer = append(chrome, $('.conversation-session-leaf-actions'));
		const actionBar = new ActionBar(actionsContainer);
		this._register(actionBar);
		const hideAction = new Action(
			`workbench.action.conversation.hideSessionWindow.${sessionKey}`,
			localize('hideConversationSessionWindow', "Hide session window"),
			ThemeIcon.asClassName(sessionWindowHideIcon),
			true,
			() => this.hideSessionWindow(sessionKey),
		);
		hideAction.tooltip = localize('hideConversationSessionWindow', "Hide session window");
		this._register(hideAction);
		actionBar.push(hideAction, { icon: true, label: false });
		actionBar.setFocusable(false);
	}

	private async tryBootstrapPrimaryWindow(sessionKey: string): Promise<void> {
		try {
			await this.ensureLeaf(sessionKey, { primary: true });
			this.primarySessionKey = sessionKey;
			this.fireVisibleWindowsChange();
		} catch (error) {
			this.primarySessionKey = undefined;
			this.rollbackHalfAppliedLeaf(sessionKey);
			this.logService.warn(`[ConversationSessionWindowService] ensurePrimaryWindow failed: ${getErrorMessage(error)}`);
			this.notificationService.error(getErrorMessage(error));
		}
	}

	private rollbackHalfAppliedLeaf(sessionKey: string): void {
		const leaf = this.leaves.get(sessionKey);
		this.leaves.delete(sessionKey);
		const orderIndex = this.leafOrder.indexOf(sessionKey);
		if (orderIndex !== -1) {
			this.leafOrder.splice(orderIndex, 1);
		}
		leaf?.container.remove();
	}

	private fireVisibleWindowsChange(): void {
		this._onDidChangeVisibleWindows.fire();
	}
}
