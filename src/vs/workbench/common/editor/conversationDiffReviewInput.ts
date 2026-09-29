/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isEditorInput, isResourceEditorInput, IUntypedEditorInput } from '../editor.js';
import { EditorInput } from './editorInput.js';

export const ConversationDiffReviewInputScheme = 'conversation-diff-review';
export const ConversationDiffReviewInputTypeId = 'workbench.editors.conversationDiffReviewInput';
export const ConversationDiffReviewEditorId = 'workbench.editor.conversationDiffReview';

/** Typed inputs match on type id only. Untyped inputs match on scheme only. */
export function isConversationDiffReviewInput(input: EditorInput | IUntypedEditorInput): boolean {
	if (isEditorInput(input)) {
		return input.typeId === ConversationDiffReviewInputTypeId;
	}

	if (isResourceEditorInput(input) && input.resource) {
		return input.resource.scheme === ConversationDiffReviewInputScheme;
	}

	return false;
}
