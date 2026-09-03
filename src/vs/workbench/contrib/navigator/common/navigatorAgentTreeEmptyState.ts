/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';

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
			return localize('navigatorAgentTree.fetchFailed', "读取 Agent 树失败");
		}
		return localize('navigatorAgentTree.loading', "正在读取 Agent 树…");
	}
	return undefined;
}
