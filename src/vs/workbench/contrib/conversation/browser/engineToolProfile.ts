/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentAgentProfileDetail,
	UniverseAgentAgentProfileSummary,
	UniverseAgentToolSummary,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

export type EngineToolCatalogGroup = 'engine' | 'client';

export function toolEnablementPendingKey(profileId: string, toolName: string): string {
	return `${profileId}\u0000${toolName}`;
}

/** Client-tool vs engine built-in; never invents Copilot CLI names. */
export function getToolCatalogGroup(tool: UniverseAgentToolSummary): EngineToolCatalogGroup {
	const category = (tool.category ?? '').toLowerCase();
	return category.includes('client') ? 'client' : 'engine';
}

export function groupToolsForCatalog(tools: readonly UniverseAgentToolSummary[]): ReadonlyArray<{
	readonly group: EngineToolCatalogGroup;
	readonly tools: readonly UniverseAgentToolSummary[];
}> {
	const engine: UniverseAgentToolSummary[] = [];
	const client: UniverseAgentToolSummary[] = [];
	for (const tool of tools) {
		if (getToolCatalogGroup(tool) === 'client') {
			client.push(tool);
		} else {
			engine.push(tool);
		}
	}
	const groups: Array<{ readonly group: EngineToolCatalogGroup; readonly tools: readonly UniverseAgentToolSummary[] }> = [];
	if (engine.length > 0) {
		groups.push({ group: 'engine', tools: engine });
	}
	if (client.length > 0) {
		groups.push({ group: 'client', tools: client });
	}
	return groups;
}

export function isToolEnabledInProfile(
	toolName: string,
	profile: Pick<UniverseAgentAgentProfileSummary, 'disabledTools' | 'enabledTools' | 'whitelistMode'>,
): boolean {
	if (profile.whitelistMode) {
		return (profile.enabledTools ?? []).includes(toolName);
	}
	return !(profile.disabledTools ?? []).includes(toolName);
}

export function applyToolEnablementChange(
	profile: UniverseAgentAgentProfileDetail,
	toolName: string,
	enabled: boolean,
): UniverseAgentAgentProfileDetail {
	const disabledTools = new Set(profile.disabledTools ?? []);
	const enabledTools = new Set(profile.enabledTools ?? []);
	const whitelistMode = profile.whitelistMode === true;

	if (whitelistMode) {
		if (enabled) {
			enabledTools.add(toolName);
		} else {
			enabledTools.delete(toolName);
		}
	} else if (enabled) {
		disabledTools.delete(toolName);
	} else {
		disabledTools.add(toolName);
	}

	return {
		...profile,
		disabledTools: [...disabledTools],
		enabledTools: [...enabledTools],
		whitelistMode,
	};
}

export function applyToolEnablementChanges(
	profile: UniverseAgentAgentProfileDetail,
	changes: ReadonlyArray<{ readonly toolName: string; readonly enabled: boolean }>,
): UniverseAgentAgentProfileDetail {
	let next = profile;
	for (const change of changes) {
		next = applyToolEnablementChange(next, change.toolName, change.enabled);
	}
	return next;
}

export function summaryToProfileDetail(summary: UniverseAgentAgentProfileSummary): UniverseAgentAgentProfileDetail {
	return {
		id: summary.id,
		name: summary.name,
		source: summary.source,
		summary: summary.summary,
		enabled: summary.enabled,
		disabledTools: summary.disabledTools ? [...summary.disabledTools] : undefined,
		enabledTools: summary.enabledTools ? [...summary.enabledTools] : undefined,
		whitelistMode: summary.whitelistMode,
	};
}
