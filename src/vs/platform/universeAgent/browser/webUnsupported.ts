/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConnectionFailureCode } from '../common/connectionHubTypes.js';
import type {
	UniverseAgentCapabilityEntry,
	UniverseAgentCapabilityKey,
	UniverseAgentCapabilitySnapshot,
} from '../common/universeAgentTypes.js';

export const WEB_UNSUPPORTED_REASON = 'Web 不支持本机 Engine 连接';

export const WEB_UNSUPPORTED_CODE: ConnectionFailureCode = 'unsupported_environment';

export class UniverseAgentUnsupportedEnvironmentError extends Error {
	readonly code = WEB_UNSUPPORTED_CODE;

	constructor() {
		super(WEB_UNSUPPORTED_REASON);
		this.name = 'UniverseAgentUnsupportedEnvironmentError';
	}
}

const WEB_UNSUPPORTED_ENTRY: UniverseAgentCapabilityEntry = {
	support: 'UNSUPPORTED',
	reason: WEB_UNSUPPORTED_REASON,
};

export function createWebUnsupportedCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
	const snapshot: Record<UniverseAgentCapabilityKey, UniverseAgentCapabilityEntry> = {
		skills: WEB_UNSUPPORTED_ENTRY,
		mcp: WEB_UNSUPPORTED_ENTRY,
		plugins: WEB_UNSUPPORTED_ENTRY,
		globalRules: WEB_UNSUPPORTED_ENTRY,
		agentProfiles: WEB_UNSUPPORTED_ENTRY,
		projectRules: WEB_UNSUPPORTED_ENTRY,
		tools: WEB_UNSUPPORTED_ENTRY,
		hooksMetadata: WEB_UNSUPPORTED_ENTRY,
		agentTree: WEB_UNSUPPORTED_ENTRY,
		team: WEB_UNSUPPORTED_ENTRY,
	};
	return snapshot;
}

export function rejectUnsupportedEnvironment(): Promise<never> {
	return Promise.reject(new UniverseAgentUnsupportedEnvironmentError());
}

export function hubUnsupportedResult(): { readonly ok: false; readonly code: string; readonly reason: string } {
	return { ok: false, code: WEB_UNSUPPORTED_CODE, reason: WEB_UNSUPPORTED_REASON };
}
