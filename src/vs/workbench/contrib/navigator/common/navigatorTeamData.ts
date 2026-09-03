/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { getNavigatorAgentTreePendingCopy } from './navigatorAgentTreeEmptyState.js';

export interface INavigatorTeamMemberInfo {
	readonly memberName: string;
	readonly memberAgentId: string;
	readonly status: string;
	readonly preset: string;
	readonly dynamic: string;
	readonly turnCount: number;
}

export interface INavigatorTeamTaskInfo {
	readonly taskId: string;
	readonly subject: string;
	readonly owner: string;
	readonly status: string;
	readonly blockedBy: string;
	readonly lastMessage: string;
	readonly description: string;
}

export interface INavigatorTeamInfo {
	readonly teamId: number;
	readonly status: string;
}

export interface INavigatorTeamMemberEntry extends INavigatorTeamMemberInfo {
	readonly id: string;
	readonly label: string;
	readonly managerAgentId: string;
	readonly managerName: string;
}

export interface INavigatorTeamTaskEntry extends INavigatorTeamTaskInfo {
	readonly id: string;
	readonly label: string;
	readonly managerAgentId: string;
	readonly managerName: string;
}

const MEMBER_TYPE = 'AGENT_TYPE_MEMBER';

export function findManagerNodes(tree: LiveAgentTreeNodeView | undefined): LiveAgentTreeNodeView[] {
	if (!tree) {
		return [];
	}
	const managers: LiveAgentTreeNodeView[] = [];
	const visit = (node: LiveAgentTreeNodeView): void => {
		if (node.children.some(child => child.type === MEMBER_TYPE)) {
			managers.push(node);
		}
		for (const child of node.children) {
			visit(child);
		}
	};
	visit(tree);
	return managers;
}

/** Honest empty copy before listing members — loading is not “no team”. */
export function getTeamTreeEmptyCopy(
	agentTreeCapability: UniverseAgentCapabilitySupport,
	liveTree: LiveAgentTreeNodeView | undefined,
	treeFetchFailed?: boolean,
): string | undefined {
	if (agentTreeCapability === 'UNSUPPORTED') {
		return localize('navigatorTeam.noAgentTree', "当前引擎不提供 Agent 树，无法列出团队");
	}
	const pending = getNavigatorAgentTreePendingCopy(agentTreeCapability, liveTree, treeFetchFailed);
	if (pending) {
		return pending;
	}
	if (findManagerNodes(liveTree).length === 0) {
		return localize('navigatorTeam.noTeam', "当前会话没有团队");
	}
	return undefined;
}
