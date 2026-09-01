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
import { IEditorGroupView } from './editor.js';
import { GroupIdentifier } from '../../../common/editor.js';
import { findGroup } from '../../../services/editor/common/editorGroupFinder.js';
import { IConversationEditorPart, IEditorGroup, IEditorSideGroup } from '../../../services/editor/common/editorGroupsService.js';
import { CONVERSATION_SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';

export class ConversationEditorPartImpl extends EditorPart implements IConversationEditorPart {

	private static COUNTER = 1;

	readonly excludeFromGlobalEditorAggregation = true as const;

	private readonly partOptionsDisposable = this._register(new DisposableStore());
	private readonly hiddenGroupIds = new Set<GroupIdentifier>();

	override readonly sideGroup: IEditorSideGroup = {
		openEditor: async (editor, options) => {
			const findGroupResult = this.scopedInstantiationService.invokeFunction(accessor => findGroup(accessor, { editor, options }, CONVERSATION_SIDE_GROUP));
			let group;
			if (findGroupResult instanceof Promise) {
				([group] = await findGroupResult);
			} else {
				([group] = findGroupResult);
			}
			return group.openEditor(editor, options);
		}
	};

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
		this._register(this.onDidAddGroup(() => this.applyConversationPartOptions()));
		this._register(this.onDidRemoveGroup(() => this.applyConversationPartOptions()));
	}

	setGroupHidden(group: IEditorGroup | GroupIdentifier, hidden: boolean): void {
		const groupView = this.assertGroupView(group as IEditorGroupView | GroupIdentifier);
		const rootGroup = this.groups.at(0);
		if (rootGroup && groupView.id === rootGroup.id) {
			return;
		}

		if (hidden) {
			this.hiddenGroupIds.add(groupView.id);
		} else {
			this.hiddenGroupIds.delete(groupView.id);
		}

		this.setGroupViewVisible(groupView, !hidden);
		this.applyConversationPartOptions();
	}

	isGroupHidden(group: IEditorGroup | GroupIdentifier): boolean {
		const groupView = this.assertGroupView(group as IEditorGroupView | GroupIdentifier);
		if (this.hiddenGroupIds.has(groupView.id)) {
			return true;
		}

		return !this.isGroupViewVisible(groupView);
	}

	private applyConversationPartOptions(): void {
		const editorCount = this.groups.reduce((count, group) => count + group.count, 0);
		const visibleGroupCount = this.groups.filter(group => !this.isGroupHidden(group)).length;
		const showTabs = editorCount > 1 || visibleGroupCount > 1 ? 'multiple' : 'none';

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
