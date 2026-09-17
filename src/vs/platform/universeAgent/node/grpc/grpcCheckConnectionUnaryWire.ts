/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentCheckConnectionRequest,
	UniverseAgentRemoteSessionParams,
} from '../../common/universeAgentTypes.js';
import type {
	ConnectionReportWire,
	ValidationErrorWire,
} from './grpcClientMappersCatalog.js';
import { decodeCapabilities, decodeLoadMetrics } from './grpcGetNodeUnaryWire.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeInt64Field,
	encodePresentMessageField,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

export type { ConnectionReportWire };

/**
 * RemoteAgentService.CheckConnection — `node_id`=1 nested `session_params`=2
 * (SessionParams). SessionParams: `preferred_model`=1 repeated
 * `required_tools`=2 `mode`=3 `max_tokens`=4 `max_turns`=5
 * `system_prompt_suffix`=6 `max_execution_time_ms`=7.
 * Nested SessionParams uses `encodePresentMessageField(2, inner)` with known
 * numbers. proto3: empty strings / empty repeated / 0 omitted.
 * `max_tokens` / `max_turns` via `encodeInt32Field`; `max_execution_time_ms`
 * via `encodeInt64Field`.
 */
export function encodeCheckConnectionRequest(request: UniverseAgentCheckConnectionRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.nodeId),
		encodePresentMessageField(2, encodeSessionParams(request.sessionParams)),
	]);
}

/**
 * ConnectionReport — `reachable`=1 `authenticated`=2 `can_create_session`=3
 * `latency_ms`=4. Nested `capabilities`=5 / `load`=7 decoded via GetNode
 * `decodeCapabilities` / `decodeLoadMetrics` (empty repeated is `undefined`
 * not `[]`). repeated `errors`=6 ValidationError (`code`=1 varint `field`=2
 * `message`=3 `suggestion`=4); empty repeated is `undefined`. proto3: empty /
 * 0 / false omitted. Unknown fields unread. Shape matches
 * `ConnectionReportWire` / `mapConnectionReport`.
 */
export function decodeCheckConnectionResponse(bytes: Uint8Array): ConnectionReportWire {
	const fields = readProtoFields(bytes);
	const capabilities = lastBytes(fields, 5);
	const errors = allLengthDelimited(fields, 6).map(decodeValidationError);
	const load = lastBytes(fields, 7);
	return {
		reachable: optionalBool(lastVarint(fields, 1)),
		authenticated: optionalBool(lastVarint(fields, 2)),
		can_create_session: optionalBool(lastVarint(fields, 3)),
		latency_ms: numberOrUndefined(lastVarint(fields, 4)),
		capabilities: capabilities === undefined ? undefined : decodeCapabilities(capabilities),
		errors: errors.length === 0 ? undefined : errors,
		load: load === undefined ? undefined : decodeLoadMetrics(load),
	};
}

function decodeValidationError(bytes: Uint8Array): ValidationErrorWire {
	const fields = readProtoFields(bytes);
	return {
		code: numberOrUndefined(lastVarint(fields, 1)),
		field: lastString(fields, 2),
		message: lastString(fields, 3),
		suggestion: lastString(fields, 4),
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

function optionalBool(value: bigint | undefined): boolean | undefined {
	return value === undefined ? undefined : value === 1n;
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
