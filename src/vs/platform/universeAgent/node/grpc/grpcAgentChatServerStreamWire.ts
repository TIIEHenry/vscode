/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentContinueGenerationRequest,
	UniverseAgentRegenerateRequest,
	UniverseAgentResumeRequest,
} from '../../common/universeAgentTypes.js';
import { encodeStringField } from './grpcProtoCodec.js';

/**
 * AgentService.ContinueGeneration / Regenerate — `session_id`=1 `agent_id`=2 `turn_id`=3 `message_id`=4.
 * Same layout in J `agent_service.proto`. proto3 empty strings omitted.
 */
function encodeSessionTurnMessageRequest(request: {
	readonly sessionId: string;
	readonly agentId: string;
	readonly turnId: string;
	readonly messageId: string;
}): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeStringField(3, request.turnId),
		encodeStringField(4, request.messageId),
	]);
}

export function encodeContinueGenerationRequest(request: UniverseAgentContinueGenerationRequest): Uint8Array {
	return encodeSessionTurnMessageRequest(request);
}

export function encodeRegenerateRequest(request: UniverseAgentRegenerateRequest): Uint8Array {
	return encodeSessionTurnMessageRequest(request);
}

/**
 * AgentService.Resume — `session_id`=1 `agent_id`=2.
 * proto3 empty strings omitted. ≠ Session.Resume / ResumeLoop / ResumeQueue.
 */
export function encodeResumeRequest(request: UniverseAgentResumeRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}
