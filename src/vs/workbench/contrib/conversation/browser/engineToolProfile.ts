/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentAgentProfileDetail, UniverseAgentAgentProfileSummary } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

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
