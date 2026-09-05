/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentAgentProfileSummary, UniverseAgentModelEntry, UniverseAgentToolSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import { conversationLensDockNoAgent, conversationLensDockNoModel } from './conversationLensDockStrings.js';

/** Display-only Agent options: honest empty first, then engine profile names. */
export function composerAgentSelectOptions(profiles: readonly UniverseAgentAgentProfileSummary[]): { text: string }[] {
	return [
		{ text: conversationLensDockNoAgent },
		...profiles.map(profile => ({ text: profile.name.trim() || profile.id })),
	];
}

/** Display-only Model labels. Selection does not call SwitchModel. */
export function composerModelSelectOptions(models: readonly UniverseAgentModelEntry[]): { text: string }[] {
	const labels = models.map(model => model.modelId.trim() || model.id).filter(label => label.length > 0);
	return [
		{ text: conversationLensDockNoModel },
		...labels.map(text => ({ text })),
	];
}

export function composerToolNames(tools: readonly UniverseAgentToolSummary[]): readonly string[] {
	return tools.map(tool => tool.name.trim()).filter(name => name.length > 0);
}
