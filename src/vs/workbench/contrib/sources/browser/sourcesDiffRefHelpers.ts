/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorResourceAccessor, isDiffEditorInput, SideBySideEditor } from '../../../common/editor.js';
import { ACTIVE_GROUP, CONVERSATION_GROUP, IEditorService } from '../../../services/editor/common/editorService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { ISCMService } from '../../scm/common/scm.js';
import { findScmResourceForUri, ISourcesChangeRef } from '../common/sourcesChangeRef.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';

export function resolveSourcesChangeRefFromEditor(
	editor: EditorInput,
	scmService: ISCMService,
): ISourcesChangeRef | undefined {
	if (editor instanceof ConversationDiffReviewInput) {
		const match = findScmResourceForUri(scmService, editor.modified);
		return {
			modified: editor.modified,
			original: editor.original,
			groupId: match?.groupId ?? '',
			scmResource: match?.resource,
		};
	}

	if (isDiffEditorInput(editor)) {
		const modified = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
		if (!modified) {
			return undefined;
		}
		const original = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.SECONDARY });
		const match = findScmResourceForUri(scmService, modified);
		return {
			modified,
			original,
			groupId: match?.groupId ?? '',
			scmResource: match?.resource,
		};
	}

	return undefined;
}

export async function openSourcesChangeRefInPreview(
	ref: ISourcesChangeRef,
	editorService: IEditorService,
): Promise<void> {
	if (ref.original) {
		await editorService.openEditor({
			original: { resource: ref.original },
			modified: { resource: ref.modified },
			options: { pinned: true },
		}, ACTIVE_GROUP);
		return;
	}

	await editorService.openEditor({ resource: ref.modified }, ACTIVE_GROUP);
}

export async function openSourcesChangeRefInConversation(
	ref: ISourcesChangeRef,
	editorService: IEditorService,
	instantiationService: IInstantiationService,
): Promise<void> {
	const input = instantiationService.createInstance(
		ConversationDiffReviewInput,
		ref.modified,
		ref.original,
	);
	await editorService.openEditor(input, CONVERSATION_GROUP);
}

async function closeActiveDiffHost(editorService: IEditorService): Promise<void> {
	const activeEditor = editorService.activeEditor;
	const activeGroup = editorService.activeEditorPane?.group;
	if (!activeEditor || !activeGroup) {
		return;
	}
	await editorService.closeEditor({ editor: activeEditor, groupId: activeGroup.id });
}

export async function moveActiveDiffToConversation(
	editorService: IEditorService,
	scmService: ISCMService,
	instantiationService: IInstantiationService,
): Promise<void> {
	const activeEditor = editorService.activeEditor;
	if (!activeEditor) {
		return;
	}
	const ref = resolveSourcesChangeRefFromEditor(activeEditor, scmService);
	if (!ref) {
		return;
	}
	await closeActiveDiffHost(editorService);
	await openSourcesChangeRefInConversation(ref, editorService, instantiationService);
}

export async function moveActiveDiffToPreview(
	editorService: IEditorService,
	scmService: ISCMService,
): Promise<void> {
	const activeEditor = editorService.activeEditor;
	if (!activeEditor) {
		return;
	}
	const ref = resolveSourcesChangeRefFromEditor(activeEditor, scmService);
	if (!ref) {
		return;
	}
	await closeActiveDiffHost(editorService);
	await openSourcesChangeRefInPreview(ref, editorService);
}

export async function moveActiveDiffToPanel(
	editorService: IEditorService,
	scmService: ISCMService,
	sourcesDiffPanelService: ISourcesDiffPanelService,
): Promise<void> {
	const activeEditor = editorService.activeEditor;
	if (!activeEditor) {
		return;
	}
	const ref = resolveSourcesChangeRefFromEditor(activeEditor, scmService);
	if (!ref) {
		return;
	}
	await closeActiveDiffHost(editorService);
	await sourcesDiffPanelService.show(ref);
}
