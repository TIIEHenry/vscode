/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentAgentProfileSummary, UniverseAgentModelEntry, UniverseAgentToolSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { conversationLensDockNoAgent, conversationLensDockNoModel, conversationLensDockStubAgent } from './conversationLensDockStrings.js';

/** Disconnected stub Agent options: honest empty first, then the local stub label. */
export const COMPOSER_AGENT_OPTIONS = [
	conversationLensDockNoAgent,
	conversationLensDockStubAgent,
] as const;

/** Display-only Agent options: honest empty first, then engine profile names. */
export function composerAgentSelectOptions(profiles: readonly UniverseAgentAgentProfileSummary[]): { text: string }[] {
	return [
		{ text: conversationLensDockNoAgent },
		...profiles.map(profile => ({ text: profile.name.trim() || profile.id })),
	];
}

function composerModelIdsFromRegistry(models: readonly UniverseAgentModelEntry[]): string[] {
	return models.map(model => model.modelId.trim() || model.id).filter(id => id.length > 0);
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

export function composerToolNames(tools: readonly UniverseAgentToolSummary[]): readonly string[] {
	return tools.map(tool => tool.name.trim()).filter(name => name.length > 0);
}
