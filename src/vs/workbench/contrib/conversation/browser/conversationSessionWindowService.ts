/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationSessionWindow.css';
import { $, addDisposableListener, append, getActiveElement } from '../../../../base/browser/dom.js';
import { timeout } from '../../../../base/common/async.js';
import { getErrorMessage, onUnexpectedError } from '../../../../base/common/errors.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import {
	CONVERSATION_SESSION_WINDOW_MAX_LEAVES,
	ConversationEditorPaneId,
	conversationSessionLeafHiddenClass,
	conversationSessionLeafPrimaryClass,
	conversationSessionLeafSecondaryClass,
} from '../common/conversationSessionWindow.js';
import { ENGINE_BIND_FAILED_SESSION_ID } from './conversationEngineRosterService.js';
import { IConversationRosterService } from './conversationStubService.js';

export const IConversationSessionWindowService = createDecorator<IConversationSessionWindowService>('conversationSessionWindowService');

export interface IConversationSessionLeafSlots {
	readonly sessionKey: string;
	readonly container: HTMLElement;
	readonly sessionBar: HTMLElement;
	readonly sessionWindow: HTMLElement;
	readonly editorPartHost: HTMLElement;
}

export interface IConversationSessionWindowService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeVisibleWindows: Event<void>;
	readonly onDidChangeFocusedLeaf: Event<string | undefined>;

	getVisibleSessionKeys(): readonly string[];
	getVisibleWindowCount(): number;
	isSessionWindowVisible(sessionKey: string): boolean;
	isSessionWindowHidden(sessionKey: string): boolean;
	getPrimarySessionKey(): string | undefined;
	getFocusedLeafSessionKey(): string | undefined;

	getLeafSlots(sessionKey: string): IConversationSessionLeafSlots | undefined;

	getAllLeafSessionKeys(): readonly string[];

	ensurePrimaryWindow(sessionKey: string): Promise<void>;
	openSessionBeside(sessionKey: string): Promise<void>;
	hideSessionWindow(sessionKey: string): void;
	restoreSessionWindow(sessionKey: string): void;
	revealSessionWindow(sessionKey: string, options?: { replace?: string }): Promise<void>;
}

interface IConversationSessionLeaf extends IConversationSessionLeafSlots {
	hidden: boolean;
	readonly store: DisposableStore;
}

interface IRevealInFlight {
	sessionKey: string;
	replace?: string;
	promise: Promise<void>;
	atomic: boolean;
	cancelled: boolean;
}

export class ConversationSessionWindowService extends Disposable implements IConversationSessionWindowService {

	declare readonly _serviceBrand: undefined;

	private gridHost: HTMLElement | undefined;
	private primarySessionKey: string | undefined;
	private focusedLeafSessionKey: string | undefined;
	private primaryBootstrapInFlight: Promise<void> | undefined;
	private primaryBootstrapGeneration = 0;
	private pendingReveal: { sessionKey: string; options?: { replace?: string } } | undefined;
	private revealInFlight: IRevealInFlight | undefined;
	private readonly leaves = new Map<string, IConversationSessionLeaf>();
	private readonly leafOrder: string[] = [];

	private readonly _onDidChangeVisibleWindows = this._register(new Emitter<void>());
	readonly onDidChangeVisibleWindows = this._onDidChangeVisibleWindows.event;

	private readonly _onDidChangeFocusedLeaf = this._register(new Emitter<string | undefined>());
	readonly onDidChangeFocusedLeaf = this._onDidChangeFocusedLeaf.event;

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
			// Bind-failed only — do not use isEngineRosterPlaceholderSessionId, which also
			// matches stub seeds (untitled / visualize) that must still reveal.
			if (sessionKey === ENGINE_BIND_FAILED_SESSION_ID) {
				return;
			}
			if (!this.rosterService.getSessions().some(session => session.id === sessionKey)) {
				return;
			}
			void this.revealSessionWindow(sessionKey).catch(onUnexpectedError).catch(onUnexpectedError);
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

	getFocusedLeafSessionKey(): string | undefined {
		return this.focusedLeafSessionKey;
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

		this.setLeafHidden(leaf, true);
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

		this.setLeafHidden(leaf, false);
		this.fireVisibleWindowsChange();
	}

	async revealSessionWindow(sessionKey: string, options?: { replace?: string }): Promise<void> {
		if (sessionKey === ENGINE_BIND_FAILED_SESSION_ID) {
			return;
		}

		if (!this.gridHost) {
			this.pendingReveal = { sessionKey, options };
			return;
		}

		if (this.revealInFlight?.sessionKey === sessionKey) {
			if (options?.replace && !this.revealInFlight.replace) {
				this.revealInFlight.replace = options.replace;
			}
			return this.revealInFlight.promise;
		}

		if (this.revealInFlight && !this.revealInFlight.atomic) {
			this.revealInFlight.cancelled = true;
		}

		if (this.revealInFlight?.atomic) {
			await this.revealInFlight.promise;
		}

		const state: IRevealInFlight = {
			sessionKey,
			replace: options?.replace,
			promise: Promise.resolve(),
			atomic: false,
			cancelled: false,
		};
		const promise = this.runReveal(sessionKey, state);
		state.promise = promise;
		this.revealInFlight = state;
		try {
			await promise;
		} finally {
			if (this.revealInFlight === state) {
				this.revealInFlight = undefined;
			}
		}
	}

	private async runReveal(sessionKey: string, state: IRevealInFlight): Promise<void> {
		if (state.cancelled) {
			return;
		}

		const existing = this.leaves.get(sessionKey);
		if (existing && !existing.hidden) {
			this.fireVisibleWindowsChange();
			await this.whenLeafPaneReady(sessionKey);
			this.focusLeaf(sessionKey);
			return;
		}

		if (state.cancelled) {
			return;
		}

		state.atomic = true;
		const previousPrimary = this.primarySessionKey;
		const previouslyVisible = new Set(this.getVisibleSessionKeys());
		try {
			await this.applyRevealStateTable(sessionKey, state.replace);
			this.fireVisibleWindowsChange();
			await this.whenLeafPaneReady(sessionKey);
			this.focusLeaf(sessionKey);
		} catch (error) {
			if (!previouslyVisible.has(sessionKey)) {
				this.rollbackHalfAppliedLeaf(sessionKey);
			}
			this.primarySessionKey = previousPrimary;
			this.logService.warn(`[ConversationSessionWindowService] revealSessionWindow failed: ${getErrorMessage(error)}`);
			this.notificationService.error(getErrorMessage(error));
		}
	}

	private async applyRevealStateTable(sessionKey: string, replace?: string): Promise<void> {
		const existing = this.leaves.get(sessionKey);
		const visibleCount = this.getVisibleWindowCount();

		if (existing?.hidden && visibleCount <= 1) {
			this.setLeafHidden(existing, false);
			this.promoteLeaf(sessionKey);
			const oldPrimary = this.primarySessionKey;
			this.primarySessionKey = sessionKey;
			if (oldPrimary && oldPrimary !== sessionKey) {
				this.demoteLeaf(oldPrimary);
				this.hideSessionWindowWithoutFire(oldPrimary);
			}
			return;
		}

		if (existing?.hidden && visibleCount >= 2) {
			if (replace && replace !== sessionKey) {
				this.replaceVisibleLeaf(replace, sessionKey);
				return;
			}
			this.restoreSessionWindowWithoutFire(sessionKey);
			return;
		}

		if (!existing && visibleCount <= 1) {
			const oldPrimary = this.primarySessionKey;
			await this.ensureLeaf(sessionKey, { primary: true });
			this.promoteLeaf(sessionKey);
			this.primarySessionKey = sessionKey;
			if (oldPrimary && oldPrimary !== sessionKey) {
				this.demoteLeaf(oldPrimary);
				this.hideSessionWindowWithoutFire(oldPrimary);
			}
			return;
		}

		if (!existing && visibleCount >= 2) {
			if (replace) {
				await this.replaceLeafWithNew(replace, sessionKey);
				return;
			}
			await this.openSessionBeside(sessionKey);
		}
	}

	private replaceVisibleLeaf(outgoingKey: string, incomingKey: string): void {
		const incoming = this.leaves.get(incomingKey);
		if (!incoming) {
			return;
		}
		if (outgoingKey === this.primarySessionKey) {
			this.setLeafHidden(incoming, false);
			this.promoteLeaf(incomingKey);
			this.primarySessionKey = incomingKey;
			this.demoteLeaf(outgoingKey);
			this.hideSessionWindowWithoutFire(outgoingKey);
			return;
		}
		this.setLeafHidden(incoming, false);
		this.hideSessionWindowWithoutFire(outgoingKey);
		if (this.getVisibleWindowCount() > CONVERSATION_SESSION_WINDOW_MAX_LEAVES) {
			this.hideSessionWindowWithoutFire(outgoingKey);
		}
	}

	private async replaceLeafWithNew(outgoingKey: string, incomingKey: string): Promise<void> {
		if (outgoingKey === this.primarySessionKey) {
			await this.ensureLeaf(incomingKey, { primary: true });
			this.promoteLeaf(incomingKey);
			this.primarySessionKey = incomingKey;
			this.demoteLeaf(outgoingKey);
			this.hideSessionWindowWithoutFire(outgoingKey);
			return;
		}
		this.hideSessionWindowWithoutFire(outgoingKey);
		await this.ensureLeaf(incomingKey, { primary: false });
	}

	private attachGrid(gridHost: HTMLElement): void {
		if (this.gridHost) {
			return;
		}
		this.gridHost = gridHost;
		queueMicrotask(() => {
			const pending = this.pendingReveal;
			this.pendingReveal = undefined;
			if (pending) {
				void this.revealSessionWindow(pending.sessionKey, pending.options).catch(onUnexpectedError).catch(onUnexpectedError);
				return;
			}
			void this.ensurePrimaryWindow(this.rosterService.getActiveSessionId()).catch(onUnexpectedError).catch(onUnexpectedError);
		});
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
		container.tabIndex = -1;
		if (options.primary) {
			container.classList.add(conversationSessionLeafPrimaryClass);
		} else {
			container.classList.add(conversationSessionLeafSecondaryClass);
		}

		const sessionBar = append(container, $('.conversation-session-leaf-session-bar'));
		const sessionWindow = append(container, $('.conversation-session-window'));
		const editorPartHost = append(sessionWindow, $('.conversation-editor-part-container.part.editor'));
		const store = this._register(new DisposableStore());

		leaf = {
			sessionKey,
			container,
			sessionBar,
			sessionWindow,
			editorPartHost,
			hidden: false,
			store,
		};
		this.leaves.set(sessionKey, leaf);

		if (!this.leafOrder.includes(sessionKey)) {
			this.leafOrder.push(sessionKey);
		}

		store.add(addDisposableListener(container, 'focusin', () => {
			this.setFocusedLeaf(sessionKey);
			if (this.rosterService.getActiveSessionId() !== sessionKey) {
				this.rosterService.switchSession(sessionKey);
			}
		}, true));

		this.editorGroupsService.createConversationEditorPart(editorPartHost, sessionKey);
		const part = this.editorGroupsService.conversationParts.find(candidate => candidate.sessionKey === sessionKey);
		if (part) {
			await part.whenReady;
		}

		return leaf;
	}

	private promoteLeaf(sessionKey: string): void {
		const leaf = this.leaves.get(sessionKey);
		if (!leaf) {
			return;
		}
		leaf.container.classList.remove(conversationSessionLeafSecondaryClass);
		leaf.container.classList.add(conversationSessionLeafPrimaryClass);
	}

	private demoteLeaf(sessionKey: string): void {
		const leaf = this.leaves.get(sessionKey);
		if (!leaf) {
			return;
		}
		leaf.container.classList.remove(conversationSessionLeafPrimaryClass);
		leaf.container.classList.add(conversationSessionLeafSecondaryClass);
	}

	private setLeafHidden(leaf: IConversationSessionLeaf, hidden: boolean): void {
		leaf.hidden = hidden;
		leaf.container.classList.toggle(conversationSessionLeafHiddenClass, hidden);
		if (hidden) {
			leaf.container.setAttribute('aria-hidden', 'true');
		} else {
			leaf.container.removeAttribute('aria-hidden');
		}
	}

	private hideSessionWindowWithoutFire(sessionKey: string): void {
		if (sessionKey === this.primarySessionKey) {
			return;
		}
		const leaf = this.leaves.get(sessionKey);
		if (!leaf || leaf.hidden) {
			return;
		}
		this.setLeafHidden(leaf, true);
	}

	private restoreSessionWindowWithoutFire(sessionKey: string): void {
		const leaf = this.leaves.get(sessionKey);
		if (!leaf || !leaf.hidden) {
			return;
		}
		const visibleOthers = this.getVisibleSessionKeys().filter(key => key !== sessionKey);
		if (visibleOthers.length >= CONVERSATION_SESSION_WINDOW_MAX_LEAVES) {
			for (const otherKey of visibleOthers) {
				if (otherKey !== this.primarySessionKey) {
					this.hideSessionWindowWithoutFire(otherKey);
					break;
				}
			}
		}
		this.setLeafHidden(leaf, false);
	}

	private setFocusedLeaf(sessionKey: string): void {
		const leaf = this.leaves.get(sessionKey);
		if (!leaf) {
			return;
		}
		if (this.focusedLeafSessionKey === sessionKey) {
			this.conversationPartService.setFocusedLeafContainer(leaf.container);
			this.editorGroupsService.setFocusedConversationLeaf(sessionKey);
		} else {
			this.focusedLeafSessionKey = sessionKey;
			this.conversationPartService.setFocusedLeafContainer(leaf.container);
			this.editorGroupsService.setFocusedConversationLeaf(sessionKey);
			this._onDidChangeFocusedLeaf.fire(sessionKey);
		}
		if (this.rosterService.getActiveSessionId() !== sessionKey) {
			this.rosterService.switchSession(sessionKey);
		}
	}

	private focusLeaf(sessionKey: string): void {
		const leaf = this.leaves.get(sessionKey);
		if (!leaf) {
			return;
		}
		this.setFocusedLeaf(sessionKey);
		const part = this.editorGroupsService.conversationParts.find(candidate => candidate.sessionKey === sessionKey);
		part?.activeGroup.focus();
		if (!leaf.container.contains(getActiveElement())) {
			leaf.container.focus();
		}
	}

	private async whenLeafPaneReady(sessionKey: string): Promise<void> {
		const part = this.editorGroupsService.conversationParts.find(candidate => candidate.sessionKey === sessionKey);
		if (!part) {
			return;
		}
		await part.whenReady;
		if (part.activeGroup.activeEditorPane?.getId() === ConversationEditorPaneId) {
			return;
		}
		if (part.activeGroup.activeEditorPane) {
			return;
		}
		const paneReady = Event.toPromise(Event.filter(part.activeGroup.onDidActiveEditorChange, () => {
			return part.activeGroup.activeEditorPane?.getId() === ConversationEditorPaneId;
		}));
		const wait = timeout(2000);
		try {
			await Promise.race([paneReady, wait]);
		} finally {
			paneReady.cancel();
			wait.cancel();
		}
	}

	private async tryBootstrapPrimaryWindow(sessionKey: string): Promise<void> {
		const generation = ++this.primaryBootstrapGeneration;
		try {
			await this.ensureLeaf(sessionKey, { primary: true });
			if (generation !== this.primaryBootstrapGeneration) {
				return;
			}
			this.primarySessionKey = sessionKey;
			this.setFocusedLeaf(sessionKey);
			this.fireVisibleWindowsChange();
		} catch (error) {
			if (generation === this.primaryBootstrapGeneration) {
				this.primarySessionKey = undefined;
			}
			this.rollbackHalfAppliedLeaf(sessionKey);
			this.logService.warn(`[ConversationSessionWindowService] ensurePrimaryWindow failed: ${getErrorMessage(error)}`);
			this.notificationService.error(getErrorMessage(error));
		}
	}

	private rollbackHalfAppliedLeaf(sessionKey: string): void {
		this.editorGroupsService.disposeConversationEditorPart(sessionKey);
		const leaf = this.leaves.get(sessionKey);
		leaf?.store.dispose();
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
