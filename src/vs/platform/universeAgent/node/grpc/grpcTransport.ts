/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
	UniverseAgentChatStream,
	UniverseAgentConnectRequest,
	UniverseAgentConnectResult,
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
	UniverseAgentSessionStreamCloseCause,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSaveSkillContentRequest,
	UniverseAgentSaveSkillContentResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
	UniverseAgentAgentTreeNode,
	UniverseAgentFetchToolDetailRequest,
	UniverseAgentFetchToolDetailWireResult,
	UniverseAgentTeamInfo,
	UniverseAgentTeamMemberInfo,
	UniverseAgentTeamTaskInfo,
} from '../../common/universeAgentTypes.js';

export type { UniverseAgentConnectResult } from '../../common/universeAgentTypes.js';

export interface UniverseAgentAuthNonceRequest {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
}

export interface UniverseAgentAuthNonceResult {
	readonly authNonce: Uint8Array;
	readonly engineIdentityId: string;
	readonly engineCertFingerprint: string;
	readonly expiresAtMs?: number;
}

export interface UniverseAgentDeviceAuthConnectRequest {
	readonly clientIdentityId: string;
	readonly clientPublicKey: Uint8Array;
	readonly authNonce: Uint8Array;
	readonly signature: Uint8Array;
	readonly protocolVersion: string;
	readonly pairingPhase?: 'provisional' | 'formal';
}

/** gRPC status codes used by capability probe and transport classification. */
export const GrpcStatusCode = {
	OK: 0,
	UNIMPLEMENTED: 12,
	UNAVAILABLE: 14,
	DEADLINE_EXCEEDED: 4,
} as const;

export class UniverseAgentTransportError extends Error {

	constructor(
		readonly code: number,
		message: string,
	) {
		super(message);
		this.name = 'UniverseAgentTransportError';
	}
}

export function isTransportFailureCode(code: number): boolean {
	return code === GrpcStatusCode.UNAVAILABLE
		|| code === GrpcStatusCode.DEADLINE_EXCEEDED;
}

/**
 * Injectable gRPC transport surface. Production uses @grpc/grpc-js; tests inject mocks.
 */
export interface IUniverseAgentGrpcTransport {

	readonly isChannelAlive: boolean;

	connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult>;

	getAuthNonce(request: UniverseAgentAuthNonceRequest): Promise<UniverseAgentAuthNonceResult>;

	connectWithDeviceAuth(request: UniverseAgentDeviceAuthConnectRequest): Promise<UniverseAgentConnectResult>;

	close(): void;

	probeRpc(service: string, method: string): Promise<number>;

	listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult>;

	createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult>;

	deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void>;

	getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult>;

	subscribeSessionEventStream(sessionId: string, listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void };

	chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void>;

	openChatStream(
		sessionId: string,
		onResponse: (response: UniverseAgentChatResponse) => void,
		onClosed?: (cause: UniverseAgentSessionStreamCloseCause) => void,
	): UniverseAgentChatStream;

	listSkills(): Promise<UniverseAgentListSkillsResult>;

	setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult>;

	getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult>;

	saveSkillContent(request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult>;

	listAgentProfiles(request: UniverseAgentListAgentProfilesRequest): Promise<UniverseAgentListAgentProfilesResult>;

	saveAgentProfile(request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult>;

	deleteAgentProfile(request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult>;

	resetAgentProfile(request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult>;

	listMcpServers(request: UniverseAgentListMcpServersRequest): Promise<UniverseAgentListMcpServersResult>;

	getMcpServerStatuses(serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult>;

	getMcpServerTools(serverId: string, forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult>;

	listPlugins(): Promise<UniverseAgentListPluginsResult>;

	getPluginInfo(id: string): Promise<UniverseAgentPluginInfoResult>;

	enablePlugin(id: string, enabled?: boolean): Promise<UniverseAgentEnablePluginResult>;

	reloadPlugin(id: string): Promise<UniverseAgentReloadPluginResult>;

	unloadPlugin(id: string): Promise<UniverseAgentUnloadPluginResult>;

	scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult>;

	addMcpServer(request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult>;

	updateMcpServer(request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult>;

	removeMcpServer(request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult>;

	toggleMcpServer(request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult>;

	listTools(): Promise<UniverseAgentListToolsResult>;

	/** ConfigService.ListModels — always `include_disabled=true`. */
	listModels(): Promise<UniverseAgentListModelsResult>;

	/** Host-only: AgentService.Tree (m6 §11 A1). */
	fetchAgentTree(sessionId: string): Promise<UniverseAgentAgentTreeNode | undefined>;

	/** Host-only: AgentService.FetchToolDetail (M7 P2a). Always `subscribe=false`. */
	fetchToolDetail(request: UniverseAgentFetchToolDetailRequest): Promise<UniverseAgentFetchToolDetailWireResult>;

	memberStatus(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamMemberInfo[]>;

	taskList(sessionId: string, agentId: string): Promise<readonly UniverseAgentTeamTaskInfo[]>;

	teamInfo(sessionId: string, agentId: string, teamId: number): Promise<UniverseAgentTeamInfo | undefined>;
}

/** Service / method paths aligned with UniverseAgent grpc-api proto package names. */
export const UniverseAgentGrpcServices = {
	System: {
		service: 'universeagent.system.v1.SystemService',
		Connect: 'Connect',
		GetAuthNonce: 'GetAuthNonce',
	},
	Session: {
		service: 'universeagent.session.v1.SessionService',
		List: 'List',
		Create: 'Create',
		Delete: 'Delete',
		GetHistory: 'GetHistory',
		SessionEventStream: 'SessionEventStream',
	},
	Agent: {
		service: 'universeagent.agent.v1.AgentService',
		Chat: 'Chat',
		Tree: 'Tree',
		ListAgentProfiles: 'ListAgentProfiles',
		SaveAgentProfile: 'SaveAgentProfile',
		DeleteAgentProfile: 'DeleteAgentProfile',
		ResetAgentProfile: 'ResetAgentProfile',
		FetchToolDetail: 'FetchToolDetail',
	},
	Mcp: {
		service: 'universeagent.mcp.v1.McpService',
		ListMcpServers: 'ListMcpServers',
		GetMcpServerStatuses: 'GetMcpServerStatuses',
		GetMcpServerTools: 'GetMcpServerTools',
		ToggleMcpServer: 'ToggleMcpServer',
		AddMcpServer: 'AddMcpServer',
		UpdateMcpServer: 'UpdateMcpServer',
		RemoveMcpServer: 'RemoveMcpServer',
	},
	Plugin: {
		service: 'universeagent.plugin.v1.PluginService',
		List: 'List',
		Info: 'Info',
		Enable: 'Enable',
		Reload: 'Reload',
		Unload: 'Unload',
		ScanNew: 'ScanNew',
	},
	Config: {
		service: 'universeagent.config.v1.ConfigService',
		ListModels: 'ListModels',
	},
	Team: {
		service: 'universeagent.team.v1.TeamService',
		MemberStatus: 'MemberStatus',
		TaskList: 'TaskList',
		TeamInfo: 'TeamInfo',
	},
	Tool: {
		service: 'universeagent.tool.v1.ToolService',
		ListSkills: 'ListSkills',
		SkillInfo: 'SkillInfo',
		SetSkillEnabled: 'SetSkillEnabled',
		SaveSkillContent: 'SaveSkillContent',
		ListTools: 'ListTools',
	},
} as const;

/** ConnectResponse.capabilities.methods advertisement key for SaveSkillContent. */
export const UniverseAgentSaveSkillContentMethodKey = 'ToolService.SaveSkillContent';

/** ConnectResponse.capabilities.methods advertisement key for FetchToolDetail. */
export const UniverseAgentFetchToolDetailMethodKey = 'AgentService.FetchToolDetail';
