/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IEditorGroupsService, IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { CONVERSATION_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IConversationSessionChatEntry } from '../common/conversationSessionChat.js';
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

	mountSubAgentOverlay(sessionWindowHost: HTMLElement, sessionBar: HTMLElement): void;

	getCatalog(sessionKey: string): readonly IConversationSessionChatEntry[];

	registerForkChat(sessionKey: string, chatId: string, title: string): IConversationSessionChatEntry;

	registerSubAgentChat(sessionKey: string, chatId: string, title: string, parentChatId?: string): IConversationSessionChatEntry;

	openForkTab(forkedResource: URI, title?: string): Promise<void>;

	openExtensionTab(sessionKey: string, chatId: string, options?: { title?: string }): Promise<void>;

	openSubAgent(sessionKey: string, chatId: string, title?: string): Promise<void>;

	maximizeSubAgentDialog(): Promise<void>;

	closeSubAgentDialog(): void;

	isSubAgentDialogOpen(): boolean;

	findOpenTabForChat(sessionKey: string, chatId: string): ConversationChatInput | undefined;

	getConversationPart(sessionKey: string): IConversationEditorPart | undefined;
}

export class ConversationSessionChatService extends Disposable implements IConversationSessionChatService {

	declare readonly _serviceBrand: undefined;

	private readonly catalog = new Map<string, Map<string, IConversationSessionChatEntry>>();
	private subAgentOverlay: ConversationSubAgentOverlay | undefined;

	private readonly _onDidChangeCatalog = this._register(new Emitter<string>());
	readonly onDidChangeCatalog = this._onDidChangeCatalog.event;

	constructor(
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
	) {
		super();
	}

	mountSubAgentOverlay(sessionWindowHost: HTMLElement, sessionBar: HTMLElement): void {
		if (this.subAgentOverlay) {
			return;
		}
		this.subAgentOverlay = this._register(this.instantiationService.createInstance(ConversationSubAgentOverlay, sessionWindowHost, sessionBar));
		this._register(this.subAgentOverlay.onDidRequestMaximize(() => {
			void this.maximizeSubAgentDialog();
		}));
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
		return entry;
	}

	async openForkTab(forkedResource: URI, title?: string): Promise<void> {
		const sessionKey = this.rosterService.getActiveSessionId();
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

		if (!this.subAgentOverlay) {
			throw new Error('Sub-agent overlay is not mounted');
		}

		this.subAgentOverlay.open({
			sessionKey,
			chatId,
			title: title ?? entry.title,
		});
	}

	async maximizeSubAgentDialog(): Promise<void> {
		const state = this.subAgentOverlay?.getState();
		if (!state) {
			return;
		}

		this.closeSubAgentDialog();
		await this.openExtensionTab(state.sessionKey, state.chatId, { title: state.title });
	}

	closeSubAgentDialog(): void {
		this.subAgentOverlay?.close();
	}

	isSubAgentDialogOpen(): boolean {
		return this.subAgentOverlay?.isOpen() ?? false;
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

	private getScopedEditorService(part: IConversationEditorPart): IEditorService {
		return this.editorGroupsService.getScopedInstantiationService(part).invokeFunction(accessor => accessor.get(IEditorService));
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
