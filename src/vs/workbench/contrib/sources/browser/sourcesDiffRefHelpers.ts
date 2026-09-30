/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename } from '../../../../base/common/resources.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { EditorResourceAccessor, isDiffEditorInput, SideBySideEditor } from '../../../common/editor.js';
import { ISCMResource, ISCMService } from '../../scm/common/scm.js';
import { ISourcesChangeRef, resolveSourcesDiffWriteGate, sourcesChangeIdentity } from '../common/sourcesChangeRef.js';
import { ISourcesChangeEntry } from '../common/sourcesChangesModel.js';
import { SourcesDiffDefaultOwner } from '../common/sourcesDiffConfiguration.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';
import { ISourcesChangeEntryOpenDeps, openSourcesChangeEntry } from './sourcesChangeEntryOpen.js';

export function resolveSourcesChangeRefFromEditor(
	editor: EditorInput,
	scmService: ISCMService,
): ISourcesChangeRef | undefined {
	if (editor instanceof ConversationDiffReviewInput) {
		const gate = resolveSourcesDiffWriteGate(scmService, {
			modified: editor.modified,
			groupId: editor.groupId,
			origin: editor.origin,
			gitPath: editor.gitPath,
		});
		return {
			modified: editor.modified,
			original: editor.original,
			groupId: gate.groupId,
			scmResource: gate.scmResource,
			...sourcesChangeIdentity(editor),
		};
	}

	if (isDiffEditorInput(editor)) {
		const modified = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.PRIMARY });
		if (!modified) {
			return undefined;
		}
		const original = EditorResourceAccessor.getOriginalUri(editor, { supportSideBySide: SideBySideEditor.SECONDARY });
		const match = findFirstScmResourceForUri(scmService, modified);
		return {
			modified,
			original,
			groupId: match?.groupId ?? '',
			scmResource: match?.resource,
		};
	}

	return undefined;
}

/** Preview `DiffEditorInput` does not carry the opened row's groupId. */
function findFirstScmResourceForUri(scmService: ISCMService, uri: { toString(): string }): { resource: ISCMResource; groupId: string } | undefined {
	const key = uri.toString();
	for (const repo of scmService.repositories) {
		for (const group of repo.provider.groups) {
			for (const resource of group.resources) {
				if (resource.sourceUri.toString() === key) {
					return { resource, groupId: group.id };
				}
			}
		}
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

export type SourcesDiffMoveHost = 'viewTitle' | 'editorTitle';

async function moveActiveDiffTo(
	owner: SourcesDiffDefaultOwner,
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
	pinned?: boolean,
): Promise<boolean | 'stale' | undefined> {
	const ref = resolveMoveHostRef(host, deps, scmService);
	if (!ref) {
		return undefined;
	}
	await closeMoveHost(host, deps, scmService);
	return openSourcesChangeEntry(sourcesChangeEntryFromRef(ref), deps, {
		owner,
		changeRef: ref,
		pinned,
	});
}

function resolveMoveHostRef(
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
): ISourcesChangeRef | undefined {
	if (host === 'viewTitle') {
		return deps.sourcesDiffPanelService.getCurrentRef();
	}

	const activeEditor = deps.editorService.activeEditor;
	if (!activeEditor) {
		return undefined;
	}
	return resolveSourcesChangeRefFromEditor(activeEditor, scmService);
}

async function closeMoveHost(
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
): Promise<void> {
	if (host === 'viewTitle') {
		deps.sourcesDiffPanelService.clear();
		return;
	}

	const activeEditor = deps.editorService.activeEditor;
	if (!activeEditor || !resolveSourcesChangeRefFromEditor(activeEditor, scmService)) {
		return;
	}
	const activeGroup = deps.editorService.activeEditorPane?.group;
	if (activeGroup) {
		await deps.editorService.closeEditor({ editor: activeEditor, groupId: activeGroup.id });
	}
}

export async function moveActiveDiffToConversation(
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
): Promise<boolean | 'stale' | undefined> {
	return moveActiveDiffTo('conversation', host, deps, scmService);
}

export async function moveActiveDiffToPreview(
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
): Promise<boolean | 'stale' | undefined> {
	return moveActiveDiffTo('preview', host, deps, scmService, true);
}

export async function moveActiveDiffToPanel(
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
): Promise<boolean | 'stale' | undefined> {
	return moveActiveDiffTo('panel', 'editorTitle', deps, scmService);
}
