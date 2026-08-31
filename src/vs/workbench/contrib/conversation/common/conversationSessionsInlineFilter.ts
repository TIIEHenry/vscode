/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export function matchesConversationSessionsInlineFilter(title: string, query: string): boolean {
	const trimmed = query.trim();
	if (!trimmed) {
		return true;
	}

	return title.toLowerCase().includes(trimmed.toLowerCase());
}
