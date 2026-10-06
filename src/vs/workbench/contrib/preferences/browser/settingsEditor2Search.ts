/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { FEATURE_SETTING_TAG } from '../common/preferences.js';

export const enum AiSearchToggleVisibilityUpdate {
	None = 0,
	Insert = 1,
	Remove = 2,
}

/**
 * Whether the AI results toggle should be inserted at index 0, removed from the bar, or left unchanged.
 */
export function planAiSearchToggleVisibilityUpdate(alreadyVisible: boolean, canShowToggle: boolean): AiSearchToggleVisibilityUpdate {
	if (!alreadyVisible && canShowToggle) {
		return AiSearchToggleVisibilityUpdate.Insert;
	}
	if (alreadyVisible && !canShowToggle) {
		return AiSearchToggleVisibilityUpdate.Remove;
	}
	return AiSearchToggleVisibilityUpdate.None;
}

export const enum AiSearchToggleOutcomeKind {
	Noop = 0,
	AnnounceNoAiResults = 1,
	Toggle = 2,
}

export interface AiSearchToggleOutcome {
	readonly kind: AiSearchToggleOutcomeKind;
	readonly nextChecked?: boolean;
}

/**
 * Command-path toggle for the AI results action (not mouse/keyboard on the disabled control).
 */
export function planAiSearchToggle(actionInBar: boolean, enabled: boolean, checked: boolean): AiSearchToggleOutcome {
	if (!actionInBar) {
		return { kind: AiSearchToggleOutcomeKind.Noop };
	}
	if (!enabled) {
		return { kind: AiSearchToggleOutcomeKind.AnnounceNoAiResults };
	}
	return { kind: AiSearchToggleOutcomeKind.Toggle, nextChecked: !checked };
}

export interface SettingsSearchFilterDimensions {
	tagFilters?: Set<string>;
	extensionFilters?: Set<string>;
	featureFilters?: Set<string>;
	idFilters?: Set<string>;
	languageFilter?: string | undefined;
}

/** Matches dimensions used in {@link SettingsEditor2.triggerSearch} filter-model path. */
export function shouldShowSettingsClearFiltersLink(filters: SettingsSearchFilterDimensions): boolean {
	if (filters.tagFilters && filters.tagFilters.size > 0) {
		return true;
	}
	if (filters.extensionFilters && filters.extensionFilters.size > 0) {
		return true;
	}
	if (filters.featureFilters && filters.featureFilters.size > 0) {
		return true;
	}
	if (filters.idFilters && filters.idFilters.size > 0) {
		return true;
	}
	if (filters.languageFilter) {
		return true;
	}
	return false;
}

const FEATURE_FILTER_PREFIX = `@${FEATURE_SETTING_TAG}`;

/**
 * Removes @-filter tokens from a settings search query, keeping plain search words.
 * Strips suggestion prefixes and any `@feature:` token (including values not in suggestions).
 */
export function stripSettingsSearchFilterTokens(query: string, suggestions: readonly string[]): string {
	const splitQuery = query.split(' ').filter(word => {
		if (!word.length) {
			return false;
		}
		if (suggestions.some(suggestion => word.startsWith(suggestion))) {
			return false;
		}
		if (word.startsWith(FEATURE_FILTER_PREFIX)) {
			return false;
		}
		return true;
	});
	return splitQuery.join(' ');
}
