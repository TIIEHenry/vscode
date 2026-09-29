/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from '../../../../base/common/resources.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorResourceAccessor, isDiffEditorInput, SideBySideEditor } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ISCMService } from '../../scm/common/scm.js';
import { findScmResourceForUri, ISourcesChangeRef, sourcesChangeIdentity } from '../common/sourcesChangeRef.js';
import { ISourcesChangeEntry } from '../common/sourcesChangesModel.js';
import { SourcesDiffDefaultOwner } from '../common/sourcesDiffConfiguration.js';
import { ISourcesDiffPanelService } from '../common/sourcesDiffPanelService.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';
import { ISourcesChangeEntryOpenDeps, openSourcesChangeEntry } from './sourcesChangeEntryOpen.js';

export function resolveSourcesChangeRefFromEditor(
	editor: EditorInput,
	scmService: ISCMService,
): ISourcesChangeRef | undefined {
	if (editor instanceof ConversationDiffReviewInput) {
		const match = findScmResourceForUri(scmService, editor.modified);
		return {
			modified: editor.modified,
			original: editor.original,
			groupId: match?.groupId || editor.groupId,
			scmResource: match?.resource,
			...sourcesChangeIdentity(editor),
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

function sourcesChangeEntryFromRef(ref: ISourcesChangeRef): ISourcesChangeEntry {
	const resource = ref.scmResource?.sourceUri ?? ref.modified;
	return {
		resource,
		name: basename(resource),
		description: '',
		groupId: ref.groupId,
		scmResource: ref.scmResource,
		gitPath: ref.gitPath,
		indexState: ref.indexState,
		kind: ref.kind,
		origin: ref.origin,
		sessionId: ref.sessionId,
	};
}

async function moveActiveDiffTo(
	owner: SourcesDiffDefaultOwner,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
	pinned?: boolean,
): Promise<boolean | 'stale' | undefined> {
	const ref = resolveActiveSourcesChangeRef(deps.editorService, scmService, deps.sourcesDiffPanelService);
	if (!ref) {
		return undefined;
	}
	await closeActiveDiffHost(deps.editorService, scmService, deps.sourcesDiffPanelService);
	return openSourcesChangeEntry(sourcesChangeEntryFromRef(ref), deps, {
		owner,
		changeRef: ref,
		pinned,
	});
}

async function closeActiveDiffHost(
	editorService: IEditorService,
	scmService: ISCMService,
	sourcesDiffPanelService?: ISourcesDiffPanelService,
): Promise<void> {
	const activeEditor = editorService.activeEditor;
	if (activeEditor && resolveSourcesChangeRefFromEditor(activeEditor, scmService)) {
		const activeGroup = editorService.activeEditorPane?.group;
		if (activeGroup) {
			await editorService.closeEditor({ editor: activeEditor, groupId: activeGroup.id });
		}
		return;
	}

	if (sourcesDiffPanelService?.getCurrentRef()) {
		sourcesDiffPanelService.clear();
	}
}

function resolveActiveSourcesChangeRef(
	editorService: IEditorService,
	scmService: ISCMService,
	sourcesDiffPanelService?: ISourcesDiffPanelService,
): ISourcesChangeRef | undefined {
	const activeEditor = editorService.activeEditor;
	if (activeEditor) {
		const editorRef = resolveSourcesChangeRefFromEditor(activeEditor, scmService);
		if (editorRef) {
			return editorRef;
		}
	}

	return sourcesDiffPanelService?.getCurrentRef();
}

export async function moveActiveDiffToConversation(
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
): Promise<boolean | 'stale' | undefined> {
	return moveActiveDiffTo('conversation', deps, scmService);
}

export async function moveActiveDiffToPreview(
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
): Promise<boolean | 'stale' | undefined> {
	return moveActiveDiffTo('preview', deps, scmService, true);
}

export async function moveActiveDiffToPanel(
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
): Promise<boolean | 'stale' | undefined> {
	return moveActiveDiffTo('panel', deps, scmService);
}
