/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * a11y RWD-1 / Q6：宽度档来自叶级 `ConversationEditorPane.layout(dimension).width`，
 * 不是 `ConversationPart` 宽。并列叶各自判定；split / overlay 用各自宿主宽。
 */
export const CONVERSATION_LEAF_FULL_WIDTH = 900;
export const CONVERSATION_LEAF_TIGHT_WIDTH = 600;
export const CONVERSATION_LEAF_NARROW_WIDTH = 450;
export const CONVERSATION_LEAF_COMPACT_WIDTH = 300;

export const CONVERSATION_DOCK_INPUT_MAX_HEIGHT = 336;
const CONVERSATION_DOCK_INPUT_MIN_CAP = 48;
const CONVERSATION_DOCK_INPUT_LEAF_SHARE = 0.4;

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

export function isConversationLeafTight(width: number): boolean {
	return width > 0 && width < CONVERSATION_LEAF_TIGHT_WIDTH;
}

export function isConversationLeafNarrow(width: number): boolean {
	return width > 0 && width < CONVERSATION_LEAF_NARROW_WIDTH;
}

/** 450–899：栏上仍放得下图标。History / Snapshots 留在栏上，窄于 450 才收进 More。上一级与编辑器来回不收进 More。 */
export function isConversationLeafMedium(width: number): boolean {
	return width >= CONVERSATION_LEAF_NARROW_WIDTH && width < CONVERSATION_LEAF_FULL_WIDTH;
}

export function isConversationLeafCompact(width: number): boolean {
	return width > 0 && width < CONVERSATION_LEAF_COMPACT_WIDTH;
}

export function conversationDockInputMaxHeight(leafHeight: number): number {
	return Math.max(CONVERSATION_DOCK_INPUT_MIN_CAP, Math.min(CONVERSATION_DOCK_INPUT_MAX_HEIGHT, Math.floor(leafHeight * CONVERSATION_DOCK_INPUT_LEAF_SHARE)));
}

export function applyDockInputMaxHeight(dock: HTMLElement, leafHeight: number): void {
	if (!(leafHeight > 0)) {
		return;
	}
	dock.style.setProperty('--conversation-dock-input-max-height', `${conversationDockInputMaxHeight(leafHeight)}px`);
}

export function applyLeafWidthClasses(element: HTMLElement, width: number): void {
	if (!(width > 0)) {
		return;
	}
	element.dataset.conversationWidth = conversationLeafWidthBucket(width);
	element.classList.toggle('is-medium', isConversationLeafMedium(width));
	element.classList.toggle('is-narrow', isConversationLeafNarrow(width));
	element.classList.toggle('is-compact', isConversationLeafCompact(width));
	element.classList.toggle('is-tight', isConversationLeafTight(width));
}
