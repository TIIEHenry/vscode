/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function matchesExplorerInlineFilter(name: string, query: string): boolean {
	const trimmed = query.trim();
	if (!trimmed) {
		return true;
	}

	return name.toLowerCase().includes(trimmed.toLowerCase());
}
