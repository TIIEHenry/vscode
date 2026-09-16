/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { TestInstantiationService } from '../../../../../platform/instantiation/test/common/instantiationServiceMock.js';
import { IExplorerService } from '../../../files/browser/files.js';
import { ISCMService } from '../../../scm/common/scm.js';
import { IConversationReviewNavService } from '../../browser/conversationReviewEntry.js';
import { IConversationSessionWindowService } from '../../browser/conversationSessionWindowService.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { IConversationSessionChatService } from '../../common/conversationSessionChat.js';

export function createNoopConversationSessionWindowService(): IConversationSessionWindowService {
	return {
		_serviceBrand: undefined,
		onDidChangeVisibleWindows: Event.None,
		onDidChangeFocusedLeaf: Event.None,
		getVisibleSessionKeys: () => [],
		getVisibleWindowCount: () => 0,
		isSessionWindowVisible: () => false,
		isSessionWindowHidden: () => false,
		getPrimarySessionKey: () => undefined,
		getFocusedLeafSessionKey: () => undefined,
		getLeafSlots: () => undefined,
		getAllLeafSessionKeys: () => [],
		ensurePrimaryWindow: async () => { },
		openSessionBeside: async () => { },
		hideSessionWindow: () => { },
		restoreSessionWindow: () => { },
		revealSessionWindow: async () => { },
	};
}

export function createEmptyConversationSessionChatService(): IConversationSessionChatService {
	return {
		_serviceBrand: undefined,
		onDidChangeCatalog: Event.None,
		onDidChangeCloseNonRootState: Event.None,
		mountSubAgentOverlay: () => { },
		registerPartListeners: () => ({ dispose: () => { } }),
		getAgentHierarchyBreadcrumb: () => [],
		navigateAgentBreadcrumb: async () => { },
		canCloseNonRoot: () => false,
		closeNonRootTabs: async () => { },
		getCatalog: () => [],
		registerForkChat: () => ({ chatId: '', sessionKey: '', title: '', originKind: 'fork' }),
		registerSubAgentChat: () => ({ chatId: '', sessionKey: '', title: '', originKind: 'tool' }),
		seedStubTimelinePills: () => { },
		syncSubAgentsFromLiveTree: () => { },
		openForkTab: async () => { },
		openExtensionTab: async () => { },
		openSubAgent: async () => { },
		promoteSubAgentDialog: async () => { },
		toggleSubAgentDialogMaximized: () => { },
		isSubAgentDialogMaximized: () => false,
		closeSubAgentDialog: () => { },
		isSubAgentDialogOpen: () => false,
		findOpenTabForChat: () => undefined,
		getConversationPart: () => undefined,
		splitSessionWindow: async () => { },
		hideSplitColumn: () => { },
		showSplitColumn: () => { },
	};
}

/**
 * No-op window + empty catalog. Window must stay no-op so `ConversationPart.create`
 * cannot attachGrid → reveal → build a real leaf. Call before `ConversationLens`
 * or `ConversationEditorPane` construction.
 */
export function stubConversationTimelineLinkServices(instantiationService: TestInstantiationService): void {
	instantiationService.stub(IConversationSessionWindowService, createNoopConversationSessionWindowService());
	instantiationService.stub(IConversationSessionChatService, createEmptyConversationSessionChatService());
}

/**
 * Services `ConversationLens` / identity strip pull after
 * `conversationEditor.contribution` registers the real pane. Call before
 * `createConversationEditorPart` so `void openEditor` can settle a lens.
 */
export function stubConversationLensRuntimeServices(instantiationService: TestInstantiationService): void {
	instantiationService.stub(IConversationTimelineRevealService, {
		_serviceBrand: undefined,
		registerLens: () => ({ dispose: () => { } }),
		revealItem: () => { },
		getAccessibleTurnContent: () => undefined,
		focusAccessibleTurn: () => { },
		scrollToFirstPendingConfirmation: () => { },
	});
	instantiationService.stub(IConversationReviewNavService, {
		_serviceBrand: undefined,
		onDidChange: Event.None,
		getReviewNavForSession: () => [],
	});
	instantiationService.stub(IExplorerService, {
		_serviceBrand: undefined,
		select: async () => { },
	} as unknown as IExplorerService);
	instantiationService.stub(ISCMService, {
		_serviceBrand: undefined,
		get repositories() { return []; },
		get repositoryCount() { return 0; },
		onDidAddRepository: Event.None,
		onDidRemoveRepository: Event.None,
		registerSCMProvider: () => { throw new Error('not implemented'); },
		getRepository: () => undefined,
	} as unknown as ISCMService);
}
