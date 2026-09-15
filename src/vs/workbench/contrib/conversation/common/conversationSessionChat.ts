/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { GroupIdentifier } from '../../../common/editor.js';
import { IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import type { IConversationAgentBreadcrumbItem } from './conversationAgentHierarchy.js';
import { ConversationChatInput } from './conversationChatInput.js';

/** Stub-period chat origin kinds aligned with protocol `ChatOrigin`. */
export type ConversationSessionChatOriginKind = 'user' | 'fork' | 'tool' | 'sideChat';

export interface IConversationSessionChatEntry {
	readonly chatId: string;
	readonly sessionKey: string;
	readonly title: string;
	readonly originKind: ConversationSessionChatOriginKind;
	readonly parentChatId?: string;
	/** Live-tree model id; omit when empty / unavailable (stub / disconnect). */
	readonly model?: string;
}

export const IConversationSessionChatService = createDecorator<IConversationSessionChatService>('conversationSessionChatService');

/**
 * DOM-free session-chat contract. `mountSubAgentOverlay` stays on the browser
 * implementation (`sessionWindowHost` is an HTMLElement at runtime) so
 * `valid-layers-check` does not see DOM types in `common/`.
 */
export interface IConversationSessionChatService {
	readonly _serviceBrand: undefined;

	readonly onDidChangeCatalog: Event<string>;
	readonly onDidChangeCloseNonRootState: Event<void>;

	mountSubAgentOverlay(sessionKey: string, sessionWindowHost: unknown): void;

	registerPartListeners(part: IConversationEditorPart): IDisposable;

	getAgentHierarchyBreadcrumb(sessionKey: string, chatId: string): readonly IConversationAgentBreadcrumbItem[];

	navigateAgentBreadcrumb(sessionKey: string, targetChatId: string): Promise<void>;

	canCloseNonRoot(sessionKey?: string): boolean;

	closeNonRootTabs(sessionKey?: string): Promise<void>;

	getCatalog(sessionKey: string): readonly IConversationSessionChatEntry[];

	registerForkChat(sessionKey: string, chatId: string, title: string): IConversationSessionChatEntry;

	registerSubAgentChat(sessionKey: string, chatId: string, title: string, parentChatId?: string): IConversationSessionChatEntry;

	seedStubTimelinePills(): void;

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
