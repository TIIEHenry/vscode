/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Transport health separate from capability three-state (m6 §5). */
export type UniverseAgentTransportState = 'idle' | 'ok' | 'failed';

/** Keys consumed by Engine page capability matrix (customizations-engine §2). */
export type UniverseAgentCapabilityKey =
	| 'skills'
	| 'mcp'
	| 'plugins'
	| 'globalRules'
	| 'agentProfiles'
	| 'projectRules'
	| 'tools'
	| 'hooksMetadata';

export type UniverseAgentCapabilitySupport = 'SUPPORTED' | 'UNSUPPORTED' | 'UNKNOWN';

export interface UniverseAgentCapabilityEntry {
	readonly support: UniverseAgentCapabilitySupport;
	readonly reason?: string;
}

export type UniverseAgentCapabilitySnapshot = Readonly<Record<UniverseAgentCapabilityKey, UniverseAgentCapabilityEntry>>;

export interface UniverseAgentConnectRequest {
	readonly clientId: string;
	readonly protocolVersion: string;
	readonly workDir?: string;
}

export interface UniverseAgentConnectResult {
	readonly sessionToken?: string;
	readonly workDir?: string;
	readonly pairingNonce?: string;
	readonly sasCode?: string;
	readonly methods: readonly string[];
	readonly events: readonly string[];
}

export interface UniverseAgentSessionSummary {
	readonly sessionId: string;
	readonly title?: string;
	readonly status?: string;
	readonly createdAt?: number;
	readonly lastAccessedAt?: number;
	readonly turnCount?: number;
	readonly model?: string;
}

export interface UniverseAgentListSessionsRequest {
	readonly limit?: number;
	readonly offset?: number;
}

export interface UniverseAgentListSessionsResult {
	readonly sessions: readonly UniverseAgentSessionSummary[];
	readonly totalCount?: number;
}

export interface UniverseAgentCreateSessionRequest {
	readonly title?: string;
	readonly model?: string;
}

export interface UniverseAgentCreateSessionResult {
	readonly sessionId: string;
}

export interface UniverseAgentDeleteSessionRequest {
	readonly sessionId: string;
}

export interface UniverseAgentGetHistoryRequest {
	readonly sessionId: string;
	readonly cursorSeq?: string;
	readonly limit?: number;
}

export interface UniverseAgentHistoryEnvelope {
	readonly cursorSeq: string;
	readonly payload: unknown;
}

export interface UniverseAgentGetHistoryResult {
	readonly envelopes: readonly UniverseAgentHistoryEnvelope[];
	readonly nextCursorSeq?: string;
}

export interface UniverseAgentSessionEvent {
	readonly payload: unknown;
}

export interface UniverseAgentChatRequest {
	readonly sessionId: string;
	readonly payload: unknown;
}

export interface UniverseAgentChatResponse {
	readonly payload: unknown;
}

export interface UniverseAgentConnectionSnapshot {
	readonly transport: UniverseAgentTransportState;
	readonly sessionToken?: string;
	readonly workDir?: string;
	readonly pairingPending: boolean;
	readonly channelAlive: boolean;
	readonly capabilities: UniverseAgentCapabilitySnapshot;
}
