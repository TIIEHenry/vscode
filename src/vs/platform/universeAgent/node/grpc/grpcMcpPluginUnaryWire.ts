/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentAddMcpServerRequest,
	UniverseAgentListMcpServersRequest,
	UniverseAgentMcpServerConfig,
	UniverseAgentMcpTransport,
	UniverseAgentRemoveMcpServerRequest,
	UniverseAgentToggleMcpServerRequest,
	UniverseAgentUpdateMcpServerRequest,
} from '../../common/universeAgentTypes.js';
import type {
	AddMcpServerResponseWire,
	EnablePluginResponseWire,
	GetMcpServerStatusesResponseWire,
	GetMcpServerToolsResponseWire,
	ListMcpServersResponseWire,
	ListPluginsResponseWire,
	PluginHookEntryWire,
	PluginInfoResponseWire,
	PluginSummaryWire,
	ReloadPluginResponseWire,
	RemoveMcpServerResponseWire,
	ScanNewPluginsResponseWire,
	ToggleMcpServerResponseWire,
	UnloadPluginResponseWire,
	UpdateMcpServerResponseWire,
} from './grpcClientMappersCatalog.js';
import { encodeEmptyProtoMessage } from './grpcCatalogUnaryWire.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeMessageField,
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
 * PluginService.Enable — `plugin_id`=1 `enabled`=2.
 * Production default matches JSON: `enabled !== false` (undefined → true).
 * proto3: false omitted.
 */
export function encodeEnablePluginRequest(pluginId: string, enabled?: boolean): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, pluginId),
		encodeInt32Field(2, enabled !== false ? 1 : 0),
	]);
}

/** EnablePluginResponse — `plugin`=1 (PluginSummary 1–7). Unknown fields unread. */
export function decodeEnablePluginResponse(bytes: Uint8Array): EnablePluginResponseWire {
	return decodePluginHolder(bytes);
}

/** PluginService.Reload — `plugin_id`=1. proto3: empty string omitted. */
export function encodeReloadPluginRequest(pluginId: string): Uint8Array {
	return encodeStringField(1, pluginId);
}

/** ReloadPluginResponse — `plugin`=1. Unknown fields unread. */
export function decodeReloadPluginResponse(bytes: Uint8Array): ReloadPluginResponseWire {
	return decodePluginHolder(bytes);
}

/** PluginService.Unload — `plugin_id`=1. proto3: empty string omitted. */
export function encodeUnloadPluginRequest(pluginId: string): Uint8Array {
	return encodeStringField(1, pluginId);
}

/** UnloadPluginResponse — `removed_hook_count`=1. Unknown fields unread. */
export function decodeUnloadPluginResponse(bytes: Uint8Array): UnloadPluginResponseWire {
	return {
		removed_hook_count: numberOrUndefined(lastVarint(readProtoFields(bytes), 1)),
	};
}

/**
 * PluginService.ScanNew — empty `ScanNewPluginsRequest`.
 * Must still be sent as 0-payload proto (never skip sendMessage).
 */
export function encodeScanNewPluginsRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

/**
 * ScanNewPluginsResponse — repeated `new_plugins`=1 `skipped_count`=2.
 * Unknown fields unread.
 */
export function decodeScanNewPluginsResponse(bytes: Uint8Array): ScanNewPluginsResponseWire {
	const fields = readProtoFields(bytes);
	return {
		new_plugins: allLengthDelimited(fields, 1).map(decodePluginSummary),
		skipped_count: numberOrUndefined(lastVarint(fields, 2)),
	};
}

/**
 * McpService.ToggleMcpServer — `server_id`=1 `enabled`=2 `scope`=3 `work_dir`=4.
 * proto3: false / empty omitted.
 */
export function encodeToggleMcpServerRequest(request: UniverseAgentToggleMcpServerRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.id),
		encodeInt32Field(2, request.enabled === true ? 1 : 0),
		encodeStringField(3, request.scope),
		encodeStringField(4, request.workDir),
	]);
}

/**
 * ToggleMcpServerResponse — `success`=1 `error_message`=2.
 * `actual_enabled`=3 is not on the existing Wire / mapper — unread.
 */
export function decodeToggleMcpServerResponse(bytes: Uint8Array): ToggleMcpServerResponseWire {
	const fields = readProtoFields(bytes);
	return {
		success: lastVarint(fields, 1) === 1n,
		error_message: lastString(fields, 2),
	};
}

/**
 * McpService.AddMcpServer — `config`=1 `test_connection`=2 `scope`=3 `work_dir`=4.
 * proto3: false / empty omitted. Do not invent origin/apps/project_override.
 */
export function encodeAddMcpServerRequest(request: UniverseAgentAddMcpServerRequest): Uint8Array {
	return Buffer.concat([
		encodeMessageField(1, encodeMcpServerConfig(request.config)),
		encodeInt32Field(2, request.testConnection === true ? 1 : 0),
		encodeStringField(3, request.scope),
		encodeStringField(4, request.workDir),
	]);
}

/**
 * AddMcpServerResponse — `success`=1 `error_message`=2 `assigned_id`=3.
 * `test_status`=4 / `test_error`=5 are not on the existing Wire / mapper — unread.
 */
export function decodeAddMcpServerResponse(bytes: Uint8Array): AddMcpServerResponseWire {
	const fields = readProtoFields(bytes);
	return {
		success: lastVarint(fields, 1) === 1n,
		error_message: lastString(fields, 2),
		assigned_id: lastString(fields, 3),
	};
}

/**
 * McpService.UpdateMcpServer — `server_id`=1 `config`=2 `restart_connection`=3
 * `scope`=4 `work_dir`=5. proto3: false / empty omitted.
 */
export function encodeUpdateMcpServerRequest(request: UniverseAgentUpdateMcpServerRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.serverId),
		encodeMessageField(2, encodeMcpServerConfig(request.config)),
		encodeInt32Field(3, request.restartConnection === true ? 1 : 0),
		encodeStringField(4, request.scope),
		encodeStringField(5, request.workDir),
	]);
}

/**
 * UpdateMcpServerResponse — `success`=1 `error_message`=2 `updated_config`=3.
 * Config transport enum → mapper strings. Unknown fields unread.
 */
export function decodeUpdateMcpServerResponse(bytes: Uint8Array): UpdateMcpServerResponseWire {
	const fields = readProtoFields(bytes);
	const config = lastBytes(fields, 3);
	return {
		success: lastVarint(fields, 1) === 1n,
		error_message: lastString(fields, 2),
		updated_config: config ? decodeMcpServerConfig(config) : undefined,
	};
}

/**
 * McpService.RemoveMcpServer — `server_id`=1 `force`=2 `scope`=3 `work_dir`=4.
 * proto3: false / empty omitted.
 */
export function encodeRemoveMcpServerRequest(request: UniverseAgentRemoveMcpServerRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.serverId),
		encodeInt32Field(2, request.force === true ? 1 : 0),
		encodeStringField(3, request.scope),
		encodeStringField(4, request.workDir),
	]);
}

/**
 * RemoveMcpServerResponse — `success`=1 `error_message`=2 `removed_name`=3.
 * Unknown fields unread.
 */
export function decodeRemoveMcpServerResponse(bytes: Uint8Array): RemoveMcpServerResponseWire {
	const fields = readProtoFields(bytes);
	return {
		success: lastVarint(fields, 1) === 1n,
		error_message: lastString(fields, 2),
		removed_name: lastString(fields, 3),
	};
}

function decodePluginHolder(bytes: Uint8Array): { plugin?: PluginSummaryWire } {
	const plugin = lastBytes(readProtoFields(bytes), 1);
	return {
		plugin: plugin ? decodePluginSummary(plugin) : undefined,
	};
}

/**
 * McpServerConfig (Add/Update) — `id`=1 `name`=2 `transport`=3 `command`=4
 * repeated `args`=5 map `env`=6 `url`=7 `enabled`=8.
 * Enum `McpTransport`: UNSPECIFIED=0 omit, STDIO=1 SSE=2 STREAMABLE_HTTP=3.
 * Do not write the JSON string `'STDIO'` into field 3.
 * Do not invent origin / apps / project_override request fields.
 */
function encodeMcpServerConfig(config: UniverseAgentMcpServerConfig): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, config.id),
		encodeStringField(2, config.name),
		encodeInt32Field(3, mcpTransportEnum(config.transport)),
		encodeStringField(4, config.command),
		encodeRepeatedString(5, config.args ?? []),
		encodeStringStringMap(6, config.env),
		encodeStringField(7, config.url),
		encodeInt32Field(8, config.enabled === true ? 1 : 0),
	]);
}

/**
 * Decode McpServerConfig for `mapMcpServerConfigFromWire` (transport is a string).
 * Unknown / list-only metadata unread.
 */
function decodeMcpServerConfig(bytes: Uint8Array): Record<string, unknown> {
	const fields = readProtoFields(bytes);
	const args = allLengthDelimited(fields, 5).map(value => Buffer.from(value).toString('utf8'));
	return {
		id: lastString(fields, 1),
		name: lastString(fields, 2),
		transport: mcpTransportWireName(lastVarint(fields, 3)),
		command: lastString(fields, 4),
		args: args.length > 0 ? args : undefined,
		env: decodeStringStringMap(allLengthDelimited(fields, 6)),
		url: lastString(fields, 7),
		enabled: lastVarint(fields, 8) === 1n,
	};
}

/** proto3 `map<string,string>` = repeated MapEntry (`key`=1 `value`=2). */
function encodeStringStringMap(field: number, values: Readonly<Record<string, string>> | undefined): Buffer {
	if (!values) {
		return Buffer.alloc(0);
	}
	return Buffer.concat(Object.entries(values).map(([key, value]) => encodeMessageField(field, Buffer.concat([
		encodeStringField(1, key),
		encodeStringField(2, value),
	]))));
}

function mcpTransportEnum(transport: UniverseAgentMcpTransport): number {
	switch (transport) {
		case 'stdio':
			return 1;
		case 'sse':
			return 2;
		case 'streamable_http':
			return 3;
		default:
			return 0;
	}
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
