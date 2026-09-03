/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { GroupIdentifier, IEditorIdentifier } from '../../../common/editor.js';
import { IEditorGroupsService, IConversationEditorPart, preferredSideBySideGroupDirection } from '../../../services/editor/common/editorGroupsService.js';
import { CONVERSATION_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { buildAgentHierarchyBreadcrumb, IConversationAgentBreadcrumbItem } from '../common/conversationAgentHierarchy.js';
import { collectLiveAgentTreeCatalogEntries } from '../common/conversationLiveAgentCatalog.js';
import { isConversationExtensionTab } from '../common/conversationEditorRouting.js';
import { IConversationSessionChatEntry } from '../common/conversationSessionChat.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';
import {
	ConversationChatInput,
	deriveConversationChatIdFromForkResource,
	getConversationChatResource,
	parseConversationChatResource,
} from './conversationChatInput.js';
import { ConversationSubAgentOverlay } from './conversationSubAgentOverlay.js';
import { IConversationRosterService } from './conversationStubService.js';

export const IConversationSessionChatService = createDecorator<IConversationSessionChatService>('conversationSessionChatService');

export interface IConversationSessionChatService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeCatalog: Event<string>;
	readonly onDidChangeCloseNonRootState: Event<void>;

	mountSubAgentOverlay(sessionKey: string, sessionWindowHost: HTMLElement): void;

	registerPartListeners(part: IConversationEditorPart): IDisposable;

	getAgentHierarchyBreadcrumb(sessionKey: string, chatId: string): readonly IConversationAgentBreadcrumbItem[];

	navigateAgentBreadcrumb(sessionKey: string, targetChatId: string): Promise<void>;

	canCloseNonRoot(sessionKey?: string): boolean;

	closeNonRootTabs(sessionKey?: string): Promise<void>;

	getCatalog(sessionKey: string): readonly IConversationSessionChatEntry[];

	registerForkChat(sessionKey: string, chatId: string, title: string): IConversationSessionChatEntry;

	registerSubAgentChat(sessionKey: string, chatId: string, title: string, parentChatId?: string): IConversationSessionChatEntry;

	syncSubAgentsFromLiveTree(sessionKey: string, tree: LiveAgentTreeNodeView): void;

	openForkTab(forkedResource: URI, title?: string): Promise<void>;

	openExtensionTab(sessionKey: string, chatId: string, options?: { title?: string }): Promise<void>;

	openSubAgent(sessionKey: string, chatId: string, title?: string): Promise<void>;

	promoteSubAgentDialog(sessionKey?: string): Promise<void>;

	toggleSubAgentDialogMaximized(sessionKey?: string): void;

	isSubAgentDialogMaximized(sessionKey?: string): boolean;

	closeSubAgentDialog(sessionKey?: string): void;

	isSubAgentDialogOpen(sessionKey?: string): boolean;

	findOpenTabForChat(sessionKey: string, chatId: string): ConversationChatInput | undefined;

	getConversationPart(sessionKey: string): IConversationEditorPart | undefined;

	splitSessionWindow(sessionKey?: string): Promise<void>;

	hideSplitColumn(sessionKey?: string, groupId?: GroupIdentifier): void;

	showSplitColumn(sessionKey?: string, groupId?: GroupIdentifier): void;
}

export class ConversationSessionChatService extends Disposable implements IConversationSessionChatService {

	declare readonly _serviceBrand: undefined;

	private readonly catalog = new Map<string, Map<string, IConversationSessionChatEntry>>();
	private readonly partListeners = new Set<IConversationEditorPart>();
	private readonly subAgentOverlays = new Map<string, ConversationSubAgentOverlay>();

	private readonly _onDidChangeCatalog = this._register(new Emitter<string>());
	readonly onDidChangeCatalog = this._onDidChangeCatalog.event;

	private readonly _onDidChangeCloseNonRootState = this._register(new Emitter<void>());
	readonly onDidChangeCloseNonRootState = this._onDidChangeCloseNonRootState.event;

	constructor(
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
		this._register(this.rosterService.onDidChangeLiveAgentTree(event => {
			this.syncSubAgentsFromLiveTree(event.sessionId, event.tree);
		}));
	}

	mountSubAgentOverlay(sessionKey: string, sessionWindowHost: HTMLElement): void {
		if (this.subAgentOverlays.has(sessionKey)) {
			return;
		}
		const overlay = this._register(this.instantiationService.createInstance(ConversationSubAgentOverlay, sessionWindowHost));
		this.subAgentOverlays.set(sessionKey, overlay);
		this._register(overlay.onDidRequestPromote(() => {
			void this.promoteSubAgentDialog(sessionKey);
		}));
		this._register(overlay.onDidSelectBreadcrumb(chatId => {
			void this.navigateAgentBreadcrumb(sessionKey, chatId);
		}));
		this._register(overlay.onDidClose(() => this.fireCloseNonRootStateChange()));
	}

	registerPartListeners(part: IConversationEditorPart): IDisposable {
		if (this.partListeners.has(part)) {
			return { dispose: () => { } };
		}
		this.partListeners.add(part);

		const scopedEditorService = this.getScopedEditorService(part);
		const disposables = [
			scopedEditorService.onDidActiveEditorChange(() => this.fireCloseNonRootStateChange()),
			scopedEditorService.onDidCloseEditor(() => this.fireCloseNonRootStateChange()),
			{ dispose: () => this.partListeners.delete(part) },
		];

		return {
			dispose: () => {
				for (const disposable of disposables) {
					disposable.dispose();
				}
			},
		};
	}

	getAgentHierarchyBreadcrumb(sessionKey: string, chatId: string): readonly IConversationAgentBreadcrumbItem[] {
		return buildAgentHierarchyBreadcrumb(this.getCatalog(sessionKey), chatId);
	}

	async navigateAgentBreadcrumb(sessionKey: string, targetChatId: string): Promise<void> {
		const overlay = this.subAgentOverlays.get(sessionKey);
		if (overlay?.isOpen()) {
			await this.navigateOverlayBreadcrumb(sessionKey, targetChatId);
			return;
		}

		const part = this.getConversationPart(sessionKey);
		if (!part) {
			return;
		}

		const activeEditor = part.activeGroup.activeEditor;
		if (!(activeEditor instanceof ConversationChatInput) || activeEditor.isDefaultRoot) {
			return;
		}

		const activeChatId = parseConversationChatResource(activeEditor.resource)?.chatId;
		const activeEntry = activeChatId ? this.catalog.get(sessionKey)?.get(activeChatId) : undefined;
		if (!activeEntry || activeEntry.originKind !== 'tool') {
			return;
		}

		if (targetChatId === activeChatId) {
			return;
		}

		const editorService = this.getScopedEditorService(part);
		const group = part.activeGroup;

		if (targetChatId === 'default') {
			const rootEditor = group.getEditorByIndex(0);
			if (rootEditor instanceof ConversationChatInput && rootEditor.isDefaultRoot) {
				await editorService.closeEditor({ editor: activeEditor, groupId: group.id });
				await group.openEditor(rootEditor);
			}
			this.fireCloseNonRootStateChange();
			return;
		}

		const targetEntry = this.catalog.get(sessionKey)?.get(targetChatId);
		if (!targetEntry) {
			return;
		}

		const replacement = this.instantiationService.createInstance(
			ConversationChatInput,
			getConversationChatResource(sessionKey, targetChatId),
			{ isDefaultRoot: false, title: targetEntry.title },
		);

		await editorService.replaceEditors([{
			editor: activeEditor,
			replacement,
		}], group);
		this.fireCloseNonRootStateChange();
	}

	private async navigateOverlayBreadcrumb(sessionKey: string, targetChatId: string): Promise<void> {
		const overlay = this.subAgentOverlays.get(sessionKey);
		const state = overlay?.getState();
		if (!overlay || !state) {
			return;
		}

		if (targetChatId === state.chatId) {
			return;
		}

		if (targetChatId === 'default') {
			this.closeSubAgentDialog(sessionKey);
			return;
		}

		const existingTab = this.findOpenTabForChat(sessionKey, targetChatId);
		if (existingTab) {
			const part = this.getConversationPart(sessionKey);
			this.closeSubAgentDialog(sessionKey);
			await part?.activeGroup.openEditor(existingTab);
			return;
		}

		const targetEntry = this.catalog.get(sessionKey)?.get(targetChatId);
		if (!targetEntry) {
			return;
		}

		overlay.open(this.createOverlayState(sessionKey, targetEntry.chatId, targetEntry.title));
		this.fireCloseNonRootStateChange();
	}

	canCloseNonRoot(sessionKey?: string): boolean {
		if (this.isSubAgentDialogOpen(sessionKey)) {
			return true;
		}

		const key = this.resolveSessionKey(sessionKey);
		return this.countCloseableNonRootTabs(key) > 0;
	}

	async closeNonRootTabs(sessionKey?: string): Promise<void> {
		const key = this.resolveSessionKey(sessionKey);
		const part = this.getConversationPart(key);
		if (!part) {
			return;
		}

		this.closeSubAgentDialog(key);

		const editorService = this.getScopedEditorService(part);
		const toClose: IEditorIdentifier[] = [];
		for (const group of part.groups) {
			for (const editor of group.editors) {
				if (isConversationExtensionTab(editor)) {
					toClose.push({ editor, groupId: group.id });
				}
			}
		}

		if (toClose.length > 0) {
			await editorService.closeEditors(toClose);
		}

		this.fireCloseNonRootStateChange();
	}

	getCatalog(sessionKey: string): readonly IConversationSessionChatEntry[] {
		return [...(this.catalog.get(sessionKey)?.values() ?? [])];
	}

	registerForkChat(sessionKey: string, chatId: string, title: string): IConversationSessionChatEntry {
		return this.registerChat(sessionKey, chatId, title, 'fork');
	}

	registerSubAgentChat(sessionKey: string, chatId: string, title: string, parentChatId = 'default'): IConversationSessionChatEntry {
		return this.registerChat(sessionKey, chatId, title, 'tool', parentChatId);
	}

	syncSubAgentsFromLiveTree(sessionKey: string, tree: LiveAgentTreeNodeView): void {
		let sessionCatalog = this.catalog.get(sessionKey);
		if (!sessionCatalog) {
			sessionCatalog = new Map();
			this.catalog.set(sessionKey, sessionCatalog);
		}
		let changed = false;
		for (const entry of collectLiveAgentTreeCatalogEntries(tree)) {
			const existing = sessionCatalog.get(entry.chatId);
			if (existing) {
				if (existing.title !== entry.title) {
					sessionCatalog.set(entry.chatId, { ...existing, title: entry.title });
					changed = true;
				}
				continue;
			}
			sessionCatalog.set(entry.chatId, {
				sessionKey,
				chatId: entry.chatId,
				title: entry.title,
				originKind: 'tool',
				parentChatId: entry.parentChatId,
			});
			changed = true;
		}
		if (changed) {
			this._onDidChangeCatalog.fire(sessionKey);
			this.fireCloseNonRootStateChange();
		}
	}

	private registerChat(
		sessionKey: string,
		chatId: string,
		title: string,
		originKind: IConversationSessionChatEntry['originKind'],
		parentChatId?: string,
	): IConversationSessionChatEntry {
		let sessionCatalog = this.catalog.get(sessionKey);
		if (!sessionCatalog) {
			sessionCatalog = new Map();
			this.catalog.set(sessionKey, sessionCatalog);
		}
		const entry: IConversationSessionChatEntry = { sessionKey, chatId, title, originKind, parentChatId };
		sessionCatalog.set(chatId, entry);
		this._onDidChangeCatalog.fire(sessionKey);
		this.fireCloseNonRootStateChange();
		return entry;
	}

	async openForkTab(forkedResource: URI, title?: string): Promise<void> {
		const sessionKey = this.resolveSessionKey();
		const chatId = deriveConversationChatIdFromForkResource(forkedResource);
		this.registerForkChat(sessionKey, chatId, title ?? chatId);
		await this.openExtensionTab(sessionKey, chatId, { title });
	}

	async openExtensionTab(sessionKey: string, chatId: string, options?: { title?: string }): Promise<void> {
		const part = this.getConversationPart(sessionKey);
		if (!part) {
			throw new Error(`Conversation editor part for session ${sessionKey} is not available`);
		}

		const resource = getConversationChatResource(sessionKey, chatId);
		const existing = part.activeGroup.editors.find(editor => editor instanceof ConversationChatInput && editor.resource.toString() === resource.toString());
		if (existing instanceof ConversationChatInput) {
			await part.activeGroup.openEditor(existing);
			return;
		}

		const input = this.instantiationService.createInstance(
			ConversationChatInput,
			resource,
			{ isDefaultRoot: chatId === 'default', title: options?.title },
		);
		const editorService = this.getScopedEditorService(part);
		await editorService.openEditor(input, CONVERSATION_GROUP);
		this.fireCloseNonRootStateChange();
	}

	async openSubAgent(sessionKey: string, chatId: string, title?: string): Promise<void> {
		const existingTab = this.findOpenTabForChat(sessionKey, chatId);
		if (existingTab) {
			const part = this.getConversationPart(sessionKey);
			await part?.activeGroup.openEditor(existingTab);
			return;
		}

		const entry = this.catalog.get(sessionKey)?.get(chatId)
			?? this.registerSubAgentChat(sessionKey, chatId, title ?? chatId);

		const overlay = this.subAgentOverlays.get(sessionKey);
		if (!overlay) {
			throw new Error(`Sub-agent overlay for session ${sessionKey} is not mounted`);
		}

		overlay.open(this.createOverlayState(sessionKey, chatId, title ?? entry.title));
		this.fireCloseNonRootStateChange();
	}

	async promoteSubAgentDialog(sessionKey?: string): Promise<void> {
		const key = this.resolveSessionKey(sessionKey);
		const overlay = this.subAgentOverlays.get(key);
		const state = overlay?.getState();
		if (!state) {
			return;
		}

		this.closeSubAgentDialog(key);
		await this.openExtensionTab(state.sessionKey, state.chatId, { title: state.title });
	}

	toggleSubAgentDialogMaximized(sessionKey?: string): void {
		const key = this.resolveSessionKey(sessionKey);
		this.subAgentOverlays.get(key)?.toggleMaximized();
	}

	isSubAgentDialogMaximized(sessionKey?: string): boolean {
		const key = this.resolveSessionKey(sessionKey);
		return this.subAgentOverlays.get(key)?.isMaximized() ?? false;
	}

	private createOverlayState(sessionKey: string, chatId: string, title: string) {
		return {
			sessionKey,
			chatId,
			title,
			sessionTitle: this.rosterService.getSessions().find(session => session.id === sessionKey)?.title ?? sessionKey,
			breadcrumb: this.getAgentHierarchyBreadcrumb(sessionKey, chatId),
		};
	}

	closeSubAgentDialog(sessionKey?: string): void {
		const key = this.resolveSessionKey(sessionKey);
		const overlay = this.subAgentOverlays.get(key);
		if (overlay?.isOpen()) {
			overlay.close();
			this.fireCloseNonRootStateChange();
		}
	}

	isSubAgentDialogOpen(sessionKey?: string): boolean {
		if (sessionKey) {
			return this.subAgentOverlays.get(sessionKey)?.isOpen() ?? false;
		}
		for (const overlay of this.subAgentOverlays.values()) {
			if (overlay.isOpen()) {
				return true;
			}
		}
		return false;
	}

	findOpenTabForChat(sessionKey: string, chatId: string): ConversationChatInput | undefined {
		const part = this.getConversationPart(sessionKey);
		if (!part) {
			return undefined;
		}
		const resource = getConversationChatResource(sessionKey, chatId);
		for (const group of part.groups) {
			for (const editor of group.editors) {
				if (editor instanceof ConversationChatInput && editor.resource.toString() === resource.toString()) {
					return editor;
				}
			}
		}
		return undefined;
	}

	getConversationPart(sessionKey: string): IConversationEditorPart | undefined {
		return this.editorGroupsService.conversationParts.find(part => part.sessionKey === sessionKey);
	}

	async splitSessionWindow(sessionKey?: string): Promise<void> {
		const key = this.resolveSessionKey(sessionKey);
		const part = this.getConversationPart(key);
		if (!part) {
			throw new Error(`Conversation editor part for session ${key} is not available`);
		}

		const direction = preferredSideBySideGroupDirection(this.configurationService);
		let sideGroup = part.findGroup({ direction }, part.activeGroup, false);
		if (!sideGroup) {
			sideGroup = part.addGroup(part.activeGroup, direction);
		}

		await sideGroup.focus();
	}

	hideSplitColumn(sessionKey?: string, groupId?: GroupIdentifier): void {
		const key = this.resolveSessionKey(sessionKey);
		const part = this.getConversationPart(key);
		if (!part) {
			return;
		}

		const rootGroup = part.groups.at(0);
		const targetId = groupId ?? this.resolveHideSplitColumnTarget(part);
		if (targetId === undefined || rootGroup?.id === targetId) {
			return;
		}

		part.setGroupHidden(targetId, true);
	}

	showSplitColumn(sessionKey?: string, groupId?: GroupIdentifier): void {
		const key = this.resolveSessionKey(sessionKey);
		const part = this.getConversationPart(key);
		if (!part) {
			return;
		}

		if (groupId !== undefined) {
			part.setGroupHidden(groupId, false);
			return;
		}

		for (const group of part.groups) {
			if (part.isGroupHidden(group)) {
				part.setGroupHidden(group, false);
			}
		}
	}

	private resolveHideSplitColumnTarget(part: IConversationEditorPart): GroupIdentifier | undefined {
		const rootGroup = part.groups.at(0);
		if (!rootGroup) {
			return undefined;
		}

		if (part.activeGroup.id !== rootGroup.id && !part.isGroupHidden(part.activeGroup)) {
			return part.activeGroup.id;
		}

		const candidate = part.groups.find(group => group.id !== rootGroup.id && !part.isGroupHidden(group));
		return candidate?.id;
	}

	private resolveSessionKey(sessionKey?: string): string {
		if (sessionKey) {
			return sessionKey;
		}

		const focusedPart = this.editorGroupsService.getActiveConversationEditorPart();
		if (focusedPart) {
			return focusedPart.sessionKey;
		}

		return this.rosterService.getActiveSessionId();
	}

	private getScopedEditorService(part: IConversationEditorPart): IEditorService {
		return this.editorGroupsService.getScopedInstantiationService(part).invokeFunction(accessor => accessor.get(IEditorService));
	}

	private countCloseableNonRootTabs(sessionKey: string): number {
		const part = this.getConversationPart(sessionKey);
		if (!part) {
			return 0;
		}

		let count = 0;
		for (const group of part.groups) {
			for (const editor of group.editors) {
				if (isConversationExtensionTab(editor)) {
					count++;
				}
			}
		}
		return count;
	}

	private fireCloseNonRootStateChange(): void {
		this._onDidChangeCloseNonRootState.fire();
	}
}

export function conversationChatInputFromResource(
	instantiationService: IInstantiationService,
	resource: URI,
	title?: string,
): ConversationChatInput | undefined {
	const parsed = parseConversationChatResource(resource);
	if (!parsed) {
		return undefined;
	}
	return instantiationService.createInstance(
		ConversationChatInput,
		resource,
		{ isDefaultRoot: parsed.isDefaultRoot, title },
	);
}
