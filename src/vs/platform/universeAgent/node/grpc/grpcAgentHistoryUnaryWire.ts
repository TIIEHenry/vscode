/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentAgentHistoryRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeInt32Field,
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.HistoryEntry.
 * Shape matches `mapHistoryEntry` input.
 */
export interface HistoryEntryWire {
	readonly role?: string;
	readonly content?: string;
	readonly timestamp?: number;
	readonly agent_id?: string;
}

/**
 * JSON-shaped decode of AgentService.HistoryResponse.
 * Shape matches `mapHistoryResponse` input.
 */
export interface HistoryResponseWire {
	readonly entries?: HistoryEntryWire[];
	readonly total?: number;
}

/**
 * AgentService.History — `session_id`=1 `agent_id`=2 `limit`=3 `offset`=4.
 * proto3: empty strings / 0 omitted.
 */
export function encodeHistoryRequest(request: UniverseAgentAgentHistoryRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
		encodeInt32Field(3, request.limit),
		encodeInt32Field(4, request.offset),
	]);
}

/**
 * HistoryResponse — repeated `entries`=1 (HistoryEntry) `total`=2.
 * HistoryEntry: `role`=1 `content`=2 `timestamp`=3 `agent_id`=4.
 * proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `mapHistoryResponse` / `mapHistoryEntry`.
 */
export function decodeHistoryResponse(bytes: Uint8Array): HistoryResponseWire {
	const fields = readProtoFields(bytes);
	return {
		entries: allLengthDelimited(fields, 1).map(decodeHistoryEntry),
		total: numberOrUndefined(lastVarint(fields, 2)),
	};
}

function decodeHistoryEntry(bytes: Uint8Array): HistoryEntryWire {
	const fields = readProtoFields(bytes);
	return {
		role: lastString(fields, 1),
		content: lastString(fields, 2),
		timestamp: numberOrUndefined(lastVarint(fields, 3)),
		agent_id: lastString(fields, 4),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
