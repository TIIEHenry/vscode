/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationEditorPart.css';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPart } from './editorPart.js';
import { IEditorPartsView } from './editor.js';
import { IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';

export class ConversationEditorPartImpl extends EditorPart implements IConversationEditorPart {

	private static COUNTER = 1;

	readonly excludeFromGlobalEditorAggregation = true as const;

	private readonly partOptionsDisposable = this._register(new DisposableStore());

	constructor(
		readonly sessionKey: string,
		windowId: number,
		editorPartsView: IEditorPartsView,
		@IInstantiationService instantiationService: IInstantiationService,
		@IThemeService themeService: IThemeService,
		@IConfigurationService configurationService: IConfigurationService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IHostService hostService: IHostService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		const id = ConversationEditorPartImpl.COUNTER++;
		super(
			editorPartsView,
			`workbench.parts.conversationEditor.${id}`,
			localize('conversationEditorPart', "Conversation"),
			windowId,
			instantiationService,
			themeService,
			configurationService,
			storageService,
			layoutService,
			hostService,
			contextKeyService,
		);

		this.applyConversationPartOptions();
	}

	private applyConversationPartOptions(): void {
		const editorCount = this.groups.reduce((count, group) => count + group.count, 0);
		const showTabs = editorCount > 1 ? 'multiple' : 'none';

		this.partOptionsDisposable.clear();
		this.partOptionsDisposable.add(this.enforcePartOptions({
			showTabs,
			enablePreview: false,
			closeEmptyGroups: false,
			tabActionCloseVisibility: showTabs === 'multiple',
			editorActionsLocation: 'hidden',
			tabHeight: 'compact',
			wrapTabs: false,
			allowDropIntoGroup: false,
		}));
	}

	override create(parent: HTMLElement, options?: object): void {
		parent.classList.add('conversation-editor-part-host');
		super.create(parent, options);
	}

	override notifyGroupsLabelChange(label: string): void {
		super.notifyGroupsLabelChange(label);
		this.applyConversationPartOptions();
	}
}
