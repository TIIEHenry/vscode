/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { isEqual } from '../../../../base/common/resources.js';
import { EditorOpenSource, IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { isEditorInput, IEditorPane, IUntypedEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { ACTIVE_GROUP, IEditorService, PreferredGroup } from '../common/editorService.js';
import { IEditorGroup, IEditorGroupsService } from '../common/editorGroupsService.js';
import { EditorOpenSlot, planEditorOpen } from '../common/editorOpenSlot.js';

export interface IEditorOpenSlotOptions {
	readonly preserveFocus?: boolean;
	readonly source?: EditorOpenSource;
}

function resourceOf(editor: EditorInput | IUntypedEditorInput): URI | undefined {
	if (isEditorInput(editor)) {
		return editor.resource;
	}
	if ('resource' in editor && URI.isUri(editor.resource)) {
		return editor.resource;
	}
	if ('modified' in editor && editor.modified && URI.isUri(editor.modified.resource)) {
		return editor.modified.resource;
	}
	return undefined;
}

function alreadyOpenInGroup(group: IEditorGroup, editor: EditorInput | IUntypedEditorInput): boolean {
	if (isEditorInput(editor) && group.editors.some(existing => existing.matches(editor))) {
		return true;
	}
	const resource = resourceOf(editor);
	if (!resource) {
		return false;
	}
	return group.editors.some(existing => {
		const existingResource = existing.resource;
		return !!existingResource && isEqual(existingResource, resource);
	});
}

function resolveGroup(editorGroupsService: IEditorGroupsService, preferredGroup: PreferredGroup): IEditorGroup | undefined {
	if (typeof preferredGroup === 'object') {
		return preferredGroup;
	}
	if (typeof preferredGroup === 'number' && preferredGroup !== ACTIVE_GROUP) {
		return editorGroupsService.getGroup(preferredGroup) ?? editorGroupsService.activeGroup;
	}
	return editorGroupsService.activeGroup;
}

export async function openEditorInSlot(
	editorService: IEditorService,
	editorGroupsService: IEditorGroupsService,
	editor: EditorInput | IUntypedEditorInput,
	slot: EditorOpenSlot,
	options: IEditorOpenSlotOptions = {},
	preferredGroup: PreferredGroup = ACTIVE_GROUP,
): Promise<IEditorPane | undefined> {
	const group = resolveGroup(editorGroupsService, preferredGroup);
	const openOptions: IEditorOptions = {
		preserveFocus: options.preserveFocus,
		pinned: true,
		source: options.source ?? EditorOpenSource.USER,
	};
	const plan = planEditorOpen(slot, !!group?.activeEditor, !!group && alreadyOpenInGroup(group, editor));

	if (plan === 'replace' && group?.activeEditor) {
		if (isEditorInput(editor)) {
			await group.replaceEditors([{
				editor: group.activeEditor,
				replacement: editor,
				options: openOptions,
			}]);
		} else {
			const previousOptions = 'options' in editor ? editor.options : undefined;
			await editorService.replaceEditors([{
				editor: group.activeEditor,
				replacement: { ...editor, options: { ...previousOptions, ...openOptions } },
			}], group);
		}
		return group.activeEditorPane ?? undefined;
	}

	if (isEditorInput(editor)) {
		return editorService.openEditor(editor, openOptions, group ?? preferredGroup);
	}
	return editorService.openEditor({ ...editor, options: { ...editor.options, ...openOptions } }, group ?? preferredGroup);
}

export async function openResourcesInSlot(
	editorService: IEditorService,
	editorGroupsService: IEditorGroupsService,
	resources: readonly URI[],
	slot: EditorOpenSlot,
	options?: IEditorOpenSlotOptions,
): Promise<void> {
	const [first, ...rest] = resources;
	if (!first) {
		return;
	}
	await openEditorInSlot(editorService, editorGroupsService, { resource: first }, slot, options);
	for (const resource of rest) {
		await openEditorInSlot(editorService, editorGroupsService, { resource }, 'newTab', options);
	}
}
