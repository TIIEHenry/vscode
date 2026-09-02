/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';

export type EnginePreferencesSectionId =
	| 'overview'
	| 'providerModel'
	| 'skills'
	| 'agents'
	| 'rules'
	| 'hooks'
	| 'mcpServers'
	| 'plugins'
	| 'tools';

export interface EnginePreferencesNavEntry {
	readonly id: EnginePreferencesSectionId;
	readonly label: string;
}

export const ENGINE_PREFERENCES_NAV_ENTRIES: readonly EnginePreferencesNavEntry[] = [
	{ id: 'overview', label: localize('ua.engineNavOverview', "Overview") },
	{ id: 'providerModel', label: localize('ua.engineNavProviderModel', "Provider & Model") },
	{ id: 'skills', label: localize('ua.engineNavSkills', "Skills") },
	{ id: 'agents', label: localize('ua.engineNavAgents', "Agents") },
	{ id: 'rules', label: localize('ua.engineNavRules', "Rules") },
	{ id: 'hooks', label: localize('ua.engineNavHooks', "Hooks") },
	{ id: 'mcpServers', label: localize('ua.engineNavMcpServers', "MCP Servers") },
	{ id: 'plugins', label: localize('ua.engineNavPlugins', "Plugins") },
	{ id: 'tools', label: localize('ua.engineNavTools', "Tools") },
];

export function getEnginePreferencesSectionLabel(id: EnginePreferencesSectionId): string {
	return ENGINE_PREFERENCES_NAV_ENTRIES.find(entry => entry.id === id)?.label ?? id;
}
