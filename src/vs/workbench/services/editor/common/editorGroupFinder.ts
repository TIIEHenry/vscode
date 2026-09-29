/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { EditorActivation } from '../../../../platform/editor/common/editor.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { EditorInputWithOptions, isEditorInputWithOptions, IUntypedEditorInput, isEditorInput, EditorInputCapabilities } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorGroup, GroupDirection, GroupsOrder, preferredSideBySideGroupDirection, IEditorGroupsService, IModalEditorPart, isExcludedFromGlobalEditorAggregation } from './editorGroupsService.js';
import { AUX_WINDOW_GROUP, AUX_WINDOW_GROUP_TYPE, CONVERSATION_GROUP, CONVERSATION_SIDE_GROUP, MODAL_GROUP, MODAL_GROUP_TYPE, PreferredGroup, SIDE_GROUP, USE_MODAL_EDITOR_SETTING, UseModalEditorMode, isConversationPreferredGroup } from './editorService.js';
import { isBlockedFromConversationGroup, isConversationChatInput } from '../../../contrib/conversation/common/conversationEditorRouting.js';
import { isConversationDiffReviewInput } from '../../../contrib/sources/common/conversationDiffReviewInput.js';
import { IPreviewCategoryService, PreviewCategory } from './previewCategoryService.js';
import { IPreviewCategoryRoutingPart, isPreviewCategoryRoutingPart } from './previewCategoryRouting.js';

type FindGroupResult = Promise<[IEditorGroup, EditorActivation | undefined]> | [IEditorGroup, EditorActivation | undefined];

/**
 * Finds the target `IEditorGroup` given the instructions provided
 * that is best for the editor and matches the preferred group if
 * possible.
 */
export function findGroup(accessor: ServicesAccessor, editor: IUntypedEditorInput, preferredGroup: Exclude<PreferredGroup, AUX_WINDOW_GROUP_TYPE | MODAL_GROUP_TYPE> | undefined): FindGroupResult;
export function findGroup(accessor: ServicesAccessor, editor: EditorInputWithOptions, preferredGroup: Exclude<PreferredGroup, AUX_WINDOW_GROUP_TYPE | MODAL_GROUP_TYPE> | undefined): FindGroupResult;
export function findGroup(accessor: ServicesAccessor, editor: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: Exclude<PreferredGroup, AUX_WINDOW_GROUP_TYPE | MODAL_GROUP_TYPE> | undefined): FindGroupResult;
export function findGroup(accessor: ServicesAccessor, editor: IUntypedEditorInput, preferredGroup: AUX_WINDOW_GROUP_TYPE | MODAL_GROUP_TYPE): Promise<[IEditorGroup, EditorActivation | undefined]>;
export function findGroup(accessor: ServicesAccessor, editor: EditorInputWithOptions, preferredGroup: AUX_WINDOW_GROUP_TYPE | MODAL_GROUP_TYPE): Promise<[IEditorGroup, EditorActivation | undefined]>;
export function findGroup(accessor: ServicesAccessor, editor: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: AUX_WINDOW_GROUP_TYPE | MODAL_GROUP_TYPE): Promise<[IEditorGroup, EditorActivation | undefined]>;
export function findGroup(accessor: ServicesAccessor, editor: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: PreferredGroup | undefined): FindGroupResult;
export function findGroup(accessor: ServicesAccessor, editor: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: PreferredGroup | undefined): FindGroupResult {
	const editorGroupService = accessor.get(IEditorGroupsService);
	const configurationService = accessor.get(IConfigurationService);
	const previewCategoryService = accessor.get(IPreviewCategoryService);

	const group = doFindGroup(editor, preferredGroup, editorGroupService, configurationService, previewCategoryService);
	if (group instanceof Promise) {
		return group.then(group => handleGroupResult(group, editor, preferredGroup, editorGroupService, configurationService, previewCategoryService));
	}

	return handleGroupResult(group, editor, preferredGroup, editorGroupService, configurationService, previewCategoryService);
}

function handleGroupResult(group: IEditorGroup, editor: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: PreferredGroup | undefined, editorGroupService: IEditorGroupsService, configurationService: IConfigurationService, previewCategoryService: IPreviewCategoryService): FindGroupResult {
	const editorInput = isEditorInputWithOptions(editor) ? editor.editor : isEditorInput(editor) ? editor : undefined;

	const conversationExplicitOpen = !!editorInput
		&& !isBlockedFromConversationGroup(editorInput)
		&& isConversationPreferredGroup(preferredGroup);

	if (isGroupInExcludedPart(group, editorGroupService) && !conversationExplicitOpen) {
		group = editorGroupService.mainPart.activeGroup;
	}

	if (editorInput && isBlockedFromConversationGroup(editorInput)) {
		if (isConversationPreferredGroup(preferredGroup) || isGroupInExcludedPart(group, editorGroupService)) {
			group = editorGroupService.mainPart.activeGroup;
		}
	} else if (editorInput && (isConversationChatInput(editorInput) || isConversationDiffReviewInput(editorInput))) {
		if (!isConversationPreferredGroup(preferredGroup) && !isGroupInConversationPart(group, editorGroupService)) {
			throw new Error('Conversation chat input requires CONVERSATION_GROUP or a conversation editor group');
		}
	}

	const modalEditorPart = editorGroupService.activeModalEditorPart;
	const modalEditorMode = configurationService.getValue<UseModalEditorMode>(USE_MODAL_EDITOR_SETTING);
	const editorInputForModal = isEditorInputWithOptions(editor) ? editor.editor : isEditorInput(editor) ? editor : undefined;
	// The `RequiresModal` capability is honored unless the user has explicitly
	// disabled modal editors via `workbench.editor.useModal: 'off'`, in which
	// case the user preference wins.
	const requiresModal = editorInputForModal instanceof EditorInput && editorInputForModal.hasCapability(EditorInputCapabilities.RequiresModal) && modalEditorMode !== 'off';
	if (modalEditorPart && preferredGroup !== MODAL_GROUP && modalEditorMode !== 'all' && !requiresModal) {
		// Only allow to open in modal group if MODAL_GROUP is explicitly requested
		// or when the setting is configured to open all editors modal or when the
		// editor has the RequiresModal capability.
		return handleModalEditorPart(group, editor, modalEditorPart, editorGroupService, preferredGroup, previewCategoryService);
	}

	return finishGroupRouting(group, editor, preferredGroup, editorGroupService, previewCategoryService);
}

async function handleModalEditorPart(group: IEditorGroup, editor: EditorInputWithOptions | IUntypedEditorInput, modalEditorPart: IModalEditorPart, editorGroupService: IEditorGroupsService, preferredGroup: PreferredGroup | undefined, previewCategoryService: IPreviewCategoryService): Promise<[IEditorGroup, EditorActivation | undefined]> {
	const options = editor.options;

	// If the resolved group is part of the modal, redirect
	// to the main window active group instead
	if (modalEditorPart.groups.some(modalGroup => modalGroup.id === group.id)) {
		group = editorGroupService.mainPart.activeGroup;
	}

	// Try to close the modal editor part unless preserveFocus is set
	if (!options?.preserveFocus) {
		await modalEditorPart.close();
	}

	return finishGroupRouting(group, editor, preferredGroup, editorGroupService, previewCategoryService);
}

function finishGroupRouting(group: IEditorGroup, editor: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: PreferredGroup | undefined, editorGroupService: IEditorGroupsService, previewCategoryService: IPreviewCategoryService): [IEditorGroup, EditorActivation | undefined] {
	const routed = routePreviewCategory(group, editor, preferredGroup, editorGroupService, previewCategoryService);
	return handleGroupActivation(routed, editor, preferredGroup, editorGroupService);
}

function handleGroupActivation(group: IEditorGroup, editor: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: PreferredGroup | undefined, editorGroupService: IEditorGroupsService): [IEditorGroup, EditorActivation | undefined] {
	const part = editorGroupService.getPart(group);
	if (editor.options?.inactive && isPreviewCategoryRoutingPart(part) && !part.isGroupVisible(group)) {
		// Background open must not activate a hidden category group, or the
		// part would switch categories to reveal it.
		return [group, EditorActivation.PRESERVE];
	}

	// Resolve editor activation strategy
	let activation: EditorActivation | undefined = undefined;
	if (
		editorGroupService.activeGroup !== group && 		// only if target group is not already active
		editor.options && !editor.options.inactive &&		// never for inactive editors
		editor.options.preserveFocus &&						// only if preserveFocus
		typeof editor.options.activation !== 'number' &&	// only if activation is not already defined (either true or false)
		preferredGroup !== SIDE_GROUP						// never for the SIDE_GROUP
	) {
		// If the resolved group is not the active one, we typically
		// want the group to become active. There are a few cases
		// where we stay away from encorcing this, e.g. if the caller
		// is already providing `activation`.
		//
		// Specifically for historic reasons we do not activate a
		// group is it is opened as `SIDE_GROUP` with `preserveFocus:true`.
		// repeated Alt-clicking of files in the explorer always open
		// into the same side group and not cause a group to be created each time.
		activation = EditorActivation.ACTIVATE;
	}

	return [group, activation];
}

function doFindGroup(input: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: PreferredGroup | undefined, editorGroupService: IEditorGroupsService, configurationService: IConfigurationService, previewCategoryService: IPreviewCategoryService): Promise<IEditorGroup> | IEditorGroup {
	let group: Promise<IEditorGroup> | IEditorGroup | undefined;
	const editor = isEditorInputWithOptions(input) ? input.editor : input;
	const options = input.options;

	// Group: Force modal if the editor has the RequiresModal capability,
	// but respect `workbench.editor.useModal: 'off'` as an explicit opt-out.
	if (isEditorInput(editor) && editor.hasCapability(EditorInputCapabilities.RequiresModal) && configurationService.getValue<UseModalEditorMode>(USE_MODAL_EDITOR_SETTING) !== 'off') {
		group = editorGroupService.createModalEditorPart(options?.modal)
			.then(part => part.activeGroup);
	}

	// Group: Instance of Group
	else if (preferredGroup && typeof preferredGroup !== 'number') {
		group = preferredGroup;
	}

	// Group: Specific Group
	else if (typeof preferredGroup === 'number' && preferredGroup >= 0) {
		group = editorGroupService.getGroup(preferredGroup);
	}

	// Group: Side by Side (Preview only — never split Conversation parts)
	else if (preferredGroup === SIDE_GROUP) {
		const direction = preferredSideBySideGroupDirection(configurationService);
		const main = editorGroupService.mainPart;
		if (isPreviewCategoryRoutingPart(main)) {
			group = splitPreviewCategoryGroup(main, editor, direction, previewCategoryService);
		} else {
			let candidateGroup = main.findGroup({ direction }, main.activeGroup, false);
			if (!candidateGroup || isGroupLockedForEditor(candidateGroup, editor)) {
				candidateGroup = main.addGroup(main.activeGroup, direction);
			}

			group = candidateGroup;
		}
	}

	// Group: Conversation active group
	else if (preferredGroup === CONVERSATION_GROUP) {
		const conversationPart = editorGroupService.getActiveConversationEditorPart();
		if (!conversationPart) {
			throw new Error('No conversation editor part is available');
		}
		group = conversationPart.activeGroup;
	}

	// Group: Conversation side group
	else if (preferredGroup === CONVERSATION_SIDE_GROUP) {
		const conversationPart = editorGroupService.getActiveConversationEditorPart();
		if (!conversationPart) {
			throw new Error('No conversation editor part is available');
		}
		const direction = preferredSideBySideGroupDirection(configurationService);
		let candidateGroup = conversationPart.findGroup({ direction }, conversationPart.activeGroup, false);
		if (!candidateGroup) {
			candidateGroup = conversationPart.addGroup(conversationPart.activeGroup, direction);
		}
		group = candidateGroup;
	}

	// Group: Aux Window
	else if (preferredGroup === AUX_WINDOW_GROUP) {
		group = editorGroupService.createAuxiliaryEditorPart(options?.auxiliary)
			.then(group => group.activeGroup);
	}

	// Group: Modal (gated behind a setting)
	else if (preferredGroup === MODAL_GROUP && configurationService.getValue<UseModalEditorMode>(USE_MODAL_EDITOR_SETTING) !== 'off') {
		group = editorGroupService.createModalEditorPart(options?.modal)
			.then(part => part.activeGroup);
	}

	// Group: Unspecified without a specific index to open
	else if (!options || typeof options.index !== 'number') {
		const groupsByLastActive = editorGroupService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE);

		// Respect option to reveal an editor if it is already visible in any group
		if (options?.revealIfVisible) {
			for (const lastActiveGroup of groupsByLastActive) {
				if (isActive(lastActiveGroup, editor)) {
					group = lastActiveGroup;
					break;
				}
			}
		}

		// Respect option to reveal an editor if it is open (not necessarily visible)
		// Still prefer to reveal an editor in a group where the editor is active though.
		// We also try to reveal an editor if it has the `ForceReveal` or `Singleton`
		// capability which indicates that editor prefers to be revealed.
		if (!group) {
			if (options?.revealIfOpened || configurationService.getValue<boolean>('workbench.editor.revealIfOpen') || (isEditorInput(editor) && (editor.hasCapability(EditorInputCapabilities.ForceReveal) || editor.hasCapability(EditorInputCapabilities.Singleton)))) {
				let groupWithInputActive: IEditorGroup | undefined = undefined;
				let groupWithInputOpened: IEditorGroup | undefined = undefined;

				for (const group of groupsByLastActive) {
					if (isOpened(group, editor)) {
						if (!groupWithInputOpened) {
							groupWithInputOpened = group;
						}

						if (!groupWithInputActive && group.isActive(editor)) {
							groupWithInputActive = group;
						}
					}

					if (groupWithInputOpened && groupWithInputActive) {
						break; // we found all groups we wanted
					}
				}

				// Prefer a target group where the input is visible
				group = groupWithInputActive || groupWithInputOpened;
			}
		}
	}

	// Force modal editor part: redirect to the modal group when setting is 'on'
	if (!group && configurationService.getValue<UseModalEditorMode>(USE_MODAL_EDITOR_SETTING) === 'all') {
		group = editorGroupService.createModalEditorPart(options?.modal)
			.then(part => part.activeGroup);
	}

	// Fallback to active group if target not valid but avoid
	// locked editor groups unless editor is already opened there
	if (!group) {
		const typedEditor = isEditorInputWithOptions(editor) ? editor.editor : isEditorInput(editor) ? editor : undefined;

		if (typedEditor && (isConversationChatInput(typedEditor) || isConversationDiffReviewInput(typedEditor))) {
			throw new Error('Conversation chat input requires an explicit conversation group target');
		}

		let candidateGroup = editorGroupService.activeGroup;
		if (isBlockedFromConversationGroup(editor) || isGroupInExcludedPart(candidateGroup, editorGroupService)) {
			candidateGroup = editorGroupService.mainPart.activeGroup;
		}

		// Locked group: find the next non-locked group
		// going up the neigbours of the group or create
		// a new group otherwise
		if (isGroupLockedForEditor(candidateGroup, editor)) {
			for (const partGroup of editorGroupService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
				if (isGroupLockedForEditor(partGroup, editor)) {
					continue;
				}

				candidateGroup = partGroup;
				break;
			}

			if (isGroupLockedForEditor(candidateGroup, editor)) {
				// Group is still locked, so we have to create a new
				// group to the side of the candidate group
				group = editorGroupService.mainPart.addGroup(candidateGroup, preferredSideBySideGroupDirection(configurationService));
			} else {
				group = candidateGroup;
			}
		}

		// Non-locked group: take as is
		else {
			group = candidateGroup;
		}
	}

	return group;
}

function splitPreviewCategoryGroup(part: IPreviewCategoryRoutingPart, editor: EditorInput | IUntypedEditorInput, direction: GroupDirection, previewCategoryService: IPreviewCategoryService): IEditorGroup {
	const category = previewCategoryService.getCategoryForInput(isEditorInputWithOptions(editor) ? editor.editor : editor);
	const anchor = part.getMostRecentGroup(category) ?? part.ensureCategoryGroup(category);
	// SIDE_GROUP splits inside the category even when the anchor is empty.
	// Reusing that empty group made "Open to the Side" a no-op on a fresh
	// category, which is the usual Code group at startup.
	let candidate = part.findGroup({ direction }, anchor, false);
	if (!candidate || part.getGroupCategory(candidate) !== category || isGroupLockedForEditor(candidate, editor)) {
		candidate = part.addGroupInCategory(anchor, direction, category);
	}

	return candidate;
}

function routePreviewCategory(group: IEditorGroup, editor: EditorInputWithOptions | IUntypedEditorInput, preferredGroup: PreferredGroup | undefined, editorGroupService: IEditorGroupsService, previewCategoryService: IPreviewCategoryService): IEditorGroup {
	const main = editorGroupService.mainPart;
	if (!isPreviewCategoryRoutingPart(main) || editorGroupService.getPart(group) !== main) {
		return group;
	}

	const options = editor.options;
	const input = isEditorInputWithOptions(editor) ? editor.editor : editor;
	const inactive = !!options?.inactive;

	if (preferredGroup === SIDE_GROUP) {
		const category = previewCategoryService.getCategoryForInput(input);
		return finishPreviewRoute(main, group, category, inactive);
	}

	if (isOpened(group, input)) {
		const category = main.getGroupCategory(group) ?? previewCategoryService.getCategoryForInput(input);
		return finishPreviewRoute(main, group, category, inactive);
	}

	// Re-opening an editor that already lives in some (possibly hidden) group
	// stays there, unless the caller named a different group.
	if (!isExplicitGroupTarget(preferredGroup)) {
		const existing = findOpenedInPart(main, input);
		if (existing) {
			const category = main.getGroupCategory(existing) ?? previewCategoryService.getCategoryForInput(input);
			return finishPreviewRoute(main, existing, category, inactive);
		}
	}

	const category = previewCategoryService.getCategoryForInput(input);
	let target = group;
	if (main.getGroupCategory(group) !== category) {
		target = main.getMostRecentGroup(category) ?? main.ensureCategoryGroup(category);
	}

	return finishPreviewRoute(main, target, category, inactive);
}

function finishPreviewRoute(part: IPreviewCategoryRoutingPart, group: IEditorGroup, category: PreviewCategory, inactive: boolean): IEditorGroup {
	// A user-initiated open reveals the category. An inactive open leaves the
	// current category and marks the target, including when the editor is already open.
	if (!inactive) {
		part.revealCategory(category, group);
	} else {
		part.markCategoryHint(category);
	}

	return group;
}

function isExplicitGroupTarget(preferredGroup: PreferredGroup | undefined): boolean {
	return (typeof preferredGroup === 'number' && preferredGroup >= 0) || (!!preferredGroup && typeof preferredGroup !== 'number');
}

function findOpenedInPart(part: IPreviewCategoryRoutingPart, editor: EditorInput | IUntypedEditorInput): IEditorGroup | undefined {
	let opened: IEditorGroup | undefined;
	for (const candidate of part.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
		if (!isOpened(candidate, editor)) {
			continue;
		}
		if (!opened) {
			opened = candidate;
		}
		if (candidate.isActive(editor)) {
			return candidate;
		}
	}

	return opened;
}

function isGroupInExcludedPart(group: IEditorGroup, editorGroupService: IEditorGroupsService): boolean {
	const part = editorGroupService.getPart(group);
	return isExcludedFromGlobalEditorAggregation(part);
}

function isGroupInConversationPart(group: IEditorGroup, editorGroupService: IEditorGroupsService): boolean {
	const part = editorGroupService.getPart(group);
	return part.excludeFromGlobalEditorAggregation === true;
}

function isGroupLockedForEditor(group: IEditorGroup, editor: EditorInput | IUntypedEditorInput): boolean {
	if (!group.isLocked) {
		// only relevant for locked editor groups
		return false;
	}

	if (isOpened(group, editor)) {
		// special case: the locked group contains
		// the provided editor. in that case we do not want
		// to open the editor in any different group.
		return false;
	}

	// group is locked for this editor
	return true;
}

function isActive(group: IEditorGroup, editor: EditorInput | IUntypedEditorInput): boolean {
	if (!group.activeEditor) {
		return false;
	}

	return group.activeEditor.matches(editor);
}

function isOpened(group: IEditorGroup, editor: EditorInput | IUntypedEditorInput): boolean {
	for (const typedEditor of group.editors) {
		if (typedEditor.matches(editor)) {
			return true;
		}
	}

	return false;
}
