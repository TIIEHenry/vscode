/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentAgentProfileDetail } from '../../../../platform/universeAgent/common/universeAgentTypes.js';

export function isAgentsMarkdownDirty(current: string, loaded: string | undefined): boolean {
	return loaded !== undefined && current !== loaded;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function quoteYamlValue(value: string): string {
	// JSON string so unquoteYamlValue can restore newlines, quotes, and backslashes.
	if (/[:#\n\r"'\\]/.test(value) || value.startsWith(' ') || value.endsWith(' ')) {
		return JSON.stringify(value);
	}
	return value;
}

function unquoteYamlValue(value: string): string {
	if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
		try {
			const parsed: unknown = JSON.parse(value);
			if (typeof parsed === 'string') {
				return parsed;
			}
		} catch {
			// Hand-written quotes that are not valid JSON still save their inner text.
		}
		return value.slice(1, -1);
	}
	if (value.length >= 2 && value.startsWith('\'') && value.endsWith('\'')) {
		return value.slice(1, -1);
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
		result[key] = unquoteYamlValue(trimmed.slice(separator + 1).trim());
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

/**
 * Save payload for the AGENTS.md editor.
 * Missing summary, usage, detailLevel, and description are explicit clears so a
 * spread over the list profile cannot put the deleted value back. An unclosed
 * frontmatter block is not a clear: the parser could not see which keys the user kept.
 */
export function agentsMarkdownSaveUpdates(content: string): Partial<UniverseAgentAgentProfileDetail> {
	const parsed = parseAgentsMarkdown(content);
	const trimmed = content.trimStart();
	if (trimmed.startsWith('---') && !FRONTMATTER_PATTERN.test(content)) {
		return parsed;
	}
	return {
		summary: undefined,
		usage: undefined,
		detailLevel: undefined,
		description: undefined,
		...parsed,
	};
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
	const updates: {
		systemPrompt: string;
		summary?: string;
		usage?: string;
		detailLevel?: string;
		description?: string;
	} = { systemPrompt: body };

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
