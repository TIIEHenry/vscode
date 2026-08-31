/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationLens.css';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IViewsRegistry, Extensions as ViewExtensions } from '../../../common/views.js';
import { IConversationLensSlots, IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { VIEW_CONTAINER } from '../../files/browser/explorerViewlet.js';
import { ConversationLens } from './conversationLens.js';
import { CONVERSATION_SESSIONS_VIEW_ID, ConversationSessionsView } from './conversationSessionsView.js';
import { ConversationStubService, IConversationStubService } from './conversationStubService.js';

registerSingleton(IConversationStubService, ConversationStubService, InstantiationType.Delayed);

const conversationSessionsViewIcon = registerIcon(
	'conversation-sessions-view-icon',
	Codicon.commentDiscussion,
	localize('conversationSessionsViewIcon', 'View icon of the conversation sessions view.'),
);

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: CONVERSATION_SESSIONS_VIEW_ID,
	name: localize2('conversationSessions', "Sessions"),
	containerIcon: conversationSessionsViewIcon,
	ctorDescriptor: new SyncDescriptor(ConversationSessionsView),
	canToggleVisibility: true,
	canMoveView: true,
	hideByDefault: false,
	collapsed: false,
	order: 3,
	weight: 20,
}], VIEW_CONTAINER);

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
