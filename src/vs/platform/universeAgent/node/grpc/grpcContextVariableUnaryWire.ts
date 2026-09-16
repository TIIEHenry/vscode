/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	UniverseAgentContextVariableListRequest,
	UniverseAgentContextVariableReadRequest,
} from '../../common/universeAgentTypes.js';
import type {
	ContextVariableEntrySummaryWire,
	ContextVariableEntryWire,
	ContextVariableListResponseWire,
	ContextVariableReadResponseWire,
} from './grpcClientMappersCatalog.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * ContextVariableService.List — `session_id`=1 `agent_id`=2.
 * proto3: empty strings omitted.
 */
export function encodeContextVariableListRequest(request: UniverseAgentContextVariableListRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * ContextVariableListResponse — repeated `current`=1 repeated `inherited`=2.
 * ContextVariableEntrySummary: `name`=1 `scope`=2 `updated_by`=3 `updated_at`=4
 * `content_preview`=5. VARIABLE_GLOBAL=0 omitted. Unknown fields unread.
 */
export function decodeContextVariableListResponse(bytes: Uint8Array): ContextVariableListResponseWire {
	const fields = readProtoFields(bytes);
	return {
		current: allLengthDelimited(fields, 1).map(decodeContextVariableEntrySummary),
		inherited: allLengthDelimited(fields, 2).map(decodeContextVariableEntrySummary),
	};
}

/**
 * ContextVariableService.Read — `session_id`=1 `name`=2 `agent_id`=3.
 * proto3: empty strings omitted.
 */
export function encodeContextVariableReadRequest(request: UniverseAgentContextVariableReadRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.name),
		encodeStringField(3, request.agentId),
	]);
}

/**
 * ContextVariableReadResponse — `entry`=1.
 * ContextVariableEntry: `name`=1 `content`=2 `scope`=3 `updated_by`=4 `updated_at`=5.
 * VARIABLE_GLOBAL=0 omitted. Unknown fields unread.
 */
export function decodeContextVariableReadResponse(bytes: Uint8Array): ContextVariableReadResponseWire {
	const entry = lastBytes(readProtoFields(bytes), 1);
	return {
		entry: entry ? decodeContextVariableEntry(entry) : undefined,
	};
}

function decodeContextVariableEntrySummary(bytes: Uint8Array): ContextVariableEntrySummaryWire {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1),
		scope: numberOrUndefined(lastVarint(fields, 2)),
		updated_by: lastString(fields, 3),
		updated_at: numberOrUndefined(lastVarint(fields, 4)),
		content_preview: lastString(fields, 5),
	};
}

function decodeContextVariableEntry(bytes: Uint8Array): ContextVariableEntryWire {
	const fields = readProtoFields(bytes);
	return {
		name: lastString(fields, 1),
		content: lastString(fields, 2),
		scope: numberOrUndefined(lastVarint(fields, 3)),
		updated_by: lastString(fields, 4),
		updated_at: numberOrUndefined(lastVarint(fields, 5)),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
