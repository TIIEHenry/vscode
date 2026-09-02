/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentChatRequest,
	UniverseAgentChatResponse,
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
	UniverseAgentSessionEvent,
	UniverseAgentSetSkillEnabledRequest,
	UniverseAgentSetSkillEnabledResult,
	UniverseAgentSkillInfoRequest,
	UniverseAgentSkillInfoResult,
} from '../../common/universeAgentTypes.js';

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

	listSkills(): Promise<UniverseAgentListSkillsResult>;

	setSkillEnabled(request: UniverseAgentSetSkillEnabledRequest): Promise<UniverseAgentSetSkillEnabledResult>;

	getSkillInfo(request: UniverseAgentSkillInfoRequest): Promise<UniverseAgentSkillInfoResult>;
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
	},
	Tool: {
		service: 'universeagent.tool.v1.ToolService',
		ListSkills: 'ListSkills',
		SkillInfo: 'SkillInfo',
		SetSkillEnabled: 'SetSkillEnabled',
	},
} as const;
