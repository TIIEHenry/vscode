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
	| 'hooksMetadata'
	| 'agentTree'
	| 'team';

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
	/** True when the Connect request carried a client work_dir / shared_fs_root hint. */
	readonly sharedFsRootSent: boolean;
	readonly pairingPending: boolean;
	readonly channelAlive: boolean;
	readonly capabilities: UniverseAgentCapabilitySnapshot;
}

/** Joined file mutation record (m6 §11 / sources-review §8); produced only after lifecycle join. */
export interface IFileMutationRecord {
	readonly sessionId: string;
	readonly toolCallId: string;
	readonly turnId: string;
	readonly agentId: string;
	readonly path: string;
	readonly operation: string;
	readonly diffStats?: {
		readonly addedLines: number;
		readonly removedLines: number;
		readonly changedFiles: number;
	};
}

export interface UniverseAgentTeamMemberInfo {
	readonly memberName: string;
	readonly memberAgentId: string;
	readonly status: string;
	readonly preset: string;
	readonly dynamic: string;
	readonly turnCount: number;
}

export interface UniverseAgentTeamTaskInfo {
	readonly taskId: string;
	readonly subject: string;
	readonly owner: string;
	readonly status: string;
	readonly blockedBy: string;
	readonly lastMessage: string;
	readonly description: string;
}

export interface UniverseAgentTeamInfo {
	readonly teamId: number;
	readonly status: string;
}

/** AgentService.Tree node (host-only RPC; proto enum names for type/status). */
export interface UniverseAgentAgentTreeNode {
	readonly agentId: string;
	readonly name: string;
	readonly type: string;
	readonly status: string;
	readonly model: string;
	readonly turnCount: number;
	readonly createdAt: number;
	readonly children: readonly UniverseAgentAgentTreeNode[];
}

/** Skill catalog source from ToolService.ListSkills (customizations-engine §3.1). */
export type UniverseAgentSkillSource = 'bundled' | 'user' | 'project' | 'unknown';

export interface UniverseAgentSkillSummary {
	readonly name: string;
	readonly description?: string;
	readonly source: UniverseAgentSkillSource;
	readonly enabled: boolean;
	readonly slashEnabled?: boolean;
}

export interface UniverseAgentListSkillsResult {
	readonly skills: readonly UniverseAgentSkillSummary[];
}

export interface UniverseAgentSetSkillEnabledRequest {
	readonly skillName: string;
	readonly enabled: boolean;
}

export interface UniverseAgentSetSkillEnabledResult {
	readonly ok: boolean;
	readonly reason?: string;
}

export interface UniverseAgentSkillInfoRequest {
	readonly skillName: string;
}

export interface UniverseAgentSkillInfoResult {
	readonly name: string;
	readonly content: string;
	readonly source: UniverseAgentSkillSource;
	readonly enabled: boolean;
}
