/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentAgentProfileSummary, UniverseAgentModelEntry, UniverseAgentToolSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { conversationLensDockNoAgent, conversationLensDockNoModel } from './conversationLensDockStrings.js';

/** Disconnected Agent options: honest empty only. */
export const COMPOSER_AGENT_OPTIONS = [
	conversationLensDockNoAgent,
] as const;

/** Display-only Agent options: honest empty first, then engine profile names. */
export function composerAgentSelectOptions(profiles: readonly UniverseAgentAgentProfileSummary[]): { text: string }[] {
	return [
		{ text: conversationLensDockNoAgent },
		...profiles.map(profile => ({ text: profile.name.trim() || profile.id })),
	];
}

function composerModelIdsFromRegistry(models: readonly UniverseAgentModelEntry[]): string[] {
	return models.map(model => (model.modelId.trim() || model.id.trim())).filter(id => id.length > 0);
}

/** Model labels: honest empty when empty or disconnected; otherwise engine registry ids (SwitchModel modelId). */
export function composerModelSelectOptions(models: readonly UniverseAgentModelEntry[]): { text: string }[] {
	const ids = composerModelIdsFromRegistry(models);
	if (ids.length === 0) {
		return [{ text: conversationLensDockNoModel }];
	}
	return ids.map(text => ({ text }));
}

/** Index-aligned with `composerModelSelectOptions`: empty when empty or disconnected; otherwise registry ids. */
export function composerModelIds(models: readonly UniverseAgentModelEntry[]): readonly string[] {
	const ids = composerModelIdsFromRegistry(models);
	if (ids.length === 0) {
		return [''];
	}
	return ids;
}

/**
 * Index into `composerModelIds`.
 * If ids is empty or has only placeholder empty, returns 0.
 * A recorded id that is still listed keeps that row.
 * With no recorded choice (or previous id left catalog), the first enabled registry row is the default.
 * If none enabled, falls back to the first available model (index 0).
 */
export function composerModelSelectionIndex(
	ids: readonly string[],
	models: readonly UniverseAgentModelEntry[],
	previousId: string,
	explicitEmpty?: boolean,
): number {
	if (ids.length === 0 || (ids.length === 1 && ids[0] === '')) {
		return 0;
	}
	if (explicitEmpty && ids.includes('')) {
		return ids.indexOf('');
	}
	const recorded = previousId.trim();
	if (recorded) {
		const found = ids.indexOf(recorded);
		if (found >= 0) {
			return found;
		}
	}
	for (const model of models) {
		if (!model.enabled) {
			continue;
		}
		const id = model.modelId.trim() || model.id.trim();
		if (!id) {
			continue;
		}
		const found = ids.indexOf(id);
		if (found >= 0) {
			return found;
		}
	}
	return 0;
}

/** Enabled registry ids, in list order, using the same id the composer menu shows. */
export function composerEnabledModelIds(models: readonly UniverseAgentModelEntry[]): readonly string[] {
	return models
		.filter(model => model.enabled)
		.map(model => model.modelId.trim() || model.id.trim())
		.filter(id => id.length > 0);
}

export function composerToolNames(tools: readonly UniverseAgentToolSummary[]): readonly string[] {
	return tools.map(tool => tool.name.trim()).filter(name => name.length > 0);
}
