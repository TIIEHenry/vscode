/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function matchesNavigatorAgentsInlineFilter(label: string, query: string): boolean {
	const trimmed = query.trim();
	if (!trimmed) {
		return true;
	}

	return label.toLowerCase().includes(trimmed.toLowerCase());
}

/**
 * Keep a node only when its label matches or a filtered child matches.
 * `children` is the filtered list (possibly empty), never the unfiltered originals.
 */
export function filterNavigatorAgentsHierarchyNodes<T extends { readonly label: string; readonly children?: readonly T[] }>(
	nodes: readonly T[],
	query: string,
): T[] {
	const result: T[] = [];
	for (const node of nodes) {
		const filteredChildren = node.children ? filterNavigatorAgentsHierarchyNodes(node.children, query) : undefined;
		const matchesSelf = matchesNavigatorAgentsInlineFilter(node.label, query);
		if (matchesSelf || (filteredChildren !== undefined && filteredChildren.length > 0)) {
			result.push({
				...node,
				children: node.children ? filteredChildren : node.children,
			} as T);
		}
	}
	return result;
}
