/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentCapabilityEntry, UniverseAgentCapabilityKey, UniverseAgentCapabilitySnapshot } from './universeAgentTypes.js';

export const UNKNOWN_CAPABILITY: UniverseAgentCapabilityEntry = { support: 'UNKNOWN', reason: 'not probed' };
export const UNSUPPORTED_CAPABILITY: UniverseAgentCapabilityEntry = { support: 'UNSUPPORTED' };
export const SUPPORTED_CAPABILITY: UniverseAgentCapabilityEntry = { support: 'SUPPORTED' };

/** G-ENG-1: used when ListProviderStatus is not advertised. */
export const PROVIDER_CONFIG_UNSUPPORTED_REASON = 'Provider 配置键合同未定';

export function createEmptyCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
	return {
		skills: { ...UNKNOWN_CAPABILITY },
		mcp: { ...UNKNOWN_CAPABILITY },
		mcpRuntime: { ...UNKNOWN_CAPABILITY },
		plugins: { ...UNKNOWN_CAPABILITY },
		models: { ...UNKNOWN_CAPABILITY },
		providerConfig: { ...UNKNOWN_CAPABILITY },
		globalRules: { ...UNKNOWN_CAPABILITY },
		agentProfiles: { ...UNKNOWN_CAPABILITY },
		projectRules: { ...UNKNOWN_CAPABILITY },
		tools: { ...UNKNOWN_CAPABILITY },
		hooksMetadata: { ...UNKNOWN_CAPABILITY },
		agentTree: { ...UNKNOWN_CAPABILITY },
		team: { ...UNKNOWN_CAPABILITY },
		fireTrigger: { ...UNKNOWN_CAPABILITY },
		setTriggerEnabled: { ...UNKNOWN_CAPABILITY },
		deleteTrigger: { ...UNKNOWN_CAPABILITY },
		upsertTrigger: { ...UNKNOWN_CAPABILITY },
		writeClipboard: { ...UNKNOWN_CAPABILITY },
		readClipboard: { ...UNKNOWN_CAPABILITY },
		clearClipboard: { ...UNKNOWN_CAPABILITY },
		readContextVariable: { ...UNKNOWN_CAPABILITY },
		restoreSnapshot: { ...UNKNOWN_CAPABILITY },
		deleteSnapshot: { ...UNKNOWN_CAPABILITY },
		readGitChanges: { ...UNKNOWN_CAPABILITY },
	};
}

/**
 * Desktop IPC turns every connection method into a function, so
 * `typeof fn === 'function'` is not an advertisement check.
 * SUPPORTED opens the RPC. UNSUPPORTED closes it even when the proxy
 * method exists. UNKNOWN is unprobed (unit stubs) and still follows
 * whether that stub installed the method.
 */
export function isAdvertisedEngineRpc(
	snapshot: UniverseAgentCapabilitySnapshot | undefined,
	key: UniverseAgentCapabilityKey,
	method: unknown,
): boolean {
	const support = snapshot?.[key]?.support ?? 'UNKNOWN';
	if (support === 'UNSUPPORTED') {
		return false;
	}
	if (support === 'SUPPORTED') {
		return true;
	}
	return typeof method === 'function';
}
