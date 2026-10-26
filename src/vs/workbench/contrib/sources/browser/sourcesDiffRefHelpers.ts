/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getErrorMessage } from '../../../../base/common/errors.js';
import { basename } from '../../../../base/common/resources.js';
import { hasKey } from '../../../../base/common/types.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { IEditorGroup, isEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { EditorResourceAccessor, IEditorPane, isEditorCommandsContext, isDiffEditorInput, SideBySideEditor } from '../../../common/editor.js';
import { ISCMResource, ISCMService } from '../../scm/common/scm.js';
import { findScmResourceForUri, ISourcesChangeRef, resolveSourcesDiffWriteGate, sourcesChangeIdentity } from '../common/sourcesChangeRef.js';
import { ISourcesChangeEntry } from '../common/sourcesChangesModel.js';
import { SourcesDiffDefaultOwner } from '../common/sourcesDiffConfiguration.js';
import { ConversationDiffReviewInput } from './conversationDiffReviewInput.js';
import { ISourcesChangeEntryOpenDeps, openSourcesChangeEntry, sourcesConversationLeafMissingMessage } from './sourcesChangeEntryOpen.js';
import { sourcesDiffOpenIdentity } from './sourcesDiffOpenIdentity.js';

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
		const remembered = sourcesDiffOpenIdentity(editor);
		if (remembered) {
			const match = findScmResourceForUri(scmService, modified, remembered.groupId);
			return {
				modified,
				original,
				groupId: remembered.groupId,
				scmResource: match?.resource ?? remembered.scmResource,
			};
		}
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

/** A URI in more than one group is ambiguous without the opened row's group. */
function findFirstScmResourceForUri(scmService: ISCMService, uri: { toString(): string }): { resource: ISCMResource; groupId: string } | undefined {
	const key = uri.toString();
	let match: { resource: ISCMResource; groupId: string } | undefined;
	for (const repo of scmService.repositories) {
		for (const group of repo.provider.groups) {
			for (const resource of group.resources) {
				if (resource.sourceUri.toString() === key) {
					if (match && match.groupId !== group.id) {
						return undefined;
					}
					match ??= { resource, groupId: group.id };
				}
			}
		}
	}
	return match;
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
export type SourcesDiffMoveResult = boolean | 'stale' | undefined;

/** Local Pane origin; unlike native title context, these are the original objects. */
export interface ISourcesConversationDiffMoveSource {
	readonly kind: 'conversationPane';
	readonly editor: ConversationDiffReviewInput;
	readonly group: IEditorGroup;
	readonly pane: IEditorPane;
}

function isConversationPaneSource(value: unknown): value is ISourcesConversationDiffMoveSource {
	const source = value as Partial<ISourcesConversationDiffMoveSource> | undefined;
	return source?.kind === 'conversationPane' && source.editor instanceof ConversationDiffReviewInput
		&& isEditorGroup(source.group) && !!source.pane;
}

async function moveActiveDiffTo(
	owner: SourcesDiffDefaultOwner,
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
	pinned?: boolean,
	commandArgs: readonly unknown[] = [],
): Promise<SourcesDiffMoveResult> {
	const source = captureMoveHost(host, deps, scmService, commandArgs);
	if (!source) {
		return undefined;
	}
	const { ref, close: closeHost } = source;
	try {
		const opened = await openSourcesChangeEntry(sourcesChangeEntryFromRef(ref), deps, {
			owner,
			changeRef: ref,
			pinned,
		});
		await closeHost();
		return opened;
	} catch (error) {
		if (getErrorMessage(error) !== sourcesConversationLeafMissingMessage()) {
			await closeHost();
		}
		throw error;
	}
}

/** Resolve ref and close from one origin, before any asynchronous dispatch. */
function captureMoveHost(
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
	commandArgs: readonly unknown[],
): { ref: ISourcesChangeRef; close: () => Promise<void> } | undefined {
	if (host === 'viewTitle') {
		const ref = deps.sourcesDiffPanelService.getCurrentRef();
		return ref ? { ref, close: async () => deps.sourcesDiffPanelService.clear() } : undefined;
	}

	if (commandArgs.length === 0) {
		// Compatibility for existing programmatic commands without an explicit origin.
		const editor = deps.editorService.activeEditor;
		const group = deps.editorService.activeEditorPane?.group;
		const ref = editor && resolveSourcesChangeRefFromEditor(editor, scmService);
		return ref ? { ref, close: async () => {
			if (editor && group) {
				await deps.editorService.closeEditor({ editor, groupId: group.id });
			}
		} } : undefined;
	}

	const groups = deps.editorGroupsService;
	if (!groups) {
		return undefined;
	}
	const paneArgument = commandArgs.find(arg => typeof arg === 'object' && arg !== null && hasKey(arg, { kind: true }) && arg.kind === 'conversationPane');
	const paneSource = isConversationPaneSource(paneArgument) ? paneArgument : undefined;
	if (paneArgument && !paneSource) {
		return undefined;
	}
	const context = commandArgs.find(isEditorCommandsContext);
	const group = paneSource?.group ?? (context ? groups.getGroup(context.groupId) : undefined);
	if (!group) {
		return undefined;
	}
	const index = context?.editorIndex;
	if (!paneSource && index !== undefined && (!Number.isInteger(index) || index < 0 || index >= group.editors.length)) {
		return undefined;
	}
	const editor = paneSource?.editor ?? (index === undefined ? group.activeEditor : group.editors[index]);
	if (!editor) {
		return undefined;
	}
	const part = groups.conversationParts.find(candidate => candidate.groups.includes(group));
	const sessionKey = part?.sessionKey;
	if ((paneSource || editor instanceof ConversationDiffReviewInput) && !part) {
		return undefined;
	}
	const isCurrent = () => groups.getGroup(group.id) === group && !editor.isDisposed() && group.editors.includes(editor)
		&& (!part || (groups.conversationParts.includes(part) && part.sessionKey === sessionKey && part.groups.includes(group)))
		&& (!paneSource || (paneSource.pane.group === group && paneSource.pane.input === editor && group.activeEditorPane === paneSource.pane));
	if (!isCurrent()) {
		return undefined;
	}
	const ref = resolveSourcesChangeRefFromEditor(editor, scmService);
	return ref ? { ref, close: async () => {
		if (isCurrent()) {
			await group.closeEditor(editor);
		}
	} } : undefined;
}

export async function moveActiveDiffToConversation(
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
	...commandArgs: unknown[]
): Promise<SourcesDiffMoveResult> {
	return moveActiveDiffTo('conversation', host, deps, scmService, undefined, commandArgs);
}

export async function moveActiveDiffToPreview(
	host: SourcesDiffMoveHost,
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
	...commandArgs: unknown[]
): Promise<SourcesDiffMoveResult> {
	return moveActiveDiffTo('preview', host, deps, scmService, true, commandArgs);
}

export async function moveActiveDiffToPanel(
	deps: ISourcesChangeEntryOpenDeps,
	scmService: ISCMService,
	...commandArgs: unknown[]
): Promise<SourcesDiffMoveResult> {
	return moveActiveDiffTo('panel', 'editorTitle', deps, scmService, undefined, commandArgs);
}
