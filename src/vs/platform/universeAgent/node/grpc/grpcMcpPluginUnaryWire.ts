/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentListMcpServersRequest } from '../../common/universeAgentTypes.js';
import type {
	GetMcpServerStatusesResponseWire,
	GetMcpServerToolsResponseWire,
	ListMcpServersResponseWire,
	ListPluginsResponseWire,
	PluginHookEntryWire,
	PluginInfoResponseWire,
	PluginSummaryWire,
} from './grpcClientMappersCatalog.js';
import { encodeEmptyProtoMessage } from './grpcCatalogUnaryWire.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * McpService.ListMcpServers — `transport_filter`=1 is not on the TS request
 * (do not invent / do not send). `enabled_only`=2 `work_dir`=3.
 * proto3: false / empty omitted.
 */
export function encodeListMcpServersRequest(request: UniverseAgentListMcpServersRequest): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(2, request.enabledOnly === true ? 1 : 0),
		encodeStringField(3, request.workDir),
	]);
}

/**
 * ListMcpServersResponse — repeated `servers`=1 `total`=2 (total not on Wire).
 * McpServerConfig list summary fills only existing Wire keys.
 * Unknown fields unread.
 */
export function decodeListMcpServersResponse(bytes: Uint8Array): ListMcpServersResponseWire {
	return {
		servers: allLengthDelimited(readProtoFields(bytes), 1).map(decodeMcpServerSummary),
	};
}

/**
 * McpServerConfig (list summary) — `id`=1 `name`=2 `transport`=3 `enabled`=8
 * `origin`=10 `effective_enabled`=12 `has_project_override`=13.
 * Enum `McpTransport`: UNSPECIFIED=0 STDIO=1 SSE=2 STREAMABLE_HTTP=3
 * decoded to mapper strings. Unknown / remaining proto fields unread.
 */
function decodeMcpServerSummary(bytes: Uint8Array): NonNullable<ListMcpServersResponseWire['servers']>[number] {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1),
		name: lastString(fields, 2),
		transport: mcpTransportWireName(lastVarint(fields, 3)),
		origin: lastString(fields, 10),
		enabled: lastVarint(fields, 8) === 1n,
		effective_enabled: lastVarint(fields, 12) === 1n,
		has_project_override: lastVarint(fields, 13) === 1n,
	};
}

/** McpService.GetMcpServerStatuses — repeated `server_ids`=1. */
export function encodeGetMcpServerStatusesRequest(serverIds?: readonly string[]): Uint8Array {
	return encodeRepeatedString(1, serverIds ?? []);
}

/**
 * GetMcpServerStatusesResponse — repeated `statuses`=1 `checked_at`=2.
 * McpServerStatus: `server_id`=1 `status`=2 `error_message`=3 `last_connected_at`=4.
 * Unknown fields unread.
 */
export function decodeGetMcpServerStatusesResponse(bytes: Uint8Array): GetMcpServerStatusesResponseWire {
	const fields = readProtoFields(bytes);
	return {
		statuses: allLengthDelimited(fields, 1).map(decodeMcpServerStatus),
		checked_at: numberOrUndefined(lastVarint(fields, 2)),
	};
}

function decodeMcpServerStatus(bytes: Uint8Array): NonNullable<GetMcpServerStatusesResponseWire['statuses']>[number] {
	const fields = readProtoFields(bytes);
	return {
		server_id: lastString(fields, 1),
		status: numberOrUndefined(lastVarint(fields, 2)),
		error_message: lastString(fields, 3),
		last_connected_at: numberOrUndefined(lastVarint(fields, 4)),
	};
}

/**
 * McpService.GetMcpServerTools — `server_id`=1 `force_refresh`=2.
 * proto3: empty string / false omitted.
 */
export function encodeGetMcpServerToolsRequest(serverId: string, forceRefresh?: boolean): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, serverId),
		encodeInt32Field(2, forceRefresh === true ? 1 : 0),
	]);
}

/**
 * GetMcpServerToolsResponse — repeated `tools`=1 `total`=2 `cached_at`=3.
 * McpToolDefinition: `name`=1 `description`=2 `input_schema_json`=3.
 * Unknown fields unread.
 */
export function decodeGetMcpServerToolsResponse(bytes: Uint8Array): GetMcpServerToolsResponseWire {
	const fields = readProtoFields(bytes);
	return {
		tools: allLengthDelimited(fields, 1).map(decodeMcpToolDefinition),
		total: numberOrUndefined(lastVarint(fields, 2)),
		cached_at: numberOrUndefined(lastVarint(fields, 3)),
	};
}

function decodeMcpToolDefinition(bytes: Uint8Array): NonNullable<GetMcpServerToolsResponseWire['tools']>[number] {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1),
		description: lastString(fields, 2),
		input_schema_json: lastString(fields, 3),
	};
}

/**
 * PluginService.List — empty `ListPluginsRequest`.
 * Must still be sent as 0-payload proto (never skip sendMessage).
 */
export function encodeListPluginsRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

/** ListPluginsResponse — repeated `plugins`=1. Unknown fields unread. */
export function decodeListPluginsResponse(bytes: Uint8Array): ListPluginsResponseWire {
	return {
		plugins: allLengthDelimited(readProtoFields(bytes), 1).map(decodePluginSummary),
	};
}

/**
 * PluginSummary — `id`=1 `display_name`=2 `version`=3 `source`=4
 * `hook_count`=5 `status`=6 `loaded_at`=7.
 * PluginStatus ACTIVE=0 omitted → decode as 0. Unknown fields unread.
 */
function decodePluginSummary(bytes: Uint8Array): PluginSummaryWire {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1),
		display_name: lastString(fields, 2),
		version: lastString(fields, 3),
		source: lastString(fields, 4),
		hook_count: numberOrUndefined(lastVarint(fields, 5)),
		status: numberOrUndefined(lastVarint(fields, 6)) ?? 0,
		loaded_at: numberOrUndefined(lastVarint(fields, 7)),
	};
}

/** PluginService.Info — `plugin_id`=1. proto3: empty string omitted. */
export function encodePluginInfoRequest(pluginId: string): Uint8Array {
	return encodeStringField(1, pluginId);
}

/**
 * PluginInfoResponse — `summary`=1 repeated `hooks`=2 `config`=3 `error_message`=4.
 * `config` is proto3 `map<string,string>` = repeated MapEntry (`key`=1 `value`=2).
 * Unknown fields unread.
 */
export function decodePluginInfoResponse(bytes: Uint8Array): PluginInfoResponseWire {
	const fields = readProtoFields(bytes);
	const summary = lastBytes(fields, 1);
	return {
		summary: summary ? decodePluginSummary(summary) : undefined,
		hooks: allLengthDelimited(fields, 2).map(decodePluginHookEntry),
		config: decodeStringStringMap(allLengthDelimited(fields, 3)),
		error_message: lastString(fields, 4),
	};
}

function decodePluginHookEntry(bytes: Uint8Array): PluginHookEntryWire {
	const fields = readProtoFields(bytes);
	return {
		hook_type: lastString(fields, 1),
		priority: numberOrUndefined(lastVarint(fields, 2)),
		class_name: lastString(fields, 3),
	};
}

function decodeStringStringMap(entries: readonly Uint8Array[]): Record<string, string> | undefined {
	if (entries.length === 0) {
		return undefined;
	}
	const config: Record<string, string> = {};
	for (const entry of entries) {
		const fields = readProtoFields(entry);
		const key = lastString(fields, 1);
		if (!key) {
			continue;
		}
		config[key] = lastString(fields, 2) ?? '';
	}
	return config;
}

/**
 * Decode McpTransport varint to strings `mapMcpTransport` already accepts.
 * Do not change the mapper contract.
 */
function mcpTransportWireName(value: bigint | undefined): string | undefined {
	switch (value === undefined ? 0 : Number(value)) {
		case 1:
			return 'stdio';
		case 2:
			return 'sse';
		case 3:
			return 'streamable_http';
		default:
			return undefined;
	}
}

function encodeRepeatedString(field: number, values: readonly string[]): Buffer {
	if (values.length === 0) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(values.map(value => encodeStringField(field, value)));
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
