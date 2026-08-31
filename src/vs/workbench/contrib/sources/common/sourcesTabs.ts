/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Sources Part L1 tab ids (Desktop IA §4: Files / Changes / Review).
 * Diff deep-view remains EDITOR_PART / PANEL_PART FORK — not a Sources tab.
 */
export const enum SourcesTabId {
	Files = 'files',
	Changes = 'changes',
	Review = 'review',
}

export const SOURCES_TAB_ORDER: readonly SourcesTabId[] = [
	SourcesTabId.Files,
	SourcesTabId.Changes,
	SourcesTabId.Review,
];

export const DEFAULT_SOURCES_TAB: SourcesTabId = SourcesTabId.Files;

export function isSourcesTabId(value: string): value is SourcesTabId {
	return value === SourcesTabId.Files || value === SourcesTabId.Changes || value === SourcesTabId.Review;
}

export function nextSourcesTab(current: SourcesTabId, direction: 1 | -1): SourcesTabId {
	const index = SOURCES_TAB_ORDER.indexOf(current);
	const nextIndex = (index + direction + SOURCES_TAB_ORDER.length) % SOURCES_TAB_ORDER.length;
	return SOURCES_TAB_ORDER[nextIndex];
}
