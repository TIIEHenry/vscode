/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentCapabilityEntry, UniverseAgentCapabilitySnapshot } from './universeAgentTypes.js';

export const UNKNOWN_CAPABILITY: UniverseAgentCapabilityEntry = { support: 'UNKNOWN', reason: 'not probed' };
export const UNSUPPORTED_CAPABILITY: UniverseAgentCapabilityEntry = { support: 'UNSUPPORTED' };
export const SUPPORTED_CAPABILITY: UniverseAgentCapabilityEntry = { support: 'SUPPORTED' };

/** G-ENG-1: Provider config keys are not a closed contract yet. */
export const PROVIDER_CONFIG_UNSUPPORTED_REASON = 'Provider 配置键合同未定';

export function createEmptyCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
	return {
		skills: { ...UNKNOWN_CAPABILITY },
		mcp: { ...UNKNOWN_CAPABILITY },
		mcpRuntime: { ...UNKNOWN_CAPABILITY },
		plugins: { ...UNKNOWN_CAPABILITY },
		models: { ...UNKNOWN_CAPABILITY },
		providerConfig: { support: 'UNSUPPORTED', reason: PROVIDER_CONFIG_UNSUPPORTED_REASON },
		globalRules: { ...UNKNOWN_CAPABILITY },
		agentProfiles: { ...UNKNOWN_CAPABILITY },
		projectRules: { ...UNKNOWN_CAPABILITY },
		tools: { ...UNKNOWN_CAPABILITY },
		hooksMetadata: { ...UNKNOWN_CAPABILITY },
		agentTree: { ...UNKNOWN_CAPABILITY },
		team: { ...UNKNOWN_CAPABILITY },
	};
}
