/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UniverseAgentCompactRequest } from '../../common/universeAgentTypes.js';
import {
	encodeStringField,
	lastString,
	lastVarint,
	readProtoFields,
} from './grpcProtoCodec.js';

/**
 * JSON-shaped decode of AgentService.CompactResponse.
 * `outcome` is CompactOutcomeProto varint (0–7). Mapper: `mapCompactOutcome`.
 */
export interface CompactResponseWire {
	readonly success?: boolean;
	readonly message?: string;
	readonly tokens_before?: number;
	readonly tokens_after?: number;
	readonly outcome?: number;
	readonly reject_reason?: string;
}

/**
 * AgentService.Compact — `session_id`=1 `agent_id`=2.
 * proto3 / proto comment: empty strings omitted.
 */
export function encodeCompactRequest(request: UniverseAgentCompactRequest): Uint8Array {
	return Buffer.concat([
		encodeStringField(1, request.sessionId),
		encodeStringField(2, request.agentId),
	]);
}

/**
 * CompactResponse — `success`=1 `message`=2 `tokens_before`=3 `tokens_after`=4
 * `outcome`=5 (CompactOutcomeProto 0–7, varint) `reject_reason`=6.
 * proto3: empty / 0 / false omitted. Unknown fields unread.
 * Shape matches `mapCompactResponse` / `mapCompactOutcome(wire.outcome)`.
 */
export function decodeCompactResponse(bytes: Uint8Array): CompactResponseWire {
	const fields = readProtoFields(bytes);
	const success = lastVarint(fields, 1);
	return {
		success: success === undefined ? undefined : success === 1n,
		message: lastString(fields, 2),
		tokens_before: numberOrUndefined(lastVarint(fields, 3)),
		tokens_after: numberOrUndefined(lastVarint(fields, 4)),
		outcome: numberOrUndefined(lastVarint(fields, 5)),
		reject_reason: lastString(fields, 6),
	};
}

function numberOrUndefined(value: bigint | undefined): number | undefined {
	return value === undefined ? undefined : Number(value);
}
