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
	| 'mcpRuntime'
	| 'plugins'
	| 'models'
	| 'providerConfig'
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

/**
 * Close cause for resident Chat bidi (`openChatStream` only).
 * Not used by tip `subscribeSessionEventStream` (no onClosed contract).
 */
export type UniverseAgentSessionStreamCloseCause =
	| { readonly kind: 'remote' }
	| { readonly kind: 'error'; readonly message: string };

export interface UniverseAgentChatRequest {
	readonly sessionId: string;
	readonly payload: unknown;
}

export interface UniverseAgentChatResponse {
	readonly payload: unknown;
}

/** Resident AgentService.Chat bidi (ADR-012). One-shot `chat()` still exists for probes. */
export interface UniverseAgentChatStream {
	write(payload: unknown): void;
	dispose(): void;
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

/** Turn settle signal after TurnCompletedChange.assistant_turn_id (m6 §11 / PRD-023 §2.4). */
export interface ITurnSettleSignal {
	readonly sessionId: string;
	readonly runtimeTurnId: string;
	readonly assistantTurnId: string;
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

/** Host-only `AgentService.FetchToolDetail` (M7 P2a). Always `subscribe=false`. */
export interface UniverseAgentFetchToolDetailRequest {
	readonly sessionId: string;
	readonly toolCallId: string;
	readonly detailKind: number;
	readonly refId: string;
}

export type UniverseAgentFetchToolDetailResult =
	| { readonly ok: true; readonly content: string; readonly truncated: boolean; readonly totalBytes?: number }
	| { readonly ok: false; readonly reason: 'unavailable' | 'failed'; readonly message?: string };

/** Raw transport mapping of FetchToolDetailResponse before advertisement / UNIMPLEMENTED fold. */
export interface UniverseAgentFetchToolDetailWireResult {
	readonly success: boolean;
	readonly content: string;
	readonly truncated: boolean;
	readonly totalBytes?: number;
	readonly errorMessage?: string;
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

/** Write SKILL.md body via engine catalog (ToolService.SaveSkillContent; customizations-engine §3.1). */
export interface UniverseAgentSaveSkillContentRequest {
	readonly skillName: string;
	readonly content: string;
}

export interface UniverseAgentSaveSkillContentResult {
	readonly ok: boolean;
	readonly reason?: string;
}

/** Agent profile source from AgentService.ListAgentProfiles (customizations-engine §3.2). */
export type UniverseAgentAgentProfileSource = 'built_in' | 'user' | 'project' | 'unknown';

export interface UniverseAgentAgentProfileSummary {
	readonly id: string;
	readonly name: string;
	readonly source: UniverseAgentAgentProfileSource;
	readonly summary?: string;
	readonly enabled?: boolean;
	readonly disabledTools?: readonly string[];
	readonly enabledTools?: readonly string[];
	readonly whitelistMode?: boolean;
}

/** Full agent profile from SaveAgentProfile / ResetAgentProfile (customizations-engine §3.2). */
export interface UniverseAgentAgentProfileDetail {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly systemPrompt?: string;
	readonly disabledTools?: readonly string[];
	readonly enabledTools?: readonly string[];
	readonly permissionMode?: string;
	readonly summary?: string;
	readonly usage?: string;
	readonly detailLevel?: string;
	readonly source?: UniverseAgentAgentProfileSource;
	readonly enabled?: boolean;
	readonly whitelistMode?: boolean;
	readonly builtinDefault?: boolean;
}

export interface UniverseAgentSaveAgentProfileRequest {
	readonly profile: UniverseAgentAgentProfileDetail;
}

export interface UniverseAgentSaveAgentProfileResult {
	readonly profile: UniverseAgentAgentProfileDetail;
}

export interface UniverseAgentDeleteAgentProfileRequest {
	readonly id: string;
}

export interface UniverseAgentDeleteAgentProfileResult {
	readonly ok: boolean;
	readonly reason?: string;
}

export interface UniverseAgentResetAgentProfileRequest {
	readonly id: string;
}

export interface UniverseAgentResetAgentProfileResult {
	readonly ok: boolean;
	readonly reason?: string;
	readonly profile?: UniverseAgentAgentProfileDetail;
}

export interface UniverseAgentListAgentProfilesRequest {
	readonly projectPath?: string;
}

export interface UniverseAgentListAgentProfilesResult {
	readonly profiles: readonly UniverseAgentAgentProfileSummary[];
}

/** MCP definition origin from McpService.ListMcpServers (customizations-engine §3.5). */
export type UniverseAgentMcpServerOrigin = 'global' | 'project' | 'unknown';

export type UniverseAgentMcpTransport = 'stdio' | 'sse' | 'streamable_http' | 'unknown';

export interface UniverseAgentMcpServerSummary {
	readonly id: string;
	readonly name: string;
	readonly transport: UniverseAgentMcpTransport;
	readonly origin: UniverseAgentMcpServerOrigin;
	readonly enabled: boolean;
	readonly effectiveEnabled?: boolean;
	readonly hasProjectOverride?: boolean;
}

export interface UniverseAgentListMcpServersRequest {
	readonly workDir?: string;
	readonly enabledOnly?: boolean;
}

export interface UniverseAgentListMcpServersResult {
	readonly servers: readonly UniverseAgentMcpServerSummary[];
}

export interface UniverseAgentToggleMcpServerRequest {
	readonly id: string;
	readonly enabled: boolean;
	readonly scope: 'global' | 'project';
	readonly workDir?: string;
}

export interface UniverseAgentToggleMcpServerResult {
	readonly ok: boolean;
	readonly reason?: string;
}

export interface UniverseAgentMcpServerConfig {
	readonly id?: string;
	readonly name: string;
	readonly transport: UniverseAgentMcpTransport;
	readonly command?: string;
	readonly args?: readonly string[];
	readonly env?: Readonly<Record<string, string>>;
	readonly url?: string;
	readonly enabled?: boolean;
}

export interface UniverseAgentAddMcpServerRequest {
	readonly config: UniverseAgentMcpServerConfig;
	readonly testConnection?: boolean;
	readonly scope: 'global' | 'project';
	readonly workDir?: string;
}

export interface UniverseAgentAddMcpServerResult {
	readonly ok: boolean;
	readonly reason?: string;
	readonly assignedId?: string;
}

export interface UniverseAgentUpdateMcpServerRequest {
	readonly serverId: string;
	readonly config: UniverseAgentMcpServerConfig;
	readonly restartConnection?: boolean;
	readonly scope: 'global' | 'project';
	readonly workDir?: string;
}

export interface UniverseAgentUpdateMcpServerResult {
	readonly ok: boolean;
	readonly reason?: string;
	readonly config?: UniverseAgentMcpServerConfig;
}

export interface UniverseAgentRemoveMcpServerRequest {
	readonly serverId: string;
	readonly force?: boolean;
	readonly scope: 'global' | 'project';
	readonly workDir?: string;
}

export interface UniverseAgentRemoveMcpServerResult {
	readonly ok: boolean;
	readonly reason?: string;
	readonly removedName?: string;
}

/** Engine tool directory entry from ToolService.ListTools (customizations-engine §3.6). */
export interface UniverseAgentToolSummary {
	readonly name: string;
	readonly description?: string;
	readonly category?: string;
	readonly destructive?: boolean;
	readonly requiresPermission?: boolean;
}

export interface UniverseAgentListToolsResult {
	readonly tools: readonly UniverseAgentToolSummary[];
}

/**
 * ConfigService.ListModels registry row. Wire fields only — no invented
 * context-window or capability-tag properties (protocol-surface §1b P1b).
 */
export interface UniverseAgentModelEntry {
	readonly id: string;
	readonly type: string;
	readonly enabled: boolean;
	/** Capability level 1–9 from wire `level`. */
	readonly level: number;
	readonly description?: string;
	/** Wire `cost` (`min`…`max`); pass through, do not reinterpret. */
	readonly cost?: string;
	readonly speed?: string;
	readonly provider: string;
	readonly modelId: string;
}

export interface UniverseAgentListModelsResult {
	readonly models: readonly UniverseAgentModelEntry[];
}

/**
 * MCP runtime connection status from McpService.GetMcpServerStatuses.
 * Proto `MCP_STATUS_UNSPECIFIED` maps to `failed` (no fifth UI state).
 */
export type UniverseAgentMcpRuntimeStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'failed';

export interface UniverseAgentMcpServerStatus {
	readonly serverId: string;
	readonly status: UniverseAgentMcpRuntimeStatus;
	readonly errorMessage?: string;
	readonly lastConnectedAt?: number;
}

export interface UniverseAgentGetMcpServerStatusesResult {
	readonly statuses: readonly UniverseAgentMcpServerStatus[];
	readonly checkedAt?: number;
}

export interface UniverseAgentMcpToolDefinition {
	readonly name: string;
	readonly description?: string;
	readonly inputSchemaJson?: string;
}

export interface UniverseAgentGetMcpServerToolsResult {
	readonly tools: readonly UniverseAgentMcpToolDefinition[];
	readonly total?: number;
	readonly cachedAt?: number;
}

/** PluginService.List / Info status. Wire `PLUGIN_ACTIVE|DISABLED|ERROR`. */
export type UniverseAgentPluginStatus = 'active' | 'disabled' | 'error' | 'unknown';

export interface UniverseAgentPluginSummary {
	readonly id: string;
	readonly displayName: string;
	readonly version: string;
	/** Wire `source` (JAR/DEX filename, `embedded`, or live `"plugin"`). Do not reinterpret. */
	readonly source: string;
	readonly hookCount: number;
	readonly status: UniverseAgentPluginStatus;
	readonly loadedAt?: number;
}

export interface UniverseAgentListPluginsResult {
	readonly plugins: readonly UniverseAgentPluginSummary[];
}

export interface UniverseAgentPluginHookEntry {
	readonly hookType: string;
	readonly priority: number;
	readonly className: string;
}

export interface UniverseAgentPluginInfoResult {
	readonly summary: UniverseAgentPluginSummary;
	readonly hooks: readonly UniverseAgentPluginHookEntry[];
	readonly config?: Readonly<Record<string, string>>;
	readonly errorMessage?: string;
}

export interface UniverseAgentEnablePluginResult {
	readonly plugin: UniverseAgentPluginSummary;
}

export interface UniverseAgentReloadPluginResult {
	readonly plugin: UniverseAgentPluginSummary;
}

export interface UniverseAgentUnloadPluginResult {
	readonly removedHookCount: number;
}

export interface UniverseAgentScanNewPluginsResult {
	readonly newPlugins: readonly UniverseAgentPluginSummary[];
	readonly skippedCount: number;
}
