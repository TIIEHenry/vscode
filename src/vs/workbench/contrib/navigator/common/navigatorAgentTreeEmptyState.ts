/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';

export const NAVIGATOR_STALE_SNAPSHOT_COPY = localize('navigator.staleSnapshot', "Showing snapshot from before disconnect");

/** Activity leftover after a tree fetch fail — keep last rows, do not paint them as live. */
export const NAVIGATOR_ACTIVITY_FETCH_FAILED_COPY = localize('navigatorAgentsActivity.fetchFailed', "Failed to read tool activity");

/** Hierarchy leftover / first-pull empty after a tree fetch fail — same copy family as D21 pending. */
export const NAVIGATOR_AGENT_TREE_FETCH_FAILED_COPY = localize('navigatorAgentTree.fetchFailed', "Failed to read the agent tree");

/** Shared Hierarchy / Team empty copy while AgentService.Tree is pending or failed (§3 / D21). */
export function getNavigatorAgentTreePendingCopy(
	agentTreeCapability: UniverseAgentCapabilitySupport,
	liveTree: LiveAgentTreeNodeView | undefined,
	treeFetchFailed?: boolean,
): string | undefined {
	if (agentTreeCapability === 'UNSUPPORTED') {
		return undefined;
	}
	if (treeFetchFailed) {
		return NAVIGATOR_AGENT_TREE_FETCH_FAILED_COPY;
	}
	if (liveTree === undefined || agentTreeCapability === 'UNKNOWN') {
		return localize('navigatorAgentTree.loading', "Reading agent tree…");
	}
	return undefined;
}
