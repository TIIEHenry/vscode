/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentGetNodeRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of RemoteAgentService.RemoteAgentInfo.
 * Shape matches mapper `RemoteAgentInfoWire` (`id`/`name`/`description`/`status`/
 * `endpoint`/`tags`/`capabilities`/`load`/`last_heartbeat_at`).
 */
export interface RemoteAgentModelInfoWire {
	readonly id?: string;
	readonly name?: string;
	readonly provider?: string;
	readonly max_tokens?: number | string;
	readonly enabled?: boolean;
}

export interface RemoteAgentCapabilitiesWire {
	readonly models?: RemoteAgentModelInfoWire[];
	readonly tools?: string[];
	readonly modes?: string[];
	readonly server_version?: string;
	readonly protocol_version?: string;
	readonly properties?: { [key: string]: string };
}

export interface RemoteAgentLoadMetricsWire {
	readonly active_sessions?: number | string;
	readonly queue_depth?: number | string;
	readonly cpu_percent?: number | string;
	readonly memory_used_mb?: number | string;
}

export interface RemoteAgentInfoWire {
	readonly id?: string;
	readonly name?: string;
	readonly description?: string;
	readonly status?: string;
	readonly endpoint?: string;
	readonly tags?: string[];
	readonly capabilities?: RemoteAgentCapabilitiesWire;
	readonly load?: RemoteAgentLoadMetricsWire;
	readonly last_heartbeat_at?: number | string;
}

/**
 * RemoteAgentService.GetNode — `node_id`=1.
 * proto3: empty strings omitted.
 */
export function encodeGetNodeRequest(request: UniverseAgentGetNodeRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.nodeId),
	]);
}

/**
 * GetNode returns RemoteAgentInfo (not wrapped).
 * RemoteAgentInfo: `id`=1 `name`=2 `description`=3 `status`=4 `endpoint`=5
 * repeated `tags`=6 `capabilities`=7 `load`=8 `last_heartbeat_at`=9.
 * Capabilities: repeated `models`=1 ModelInfo (`id`=1 `name`=2 `provider`=3
 * `max_tokens`=4 `enabled`=5) repeated `tools`=2 repeated `modes`=3
 * `server_version`=4 `protocol_version`=5 map `properties`=6 (MapEntry
 * `key`=1 `value`=2).
 * LoadMetrics: `active_sessions`=1 `queue_depth`=2 `cpu_percent`=3
 * `memory_used_mb`=4.
 * proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `RemoteAgentInfoWire` / `mapRemoteAgentInfo`.
 */
export function decodeGetNodeResponse(bytes: Uint8Array): RemoteAgentInfoWire {
	return decodeRemoteAgentInfoScalars(bytes);
}

/** Local decode of RemoteAgentInfo including nested capabilities/load. Shared by ListNodes. */
export function decodeRemoteAgentInfoScalars(bytes: Uint8Array): RemoteAgentInfoWire {
	const fields = readProtoFields(bytes);
	const tags = allLengthDelimited(fields, 6).map(value => Buffer.from(value).toString('utf8'));
	const capabilities = lastBytes(fields, 7);
	const load = lastBytes(fields, 8);
	return {
		id: lastString(fields, 1),
		name: lastString(fields, 2),
		description: lastString(fields, 3),
		status: lastString(fields, 4),
		endpoint: lastString(fields, 5),
		tags: tags.length === 0 ? undefined : tags,
		capabilities: capabilities === undefined ? undefined : decodeCapabilities(capabilities),
		load: load === undefined ? undefined : decodeLoadMetrics(load),
		last_heartbeat_at: numberOrUndefined(lastVarint(fields, 9)),
	};
}

function decodeCapabilities(bytes: Uint8Array): RemoteAgentCapabilitiesWire {
	const fields = readProtoFields(bytes);
	const models = allLengthDelimited(fields, 1).map(decodeModelInfo);
	const tools = allLengthDelimited(fields, 2).map(value => Buffer.from(value).toString('utf8'));
	const modes = allLengthDelimited(fields, 3).map(value => Buffer.from(value).toString('utf8'));
	return {
		models: models.length === 0 ? undefined : models,
		tools: tools.length === 0 ? undefined : tools,
		modes: modes.length === 0 ? undefined : modes,
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

function optionalBool(value: bigint | undefined): boolean | undefined {
	return value === undefined ? undefined : value === 1n;
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
