/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { isEditorInput, IUntypedEditorInput, isResourceEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';

export const ConversationDiffReviewInputScheme = 'conversation-diff-review';
export const ConversationDiffReviewInputTypeId = 'workbench.editors.conversationDiffReviewInput';
export const ConversationDiffReviewEditorId = 'workbench.editor.conversationDiffReview';

export function getConversationDiffReviewResource(modified: URI, original: URI | undefined, groupId: string = ''): URI {
	return URI.from({
		scheme: ConversationDiffReviewInputScheme,
		path: `/modified/${encodeURIComponent(modified.toString())}/original/${original ? encodeURIComponent(original.toString()) : ''}/group/${encodeURIComponent(groupId)}`,
	});
}

/** Editor-memento payload. WeakMap Accept patches are not in this scheme and do not survive reload. */
export interface ISerializedConversationDiffReviewInput {
	readonly modified: string;
	readonly original?: string;
	readonly groupId?: string;
}

export function serializeConversationDiffReviewInput(input: { modified: URI; original?: URI; groupId: string }): string {
	return JSON.stringify({
		modified: input.modified.toString(),
		original: input.original?.toString(),
		groupId: input.groupId,
	} satisfies ISerializedConversationDiffReviewInput);
}

export function parseSerializedConversationDiffReviewInput(serialized: string): { modified: URI; original: URI | undefined; groupId: string } | undefined {
	try {
		const parsed = JSON.parse(serialized) as ISerializedConversationDiffReviewInput;
		return {
			modified: URI.parse(parsed.modified),
			original: parsed.original ? URI.parse(parsed.original) : undefined,
			groupId: parsed.groupId ?? '',
		};
	} catch {
		return undefined;
	}
}

export function parseConversationDiffReviewResource(resource: URI): { modified: URI; original: URI | undefined; groupId: string } | undefined {
	if (resource.scheme !== ConversationDiffReviewInputScheme) {
		return undefined;
	}

	const match = /^\/modified\/([^/]+)\/original\/([^/]*)(?:\/group\/([^/]*))?$/.exec(resource.path);
	if (!match) {
		return undefined;
	}

	try {
		const modified = URI.parse(decodeURIComponent(match[1]));
		const originalRaw = match[2];
		const original = originalRaw ? URI.parse(decodeURIComponent(originalRaw)) : undefined;
		const groupId = match[3] ? decodeURIComponent(match[3]) : '';
		return { modified, original, groupId };
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
