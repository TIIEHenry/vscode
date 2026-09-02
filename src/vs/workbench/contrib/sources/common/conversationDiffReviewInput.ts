/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { isEditorInput, IUntypedEditorInput, isResourceEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

export const ConversationDiffReviewInputScheme = 'conversation-diff-review';
export const ConversationDiffReviewInputTypeId = 'workbench.editors.conversationDiffReviewInput';

export function getConversationDiffReviewResource(modified: URI, original: URI | undefined): URI {
	return URI.from({
		scheme: ConversationDiffReviewInputScheme,
		path: `/modified/${encodeURIComponent(modified.toString())}/original/${original ? encodeURIComponent(original.toString()) : ''}`,
	});
}

export function parseConversationDiffReviewResource(resource: URI): { modified: URI; original: URI | undefined } | undefined {
	if (resource.scheme !== ConversationDiffReviewInputScheme) {
		return undefined;
	}

	const match = /^\/modified\/([^/]+)\/original\/(.*)$/.exec(resource.path);
	if (!match) {
		return undefined;
	}

	try {
		const modified = URI.parse(decodeURIComponent(match[1]));
		const originalRaw = match[2];
		const original = originalRaw ? URI.parse(decodeURIComponent(originalRaw)) : undefined;
		return { modified, original };
	} catch {
		return undefined;
	}
}

export function isConversationDiffReviewInput(input: EditorInput | IUntypedEditorInput): boolean {
	if (isEditorInput(input)) {
		return input.typeId === ConversationDiffReviewInputTypeId;
	}

	if (isResourceEditorInput(input) && input.resource) {
		return input.resource.scheme === ConversationDiffReviewInputScheme;
	}

	return false;
}
