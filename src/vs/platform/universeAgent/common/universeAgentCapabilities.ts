/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentCapabilityEntry, UniverseAgentCapabilityKey, UniverseAgentCapabilitySnapshot, UniverseAgentCapabilitySupport, UniverseAgentConversationEntryCapability, UniverseAgentGitWriteCapability } from './universeAgentTypes.js';

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
export function createUnknownGitWriteCapability(): UniverseAgentGitWriteCapability {
	return {
		writeGitStagePaths: 'UNKNOWN',
		writeGitCommit: 'UNKNOWN',
		writeGitApplyHunks: 'UNKNOWN',
	};
}

export function createWebUnsupportedGitWriteCapability(): UniverseAgentGitWriteCapability {
	return {
		writeGitStagePaths: 'UNSUPPORTED',
		writeGitCommit: 'UNSUPPORTED',
		writeGitApplyHunks: 'UNSUPPORTED',
	};
}

function normalizeCapabilitySupport(value: string | undefined): UniverseAgentCapabilitySupport {
	return value === 'SUPPORTED' || value === 'UNSUPPORTED' || value === 'UNKNOWN' ? value : 'UNKNOWN';
}

/** Missing or illegal fields stay UNKNOWN so unit stubs keep the method check. */
export function readGitWriteCapability(snapshot: { readonly gitWriteCapability?: UniverseAgentGitWriteCapability } | undefined): UniverseAgentGitWriteCapability {
	const raw = snapshot?.gitWriteCapability;
	return {
		writeGitStagePaths: normalizeCapabilitySupport(raw?.writeGitStagePaths),
		writeGitCommit: normalizeCapabilitySupport(raw?.writeGitCommit),
		writeGitApplyHunks: normalizeCapabilitySupport(raw?.writeGitApplyHunks),
	};
}

/** Keep in lockstep with {@link UniverseAgentConversationEntryCapability}. */
export const UNIVERSE_AGENT_CONVERSATION_ENTRY_KEYS = [
	'listClipboard',
	'listTriggers',
	'listContextVariable',
	'listSnapshots',
	'listDevices',
	'listPending',
	'pairApprove',
	'pairReject',
	'rotateToken',
	'revoke',
	'getPluginInfo',
	'getMcpServerTools',
	'setSessionGoal',
	'setPermissionMode',
	'switchModel',
	'switchAgent',
] as const satisfies readonly (keyof UniverseAgentConversationEntryCapability)[];

type ConversationEntryKeysComplete = keyof UniverseAgentConversationEntryCapability extends typeof UNIVERSE_AGENT_CONVERSATION_ENTRY_KEYS[number] ? true : never;
const conversationEntryKeysComplete: ConversationEntryKeysComplete = true;
void conversationEntryKeysComplete;

function fillConversationEntryCapability(support: UniverseAgentCapabilitySupport): UniverseAgentConversationEntryCapability {
	const next = {} as { -readonly [K in keyof UniverseAgentConversationEntryCapability]: UniverseAgentCapabilitySupport };
	for (const key of UNIVERSE_AGENT_CONVERSATION_ENTRY_KEYS) {
		next[key] = support;
	}
	return next;
}

export function createUnknownConversationEntryCapability(): UniverseAgentConversationEntryCapability {
	return fillConversationEntryCapability('UNKNOWN');
}

export function createWebUnsupportedConversationEntryCapability(): UniverseAgentConversationEntryCapability {
	return fillConversationEntryCapability('UNSUPPORTED');
}

/** Missing or illegal fields stay UNKNOWN so unit stubs keep the method check. */
export function readConversationEntryCapability(snapshot: { readonly conversationEntryCapability?: UniverseAgentConversationEntryCapability } | undefined): UniverseAgentConversationEntryCapability {
	const raw = snapshot?.conversationEntryCapability;
	return {
		listClipboard: normalizeCapabilitySupport(raw?.listClipboard),
		listTriggers: normalizeCapabilitySupport(raw?.listTriggers),
		listContextVariable: normalizeCapabilitySupport(raw?.listContextVariable),
		listSnapshots: normalizeCapabilitySupport(raw?.listSnapshots),
		listDevices: normalizeCapabilitySupport(raw?.listDevices),
		listPending: normalizeCapabilitySupport(raw?.listPending),
		pairApprove: normalizeCapabilitySupport(raw?.pairApprove),
		pairReject: normalizeCapabilitySupport(raw?.pairReject),
		rotateToken: normalizeCapabilitySupport(raw?.rotateToken),
		revoke: normalizeCapabilitySupport(raw?.revoke),
		getPluginInfo: normalizeCapabilitySupport(raw?.getPluginInfo),
		getMcpServerTools: normalizeCapabilitySupport(raw?.getMcpServerTools),
		setSessionGoal: normalizeCapabilitySupport(raw?.setSessionGoal),
		setPermissionMode: normalizeCapabilitySupport(raw?.setPermissionMode),
		switchModel: normalizeCapabilitySupport(raw?.switchModel),
		switchAgent: normalizeCapabilitySupport(raw?.switchAgent),
	};
}

/**
 * SUPPORTED opens the entry. UNSUPPORTED closes it even when a desktop proxy
 * method exists. UNKNOWN (and a missing entry) follows whether the stub
 * installed the method.
 */
export function conversationEntryHookPresent(
	snapshot: { readonly conversationEntryCapability?: UniverseAgentConversationEntryCapability } | undefined,
	key: keyof UniverseAgentConversationEntryCapability,
	method: unknown,
): boolean {
	return isAdvertisedEngineRpcSupport(readConversationEntryCapability(snapshot)[key], method);
}

/**
 * SUPPORTED opens the RPC. UNSUPPORTED closes it even when a desktop proxy
 * method exists. UNKNOWN (and a missing entry) follows whether the stub
 * installed the method.
 */
export function isAdvertisedEngineRpcSupport(support: UniverseAgentCapabilitySupport | undefined, method: unknown): boolean {
	if (support === 'UNSUPPORTED') {
		return false;
	}
	if (support === 'SUPPORTED') {
		return true;
	}
	return typeof method === 'function';
}

export function isAdvertisedEngineRpc(
	snapshot: UniverseAgentCapabilitySnapshot | undefined,
	key: UniverseAgentCapabilityKey,
	method: unknown,
): boolean {
	return isAdvertisedEngineRpcSupport(snapshot?.[key]?.support, method);
}
