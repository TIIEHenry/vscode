/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';

export interface ILiveAgentCatalogEntry {
	readonly chatId: string;
	readonly title: string;
	readonly parentChatId: string;
}

/** Engine root `agent_id` is `"root"`; Conversation root chat id is `default`. */
export function catalogChatIdFromAgentId(agentId: string): string {
	return agentId === 'root' ? 'default' : agentId;
}

/** Non-root live-tree nodes as Conversation catalog entries. Root maps to `default`. */
export function collectLiveAgentTreeCatalogEntries(tree: LiveAgentTreeNodeView): readonly ILiveAgentCatalogEntry[] {
	const entries: ILiveAgentCatalogEntry[] = [];
	const visit = (node: LiveAgentTreeNodeView, parent: LiveAgentTreeNodeView | undefined): void => {
		if (parent && node.agentId !== 'root') {
			entries.push({
				chatId: node.agentId,
				title: node.name.trim() || node.agentId,
				parentChatId: catalogChatIdFromAgentId(parent.agentId),
			});
		}
		for (const child of node.children) {
			visit(child, node);
		}
	};
	visit(tree, undefined);
	return entries;
}
