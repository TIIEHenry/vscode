/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type {
	UniverseAgentSkillSource,
	UniverseAgentSkillSummary,
} from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import {
	type EngineCatalogPaneMode,
	getCatalogUnsupportedCopy,
	getCatalogUnknownCopy,
	resolveEngineCatalogPaneMode,
	shouldHideCatalogRows,
} from './engineCatalog.js';

/** Engine Skills pane rendering mode (customizations-engine §2 / §8.3). */
export type EngineSkillsPaneMode = EngineCatalogPaneMode;

export const resolveEngineSkillsPaneMode = resolveEngineCatalogPaneMode;

export function getSkillsUnsupportedCopy(reason?: string): string {
	return getCatalogUnsupportedCopy(localize('ua.engineSkillsFeatureLabel', "a skills API"), reason);
}

export const getSkillsUnknownCopy = getCatalogUnknownCopy;

export function canEditSkillBody(source: UniverseAgentSkillSource): boolean {
	return source === 'user' || source === 'project';
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

/**
 * @deprecated E2-1 abolished hide-on-disconnect. Use canShowCatalogRows.
 * Kept so unnamed engineSkillCatalog tests compile.
 */
export const shouldHideSkillCatalogRows = shouldHideCatalogRows;

export function getDefaultNewSkillName(): string {
	return `new-skill-${Date.now()}`;
}

export function getDefaultNewSkillContent(skillName: string): string {
	return [
		'---',
		'enabled: true',
		'---',
		`# ${skillName}`,
		'',
		localize('ua.engineSkillNewDefaultBody', "Describe what this skill does."),
	].join('\n');
}
