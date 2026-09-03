/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { createDecorator } from '../../instantiation/common/instantiation.js';
import type { ConnectionPhase, UniverseAgentConnectProfileResult } from './connectionHubTypes.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
	UniverseAgentConnectionSnapshot,
	UniverseAgentCreateSessionRequest,
	UniverseAgentCreateSessionResult,
	UniverseAgentDeleteSessionRequest,
	UniverseAgentGetHistoryRequest,
	UniverseAgentGetHistoryResult,
	UniverseAgentListSessionsRequest,
	UniverseAgentListSessionsResult,
	UniverseAgentListSkillsResult,
	UniverseAgentListAgentProfilesRequest,
	UniverseAgentListAgentProfilesResult,
	UniverseAgentSaveAgentProfileRequest,
	UniverseAgentSaveAgentProfileResult,
	UniverseAgentDeleteAgentProfileRequest,
	UniverseAgentDeleteAgentProfileResult,
	UniverseAgentResetAgentProfileRequest,
	UniverseAgentResetAgentProfileResult,
	UniverseAgentListMcpServersRequest,
	UniverseAgentListMcpServersResult,
	UniverseAgentGetMcpServerStatusesResult,
	UniverseAgentGetMcpServerToolsResult,
	UniverseAgentListPluginsResult,
	UniverseAgentPluginInfoResult,
	UniverseAgentEnablePluginResult,
	UniverseAgentReloadPluginResult,
	UniverseAgentUnloadPluginResult,
	UniverseAgentScanNewPluginsResult,
	UniverseAgentAddMcpServerRequest,
	UniverseAgentAddMcpServerResult,
	UniverseAgentUpdateMcpServerRequest,
	UniverseAgentUpdateMcpServerResult,
	UniverseAgentRemoveMcpServerRequest,
	UniverseAgentRemoveMcpServerResult,
	UniverseAgentListToolsResult,
	UniverseAgentListModelsResult,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentToggleMcpServerResult,
	UniverseAgentSessionEvent,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentTeamInfo,
	UniverseAgentTeamMemberInfo,
	UniverseAgentTeamTaskInfo,
	UniverseAgentTransportState,
	IFileMutationRecord,
	ITurnSettleSignal,
	UniverseAgentCapabilitySupport,
} from './universeAgentTypes.js';

export const IUniverseAgentConnection = createDecorator<IUniverseAgentConnection>('universeAgentConnection');

/** IPC channel name for the electron-main hosted gRPC adapter. */
export const universeAgentConnectionChannelName = 'universeAgentConnection';

/**
 * Platform transport contract for UniverseAgent gRPC.
 * Renderer sees this interface via electron-browser ProxyChannel; node holds the client.
 */
/** Navigator / Team unary surface (m6 §11). */
export interface IUniverseAgentTeamApi {
	memberStatus(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamMemberInfo[]>;
	taskList(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamTaskInfo[]>;
	teamInfo(sessionId: string, agentId: string, teamId: number): Promise<UniverseAgentTeamInfo | undefined>;
}

/** IDE-derived capability keys for Navigator (navigator-engine-segments §3). */
export type UniverseAgentNavigatorCapabilityKey = 'agentTree' | 'team' | 'sessionList';

export interface IUniverseAgentConnection {

	readonly _serviceBrand: undefined;

	/** Production connected = non-empty session_token + live channel; pairing-pending is never connected. */
	isEngineConnected(): boolean;

	getTransportState(): UniverseAgentTransportState;

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot;

	getCapabilitySnapshot(): UniverseAgentCapabilitySnapshot;

	readonly onDidChangeConnection: Event<UniverseAgentConnectionSnapshot>;

	/** File mutations after host join (m6 §11 A2); never raw L3 snapshots. */
	readonly onDidFileMutation: Event<IFileMutationRecord>;

	/** Turn settle after TurnCompletedChange.assistant_turn_id (m6 §11 A2 / PRD-023 §2.4). */
	readonly onDidTurnSettle: Event<ITurnSettleSignal>;

	/** L3 multi_agent_status demux (m6 §11 A2). */
	readonly onDidChangeTeamRuntime: Event<{ readonly sessionId: string }>;

	/** Manual Agent tree refresh; forwarded to SessionViewHost (navigator §2.2). */
	requestAgentTreeRefresh(sessionId: string): void;

	/** Navigator capability three-state (IDE-derived keys). */
	getNavigatorCapability(key: UniverseAgentNavigatorCapabilityKey): UniverseAgentCapabilitySupport;

	readonly team: IUniverseAgentTeamApi;

	connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult>;

	/** Hub / DirectAddress profile dial via live resolver (connection-hub H3). */
	connectProfile(profileId: string, options?: { readonly reconnect?: boolean }): Promise<UniverseAgentConnectProfileResult>;

	/** Complete SAS pairing after {@link connectProfile} returned `pairingPending: true`. */
	confirmPairing(): Promise<UniverseAgentConnectProfileResult>;

	/** Abandon in-flight pairing and disconnect (no trust write). */
	cancelPairing(): Promise<void>;

	/** Connection-level phase for pane (StatusBar uses this in H4b). */
	getConnectionPhase(): ConnectionPhase;

	disconnect(): Promise<void>;

	listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult>;

	createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult>;

	deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void>;

	getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult>;

	subscribeSessionEventStream(sessionId: string, listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void };

	chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void>;

	listSkills(): Promise<UniverseAgentListSkillsResult>;

	setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult>;

	getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult>;

	/** Engine-backed catalog write; bound after Connect advertises ToolService.SaveSkillContent and probe OK. */
	saveSkillContent?(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult>;

	listAgentProfiles(request?: UniverseAgentListAgentProfilesRequest): Promise<UniverseAgentListAgentProfilesResult>;

	saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult>;

	deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult>;

	resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult>;

	listMcpServers(request?: UniverseAgentListMcpServersRequest): Promise<UniverseAgentListMcpServersResult>;

	/** McpService.GetMcpServerStatuses — runtime, not definitions (`mcp` vs `mcpRuntime`). */
	getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult>;

	/** McpService.GetMcpServerTools — `forceRefresh` maps to proto `force_refresh`. */
	getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult>;

	/** PluginService.List — also the `plugins` capability probe target. */
	listPlugins(): Promise<UniverseAgentListPluginsResult>;

	getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult>;

	/** PluginService.Enable. `enabled` defaults to true (`enablePlugin(id)`). */
	enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult>;

	reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult>;

	unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult>;

	scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult>;

	addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult>;

	updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult>;

	removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult>;

	toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult>;

	listTools(): Promise<UniverseAgentListToolsResult>;

	/** ConfigService.ListModels — always `include_disabled=true` (Engine Model registry). */
	listModels(): Promise<UniverseAgentListModelsResult>;
}
