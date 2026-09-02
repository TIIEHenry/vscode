/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * a11y RWD-1 / Q6：宽度档来自叶级 `ConversationEditorPane.layout(dimension).width`，
 * 不是 `ConversationPart` 宽。并列叶各自判定；split / overlay 用各自宿主宽。
 */
export const CONVERSATION_LEAF_FULL_WIDTH = 900;
export const CONVERSATION_LEAF_NARROW_WIDTH = 600;
export const CONVERSATION_LEAF_COMPACT_WIDTH = 300;

export type ConversationLeafWidthBucket = 'full' | 'medium' | 'narrow' | 'min';

export function conversationLeafWidthBucket(width: number): ConversationLeafWidthBucket {
	if (width >= CONVERSATION_LEAF_FULL_WIDTH) {
		return 'full';
	}
	if (width >= CONVERSATION_LEAF_NARROW_WIDTH) {
		return 'medium';
	}
	if (width >= CONVERSATION_LEAF_COMPACT_WIDTH) {
		return 'narrow';
	}
	return 'min';
}

export function isConversationLeafNarrow(width: number): boolean {
	return width > 0 && width < CONVERSATION_LEAF_NARROW_WIDTH;
}

export function isConversationLeafCompact(width: number): boolean {
	return width > 0 && width < CONVERSATION_LEAF_COMPACT_WIDTH;
}
