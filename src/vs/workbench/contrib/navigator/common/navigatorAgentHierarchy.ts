/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { isEngineRootAgentId } from '../../conversation/common/engineRootAgentId.js';

export { isEngineRootAgentId };

export interface INavigatorAgentsHierarchyNode {
	readonly id: string;
	readonly label: string;
	readonly agentId: string;
	readonly type: string;
	readonly status: string;
	readonly model: string;
	readonly turnCount: number;
	readonly source: LiveAgentTreeNodeView;
	readonly children?: readonly INavigatorAgentsHierarchyNode[];
}

export function formatAgentStatusLabel(status: string): string {
	if (status === 'AGENT_STATUS_UNKNOWN' || status === '0') {
		return localize('navigatorAgents.statusUnknown', "状态未知");
	}
	return status.replace(/^AGENT_STATUS_/, '');
}

export function formatAgentTypeShort(type: string): string {
	return type.replace(/^AGENT_TYPE_/, '');
}

export function liveAgentTreeToHierarchyNodes(
	node: LiveAgentTreeNodeView,
): INavigatorAgentsHierarchyNode {
	const children = node.children.map(child => liveAgentTreeToHierarchyNodes(child));
	return {
		id: node.agentId,
		label: node.name || node.agentId,
		agentId: node.agentId,
		type: node.type,
		status: node.status,
		model: node.model,
		turnCount: node.turnCount,
		source: node,
		children: children.length > 0 ? children : undefined,
	};
}

export function countHierarchyNodes(nodes: readonly INavigatorAgentsHierarchyNode[]): number {
	let count = 0;
	const visit = (node: INavigatorAgentsHierarchyNode): void => {
		count++;
		for (const child of node.children ?? []) {
			visit(child);
		}
	};
	for (const node of nodes) {
		visit(node);
	}
	return count;
}

export function isRootOnlyAgentTree(tree: LiveAgentTreeNodeView | undefined): boolean {
	if (!tree) {
		return false;
	}
	return tree.children.length === 0;
}

