/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentListSessionsRequest } from '../../common/universeAgentTypes.js';
import type { DeviceInfoWire, ListAgentProfilesResponseWire, ListDevicesResponseWire } from './grpcClientMappersCatalog.js';
import type { AgentInfoWire, AgentTreeResponseWire, ListSessionsResponseWire } from './grpcClientMappersSession.js';
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
 * proto3 empty message. gRPC still writes a DATA frame (5-byte prefix + 0
 * payload). Callers must pass this to `makeUnaryBytesClient` — never skip
 * `sendMessage` for empty `{}` (that yields "received none").
 */
export const EMPTY_PROTO_MESSAGE = new Uint8Array(0);

const AGENT_STATUS_NAMES = [
	'AGENT_STATUS_UNKNOWN',
	'AGENT_STATUS_PENDING',
	'AGENT_STATUS_WAITING',
	'AGENT_STATUS_GENERATING',
	'AGENT_STATUS_PAUSED',
	'AGENT_STATUS_ERROR',
	'AGENT_STATUS_COMPLETED',
	'AGENT_STATUS_TIMEOUT',
] as const;

const AGENT_TYPE_NAMES = [
	'AGENT_TYPE_ROOT',
	'AGENT_TYPE_SUB',
	'AGENT_TYPE_MEMBER',
	'AGENT_TYPE_ADVISE',
] as const;

export function encodeEmptyProtoMessage(): Uint8Array {
	return EMPTY_PROTO_MESSAGE;
}

export function encodeListSessionsRequest(request: UniverseAgentListSessionsRequest): Uint8Array {
	return Buffer.concat([
		encodeInt32Field(1, request.limit),
		encodeInt32Field(2, request.offset),
	]);
}

export function decodeListSessionsResponse(bytes: Uint8Array): ListSessionsResponseWire {
	const fields = readProtoFields(bytes);
	const sessions = allLengthDelimited(fields, 1).map(decodeSessionSummary);
	const total = lastVarint(fields, 2);
	return {
		sessions,
		...(total !== undefined ? { total_count: Number(total) } : {}),
	};
}

export function encodeListAgentProfilesRequest(projectPath: string | undefined): Uint8Array {
	return encodeStringField(1, projectPath);
}

export function decodeListAgentProfilesResponse(bytes: Uint8Array): ListAgentProfilesResponseWire {
	return {
		profiles: allLengthDelimited(readProtoFields(bytes), 1).map(decodeAgentProfile),
	};
}

export function encodeListDevicesRequest(): Uint8Array {
	return encodeEmptyProtoMessage();
}

export function decodeListDevicesResponse(bytes: Uint8Array): ListDevicesResponseWire {
	return {
		devices: allLengthDelimited(readProtoFields(bytes), 1).map(decodeDeviceInfo),
	};
}

export function encodeAgentTreeRequest(sessionId: string): Uint8Array {
	return encodeStringField(1, sessionId);
}

export function decodeAgentTreeResponse(bytes: Uint8Array): AgentTreeResponseWire {
	const root = lastBytes(readProtoFields(bytes), 1);
	return { root: root ? decodeAgentInfo(root) : undefined };
}

function decodeSessionSummary(bytes: Uint8Array): NonNullable<ListSessionsResponseWire['sessions']>[number] {
	const fields = readProtoFields(bytes);
	const status = lastVarint(fields, 2);
	return {
		session_id: lastString(fields, 1) ?? '',
		status: enumName(AGENT_STATUS_NAMES, status),
		created_at: numberOrUndefined(lastVarint(fields, 3)),
		last_accessed_at: numberOrUndefined(lastVarint(fields, 4)),
		turn_count: numberOrUndefined(lastVarint(fields, 5)),
		model: lastString(fields, 6),
		title: lastString(fields, 7),
	};
}

function decodeAgentInfo(bytes: Uint8Array): AgentInfoWire {
	const fields = readProtoFields(bytes);
	return {
		agent_id: lastString(fields, 1) ?? '',
		name: lastString(fields, 2) ?? '',
		type: enumName(AGENT_TYPE_NAMES, lastVarint(fields, 3)) ?? AGENT_TYPE_NAMES[0],
		status: enumName(AGENT_STATUS_NAMES, lastVarint(fields, 4)) ?? 'AGENT_STATUS_UNKNOWN',
		model: lastString(fields, 5) ?? '',
		turn_count: numberOrUndefined(lastVarint(fields, 6)) ?? 0,
		created_at: numberOrUndefined(lastVarint(fields, 7)) ?? 0,
		children: allLengthDelimited(fields, 8).map(decodeAgentInfo),
	};
}

function decodeAgentProfile(bytes: Uint8Array): NonNullable<ListAgentProfilesResponseWire['profiles']>[number] {
	const fields = readProtoFields(bytes);
	return {
		id: lastString(fields, 1) ?? '',
		name: lastString(fields, 2) ?? '',
		description: lastString(fields, 3),
		system_prompt: lastString(fields, 4),
		disabled_tools: allLengthDelimited(fields, 5).map(value => Buffer.from(value).toString('utf8')),
		enabled_tools: allLengthDelimited(fields, 6).map(value => Buffer.from(value).toString('utf8')),
		permission_mode: lastString(fields, 7),
		whitelist_mode: lastVarint(fields, 10) === 1n,
		summary: lastString(fields, 11),
		usage: lastString(fields, 12),
		detail_level: lastString(fields, 13),
		source: lastString(fields, 14),
		enabled: lastVarint(fields, 15) === 1n,
		builtin_default: lastVarint(fields, 16) === 1n,
	};
}

function decodeDeviceInfo(bytes: Uint8Array): DeviceInfoWire {
	const fields = readProtoFields(bytes);
	return {
		device_id: lastString(fields, 1) ?? '',
		display_name: lastString(fields, 2) ?? '',
		role: lastString(fields, 3) ?? '',
		platform: lastString(fields, 4) ?? '',
		paired_at: numberOrUndefined(lastVarint(fields, 5)),
		last_seen_at: numberOrUndefined(lastVarint(fields, 6)),
		active: lastVarint(fields, 7) === 1n,
	};
}

function enumName(names: readonly string[], value: bigint | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}
	return names[Number(value)] ?? names[0];
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
