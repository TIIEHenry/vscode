/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationLens.css';
import './uaClientSettings.contribution.js';
import './uaPreferencesPanes.contribution.js';
import './universeAgentDeepLink.contribution.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { Extensions as ViewContainerExtensions, IViewContainersRegistry, IViewsRegistry, Extensions as ViewExtensions, ViewContainerLocation } from '../../../common/views.js';
import { IConversationLensSlots, IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationLens } from './conversationLens.js';
import { CONVERSATION_SESSIONS_VIEW_ID, ConversationSessionsView } from './conversationSessionsView.js';
import { ConversationSessionStatusBarContribution, registerConversationSessionStatusBar } from './conversationSessionStatusBar.js';
import { registerUaPreferencesNavigationActions } from './uaPreferencesNavigation.js';
import { ConversationStubService, IConversationStubService } from './conversationStubService.js';

registerSingleton(IConversationStubService, ConversationStubService, InstantiationType.Delayed);

export const CONVERSATION_SESSIONS_CONTAINER_ID = 'workbench.view.sessions';

const conversationSessionsViewIcon = registerIcon(
	'conversation-sessions-view-icon',
	Codicon.commentDiscussion,
	localize('conversationSessionsViewIcon', 'View icon of the conversation sessions view.'),
);

const conversationSessionsViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: CONVERSATION_SESSIONS_CONTAINER_ID,
	title: localize2('conversationSessions', "Sessions"),
	icon: conversationSessionsViewIcon,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [CONVERSATION_SESSIONS_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: CONVERSATION_SESSIONS_CONTAINER_ID,
	hideIfEmpty: false,
	order: 10,
	alwaysUseContainerInfo: true,
}, ViewContainerLocation.Sidebar, { isDefault: false });

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: CONVERSATION_SESSIONS_VIEW_ID,
	name: localize2('conversationSessions', "Sessions"),
	containerIcon: conversationSessionsViewIcon,
	ctorDescriptor: new SyncDescriptor(ConversationSessionsView),
	canToggleVisibility: false,
	canMoveView: true,
	order: 1,
	weight: 100,
}], conversationSessionsViewContainer);

class ConversationLensContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationLens';

	private _mounted = false;

	constructor(
		@IConversationPartService conversationPartService: IConversationPartService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();

		const existing = conversationPartService.getSlots();
		if (existing) {
			this.mount(existing);
		} else {
			this._register(conversationPartService.onDidCreateSlots(slots => this.mount(slots)));
		}
	}

	private mount(slots: IConversationLensSlots): void {
		if (this._mounted) {
			return;
		}
		this._mounted = true;
		this._register(this.instantiationService.createInstance(ConversationLens, slots));
	}
}

registerWorkbenchContribution2(ConversationLensContribution.ID, ConversationLensContribution, WorkbenchPhase.AfterRestored);

registerConversationSessionStatusBar();
registerUaPreferencesNavigationActions();
registerWorkbenchContribution2(ConversationSessionStatusBarContribution.ID, ConversationSessionStatusBarContribution, WorkbenchPhase.AfterRestored);
