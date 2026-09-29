/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function matchesNavigatorProjectsInlineFilter(name: string, description: string | undefined, query: string): boolean {
	const trimmed = query.trim();
	if (!trimmed) {
		return true;
	}

	const lowerQuery = trimmed.toLowerCase();
	if (name.toLowerCase().includes(lowerQuery)) {
		return true;
	}

	return description?.toLowerCase().includes(lowerQuery) ?? false;
}

/**
 * Keep a node only when it matches or a filtered child matches.
 * Description is matched in full. `children` is the filtered list, never the unfiltered originals.
 */
export function filterNavigatorProjectsTreeNodes<T extends { readonly label: string; readonly description?: string; readonly children?: readonly T[] }>(
	nodes: readonly T[],
	query: string,
): T[] {
	const result: T[] = [];
	for (const node of nodes) {
		const filteredChildren = node.children ? filterNavigatorProjectsTreeNodes(node.children, query) : undefined;
		const matchesSelf = matchesNavigatorProjectsInlineFilter(node.label, node.description, query);
		if (matchesSelf || (filteredChildren !== undefined && filteredChildren.length > 0)) {
			result.push({
				...node,
				children: node.children ? filteredChildren : node.children,
			} as T);
		}
	}
	return result;
}
