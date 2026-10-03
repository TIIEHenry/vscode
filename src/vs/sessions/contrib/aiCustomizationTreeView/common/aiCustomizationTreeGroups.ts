/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { basename, dirname, isEqual, joinPath } from '../../../../base/common/resources.js';
import { equalsIgnoreCase } from '../../../../base/common/strings.js';
import { URI } from '../../../../base/common/uri.js';
import { CLAUDE_CONFIG_FOLDER, CLAUDE_MD_FILENAME, COPILOT_CONFIG_FOLDER, COPILOT_CUSTOM_INSTRUCTIONS_FILENAME } from '../../../../workbench/contrib/chat/common/promptSyntax/config/promptFileLocations.js';
import { PromptsStorage } from '../../../../workbench/contrib/chat/common/promptSyntax/service/promptsService.js';

/**
 * Storage groups under Agents, Skills, and Instructions.
 * Plugin files are a group inside those categories. They are not a top-level
 * section. Leaving plugin out of this list drops those nodes.
 */
export const AI_CUSTOMIZATION_TREE_GROUP_STORAGES = ['local', 'user', 'plugin', 'extension', 'builtin'] as const;

export type AiCustomizationTreeGroupStorage = typeof AI_CUSTOMIZATION_TREE_GROUP_STORAGES[number];

export interface IAiCustomizationStorageGroup<T> {
	readonly storage: AiCustomizationTreeGroupStorage;
	readonly items: readonly T[];
}

export function groupCustomizationItemsByStorage<T extends { readonly storage: string }>(items: readonly T[]): IAiCustomizationStorageGroup<T>[] {
	const buckets = new Map<string, T[]>();
	for (const item of items) {
		const existing = buckets.get(item.storage);
		if (existing) {
			existing.push(item);
		} else {
			buckets.set(item.storage, [item]);
		}
	}

	const groups: IAiCustomizationStorageGroup<T>[] = [];
	for (const storage of AI_CUSTOMIZATION_TREE_GROUP_STORAGES) {
		const grouped = buckets.get(storage);
		if (grouped && grouped.length > 0) {
			groups.push({ storage, items: grouped });
		}
	}
	return groups;
}

/**
 * Storage for an agent-instruction file that is not already in the prompt-file
 * list. `listAgentInstructions` also returns `~/.claude/CLAUDE.md` and
 * `~/.copilot/copilot-instructions.md`. Those are user files. Workspace and
 * parent-repo copies stay local; labeling the user-home files local puts them
 * in the Workspace group and drops the User group.
 */
export function storageForAgentInstructionFile(uri: URI, userHome: URI): PromptsStorage.local | PromptsStorage.user {
	if (isDirectChildNamed(uri, joinPath(userHome, CLAUDE_CONFIG_FOLDER), CLAUDE_MD_FILENAME)
		|| isDirectChildNamed(uri, joinPath(userHome, COPILOT_CONFIG_FOLDER), COPILOT_CUSTOM_INSTRUCTIONS_FILENAME)) {
		return PromptsStorage.user;
	}
	return PromptsStorage.local;
}

function isDirectChildNamed(uri: URI, parent: URI, fileName: string): boolean {
	return isEqual(dirname(uri), parent) && equalsIgnoreCase(basename(uri), fileName);
}
