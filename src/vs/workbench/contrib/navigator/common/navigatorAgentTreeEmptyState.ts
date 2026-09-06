/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';

export const NAVIGATOR_STALE_SNAPSHOT_COPY = localize('navigator.staleSnapshot', "Showing snapshot from before disconnect");

/** Shared Hierarchy / Team empty copy while AgentService.Tree is pending or failed (§3 / D21). */
export function getNavigatorAgentTreePendingCopy(
	agentTreeCapability: UniverseAgentCapabilitySupport,
	liveTree: LiveAgentTreeNodeView | undefined,
	treeFetchFailed?: boolean,
): string | undefined {
	if (agentTreeCapability === 'UNSUPPORTED') {
		return undefined;
	}
	if (liveTree === undefined) {
		if (treeFetchFailed) {
			return localize('navigatorAgentTree.fetchFailed', "Failed to read the agent tree");
		}
		return localize('navigatorAgentTree.loading', "Reading agent tree…");
	}
	return undefined;
}
