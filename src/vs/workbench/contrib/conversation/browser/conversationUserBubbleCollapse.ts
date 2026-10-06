/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Singularity user-message-card §折叠状态机 — collapse when line count exceeds this. */
export const USER_BUBBLE_COLLAPSE_LINE_THRESHOLD = 6;

/** Collapsed preview shows this many lines before fade + Show more. */
export const USER_BUBBLE_PREVIEW_LINE_COUNT = 4;

/** Expanded user bubbles scroll vertically when line count exceeds this. */
export const USER_BUBBLE_EXPANDED_SCROLL_LINE_THRESHOLD = 20;

export function countTextLines(text: string): number {
	if (text.length === 0) {
		return 0;
	}
	const lines = text.split(/\r?\n/);
	if (lines.length > 1 && lines[lines.length - 1] === '') {
		return lines.length - 1;
	}
	return lines.length;
}

export function shouldCollapseUserBubble(text: string): boolean {
	return countTextLines(text) > USER_BUBBLE_COLLAPSE_LINE_THRESHOLD;
}

export function shouldScrollExpandedUserBubble(text: string): boolean {
	return countTextLines(text) > USER_BUBBLE_EXPANDED_SCROLL_LINE_THRESHOLD;
}
