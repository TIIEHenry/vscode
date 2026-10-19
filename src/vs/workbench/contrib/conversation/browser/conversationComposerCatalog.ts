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

/** Model labels: honest empty first, then engine registry ids (SwitchModel modelId). */
export function composerModelSelectOptions(models: readonly UniverseAgentModelEntry[]): { text: string }[] {
	return [
		{ text: conversationLensDockNoModel },
		...composerModelIdsFromRegistry(models).map(text => ({ text })),
	];
}

/** Index-aligned with `composerModelSelectOptions`: empty first, then registry ids. */
export function composerModelIds(models: readonly UniverseAgentModelEntry[]): readonly string[] {
	return ['', ...composerModelIdsFromRegistry(models)];
}

/**
 * Index into `composerModelIds`.
 * An explicit empty choice stays on No model.
 * A recorded id that is still listed keeps that row.
 * A recorded id that left the catalog stays on No model.
 * With no recorded choice, the first enabled registry row is the default.
 */
export function composerModelSelectionIndex(
	ids: readonly string[],
	models: readonly UniverseAgentModelEntry[],
	previousId: string,
	explicitEmpty: boolean,
): number {
	if (explicitEmpty) {
		return 0;
	}
	const recorded = previousId.trim();
	if (recorded) {
		const found = ids.indexOf(recorded);
		return found > 0 ? found : 0;
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
		if (found > 0) {
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
