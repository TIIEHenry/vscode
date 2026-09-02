/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../instantiation/common/extensions.js';
import type { ConnectionPhase, UniverseAgentConnectProfileResult } from '../common/connectionHubTypes.js';
import {
	IUniverseAgentConnection,
	type IUniverseAgentTeamApi,
	type UniverseAgentNavigatorCapabilityKey,
} from '../common/universeAgentConnection.js';
import type {
	UniverseAgentCapabilitySnapshot,
	UniverseAgentCapabilitySupport,
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
	UniverseAgentTransportState,
} from '../common/universeAgentTypes.js';
import {
	createWebUnsupportedCapabilitySnapshot,
	rejectUnsupportedEnvironment,
	UniverseAgentUnsupportedEnvironmentError,
	WEB_UNSUPPORTED_CODE,
	WEB_UNSUPPORTED_REASON,
} from './webUnsupported.js';

export class WebUniverseAgentConnection implements IUniverseAgentConnection {

	declare readonly _serviceBrand: undefined;

	readonly onDidChangeConnection = Event.None;
	readonly onDidFileMutation = Event.None;
	readonly onDidTurnSettle = Event.None;
	readonly onDidChangeTeamRuntime = Event.None;

	readonly team: IUniverseAgentTeamApi = {
		memberStatus: () => rejectUnsupportedEnvironment(),
		taskList: () => rejectUnsupportedEnvironment(),
		teamInfo: () => rejectUnsupportedEnvironment(),
	};

	isEngineConnected(): boolean {
		return false;
	}

	getTransportState(): UniverseAgentTransportState {
		return 'idle';
	}

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot {
		return {
			transport: 'idle',
			pairingPending: false,
			channelAlive: false,
			sharedFsRootSent: false,
			capabilities: this.getCapabilitySnapshot(),
		};
	}

	getCapabilitySnapshot(): UniverseAgentCapabilitySnapshot {
		return createWebUnsupportedCapabilitySnapshot();
	}

	requestAgentTreeRefresh(_sessionId: string): void {
		// Web has no host SessionView; no-op rather than throwing from a void method.
	}

	getNavigatorCapability(_key: UniverseAgentNavigatorCapabilityKey): UniverseAgentCapabilitySupport {
		return 'UNSUPPORTED';
	}

	async connect(_request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult> {
		return { methods: [], events: [] };
	}

	async connectProfile(_profileId: string, _options?: { readonly reconnect?: boolean }): Promise<UniverseAgentConnectProfileResult> {
		return { ok: false, code: WEB_UNSUPPORTED_CODE, reason: WEB_UNSUPPORTED_REASON };
	}

	getConnectionPhase(): ConnectionPhase {
		return { kind: 'disconnected' };
	}

	disconnect(): Promise<void> {
		return rejectUnsupportedEnvironment();
	}

	listSessions(_request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult> {
		return rejectUnsupportedEnvironment();
	}

	createSession(_request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult> {
		return rejectUnsupportedEnvironment();
	}

	deleteSession(_request: UniverseAgentDeleteSessionRequest): Promise<void> {
		return rejectUnsupportedEnvironment();
	}

	getHistory(_request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult> {
		return rejectUnsupportedEnvironment();
	}

	subscribeSessionEventStream(_sessionId: string, _listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void } {
		throw new UniverseAgentUnsupportedEnvironmentError();
	}

	chat(_request: UniverseAgentChatRequest, _onResponse: (response: UniverseAgentChatResponse) => void): Promise<void> {
		return rejectUnsupportedEnvironment();
	}

	listSkills(): Promise<UniverseAgentListSkillsResult> {
		return rejectUnsupportedEnvironment();
	}

	setSkillEnabled(_request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult> {
		return rejectUnsupportedEnvironment();
	}

	getSkillInfo(_request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult> {
		return rejectUnsupportedEnvironment();
	}

	saveSkillContent(_request: UniverseAgentSaveSkillContentRequest): Promise<UniverseAgentSaveSkillContentResult> {
		return rejectUnsupportedEnvironment();
	}

	listAgentProfiles(_request?: UniverseAgentListAgentProfilesRequest): Promise<UniverseAgentListAgentProfilesResult> {
		return rejectUnsupportedEnvironment();
	}

	saveAgentProfile(_request: UniverseAgentSaveAgentProfileRequest): Promise<UniverseAgentSaveAgentProfileResult> {
		return rejectUnsupportedEnvironment();
	}

	deleteAgentProfile(_request: UniverseAgentDeleteAgentProfileRequest): Promise<UniverseAgentDeleteAgentProfileResult> {
		return rejectUnsupportedEnvironment();
	}

	resetAgentProfile(_request: UniverseAgentResetAgentProfileRequest): Promise<UniverseAgentResetAgentProfileResult> {
		return rejectUnsupportedEnvironment();
	}

	listMcpServers(_request?: UniverseAgentListMcpServersRequest): Promise<UniverseAgentListMcpServersResult> {
		return rejectUnsupportedEnvironment();
	}

	getMcpServerStatuses(_serverIds?: readonly string[]): Promise<UniverseAgentGetMcpServerStatusesResult> {
		return rejectUnsupportedEnvironment();
	}

	getMcpServerTools(_serverId: string, _forceRefresh?: boolean): Promise<UniverseAgentGetMcpServerToolsResult> {
		return rejectUnsupportedEnvironment();
	}

	listPlugins(): Promise<UniverseAgentListPluginsResult> {
		return rejectUnsupportedEnvironment();
	}

	getPluginInfo(_id: string): Promise<UniverseAgentPluginInfoResult> {
		return rejectUnsupportedEnvironment();
	}

	enablePlugin(_id: string, _enabled?: boolean): Promise<UniverseAgentEnablePluginResult> {
		return rejectUnsupportedEnvironment();
	}

	reloadPlugin(_id: string): Promise<UniverseAgentReloadPluginResult> {
		return rejectUnsupportedEnvironment();
	}

	unloadPlugin(_id: string): Promise<UniverseAgentUnloadPluginResult> {
		return rejectUnsupportedEnvironment();
	}

	scanNewPlugins(): Promise<UniverseAgentScanNewPluginsResult> {
		return rejectUnsupportedEnvironment();
	}

	addMcpServer(_request: UniverseAgentAddMcpServerRequest): Promise<UniverseAgentAddMcpServerResult> {
		return rejectUnsupportedEnvironment();
	}

	updateMcpServer(_request: UniverseAgentUpdateMcpServerRequest): Promise<UniverseAgentUpdateMcpServerResult> {
		return rejectUnsupportedEnvironment();
	}

	removeMcpServer(_request: UniverseAgentRemoveMcpServerRequest): Promise<UniverseAgentRemoveMcpServerResult> {
		return rejectUnsupportedEnvironment();
	}

	toggleMcpServer(_request: UniverseAgentToggleMcpServerRequest): Promise<UniverseAgentToggleMcpServerResult> {
		return rejectUnsupportedEnvironment();
	}

	listTools(): Promise<UniverseAgentListToolsResult> {
		return rejectUnsupportedEnvironment();
	}

	listModels(): Promise<UniverseAgentListModelsResult> {
		return rejectUnsupportedEnvironment();
	}
}

registerSingleton(IUniverseAgentConnection, WebUniverseAgentConnection, InstantiationType.Delayed);
