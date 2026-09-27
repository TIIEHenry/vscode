/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from "../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";

export type EnginePreferencesSectionId =
	| "overview"
	| "providerModel"
	| "skills"
	| "agents"
	| "rules"
	| "hooks"
	| "triggers"
	| "clipboard"
	| "contextVariables"
	| "mcpServers"
	| "plugins"
	| "tools";

export interface EnginePreferencesNavEntry {
	readonly id: EnginePreferencesSectionId;
	readonly label: string;
	readonly icon: ThemeIcon;
}

export const ENGINE_PREFERENCES_NAV_ENTRIES: readonly EnginePreferencesNavEntry[] = [
	{ id: "overview", label: localize("ua.engineNavOverview", "Overview"), icon: Codicon.home },
	{ id: "providerModel", label: localize("ua.engineNavProviderModel", "Provider & Model"), icon: Codicon.circuitBoard },
	{ id: "skills", label: localize("ua.engineNavSkills", "Skills"), icon: Codicon.lightbulb },
	{ id: "agents", label: localize("ua.engineNavAgents", "Agents"), icon: Codicon.robot },
	{ id: "rules", label: localize("ua.engineNavRules", "Rules"), icon: Codicon.book },
	{ id: "hooks", label: localize("ua.engineNavHooks", "Hooks"), icon: Codicon.symbolEvent },
	{ id: "triggers", label: localize("ua.engineNavTriggers", "Triggers"), icon: Codicon.zap },
	{ id: "clipboard", label: localize("ua.engineNavClipboard", "Clipboard"), icon: Codicon.clippy },
	{ id: "contextVariables", label: localize("ua.engineNavContextVariables", "Context Variables"), icon: Codicon.variable },
	{ id: "mcpServers", label: localize("ua.engineNavMcpServers", "MCP Servers"), icon: Codicon.server },
	{ id: "plugins", label: localize("ua.engineNavPlugins", "Plugins"), icon: Codicon.plug },
	{ id: "tools", label: localize("ua.engineNavTools", "Tools"), icon: Codicon.tools },
];

export function getEnginePreferencesSectionLabel(id: EnginePreferencesSectionId): string {
	return ENGINE_PREFERENCES_NAV_ENTRIES.find(entry => entry.id === id)?.label ?? id;
}
