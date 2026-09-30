/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ConversationDiffReviewInputScheme } from '../../../common/editor/conversationDiffReviewInput.js';

export function getConversationDiffReviewResource(modified: URI, original: URI | undefined, groupId: string = '', gitPath?: string): URI {
	let path = `/modified/${encodeURIComponent(modified.toString())}/original/${original ? encodeURIComponent(original.toString()) : ''}/group/${encodeURIComponent(groupId)}`;
	// Absent gitPath keeps the previous path so older tabs stay the same resource.
	if (gitPath) {
		path += `/gitPath/${encodeURIComponent(gitPath)}`;
	}
	return URI.from({
		scheme: ConversationDiffReviewInputScheme,
		path,
	});
}

/** Editor-memento payload. `gitPath` is optional so older tabs still open. WeakMap Accept patches are not in this scheme and do not survive reload. */
export interface ISerializedConversationDiffReviewInput {
	readonly modified: string;
	readonly original?: string;
	readonly groupId?: string;
	readonly gitPath?: string;
}

export function serializeConversationDiffReviewInput(input: { modified: URI; original?: URI; groupId: string; gitPath?: string }): string {
	return JSON.stringify({
		modified: input.modified.toString(),
		original: input.original?.toString(),
		groupId: input.groupId,
		gitPath: input.gitPath || undefined,
	} satisfies ISerializedConversationDiffReviewInput);
}

export function parseSerializedConversationDiffReviewInput(serialized: string): { modified: URI; original: URI | undefined; groupId: string; gitPath?: string } | undefined {
	try {
		const parsed = JSON.parse(serialized) as ISerializedConversationDiffReviewInput;
		return {
			modified: URI.parse(parsed.modified),
			original: parsed.original ? URI.parse(parsed.original) : undefined,
			groupId: parsed.groupId ?? '',
			gitPath: typeof parsed.gitPath === 'string' && parsed.gitPath ? parsed.gitPath : undefined,
		};
	} catch {
		return undefined;
	}
}

export function parseConversationDiffReviewResource(resource: URI): { modified: URI; original: URI | undefined; groupId: string; gitPath?: string } | undefined {
	if (resource.scheme !== ConversationDiffReviewInputScheme) {
		return undefined;
	}

	const match = /^\/modified\/([^/]+)\/original\/([^/]*)(?:\/group\/([^/]*))?(?:\/gitPath\/([^/]*))?$/.exec(resource.path);
	if (!match) {
		return undefined;
	}

	try {
		const modified = URI.parse(decodeURIComponent(match[1]));
		const originalRaw = match[2];
		const original = originalRaw ? URI.parse(decodeURIComponent(originalRaw)) : undefined;
		const groupId = match[3] ? decodeURIComponent(match[3]) : '';
		const gitPath = match[4] ? decodeURIComponent(match[4]) : undefined;
		return { modified, original, groupId, gitPath };
	} catch {
		return undefined;
	}
}
