/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentCreateRemoteSessionRequest,
	UniverseAgentRemoteSessionParams,
} from '../../common/universeAgentTypes.js';
import {
	encodeInt32Field,
	encodeInt64Field,
	encodePresentMessageField,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.CreateRemoteSessionResponse.
 * Mapper: `mapCreateRemoteSessionResponse` (`callId` / `status` /
 * `createdAt: requiredInt64(wire.created_at)` /
 * `expiresAt: requiredInt64(wire.expires_at)`).
 */
export interface CreateRemoteSessionResponseWire {
	readonly call_id?: string;
	readonly status?: string;
	readonly created_at?: number | string;
	readonly expires_at?: number | string;
}

/**
 * RemoteAgentService.CreateRemoteSession — `node_id`=1 `mode`=2 nested
 * `session_params`=3 (SessionParams). SessionParams: `preferred_model`=1
 * repeated `required_tools`=2 `mode`=3 `max_tokens`=4 `max_turns`=5
 * `system_prompt_suffix`=6 `max_execution_time_ms`=7.
 * Nested SessionParams uses `encodePresentMessageField(3, inner)` with known
 * numbers. proto3: empty strings / empty repeated / 0 omitted.
 * `max_tokens` / `max_turns` via `encodeInt32Field`; `max_execution_time_ms`
 * via `encodeInt64Field`.
 */
export function encodeCreateRemoteSessionRequest(request: UniverseAgentCreateRemoteSessionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.nodeId),
		encodeStringField(2, request.mode),
		encodePresentMessageField(3, encodeSessionParams(request.sessionParams)),
	]);
}

/**
 * CreateRemoteSessionResponse — `call_id`=1 `status`=2 `created_at`=3
 * `expires_at`=4. proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `CreateRemoteSessionResponseWire` /
 * TEST `mapCreateRemoteSessionResponse`.
 */
export function decodeCreateRemoteSessionResponse(bytes: Uint8Array): CreateRemoteSessionResponseWire {
	const fields = readProtoFields(bytes);
	return {
		call_id: lastString(fields, 1),
		status: lastString(fields, 2),
		created_at: numberOrUndefined(lastVarint(fields, 3)),
		expires_at: numberOrUndefined(lastVarint(fields, 4)),
	};
}

function encodeSessionParams(params: UniverseAgentRemoteSessionParams): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, params.preferredModel),
		...params.requiredTools.map(tool => encodeStringField(2, tool)),
		encodeStringField(3, params.mode),
		encodeInt32Field(4, params.maxTokens),
		encodeInt32Field(5, params.maxTurns),
		encodeStringField(6, params.systemPromptSuffix),
		encodeInt64Field(7, params.maxExecutionTimeMs),
	]);
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
