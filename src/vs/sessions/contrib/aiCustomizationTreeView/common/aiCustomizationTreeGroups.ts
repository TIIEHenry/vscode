/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
