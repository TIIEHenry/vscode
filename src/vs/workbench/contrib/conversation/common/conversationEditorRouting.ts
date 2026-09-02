/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { isEditorInput, IUntypedEditorInput, isResourceEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { ChatEditorInput } from '../../chat/browser/widgetHosts/editor/chatEditorInput.js';
import { isConversationDiffReviewInput } from '../../sources/common/conversationDiffReviewInput.js';
import { ConversationChatInput, ConversationChatInputScheme } from '../browser/conversationChatInput.js';

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
	if (input instanceof ChatEditorInput) {
		return true;
	}

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
