/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentAgentProfileDetail } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function quoteYamlValue(value: string): string {
	if (/[:#\n\r]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
		return JSON.stringify(value);
	}
	return value;
}

function parseSimpleFrontmatter(block: string): Record<string, string> {
	const result: Record<string, string> = {};
	for (const line of block.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			continue;
		}
		const separator = trimmed.indexOf(':');
		if (separator <= 0) {
			continue;
		}
		const key = trimmed.slice(0, separator).trim();
		let value = trimmed.slice(separator + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith('\'') && value.endsWith('\''))) {
			value = value.slice(1, -1);
		}
		result[key] = value;
	}
	return result;
}

/** Compose editable AGENTS.md text from engine profile fields. */
export function formatAgentsMarkdown(profile: Pick<UniverseAgentAgentProfileDetail, 'summary' | 'usage' | 'detailLevel' | 'systemPrompt' | 'description'>): string {
	const raw = profile.systemPrompt ?? '';
	if (raw.startsWith('---')) {
		return raw;
	}

	const frontmatterLines: string[] = [];
	if (profile.summary) {
		frontmatterLines.push(`summary: ${quoteYamlValue(profile.summary)}`);
	}
	if (profile.usage) {
		frontmatterLines.push(`usage: ${quoteYamlValue(profile.usage)}`);
	}
	if (profile.detailLevel) {
		frontmatterLines.push(`detailLevel: ${quoteYamlValue(profile.detailLevel)}`);
	}
	if (profile.description) {
		frontmatterLines.push(`description: ${quoteYamlValue(profile.description)}`);
	}

	if (frontmatterLines.length === 0) {
		return raw;
	}

	return `---\n${frontmatterLines.join('\n')}\n---\n${raw}`;
}

/** Parse AGENTS.md editor text into SaveAgentProfile profile fields. */
export function parseAgentsMarkdown(content: string): Partial<UniverseAgentAgentProfileDetail> {
	const trimmed = content.trimStart();
	if (!trimmed.startsWith('---')) {
		return { systemPrompt: content };
	}

	const match = FRONTMATTER_PATTERN.exec(content);
	if (!match) {
		return { systemPrompt: content };
	}

	const frontmatter = parseSimpleFrontmatter(match[1]);
	const body = match[2];
	const updates: Partial<UniverseAgentAgentProfileDetail> = { systemPrompt: body };

	if (frontmatter.summary !== undefined) {
		updates.summary = frontmatter.summary;
	}
	if (frontmatter.usage !== undefined) {
		updates.usage = frontmatter.usage;
	}
	if (frontmatter.detailLevel !== undefined) {
		updates.detailLevel = frontmatter.detailLevel;
	}
	if (frontmatter.description !== undefined) {
		updates.description = frontmatter.description;
	}

	return updates;
}
