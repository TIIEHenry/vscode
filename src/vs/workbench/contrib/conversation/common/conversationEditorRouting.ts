/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { isEditorInput, IUntypedEditorInput, isResourceEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { isConversationDiffReviewInput } from '../../../common/editor/conversationDiffReviewInput.js';
import { EditorGroupRouteKind, registerEditorGroupRoute } from '../../../services/editor/common/editorGroupRoute.js';
import { ConversationChatInput, ConversationChatInputScheme, getDefaultConversationChatResource } from './conversationChatInput.js';

export function isConversationChatInput(input: EditorInput | IUntypedEditorInput): boolean {
	if (input instanceof ConversationChatInput) {
		return true;
	}

	if (isEditorInput(input)) {
		return false;
	}

	if (isResourceEditorInput(input) && input.resource) {
		return input.resource.scheme === ConversationChatInputScheme;
	}

	return false;
}

export function isConversationExtensionTab(input: EditorInput): boolean {
	if (input instanceof ConversationChatInput) {
		return !input.isDefaultRoot;
	}

	return isConversationDiffReviewInput(input);
}

export function isBlockedFromConversationGroup(input: EditorInput | IUntypedEditorInput): boolean {
	if (isEditorInput(input)) {
		return !(input instanceof ConversationChatInput) && !isConversationDiffReviewInput(input);
	}

	if (isResourceEditorInput(input) && input.resource) {
		return input.resource.scheme !== ConversationChatInputScheme && !isConversationDiffReviewInput(input);
	}

	return true;
}

export function isConversationEditorGroup(groupId: number, conversationGroupIds: ReadonlySet<number>): boolean {
	return conversationGroupIds.has(groupId);
}

export function collectConversationGroupIds(parts: ReadonlyArray<{ getGroups(): ReadonlyArray<{ id: number }> }>): Set<number> {
	const ids = new Set<number>();
	for (const part of parts) {
		for (const group of part.getGroups()) {
			ids.add(group.id);
		}
	}
	return ids;
}

export function isUntypedResourceEditor(input: IUntypedEditorInput): boolean {
	return isResourceEditorInput(input) && !!input.resource && !isConversationChatInput(input);
}

export function isFileLikeResource(uri: URI): boolean {
	return uri.scheme === 'file' || uri.scheme === 'untitled' || uri.scheme === 'vscode-remote';
}

/**
 * Answer for the editor-group core. Chat and Diff review inputs are
 * `exclusive`; everything `isBlockedFromConversationGroup` is `foreign`. The
 * predicates are complementary, so nothing is left unclassified once registered.
 */
export function classifyConversationEditorInput(input: EditorInput | IUntypedEditorInput): EditorGroupRouteKind {
	if (isConversationChatInput(input) || isConversationDiffReviewInput(input)) {
		return 'exclusive';
	}

	return 'foreign';
}

// Core (`editorGroupFinder`, `EditorParts`, `ConversationEditorPartImpl`)
// learns the fence and the default root through this registration instead
// of importing this contrib module.
registerEditorGroupRoute({
	classify: classifyConversationEditorInput,
	isExtensionTab: isConversationExtensionTab,
	createDefaultRoot: (instantiationService: IInstantiationService, sessionKey: string) => instantiationService.createInstance(
		ConversationChatInput,
		getDefaultConversationChatResource(sessionKey),
		{ isDefaultRoot: true },
	),
});
