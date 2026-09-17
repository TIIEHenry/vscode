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
	RemoteAgentCapabilitiesWire,
	RemoteAgentLoadMetricsWire,
	RemoteAgentModelInfoWire,
	ValidationErrorWire,
} from './grpcClientMappersCatalog.js';
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
 * `latency_ms`=4. Nested `capabilities`=5 Capabilities (`models`=1
 * ModelInfo `id`=1 `name`=2 `provider`=3 `max_tokens`=4 `enabled`=5;
 * `tools`=2 `modes`=3 `server_version`=4 `protocol_version`=5
 * `properties`=6 MapEntry `key`=1 `value`=2). repeated `errors`=6
 * ValidationError (`code`=1 varint `field`=2 `message`=3 `suggestion`=4).
 * `load`=7 LoadMetrics (`active_sessions`=1 `queue_depth`=2
 * `cpu_percent`=3 `memory_used_mb`=4). proto3: empty / 0 / false omitted.
 * Unknown fields unread. Shape matches `ConnectionReportWire` /
 * `mapConnectionReport`.
 */
export function decodeCheckConnectionResponse(bytes: Uint8Array): ConnectionReportWire {
	const fields = readProtoFields(bytes);
	const capabilities = lastBytes(fields, 5);
	const load = lastBytes(fields, 7);
	return {
		reachable: optionalBool(lastVarint(fields, 1)),
		authenticated: optionalBool(lastVarint(fields, 2)),
		can_create_session: optionalBool(lastVarint(fields, 3)),
		latency_ms: numberOrUndefined(lastVarint(fields, 4)),
		capabilities: capabilities === undefined ? undefined : decodeCapabilities(capabilities),
		errors: allLengthDelimited(fields, 6).map(decodeValidationError),
		load: load === undefined ? undefined : decodeLoadMetrics(load),
	};
}

function decodeCapabilities(bytes: Uint8Array): RemoteAgentCapabilitiesWire {
	const fields = readProtoFields(bytes);
	return {
		models: allLengthDelimited(fields, 1).map(decodeModelInfo),
		tools: allLengthDelimited(fields, 2).map(value => Buffer.from(value).toString('utf8')),
		modes: allLengthDelimited(fields, 3).map(value => Buffer.from(value).toString('utf8')),
		server_version: lastString(fields, 4),
		protocol_version: lastString(fields, 5),
		properties: decodeStringStringMap(allLengthDelimited(fields, 6)),
	};
}

function decodeModelInfo(bytes: Uint8Array): RemoteAgentModelInfoWire {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1),
		name: lastString(fields, 2),
		provider: lastString(fields, 3),
		max_tokens: numberOrUndefined(lastVarint(fields, 4)),
		enabled: optionalBool(lastVarint(fields, 5)),
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

function decodeLoadMetrics(bytes: Uint8Array): RemoteAgentLoadMetricsWire {
	const fields = readProtoFields(bytes);
	return {
		active_sessions: numberOrUndefined(lastVarint(fields, 1)),
		queue_depth: numberOrUndefined(lastVarint(fields, 2)),
		cpu_percent: numberOrUndefined(lastVarint(fields, 3)),
		memory_used_mb: numberOrUndefined(lastVarint(fields, 4)),
	};
}

/** proto3 `map<string,string>` = repeated MapEntry (`key`=1 `value`=2). */
function decodeStringStringMap(entries: readonly Uint8Array[]): Record<string, string> | undefined {
	if (entries.length === 0) {
		return undefined;
	}
	const values: Record<string, string> = {};
	for (const entry of entries) {
		const fields = readProtoFields(entry);
		const key = lastString(fields, 1);
		if (!key) {
			continue;
		}
		values[key] = lastString(fields, 2) ?? '';
	}
	return values;
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
