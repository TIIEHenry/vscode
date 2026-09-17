/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentAgentStatusRequest } from '../../common/universeAgentTypes.js';
import {
	allLengthDelimited,
	encodeStringField,
	lastBytes,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.StatusResponse.
 * Mapper: `mapStatusResponse` → `mapAgentTreeNode(wire.agent)`.
 */
export interface StatusResponseWire {
	readonly agent?: AgentInfoWire;
}

/**
 * JSON-shaped decode of common.AgentInfo scalars 1–7 and `children`=8.
 * `type` / `status` are proto enum names after varint decode.
 * `children` is repeated nested AgentInfo (recursive). `model_info`=9 is unread
 * (public tree type has no corresponding field).
 */
export interface AgentInfoWire {
	readonly agent_id?: string;
	readonly name?: string;
	readonly type?: string;
	readonly status?: string;
	readonly model?: string;
	readonly turn_count?: number;
	readonly created_at?: number;
	readonly children?: readonly AgentInfoWire[];
}

const AGENT_TYPE_NAMES = [
	'AGENT_TYPE_ROOT',
	'AGENT_TYPE_SUB',
	'AGENT_TYPE_MEMBER',
	'AGENT_TYPE_ADVISE',
] as const;

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

/**
 * AgentService.Status — `session_id`=1 `agent_id`=2.
 * proto3: empty strings omitted.
 */
export function encodeStatusRequest(request: UniverseAgentAgentStatusRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * StatusResponse — `agent`=1 (AgentInfo).
 * AgentInfo: `agent_id`=1 `name`=2 `type`=3 `status`=4 `model`=5 `turn_count`=6 `created_at`=7
 * `children`=8 (repeated nested AgentInfo, recursive). `model_info`=9 unread.
 * `type` / `status` decoded as varint (AgentType 0–3 ROOT/SUB/MEMBER/ADVISE;
 * AgentStatus 0–7 UNKNOWN/PENDING/WAITING/GENERATING/PAUSED/ERROR/COMPLETED/TIMEOUT).
 * proto3: empty / 0 omitted. Unknown fields unread.
 * Shape matches `mapStatusResponse` → `mapAgentTreeNode(wire.agent)`.
 */
export function decodeStatusResponse(bytes: Uint8Array): StatusResponseWire {
	const agent = lastBytes(readProtoFields(bytes), 1);
	return {
		agent: agent === undefined ? undefined : decodeAgentInfo(agent),
	};
}

function decodeAgentInfo(bytes: Uint8Array): AgentInfoWire {
	const fields = readProtoFields(bytes);
	return {
		agent_id: lastString(fields, 1),
		name: lastString(fields, 2),
		type: enumName(AGENT_TYPE_NAMES, lastVarint(fields, 3)),
		status: enumName(AGENT_STATUS_NAMES, lastVarint(fields, 4)),
		model: lastString(fields, 5),
		turn_count: numberOrUndefined(lastVarint(fields, 6)),
		created_at: numberOrUndefined(lastVarint(fields, 7)),
		children: allLengthDelimited(fields, 8).map(decodeAgentInfo),
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
