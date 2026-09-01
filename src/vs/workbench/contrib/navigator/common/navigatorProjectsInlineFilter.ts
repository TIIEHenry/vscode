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
