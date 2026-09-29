/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
import { GroupIdentifier } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { GroupDirection, GroupsOrder, IEditorGroup, IEditorGroupsService, IFindGroupScope } from './editorGroupsService.js';
import { PreviewCategory } from './previewCategoryService.js';

/** True only inside the main Preview part that owns category groups. */
export const PreviewCategorizedContext = new RawContextKey<boolean>('previewCategorized', false);

/**
 * Main Preview part that owns editor-group categories. Other parts (Agents
 * window, auxiliary, modal, Conversation) do not implement this.
 */
export interface IPreviewCategoryRoutingPart {
	readonly isPreviewCategoryRoutingPart: true;

	isGroupVisible(group: IEditorGroup | GroupIdentifier): boolean;
	getGroupCategory(group: IEditorGroup | GroupIdentifier): PreviewCategory | undefined;
	getMostRecentGroup(category: PreviewCategory): IEditorGroup | undefined;
	ensureCategoryGroup(category: PreviewCategory): IEditorGroup;
	addGroupInCategory(location: IEditorGroup | GroupIdentifier, direction: GroupDirection, category: PreviewCategory): IEditorGroup;
	revealCategory(category: PreviewCategory, group?: IEditorGroup): void;
	markCategoryHint(category: PreviewCategory): void;
	moveEditorToCategory(editor: EditorInput, category: PreviewCategory, source?: IEditorGroup): void;
	getGroups(order: GroupsOrder): readonly IEditorGroup[];
	findGroup(scope: IFindGroupScope, source?: IEditorGroup | GroupIdentifier, wrap?: boolean): IEditorGroup | undefined;
	hasOpenEditors(): boolean;
}

export function isPreviewCategoryRoutingPart(part: unknown): part is IPreviewCategoryRoutingPart {
	return !!part && typeof part === 'object' && (part as IPreviewCategoryRoutingPart).isPreviewCategoryRoutingPart === true;
}

/** Index, ViewColumn, and close-all count a group only while its category is showing. */
export function isEditorGroupShown(editorGroupsService: IEditorGroupsService, group: IEditorGroup): boolean {
	const part = editorGroupsService.getPart(group);
	return !isPreviewCategoryRoutingPart(part) || part.isGroupVisible(group);
}

/** A caller that already picked the group still has to show that group's category. */
export function revealEditorGroupIfHidden(editorGroupsService: IEditorGroupsService, group: IEditorGroup): void {
	const part = editorGroupsService.getPart(group);
	if (!isPreviewCategoryRoutingPart(part) || part.isGroupVisible(group)) {
		return;
	}

	const category = part.getGroupCategory(group);
	if (category) {
		part.revealCategory(category, group);
	}
}
