/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type {
	UniverseAgentCapabilitySupport,
	UniverseAgentSkillSource,
	UniverseAgentSkillSummary,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';

/** Engine Skills pane rendering mode (customizations-engine §2 / §8.3). */
export type EngineSkillsPaneMode = 'disconnected' | 'unsupported' | 'unknown' | 'supported';

export function resolveEngineSkillsPaneMode(
	isConnected: boolean,
	skillsSupport: UniverseAgentCapabilitySupport,
): EngineSkillsPaneMode {
	if (!isConnected) {
		return 'disconnected';
	}
	if (skillsSupport === 'SUPPORTED') {
		return 'supported';
	}
	if (skillsSupport === 'UNKNOWN') {
		return 'unknown';
	}
	return 'unsupported';
}

export function getSkillsUnsupportedCopy(reason?: string): string {
	if (reason) {
		return localize(
			'ua.engineSkillsUnsupportedWithReason',
			"The current engine does not expose a skills API ({0}).",
			reason,
		);
	}
	return localize('ua.engineSkillsUnsupported', "The current engine does not expose a skills API.");
}

export function getSkillsUnknownCopy(): string {
	return localize('ua.engineSkillsUnknown', "Confirming engine skills capability…");
}

export function getSkillToggleFreezeNotice(): string {
	return localize(
		'ua.engineSkillToggleFreezeNotice',
		"Saved to the engine skill catalog. The active conversation keeps the skill table from when it started; new conversations pick up changes.",
	);
}

export function getSkillSourceGroupLabel(source: UniverseAgentSkillSource): string {
	switch (source) {
		case 'bundled':
			return localize('ua.engineSkillSourceBundled', "Built-in");
		case 'user':
			return localize('ua.engineSkillSourceUser', "User");
		case 'project':
			return localize('ua.engineSkillSourceProject', "Project");
		default:
			return localize('ua.engineSkillSourceUnknown', "Unknown");
	}
}

export function groupSkillsBySource(skills: readonly UniverseAgentSkillSummary[]): Map<UniverseAgentSkillSource, UniverseAgentSkillSummary[]> {
	const order: UniverseAgentSkillSource[] = ['bundled', 'user', 'project', 'unknown'];
	const groups = new Map<UniverseAgentSkillSource, UniverseAgentSkillSummary[]>();
	for (const source of order) {
		groups.set(source, []);
	}
	for (const skill of skills) {
		const bucket = groups.get(skill.source) ?? groups.get('unknown')!;
		bucket.push(skill);
	}
	for (const [source, entries] of groups) {
		if (entries.length === 0) {
			groups.delete(source);
		}
	}
	return groups;
}

/** True when catalog rows must not be shown (E1 negative paths). */
export function shouldHideSkillCatalogRows(mode: EngineSkillsPaneMode): boolean {
	return mode !== 'supported';
}
