/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type EditorOpenSlot = 'newTab' | 'replace';

export const EXPLORER_EDITOR_OPEN_MODE_SETTING = 'explorer.editorOpenMode';
export const SOURCES_EDITOR_OPEN_MODE_SETTING = 'sources.editorOpenMode';

export function readEditorOpenSlot(value: unknown, fallback: EditorOpenSlot): EditorOpenSlot {
	return value === 'newTab' || value === 'replace' ? value : fallback;
}

export function alternateEditorOpenSlot(slot: EditorOpenSlot): EditorOpenSlot {
	return slot === 'newTab' ? 'replace' : 'newTab';
}

/**
 * `newTab` always adds or reveals a tab.
 * `replace` reuses the active tab unless that file is already open in the group.
 */
export function planEditorOpen(slot: EditorOpenSlot, hasActiveEditor: boolean, alreadyOpen: boolean): 'open' | 'replace' {
	if (slot === 'newTab' || !hasActiveEditor || alreadyOpen) {
		return 'open';
	}
	return 'replace';
}
