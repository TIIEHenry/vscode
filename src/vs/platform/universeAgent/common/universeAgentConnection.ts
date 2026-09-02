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
	UniverseAgentSessionEvent,
	UniverseAgentTransportState,
} from './universeAgentTypes.js';

export const IUniverseAgentConnection = createDecorator<IUniverseAgentConnection>('universeAgentConnection');

/** IPC channel name for the electron-main hosted gRPC adapter. */
export const universeAgentConnectionChannelName = 'universeAgentConnection';

/**
 * Platform transport contract for UniverseAgent gRPC.
 * Renderer sees this interface via electron-browser ProxyChannel; node holds the client.
 */
export interface IUniverseAgentConnection {

	readonly _serviceBrand: undefined;

	/** Production connected = non-empty session_token + live channel; pairing-pending is never connected. */
	isEngineConnected(): boolean;

	getTransportState(): UniverseAgentTransportState;

	getConnectionSnapshot(): UniverseAgentConnectionSnapshot;

	getCapabilitySnapshot(): UniverseAgentCapabilitySnapshot;

	readonly onDidChangeConnection: Event<UniverseAgentConnectionSnapshot>;

	/** Placeholder until A2 wires file-mutation join (m6 §8 M6-A1). */
	readonly onDidFileMutation: Event<void>;

	connect(request: UniverseAgentConnectRequest): Promise<UniverseAgentConnectResult>;

	/** Hub / DirectAddress profile dial via live resolver (connection-hub H3). */
	connectProfile(profileId: string, options?: { readonly reconnect?: boolean }): Promise<UniverseAgentConnectProfileResult>;

	/** Connection-level phase for pane (StatusBar uses this in H4b). */
	getConnectionPhase(): ConnectionPhase;

	disconnect(): Promise<void>;

	listSessions(request: UniverseAgentListSessionsRequest): Promise<UniverseAgentListSessionsResult>;

	createSession(request: UniverseAgentCreateSessionRequest): Promise<UniverseAgentCreateSessionResult>;

	deleteSession(request: UniverseAgentDeleteSessionRequest): Promise<void>;

	getHistory(request: UniverseAgentGetHistoryRequest): Promise<UniverseAgentGetHistoryResult>;

	subscribeSessionEventStream(sessionId: string, listener: (event: UniverseAgentSessionEvent) => void): { dispose(): void };

	chat(request: UniverseAgentChatRequest, onResponse: (response: UniverseAgentChatResponse) => void): Promise<void>;
}
