/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { UniverseAgentCapabilitySupport } from '../../../../platform/universeAgent/common/universeAgentTypes.js';
import type { LiveAgentTreeNodeView } from '../../../../platform/universeAgent/common/sessionView/index.js';

/** Shared loading copy while AgentService.Tree has not arrived (§2.5b / navigator-engine-segments §3 matrix). */
export function getNavigatorAgentTreePendingCopy(
	agentTreeCapability: UniverseAgentCapabilitySupport,
	liveTree: LiveAgentTreeNodeView | undefined,
	_treeFetchFailed?: boolean,
): string | undefined {
	if (agentTreeCapability === 'UNSUPPORTED') {
		return undefined;
	}
	if (liveTree === undefined) {
		return localize('navigatorAgentTree.loading', "正在读取 Agent 树…");
	}
	return undefined;
}
